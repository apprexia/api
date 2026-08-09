import { Controller, Get, Post, Delete, Param, Req, UseGuards, Query } from '@nestjs/common';

import { AuthGuard } from '@nestjs/passport';
import { FavoritesService } from './favorites.service';
import type { Verdict } from '../analyses/interfaces/analysis-ai-result.interface';

@Controller('favorites')
@UseGuards(AuthGuard('jwt'))
export class FavoritesController {
    constructor(private readonly favoritesService: FavoritesService) {}

    /**
     * Récupérer les favoris de l'utilisateur connecté
     */
    @Get()
    findAll(@Req() req) {
        return this.favoritesService.findAll(req.user.sub);
    }

    /**
     * Récupérer les favoris avec leurs analyses
     *
     * Pagination + filtre par verdict.
     */
    @Get('with-analyses')
    findFavoriteAnalyses(
        @Req() req,
        @Query('page') page = '1',
        @Query('limit') limit = '9',
        @Query('verdict') verdict?: Verdict,
    ) {
        return this.favoritesService.findFavoriteAnalyses(req.user.sub, Number(page), Number(limit), verdict);
    }

    /**
     * Ajouter / retirer un favori
     */
    @Post(':analysisId')
    toggle(@Param('analysisId') analysisId: string, @Req() req) {
        return this.favoritesService.toggle(req.user.sub, analysisId);
    }

    /**
     * Supprimer un favori
     */
    @Delete(':analysisId')
    remove(@Param('analysisId') analysisId: string, @Req() req) {
        return this.favoritesService.remove(req.user.sub, analysisId);
    }
}
