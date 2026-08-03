export interface LocationCacheData {
    schools?: unknown[];
    hospitals?: unknown[];
    doctors?: unknown[];
    pharmacies?: unknown[];
    transport?: unknown[];
    shops?: unknown[];
    restaurants?: unknown[];

    totalPlaces: number;
    locationScore?: number;
}
