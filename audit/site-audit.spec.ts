import { test, expect, Page } from "@playwright/test";
import path from "path";

const SCREENSHOTS = path.join(__dirname, "screenshots");
const RUN_ID = Date.now().toString(36);

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

async function snap(page: Page, name: string) {
  await page.screenshot({
    path: path.join(SCREENSHOTS, `${name}.png`),
    fullPage: true,
  });
}

async function setRole(page: Page, role: "reviewer" | "submitter", name: string) {
  const url = new URL(page.url());
  await page.context().addCookies([
    { name: "clearpath-name", value: name, domain: url.hostname, path: "/" },
    { name: "clearpath-role", value: role, domain: url.hostname, path: "/" },
  ]);
}

/** Submit an ad and return the detail page URL by finding it in the queue. */
async function submitAdAndGetUrl(
  page: Page,
  title: string,
  content: string,
  channel = "email",
  product = "Personal Loan"
): Promise<string> {
  await page.goto("/submissions/new");
  await page.fill('input[name="title"]', title);
  await page.selectOption('select[name="channel"]', channel);
  await page.selectOption('select[name="product"]', product);
  await page.fill('textarea[name="content"]', content);
  await page.click('button:has-text("Submit for Review")');

  // Wait for redirect to a UUID-based URL (not /submissions/new)
  try {
    await page.waitForURL(/\/submissions\/[0-9a-f]{8}-/, { timeout: 90000 });
    return page.url();
  } catch {
    // If redirect times out, find the submission in the queue
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const link = page.locator(`a:has-text("${title}")`);
    await expect(link).toBeVisible({ timeout: 5000 });
    const href = await link.getAttribute("href");
    const fullUrl = new URL(href!, page.url()).toString();
    await page.goto(fullUrl);
    await page.waitForLoadState("networkidle");
    return page.url();
  }
}

// -------------------------------------------------------------------
// Test 1: Submit an ad -> rule flags and LLM flags appear
// -------------------------------------------------------------------
test("1. Submit ad and see rule + LLM flags", async ({ page }) => {
  const title = `Audit Violations ${RUN_ID}`;
  await page.goto("/");
  await setRole(page, "submitter", `Sub1-${RUN_ID}`);
  await snap(page, "01a-queue-initial");

  const url = await submitAdAndGetUrl(
    page,
    title,
    `Get a personal loan at 3.5% rate! Only $200/month!
Guaranteed approval for everyone!
No credit check required.
Act now, limited time offer — hurry!

Apply today at ClearPath Financial.`
  );
  await snap(page, "01b-submission-detail");

  // Check for flags — may be Open Flags or Required Changes depending on timing
  const hasOpenFlags = await page.locator("text=Open Flags").isVisible().catch(() => false);
  const hasRequiredChanges = await page.locator("text=Required Changes").isVisible().catch(() => false);
  const hasResolvedDismissed = await page.locator("text=Resolved / Dismissed").isVisible().catch(() => false);

  console.log(`Open Flags visible: ${hasOpenFlags}`);
  console.log(`Required Changes visible: ${hasRequiredChanges}`);
  console.log(`Resolved/Dismissed visible: ${hasResolvedDismissed}`);

  // Check for rule-sourced flags anywhere on the page
  const ruleBadges = page.locator("span.bg-purple-100");
  const ruleCount = await ruleBadges.count();
  console.log(`Rule flags found: ${ruleCount}`);

  const llmBadges = page.locator("span.bg-indigo-100");
  const llmCount = await llmBadges.count();
  console.log(`LLM flags found: ${llmCount}`);

  expect(ruleCount + llmCount).toBeGreaterThan(0);
  await snap(page, "01c-flags-detail");
});

