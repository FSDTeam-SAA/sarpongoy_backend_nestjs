import { HttpException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import Stripe from 'stripe';
import { isEmail } from 'class-validator';
import config from 'src/app/config';
import sendMailer from 'src/app/helpers/sendMailer';
import { Payment, PaymentDocument } from './entities/payment.entity';
import { IFilterParams } from 'src/app/helpers/pick';
import paginationHelper, { IOptions } from 'src/app/helpers/pagenation';
import { User, UserDocument } from '../user/entities/user.entity';
import {
  Subscribe,
  SubscribeDocument,
} from '../subscribe/entities/subscribe.entity';
import { School, SchoolDocument } from '../school/entities/school.entity';
import {
  PaymentHistory,
  PaymentHistoryDocument,
} from './entities/payment-history.entity';
import {
  calculateSchoolPaymentStatus,
} from 'src/app/helpers/termPaymentStatus';
import { UserRole } from '../user/user-role.enum';
import {
  generateInvoiceEmail,
  generateInvoicePdfBuffer,
} from 'src/app/utils/emailTemplates';

type SchoolPaymentPlan = string;
export type StripePaymentIntent = Awaited<ReturnType<InstanceType<typeof Stripe>['paymentIntents']['retrieve']>>;

type SchoolPaymentRequest = {
  paymentPlan?: SchoolPaymentPlan;
  termId?: string;
  forceNew?: boolean;
  billingEmail?: string;
  termDueDates?: {
    firstTerm?: string;
    secondTerm?: string;
    thirdTerm?: string;
  };
  offlinePaymentNote?: string;
};

const DEFAULT_SCHOOL_PAYMENT_PLAN: SchoolPaymentPlan = 'term_1';

type SchoolPaymentTerm = {
  termId?: string;
  label?: string;
  amount?: number;
  dueDate?: Date | string;
};

type SchoolPaymentSummaryHistory = {
  _id: string;
  paymentId?: {
    _id?: string;
  } | string | null;
  paymentPlan?: string;
  paymentMethod?: string;
  status?: string;
  amount?: number;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
  changedBy?: {
    _id?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
  } | null;
};

@Injectable()
export class PaymentService {
  private readonly stripe: InstanceType<typeof Stripe>;
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Subscribe.name)
    private readonly subscribeModel: Model<SubscribeDocument>,
    @InjectModel(School.name)
    private readonly schoolModel: Model<SchoolDocument>,
    @InjectModel(PaymentHistory.name)
    private readonly paymentHistoryModel: Model<PaymentHistoryDocument>,
  ) {
    this.stripe = new Stripe(config.stripe.secretKey!);
  }

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
      currency: payment.currency,
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
    if (payment.receiptSentAt) return true;
    if (!payment.email) return false;

    const lease = new Date();
    const claimed = await this.paymentModel.findOneAndUpdate(
      {
        _id: payment._id,
        status: 'completed',
        receiptSentAt: null,
        $or: [
          { receiptSendingAt: null },
          { receiptSendingAt: { $lt: new Date(lease.getTime() - 5 * 60 * 1000) } },
        ],
      },
      { $set: { receiptSendingAt: lease } },
      { new: true },
    );
    if (!claimed) {
      const current = await this.paymentModel.findById(payment._id);
      return Boolean(current?.receiptSentAt);
    }

    try {
      const invoice = this.buildInvoicePayload(claimed);
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
        claimed.email,
        `Payment invoice - ${invoice.invoiceNumber}`,
        html,
        attachments,
      );
      await this.paymentModel.updateOne(
        { _id: payment._id, receiptSendingAt: lease },
        { $set: { receiptSentAt: new Date() }, $unset: { receiptSendingAt: 1 } },
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Payment receipt email failed for ${payment._id.toString()}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
      await this.paymentModel.updateOne(
        { _id: payment._id, receiptSendingAt: lease },
        { $unset: { receiptSendingAt: 1 } },
      );
      return false;
    }
  }

  async getPaymentInvoice(userId: string, role: string, paymentId: string) {
    const payment = await this.paymentModel.findById(paymentId);
    if (!payment) throw new HttpException('Payment not found', 404);

    if (payment.status !== 'completed') {
      throw new HttpException('Invoice is available after payment completion', 400);
    }

    if (
      role !== UserRole.ADMIN &&
      payment.userId?.toString() !== userId
    ) {
      throw new HttpException('Forbidden', 403);
    }

    // Older invoices omitted the currency; retrieve it instead of relabeling GBP as USD.
    if (!payment.currency && payment.stripePaymentIntentId) {
      const intent = await this.stripe.paymentIntents.retrieve(payment.stripePaymentIntentId);
      payment.currency = intent.currency;
      if (intent.status === 'succeeded') payment.amount = intent.amount_received / 100;
      await this.paymentModel.updateOne(
        { _id: payment._id },
        { $set: { currency: payment.currency, amount: payment.amount } },
        { timestamps: false },
      );
    }
    const invoice = this.buildInvoicePayload(payment);
    const buffer = await generateInvoicePdfBuffer(invoice);

    return {
      buffer,
      filename: `${invoice.invoiceNumber}.pdf`,
    };
  }

  private async createPaymentHistory(
    payment: PaymentDocument,
    status = payment.status,
    changedBy?: string,
    note?: string,
  ) {
    if (payment.paymentType !== 'school' || !payment.schoolId) return;

    await this.paymentHistoryModel.create({
      paymentId: payment._id,
      schoolId: payment.schoolId,
      userId: payment.userId,
      changedBy: changedBy ? new Types.ObjectId(changedBy) : undefined,
      paymentPlan: payment.paymentPlan || 'full_year',
      termId: payment.termId,
      termLabel: payment.termLabel,
      paymentMethod: payment.paymentMethod || 'stripe',
      status,
      amount: payment.amount || 0,
      note,
    });
  }

  private getBillingEmail(value: unknown, fallback: string) {
    const email = typeof value === 'string' ? value.trim() : value === undefined ? fallback?.trim() : '';
    if (!email || !isEmail(email)) throw new HttpException('Please enter a valid billing email', 400);
    return email;
  }

  private getStripeAmount(amount: number) {
    const cents = Math.round(amount * 100);
    if (!Number.isSafeInteger(cents) || cents < 50) {
      throw new HttpException('Payment amount must be at least USD 0.50', 400);
    }
    return cents;
  }

  private async getReusableIntent(
    payment: PaymentDocument | null,
    amount: number,
    billingEmail: string,
    forceNew = false,
    termId?: string,
  ) {
    if (!payment?.stripePaymentIntentId) return null;
    let intent: StripePaymentIntent;
    try {
      intent = await this.stripe.paymentIntents.retrieve(payment.stripePaymentIntentId);
    } catch (error) {
      if ((error as { code?: string }).code === 'resource_missing') return null;
      throw error;
    }
    if (intent.status === 'succeeded') {
      await this.completeStripePayment(intent);
      throw new HttpException('This payment is already completed. Please refresh the payment page.', 409);
    }
    if (intent.status === 'processing' || intent.status === 'requires_capture') {
      throw new HttpException('Your previous payment is being processed. Please wait for confirmation.', 409);
    }
    const matches = !forceNew && intent.currency === 'usd' &&
      intent.amount === this.getStripeAmount(amount) &&
      payment.amount === amount &&
      (!termId || (payment.termId || payment.paymentPlan) === termId);
    if (matches && intent.status !== 'canceled') {
      if (intent.receipt_email !== billingEmail) {
        intent = await this.stripe.paymentIntents.update(intent.id, { receipt_email: billingEmail });
      }
      payment.email = billingEmail;
      payment.currency = 'usd';
      payment.status = 'pending';
      await payment.save();
      return intent;
    }
    // Retire the old client secret before moving the record to a new intent.
    // If cancellation fails, do not risk a second charge or lose the old ID.
    if (intent.status !== 'canceled') await this.stripe.paymentIntents.cancel(intent.id);
    return null;
  }

  async confirmSchoolPayment(userId: string, schoolId: string, paymentIntentId: string) {
    if (!/^pi_[A-Za-z0-9]+$/.test(paymentIntentId || '')) {
      throw new HttpException('Please provide a valid payment intent', 400);
    }
    const payment = await this.paymentModel.findOne({
      userId, schoolId, stripePaymentIntentId: paymentIntentId, paymentType: 'school',
    });
    if (!payment) throw new HttpException('Payment not found', 404);
    const intent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
    if (intent.status === 'succeeded') return this.completeStripePayment(intent);
    return {
      paymentId: payment._id.toString(), paymentIntentId: intent.id,
      status: intent.status, amount: intent.amount / 100, currency: intent.currency,
      billingEmail: payment.email, receiptSent: false,
    };
  }

  // Shared by signed webhooks and server-verified browser confirmation.
  // Fulfillment uses idempotent updates so retries do not extend access again.
  async completeStripePayment(intent: StripePaymentIntent, requireReceipt = false) {
    if (intent.status !== 'succeeded') throw new HttpException('Payment has not succeeded', 400);
    let payment = await this.paymentModel.findOne({ stripePaymentIntentId: intent.id });
    if (!payment) throw new HttpException('Payment not found', 404);
    if (payment.status === 'refunded') throw new HttpException('Payment has been refunded', 409);
    const actualAmount = intent.amount_received / 100;
    if (!Number.isFinite(actualAmount) || actualAmount <= 0) {
      throw new HttpException('Stripe did not confirm a captured payment amount', 400);
    }
    const billingEmail = intent.receipt_email && isEmail(intent.receipt_email)
      ? intent.receipt_email : payment.email;
    const completed = await this.paymentModel.findOneAndUpdate(
      { _id: payment._id, status: { $nin: ['completed', 'refunded'] } },
      { $set: {
        status: 'completed', amount: actualAmount, currency: intent.currency,
        email: billingEmail, approvedAt: new Date(),
      } },
      { new: true },
    );
    payment = completed || (await this.paymentModel.findById(payment._id))!;
    if (payment.status === 'refunded') throw new HttpException('Payment has been refunded', 409);
    const paidAt = payment.approvedAt || (payment as any).updatedAt || new Date(intent.created * 1000);
    // Populate missing currency on historical completed records without guessing.
    await this.paymentModel.updateOne(
      { _id: payment._id, status: 'completed' },
      { $set: { amount: actualAmount, currency: intent.currency, email: billingEmail, approvedAt: paidAt } },
    );
    payment.amount = actualAmount;
    payment.currency = intent.currency;
    payment.email = billingEmail;
    payment.approvedAt = paidAt;

    if (payment.paymentType === 'school' && payment.schoolId) {
      await this.schoolModel.updateOne(
        { _id: payment.schoolId },
        { $addToSet: { school: payment.userId }, $set: { termsLocked: true } },
      );
      await this.userModel.updateOne(
        { _id: payment.userId }, { $set: { schoolName: payment.schoolId } },
      );
      await this.paymentHistoryModel.updateOne(
        { paymentId: payment._id, status: 'completed', note: 'Stripe payment completed' },
        { $setOnInsert: {
          paymentId: payment._id, schoolId: payment.schoolId, userId: payment.userId,
          paymentPlan: payment.paymentPlan || 'full_year', termId: payment.termId,
          termLabel: payment.termLabel, paymentMethod: 'stripe', status: 'completed',
          amount: actualAmount, note: 'Stripe payment completed',
        } },
        { upsert: true },
      );
    } else if (payment.paymentType === 'subscribe') {
      const subscribe = await this.subscribeModel.findById(payment.subscribeId);
      if (!subscribe) throw new HttpException('Subscription not found', 404);
      const expireDate = new Date(payment.approvedAt || (payment as any).createdAt);
      expireDate.setMonth(expireDate.getMonth() + Number(subscribe.months));
      await this.subscribeModel.updateOne(
        { _id: subscribe._id }, { $addToSet: { subscribeSchools: payment.userId } },
      );
      await this.userModel.updateOne(
        { _id: payment.userId },
        { $set: { subscription: subscribe._id, subscriptionExpiry: expireDate } },
      );
    }
    const receiptSent = await this.sendPaymentReceipt(payment);
    if (requireReceipt && !receiptSent) {
      throw new HttpException('Payment receipt is pending; retry webhook delivery', 503);
    }
    return {
      paymentId: payment._id.toString(), paymentIntentId: intent.id,
      status: 'completed', amount: actualAmount, currency: intent.currency,
      billingEmail: payment.email, receiptSent,
    };
  }

  async failStripePayment(intent: StripePaymentIntent) {
    // Failed attempts can be followed by a successful retry on the same intent.
    // A late failure must never revoke already completed or refunded payment.
    const payment = await this.paymentModel.findOneAndUpdate(
      { stripePaymentIntentId: intent.id, status: { $nin: ['completed', 'refunded', 'failed'] } },
      { $set: { status: 'failed' } },
      { new: true },
    );
    if (payment) await this.createPaymentHistory(payment, 'failed', undefined, 'Stripe payment failed');
  }

  async paySubscribe(userId: string, subscribeId: string, payload: SchoolPaymentRequest = {}) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new HttpException('User not found', 404);

    const subscribe = await this.subscribeModel.findById(subscribeId);
    if (!subscribe) throw new HttpException('Subscribe not found', 404);
    const amount = this.toMoney(subscribe.price);
    const amountCents = this.getStripeAmount(amount);
    const billingEmail = this.getBillingEmail(payload.billingEmail, user.email);

    // Already paid check
    const existingCompleted = await this.paymentModel.findOne({
      userId: user._id,
      subscribeId: subscribe._id,
      status: 'completed',
    });
    if (existingCompleted) {
      throw new HttpException('This subscription is already paid', 400);
    }

    // Reuse existing pending payment intent if valid
    const existingPending = await this.paymentModel.findOne({
      userId: user._id,
      subscribeId: subscribe._id,
      status: { $in: ['pending', 'failed'] },
    });

    const existingIntent = await this.getReusableIntent(existingPending, amount, billingEmail, payload.forceNew);
    if (existingIntent) {
      return {
        clientSecret: existingIntent.client_secret,
        paymentIntentId: existingIntent.id,
        amount,
        currency: 'usd',
        billingEmail,
      };
    }

    // Create new payment intent
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      receipt_email: billingEmail,
      automatic_payment_methods: { enabled: true },
      metadata: {
        userId: user._id.toString(),
        subscribeId: subscribe._id.toString(),
        paymentType: 'subscribe',
        amount: String(amount),
      },
    });

    // Save or update payment record
    if (existingPending) {
      existingPending.stripePaymentIntentId = paymentIntent.id;
      existingPending.amount = amount;
      existingPending.status = 'pending';
      existingPending.currency = 'usd';
      existingPending.email = billingEmail;
      await existingPending.save();
    } else {
      await this.paymentModel.create({
        userId: user._id,
        subscribeId: subscribe._id,
        // schoolName string হিসেবে save করতে চাইলে
        // School model থেকে populate করে নাও, অথবা user.email দাও
        email: billingEmail,
        stripePaymentIntentId: paymentIntent.id,
        amount,
        currency: 'usd',
        paymentType: 'subscribe',
        status: 'pending',
      });
    }

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount,
      currency: 'usd',
      billingEmail,
    };
  }

  private getSchoolPaymentPlan(value?: string): SchoolPaymentPlan {
    return value || DEFAULT_SCHOOL_PAYMENT_PLAN;
  }

  private toMoney(value: unknown) {
    return Number(Number(value || 0).toFixed(2));
  }

  private startOfDay(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private getContractTotals(user: UserDocument, school: SchoolDocument) {
    const totalStudents = Number(school.totalStudent || user.totalStudent || 0);
    const perStudentCharge = Number(school.subscribePrice || 0);
    const totalAmount = this.toMoney(
      school.totalContractAmount || totalStudents * perStudentCharge,
    );

    if (totalStudents <= 0) {
      throw new HttpException('This school does not have total students set', 400);
    }

    if (perStudentCharge <= 0) {
      throw new HttpException(
        'This school does not have a valid per-student charge',
        400,
      );
    }

    return {
      totalStudents,
      perStudentCharge,
      totalAmount,
    };
  }

  private buildDefaultTerms(totalAmount: number): SchoolPaymentTerm[] {
    const totalCents = Math.round(totalAmount * 100);
    const base = Math.floor(totalCents / 3);
    const remainder = totalCents - base * 3;

    return [0, 1, 2].map((index) => ({
      termId: `term_${index + 1}`,
      label: `Term ${index + 1}`,
      amount: this.toMoney((base + (index < remainder ? 1 : 0)) / 100),
    }));
  }

  private getCompletedTermTotal(payments: PaymentDocument[] | any[], termId: string) {
    return this.toMoney(
      payments
        .filter(
          (payment) =>
            payment.status === 'completed' &&
            (payment.termId || payment.paymentPlan) === termId,
        )
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    );
  }

  private getTermPaymentDetails(
    user: UserDocument,
    school: SchoolDocument,
    termId: string,
    payments: PaymentDocument[] | any[],
  ) {
    const totals = this.getContractTotals(user, school);
    const terms = this.getSchoolTermBreakdown(school, payments);
    const term = terms.find((item) => item.termId === termId);

    if (!term) throw new HttpException('Please select a valid payment term', 400);

    const termAmount = this.toMoney(term.amount);
    const remainingDue = this.toMoney(term.remainingDue);

    if (remainingDue <= 0) {
      throw new HttpException(`${term.label || termId} is already fully paid`, 400);
    }

    return {
      ...totals,
      amount: remainingDue,
      termId,
      termLabel: term.label || termId,
      termAmount,
      remainingDue,
      dueDate: term.dueDate,
    };
  }

  private async getSchoolPayments(
    userId: Types.ObjectId | string,
    schoolId: Types.ObjectId | string,
  ) {
    return this.paymentModel.find({
      userId,
      schoolId,
      paymentType: 'school',
    });
  }

  private getSchoolTermDueDates(school: SchoolDocument) {
    return {
      firstTerm: school.termConfig?.firstTermDueDate,
      secondTerm: school.termConfig?.secondTermDueDate,
      thirdTerm: school.termConfig?.thirdTermDueDate,
    };
  }

  private async activateSchoolPaymentAccess(payment: PaymentDocument) {
    if (payment.paymentType !== 'school' || !payment.schoolId) return;

    const school = await this.schoolModel.findById(payment.schoolId);
    if (!school) throw new HttpException('School not found', 404);

    const schoolMembers = school.school || [];
    const alreadyInSchool = schoolMembers.some(
      (id) => id.toString() === payment.userId.toString(),
    );
    if (!alreadyInSchool) {
      school.school = schoolMembers;
      school.school.push(payment.userId);
    }

    if (!school.termsLocked) school.termsLocked = true;
    await school.save();

    const user = await this.userModel.findById(payment.userId);
    if (user) {
      user.schoolName = school._id;
      await user.save();
    }
  }

  private async lockSchoolTerms(school: SchoolDocument) {
    if (school.termsLocked) return;
    school.termsLocked = true;
    await school.save();
  }

  private assertUserCanPaySchool(user: UserDocument, school: SchoolDocument) {
    const assignedSchoolId = user.schoolName?.toString?.() || '';
    if (assignedSchoolId !== school._id.toString()) {
      throw new HttpException('Forbidden', 403);
    }
  }

  private async sendSchoolPaymentReminder(
    school: SchoolDocument,
    subject: string,
    message: string,
  ) {
    const users = await this.userModel
      .find({ schoolName: school._id })
      .select('email')
      .lean();
    const recipients = users.map((user) => user.email).filter(Boolean);

    await Promise.all(
      recipients.map((email) =>
        sendMailer(
          email,
          subject,
          `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
            <h2 style="margin:0 0 12px;color:#063D5B">School payment reminder</h2>
            <p>${message}</p>
            <p>Please complete the payment from your iLearnReady payment page.</p>
          </div>`,
        ).catch((error) =>
          this.logger.error(
            `Payment reminder email failed for ${email}: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`,
          ),
        ),
      ),
    );
  }

  private getReminderLeadDays(dueDateValue: Date | string | undefined, now: Date) {
    if (!dueDateValue) return null;

    const dueDate = new Date(dueDateValue);
    if (Number.isNaN(dueDate.getTime())) return null;

    const daysUntilDue = Math.round(
      (this.startOfDay(dueDate).getTime() - this.startOfDay(now).getTime()) /
        (24 * 60 * 60 * 1000),
    );

    return daysUntilDue === 14 || daysUntilDue === 3 ? daysUntilDue : null;
  }

  private async sendDueDateReminders(
    school: SchoolDocument,
    paymentTerms: ReturnType<PaymentService['getSchoolTermBreakdown']>,
    now: Date,
  ) {
    for (const term of paymentTerms) {
      if (term.remainingDue <= 0) continue;

      const leadDays = this.getReminderLeadDays(term.dueDate, now);
      if (!leadDays) continue;

      await this.sendSchoolPaymentReminder(
        school,
        `Payment reminder - ${term.label}`,
        `${term.label} payment of ${term.remainingDue} is due in ${leadDays} days.`,
      );
    }
  }

  async paySubscribeSchool(
    userId: string,
    schoolId: string,
    payload: SchoolPaymentRequest = {},
  ) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new HttpException('User not found', 404);
    const billingEmail = this.getBillingEmail(payload.billingEmail, user.email);

    const school = await this.schoolModel.findById(schoolId);
    if (!school) throw new HttpException('School not found', 404);
    this.assertUserCanPaySchool(user, school);

    const termId = payload.termId || payload.paymentPlan;
    if (!termId) throw new HttpException('Please select a payment term', 400);
    const paymentPlan = this.getSchoolPaymentPlan(termId);
    const termDueDates = this.getSchoolTermDueDates(school);
    const schoolPayments = await this.getSchoolPayments(
      user._id,
      school._id,
    );
    const amounts = this.getTermPaymentDetails(
      user,
      school,
      paymentPlan,
      schoolPayments,
    );
    const amountCents = this.getStripeAmount(amounts.amount);

    const existingOfflinePending = await this.paymentModel.findOne({
      userId: user._id,
      schoolId: school._id,
      status: 'offline_pending',
      paymentType: 'school',
    });
    if (existingOfflinePending) {
      throw new HttpException(
        'An offline payment request is already waiting for admin approval',
        400,
      );
    }

    // Reuse existing pending payment intent if valid
    const existingPending = await this.paymentModel.findOne({
      userId: user._id,
      schoolId: school._id,
      status: { $in: ['pending', 'failed'] },
      paymentType: 'school',
    });

    const existingIntent = await this.getReusableIntent(
      existingPending, amounts.amount, billingEmail, payload.forceNew, paymentPlan,
    );
    if (existingIntent) {
      return {
        clientSecret: existingIntent.client_secret,
        paymentIntentId: existingIntent.id,
        ...amounts,
        currency: 'usd',
        billingEmail,
      };
    }

    // Create new payment intent
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      receipt_email: billingEmail,
      automatic_payment_methods: { enabled: true },
      metadata: {
        userId: user._id.toString(),
        schoolId: school._id.toString(),
        paymentType: 'school',
        paymentPlan,
        termId: amounts.termId,
        termLabel: amounts.termLabel,
        amount: String(amounts.amount),
        totalStudents: String(amounts.totalStudents),
        perStudentCharge: String(amounts.perStudentCharge),
        totalAmount: String(amounts.totalAmount),
      },
    });

    // Save or update payment record
    if (existingPending) {
      existingPending.stripePaymentIntentId = paymentIntent.id;
      existingPending.amount = amounts.amount;
      existingPending.status = 'pending';
      existingPending.currency = 'usd';
      existingPending.email = billingEmail;
      existingPending.totalStudents = amounts.totalStudents;
      existingPending.perStudentCharge = amounts.perStudentCharge;
      existingPending.totalAmount = amounts.totalAmount;
      existingPending.paymentPlan = paymentPlan;
      existingPending.termId = amounts.termId;
      existingPending.termLabel = amounts.termLabel;
      existingPending.termDueDates = termDueDates;
      existingPending.paymentMethod = 'stripe';
      await existingPending.save();
      await this.lockSchoolTerms(school);
      await this.createPaymentHistory(
        existingPending,
        'pending',
        undefined,
        'Stripe payment intent refreshed',
      );
    } else {
      const payment = await this.paymentModel.create({
        userId: user._id,
        schoolId: school._id,
        schoolName: school.name,
        email: billingEmail,
        stripePaymentIntentId: paymentIntent.id,
        amount: amounts.amount,
        currency: 'usd',
        totalStudents: amounts.totalStudents,
        perStudentCharge: amounts.perStudentCharge,
        totalAmount: amounts.totalAmount,
        paymentPlan,
        termId: amounts.termId,
        termLabel: amounts.termLabel,
        termDueDates,
        paymentMethod: 'stripe',
        paymentType: 'school',
        status: 'pending',
      });
      await this.createPaymentHistory(
        payment,
        'pending',
        undefined,
        'Stripe payment intent created',
      );
      await this.lockSchoolTerms(school);
    }

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      ...amounts,
      currency: 'usd',
      billingEmail,
    };
  }

  async requestOfflineSchoolPayment(
    userId: string,
    schoolId: string,
    payload: SchoolPaymentRequest = {},
  ) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new HttpException('User not found', 404);
    const billingEmail = this.getBillingEmail(payload.billingEmail, user.email);

    const school = await this.schoolModel.findById(schoolId);
    if (!school) throw new HttpException('School not found', 404);
    this.assertUserCanPaySchool(user, school);

    const termId = payload.termId || payload.paymentPlan;
    if (!termId) throw new HttpException('Please select a payment term', 400);
    const paymentPlan = this.getSchoolPaymentPlan(termId);
    const termDueDates = this.getSchoolTermDueDates(school);
    const schoolPayments = await this.getSchoolPayments(
      user._id,
      school._id,
    );
    const amounts = this.getTermPaymentDetails(
      user,
      school,
      paymentPlan,
      schoolPayments,
    );

    const existingOfflinePending = await this.paymentModel.findOne({
      userId: user._id,
      schoolId: school._id,
      status: 'offline_pending',
      paymentType: 'school',
    });
    if (existingOfflinePending) {
      existingOfflinePending.amount = amounts.amount;
      existingOfflinePending.currency = 'usd';
      existingOfflinePending.email = billingEmail;
      existingOfflinePending.totalStudents = amounts.totalStudents;
      existingOfflinePending.perStudentCharge = amounts.perStudentCharge;
      existingOfflinePending.totalAmount = amounts.totalAmount;
      existingOfflinePending.paymentPlan = paymentPlan;
      existingOfflinePending.termId = amounts.termId;
      existingOfflinePending.termLabel = amounts.termLabel;
      existingOfflinePending.termDueDates = termDueDates;
      existingOfflinePending.offlinePaymentNote =
        payload.offlinePaymentNote?.trim() || existingOfflinePending.offlinePaymentNote;
      await existingOfflinePending.save();
      await this.lockSchoolTerms(school);
      await this.createPaymentHistory(
        existingOfflinePending,
        'offline_pending',
        undefined,
        'Offline payment request updated',
      );
      return existingOfflinePending;
    }

    const payment = await this.paymentModel.create({
      userId: user._id,
      schoolId: school._id,
      schoolName: school.name,
      email: billingEmail,
      amount: amounts.amount,
      currency: 'usd',
      totalStudents: amounts.totalStudents,
      perStudentCharge: amounts.perStudentCharge,
      totalAmount: amounts.totalAmount,
      paymentPlan,
      termId: amounts.termId,
      termLabel: amounts.termLabel,
      termDueDates,
      paymentMethod: 'offline',
      offlinePaymentNote: payload.offlinePaymentNote?.trim(),
      paymentType: 'school',
      status: 'offline_pending',
    });
    await this.createPaymentHistory(
      payment,
      'offline_pending',
      undefined,
      'Offline payment request submitted',
    );
    await this.lockSchoolTerms(school);

    return payment;
  }

  async approveOfflineSchoolPayment(paymentId: string, adminId: string) {
    const payment = await this.paymentModel.findById(paymentId);
    if (!payment) throw new HttpException('Payment not found', 404);

    if (payment.paymentType !== 'school' || payment.paymentMethod !== 'offline') {
      throw new HttpException('Only offline school payments can be approved', 400);
    }

    if (payment.status === 'completed') return payment;

    if (payment.status !== 'offline_pending') {
      throw new HttpException('This offline payment is not waiting for approval', 400);
    }

    payment.status = 'completed';
    payment.approvedBy = new Types.ObjectId(adminId);
    payment.approvedAt = new Date();
    await payment.save();

    await this.activateSchoolPaymentAccess(payment);
    await this.createPaymentHistory(
      payment,
      'completed',
      adminId,
      'Offline payment approved by admin',
    );
    await this.sendPaymentReceipt(payment);

    return payment;
  }

  private getPaymentsForSchool(payments: PaymentDocument[], schoolId: unknown) {
    return payments.filter(
      (payment) => payment.schoolId?.toString() === schoolId?.toString(),
    );
  }

  private getSchoolTermBreakdown(
    school: SchoolDocument | Record<string, any>,
    payments: PaymentDocument[] | any[],
  ) {
    const totalAmount = this.toMoney(
      school.totalContractAmount ||
        Number(school.totalStudent || 0) * Number(school.subscribePrice || 0),
    );
    const terms = ((school.paymentTerms || []) as SchoolPaymentTerm[]).length
      ? (school.paymentTerms || [])
      : this.buildDefaultTerms(totalAmount);
    const legacyDates = {
      firstTerm: school.termConfig?.firstTermDueDate,
      secondTerm: school.termConfig?.secondTermDueDate,
      thirdTerm: school.termConfig?.thirdTermDueDate,
    };
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return terms.map((term: SchoolPaymentTerm, index: number) => {
      const termId = term.termId || `term_${index + 1}`;
      const amount = this.toMoney(term.amount);
      const paid = this.getCompletedTermTotal(payments, termId);
      const remainingDue = this.toMoney(Math.max(0, amount - paid));
      const dueDateValue =
        term.dueDate ||
        (index === 0
          ? legacyDates.firstTerm
          : index === 1
            ? legacyDates.secondTerm
            : legacyDates.thirdTerm);
      const dueDate = dueDateValue ? new Date(dueDateValue) : null;
      const isOverdue =
        Boolean(dueDate) &&
        !Number.isNaN(dueDate?.getTime()) &&
        today > new Date(dueDate!.getFullYear(), dueDate!.getMonth(), dueDate!.getDate()) &&
        remainingDue > 0;

      return {
        termId,
        label: term.label || `Term ${index + 1}`,
        amount,
        amountPaid: paid,
        remainingDue,
        dueDate: dueDateValue,
        status:
          remainingDue <= 0
            ? 'paid'
            : paid > 0
              ? 'partial'
              : isOverdue
                ? 'overdue'
                : 'pending',
      };
    });
  }

  async getAllSchoolPaymentStatuses() {
    const [schools, payments] = await Promise.all([
      this.schoolModel.find().populate('school', 'email totalStudent').lean(),
      this.paymentModel
        .find({ paymentType: 'school' })
        .sort({ createdAt: -1 } as never)
        .lean(),
    ]);

    return schools.map((school) => {
      const schoolPayments = this.getPaymentsForSchool(
        payments as PaymentDocument[],
        school._id,
      );
      const paymentTerms = this.getSchoolTermBreakdown(school, schoolPayments);

      const status = calculateSchoolPaymentStatus(
        { ...(school.termConfig || {}), paymentTerms },
        schoolPayments,
      );
      const latestPayment = schoolPayments[0];

      return {
        schoolId: school._id,
        schoolName: school.name,
        totalStudents: school.totalStudent || (school.school || []).reduce(
          (total: number, member: any) =>
            total + Number(member?.totalStudent || 0),
          0,
        ),
        perStudentCharge: school.subscribePrice || 0,
        totalContractAmount: school.totalContractAmount || 0,
        paymentTerms,
        termsLocked: Boolean(school.termsLocked || schoolPayments.length),
        activeTerm: status.activeTerm,
        overdueTerm: status.overdueTerm,
        isRestricted: status.isRestricted,
        reason: status.reason,
        paymentAccessStatus: status.isRestricted ? 'restricted' : 'active',
        latestPayment: latestPayment
          ? {
              id: latestPayment._id,
              amount: latestPayment.amount,
              status: latestPayment.status,
              paymentPlan: latestPayment.paymentPlan,
              termId: latestPayment.termId,
              termLabel: latestPayment.termLabel,
              paymentMethod: latestPayment.paymentMethod,
            }
          : null,
        termConfig: school.termConfig || {},
      };
    });
  }

  async updatePaymentStatus(
    paymentId: string,
    status: 'pending' | 'offline_pending' | 'completed' | 'failed' | 'refunded',
    adminId: string,
  ) {
    const payment = await this.paymentModel.findById(paymentId);
    if (!payment) throw new HttpException('Payment not found', 404);

    payment.status = status;
    if (status === 'completed') {
      payment.approvedBy = new Types.ObjectId(adminId);
      payment.approvedAt = payment.approvedAt || new Date();
      await payment.save();
      await this.activateSchoolPaymentAccess(payment);
      await this.sendPaymentReceipt(payment);
    } else {
      await payment.save();
    }

    await this.createPaymentHistory(
      payment,
      status,
      adminId,
      `Payment status manually updated to ${status}`,
    );

    return payment;
  }

  async syncSchoolPaymentAccessStatuses(now = new Date()) {
    const [schools, payments] = await Promise.all([
      this.schoolModel.find(),
      this.paymentModel.find({ paymentType: 'school' }),
    ]);

    let updated = 0;
    for (const school of schools) {
      const schoolPayments = this.getPaymentsForSchool(payments, school._id);
      const paymentTerms = this.getSchoolTermBreakdown(school, schoolPayments);
      await this.sendDueDateReminders(school, paymentTerms, now);

      const status = calculateSchoolPaymentStatus(
        { ...(school.termConfig || {}), paymentTerms },
        schoolPayments,
        now,
      );
      const nextAccessStatus = status.isRestricted ? 'restricted' : 'active';

      if (
        school.paymentAccessStatus !== nextAccessStatus ||
        school.overdueTerm !== status.overdueTerm
      ) {
        school.paymentAccessStatus = nextAccessStatus;
        school.overdueTerm = status.overdueTerm;
        school.paymentAccessCheckedAt = new Date();
        await school.save();
        updated += 1;

        if (status.isRestricted && status.overdueTerm !== 'none') {
          await this.paymentHistoryModel.create({
            schoolId: school._id,
            paymentPlan: status.overdueTerm,
            termId: status.overdueTerm,
            paymentMethod: 'system',
            status: 'overdue',
            amount: 0,
            note: status.reason,
          });
          await this.sendSchoolPaymentReminder(
            school,
            `Payment overdue - ${status.overdueTerm}`,
            status.reason,
          );
        }
      }
    }

    return { checked: schools.length, updated };
  }

  async getAllPayment(params: IFilterParams, options: IOptions) {
    const { limit, page, skip, sortBy, sortOrder } = paginationHelper(options);
    const { searchTerm, ...filterData } = params;

    const whereConditions: Record<string, unknown> = {};

    if (searchTerm) {
      whereConditions.$or = [
        { paymentType: { $regex: searchTerm, $options: 'i' } },
        { status: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } },
      ];
    }

    if (filterData.paymentType)
      whereConditions.paymentType = filterData.paymentType;
    if (filterData.status) whereConditions.status = filterData.status;

    const total = await this.paymentModel.countDocuments(whereConditions);
    const data = await this.paymentModel
      .find(whereConditions)
      .skip(skip)
      .limit(limit)
      .sort({ [sortBy]: sortOrder } as never)
      .populate('userId', 'email schoolName totalStudent')
      .populate('schoolId', 'name school subscribePrice totalStudent totalContractAmount paymentTerms termsLocked')
      .populate('subscribeId');

    return { meta: { page, limit, total }, data };
  }

  async getSinglePayment(id: string) {
    const payment = await this.paymentModel
      .findById(id)
      .populate('userId', 'email schoolName totalStudent')
      .populate('schoolId', 'name school subscribePrice totalStudent totalContractAmount paymentTerms termsLocked')
      .populate('subscribeId');

    if (!payment) throw new HttpException('Payment not found', 404);
    return payment;
  }

  async getSchoolPaymentAccess(userId: string, schoolId: string) {
    const school = await this.schoolModel.findById(schoolId);
    if (!school) throw new HttpException('School not found', 404);

    const payments = await this.paymentModel.find({
      userId,
      schoolId: school._id,
      paymentType: 'school',
    });
    const payment = payments.find((item) => item.status === 'completed');
    const paymentTerms = this.getSchoolTermBreakdown(school, payments);
    const status = calculateSchoolPaymentStatus(
      { ...(school.termConfig || {}), paymentTerms },
      payments,
    );
    const hasPaymentAccess =
      Boolean(payment) || (status.hasConfiguredDueDate && !status.isRestricted);

    return {
      hasAccess: hasPaymentAccess,
      isRestricted: status.isRestricted,
      hasConfiguredDueDate: status.hasConfiguredDueDate,
      activeTerm: status.activeTerm,
      overdueTerm: status.overdueTerm,
      reason: status.reason,
      schoolId: school._id,
      amount: payment?.amount || school.subscribePrice || 0,
      paymentTerms,
      status: status.isRestricted ? 'restricted' : payment?.status || 'unpaid',
    };
  }

  async getSchoolPaymentOverview(
    userId: string,
    role: string,
    schoolId: string,
  ) {
    let currentSchoolUser: UserDocument | null = null;
    if (role === UserRole.SCHOOL) {
      currentSchoolUser = await this.userModel.findById(userId);
      const assignedSchoolId = currentSchoolUser?.schoolName?.toString?.() || '';
      if (!assignedSchoolId || assignedSchoolId !== schoolId) {
        throw new HttpException('Forbidden', 403);
      }
    }

    const school = await this.schoolModel
      .findById(schoolId)
      .populate('school', 'email totalStudent firstName lastName role profilePicture schoolLogo')
      .lean();
    if (!school) throw new HttpException('School not found', 404);

    const schoolAccounts = await this.userModel
      .find(
        role === UserRole.SCHOOL
          ? { _id: currentSchoolUser?._id, schoolName: school._id }
          : { schoolName: school._id },
      )
      .select('email totalStudent firstName lastName role profilePicture schoolLogo studentList')
      .lean();

    const payments = await this.paymentModel
      .find({
        userId: role === UserRole.SCHOOL ? currentSchoolUser?._id : { $exists: true },
        schoolId: school._id,
        paymentType: 'school',
      })
      .sort({ createdAt: -1 } as never)
      .populate('userId', 'email totalStudent schoolName')
      .populate('schoolId', 'name school subscribePrice totalStudent totalContractAmount paymentTerms termsLocked')
      .lean();

    const histories = await this.paymentHistoryModel
      .find({
        schoolId: school._id,
        ...(role === UserRole.SCHOOL ? { userId: currentSchoolUser?._id } : {}),
      })
      .sort({ createdAt: -1 } as never)
      .populate('paymentId', 'amount status paymentPlan termId termLabel paymentMethod totalAmount')
      .populate('userId', 'email totalStudent schoolName')
      .populate('changedBy', 'email firstName lastName')
      .lean();

    const paymentList = payments as any[];
    const historyList = histories as any[];
    const accountStudents = schoolAccounts.reduce(
      (total: number, account: any) => total + Number(account?.totalStudent || 0),
      0,
    );
    const totalStudents = Number(school.totalStudent || accountStudents || 0);
    const perStudentCharge = Number(school.subscribePrice || 0);
    const totalAmountDue = this.toMoney(
      school.totalContractAmount || totalStudents * perStudentCharge,
    );
    const totalCollected = paymentList
      .filter(payment => payment.status === 'completed')
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const balanceDue = Math.max(0, Number((totalAmountDue - totalCollected).toFixed(2)));
    const paymentTerms = this.getSchoolTermBreakdown(school, paymentList);
    const status = calculateSchoolPaymentStatus(
      { ...(school.termConfig || {}), paymentTerms },
      paymentList,
    );
    const latestPayment = paymentList[0] || null;
    const latestHistory = historyList[0] || null;

    return {
      schoolId: school._id,
      schoolName: school.name,
      school,
      schoolAccounts,
      termConfig: school.termConfig || {},
      paymentTerms,
      termsLocked: Boolean(school.termsLocked || paymentList.length),
      paymentAccessStatus: status.isRestricted ? 'restricted' : 'active',
      activeTerm: status.activeTerm,
      overdueTerm: status.overdueTerm,
      isRestricted: status.isRestricted,
      hasConfiguredDueDate: status.hasConfiguredDueDate,
      reason: status.reason,
      totalStudents,
      perStudentCharge,
      totalAmountDue,
      totalCollected,
      balanceDue,
      latestPayment: latestPayment
        ? {
            id: latestPayment._id,
            amount: latestPayment.amount,
            status: latestPayment.status,
            paymentPlan: latestPayment.paymentPlan,
            termId: latestPayment.termId || latestPayment.paymentPlan,
            termLabel: latestPayment.termLabel,
            paymentMethod: latestPayment.paymentMethod,
            createdAt: latestPayment.createdAt,
          }
        : null,
      latestHistory: latestHistory
        ? {
            id: latestHistory._id,
            paymentId:
              typeof latestHistory.paymentId === 'object'
                ? latestHistory.paymentId?._id?.toString?.() || latestHistory.paymentId?._id || ''
                : latestHistory.paymentId?.toString?.() || latestHistory.paymentId || '',
            paymentPlan: latestHistory.paymentPlan,
            termId: latestHistory.termId || latestHistory.paymentPlan,
            termLabel: latestHistory.termLabel,
            paymentMethod: latestHistory.paymentMethod,
            status: latestHistory.status,
            amount: latestHistory.amount,
            note: latestHistory.note,
            createdAt: latestHistory.createdAt,
            updatedAt: latestHistory.updatedAt,
          }
        : null,
      payments: paymentList.map(payment => ({
        id: payment._id,
        amount: payment.amount,
        status: payment.status,
        paymentPlan: payment.paymentPlan,
        termId: payment.termId || payment.paymentPlan,
        termLabel: payment.termLabel,
        paymentMethod: payment.paymentMethod,
        totalStudents: payment.totalStudents,
        totalAmount: payment.totalAmount,
        perStudentCharge: payment.perStudentCharge,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
        email: payment.email,
        offlinePaymentNote: payment.offlinePaymentNote,
      })),
      paymentHistory: historyList.map((history: SchoolPaymentSummaryHistory & Record<string, any>) => ({
        id: history._id,
        paymentId:
          typeof history.paymentId === 'object'
            ? history.paymentId?._id?.toString?.() || history.paymentId?._id || ''
            : history.paymentId?.toString?.() || history.paymentId || '',
        paymentPlan: history.paymentPlan,
        termId: history.termId || history.paymentPlan,
        termLabel: history.termLabel,
        paymentMethod: history.paymentMethod,
        status: history.status,
        amount: history.amount,
        note: history.note,
        createdAt: history.createdAt,
        updatedAt: history.updatedAt,
        changedBy: history.changedBy,
      })),
    };
  }

  async schoolPraymentSub(schoolId: string) {
    const school = await this.schoolModel.findById(schoolId);
    if (!school) throw new HttpException('School not found', 404);

    const student = await this.userModel.findOne({ schoolName: school._id });
    if (!student) throw new HttpException('User not found', 404);

    const payment = await this.paymentModel.findOne({
      userId: student._id,
      schoolId: school._id,
      status: 'completed',
      paymentType: 'school',
    });
    if (!payment) throw new HttpException('Payment not found', 404);
    
  }
}
