import type { FlagInput } from "./types";

interface RiskPhrase {
  pattern: RegExp;
  problem: string;
  fix: string;
}

const RISK_PHRASES: RiskPhrase[] = [
  {
    pattern: /\bguaranteed\s*(?:approval|approved)\b/i,
    problem: '"Guaranteed approval" is likely deceptive — approval depends on creditworthiness',
    fix: 'Replace with "see if you qualify" or "check your rate" language',
  },
  {
    pattern: /\beveryone\s*(?:is\s*)?approved\b/i,
    problem: '"Everyone approved" is likely deceptive — approval depends on creditworthiness',
    fix: 'Replace with "see if you qualify" or "check your rate" language',
  },
  {
    pattern: /\bno\s*credit\s*check\b/i,
    problem: '"No credit check" — if any credit inquiry occurs, this is deceptive',
    fix: "Remove or qualify: specify whether a soft or hard pull occurs",
  },
  {
    pattern: /\bfree\s*money\b/i,
    problem: '"Free money" is misleading for a loan product — borrowers repay with interest',
    fix: "Remove the phrase entirely",
  },
  {
    pattern: /\brisk[\s-]*free\b/i,
    problem: '"Risk-free" is misleading — borrowing always carries risk',
    fix: "Remove or replace with factual terms about the product",
  },
  {
    pattern: /\bno\s*(?:fees|cost)\b/i,
    problem: '"No fees" / "no cost" must be literally true — most loans have some fees',
    fix: "Verify the claim is substantiable, or qualify which fees are waived",
  },
  {
    pattern: /\b(?:lowest|best|cheapest)\s*(?:rates?|prices?|APR)\b/i,
    problem: "Superlative rate claims require substantiation",
    fix: "Replace with 'competitive rates' or substantiate with a source and date",
  },
  {
    pattern: /\bact\s*now\b.*\b(?:limited|expires?|hurry|today\s*only)\b/i,
    problem: "False urgency combined with time pressure may be deceptive",
    fix: "If the offer has a real deadline, state it clearly; otherwise remove urgency language",
  },
  {
    pattern: /\b(?:limited|expires?|hurry|today\s*only)\b.*\bact\s*now\b/i,
    problem: "False urgency combined with time pressure may be deceptive",
    fix: "If the offer has a real deadline, state it clearly; otherwise remove urgency language",
  },
  {
    pattern: /\bpre[\s-]?approved\b/i,
    problem: '"Pre-approved" implies a credit decision has been made — the product is prequalification, not preapproval',
    fix: 'Replace with "pre-qualified" or "see if you qualify"',
  },
];

export function checkUdaapRisk(content: string): FlagInput[] {
  const flags: FlagInput[] = [];

  for (const phrase of RISK_PHRASES) {
    const match = content.match(phrase.pattern);
    if (match) {
      flags.push({
        source: "rule",
        location: `near "${match[0]}"`,
        problem: phrase.problem,
        rule: "UDAAP — Unfair, Deceptive, or Abusive Acts or Practices",
        fix: phrase.fix,
      });
    }
  }

  return flags;
}
