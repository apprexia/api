import { Injectable } from '@nestjs/common';
import { CreateAuthDto } from './dto/create-auth.dto';
import { UpdateAuthDto } from './dto/update-auth.dto';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../services/prisma/prisma.service';
import { OAuth2Client } from 'google-auth-library';

@Injectable()
export class AuthService {
    constructor(
        private readonly jwtService: JwtService,
        private readonly prisma: PrismaService,
    ) {}

    /**
     * Génération JWT interne Apprexia
     */
    async generateJwt(user: any) {
        return this.jwtService.signAsync({
            sub: user.id,

            email: user.email,

            name: user.name,

            avatar: user.avatar,
        });
    }

    /**
     * Login Google Angular
     * Passport Google
     */
    async loginWithGoogle(googleUser: { email: string; name?: string; avatar?: string }) {
        let user = await this.prisma.user.findUnique({
            where: {
                email: googleUser?.email,
            },
        });

        if (!user) {
            user = await this.prisma.user.create({
                data: {
                    email: googleUser.email,
                    name: googleUser.name,
                    avatar: googleUser.avatar,
                },
            });
        }

        return this.generateJwt(user);
    }

    async loginWithGoogleCode(code: string) {
        const clientId = process.env.GOOGLE_EXTENSION_CLIENT_ID;

        if (!clientId) {
            throw new Error('Variables Google OAuth manquantes');
        }

        const params = new URLSearchParams({
            code,
            client_id: clientId,
            redirect_uri: 'https://jifboojamlpbmomajdphnjhbkkkgajbb.chromiumapp.org/',
            grant_type: 'authorization_code',
        });

        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params,
        });

        const googleTokens = await response.json();

        if (!response.ok) {
            console.error('Google OAuth error:', googleTokens);
            throw new Error('Erreur OAuth Google');
        }

        if (!googleTokens.id_token) {
            throw new Error('Token Google absent');
        }

        const client = new OAuth2Client(clientId);

        const ticket = await client.verifyIdToken({
            idToken: googleTokens.id_token,
            audience: clientId,
        });

        const payload = ticket.getPayload();

        if (!payload?.email) {
            throw new Error('Email Google introuvable');
        }

        let user = await this.prisma.user.findUnique({
            where: {
                email: payload.email,
            },
        });

        if (!user) {
            user = await this.prisma.user.create({
                data: {
                    email: payload.email,
                    name: payload.name ?? null,
                    avatar: payload.picture ?? null,
                },
            });
        }

        return user;
    }

    create(createAuthDto: CreateAuthDto) {
        return 'This action adds a new auth';
    }

    findAll() {
        return `This action returns all auth`;
    }

    findOne(id: number) {
        return `This action returns a #${id} auth`;
    }

    update(id: number, updateAuthDto: UpdateAuthDto) {
        return `This action updates a #${id} auth`;
    }

    remove(id: number) {
        return `This action removes a #${id} auth`;
    }
}
