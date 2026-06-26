import { HttpException, Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import config from 'src/app/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import sendMailer from 'src/app/helpers/sendMailer';
import { Payment, PaymentDocument } from '../payment/entities/payment.entity';
import {
  PaymentHistory,
  PaymentHistoryDocument,
} from '../payment/entities/payment-history.entity';
import type { Response } from 'express';
import {
  Subscribe,
  SubscribeDocument,
} from '../subscribe/entities/subscribe.entity';
import { User, UserDocument } from '../user/entities/user.entity';
import { School, SchoolDocument } from '../school/entities/school.entity';
import {
  generateInvoiceEmail,
  generateInvoicePdfBuffer,
} from 'src/app/utils/emailTemplates';

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
    @InjectModel(School.name)
    private readonly schoolModel: Model<SchoolDocument>,
    @InjectModel(PaymentHistory.name)
    private readonly paymentHistoryModel: Model<PaymentHistoryDocument>,
  ) {}

  private buildInvoicePayload(payment: PaymentDocument) {
    const invoiceNumber = `INV-${payment._id.toString().slice(-8).toUpperCase()}`;
    const paymentDates = payment as PaymentDocument & {
      createdAt?: Date;
      updatedAt?: Date;
    };

    return {
      invoiceNumber,
      schoolName: payment.schoolName || payment.email || 'School payment',
      email: payment.email || '',
      amount: Number(payment.amount || 0),
      paymentPlan: payment.paymentPlan,
      paymentMethod: payment.paymentMethod,
      status: payment.status,
      totalStudents: Number(payment.totalStudents || 0),
      perStudentCharge: Number(payment.perStudentCharge || 0),
      totalAmount: Number(payment.totalAmount || payment.amount || 0),
      paidAt: payment.approvedAt || paymentDates.updatedAt || paymentDates.createdAt,
      note:
        payment.paymentMethod === 'offline'
          ? 'Offline payment approved by the admin team.'
          : 'Stripe confirmed this payment automatically.',
    };
  }

  private async sendPaymentReceipt(payment: PaymentDocument) {
    if (!payment.email) return;

    try {
      const invoice = this.buildInvoicePayload(payment);
      const html = await generateInvoiceEmail(invoice);

      let attachments:
        | { filename: string; content: Buffer; contentType: string }[]
        | undefined;

      try {
        const pdf = await generateInvoicePdfBuffer(invoice);
        attachments = [
          {
            filename: `${invoice.invoiceNumber}.pdf`,
            content: pdf,
            contentType: 'application/pdf',
          },
        ];
      } catch (error) {
        this.logger.error(
          `Invoice PDF generation failed for ${payment._id.toString()}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        );
      }

      await sendMailer(
        payment.email,
        `Payment invoice - ${invoice.invoiceNumber}`,
        html,
        attachments,
      );
    } catch (error) {
      this.logger.error(
        `Payment receipt email failed for ${payment._id.toString()}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  private async createSchoolPaymentHistory(
    payment: PaymentDocument,
    status = payment.status,
    note?: string,
  ) {
    if (payment.paymentType !== 'school' || !payment.schoolId) return;

    await this.paymentHistoryModel.create({
      paymentId: payment._id,
      schoolId: payment.schoolId,
      userId: payment.userId,
      paymentPlan: payment.paymentPlan || 'full_year',
      paymentMethod: payment.paymentMethod || 'stripe',
      status,
      amount: payment.amount || 0,
      note,
    });
  }

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

  // private async handlePaymentIntentSucceeded(event: StripeEvent) {
  //   const intent = event.data.object as any;

  //   const payment = await this.paymentModel.findOne({
  //     stripePaymentIntentId: intent.id,
  //   });
  //   if (!payment) return;

  //   payment.status = 'completed';
  //   await payment.save();

  //   const subscribe = await this.subscribeModel.findById(payment.subscribeId);
  //   if (!subscribe) return;

  //   const expireDate = new Date();
  //   expireDate.setMonth(expireDate.getMonth() + Number(subscribe.months));

  //   // Duplicate subscribe push থেকে বাঁচাও
  //   const alreadySubscribed = subscribe.subscribeSchools.some(
  //     (id) => id.toString() === payment.userId.toString(),
  //   );
  //   if (!alreadySubscribed) {
  //     subscribe.subscribeSchools.push(payment.userId);
  //     await subscribe.save();
  //   }

  //   const user = await this.userModel.findById(payment.userId);
  //   if (user) {
  //     user.subscription = subscribe._id;
  //     user.subscriptionExpiry = expireDate;
  //     await user.save();
  //   }
  // }

  private async handlePaymentIntentSucceeded(event: StripeEvent) {
    const intent = event.data.object as any;

    const payment = await this.paymentModel.findOne({
      stripePaymentIntentId: intent.id,
    });
    if (!payment) return;

    payment.status = 'completed';
    await payment.save();
    await this.createSchoolPaymentHistory(
      payment,
      'completed',
      'Stripe payment completed',
    );

    // ✅ School subscription payment
    if (payment.paymentType === 'school') {
      const school = await this.schoolModel.findById(payment.schoolId);
      if (!school) return;

      const schoolMembers = school.school || [];
      const alreadyInSchool = schoolMembers.some(
        (id) => id.toString() === payment.userId.toString(),
      );
      if (!alreadyInSchool) {
        school.school = schoolMembers;
        school.school.push(payment.userId);
        await school.save();
      }

      // User এর schoolName update করো
      const user = await this.userModel.findById(payment.userId);
      if (user) {
        user.schoolName = school._id;
        await user.save();
      }
      await this.sendPaymentReceipt(payment);
      return;
    }

    // ✅ Subscribe payment (আগের logic)
    if (payment.paymentType === 'subscribe') {
      const subscribe = await this.subscribeModel.findById(payment.subscribeId);
      if (!subscribe) return;

      const expireDate = new Date();
      expireDate.setMonth(expireDate.getMonth() + Number(subscribe.months));

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
      await this.sendPaymentReceipt(payment);
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
    await this.createSchoolPaymentHistory(
      payment,
      'failed',
      'Stripe payment failed',
    );
  }
}
