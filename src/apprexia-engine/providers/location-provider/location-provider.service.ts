import { Injectable, Logger } from '@nestjs/common';

import { GeoLocation, LocationEngineInput, NearbyPlace } from '../../interfaces/location-analysis.interface';

import { OverpassElement, OverpassResponse } from './interfaces/overpass-response.interface';

import { PrismaService } from '../../../services/prisma/prisma.service';

@Injectable()
export class LocationProviderService {
    private readonly logger = new Logger(LocationProviderService.name);

    private readonly CACHE_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 jours

    private readonly overpassUrls = [
        'https://overpass-api.de/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter',
        'https://overpass.private.coffee/api/interpreter',
    ];

    constructor(private readonly prisma: PrismaService) {}

    async getLocationData(
        latitude: number,
        longitude: number,
        city?: string,
        codePostal?: string,
        radius = 2000,
    ): Promise<LocationEngineInput> {
        /**
         * ===============================
         * CACHE DATABASE
         * ===============================
         */

        let cached: Awaited<ReturnType<typeof this.prisma.locationCache.findUnique>> = null;

        if (city && codePostal) {
            cached = await this.prisma.locationCache.findUnique({
                where: {
                    city_codePostal_radius: {
                        city,
                        codePostal,
                        radius,
                    },
                },
            });

            const expired = cached && Date.now() - cached.updatedAt.getTime() > this.CACHE_DURATION;

            if (cached && !expired) {
                this.logger.log(`Location cache utilisé : ${city} ${codePostal}`);

                return cached.data as unknown as LocationEngineInput;
            }
        }
        /**
         * ===============================
         * OVERPASS QUERY
         * ===============================
         */

        const query = `
[out:json][timeout:25];

(
nwr(around:${radius},${latitude},${longitude})[station=subway];

nwr(around:${radius},${latitude},${longitude})[railway=station];

nwr(around:600,${latitude},${longitude})[highway=bus_stop];

nwr(around:800,${latitude},${longitude})[shop=supermarket];

nwr(around:500,${latitude},${longitude})[shop=bakery];

nwr(around:1200,${latitude},${longitude})[amenity=kindergarten];

nwr(around:1200,${latitude},${longitude})[amenity=school];

nwr(around:2000,${latitude},${longitude})[amenity=college];

nwr(around:3000,${latitude},${longitude})[amenity=university];

);

out center tags;
`;

        try {
            const data = await this.callOverpass(query);

            const result = this.buildLocationResult(data, latitude, longitude);

            /**
             * ===============================
             * SAVE CACHE
             * ===============================
             */

            if (city && codePostal) {
                await this.prisma.locationCache.upsert({
                    where: {
                        city_codePostal_radius: {
                            city,
                            codePostal,
                            radius,
                        },
                    },

                    update: {
                        data: result as any,
                        latitude,
                        longitude,
                    },

                    create: {
                        city,
                        codePostal,
                        radius,

                        latitude,
                        longitude,

                        data: result as any,
                    },
                });
            }

            return result;
        } catch (error) {
            this.logger.warn('Impossible de récupérer les données Overpass');

            /**
             * fallback cache même expiré
             */

            if (cached) {
                this.logger.warn('Utilisation ancien cache location');

                return cached.data as unknown as LocationEngineInput;
            }

            throw error;
        }
    }

    /**
     * Construction du résultat moteur
     */
    private buildLocationResult(data: OverpassResponse, latitude: number, longitude: number): LocationEngineInput {
        const elements = data.elements;

        this.logger.log(`Overpass résultats : ${elements.length} éléments`);

        elements.forEach((element) => {
            const coords = this.extractCoordinates(element);

            if (coords) {
                element.distance = this.distanceInMeters(latitude, longitude, coords.lat, coords.lon);
            }
        });

        return {
            property: {
                lat: latitude,
                lon: longitude,
            },

            transport: {
                metro: this.findNearestMetro(elements),

                trainStation: this.findNearest(elements, 'railway', 'station'),

                bus: this.findNearest(elements, 'highway', 'bus_stop'),
            },

            shopping: {
                supermarket: this.findNearest(elements, 'shop', 'supermarket'),

                bakery: this.findNearest(elements, 'shop', 'bakery'),
            },

            education: {
                kindergarten: this.findNearest(elements, 'amenity', 'kindergarten'),

                school: this.findNearest(elements, 'amenity', 'school'),

                highSchool: this.findNearest(elements, 'amenity', 'college'),

                university: this.findNearest(elements, 'amenity', 'university'),

                businessSchool: this.findBusinessSchool(elements),
            },
        };
    }

    private extractCoordinates(element: OverpassElement): GeoLocation | undefined {
        const lat = element.lat ?? element.center?.lat;

        const lon = element.lon ?? element.center?.lon;

        if (lat === undefined || lon === undefined) {
            return undefined;
        }

        return {
            lat,
            lon,
        };
    }

    private async callOverpass(query: string): Promise<OverpassResponse> {
        const requests = this.overpassUrls.map(async (url) => {
            this.logger.log(`Tentative Overpass : ${url}`);

            const controller = new AbortController();

            const timeout = setTimeout(() => controller.abort(), 4000);

            try {
                const response = await fetch(url, {
                    method: 'POST',

                    headers: {
                        Accept: 'application/json',

                        'User-Agent': 'Apprexia/1.0',
                    },

                    body: new URLSearchParams({
                        data: query,
                    }),

                    signal: controller.signal,
                });

                clearTimeout(timeout);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                return await response.json();
            } catch (error) {
                clearTimeout(timeout);

                this.logger.warn(`Overpass indisponible : ${url}`);

                throw error;
            }
        });

        try {
            return await Promise.any(requests);
        } catch {
            throw new Error('Tous les serveurs Overpass sont indisponibles');
        }
    }

    private findNearestMetro(elements: OverpassElement[]): NearbyPlace | undefined {
        const matches = elements.filter(
            (e) => e.tags?.station === 'subway' || e.tags?.subway === 'yes' || e.tags?.railway === 'subway_entrance',
        );

        if (!matches.length) {
            return undefined;
        }

        matches.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));

        return this.toNearbyPlace(matches[0], 'Entrée métro');
    }

    private findBusinessSchool(elements: OverpassElement[]): NearbyPlace | undefined {
        const schools = elements.filter((element) => {
            const name = element.tags?.name?.toLowerCase();

            return (
                name?.includes('business') ||
                name?.includes('commerce') ||
                name?.includes('management') ||
                name?.includes('school')
            );
        });

        if (!schools.length) {
            return undefined;
        }

        schools.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));

        return this.toNearbyPlace(schools[0], 'École supérieure');
    }

    private findNearest(elements: OverpassElement[], key: string, value: string): NearbyPlace | undefined {
        const matches = elements.filter((e) => e.tags?.[key] === value);

        if (!matches.length) {
            return undefined;
        }

        matches.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));

        return this.toNearbyPlace(matches[0], value);
    }

    private toNearbyPlace(element: OverpassElement, fallback: string): NearbyPlace {
        const coords = this.extractCoordinates(element);

        if (!coords) {
            throw new Error('Coordonnées manquantes');
        }

        return {
            name: element.tags?.name ?? fallback,

            distance: Math.round(element.distance ?? 0),

            walkingTime: Math.round((element.distance ?? 0) / 80),

            ...coords,
        };
    }

    private distanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371000;

        const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

        const dLat = toRadians(lat2 - lat1);

        const dLon = toRadians(lon2 - lon1);

        const a =
            Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;

        return Math.round(R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))));
    }
}
