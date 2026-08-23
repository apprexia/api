import { Module } from '@nestjs/common';
import { ProjectEstimateController } from './project-estimate.controller';
import { ProjectEstimateService } from './project-estimate.service';

@Module({
    controllers: [ProjectEstimateController],
    providers: [ProjectEstimateService],
})
export class ProjectEstimateModule {}
