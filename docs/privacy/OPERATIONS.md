# DivZplit: privacy operations and outstanding launch requirements

This is an operating procedure, not a legal certification. Controller: Adrian
Roman, Romania; support@divzplit.com. Primary database region confirmed by the
owner's Supabase screenshot: eu-west-1, Ireland. Free service, advertising planned
but not installed. The owner has chosen to restrict registration to people aged 16 or older. No professional
postal address has been supplied. These facts do not establish complete compliance.

## Deploy the technical update

1. In the existing Supabase project's SQL Editor, execute all of
   `supabase/privacy-operations.sql`. It depends on the existing shopping,
   notifications and exchange-rate migrations. It does not erase accounts,
   expenses or confirmed payments. It creates a private self-export RPC and a
   service-only retention function.
2. Verify `select jobname, active from cron.job where
   jobname='divzplit-privacy-retention';`. If pg_cron is unavailable, arrange a
   trusted daily run of `select public.divzplit_privacy_retention();`; do not
   claim automatic expiry before the schedule is enabled and monitored.
3. Test account export with two test accounts in different groups. The exported
   account ID must match the signed-in user. The web client refuses a mismatched
   identity and reports a missing migration instead of inventing an export.
4. Never put service-role, SMTP, Resend, signing keys or private case records in
   frontend files, this repository, screenshots or chat.

## Requests: check the support inbox every working day

The account privacy section contains Contact and Download my account data only.
Contact opens the person's mail app addressed to support; they write and send
the request themselves. Assign a case reference on receipt; it is not proof of
identity. Gmail is the current mailbox, via Cloudflare forwarding.
Keep case records in a restricted location outside this public GitHub repository.

For each received request, record the received date, reference, account ID if
known, type, proportionate verification, calendar-month deadline, handler,
actions, response date, grounds for any retained information and planned review.
Acknowledge receipt promptly. Normally respond without undue delay and within
one calendar month; if an applicable complexity/volume extension is necessary,
notify the requester within the first month and explain why. Do not silently
restart the deadline, charge routinely, or request ID documents by default.

Verify using the signed-in account and a reply from its verified address where
adequate. A request ID, matching name, group invitation or screenshot alone is
not sufficient to disclose or erase a different person's account. For genuine
identity doubts, ask only for necessary information using a secure channel.
If the request is sent from a different address, resolve identity before disclosure.

Access/portability: the self-export covers account metadata, current shared
groups, history, payment requests, shopping, own notifications and preferences.
Receipt references are included; obtain actual receipt files separately if
requested. Provider logs, support correspondence, previous groups, backups and
other data not returned by this export require a separate scoped review. Never
send other users' private email, authentication secrets, private push keys or
unrelated group records. Protect exports in transit and limit link lifetime.

Correction: check the field, authoritative source and effects on other members.
A correction is not permission to arbitrarily change settled financial records.
Restriction/objection: record the scope and applicable basis, pause the relevant
optional processing as appropriate, and give a reasoned response. Manage push
permissions separately from contractual acceptance.

## Closing accounts and erasure: human review is required

There is no automatic erasure RPC. The UI says this explicitly. Do not promise
that sending an email instantly erases an account or cancels its debts.

1. Verify the requester; scope their account, group membership, owned groups,
   receipt images, shopping authorship, notifications, support mail and provider
   records. Use `ACCOUNT-REVIEW.sql` with a verified UUID in the admin SQL editor;
   it is read-only. Do not run broad DELETE statements from an unverified email.
2. Address ownership and other members' rights before changing shared records.
   The database has real foreign-key references to auth.users from group owners,
   members, shopping authors and payment participants; blindly deleting the Auth
   user can fail or corrupt the application's meaning.
3. Classify what should be erased, what can be de-identified and what must be
   retained on a documented applicable legal basis. Review names, free text,
   before/after history, receipt images and exported/support copies, not just
   auth metadata. An opaque UUID alone is not a guarantee of anonymization.
4. Prepare a targeted change plan with a recoverable, access-controlled backup,
   required successor approval and a check that unrelated balances are unchanged.
   Apply in the administrator environment only after the plan is reviewed.
   Remove/revoke relevant auth sessions, identities and subscriptions as applicable.
5. Verify loss of access, the requested removals and unaffected group balances.
   Record any necessary exceptions and when they will be reviewed. Explain the
   result to the user. Backups follow provider schedules; do not promise immediate
   deletion from every backup. Reapply deletions if a backup is restored.

If you cannot perform the plan safely, obtain qualified database/privacy help;
acknowledge the case and comply with applicable response deadlines. The existence
of this procedure does not mean past erasure requests have been processed.

## Retention decisions and monitoring

