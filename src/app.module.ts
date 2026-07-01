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

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    AuthModule,
    AnalysesModule,
    FavoritesModule,
    CreditsModule,
    StripeModule,
    DvfModule,
  ],
  controllers: [AppController],
  providers: [AppService, AnalysesAiService, OpenaiService],
})
export class AppModule {}
