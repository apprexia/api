import { IsUrl } from 'class-validator';

export class CreateExtensionAnalysisDto {
  @IsUrl()
  url: string;
}
