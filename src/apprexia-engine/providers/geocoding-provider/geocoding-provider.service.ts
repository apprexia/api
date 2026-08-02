import { Injectable } from '@nestjs/common';
import axios from 'axios';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

@Injectable()
export class GeocodingProviderService {
  async getCoordinates(params: {
    city?: string;
    codePostal?: string;
    address?: string;
  }): Promise<Coordinates | null> {
    const query = [params.address, params.codePostal, params.city]
      .filter(Boolean)
      .join(' ');

    if (!query) {
      return null;
    }

    try {
      const response = await axios.get(
        'https://api-adresse.data.gouv.fr/search/',
        {
          params: {
            q: query,
            limit: 1,
          },
          timeout: 5000,
        },
      );

      const feature = response.data.features?.[0];

      if (!feature) {
        console.warn(`⚠️ Adresse non trouvée : ${query}`);
        return null;
      }

      const [longitude, latitude] = feature.geometry.coordinates;

      return {
        latitude,
        longitude,
      };
    } catch (error) {
      console.warn(
        `⚠️ Géocodage indisponible pour "${query}"`,
        error.code ?? error.message,
      );

      return null;
    }
  }
}