// -------------------------------------------------------------------
// Test 2: Accept a flag, then try to approve -> must be blocked
// -------------------------------------------------------------------
test("2. Approve blocked by accepted flags", async ({ page }) => {
  await page.goto("/");
  await setRole(page, "reviewer", `Rev2-${RUN_ID}`);
  await page.reload();

  // Use the seeded violation ad
  const violationLink = page.locator('a:has-text("Dream Home Spring Campaign")');
  await expect(violationLink).toBeVisible();
  await violationLink.click();
  await page.waitForLoadState("networkidle");
  await snap(page, "02a-violation-detail-reviewer");

  // Accept the first open flag
  const acceptBtn = page.locator('button:has-text("Accept")').first();
  if (await acceptBtn.isVisible()) {
    await acceptBtn.click();
    await page.waitForLoadState("networkidle");
    await snap(page, "02b-flag-accepted");
  }

  // Check if Approve button is disabled
  const approveBtn = page.locator('button:has-text("Approve")');
  if (await approveBtn.isVisible()) {
    const isDisabled = await approveBtn.isDisabled();
    console.log(`Approve button disabled after accepting flag: ${isDisabled}`);
    await snap(page, "02c-approve-button-state");
    expect(isDisabled).toBe(true);
  }
});

// -------------------------------------------------------------------
// Test 3: Request changes -> revise -> new version, status = Submitted
// -------------------------------------------------------------------
test("3. Request changes -> revise -> new version", async ({ page }) => {
  const title = `Revise Test ${RUN_ID}`;
  await page.goto("/");
  await setRole(page, "submitter", `Sub3-${RUN_ID}`);

  const url = await submitAdAndGetUrl(
    page,
    title,
    `Get a personal loan at competitive rates.
ClearPath Financial NMLS #123456`
  );
  await snap(page, "03a-fresh-submission");

  // Switch to reviewer and request changes
  await setRole(page, "reviewer", `Rev3-${RUN_ID}`);
  await page.goto(url);
  await page.waitForLoadState("networkidle");
  await snap(page, "03b-reviewer-view");

  const requestChangesBtn = page.locator('button:has-text("Request Changes")');
  if (await requestChangesBtn.isVisible()) {
    await requestChangesBtn.click();
    await page.waitForLoadState("networkidle");
    await snap(page, "03c-changes-requested");

    const statusBadge = page.locator('span:has-text("Changes Requested")');
    await expect(statusBadge).toBeVisible();
  }

  // Switch to submitter and revise
  await setRole(page, "submitter", `Sub3-${RUN_ID}`);
  await page.goto(url);
  await page.waitForLoadState("networkidle");
  await snap(page, "03d-submitter-changes-requested");

  const revisionTextarea = page.locator('textarea[name="content"]');
  const revisionVisible = await revisionTextarea.isVisible();
  console.log(`Revision form visible for submitter after changes_requested: ${revisionVisible}`);

  if (revisionVisible) {
    await revisionTextarea.fill(
      `Get a personal loan at competitive rates.
Terms apply. All loans subject to credit approval.
ClearPath Financial NMLS #123456`
    );
    await snap(page, "03e-revision-filled");
    await page.click('button:has-text("Submit Revision")');

    // Wait for redirect or reload
    try {
      await page.waitForURL(/\/submissions\/[0-9a-f]{8}-/, { timeout: 90000 });
    } catch {
      await page.goto(url);
    }
    await page.waitForLoadState("networkidle");
    await snap(page, "03f-revision-submitted");

    // Assert Version 2 is visible
    const versionText = page.locator('h2:has-text("Version 2")');
    await expect(versionText).toBeVisible({ timeout: 5000 });

    // Assert status is Submitted (not Changes Requested)
    const statusSubmitted = page.locator('span:has-text("Submitted")');
    await expect(statusSubmitted).toBeVisible({ timeout: 5000 });
  }
});

