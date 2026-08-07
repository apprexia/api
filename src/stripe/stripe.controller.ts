import { Controller, Post, Req, Headers, BadRequestException } from '@nestjs/common';
import type { Request } from 'express';

type StripeRequest = Request & {
    rawBody: Buffer;
};
import Stripe from 'stripe';
import { StripeService } from './stripe.service';

@Controller('stripe')
export class StripeController {
    private stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

    constructor(private readonly stripeService: StripeService) {}

    @Post('webhook')
    async webhook(@Req() req: StripeRequest, @Headers('stripe-signature') signature: string) {
        let event: Stripe.Event;

        try {
            event = this.stripe.webhooks.constructEvent(req.rawBody!, signature, process.env.STRIPE_WEBHOOK_SECRET!);
        } catch (err) {
            throw new BadRequestException(`Webhook error: ${err.message}`);
        }

        await this.stripeService.handleEvent(event);

        return { received: true };
    }
}