Once the SQL job is enabled: notifications older than 90 days; terminal push
jobs older than 7 days (using their last scheduled attempt); disabled subscriptions
not updated for 30 days; FX quotes older than 2 days; invitations expired for over
30 days. Daily cleanup can add up to one run interval to these operational targets.
Active expenses, payments, history and accounts are not purged by that function.
Review their continued necessity on verified closure requests and inactive-service
reviews; do not retain indefinitely merely because storage is available.

Support-case target: remove unnecessary attachments promptly after the case is
resolved; review closed cases after 12 months, retaining only proportionate
records needed for an identified obligation or dispute. Do not present this as
an automatic Gmail rule; configure and perform the review. Supabase/Resend/GitHub/
Google log and backup periods depend on actual plans and contracts and must be
verified. Record those periods before promising exact expiry to users.

## Processor and transfer review: account owner actions

For each provider, document roles, purposes, data, location, subprocessors,
retention, security and the applicable transfer mechanism. Primary database EU
residency does not establish that every auth, support, email, log and backup
operation stays in the EU. Review and enter the applicable DPA/terms through the
actual accounts; this task does not accept contracts on the owner's behalf.

- Supabase DPA: https://supabase.com/legal/customer-resources/data-processing-addendum
- Supabase subprocessors: https://supabase.com/legal/customer-resources/subprocessor-list
- Resend DPA: https://resend.com/legal/dpa
- Google Cloud / Gmail support mailbox: confirm whether the actual account's
  contractual arrangements cover the planned processing; a consumer Google
  account is not automatically a business processor agreement.
- GitHub Pages, Cloudflare DNS/email forwarding and browser push services: assess
  their roles and published privacy/security/transfer terms for the features used.

Use MFA for Supabase, GitHub, Cloudflare, Resend and support/admin Google accounts.
Review project membership (the support Google account was shown as Owner), avoid
shared passwords, restrict recovery methods and regularly verify access rules.
RLS tests cannot prove the live project has all current migrations or secure
provider account configuration. Review actual production settings separately.

## Minimum registration age: 16

Registration is offered only to users who declare they are 16 or older. Under-16
selection stops the email/social registration flow; there is no guardian approval
route. The client records an age band, not date of birth. This is self-declaration,
not verified age assurance or a server-side anti-bypass control. Review reports
of underage accounts and assess proportionate age-assurance measures where needed.
Users aged 16-17 may still be minors and need the applicable protections, including
advertising restrictions. Other contractual-capacity rules may also apply.

## Advertising: planned, not activated

No ad SDK, pixels, fingerprinting or ad cookies have been introduced. Before
choosing a provider, review child-directed service requirements, consent and
age treatment, contracts, data flows and transfers. Do not serve profiling-based
advertising to minors where prohibited; contextual/no-tracking advertising still
needs a provider-specific review. Never send expense titles, receipt images,
group membership, balances or support requests to an advertising system.

Where optional tracking needs consent, load it only after valid permission;
provide an equally accessible reject option, granular choices and withdrawal.
Do not bundle advertising permission with account creation, terms or push access.
Do not put a decorative cookie banner over scripts that run before permission.

## Outstanding legal facts and review

A professional postal address is missing. Determine the applicability and required
identification under Romanian Law 365/2002 Art. 5, and business/fiscal obligations
for planned ad income, with a Romanian professional. Do not invent an address,
use the Supabase data-center location, assume an email is a postal address, or
publish a private residence without an informed decision by the owner.

English remains the default public document. Full Spanish and Romanian versions
are also available, with language links; app links select the current supported
language. Review the legal translations and child-directed explanations for the
actual audience. Translation alone cannot certify comprehension or compliance.

The version fields stored on signup/OAuth are user-editable Supabase metadata,
not an immutable legal audit trail and never an authorization/age-approval signal.
If enforceable evidence is needed, implement a server-owned acceptance event
store with an appropriate evidence/retention policy. Legal enforceability and
contractual capacity require jurisdiction-specific review.

## Incident procedure

Contain the incident, revoke compromised credentials, preserve minimal evidence,
identify affected data/users and assess risks. Log all personal-data breaches.
Where required, notify ANSPDCP without undue delay and, where feasible, within
72 hours of becoming aware; explain delays. Notify affected users where high
risk requires it. Document the assessment even when notification is not required.
Do not report harmless events as breaches automatically or assume encryption
eliminates every notification duty.

## Official sources used for this review

- Romanian Law 365/2002, including Article 5 identification requirements:
  https://legislatie.just.ro/Public/DetaliiDocumentAfis/288595
- European Commission, response to requests:
  https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/dealing-requests-individuals_en
- European Commission, safeguards for children (parental consent depends on the
  applicable age threshold and legal basis):
  https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/legal-grounds-processing-data/are-there-any-specific-safeguards-data-about-children_en
- EDPB small-business guide, transparency and rights:
  https://www.edpb.europa.eu/sme/be-compliant/respect-individuals-rights_en
- EDPB controller/processor guidance published by ANSPDCP:
  https://www.dataprotection.ro/servlet/ViewDocument?id=2486
