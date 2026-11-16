# DivZplit privacy operations — unpublished review, 16 November 2026

Operator currently identified in the app: Adrian Roman, an individual based in
Romania; support@divzplit.com. The owner confirms no company, no current ads or
paid features, Google Play first and Apple App Store later. Future ads, a one-time
ad-removal purchase and possible premium features are plans, not active services.
A public contact address and intended launch territories still need confirmation.
This document is an operating procedure, not a compliance certification.

## Evidence and limits

The source reviewed is based on commit 1862509. Draft edits are on the review branch
`draft/legal-help-review-2026-11-16`; the live site has not been changed. Code is evidence
of intended behavior, not proof that a migration or scheduled job is live.

Supabase MCP is configured with OAuth and read-only access for project
xvtqmmpufvmyuokpmjvf. On 16 November its endpoint rejected inspection from this
environment with HTTP 403 / Cloudflare error 1010. No live migration, job, backup
or region verification was possible. Do not describe configuration/authentication
alone as a successful administrative audit. Do not retry a denied access path.

Previous audit notes identify Ireland (eu-west-1) from an owner screenshot,
Supabase, GitHub Pages, Resend, Google and Cloudflare. Confirm actual settings and
contracts in the provider accounts before release. No private records or secrets
belong in this repository.

## Requests and complaints

Check support@divzplit.com each working day and assign a responsible handler and
backup. Contact opens the user's mail app; it does not submit a ticket until they
send the message. Store case records in a restricted location outside this public
repository. Record receipt date, case reference, account identifier where needed,
request scope, verification, deadline, handler, actions, response, retention grounds
and review date. Avoid collecting identity documents by default.

Respond without undue delay and normally within one month of receipt. Where an
extension is legally available because of complexity or number of requests,
explain the extension and reasons within that first month. Verification must be
proportionate and must not silently restart the deadline. Review applicable
exceptions individually and provide reasons and complaint routes where required.

Self-export uses `divzplit_privacy_export()` and covers the authenticated account,
accessible groups, history, payment requests, shopping, own notifications and
preferences. The client rejects a response for a different account. Missing
function support must result in an honest error and a support route. Receipt
references do not supply image files. Review requested receipt images, provider
logs, support mail, previous groups and other data separately, protecting other
people's information. Do not send authentication secrets or private push keys.

Correction, objection and restriction require a scoped review of the data, legal
basis and effects on other members. A corrected record must preserve the meaning
of confirmed payments. Advertising and notification choices must remain separate
from contractual acceptance.

## Account deletion: self-service plus review of remaining data

The app contains a self-service route in Account → Delete account and on
`https://divzplit.com/delete-account/`. The backend implementation is
`supabase/account-deletion.sql`. A missing function or failed call must never be
reported as successful deletion. Verify deployment and test using authorized test
accounts before relying on the public instructions for a store submission.

The current SQL disables the old auth account, clears its profile and identities,
revokes sessions, removes notifications and subscriptions, changes displayed member
and history names to `Cuenta eliminada`, transfers shared-group ownership and
removes groups with no other member. A technical auth identifier remains to keep
ledger references coherent. It is pseudonymization, not proof of anonymity.
Removing the old identity does not establish a permanent ban on registering a new
account with the same email. Do not promise that it does.

Review these implementation limits before release:

- Descriptions, history payloads, receipts and other shared free text may still
  identify the person. Review them for a wider erasure request and justify any
  necessary retention; retaining balances does not justify every attachment.
- The current SQL directly deletes `storage.objects` rows. Supabase requires its
  Storage API to remove underlying files; deleting metadata alone is insufficient
  and can orphan files. Implement and verify an authorized Storage API cleanup
  workflow before claiming receipt-file erasure. Do not mark a cleanup complete
  merely because the row disappeared.
- Verify that existing access tokens lose the relevant access within the intended
  window after session revocation. Do not assume deleting refresh tokens instantly
  invalidates every previously issued JWT.
- Check memberships, history, payment participants, shopping authorship, push jobs,
  provider records and copied data. Confirm the account cannot authenticate and
  unrelated balances and other members' access remain correct.
- Backups and logs follow actual provider settings. Establish a restoration
  process that reapplies deletions and restricts restored data before reuse.

For a broader erasure request, verify the requester, use a read-only inventory
such as `ACCOUNT-REVIEW.sql`, classify erase/de-identify/retain outcomes and apply
only a reviewed, targeted plan. Account deletion does not cancel debts. Explain
remaining data, the basis and review criteria to the requester. Copies other users
already downloaded may require separate action by those users.

## Retention: purpose-based policy and operational verification

A shared-expense app still processes personal data and needs storage limits or
clear criteria. Do not retain everything indefinitely because the service is free
or deals with expenses. The public draft uses purpose-based criteria: active
account service, continuing group use, a specific obligation or an identified
dispute. Periodically review data that is no longer needed and act on verified
requests. The owner has not adopted exact periods for all categories.

