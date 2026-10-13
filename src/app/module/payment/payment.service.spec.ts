import Stripe from 'stripe';
import { Types } from 'mongoose';
import { PaymentService } from './payment.service';
import sendMailer from 'src/app/helpers/sendMailer';
import { generateInvoicePdfBuffer } from 'src/app/utils/emailTemplates';

jest.mock('stripe', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../user/entities/user.entity', () => ({ User: class User {} }));
jest.mock('../subscribe/entities/subscribe.entity', () => ({ Subscribe: class Subscribe {} }));
jest.mock('../school/entities/school.entity', () => ({ School: class School {} }));
jest.mock('./entities/payment.entity', () => ({ Payment: class Payment {} }));
jest.mock('./entities/payment-history.entity', () => ({ PaymentHistory: class PaymentHistory {} }));
jest.mock('src/app/config', () => ({ __esModule: true, default: { stripe: { secretKey: 'sk_test_unit' } } }));
jest.mock('src/app/helpers/sendMailer', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('src/app/utils/emailTemplates', () => ({
  generateInvoiceEmail: jest.fn().mockResolvedValue('<p>Receipt</p>'),
  generateInvoicePdfBuffer: jest.fn().mockResolvedValue(Buffer.from('invoice')),
}));

describe('PaymentService payment integrity', () => {
  let service: PaymentService;
  let payments: any;
  let users: any;
  let subscriptions: any;
  let schools: any;
  let histories: any;
  let stripe: any;
  let user: any;
  let pending: any;

  beforeEach(() => {
    jest.clearAllMocks();
    stripe = { paymentIntents: {
      retrieve: jest.fn(), update: jest.fn(), cancel: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({ id: 'pi_new', client_secret: 'new_secret' }),
    } };
    (Stripe as unknown as jest.Mock).mockImplementation(() => stripe);
    users = { findById: jest.fn(), updateOne: jest.fn().mockResolvedValue({}) };
    subscriptions = { findById: jest.fn(), updateOne: jest.fn().mockResolvedValue({}) };
    schools = { findById: jest.fn(), updateOne: jest.fn().mockResolvedValue({}) };
    histories = { create: jest.fn(), updateOne: jest.fn().mockResolvedValue({}) };
    payments = {
      findOne: jest.fn(), findById: jest.fn(), find: jest.fn().mockResolvedValue([]),
      create: jest.fn(), findOneAndUpdate: jest.fn(), updateOne: jest.fn().mockResolvedValue({}),
    };
    user = { _id: new Types.ObjectId(), email: 'account@example.com', schoolName: new Types.ObjectId() };
    pending = {
      _id: new Types.ObjectId(), userId: user._id, subscribeId: new Types.ObjectId(),
      amount: 3.33, status: 'pending', stripePaymentIntentId: 'pi_old',
      save: jest.fn().mockResolvedValue(undefined), email: 'account@example.com',
    };
    users.findById.mockResolvedValue(user);
    subscriptions.findById.mockResolvedValue({ _id: pending.subscribeId, price: 3.33, months: 3 });
    payments.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(pending);
    service = new PaymentService(payments, users, subscriptions, schools, histories);
    jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
    (sendMailer as jest.Mock).mockResolvedValue(undefined);
  });

  const oldIntent = (extra = {}) => ({
    id: 'pi_old', client_secret: 'old_secret', amount: 333, currency: 'usd',
    receipt_email: 'billing@example.com', status: 'requires_payment_method', ...extra,
  });

  it('cancels a legacy GBP intent before creating a USD charge to the billing email', async () => {
    stripe.paymentIntents.retrieve.mockResolvedValue(oldIntent({ currency: 'gbp' }));
    const result = await service.paySubscribe(user._id.toString(), pending.subscribeId.toString(), { billingEmail: ' billing@example.com ' });
    expect(stripe.paymentIntents.cancel).toHaveBeenCalledWith('pi_old');
    expect(stripe.paymentIntents.create).toHaveBeenCalledWith(expect.objectContaining({
      amount: 333, currency: 'usd', receipt_email: 'billing@example.com',
    }));
    expect(stripe.paymentIntents.cancel.mock.invocationCallOrder[0]).toBeLessThan(stripe.paymentIntents.create.mock.invocationCallOrder[0]);
    expect(result).toMatchObject({ amount: 3.33, currency: 'usd', billingEmail: 'billing@example.com' });
    expect(pending.email).toBe('billing@example.com');
  });

  it('checks the actual Stripe amount before reusing an intent', async () => {
    stripe.paymentIntents.retrieve.mockResolvedValue(oldIntent({ amount: 442 }));
    await service.paySubscribe(user._id.toString(), pending.subscribeId.toString());
    expect(stripe.paymentIntents.cancel).toHaveBeenCalledWith('pi_old');
    expect(stripe.paymentIntents.create).toHaveBeenCalledWith(expect.objectContaining({ amount: 333, currency: 'usd' }));
  });

  it('keeps the original intent tracked and creates no new charge if cancellation fails', async () => {
    stripe.paymentIntents.retrieve.mockResolvedValue(oldIntent({ currency: 'gbp' }));
    stripe.paymentIntents.cancel.mockRejectedValue(new Error('Stripe unavailable'));
    await expect(service.paySubscribe(user._id.toString(), pending.subscribeId.toString())).rejects.toThrow('Stripe unavailable');
    expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
    expect(pending.stripePaymentIntentId).toBe('pi_old');
  });

  it('updates the receipt address when reusing an existing USD intent after a failed attempt', async () => {
    pending.status = 'failed';
    stripe.paymentIntents.retrieve.mockResolvedValue(oldIntent({ receipt_email: 'account@example.com' }));
    stripe.paymentIntents.update.mockResolvedValue(oldIntent());
    await service.paySubscribe(user._id.toString(), pending.subscribeId.toString(), { billingEmail: 'billing@example.com' });
    expect(payments.findOne).toHaveBeenLastCalledWith(expect.objectContaining({ status: { $in: ['pending', 'failed'] } }));
    expect(stripe.paymentIntents.update).toHaveBeenCalledWith('pi_old', { receipt_email: 'billing@example.com' });
    expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
    expect(pending.status).toBe('pending');
  });

  it('reconciles an already succeeded intent and refuses a duplicate charge', async () => {
    stripe.paymentIntents.retrieve.mockResolvedValue(oldIntent({ status: 'succeeded' }));
    const completed = jest.spyOn(service, 'completeStripePayment').mockResolvedValue({} as any);
    await expect(service.paySubscribe(user._id.toString(), pending.subscribeId.toString())).rejects.toMatchObject({ status: 409 });
    expect(completed).toHaveBeenCalled();
    expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
  });

  it('does not create a replacement while a previous charge is processing', async () => {
    stripe.paymentIntents.retrieve.mockResolvedValue(oldIntent({ status: 'processing' }));
    await expect(service.paySubscribe(user._id.toString(), pending.subscribeId.toString(), { forceNew: true })).rejects.toMatchObject({ status: 409 });
    expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
    expect(stripe.paymentIntents.cancel).not.toHaveBeenCalled();
  });

  it('rejects an invalid billing address before creating a Stripe charge', async () => {
    await expect(service.paySubscribe(user._id.toString(), pending.subscribeId.toString(), { billingEmail: 'invalid' })).rejects.toMatchObject({ status: 400 });
    expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
  });

  it('charges school term cents and records the entered billing address consistently', async () => {
    const school = { _id: user.schoolName, name: 'Test School', totalStudent: 1, subscribePrice: 10, totalContractAmount: 10, termsLocked: true };
    schools.findById.mockResolvedValue(school);
    payments.findOne.mockReset().mockResolvedValue(null);
    payments.create.mockImplementation(async (data: any) => ({ ...data, _id: new Types.ObjectId() }));
    await service.paySubscribeSchool(user._id.toString(), school._id.toString(), { termId: 'term_1', billingEmail: 'billing@example.com' });
    expect(stripe.paymentIntents.create).toHaveBeenCalledWith(expect.objectContaining({ amount: 334, currency: 'usd', receipt_email: 'billing@example.com' }));
    expect(payments.create).toHaveBeenCalledWith(expect.objectContaining({ amount: 3.34, currency: 'usd', email: 'billing@example.com' }));
  });

  it('refuses to verify an intent outside the authenticated school account', async () => {
    payments.findOne.mockReset().mockResolvedValue(null);
    await expect(service.confirmSchoolPayment(user._id.toString(), user.schoolName.toString(), 'pi_foreign')).rejects.toMatchObject({ status: 404 });
    expect(stripe.paymentIntents.retrieve).not.toHaveBeenCalled();
  });

  it.each(['processing', 'requires_payment_method', 'requires_confirmation', 'canceled'])('returns a structured %s result so checkout can recover safely', async (status) => {
    payments.findOne.mockReset().mockResolvedValue(pending);
    stripe.paymentIntents.retrieve.mockResolvedValue(oldIntent({ status }));
    const result = await service.confirmSchoolPayment(user._id.toString(), user.schoolName.toString(), 'pi_old');
    expect(result).toMatchObject({ status, amount: 3.33, currency: 'usd', receiptSent: false });
    expect(payments.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('stores actual settled currency and amount, and keeps subscription expiry stable across retries', async () => {
    const approvedAt = new Date('2026-10-13T00:00:00Z');
    Object.assign(pending, { status: 'completed', paymentType: 'subscribe', approvedAt });
    payments.findOne.mockReset().mockResolvedValue(pending);
    payments.findOneAndUpdate.mockResolvedValue(null);
    payments.findById.mockResolvedValue(pending);
    jest.spyOn(service as any, 'sendPaymentReceipt').mockResolvedValue(true);
    const intent = oldIntent({ status: 'succeeded', amount_received: 334, currency: 'gbp' });
    await service.completeStripePayment(intent as any);
    const result = await service.completeStripePayment(intent as any);
    expect(result).toMatchObject({ amount: 3.34, currency: 'gbp', receiptSent: true });
    const firstExpiry = users.updateOne.mock.calls[0][1].$set.subscriptionExpiry;
    expect(users.updateOne.mock.calls[1][1].$set.subscriptionExpiry).toEqual(firstExpiry);
    expect(firstExpiry).toEqual(new Date('2027-01-13T00:00:00Z'));
  });

  it('does not downgrade completed payments when an old failure event arrives', async () => {
    payments.findOneAndUpdate.mockResolvedValue(null);
    await service.failStripePayment(oldIntent() as any);
    expect(payments.findOneAndUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: { $nin: ['completed', 'refunded', 'failed'] } }), expect.anything(), expect.anything());
    expect(histories.create).not.toHaveBeenCalled();
  });

  it('sends one receipt using an atomic lease and skips a duplicate completed delivery', async () => {
    pending.status = 'completed';
    payments.findOneAndUpdate.mockResolvedValueOnce(pending).mockResolvedValueOnce(null);
    payments.findById.mockResolvedValue({ ...pending, receiptSentAt: new Date() });
    expect(await (service as any).sendPaymentReceipt(pending)).toBe(true);
    expect(await (service as any).sendPaymentReceipt(pending)).toBe(true);
    expect(sendMailer).toHaveBeenCalledTimes(1);
    expect(payments.updateOne).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ $set: { receiptSentAt: expect.any(Date) }, $unset: { receiptSendingAt: 1 } }));
  });

  it('releases a failed receipt lease so Stripe retry can send the email again', async () => {
    pending.status = 'completed';
    payments.findOneAndUpdate.mockResolvedValue(pending);
    (sendMailer as jest.Mock).mockRejectedValueOnce(new Error('SMTP unavailable'));
    expect(await (service as any).sendPaymentReceipt(pending)).toBe(false);
    expect(payments.updateOne).toHaveBeenCalledWith(expect.anything(), { $unset: { receiptSendingAt: 1 } });
    expect(await (service as any).sendPaymentReceipt(pending)).toBe(true);
    expect(sendMailer).toHaveBeenCalledTimes(2);
  });

  it('reconciles a legacy GBP invoice without changing its original paid date', async () => {
    const paidOn = new Date('2026-09-01T12:00:00Z');
    Object.assign(pending, { status: 'completed', updatedAt: paidOn, currency: undefined });
    payments.findById.mockResolvedValue(pending);
    stripe.paymentIntents.retrieve.mockResolvedValue(oldIntent({ status: 'succeeded', currency: 'gbp', amount_received: 334 }));
    await service.getPaymentInvoice(user._id.toString(), 'school', pending._id.toString());
    expect(generateInvoicePdfBuffer).toHaveBeenLastCalledWith(expect.objectContaining({ amount: 3.34, currency: 'gbp', paidAt: paidOn }));
    expect(payments.updateOne).toHaveBeenCalledWith(expect.anything(), expect.anything(), { timestamps: false });
    expect(pending.save).not.toHaveBeenCalled();
  });
});
