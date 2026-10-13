import Stripe from 'stripe';
import { WebhookService } from './webhook.service';

jest.mock('stripe', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('src/app/config', () => ({ __esModule: true, default: { stripe: { secretKey: 'sk_test_unit', webhookSecret: 'whsec_unit' } } }));
jest.mock('../payment/payment.service', () => ({ PaymentService: class PaymentService {} }));

describe('WebhookService verified receipt retry', () => {
  let webhook: WebhookService;
  let paymentService: any;
  let stripe: any;
  let response: any;
  const intent = { id: 'pi_paid', status: 'succeeded' };

  beforeEach(() => {
    stripe = { webhooks: { constructEvent: jest.fn().mockReturnValue({ type: 'payment_intent.succeeded', data: { object: intent } }) } };
    (Stripe as unknown as jest.Mock).mockImplementation(() => stripe);
    paymentService = { completeStripePayment: jest.fn().mockResolvedValue({ receiptSent: true }), failStripePayment: jest.fn() };
    response = { status: jest.fn(), send: jest.fn(), json: jest.fn() };
    response.status.mockReturnValue(response);
    webhook = new WebhookService(paymentService);
    jest.spyOn((webhook as any).logger, 'error').mockImplementation(() => undefined);
  });

  it('requires a verified signature before completing a payment', async () => {
    stripe.webhooks.constructEvent.mockImplementation(() => { throw new Error('Invalid signature'); });
    await webhook.handleWebhook(Buffer.from('event'), 'invalid', response);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(paymentService.completeStripePayment).not.toHaveBeenCalled();
  });

  it('asks Stripe to retry when payment succeeded but the receipt remains unsent', async () => {
    paymentService.completeStripePayment.mockRejectedValue(new Error('SMTP unavailable'));
    await webhook.handleWebhook(Buffer.from('event'), 'verified', response);
    expect(paymentService.completeStripePayment).toHaveBeenCalledWith(intent, true);
    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).not.toHaveBeenCalled();
  });

  it('acknowledges a completed payment after its receipt is sent or already recorded', async () => {
    await webhook.handleWebhook(Buffer.from('event'), 'verified', response);
    expect(paymentService.completeStripePayment).toHaveBeenCalledWith(intent, true);
    expect(response.json).toHaveBeenCalledWith({ received: true });
  });
});
