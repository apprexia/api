import { Injectable, Logger } from '@nestjs/common';

import { GeoLocation, LocationEngineInput, NearbyPlace } from '../../interfaces/location-analysis.interface';

import { PrismaService } from '../../../services/prisma/prisma.service';

interface GeoapifyFeature {
    type: 'Feature';

    properties: {
        name?: string;

        lat?: number;
        lon?: number;

        categories?: string[];

        city?: string;
        postcode?: string;
        street?: string;
        housenumber?: string;

        formatted?: string;

        [key: string]: any;
    };

    geometry?: {
        type: string;
        coordinates?: [number, number];
    };
}

interface GeoapifyResponse {
    type: 'FeatureCollection';
    features: GeoapifyFeature[];
}

@Injectable()
export class LocationProviderService {
    private readonly logger = new Logger(LocationProviderService.name);

    private readonly CACHE_DURATION = 30 * 24 * 60 * 60 * 1000;

    private readonly geoapifyUrl = 'https://api.geoapify.com/v2/places';

    private readonly geoapifyApiKey = process.env.GEOAPIFY_API_KEY;

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

        const latitudeKey = Number(latitude.toFixed(3));
        const longitudeKey = Number(longitude.toFixed(3));

        let cached: Awaited<ReturnType<typeof this.prisma.locationCache.findUnique>> = null;

        if (city && codePostal) {
            cached = await this.prisma.locationCache.findUnique({
                where: {
                    city_codePostal_latitude_longitude_radius: {
                        city,
                        codePostal,
                        latitude: latitudeKey,
                        longitude: longitudeKey,
                        radius,
                    },
                },
            });

            const expired = cached && Date.now() - cached.updatedAt.getTime() > this.CACHE_DURATION;

            if (cached && !expired) {
                this.logger.log(`Location cache utilisé : ${city} ${codePostal} (${latitudeKey}, ${longitudeKey})`);

                return cached.data as unknown as LocationEngineInput;
            }
        }

        /**
         * ===============================
         * GEOAPIFY
         * ===============================
         */

        try {
            const data = await this.callGeoapify(latitude, longitude, radius);

            const result = this.buildLocationResult(data, latitude, longitude);

            /**
             * ===============================
             * SAVE CACHE
             * ===============================
             */

            if (city && codePostal) {
                await this.prisma.locationCache.upsert({
                    where: {
                        city_codePostal_latitude_longitude_radius: {
                            city,
                            codePostal,
                            latitude: latitudeKey,
                            longitude: longitudeKey,
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

                        latitude: latitudeKey,
                        longitude: longitudeKey,

                        data: result as any,
                    },
                });
            }

            return result;
        } catch (error) {
            this.logger.warn(
                `Impossible de récupérer les données Geoapify : ${error instanceof Error ? error.message : error}`,
            );

            /**
             * ===============================
             * FALLBACK CACHE EXPIRÉ
             * ===============================
             */

            if (cached) {
                this.logger.warn('Utilisation ancien cache location');

                return cached.data as unknown as LocationEngineInput;
            }

            throw error;
        }
    }

    /**
     * ===============================
     * GEOAPIFY REQUEST
     * ===============================
     */

    private async callGeoapify(latitude: number, longitude: number, radius: number): Promise<GeoapifyResponse> {
        if (!this.geoapifyApiKey) {
            throw new Error('GEOAPIFY_API_KEY non configurée');
        }

        /**
         * Catégories nécessaires à Apprexia
         */
        const categories = [
            'public_transport',
            'commercial.supermarket',
            'commercial.food_and_drink.bakery',
            'childcare.kindergarten',
            'education.school',
            'education.college',
            'education.university',
        ].join(',');

        /**
         * Geoapify utilise un cercle :
         *
         * circle:lon,lat,radius
         *
         * Attention :
         * longitude avant latitude.
         */

        const filter = `circle:${longitude},${latitude},${radius}`;

        const url = new URL(this.geoapifyUrl);

        url.searchParams.set('categories', categories);
        url.searchParams.set('filter', filter);
        url.searchParams.set('limit', '100');
        url.searchParams.set('apiKey', this.geoapifyApiKey);

        this.logger.log(`Geoapify Places : ${categories}`);

        const controller = new AbortController();

        const timeout = setTimeout(() => controller.abort(), 8000);

        try {
            const response = await fetch(url.toString(), {
                method: 'GET',

                headers: {
                    Accept: 'application/json',
                    'User-Agent': 'Apprexia/1.0',
                },

                signal: controller.signal,
            });

            if (!response.ok) {
                const text = await response.text();

                throw new Error(`Geoapify HTTP ${response.status}: ${text}`);
            }

            const data = (await response.json()) as GeoapifyResponse;

            this.logger.log(`Geoapify résultats : ${data.features?.length ?? 0} éléments`);

            return data;
        } finally {
            clearTimeout(timeout);
        }
    }

    /**
     * ===============================
     * BUILD RESULT
     * ===============================
     */

