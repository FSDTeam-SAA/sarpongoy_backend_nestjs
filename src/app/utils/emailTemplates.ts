import axios from 'axios';
import { execFileSync } from 'child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const BRAND_NAME = 'iLearnReady';
const BRAND_TAGLINE = 'School billing, access, and reporting in one place.';
const WEBSITE_URL = 'https://ilearnready.com/';

type InvoiceInput = {
  invoiceNumber: string;
  schoolName: string;
  email: string;
  amount: number;
  paymentPlan?: string;
  paymentMethod?: string;
  status?: string;
  totalStudents?: number;
  perStudentCharge?: number;
  totalAmount?: number;
  paidAt?: Date | string;
  note?: string;
};

let logoSrcPromise: Promise<string> | null = null;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(Number(amount || 0));

const formatDate = (value?: Date | string) => {
  if (!value) return 'N/A';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(date);
};

const formatPlan = (plan?: string) => {
  if (plan === 'first_term') return 'First Term';
  if (plan === 'second_term') return 'Second Term';
  if (plan === 'third_term') return 'Third Term';
  if (plan === 'full_year') return 'Full Term';
  return plan ? plan.replace(/_/g, ' ') : 'N/A';
};

const buildAssetUrl = (pathname: string) =>
  new URL(pathname, WEBSITE_URL).toString();

const getLogoUrl = () => buildAssetUrl('/images/logo.png');

const getFallbackLogoSrc = () => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
      <defs>
        <linearGradient id="g" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stop-color="#063d5b" />
          <stop offset="100%" stop-color="#0f7aa8" />
        </linearGradient>
      </defs>
      <rect width="240" height="240" rx="48" fill="url(#g)" />
      <circle cx="120" cy="104" r="46" fill="rgba(255,255,255,0.14)" />
      <text x="120" y="114" text-anchor="middle" font-size="46" font-family="Arial, Helvetica, sans-serif" font-weight="700" fill="#ffffff">iL</text>
      <text x="120" y="166" text-anchor="middle" font-size="22" font-family="Arial, Helvetica, sans-serif" font-weight="700" fill="#ffffff">iLearnReady</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

const resolveLogoSrc = async () => {
  if (!logoSrcPromise) {
    logoSrcPromise = (async () => {
      const logoUrl = getLogoUrl();
      try {
        const response = await axios.get<ArrayBuffer>(logoUrl, {
          responseType: 'arraybuffer',
          timeout: 8000,
        });
        const contentType = response.headers['content-type'] || 'image/png';
        return `data:${contentType};base64,${Buffer.from(response.data).toString('base64')}`;
      } catch {
        return getFallbackLogoSrc();
      }
    })();
  }

  return logoSrcPromise;
};