// -------------------------------------------------------------------
// Test 4: Approve, then edit -> status resets to Submitted
// -------------------------------------------------------------------
test("4. Approve then edit resets status", async ({ page }) => {
  const title = `Approve Reset ${RUN_ID}`;
  await page.goto("/");
  await setRole(page, "submitter", `Sub4-${RUN_ID}`);

  const url = await submitAdAndGetUrl(
    page,
    title,
    `Check your personal loan rate today.
Terms and conditions apply. Subject to credit approval.
ClearPath Financial NMLS #123456`
  );
  await snap(page, "04a-clean-submission");

  // Switch to reviewer
  await setRole(page, "reviewer", `Rev4-${RUN_ID}`);
  await page.goto(url);
  await page.waitForLoadState("networkidle");
  await snap(page, "04b-reviewer-view");

  // Dismiss any open flags first
  let dismissCount = await page.locator('button:has-text("Dismiss")').count();
  while (dismissCount > 0) {
    const reasonInput = page.locator('input[name="reason"]').first();
    if (await reasonInput.isVisible()) {
      await reasonInput.fill("Not applicable for audit test");
      await page.locator('button:has-text("Dismiss")').first().click();
      await page.waitForLoadState("networkidle");
    }
    dismissCount = await page.locator('button:has-text("Dismiss")').count();
  }
  await snap(page, "04c-flags-dismissed");

  // Approve
  const approveBtn = page.locator('button:has-text("Approve")');
  if (await approveBtn.isVisible() && !(await approveBtn.isDisabled())) {
    await approveBtn.click();
    await page.waitForLoadState("networkidle");
    await snap(page, "04d-approved");

    const approvedBadge = page.locator('span:has-text("Approved")');
    await expect(approvedBadge).toBeVisible();

    // Now check if submitter can revise after approval
    await setRole(page, "submitter", `Sub4-${RUN_ID}`);
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    await snap(page, "04e-submitter-after-approval");

    const revisionForm = page.locator('textarea[name="content"]');
    const revisionVisible = await revisionForm.isVisible();
    console.log(`FINDING: Revision form visible after approval: ${revisionVisible}`);
    // The UI only shows revision form when status=changes_requested
    // So there's no way to edit after approval from the UI.
    // This is a UX finding: spec says "edit again -> status resets" but no UI path exists.
  }
});

// -------------------------------------------------------------------
// Test 5: Self-review blocked
// -------------------------------------------------------------------
test("5. Self-review blocked", async ({ page }) => {
  const title = `Self Review ${RUN_ID}`;
  const userName = `SelfUser-${RUN_ID}`;
  await page.goto("/");
  await setRole(page, "submitter", userName);

  const url = await submitAdAndGetUrl(
    page,
    title,
    `Simple personal loan ad. ClearPath NMLS #123456`
  );
  await snap(page, "05a-self-review-submission");

  // Switch to reviewer with SAME name
  await setRole(page, "reviewer", userName);
  await page.goto(url);
  await page.waitForLoadState("networkidle");
  await snap(page, "05b-self-review-as-reviewer");

  // Dismiss all flags first
  let dismissCount = await page.locator('button:has-text("Dismiss")').count();
  while (dismissCount > 0) {
    const reasonInput = page.locator('input[name="reason"]').first();
    if (await reasonInput.isVisible()) {
      await reasonInput.fill("Test dismiss");
      await page.locator('button:has-text("Dismiss")').first().click();
      await page.waitForLoadState("networkidle");
    }
    dismissCount = await page.locator('button:has-text("Dismiss")').count();
  }
  await snap(page, "05c-flags-cleared");

  // Try to approve
  const approveBtn = page.locator('button:has-text("Approve")');
  if (await approveBtn.isVisible() && !(await approveBtn.isDisabled())) {
    await approveBtn.click();
    await page.waitForLoadState("networkidle");
    await snap(page, "05d-self-review-result");

    // The server action throws "Reviewer cannot be the submitter"
    // Check: did it get approved? (should NOT)
    const approvedBadge = page.locator('span:has-text("Approved")');
    const wasApproved = await approvedBadge.isVisible().catch(() => false);
    console.log(`Self-review approved (should be false): ${wasApproved}`);

    // Check for error page or message
    const pageText = await page.textContent("body");
    const hasError = pageText?.includes("Reviewer cannot be the submitter") ||
                     pageText?.includes("error") ||
                     pageText?.includes("Error");
    console.log(`Error shown on page: ${hasError}`);
    console.log(`FINDING: Self-review ${wasApproved ? "NOT BLOCKED (BUG)" : "blocked"}`);
  }
});

