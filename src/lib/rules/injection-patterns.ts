import type { FlagInput } from "./types";

/**
 * Flags instruction-like patterns in ad text that suggest prompt injection.
 * These are deterministic (source='rule') so they survive even if the LLM
 * is steered by the injected instructions.
 */

interface InjectionPattern {
  pattern: RegExp;
  description: string;
}

const INJECTION_PATTERNS: InjectionPattern[] = [
  { pattern: /ignore\s+(?:all\s+)?(?:previous|above|prior)\s+instructions/i, description: "ignore instructions" },
  { pattern: /disregard\s+(?:the\s+)?(?:above|previous|prior)/i, description: "disregard instructions" },
  { pattern: /forget\s+(?:your|all|the)\s+instructions/i, description: "forget instructions" },
  { pattern: /you\s+are\s+now\b/i, description: "role reassignment" },
  { pattern: /(?:act|behave)\s+as\s+(?:if|though)?\s*(?:a|an)?\s*(?!now)/i, description: "role reassignment" },
  { pattern: /pretend\s+(?:to\s+be|you(?:'re|\s+are))/i, description: "role reassignment" },
  { pattern: /mark\s+(?:as\s+)?(?:compliant|approved|clean)/i, description: "compliance override" },
  { pattern: /report\s+no\s+(?:issues|problems|violations|flags)/i, description: "suppress findings" },
  { pattern: /say\s+(?:there\s+are\s+)?no\s+(?:issues|problems|violations)/i, description: "suppress findings" },
  { pattern: /do\s+not\s+(?:flag|report|mention)\s+(?:any|this)/i, description: "suppress findings" },
  { pattern: /output\s+(?:only\s+)?(?:empty|no|zero)\s+(?:flags|issues|results)/i, description: "suppress findings" },
];

export function checkInjectionPatterns(content: string): FlagInput[] {
  const flags: FlagInput[] = [];
  const seen = new Set<string>();

  for (const { pattern, description } of INJECTION_PATTERNS) {
    const match = content.match(pattern);
    if (match && !seen.has(description)) {
      seen.add(description);
      flags.push({
        source: "rule",
        location: `near "${match[0]}"`,
        problem: `Ad text contains instruction-like language (${description}). This may be a prompt injection attempt by the submitter.`,
        rule: "Internal policy — ad content must not contain instructions directed at review systems",
        fix: "Remove the instruction-like text. If the ad is from an affiliate, escalate for review.",
      });
    }
  }

  return flags;
}