const buildShell = (logoSrc: string, title: string, body: string, compact = false) => `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      body {
        margin: 0;
        padding: 0;
        background: #f4f8fb;
        color: #0f172a;
        font-family: Arial, Helvetica, sans-serif;
      }
      @page {
        size: A4;
        margin: 0;
      }
      .page {
        width: 100%;
        padding: 32px 16px;
        box-sizing: border-box;
      }
      .card {
        max-width: 680px;
        margin: 0 auto;
        background: #ffffff;
        border: 1px solid #dbe7f0;
        border-radius: 24px;
        overflow: hidden;
        box-shadow: 0 18px 50px rgba(10, 74, 110, 0.12);
      }
      .hero {
        background: #ffffff;
        border-bottom: 1px solid #dbe7f0;
        padding: 16px 32px 18px;
        color: #0f172a;
      }
      .logo {
        display: inline-block;
        width: 240px;
        height: 66px;
        overflow: hidden;
        text-decoration: none;
      }
      .logo img {
        display: block;
        width: 240px;
        height: auto;
        margin-top: -48px;
        object-fit: contain;
      }
      .tagline {
        margin-top: 8px;
        font-size: 13px;
        line-height: 1.5;
        color: #64748b;
      }
      .site-link {
        margin-top: 8px;
      }
      .site-link a {
        color: #0b68b7;
        font-size: 13px;
        font-weight: 700;
        text-decoration: none;
      }
      .content {
        padding: 32px;
      }
      .headline {
        margin: 0 0 12px;
        font-size: 28px;
        line-height: 1.15;
        color: #06263d;
      }
      .text {
        margin: 0 0 14px;
        font-size: 15px;
        line-height: 1.7;
        color: #334155;
      }
      .panel {
        margin: 24px 0;
        padding: 18px 20px;
        border: 1px solid #dbe7f0;
        border-radius: 18px;
        background: #f8fbfd;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px 18px;
      }
      .field .label {
        display: block;
        margin-bottom: 6px;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #64748b;
      }
      .field .value {
        font-size: 15px;
        font-weight: 600;
        color: #0f172a;
      }
      .summary {
        margin-top: 24px;
        border: 1px solid #dbe7f0;
        border-radius: 18px;
        overflow: hidden;
      }
      .summary-row {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        padding: 14px 18px;
        border-top: 1px solid #e5eef5;
        font-size: 14px;
      }
      .summary-row:first-child {
        border-top: 0;
      }
      .summary-row.total {
        background: #eef6fb;
        font-size: 16px;
        font-weight: 700;
        color: #063d5b;
      }
      .pill {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 8px 12px;
        background: #e6f6ee;
        color: #157f56;
        font-size: 12px;
        font-weight: 700;
        text-transform: capitalize;
      }
      .footer {
        padding: 0 32px 32px;
        font-size: 12px;
        line-height: 1.6;
        color: #64748b;
      }
      .note {
        margin-top: 16px;
        padding: 14px 16px;
        border-left: 4px solid #f59e0b;
        background: #fff7ed;
        color: #9a3412;
        border-radius: 14px;
        font-size: 13px;
        line-height: 1.6;
      }
      .button {
        display: inline-block;
        margin-top: 18px;
        border-radius: 12px;
        background: #063d5b;
        color: #ffffff;
        font-size: 14px;
        font-weight: 700;
        padding: 12px 18px;
        text-decoration: none;
      }
      body.compact .page {
        padding: 14px 12px;
      }
      body.compact .card {
        max-width: 650px;
        border-radius: 18px;
        box-shadow: none;
      }
      body.compact .hero {
        padding: 10px 24px 12px;
      }
      body.compact .content {
        padding: 22px 24px;
      }
      body.compact .headline {
        margin-bottom: 8px;
        font-size: 24px;
      }
      body.compact .text {
        margin-bottom: 10px;
        font-size: 13px;
      }
      body.compact .panel {
        margin: 16px 0;
        padding: 14px 16px;
      }
      body.compact .summary {
        margin-top: 16px;
      }
      body.compact .summary-row {
        padding: 11px 16px;
      }
      body.compact .note {
        margin-top: 14px;
        padding: 12px 14px;
      }
      body.compact .footer {
        padding: 0 24px 18px;
      }
      @media (max-width: 640px) {
        .content,
        .hero,
        .footer {
          padding-left: 20px;
          padding-right: 20px;
        }
        .grid {
          grid-template-columns: 1fr;
        }
        .headline {
          font-size: 24px;
        }
      }
    </style>
  </head>
  <body class="${compact ? 'compact' : ''}">
    <div class="page">
      <div class="card">
        ${body}
      </div>
    </div>
  </body>
</html>
`;

