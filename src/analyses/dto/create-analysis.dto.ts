export class CreateAnalysisDto {
    url: string;

    device?: 'mobile' | 'desktop';

    linkPreview?: {
        title?: string;
        description?: string;
        image?: string;
        url?: string;
    };
}
