import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';

import { AuthGuard } from '@nestjs/passport';

import { VisitService } from './visit.service';

import { CreateVisitDto } from './dto/create-visit.dto';
import { SaveVisitAnswerDto } from './dto/save-visit-answer.dto';
import { CompleteVisitDto } from './dto/complete-visit.dto';

@Controller('visits')
@UseGuards(AuthGuard('jwt'))
export class VisitController {
    constructor(private readonly visitService: VisitService) {}

    // ============================================================
    // CREATE
    // ============================================================

    @Post()
    create(@Body() dto: CreateVisitDto, @Req() req) {
        return this.visitService.create(dto, req.user.sub);
    }

    // ============================================================
    // GET ALL
    // ============================================================

    @Get()
    findAll(@Req() req) {
        return this.visitService.findAll(req.user.sub);
    }

    // ============================================================
    // QUESTIONS
    // ============================================================

    @Get('questions')
    getQuestions() {
        return this.visitService.getQuestions();
    }

    // ============================================================
    // GET ONE
    // ============================================================

    @Get(':id')
    getById(@Param('id') id: string, @Req() req) {
        return this.visitService.getById(id, req.user.sub);
    }

    // ============================================================
    // SAVE / UPDATE ANSWER
    // ============================================================

    /**
     * Fonctionne pour :
     *
     * - visite IN_PROGRESS
     * - visite COMPLETED en mode /edit
     *
     * Le backend recalcule automatiquement
     * le résultat si la visite était terminée.
     */
    @Patch(':id/answers')
    saveAnswer(@Param('id') id: string, @Body() dto: SaveVisitAnswerDto, @Req() req) {
        return this.visitService.saveAnswer(id, dto, req.user.sub);
    }

    // ============================================================
    // UPDATE STEP
    // ============================================================

    /**
     * Autorisé également pour une visite COMPLETED
     * afin de permettre la navigation en mode édition.
     */
    @Patch(':id/step')
    updateStep(@Param('id') id: string, @Body('step') step: number, @Req() req) {
        return this.visitService.updateStep(id, Number(step), req.user.sub);
    }

    // ============================================================
    // COMPLETE
    // ============================================================

    /**
     * Seule une visite IN_PROGRESS
     * peut être terminée.
     */
    @Patch(':id/complete')
    complete(@Param('id') id: string, @Body() dto: CompleteVisitDto, @Req() req) {
        return this.visitService.complete(id, dto, req.user.sub);
    }
}