const renderInvoiceBody = async (input: InvoiceInput, compact = false) => {
  const logoSrc = await resolveLogoSrc();
  const statusLabel = input.status ? input.status.replace(/_/g, ' ') : 'completed';
  const safeSchoolName = escapeHtml(input.schoolName || 'School');
  const safeEmail = escapeHtml(input.email || 'N/A');
  const note = input.note ? `<div class="note">${escapeHtml(input.note)}</div>` : '';

  const profileDownloadLink = compact
    ? ''
    : `
        <a class="button" href="${new URL('/profile#subscription-payment', WEBSITE_URL).toString()}" target="_blank" rel="noreferrer">
          Download invoice from profile
        </a>
      `;

  return buildShell(
    logoSrc,
    `Invoice ${input.invoiceNumber}`,
    `
      <div class="hero">
        <a class="logo" href="${WEBSITE_URL}" target="_blank" rel="noreferrer">
          <img src="${logoSrc}" alt="${BRAND_NAME} logo" />
        </a>
        <div class="tagline">${BRAND_TAGLINE}</div>
        <div class="site-link"><a href="${WEBSITE_URL}" target="_blank" rel="noreferrer">https://ilearnready.com/</a></div>
      </div>
      <div class="content">
        <h1 class="headline">Payment received</h1>
        <p class="text">Your payment is complete. The invoice PDF is attached for your records.</p>
        <span class="pill">${escapeHtml(statusLabel)}</span>

        <div class="panel">
          <div class="grid">
            <div class="field">
              <span class="label">Invoice number</span>
              <div class="value">${escapeHtml(input.invoiceNumber)}</div>
            </div>
            <div class="field">
              <span class="label">School</span>
              <div class="value">${safeSchoolName}</div>
            </div>
            <div class="field">
              <span class="label">Billing email</span>
              <div class="value">${safeEmail}</div>
            </div>
            <div class="field">
              <span class="label">Paid on</span>
              <div class="value">${escapeHtml(formatDate(input.paidAt))}</div>
            </div>
            <div class="field">
              <span class="label">Payment plan</span>
              <div class="value">${escapeHtml(formatPlan(input.paymentPlan))}</div>
            </div>
            <div class="field">
              <span class="label">Payment method</span>
              <div class="value">${escapeHtml((input.paymentMethod || 'stripe').replace(/_/g, ' '))}</div>
            </div>
          </div>
        </div>

        <div class="summary">
          <div class="summary-row">
            <span>Total students</span>
            <strong>${Number(input.totalStudents || 0).toLocaleString()}</strong>
          </div>
          <div class="summary-row">
            <span>Per-student charge</span>
            <strong>${escapeHtml(formatCurrency(input.perStudentCharge || 0))}</strong>
          </div>
          <div class="summary-row">
            <span>Calculated total</span>
            <strong>${escapeHtml(formatCurrency(input.totalAmount || 0))}</strong>
          </div>
          <div class="summary-row total">
            <span>Amount paid</span>
            <strong>${escapeHtml(formatCurrency(input.amount || 0))}</strong>
          </div>
        </div>

        ${note}
        ${profileDownloadLink}
      </div>
      <div class="footer">
        Keep this invoice with your school records. If you need help, reply to this email or contact the admin team.
      </div>
    `,
    compact,
  );
};

const renderWelcomeBody = async (input: {
  email: string;
  password: string;
  schoolName?: string;
}) => {
  const logoSrc = await resolveLogoSrc();
  const displayName = input.schoolName?.trim() || input.email;

  return buildShell(
    logoSrc,
    'Welcome to iLearnReady',
    `
      <div class="hero">
        <a class="logo" href="${WEBSITE_URL}" target="_blank" rel="noreferrer">
          <img src="${logoSrc}" alt="${BRAND_NAME} logo" />
        </a>
        <div class="tagline">${BRAND_TAGLINE}</div>
        <div class="site-link"><a href="${WEBSITE_URL}" target="_blank" rel="noreferrer">https://ilearnready.com/</a></div>
      </div>
      <div class="content">
        <h1 class="headline">Welcome aboard, ${escapeHtml(displayName)}.</h1>
        <p class="text">Your school account is ready. You can sign in and start managing payment access, students, and billing from one place.</p>

        <div class="panel">
          <div class="grid">
            <div class="field">
              <span class="label">Login email</span>
              <div class="value">${escapeHtml(input.email)}</div>
            </div>
            <div class="field">
              <span class="label">Temporary password</span>
              <div class="value">${escapeHtml(input.password)}</div>
            </div>
          </div>
        </div>

        <p class="text">Please change your password after the first login.</p>
        <p class="text">If this account was created by mistake, contact support right away.</p>
      </div>
      <div class="footer">
        This message was sent automatically by ${BRAND_NAME}. Keep your login details private.
      </div>
    `,
  );
};

