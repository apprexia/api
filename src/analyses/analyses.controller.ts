import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { AnalysesService } from './analyses.service';
import { CreateAnalysisDto } from './dto/create-analysis.dto';
import { UpdateAnalysisDto } from './dto/update-analysis.dto';

@Controller('analyses')
export class AnalysesController {
  constructor(private readonly analysesService: AnalysesService) {}

  @Post()
  create(@Body() createAnalysisDto: CreateAnalysisDto) {
    return this.analysesService.create(createAnalysisDto);
  }

  @Get(':id/status')
  getStatus(@Param('id') id: string) {
    return this.analysesService.getStatus(id);
  }

  @Get()
  findAll(@Query('page') page = '1', @Query('limit') limit = '10') {
    return this.analysesService.findAll(Number(page), Number(limit));
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.analysesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateAnalysisDto: UpdateAnalysisDto,
  ) {
    return this.analysesService.update(id, updateAnalysisDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.analysesService.remove(id);
  }
}
