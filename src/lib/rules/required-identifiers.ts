import type { FlagInput } from "./types";

const NMLS_PATTERN = /NMLS\s*#?\s*\d+/i;
const EQUAL_HOUSING_PATTERN = /equal\s*housing\s*(lender|opportunity)/i;

export function checkRequiredIdentifiers(
  content: string,
  product: string
): FlagInput[] {
  const flags: FlagInput[] = [];
  const lowerProduct = product.toLowerCase();
  const isMortgage = lowerProduct.includes("mortgage");

  // NMLS ID required for mortgage ads
  if (isMortgage && !NMLS_PATTERN.test(content)) {
    flags.push({
      source: "rule",
      location: "footer or disclosure area",
      problem: "Missing NMLS identifier",
      rule: "Internal policy (state licensing law) — mortgage ads display NMLS ID",
      fix: "Add 'NMLS #XXXXXX' with the company's NMLS number",
    });
  }

  // Equal Housing Lender/Opportunity for mortgage products
  if (isMortgage && !EQUAL_HOUSING_PATTERN.test(content)) {
    flags.push({
      source: "rule",
      location: "footer or disclosure area",
      problem: "Missing Equal Housing Lender/Opportunity statement",
      rule: "Fair Housing Act — mortgage ads must include Equal Housing notice",
      fix: "Add 'Equal Housing Lender' or 'Equal Housing Opportunity' statement",
    });
  }

  return flags;
}
