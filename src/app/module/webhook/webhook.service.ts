import { HttpException, Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import config from 'src/app/config';
import type { Response } from 'express';
import { PaymentService } from '../payment/payment.service';
import type { StripePaymentIntent } from '../payment/payment.service';

@Injectable()
export class WebhookService {
  private readonly stripe = new Stripe(config.stripe.secretKey!);
  private readonly logger = new Logger(WebhookService.name);

  constructor(private readonly paymentService: PaymentService) {}

  async handleWebhook(rawBody: Buffer, sig: string, res: Response) {
    if (!sig) throw new HttpException('Missing stripe signature', 400);
    let event: ReturnType<InstanceType<typeof Stripe>['webhooks']['constructEvent']>;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, sig, config.stripe.webhookSecret!);
    } catch (error) {
      this.logger.error(`Webhook signature error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return res.status(400).send('Webhook signature verification failed');
    }
    try {
      const intent = event.data.object as StripePaymentIntent;
      if (event.type === 'payment_intent.succeeded') {
        await this.paymentService.completeStripePayment(intent, true);
      } else if (event.type === 'payment_intent.payment_failed') {
        await this.paymentService.failStripePayment(intent);
      }
    } catch (error) {
      this.logger.error(`Webhook handler error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return res.status(500).send('Webhook processing failed; please retry');
    }
    return res.json({ received: true });
  }
}