`supabase/privacy-operations.sql` proposes cleanup of notifications older than
90 days, terminal push jobs after 7 days, disabled subscriptions after 30 days,
FX quotes after 2 days and invitations expired for over 30 days. Those thresholds
are code defaults, not evidence that cleanup is deployed, running or owner-approved.
They do not purge active accounts, expenses, payment records, history or receipts.
Do not put automatic expiry promises in public text until implementation and
monitoring have been verified.

Before activation, approve the targets, inspect the deployed function, confirm an
active daily `divzplit-privacy-retention` job, review recent success/failure results
without disclosing user data, and assign failure monitoring. Do not execute the
retention function merely to audit it; execution deletes data. If pg_cron is
unavailable, arrange a trusted alternative. Read-only access cannot install or
repair jobs. Decide a review cadence for inactive groups, support correspondence
and disputes. Provider log and backup periods must come from actual plans/settings.

## Providers, transfers and security

For Supabase, GitHub Pages, Resend, Cloudflare, the support Google mailbox and push
services, record roles, data, purposes, locations, subprocessors, retention and the
applicable transfer safeguards. An Irish primary database does not establish that
all authentication, email, support, logs and backups stay in the EU. Review and
enter applicable agreements in the actual accounts; no agreement is accepted by
this draft. Check whether the support mailbox's actual account arrangement is
suitable for business processing. Confirm Resend and Cloudflare tracking settings.

Use MFA, individual administrator accounts, least privilege and protected recovery
methods. Review production membership, storage access and RLS policies. Local
fixtures and source tests cannot prove production access controls are deployed.
Acceptance/age metadata currently lives in user-editable Supabase metadata; it is
not an immutable legal event log and must never authorize privileged actions.
Registration uses a self-declared age band, not independent age verification.

## Google Play first; Apple later; future monetization

Validate working account creation, recovery, self-service account deletion and the
public deletion URL before a Play submission. Complete Data safety, target-audience,
content-rating and ads declarations for actual released behavior, including shared
user content and receipts. A content rating does not change the 16+ account policy.
Do not claim Apple publication or Apple sign-in where it is not enabled. Review
Apple privacy disclosures and in-app deletion before its later submission.

Ads and purchases require a separate implementation/release review. Identify the
ad provider and data flow, protect users aged 16–17, implement any required choices
before loading tracking, and update public disclosures and store declarations.
Never send receipt images, expense details or group membership to an ad system.
A one-time ad-removal purchase is not a subscription. Before sale, explain price,
features, restoration, payment route and applicable refund/withdrawal rights, using
the relevant store billing rules. Do not add recurring billing language by default.

## Incidents

Assign a handler, secure compromised access, contain the incident and preserve
minimal evidence. Record personal-data breaches and assess risk. Notify the
competent authority where required, without undue delay and where feasible within
72 hours of awareness; document delays. Notify affected people where the high-risk
threshold applies. Record the assessment when notification is not required.

## Sources for release review

- GDPR, especially Articles 5, 6, 12–22, 28, 32–34 and 44–49:
  https://eur-lex.europa.eu/eli/reg/2016/679/oj
- European Commission, processing principles and retention:
  https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/principles-gdpr_en
- Romanian Law 365/2002, Article 5 provider identification:
  https://legislatie.just.ro/Public/DetaliiDocumentAfis/288595
- Romanian supervisory authority: https://www.dataprotection.ro/
- Supabase Storage metadata is read-only; use the Storage API for deletion:
  https://supabase.com/docs/guides/storage/schema/design
- Supabase DPA:
  https://supabase.com/legal/customer-resources/data-processing-addendum
- Resend DPA: https://resend.com/legal/dpa
- Google Play account deletion:
  https://support.google.com/googleplay/android-developer/answer/13327111
- Google Play Data safety:
  https://support.google.com/googleplay/android-developer/answer/10787469
- Apple account deletion:
  https://developer.apple.com/support/offering-account-deletion-in-your-app/

A public contact address and any applicable business/fiscal identification remain
unresolved. Not having a company does not remove individual operator obligations.
Confirm required disclosure for the intended territories without inventing an
address or publishing a private residence without the owner's informed decision.

## Transactional email follow-up — 16 November 2026

Verification and requested recovery emails are service messages, kept free of
promotions. No marketing permission or marketing unsubscribe link is required for
that limited content; assess re-engagement or promotional emails separately before
sending. Use the email guide for a current DNS snapshot and production checks:
[AUTH-EMAILS](../AUTH-EMAILS.md). SPF and a DKIM key are publicly present; DMARC is
`p=none`. Record presence alone is not a delivered-message authentication test.
Do not change DNS without reconciling the actual sending and forwarding services.

Resend's current public documentation states US customer-data storage and primary
processing, even with an EU sending region, and SCCs in its DPA. It also states
that its DPA applies to every account; download the actual account copy rather
than assuming a separate countersignature is always needed. Confirm the plan and
tracking settings. The owner confirms Confirm email is enabled and OTP expiry is
3,600 seconds (one hour), and reports the remaining email/auth checks are handled.
Classify these results as owner reported; they were not independently tested here.
Retest expiry, single use and delivery after relevant configuration changes. This
does not close the separate account-deletion and storage-cleanup review. No
provider settings or templates have been changed by these source edits.
