import { Module } from '@nestjs/common';

import { ComparisonController } from './comparison.controller';
import { ComparisonService } from './comparison.service';
import { PrismaModule } from '../services/prisma/prisma.module';
import { ComparisonEngineService } from './comparison-engine.service';

@Module({
    imports: [PrismaModule],
    controllers: [ComparisonController],
    providers: [ComparisonService, ComparisonEngineService],
    exports: [ComparisonService, ComparisonEngineService],
})
export class ComparisonModule {}