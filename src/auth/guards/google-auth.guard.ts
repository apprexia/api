import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
    handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
        const response = context.switchToHttp().getResponse<Response>();

        if (err || !user) {
            return response.redirect(`${process.env.FRONTEND_URL}/login?oauth=cancelled`);
        }

        return user;
    }
}
