import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AnalysesService } from './analyses.service';
import { CreateAnalysisDto } from './dto/create-analysis.dto';
import { UpdateAnalysisDto } from './dto/update-analysis.dto';
import { CreateManualAnalysisDto } from './dto/create-manual-analysis.dto';
import { AnalysisStatus } from '@prisma/client';

@Controller('analyses')
export class AnalysesController {
  constructor(private readonly analysesService: AnalysesService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Body() dto: CreateAnalysisDto, @Req() req) {
    return this.analysesService.create(dto, req.user.sub);
  }

  @Post('manual')
  @UseGuards(AuthGuard('jwt'))
  createManual(@Body() dto: CreateManualAnalysisDto, @Req() req) {
    return this.analysesService.createManual(dto, req.user.sub);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('extension')
  async analyzeExtension(@Body() body: { url: string }, @Req() req) {
    console.log('USER EXTENSION:', req.user);

    return this.analysesService.createExtension(body.url, req.user.sub);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get(':id/status')
  getStatus(@Param('id') id: string) {
    return this.analysesService.getStatus(id);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  findAll(
    @Req() req,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('status') status?: AnalysisStatus,
  ) {
    return this.analysesService.findAll(
      req.user.sub,
      Number(page),
      Number(limit),
      status,
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
