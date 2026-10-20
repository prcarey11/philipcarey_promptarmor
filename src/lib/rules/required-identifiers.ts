import type { FlagInput } from "./types";

const NMLS_PATTERN = /NMLS\s*#?\s*\d+/i;
const EQUAL_HOUSING_PATTERN = /equal\s*housing\s*(lender|opportunity)/i;
const MEMBER_FDIC_PATTERN = /member\s*FDIC/i;

export function checkRequiredIdentifiers(
  content: string,
  product: string
): FlagInput[] {
  const flags: FlagInput[] = [];
  const lowerProduct = product.toLowerCase();

  // NMLS ID required for all consumer lending ads
  if (!NMLS_PATTERN.test(content)) {
    flags.push({
      source: "rule",
      location: "footer or disclosure area",
      problem: "Missing NMLS identifier",
      rule: "S.A.F.E. Act — mortgage loan originators must display NMLS ID",
      fix: "Add 'NMLS #XXXXXX' with the company's NMLS number",
    });
  }

  // Equal Housing Lender/Opportunity for mortgage products
  if (lowerProduct.includes("mortgage") && !EQUAL_HOUSING_PATTERN.test(content)) {
    flags.push({
      source: "rule",
      location: "footer or disclosure area",
      problem: "Missing Equal Housing Lender/Opportunity statement",
      rule: "Fair Housing Act — mortgage ads must include Equal Housing notice",
      fix: "Add 'Equal Housing Lender' or 'Equal Housing Opportunity' statement",
    });
  }

  // Member FDIC for bank deposit products (credit cards from banks)
  if (
    (lowerProduct.includes("deposit") || lowerProduct.includes("savings") || lowerProduct.includes("checking")) &&
    !MEMBER_FDIC_PATTERN.test(content)
  ) {
    flags.push({
      source: "rule",
      location: "footer or disclosure area",
      problem: "Missing Member FDIC statement",
      rule: "FDIC regulations — deposit product ads must include Member FDIC",
      fix: "Add 'Member FDIC' statement",
    });
  }

  return flags;
}
