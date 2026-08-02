export interface OverpassElement {
  type: string;

  id: number;

  lat?: number;

  lon?: number;

  center?: {
    lat: number;
    lon: number;
  };

  tags?: {
    [key: string]: string;
  };

  distance?: number;
}

export interface OverpassResponse {
  version: number;
  generator: string;
  elements: OverpassElement[];
}
