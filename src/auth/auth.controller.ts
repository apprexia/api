import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, Res } from '@nestjs/common';

import { AuthService } from './auth.service';
import { CreateAuthDto } from './dto/create-auth.dto';
import { UpdateAuthDto } from './dto/update-auth.dto';

import { AuthGuard } from '@nestjs/passport';
import { GoogleAuthGuard } from './guards/google-auth.guard';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    /**
     * ============================
     * GOOGLE LOGIN SITE ANGULAR
     * ============================
     */

    @Get('google')
    @UseGuards(AuthGuard('google'))
    googleLogin() {}

    /**
     * CALLBACK GOOGLE ANGULAR
     */

    @Get('google/callback')
    @UseGuards(GoogleAuthGuard)
    async googleCallback(@Req() req, @Res() res) {
        const token = await this.authService.loginWithGoogle(req.user);

        return res.redirect(`${process.env.FRONTEND_URL}/auth/success?token=${token}`);
    }

    /**
     * ============================
     * GOOGLE LOGIN EXTENSION CHROME
     * ============================
     *
     * Reçoit le code OAuth Google
     * envoyé par chrome.identity.launchWebAuthFlow()
     */
    @Post('google/extension')
    async googleExtensionLogin(@Body() body: { code: string }) {
        console.log('googleExtensionLogin', body);

        const user = await this.authService.loginWithGoogleCode(body.code);

        const token = await this.authService.generateJwt(user);

        return {
            token,
        };
    }

    /**
     * ============================
     * TWITTER OPTIONNEL
     * ============================
     */

    @Get('x')
    @UseGuards(AuthGuard('twitter'))
    xLogin() {}

    @Get('x/callback')
    @UseGuards(AuthGuard('twitter'))
    async xCallback(@Req() req, @Res() res) {
        const token = await this.authService.generateJwt(req.user);

        return res.redirect(`${process.env.FRONTEND_URL}/auth/success?token=${token}`);
    }

    /**
     * ============================
     * CRUD AUTH
     * ============================
     */

    @Post()
    create(
        @Body()
        createAuthDto: CreateAuthDto,
    ) {
        return this.authService.create(createAuthDto);
    }

    @Get()
    findAll() {
        return this.authService.findAll();
    }

    @Get(':id')
    findOne(
        @Param('id')
        id: string,
    ) {
        return this.authService.findOne(+id);
    }

    @Patch(':id')
    update(
        @Param('id')
        id: string,
        @Body()
        updateAuthDto: UpdateAuthDto,
    ) {
        return this.authService.update(+id, updateAuthDto);
    }

    @Delete(':id')
    remove(
        @Param('id')
        id: string,
    ) {
        return this.authService.remove(+id);
    }
}
