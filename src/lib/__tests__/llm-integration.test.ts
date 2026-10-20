import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runLlmPreCheck, JUDGMENT_CATEGORIES } from "../llm/pre-check";

const VALID_CATEGORIES = new Set<string>(JUDGMENT_CATEGORIES);

describe("LLM pre-check integration", () => {
  it("returns valid flags for a bad ad", async () => {
    const badAd = `LIMITED TIME OFFER! Act now before rates go up!
Get the lowest rates guaranteed - only $299/month!
No fees, no hassle. Your dream home awaits.
*Rate of 2.99% for qualified borrowers. Actual rate may vary.
Terms and conditions apply. See website for details.`;

    const result = await runLlmPreCheck(badAd, "Mortgage", "email");
    console.log(`  Integration: status=${result.status}, flags=${result.flags.length}`);
    for (const f of result.flags) {
      console.log(`    [${f.rule}] ${f.location}: ${f.problem}`);
    }

    assert.equal(result.status, "completed");
    assert.ok(result.flags.length >= 1, "expected at least 1 flag from the LLM");

    // Every flag must have a valid judgment category
    for (const flag of result.flags) {
      assert.ok(VALID_CATEGORIES.has(flag.rule), `invalid category: ${flag.rule}`);
      assert.equal(flag.source, "llm");
      assert.ok(flag.location.length > 0);
      assert.ok(flag.problem.length > 0);
      assert.ok(flag.fix.length > 0);
    }
  });
});
