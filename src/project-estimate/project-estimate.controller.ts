import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProjectEstimateService } from './project-estimate.service';
import { CreateProjectEstimateDto } from './dto/create-project-estimate.dto';

@Controller('project-estimate')
@UseGuards(AuthGuard('jwt'))
export class ProjectEstimateController {
    constructor(private readonly projectService: ProjectEstimateService) {}

    @Post()
    async saveProject(@Req() req, @Body() dto: CreateProjectEstimateDto) {
        const userId = req.user.sub;

        return this.projectService.saveProjectEstimate(userId, dto);
    }

    @Get()
    async getProject(@Req() req) {
        const userId = req.user.sub;

        return this.projectService.getProjectEstimate(userId);
    }
}
