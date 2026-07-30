const MIN_CREDIT_MONTHS = 1;
const MAX_CREDIT_MONTHS = 6;
const DOWN_PAYMENT_PERCENT = 50;

function normalizeCreditMonths(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(MIN_CREDIT_MONTHS, Math.min(MAX_CREDIT_MONTHS, parsed));
}

function isCreditCheckout(value) {
  return String(value || "").trim().toLowerCase() === "credit";
}

function addMonths(date, months) {
  const base = date instanceof Date ? new Date(date.getTime()) : new Date();
  const day = base.getDate();
  const next = new Date(base.getTime());
  next.setMonth(next.getMonth() + months, 1);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, lastDay));
  return next;
}

function buildCreditSchedule({ principalAmount, termMonths, startDate = new Date() }) {
  const principal = Math.max(0, Math.round(Number(principalAmount || 0)));
  const months = normalizeCreditMonths(termMonths);
  if (!principal || !months) {
    return null;
  }

  const downPaymentAmount = Math.floor((principal * DOWN_PAYMENT_PERCENT) / 100);
  const financedAmount = Math.max(0, principal - downPaymentAmount);
  const baseMonthly = Math.floor(financedAmount / months);
  let remainder = financedAmount - baseMonthly * months;
  const payments = Array.from({ length: months }, (_, index) => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return {
      installment: index + 1,
      amount: baseMonthly + extra,
      dueDate: addMonths(startDate, index + 1),
    };
  });

  return {
    principalAmount: principal,
    downPaymentAmount,
    financedAmount,
    termMonths: months,
    monthlyAmount: payments[0]?.amount || 0,
    payments,
  };
}

function mapCreditForClient(credit, now = new Date()) {
  if (!credit) return null;
  const payments = Array.isArray(credit.payments) ? credit.payments : [];
  const paidAmount = payments
    .filter((payment) => String(payment.status || "").toLowerCase() === "paid")
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const nextPayment = payments.find((payment) => String(payment.status || "").toLowerCase() === "pending") || null;
  const overdueCount = payments.filter((payment) => {
    const status = String(payment.status || "").toLowerCase();
    const dueDate = new Date(payment.dueDate || "");
    return status !== "paid" && Number.isFinite(dueDate.getTime()) && dueDate.getTime() < now.getTime();
  }).length;

  return {
    id: credit.id,
    orderId: credit.orderId,
    slug: credit.slug,
    status: credit.status,
    principalAmount: credit.principalAmount,
    downPaymentAmount: credit.downPaymentAmount,
    financedAmount: credit.financedAmount,
    termMonths: credit.termMonths,
    monthlyAmount: credit.monthlyAmount,
    paidAmount,
    remainingAmount: Math.max(0, Number(credit.financedAmount || 0) - paidAmount),
    overdueCount,
    startedAt: credit.startedAt,
    completedAt: credit.completedAt,
    nextPayment: nextPayment
      ? {
        id: nextPayment.id,
        installment: nextPayment.installment,
        amount: nextPayment.amount,
        dueDate: nextPayment.dueDate,
        status: nextPayment.status,
      }
      : null,
    payments: payments.map((payment) => ({
      id: payment.id,
      installment: payment.installment,
      amount: payment.amount,
      dueDate: payment.dueDate,
      paidAt: payment.paidAt,
      status: payment.status,
      adminNote: payment.adminNote || "",
    })),
  };
}

module.exports = {
  DOWN_PAYMENT_PERCENT,
  MAX_CREDIT_MONTHS,
  MIN_CREDIT_MONTHS,
  buildCreditSchedule,
  isCreditCheckout,
  mapCreditForClient,
  normalizeCreditMonths,
};
