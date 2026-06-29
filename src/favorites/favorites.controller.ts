import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Req,
  UseGuards,
  Query,
} from '@nestjs/common';

import { AuthGuard } from '@nestjs/passport';
import { FavoritesService } from './favorites.service';

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

  @Get('with-analyses')
  @UseGuards(AuthGuard('jwt'))
  findFavoriteAnalyses(
    @Req() req,
    @Query('page') page = '1',
    @Query('limit') limit = '9',
  ) {
    return this.favoritesService.findFavoriteAnalyses(
      req.user.sub,
      Number(page),
      Number(limit),
    );
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
