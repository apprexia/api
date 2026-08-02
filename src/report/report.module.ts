import { Module } from '@nestjs/common';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import { AnalysesModule } from '../analyses/analyses.module';

@Module({
  imports: [AnalysesModule],
  controllers: [ReportController],
  providers: [ReportService],
})
export class ReportModule {}
