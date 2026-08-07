import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create(AppModule, {
        rawBody: true,
    });

    app.enableCors({
        origin: [
            'http://localhost:4200',
            'http://localhost:5173',
            'https://www.seloger.com',
            'https://apprexia.com',
            'https://www.apprexia.com',
        ],
        methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
    });

    await app.listen(3000, '0.0.0.0');
}

bootstrap();