    private buildLocationResult(data: GeoapifyResponse, latitude: number, longitude: number): LocationEngineInput {
        const features = data.features ?? [];

        this.logger.log(`Construction LocationEngineInput depuis ${features.length} résultats Geoapify`);

        /**
         * Ajouter la distance à chaque résultat
         */
        const places = features
            .map((feature) => {
                const coords = this.extractCoordinates(feature);

                if (!coords) {
                    return undefined;
                }

                const distance = this.distanceInMeters(latitude, longitude, coords.lat, coords.lon);

                return {
                    feature,
                    coords,
                    distance,
                };
            })
            .filter(Boolean) as Array<{
            feature: GeoapifyFeature;
            coords: GeoLocation;
            distance: number;
        }>;

        return {
            property: {
                lat: latitude,
                lon: longitude,
            },

            transport: {
                metro: this.findNearestMetro(places),

                trainStation: this.findNearestTrainStation(places),

                bus: this.findNearestBus(places),
            },

            shopping: {
                supermarket: this.findNearestCategory(places, 'commercial.supermarket', 'Supermarché'),

                bakery: this.findNearestCategory(places, 'commercial.food_and_drink.bakery', 'Boulangerie'),
            },

            education: {
                kindergarten: this.findNearestCategory(places, 'childcare.kindergarten', 'École maternelle'),

                school: this.findNearestCategory(places, 'education.school', 'École'),

                highSchool: this.findNearestCategory(places, 'education.college', 'Établissement scolaire'),

                university: this.findNearestCategory(places, 'education.university', 'Université'),

                businessSchool: this.findBusinessSchool(places),
            },
        };
    }

    /**
     * ===============================
     * COORDINATES
     * ===============================
     */

    private extractCoordinates(feature: GeoapifyFeature): GeoLocation | undefined {
        const lon = feature.properties.lon ?? feature.geometry?.coordinates?.[0];

        const lat = feature.properties.lat ?? feature.geometry?.coordinates?.[1];

        if (lat === undefined || lon === undefined) {
            return undefined;
        }

        return {
            lat,
            lon,
        };
    }

    /**
     * ===============================
     * TRANSPORT
     * ===============================
     */

    private findNearestMetro(
        places: Array<{
            feature: GeoapifyFeature;
            coords: GeoLocation;
            distance: number;
        }>,
    ): NearbyPlace | undefined {
        const matches = places.filter((place) => {
            const categories = place.feature.properties.categories ?? [];

            return categories.some(
                (category) => category === 'public_transport.subway' || category.startsWith('public_transport.subway'),
            );
        });

        return this.getNearestPlace(matches, 'Métro');
    }

    private findNearestTrainStation(
        places: Array<{
            feature: GeoapifyFeature;
            coords: GeoLocation;
            distance: number;
        }>,
    ): NearbyPlace | undefined {
        const matches = places.filter((place) => {
            const categories = place.feature.properties.categories ?? [];

            return categories.some((category) => category.includes('railway') || category.includes('train'));
        });

        return this.getNearestPlace(matches, 'Gare');
    }

    private findNearestBus(
        places: Array<{
            feature: GeoapifyFeature;
            coords: GeoLocation;
            distance: number;
        }>,
    ): NearbyPlace | undefined {
        const matches = places.filter((place) => {
            const categories = place.feature.properties.categories ?? [];

            return categories.some((category) => category.includes('bus') || category.includes('public_transport'));
        });

        return this.getNearestPlace(matches, 'Arrêt de bus');
    }

    /**
     * ===============================
     * CATEGORY SEARCH
     * ===============================
     */

    private findNearestCategory(
        places: Array<{
            feature: GeoapifyFeature;
            coords: GeoLocation;
            distance: number;
        }>,
        category: string,
        fallback: string,
    ): NearbyPlace | undefined {
        const matches = places.filter((place) => {
            const categories = place.feature.properties.categories ?? [];

            return categories.includes(category);
        });

        return this.getNearestPlace(matches, fallback);
    }

    /**
     * ===============================
     * BUSINESS SCHOOL
     * ===============================
     */

    private findBusinessSchool(
        places: Array<{
            feature: GeoapifyFeature;
            coords: GeoLocation;
            distance: number;
        }>,
    ): NearbyPlace | undefined {
        const matches = places.filter((place) => {
            const categories = place.feature.properties.categories ?? [];

            const name = place.feature.properties.name?.toLowerCase() ?? '';

            return (
                categories.some((category) => category.includes('college') || category.includes('university')) &&
                (name.includes('business') ||
                    name.includes('commerce') ||
                    name.includes('management') ||
                    name.includes('school'))
            );
        });

        return this.getNearestPlace(matches, 'École supérieure');
    }

    /**
     * ===============================
     * NEAREST
     * ===============================
     */

    private getNearestPlace(
        places: Array<{
            feature: GeoapifyFeature;
            coords: GeoLocation;
            distance: number;
        }>,
        fallback: string,
    ): NearbyPlace | undefined {
        if (!places.length) {
            return undefined;
        }

        places.sort((a, b) => a.distance - b.distance);

        const place = places[0];

        return {
            name: place.feature.properties.name ?? fallback,

            distance: Math.round(place.distance),

            walkingTime: Math.max(1, Math.round(place.distance / 80)),

            ...place.coords,
        };
    }

    /**
     * ===============================
     * DISTANCE
     * ===============================
     */

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
