import { Controller, Get, Param, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ReportService } from './report.service';
import { AnalysesService } from '../analyses/analyses.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('report')
export class ReportController {
    constructor(
        private readonly analysisService: AnalysesService,
        private readonly reportService: ReportService,
    ) {}

    @Get(':id/report')
    @UseGuards(AuthGuard('jwt'))
    async generateReport(@Param('id') id: string, @Req() req, @Res() res: Response) {
        const userId = req.user.sub;

        const analysis = await this.analysisService.findOne(id, userId);

        const pdf = await this.reportService.generateAnalysisPdf(analysis);

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename=apprexia-report-${id}.pdf`,
        });

        res.send(pdf);
    }
}
