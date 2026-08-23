import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './services/prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { AnalysesModule } from './analyses/analyses.module';
import { FavoritesModule } from './favorites/favorites.module';
import { AnalysesAiService } from './services/analyses-ai/analyses-ai.service';
import { OpenaiService } from './services/openai/openai.service';
import { CreditsModule } from './credits/credits.module';
import { StripeModule } from './stripe/stripe.module';
import { DvfModule } from './dvf/dvf.module';
import { AnalysisMarketService } from './analysis-market/analysis-market.service';
import { ApprexiaEngineModule } from './apprexia-engine/apprexia-engine.module';
import { RentalMarketModule } from './rental-market/rental-market.module';
import { ReportService } from './report/report.service';
import { ReportModule } from './report/report.module';
import { HttpModule } from '@nestjs/axios';
import { CommuneIndicatorModule } from './commune-indicator/commune-indicator.module';
import { ConfigModule } from '@nestjs/config';
import { MetaDataScrapperModule } from './meta-data-scrapper/meta-data-scrapper.module';
import { FirecrawlScraperModule } from './firecrawl-scraper/firecrawl-scraper.module';
import { AdminModule } from './admin/admin.module';
import { ProjectEstimateModule } from './project-estimate/project-estimate.module';

@Module({
    imports: [
        PrismaModule,
        HttpModule,
        UsersModule,
        AuthModule,
        AnalysesModule,
        FavoritesModule,
        CreditsModule,
        StripeModule,
        DvfModule,
        ApprexiaEngineModule,
        RentalMarketModule,
        ReportModule,
        CommuneIndicatorModule,
        MetaDataScrapperModule,
        FirecrawlScraperModule,
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        AdminModule,
        ProjectEstimateModule,
    ],
    controllers: [AppController],
    providers: [AppService, AnalysesAiService, OpenaiService, AnalysisMarketService, ReportService],
})
export class AppModule {}