const findChromePath = () =>
  [
    process.env.CHROME_PATH,
    process.env.GOOGLE_CHROME_BIN,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].find((candidate): candidate is string => Boolean(candidate && existsSync(candidate)));

const renderHtmlToPdfBuffer = (html: string) => {
  const chromePath = findChromePath();
  if (!chromePath) {
    throw new Error('Chrome binary not found for PDF generation');
  }

  const workDir = mkdtempSync(join(tmpdir(), 'sarpongoy-invoice-'));
  const htmlPath = join(workDir, 'invoice.html');
  const pdfPath = join(workDir, 'invoice.pdf');

  try {
    writeFileSync(htmlPath, html, 'utf8');

    execFileSync(
      chromePath,
      [
        '--headless',
        '--disable-gpu',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--hide-scrollbars',
        '--run-all-compositor-stages-before-draw',
        '--virtual-time-budget=2500',
        '--print-to-pdf-no-header',
        '--no-pdf-header-footer',
        `--print-to-pdf=${pdfPath}`,
        htmlPath,
      ],
      { stdio: 'ignore' },
    );

    return readFileSync(pdfPath);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
};

const escapePdfText = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

const writePdfText = (
  lines: string[],
  text: string,
  x: number,
  y: number,
  size = 11,
) => {
  lines.push(
    `BT /F1 ${size} Tf ${x} ${y} Td (${escapePdfText(text)}) Tj ET`,
  );
};

const renderInvoiceFallbackPdfBuffer = (input: InvoiceInput) => {
  const content: string[] = ['0.95 0.97 0.99 rg 0 0 612 792 re f'];
  const rows = [
    ['Invoice number', input.invoiceNumber],
    ['School', input.schoolName || 'School'],
    ['Billing email', input.email || 'N/A'],
    ['Paid on', formatDate(input.paidAt)],
    ['Payment plan', formatPlan(input.paymentPlan)],
    ['Payment method', (input.paymentMethod || 'stripe').replace(/_/g, ' ')],
    ['Status', (input.status || 'completed').replace(/_/g, ' ')],
    ['Total students', Number(input.totalStudents || 0).toLocaleString()],
    ['Per-student charge', formatCurrency(input.perStudentCharge || 0)],
    ['Calculated total', formatCurrency(input.totalAmount || 0)],
    ['Amount paid', formatCurrency(input.amount || 0)],
  ];

  content.push('1 1 1 rg 48 72 516 648 re f');
  content.push('0.02 0.24 0.36 rg 48 650 516 70 re f');
  writePdfText(content, BRAND_NAME, 72, 690, 24);
  writePdfText(content, BRAND_TAGLINE, 72, 668, 10);

  writePdfText(content, 'Payment invoice', 72, 612, 22);
  writePdfText(
    content,
    'This PDF was generated without Chrome using the built-in fallback.',
    72,
    592,
    10,
  );

  let y = 550;
  for (const [label, value] of rows) {
    writePdfText(content, label, 72, y, 10);
    writePdfText(content, String(value || 'N/A'), 240, y, 11);
    y -= 26;
  }

  if (input.note) {
    writePdfText(content, 'Note', 72, y - 8, 10);
    writePdfText(content, input.note, 240, y - 8, 10);
  }

  writePdfText(
    content,
    `Generated by ${BRAND_NAME}. Keep this invoice with your school records.`,
    72,
    104,
    9,
  );

  const stream = content.join('\n');
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream\nendobj\n`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += object;
  }

  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf);
};

export const generateWelcomeEmail = async (input: {
  email: string;
  password: string;
  schoolName?: string;
}) => renderWelcomeBody(input);

export const generateInvoiceEmail = async (input: InvoiceInput) =>
  renderInvoiceBody(input);

export const generateInvoicePdfBuffer = async (input: InvoiceInput) => {
  const html = await renderInvoiceBody(input, true);
  try {
    return renderHtmlToPdfBuffer(html);
  } catch {
    return renderInvoiceFallbackPdfBuffer(input);
  }
};

export type { InvoiceInput };
