import { execFileSync } from 'child_process';
import {
  generateInvoiceEmail,
  generateInvoicePdfBuffer,
  type InvoiceInput,
} from './emailTemplates';

jest.mock('axios', () => ({
  __esModule: true,
  default: { get: jest.fn().mockRejectedValue(new Error('Logo unavailable')) },
}));

jest.mock('child_process', () => ({
  execFileSync: jest.fn(() => {
    throw new Error('Chrome unavailable');
  }),
}));

jest.mock('fs', () => {
  const actual = jest.requireActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: (path: import('fs').PathLike) =>
      path === '/mock/invoice-chrome' || actual.existsSync(path),
  };
});

const demoInvoice: InvoiceInput = {
  invoiceNumber: 'INV-DEMO-0001',
  schoolName: 'Demo Preparatory School',
  email: 'finance@example.test',
  amount: 3.33,
  currency: 'usd',
  paymentPlan: 'first_term',
  paymentMethod: 'stripe',
  status: 'completed',
  totalStudents: 1,
  perStudentCharge: 10,
  totalAmount: 10,
  paidAt: '2026-10-13T12:00:00.000Z',
  note: 'Stripe confirmed this payment automatically.',
};

describe('payment invoice receipts', () => {
  let previousChromePath: string | undefined;

  beforeAll(() => {
    previousChromePath = process.env.CHROME_PATH;
    process.env.CHROME_PATH = '/mock/invoice-chrome';
  });

  afterAll(() => {
    if (previousChromePath === undefined) delete process.env.CHROME_PATH;
    else process.env.CHROME_PATH = previousChromePath;
  });

  it('uses the actual charged currency for legacy receipts and USD for contract totals', async () => {
    const input = { ...demoInvoice, currency: 'gbp' };
    const html = await generateInvoiceEmail(input);
    const pdf = await generateInvoicePdfBuffer(input);
    const pdfText = pdf.toString('utf8');

    expect(html).toMatch(/Amount paid<\/span>\s*<strong>GBP 3\.33<\/strong>/);
    expect(html).toMatch(
      /Calculated total<\/span>\s*<strong>USD 10\.00<\/strong>/,
    );
    expect(pdfText).toContain('(GBP 3.33)');
    expect(pdfText).toContain('(USD 10.00)');
    expect(pdfText).not.toContain('£');
  });

  it('keeps USD payment amounts and customer details in a valid fallback PDF without implementation messages', async () => {
    const pdf = await generateInvoicePdfBuffer({
      ...demoInvoice,
      currency: undefined,
    });
    const content = pdf.toString('utf8');

    expect(execFileSync).toHaveBeenCalled();
    expect(content).toContain('%PDF-1.4');
    expect(content).toContain('(Payment invoice)');
    expect(content).toContain('(INV-DEMO-0001)');
    expect(content).toContain('(finance@example.test)');
    expect(content).toContain('(First Term)');
    expect(content).toContain('(USD 3.33)');
    expect(content).not.toMatch(/without Chrome|built-in fallback/i);

    const xrefMatch = /startxref\n(\d+)\n%%EOF/.exec(content);
    expect(xrefMatch).not.toBeNull();
    const xrefOffset = Number(xrefMatch![1]);
    expect(pdf.subarray(xrefOffset, xrefOffset + 4).toString()).toBe('xref');
    const entries = [...content.matchAll(/(\d{10}) 00000 n /g)];
    expect(entries).toHaveLength(5);
    entries.forEach((entry, index) => {
      const offset = Number(entry[1]);
      expect(pdf.subarray(offset, offset + 7).toString()).toBe(
        `${index + 1} 0 obj`,
      );
    });
  });

  it('escapes customer-provided HTML and PDF delimiters without changing the billing address', async () => {
    const html = await generateInvoiceEmail({
      ...demoInvoice,
      schoolName: 'Demo <Campus A> & School',
      note: '<script>alert("demo")</script>',
    });
    expect(html).toContain('Demo &lt;Campus A&gt; &amp; School');
    expect(html).not.toContain('<script>');
    expect(html).toContain(
      '&lt;script&gt;alert(&quot;demo&quot;)&lt;/script&gt;',
    );
    expect(html).toContain('finance@example.test');

    const pdf = await generateInvoicePdfBuffer({
      ...demoInvoice,
      schoolName: 'Demo (Campus A) \\ School',
    });
    expect(pdf.toString('utf8')).toContain('(Demo \\(Campus A\\) \\\\ School)');
  });
});
