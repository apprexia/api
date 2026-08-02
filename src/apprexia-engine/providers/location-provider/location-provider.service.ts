import { Injectable, Logger } from '@nestjs/common';

import {
  GeoLocation,
  LocationEngineInput,
  NearbyPlace,
} from '../../interfaces/location-analysis.interface';

import {
  OverpassElement,
  OverpassResponse,
} from './interfaces/overpass-response.interface';

@Injectable()
export class LocationProviderService {
  private readonly logger = new Logger(LocationProviderService.name);

  private readonly overpassUrls = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
  ];

  async getLocationData(
    latitude: number,
    longitude: number,
  ): Promise<LocationEngineInput> {
    const query = `
[out:json][timeout:25];

(
  nwr(around:1200,${latitude},${longitude})[station=subway];

  nwr(around:1200,${latitude},${longitude})[railway=station];

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

    let data: OverpassResponse;

    try {
      data = await this.callOverpass(query);
    } catch (error) {
      this.logger.error('Impossible de récupérer les données Overpass');

      throw error;
    }

    const elements = data.elements;

    this.logger.log(`Overpass résultats : ${elements.length} éléments`);

    /**
     * Calcul distances
     */

    elements.forEach((element) => {
      const coords = this.extractCoordinates(element);

      if (coords) {
        element.distance = this.distanceInMeters(
          latitude,
          longitude,
          coords.lat,
          coords.lon,
        );
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

  /**
   * Extraction coordonnées Overpass
   */
  private extractCoordinates(
    element: OverpassElement,
  ): GeoLocation | undefined {
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

  /**
   * Appel Overpass avec fallback
   */

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

  private findNearestMetro(
    elements: OverpassElement[],
  ): NearbyPlace | undefined {
    const matches = elements.filter(
      (e) =>
        e.tags?.station === 'subway' ||
        e.tags?.subway === 'yes' ||
        e.tags?.railway === 'subway_entrance',
    );

    if (!matches.length) {
      return undefined;
    }

    matches.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));

    return this.toNearbyPlace(matches[0], 'Entrée métro');
  }

  private findBusinessSchool(
    elements: OverpassElement[],
  ): NearbyPlace | undefined {
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

  private findNearest(
    elements: OverpassElement[],
    key: string,
    value: string,
  ): NearbyPlace | undefined {
    const matches = elements.filter((e) => e.tags?.[key] === value);

    if (!matches.length) {
      return undefined;
    }

    matches.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));

    return this.toNearbyPlace(matches[0], value);
  }

  /**
   * Transformation Overpass -> NearbyPlace
   */

  private toNearbyPlace(
    element: OverpassElement,
    fallback: string,
  ): NearbyPlace {
    const coords = this.extractCoordinates(element);

    if (!coords) {
      throw new Error('Coordonnées manquantes pour un élément Overpass');
    }

    return {
      name: element.tags?.name ?? fallback,
      distance: Math.round(element.distance ?? 0),
      walkingTime: Math.round((element.distance ?? 0) / 80),
      ...coords,
    };
  }

  private distanceInMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371000;

    const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

    const dLat = toRadians(lat2 - lat1);

    const dLon = toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) ** 2;

    return Math.round(R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))));
  }
}
