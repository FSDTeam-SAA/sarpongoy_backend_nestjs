import { HttpException, Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import config from 'src/app/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Payment, PaymentDocument } from '../payment/entities/payment.entity';
import type { Response } from 'express';
import {
  Subscribe,
  SubscribeDocument,
} from '../subscribe/entities/subscribe.entity';
import { User, UserDocument } from '../user/entities/user.entity';

type StripeEvent = ReturnType<
  InstanceType<typeof Stripe>['webhooks']['constructEvent']
>;

@Injectable()
export class WebhookService {
  private readonly stripe: InstanceType<typeof Stripe> = new Stripe(
    config.stripe.secretKey!,
  );
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Subscribe.name)
    private readonly subscribeModel: Model<SubscribeDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async handleWebhook(rawBody: Buffer, sig: string, res: Response) {
    if (!sig) {
      throw new HttpException('Missing stripe signature', 400);
    }

    let event: StripeEvent;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        sig,
        config.stripe.webhookSecret!,
      );
    } catch (err: any) {
      this.logger.error(`Webhook signature error: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentIntentSucceeded(event);
          break;

        case 'payment_intent.payment_failed':
          await this.handlePaymentIntentFailed(event);
          break;

        default:
          this.logger.log(`Unhandled event type: ${event.type}`);
          break;
      }
    } catch (err: any) {
      this.logger.error(`Handler error: ${err.message}`);
      return res.status(500).send(`Webhook Handler Error: ${err.message}`);
    }

    return res.json({ received: true });
  }

 private async handlePaymentIntentSucceeded(event: StripeEvent) {
  const intent = event.data.object as any;

  const payment = await this.paymentModel.findOne({
    stripePaymentIntentId: intent.id,
  });
  if (!payment) return;

  payment.status = 'completed';
  await payment.save();

  const subscribe = await this.subscribeModel.findById(payment.subscribeId);
  if (!subscribe) return;

  const expireDate = new Date();
  expireDate.setMonth(expireDate.getMonth() + Number(subscribe.months));

  // Duplicate subscribe push থেকে বাঁচাও
  const alreadySubscribed = subscribe.subscribeSchools.some(
    (id) => id.toString() === payment.userId.toString(),
  );
  if (!alreadySubscribed) {
    subscribe.subscribeSchools.push(payment.userId);
    await subscribe.save();
  }

  const user = await this.userModel.findById(payment.userId);
  if (user) {
    user.subscription = subscribe._id;
    user.subscriptionExpiry = expireDate;
    await user.save();
  }
}

  private async handlePaymentIntentFailed(event: StripeEvent) {
    const intent = event.data.object as any;

    const payment = await this.paymentModel.findOne({
      stripePaymentIntentId: intent.id,
    });
    if (!payment) return;

    payment.status = 'failed';
    await payment.save();
  }
}
