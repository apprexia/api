export interface GeoLocation {
    lat: number;
    lon: number;
}

export interface NearbyPlace extends GeoLocation {
    name: string;
    distance: number; // mètres
    walkingTime?: number; // minutes
}

export interface TransportLocations {
    metro?: NearbyPlace;
    tram?: NearbyPlace;
    bus?: NearbyPlace;
    trainStation?: NearbyPlace;
}

export interface ShoppingLocations {
    supermarket?: NearbyPlace;
    bakery?: NearbyPlace;
    shoppingCenter?: NearbyPlace;
}

export interface EducationLocations {
    kindergarten?: NearbyPlace;
    school?: NearbyPlace;
    highSchool?: NearbyPlace;
    university?: NearbyPlace;
    businessSchool?: NearbyPlace;
}

export interface LocationEngineInput {
    property: GeoLocation;

    transport: TransportLocations;

    shopping: ShoppingLocations;

    education: EducationLocations;
}

export interface LocationAnalysis {
    score: number;

    property: GeoLocation;

    transport: TransportLocations;

    shopping: ShoppingLocations;

    education: EducationLocations;

    badges: string[];

    strengths: string[];

    weaknesses: string[];
}
