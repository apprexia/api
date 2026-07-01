import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';

import { AuthGuard } from '@nestjs/passport';

import { CreditsService } from './credits.service';

import { CreateCheckoutDto } from './dto/create-checkout.dto';

@Controller('credits')
export class CreditsController {
  constructor(private creditsService: CreditsService) {}

  @Post('checkout')
  @UseGuards(AuthGuard('jwt'))
  checkout(@Body() dto: CreateCheckoutDto, @Req() req) {
    return this.creditsService.createCheckout(dto.packageId, req.user.sub);
  }

  @Post('confirm')
  confirmPayment(@Body() body: { sessionId: string }) {
    return this.creditsService.confirmPayment(body.sessionId);
  }
}
