import { checkTriggerTerms } from "./trigger-terms";
import { checkRequiredIdentifiers } from "./required-identifiers";
import { checkUdaapRisk } from "./udaap-risk";
import type { FlagInput } from "./types";

export type { FlagInput };

/**
 * Runs all deterministic rule checks against ad content.
 * Returns a flat array of flags ready to insert via createFlags().
 */
export function runRuleChecks(
  content: string,
  product: string,
): FlagInput[] {
  return [
    ...checkTriggerTerms(content),
    ...checkRequiredIdentifiers(content, product),
    ...checkUdaapRisk(content),
  ];
}
