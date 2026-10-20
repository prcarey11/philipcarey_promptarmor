import type { FlagInput } from "./types";

/**
 * Reg Z trigger terms and stated-rate rules.
 *
 * Trigger terms (§1026.24(d) for open-end, §1026.16(b) for credit cards):
 *   If a trigger term appears, additional disclosures are required.
 *
 * Stated-rate rule (§1026.24(c)):
 *   A rate must be stated as an APR; no other rate may be more conspicuous.
 *
 * Mortgage "fixed" rule (§1026.24(i)(1)):
 *   "Fixed" may not be used to describe a rate that can change.
 */

interface TriggerTerm {
  pattern: RegExp;
  label: string;
}

const TRIGGER_TERMS: TriggerTerm[] = [
  // Payment amounts: "$1,650/month", "$1,650.00/month", "$200/mo", "monthly payments of $200"
  { pattern: /\$[\d,.]+\s*(?:\/|\s*per\s*)\s*(?:mo(?:nth)?|week)/i, label: "payment amount" },
  { pattern: /monthly\s+payments?\s+of\s+\$[\d,.]+/i, label: "payment amount" },
  // Down payment: "10% down", "$5,000 down payment", "no down payment"
  { pattern: /(?:down\s*payment|\d+%?\s*down)/i, label: "down payment" },
  // Number of payments: "36 payments", "36 monthly payments", "60-month term", "5-year term"
  { pattern: /\d+\s*(?:monthly\s+)?payments?/i, label: "number of payments" },
  { pattern: /\d+[\s-]*(?:month|year)[\s-]*term/i, label: "number of payments" },
  // Finance charge
  { pattern: /finance\s*charge/i, label: "finance charge" },
];

// Stated interest rate patterns — these trigger §1026.24(c), not trigger-term disclosures
const STATED_RATE_PATTERNS: RegExp[] = [
  // "3.5% rate", "5.99% interest rate", "3.5% interest"
  /\d+\.?\d*%\s*(?:interest\s+)?rate/i,
  // "rate of 3.5%", "rate: 3.5%"
  /rate\s*(?:of|:)\s*\d+\.?\d*%/i,
  // "rates as low as 5.99%"
  /rates?\s+as\s+low\s+as\s+\d+\.?\d*%/i,
  // "5.99% interest" (not followed by "rate" — already caught above)
  /\d+\.?\d*%\s*interest(?!\s+rate)/i,
];

const APR_PATTERNS = [
  /\bAPR\b/,
  /\bannual\s*percentage\s*rate\b/i,
];

const REPAYMENT_TERM_PATTERNS = [
  /repayment\s*term/i,
  /term\s*(?:of|:)\s*\d+/i,
  /\d+[\s-]*(?:year|month)[\s-]*term/i,
];

const DOWN_PAYMENT_DISCLOSURE_PATTERNS = [
  /down\s*payment\s*(?:of\s*)?\$[\d,.]+/i,
  /\$[\d,.]+\s*down\s*payment/i,
  /\d+\.?\d*%\s*down\s*payment/i,
  /no\s*down\s*payment/i,
];

function hasAPR(content: string): boolean {
  return APR_PATTERNS.some((p) => p.test(content));
}

function hasRepaymentTerms(content: string): boolean {
  return REPAYMENT_TERM_PATTERNS.some((p) => p.test(content));
}

function hasDownPaymentDisclosure(content: string): boolean {
  return DOWN_PAYMENT_DISCLOSURE_PATTERNS.some((p) => p.test(content));
}

function ruleRef(product: string): string {
  const lp = product.toLowerCase();
  if (lp.includes("credit card")) return "Reg Z §1026.16(b)";
  return "Reg Z §1026.24(d)";
}

export function checkTriggerTerms(content: string, product: string): FlagInput[] {
  const flags: FlagInput[] = [];
  const foundTerms: string[] = [];

  for (const term of TRIGGER_TERMS) {
    if (term.pattern.test(content)) {
      if (!foundTerms.includes(term.label)) {
        foundTerms.push(term.label);
      }
    }
  }

  // Check trigger-term disclosure requirements
  if (foundTerms.length > 0) {
    const ref = ruleRef(product);

    if (!hasAPR(content)) {
      flags.push({
        source: "rule",
        location: "full ad",
        problem: `Trigger term(s) found (${foundTerms.join(", ")}) without APR disclosure`,
        rule: `${ref} — trigger terms require APR disclosure`,
        fix: "Add the Annual Percentage Rate (APR) near the trigger term",
      });
    }

    if (!hasRepaymentTerms(content)) {
      flags.push({
        source: "rule",
        location: "full ad",
        problem: `Trigger term(s) found (${foundTerms.join(", ")}) without repayment terms`,
        rule: `${ref} — trigger terms require repayment term disclosure`,
        fix: "Add the repayment term (e.g., '60-month term') near the trigger term",
      });
    }

    // §1026.24(d) also requires down payment disclosure for non-credit-card products
    if (!product.toLowerCase().includes("credit card") && !hasDownPaymentDisclosure(content)) {
      flags.push({
        source: "rule",
        location: "full ad",
        problem: `Trigger term(s) found (${foundTerms.join(", ")}) without down payment disclosure`,
        rule: `${ref} — trigger terms require down payment amount or "no down payment"`,
        fix: 'Add the down payment amount (e.g., "$0 down payment" or "10% down payment")',
      });
    }
  }

  // Stated-rate rule: rate must be expressed as APR (§1026.24(c))
  for (const pattern of STATED_RATE_PATTERNS) {
    const match = content.match(pattern);
    if (match && !hasAPR(content)) {
      flags.push({
        source: "rule",
        location: `near "${match[0]}"`,
        problem: "Interest rate stated without APR — no rate may be more conspicuous than the APR",
        rule: "Reg Z §1026.24(c) — rate must be stated as APR, no other rate more conspicuous",
        fix: "Express the rate as an APR, or add the APR at equal or greater prominence",
      });
      break; // one flag is enough
    }
  }

  // Mortgage-only: misleading use of "fixed" (§1026.24(i)(1))
  if (product.toLowerCase().includes("mortgage") && /\bfixed\b/i.test(content)) {
    flags.push({
      source: "rule",
      location: "full ad",
      problem: '"Fixed" used in a mortgage ad — may mislead if the rate, payment, or terms can change',
      rule: 'Reg Z §1026.24(i)(1) — misleading use of "fixed" in mortgage advertising',
      fix: 'Remove "fixed" or clarify exactly what is fixed and for how long (e.g., "fixed for 5 years, then adjustable")',
    });
  }

  return flags;
}
