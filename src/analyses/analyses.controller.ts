import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AnalysesService } from './analyses.service';
import { CreateAnalysisDto } from './dto/create-analysis.dto';
import { UpdateAnalysisDto } from './dto/update-analysis.dto';

@Controller('analyses')
export class AnalysesController {
  constructor(private readonly analysesService: AnalysesService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Body() dto: CreateAnalysisDto, @Req() req) {
    return this.analysesService.create(dto, req.user.sub);
  }

  @Get(':id/status')
  getStatus(@Param('id') id: string) {
    return this.analysesService.getStatus(id);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  findAll(@Req() req, @Query('page') page = '1', @Query('limit') limit = '10') {
    return this.analysesService.findAll(
      req.user.sub,
      Number(page),
      Number(limit),
    );
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  findOne(@Param('id') id: string, @Req() req) {
    return this.analysesService.findOne(id, req.user.sub);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  update(
    @Param('id') id: string,
    @Body() updateAnalysisDto: UpdateAnalysisDto,
    @Req() req,
  ) {
    return this.analysesService.update(id, req.user.sub, updateAnalysisDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  remove(@Param('id') id: string, @Req() req) {
    return this.analysesService.remove(id, req.user.sub);
  }
}
