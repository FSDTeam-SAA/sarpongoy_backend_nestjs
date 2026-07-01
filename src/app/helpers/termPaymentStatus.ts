import { Types } from 'mongoose';

export type TermPaymentPlan =
  | 'first_term'
  | 'second_term'
  | 'third_term'
  | 'full_year';

export type SchoolPaymentStatus = {
  hasFullAccess: boolean;
  hasConfiguredDueDate: boolean;
  isRestricted: boolean;
  activeTerm: string;
  overdueTerm: string;
  reason: string;
};

type TermConfig = {
  firstTermDueDate?: Date | string;
  secondTermDueDate?: Date | string;
  thirdTermDueDate?: Date | string;
  fullPaymentDueDate?: Date | string;
  paymentTerms?: Array<{
    termId?: string;
    label?: string;
    amount?: number;
    amountPaid?: number;
    remainingDue?: number;
    dueDate?: Date | string;
    status?: string;
  }>;
};

type PaymentLike = {
  paymentPlan?: string;
  status?: string;
};

const TERM_SEQUENCE = [
  {
    plan: 'first_term',
    dueDateKey: 'firstTermDueDate',
  },
  {
    plan: 'second_term',
    dueDateKey: 'secondTermDueDate',
  },
  {
    plan: 'third_term',
    dueDateKey: 'thirdTermDueDate',
  },
] as const;

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const parseDate = (value?: Date | string) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : startOfDay(date);
};

const hasCompletedPayment = (payments: PaymentLike[], plan: string) =>
  payments.some(
    (payment) =>
      payment.paymentPlan === plan && payment.status === 'completed',
  );

const hasTermWisePayment = (payments: PaymentLike[]) =>
  payments.some((payment) =>
    ['first_term', 'second_term', 'third_term'].includes(
      payment.paymentPlan || '',
    ),
  );

const hasAnyConfiguredDueDate = (termConfig: TermConfig = {}) =>
  Boolean(
    termConfig.paymentTerms?.some((term) => parseDate(term.dueDate)) ||
    parseDate(termConfig.firstTermDueDate) ||
      parseDate(termConfig.secondTermDueDate) ||
      parseDate(termConfig.thirdTermDueDate) ||
      parseDate(termConfig.fullPaymentDueDate),
  );

const getDynamicStatus = (
  termConfig: TermConfig,
  hasConfiguredDueDate: boolean,
  now: Date,
) => {
  const terms = termConfig.paymentTerms || [];
  if (!terms.length) return null;

  const today = startOfDay(now);
  const unpaid = terms.filter((term) => Number(term.remainingDue ?? term.amount ?? 0) > 0);

  if (!unpaid.length) {
    return {
      hasFullAccess: true,
      hasConfiguredDueDate,
      isRestricted: false,
      activeTerm: 'none' as const,
      overdueTerm: 'none' as const,
      reason: 'All payment terms are fully paid',
    };
  }

  const overdue = unpaid.find((term) => {
    const dueDate = parseDate(term.dueDate);
    return dueDate && today > dueDate;
  });

  if (overdue) {
    const termId = (overdue.termId || 'term_due') as SchoolPaymentStatus['activeTerm'];
    return {
      hasFullAccess: false,
      hasConfiguredDueDate,
      isRestricted: true,
      activeTerm: termId,
      overdueTerm: termId,
      reason: `${overdue.label || overdue.termId || 'Payment term'} payment is overdue`,
    };
  }

  const active = unpaid.find((term) => parseDate(term.dueDate)) || unpaid[0];
  return {
    hasFullAccess: false,
    hasConfiguredDueDate,
    isRestricted: false,
    activeTerm: (active.termId || 'none') as SchoolPaymentStatus['activeTerm'],
    overdueTerm: 'none' as const,
    reason: hasConfiguredDueDate ? 'Payment due date is configured' : 'Payment terms are pending',
  };
};

const getNextConfiguredTerm = (termConfig: TermConfig, payments: PaymentLike[]) => {
  const nextTerm = TERM_SEQUENCE.find(
    (term) =>
      parseDate(termConfig[term.dueDateKey]) &&
      !hasCompletedPayment(payments, term.plan),
  );

  if (nextTerm) return nextTerm.plan;
  if (parseDate(termConfig.fullPaymentDueDate)) return 'full_payment';
  return 'none';
};

export function calculateSchoolPaymentStatus(
  termConfig: TermConfig = {},
  payments: PaymentLike[] = [],
  now = new Date(),
): SchoolPaymentStatus {
  const today = startOfDay(now);
  const hasConfiguredDueDate = hasAnyConfiguredDueDate(termConfig);

  if (hasCompletedPayment(payments, 'full_year')) {
    return {
      hasFullAccess: true,
      hasConfiguredDueDate,
      isRestricted: false,
      activeTerm: 'full_payment',
      overdueTerm: 'none',
      reason: 'Full school year payment completed',
    };
  }

  const dynamicStatus = getDynamicStatus(termConfig, hasConfiguredDueDate, now);

  if (dynamicStatus) return dynamicStatus;

  if (!hasConfiguredDueDate) {
    return {
      hasFullAccess: false,
      hasConfiguredDueDate: false,
      isRestricted: true,
      activeTerm: 'none',
      overdueTerm: 'none',
      reason: 'No payment due date is configured for this school',
    };
  }

  for (const term of TERM_SEQUENCE) {
    const dueDate = parseDate(termConfig[term.dueDateKey]);
    if (!dueDate) continue;

    if (today > dueDate && !hasCompletedPayment(payments, term.plan)) {
      return {
        hasFullAccess: false,
        hasConfiguredDueDate,
        isRestricted: true,
        activeTerm: term.plan,
        overdueTerm: term.plan,
        reason: `${term.plan.replace(/_/g, ' ')} payment is overdue`,
      };
    }
  }

  const fullPaymentDueDate = parseDate(termConfig.fullPaymentDueDate);
  if (
    fullPaymentDueDate &&
    today > fullPaymentDueDate &&
    !hasTermWisePayment(payments)
  ) {
    return {
      hasFullAccess: false,
      hasConfiguredDueDate,
      isRestricted: true,
      activeTerm: 'full_payment',
      overdueTerm: 'full_payment',
      reason: 'Full payment is overdue',
    };
  }

  if (hasTermWisePayment(payments)) {
    return {
      hasFullAccess: false,
      hasConfiguredDueDate,
      isRestricted: false,
      activeTerm: getNextConfiguredTerm(termConfig, payments),
      overdueTerm: 'none',
      reason: 'Term-wise payments are current',
    };
  }

  return {
    hasFullAccess: false,
    hasConfiguredDueDate,
    isRestricted: false,
    activeTerm: getNextConfiguredTerm(termConfig, payments),
    overdueTerm: 'none',
    reason: 'Payment due date is configured',
  };
}

export const toObjectId = (value: unknown) => {
  if (value instanceof Types.ObjectId) return value;
  if (typeof value === 'string' && Types.ObjectId.isValid(value)) {
    return new Types.ObjectId(value);
  }
  return undefined;
};
