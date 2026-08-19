export type ListingPreviewPlatform = 'leboncoin' | 'seloger' | 'logic-immo' | 'other';

export interface ListingPreview {
    url: string;
    platform: ListingPreviewPlatform;
    title?: string;
    description?: string;
    image?: string;
}
