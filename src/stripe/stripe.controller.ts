import { Controller, Post, Req, Headers, BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import Stripe from 'stripe';

@Controller('stripe')
export class StripeController {
    private stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

    @Post('webhook')
    async handleWebhook(@Req() req: Request & { rawBody?: Buffer }, @Headers('stripe-signature') signature: string) {
        console.log('🔥 STRIPE WEBHOOK REÇU');

        let event: Stripe.Event;

        try {
            event = this.stripe.webhooks.constructEvent(req.rawBody!, signature, process.env.STRIPE_WEBHOOK_SECRET!);
        } catch (err) {
            console.error('❌ Signature Stripe invalide', err);
            throw new BadRequestException('Invalid signature');
        }

        console.log('✅ EVENT:', event.type);
        console.log('🆔 EVENT ID:', event.id);

        if (event.type === 'checkout.session.completed') {
            const session = event.data.object as Stripe.Checkout.Session;

            console.log('💰 CHECKOUT COMPLETED');
            console.log('Session:', session.id);
            console.log('Metadata:', session.metadata);
        }

        return { received: true };
    }
}