// -------------------------------------------------------------------
// Test 6: Seeded prompt-injection ad
// -------------------------------------------------------------------
test("6. Prompt injection ad flagged", async ({ page }) => {
  await page.goto("/");
  await setRole(page, "reviewer", `Rev6-${RUN_ID}`);
  await page.reload();
  await page.waitForLoadState("networkidle");
  await snap(page, "06a-queue");

  // Find and click the injection ad
  const injectionLink = page.locator('a:has-text("Quick Cash SMS")');
  await expect(injectionLink).toBeVisible();
  await injectionLink.click();
  await page.waitForLoadState("networkidle");
  await snap(page, "06b-injection-ad-detail");

  // The injection ad must have open rule flags visible
  const openFlagsHeader = page.locator("text=Open Flags");
  await expect(openFlagsHeader).toBeVisible({ timeout: 5000 });

  // Must have rule-sourced flags (purple badges) in the open section
  const ruleBadges = page.locator("span.bg-purple-100");
  const ruleCount = await ruleBadges.count();
  console.log(`Injection ad — open rule flags: ${ruleCount}`);
  expect(ruleCount).toBeGreaterThan(0);

  // Must mention injection in the flag text
  const pageText = await page.textContent("body");
  expect(pageText).toContain("injection");

  await snap(page, "06c-injection-flags-detail");
});

// -------------------------------------------------------------------
// Test 7: Audit log completeness
// -------------------------------------------------------------------
test("7. Audit log completeness", async ({ page }) => {
  await page.goto("/");
  await setRole(page, "reviewer", `Rev7-${RUN_ID}`);
  await page.reload();

  const inReviewLink = page.locator('a:has-text("Personal Loan Holiday Promo")');
  await expect(inReviewLink).toBeVisible();
  await inReviewLink.click();
  await page.waitForLoadState("networkidle");
  await snap(page, "07a-in-review-detail");

  // Open audit log
  const auditSummary = page.locator('summary:has-text("Audit Log")');
  await auditSummary.click();
  await page.waitForTimeout(500);
  await snap(page, "07b-audit-log-expanded");

  const auditTable = page.locator("details table");
  const auditText = await auditTable.textContent();

  const expectedActions = [
    "submission_created",
    "flags_created",
    "flag_state_changed",
    "review_created",
    "version_created",
  ];
  for (const action of expectedActions) {
    const found = auditText?.includes(action);
    console.log(`Audit log contains '${action}': ${found}`);
  }

  // Check each audit row has an actor
  const actorCells = page.locator("details table tbody tr td:nth-child(2)");
  const actorCount = await actorCells.count();
  for (let i = 0; i < Math.min(actorCount, 5); i++) {
    const actor = await actorCells.nth(i).textContent();
    console.log(`Audit row ${i} actor: '${actor}'`);
    expect(actor?.trim()).not.toBe("");
  }

  await snap(page, "07c-audit-log-detail");
});

// -------------------------------------------------------------------
// Test 8: UX review
// -------------------------------------------------------------------
test("8. UX review for compliance reviewer", async ({ page }) => {
  // Queue as reviewer
  await page.goto("/");
  await setRole(page, "reviewer", `Rev8-${RUN_ID}`);
  await page.reload();
  await page.waitForLoadState("networkidle");
  await snap(page, "08a-reviewer-queue");

  const linkCount = await page.locator("table tbody tr").count();
  console.log(`Total submissions in queue: ${linkCount}`);

  // UX note: are there "Test Ad" entries from SQL tests polluting the queue?
  const testAdCount = await page.locator('a:has-text("Test Ad")').count();
  console.log(`FINDING: ${testAdCount} "Test Ad" entries visible in queue (leftover test data)`);

  // Check: can a reviewer access the submission form?
  await page.goto("/submissions/new");
  await page.waitForLoadState("networkidle");
  await snap(page, "08b-new-submission-as-reviewer");
  const formVisible = await page.locator('button:has-text("Submit for Review")').isVisible();
  console.log(`FINDING: Reviewer can access submission form: ${formVisible}`);

  // Check: is there a name input for the actor? Or just a default?
  // The nav shows the current role, but there's no way to set a custom name
  // except through the cookie directly
  const nameDisplay = await page.locator("nav span.text-sm.text-gray-500").textContent();
  console.log(`Nav shows actor name: '${nameDisplay}'`);

  // Visit a submission to check UX
  await page.goto("/");
  await page.reload();
  const firstLink = page.locator("table tbody a").first();
  if (await firstLink.isVisible()) {
    await firstLink.click();
    await page.waitForLoadState("networkidle");
    await snap(page, "08c-submission-detail-ux");
  }
});
