import { Body, Controller, Delete, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';

import { ComparisonService } from './comparison.service';
import { CreateComparisonDto } from './dto/create-comparison.dto';
import { UpdateComparisonDto } from './dto/update-comparison.dto';
import { AuthGuard } from '@nestjs/passport';

// Adapte cet import selon ton projet

@Controller('comparisons')
@UseGuards(AuthGuard('jwt'))
export class ComparisonController {
    constructor(private readonly comparisonService: ComparisonService) {}

    @Post()
    create(@Request() req, @Body() dto: CreateComparisonDto) {
        return this.comparisonService.create(req.user.id, dto);
    }

    @Get()
    findAll(@Request() req) {
        return this.comparisonService.findAll(req.user.id);
    }

    @Get(':id')
    findOne(@Param('id') id: string, @Request() req) {
        return this.comparisonService.findOne(id, req.user.id);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Request() req, @Body() dto: UpdateComparisonDto) {
        return this.comparisonService.update(id, req.user.id, dto);
    }

    @Delete(':id')
    remove(@Param('id') id: string, @Request() req) {
        return this.comparisonService.remove(id, req.user.id);
    }
}
