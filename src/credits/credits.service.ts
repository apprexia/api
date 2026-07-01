import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../services/prisma/prisma.service';

@Injectable()
export class CreditsService {
  private stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  private packages = {
    starter: {
      name: 'Pack Starter',
      credits: 2,
      price: 499,
    },

    discovery: {
      name: 'Pack Découverte',
      credits: 5,
      price: 899,
    },

    investor: {
      name: 'Pack Investisseur',
      credits: 15,
      price: 2499,
    },

    expert: {
      name: 'Pack Expert',
      credits: 40,
      price: 5999,
    },
  };

  constructor(private prisma: PrismaService) {}

  async createCheckout(packageId: string, userId: string) {
    const pack = this.packages[packageId];

    if (!pack) {
      throw new Error('Pack inconnu');
    }

    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',

      payment_method_types: ['card'],

      line_items: [
        {
          price_data: {
            currency: 'eur',

            product_data: {
              name: pack.name,
              description: `${pack.credits} analyses Apprexia`,
            },

            unit_amount: pack.price,
          },

          quantity: 1,
        },
      ],

      consent_collection: {
        terms_of_service: 'required',
      },

      metadata: {
        userId,
        packageId,
        credits: String(pack.credits),
      },

      success_url: `${process.env.FRONTEND_URL}/credits/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/credits/cancel`,
    });

    return {
      checkoutUrl: session.url,
    };
  }

  async confirmPayment(sessionId: string) {
    // 1. Récupérer la session Stripe
    const session = await this.stripe.checkout.sessions.retrieve(sessionId);

    // 2. Vérifier que le paiement est bien terminé
    if (session.payment_status !== 'paid') {
      throw new Error('Paiement non confirmé');
    }

    // 3. Vérifier les metadata
    if (!session.metadata) {
      throw new Error('Metadata Stripe manquante');
    }

    // 4. Vérifier si cette session a déjà été traitée
    const existing = await this.prisma.creditTransaction.findUnique({
      where: {
        stripeSessionId: session.id,
      },
    });

    if (existing) {
      return {
        message: 'Paiement déjà traité',
      };
    }

    // 5. Seulement maintenant ajouter les crédits
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
          description: `Achat ${session.metadata.packageId}`,
        },
      }),
    ]);

    return {
      credits,
      message: 'Paiement confirmé',
    };
  }

  async refundCredit(userId: string, analysisId: string) {
    // Vérifie si ce remboursement existe déjà
    const existingRefund = await this.prisma.creditTransaction.findFirst({
      where: {
        userId,
        type: 'REFUND',
        description: {
          contains: analysisId,
        },
      },
    });

    if (existingRefund) {
      return;
    }

    await this.prisma.$transaction([
      // Rendre le crédit
      this.prisma.user.update({
        where: {
          id: userId,
        },
        data: {
          credits: {
            increment: 1,
          },
        },
      }),

      // Historique
      this.prisma.creditTransaction.create({
        data: {
          userId,
          amount: 1,
          type: 'REFUND',
          description: `Crédit restauré suite à l'analyse échouée ${analysisId}`,
        },
      }),
    ]);
  }
}
