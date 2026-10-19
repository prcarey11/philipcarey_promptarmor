# Research Notes

Background research done before building, to understand how marketing compliance review works at a consumer lender. The conclusions and product decisions are in the [README](../README.md).

## 1. What a marketing compliance reviewer does

**Intake.** The ad arrives through a submission process. The submitter (an in-house marketer, agency, or affiliate) provides the draft creative, channel, target audience and geography, run dates, and the product being promoted. The reviewer first checks that the submission is complete. Common gaps include a missing landing page, a missing rate sheet, or a missing final script.

**Risk classification.** The reviewer classifies the piece. For example, a mortgage ad quoting a rate is high risk. The rating decides how deep the review goes, whether legal or fair lending specialists need to see it, and the expected turnaround.

**Gathering context.** Before reading closely, the reviewer pulls what the ad will be checked against:
- the product's actual terms
- applicable state rules
- previously approved versions
- the full consumer path: where the ad links, what the landing page says, and what the application flow shows

**Substantive review.** This is the core of the job. The reviewer reads the ad as a consumer would, then checks it against the rules that apply:

- **Accuracy and substantiation.** Every claim needs support. A quoted rate must be one that is actually available, and "no fees" must be literally true.
- **Product disclosure rules.** For credit products, Regulation Z (Truth in Lending) is the main one.
  - Certain "trigger terms," such as a payment amount or down payment, require additional disclosures like the APR and repayment terms.
  - A stated rate must be expressed as an APR, and no other rate may be more prominent than the APR.
  - Mortgage ads have extra restrictions, such as how the word "fixed" can be used.
- **UDAAP (unfair, deceptive, or abusive acts or practices).** The reviewer judges the net impression, not just technical compliance:
  - Does the fine print contradict the headline?
  - Is a disclosure too small, too fast, or too buried to notice?
  - Would an average consumer be misled?
- **Fair lending.** Under ECOA/Reg B and the Fair Housing Act, an ad can't discourage applicants on a prohibited basis. Reviewers check imagery, language, model diversity, and targeting: which zip codes or audiences will see a digital ad, and whether protected groups are excluded.
- **Required identifiers.** Mortgage ads typically need an Equal Housing Lender or Equal Housing Opportunity logo or statement and an NMLS ID. Bank ads need the Member FDIC or NCUA statement where required.
- **Channel rules.**
  - Email: CAN-SPAM requirements.
  - Texts and calls: TCPA consent rules.
  - Social media: platform policies and character limits.
  - Radio and TV: disclosures must be audible or legible at real speed.
- **Third-party and IP issues.** Testimonials must be genuine and typical, or properly qualified. Images and music need usage rights.

**Redlines and feedback.** The reviewer marks up the piece with required and suggested changes and explains the rule behind each one. Good reviewers propose fixes ("change 'low rates' to 'competitive rates'") instead of only flagging problems. Marketing revises, and a piece may go through several rounds.

**Escalation.** Novel claims go to legal, the fair lending team, or the compliance officer.

**Final check and approval.** The reviewer compares the final version against the last approved draft, because last-minute changes are a classic source of violations, and confirms every disclosure survived into the final piece. Approval is usually recorded with a tracking number, sometimes printed on the piece. Conditions such as an expiration date or "only valid while the rate is X" may be attached.

**Record keeping.** The final ad, approval, substantiation, and run dates are archived. Regulations require retention. For example, Reg Z and Reg N (the Mortgage Acts and Practices Advertising rule) generally require keeping mortgage advertising records for about two years.

**Ongoing monitoring.** After launch, reviewers watch for rate changes that make a live ad inaccurate, enforce expiration dates, and spot-check live placements.

## 2. Asset types

Landing pages, emails, social posts, display ads, affiliate pages, SMS, and broadcast (radio/TV). Each has its own failure points, which is part of why review volume is hard to scale.

## 3. What a good review comment looks like

Well-run programs expect every comment to have four parts:

1. **Location:** where in the asset, such as "headline," "frame 2," or "0:14 in the radio spot."
2. **Problem:** stated plainly.
3. **Rule or reason:** a regulation citation or internal policy.
4. **Fix:** what would make it approvable.

**Example comment:**

> **Headline: REQUIRED.** "$1,650/month" is a Reg Z trigger term (payment amount, §1026.24(d)). Add the down payment, terms of repayment, and APR. Because this is a first-lien mortgage, also state that payments don't include taxes and insurance. Place these near the payment, not in the footer.

**Real-world example:** a bank mailed a prescreened fixed-rate mortgage offer showing both an interest rate and an APR, with the interest rate in a larger, more prominent font. That violated Reg Z, because the interest rate can't be more conspicuous than the APR.

## 4. Why Excel and email are slow

- **Version confusion.** The ad lives as an attachment, so every round creates a new file (`Mortgage_Banner_v3_FINAL_revised_JS.pdf`). The reviewer approves v4 while the agency is already sending v5 to the ad server. At final check, the reviewer has to diff two PDFs by hand, and last-minute edits slip through. This is the most common way an unapproved change reaches production.
- **Feedback scattered across channels.** Comments arrive in a marked-up PDF, an email reply, a Teams message, and a hallway conversation. Legal replies-all with a contradicting note, and marketing doesn't know which comment wins. No one can see whether comment 6 from round 1 was addressed in round 2, so the reviewer re-reads the whole piece every round.
- **A tracker that's always out of date.** The Excel log depends on someone manually updating status, reviewer, dates, and approval number. It's never current, so marketing emails "any update on this?", which adds more email.
  - Managers can't see who's overloaded, what's aging, or which campaigns are at risk, so prioritization goes to whoever complains loudest.
  - Shared workbooks get locked, overwritten, or forked.
- **No reuse and no audit trail.** Every ad is reviewed from scratch, even when 80% of it is a disclosure block approved fifty times. When an examiner asks for evidence that a specific ad was approved, someone digs through inboxes to reconstruct the history. That's slow and often incomplete.

## 5. Affiliates

The lender is legally responsible for what affiliates publish on its behalf. So affiliates are submitters in the system, held to the same review as in-house marketing.

## 6. Mechanical vs. judgment checks

- **Mechanical** (deterministic, rule-based):
  - trigger terms present without their required disclosures
  - missing required identifiers
  - quoted rates that don't match the rate sheet
  - expired approvals
- **Judgment** (LLM-assisted, human-decided):
  - net impression
  - whether fine print contradicts the headline
  - whether a claim is misleading to an average consumer
- **Out of scope for this build:** prominence and readability judgments that depend on visual or audio rendering, such as font size or disclosure speed.
