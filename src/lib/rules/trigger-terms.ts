import type { FlagInput } from "./types";

/**
 * Reg Z trigger terms (§1026.24(d)):
 * If any of these appear, the ad must also include the required disclosures.
 */

interface TriggerTerm {
  pattern: RegExp;
  label: string;
}

const TRIGGER_TERMS: TriggerTerm[] = [
  // Payment amounts: "$1,650/month", "$200/mo", "$99 per month"
  { pattern: /\$[\d,]+\s*(?:\/|\s*per\s*)\s*(?:mo(?:nth)?|week)/i, label: "payment amount" },
  // Down payment: "10% down", "$5,000 down payment", "no down payment"
  { pattern: /(?:down\s*payment|\d+%?\s*down)/i, label: "down payment" },
  // Number of payments: "36 payments", "60-month term", "360 months"
  { pattern: /\d+\s*(?:payments?|month\s*term|months?\s*(?:term|repayment))/i, label: "number of payments" },
  // Finance charge: "finance charge", "$X in interest"
  { pattern: /finance\s*charge/i, label: "finance charge" },
  // Stated interest rate (not APR): "3.5% rate", "rate of 3.5%", "3.5% interest"
  { pattern: /\d+\.?\d*%\s*(?:rate|interest(?!\s*rate))/i, label: "stated interest rate" },
  { pattern: /rate\s*(?:of|:)\s*\d+\.?\d*%/i, label: "stated interest rate" },
  // "Fixed rate" for mortgages
  { pattern: /fixed\s*rate/i, label: "fixed rate claim" },
];

const REQUIRED_DISCLOSURES = [
  { pattern: /\bAPR\b/i, label: "APR" },
  { pattern: /\bannual\s*percentage\s*rate\b/i, label: "APR" },
  { pattern: /repayment\s*term|term\s*(?:of|:)\s*\d+|\d+\s*(?:year|month)\s*term/i, label: "repayment terms" },
];

export function checkTriggerTerms(content: string): FlagInput[] {
  const flags: FlagInput[] = [];
  const foundTerms: string[] = [];

  for (const term of TRIGGER_TERMS) {
    if (term.pattern.test(content)) {
      foundTerms.push(term.label);
    }
  }

  if (foundTerms.length === 0) return [];

  // Check which disclosures are missing
  const hasAPR = REQUIRED_DISCLOSURES.some(
    (d) => d.label === "APR" && d.pattern.test(content)
  );
  const hasTerms = REQUIRED_DISCLOSURES.some(
    (d) => d.label === "repayment terms" && d.pattern.test(content)
  );

  if (!hasAPR) {
    flags.push({
      source: "rule",
      location: "full ad",
      problem: `Trigger term(s) found (${foundTerms.join(", ")}) without APR disclosure`,
      rule: "Reg Z §1026.24(d) — trigger terms require APR disclosure",
      fix: "Add the Annual Percentage Rate (APR) near the trigger term",
    });
  }

  if (!hasTerms) {
    flags.push({
      source: "rule",
      location: "full ad",
      problem: `Trigger term(s) found (${foundTerms.join(", ")}) without repayment terms`,
      rule: "Reg Z §1026.24(d) — trigger terms require repayment term disclosure",
      fix: "Add the repayment term (e.g., '60-month term') near the trigger term",
    });
  }

  return flags;
}
