export interface ListingSchema {
    '@type'?: string;
    '@graph'?: ListingSchema[];
    mainEntity?: ListingSchema;

    name?: string;
    description?: string;

    image?: string | string[];

    address?: SchemaAddress;

    offers?: SchemaOffer;

    price?: string | number;
    priceCurrency?: string;
}

interface SchemaOffer {
    price?: string | number;
    lowPrice?: string | number;
    priceCurrency?: string;
}

interface SchemaAddress {
    streetAddress?: string;
    codePostal?: string;
    addressLocality?: string;
    addressRegion?: string;
}
