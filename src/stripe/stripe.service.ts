import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../services/prisma/prisma.service';

@Injectable()
export class StripeService {
  private stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  constructor(private prisma: PrismaService) {}

  async handleEvent(event: Stripe.Event) {
    if (event.type !== 'checkout.session.completed') {
      return;
    }

    const session = event.data.object as Stripe.Checkout.Session;

    if (!session.metadata) {
      throw new Error('Metadata Stripe manquante');
    }

    const existing = await this.prisma.creditTransaction.findUnique({
      where: {
        stripeSessionId: session.id,
      },
    });

    if (existing) {
      return;
    }

    const userId = session.metadata.userId;
    const credits = Number(session.metadata.credits);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: {
          id: userId,
        },
        data: {
          credits: {
            increment: credits,
          },
        },
      }),

      this.prisma.creditTransaction.create({
        data: {
          userId,
          amount: credits,
          type: 'PURCHASE',
          stripeSessionId: session.id,
          packageId: session.metadata.packageId,
          description: `Achat ${session.metadata.packageId}`,
        },
      }),
    ]);
  }
}
