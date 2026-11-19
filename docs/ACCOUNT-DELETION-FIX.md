# Account deletion blocked by permissions — 19 November 2026

The reported app text (“You do not have access to this group”) is a generic client mapping of HTTP 403. It does not by itself prove a group-membership failure. No production account deletion or migration was executed in this work; the exact deployed RPC/grants must be checked in the user's project.

## Reproduced defect and correction

The repository's old deletion RPC issued DELETE FROM storage.objects while removing solo groups. A local PostgreSQL fixture with managed-style Storage DELETE protection reproduces the failure (“Direct deletion from storage tables is not allowed. Use the Storage API instead.” / SQLSTATE 42501). The whole transaction rolls back, and the client converted the 403 into a misleading group-access message.

The updated RPC preserves the same name and own-account auth.uid authorization. It removes no Storage metadata directly. Receipt-bearing solo-group prefixes stay pending in nexo_deleted_groups (cleaned_at NULL); empty prefixes can be marked clean. Pending receipt-cleanup group count is returned, without claiming that file bytes were erased.

Other fixes in that same account-close transaction: remove active memberships while retaining historical document identifiers; transfer shared-group ownership; cancel pending payment requests without confirming a payment or changing the shared expense/payment ledger. Group access rejects the deleted metadata marker, and a membership trigger prevents an old JWT from rejoining/creating a group. Existing anonymous/other-account controls remain. Existing JWTs can remain structurally valid until expiration; this is not a claim of provider-wide instantaneous token invalidation.

Auth identity/session/refresh-token cleanup and email/profile anonymization keep the existing architecture. The technical auth.users UUID row remains anonymized/banned because shared payment/author/history references depend on it. Its original email is freed; creating a new account with the same email must not restore the old account or groups. This is account closure/pseudonymization, not certification of complete personal-data erasure.

Client 403 errors from this RPC now mention account deletion and retain a safe server code, rather than reporting a group failure. A failed RPC retains the local account/session and never reports success.

## Apply the backend correction (project administrator)

1. Merge/review this PR. In the existing Supabase project, open SQL Editor as the normal project postgres/admin role.
2. Optionally run **supabase/account-deletion-diagnostics.sql** first. It is read-only and returns function/grant/trigger/FK metadata, not account contents. On the old deployment, contains_blocked_storage_delete may be true; updated_cleanup_behavior should become true after the update.
3. Paste and run the complete updated **supabase/account-deletion.sql**. It creates/replaces the RPC/access guard/trigger and grants authenticated execution; it does not call the deletion RPC or select an account to erase. Do not run the entire schema.sql just for this fix, and do not disable RLS or grant clients access to auth/storage tables.
4. Re-run the diagnostic. Confirm the function is security definer, authenticated can execute, its owner can read/update auth.users, contains_blocked_storage_delete=false and updated_cleanup_behavior=true.
5. Test only an account you intend to close. Sign in to that same account, use Account → Delete account and type its email. Confirm its session ends and its original email/profile disappear while another member's shared balances remain correct. No admin key belongs in the app or chat.
6. If it still fails, use Supabase API/Postgres logs to obtain the RPC HTTP/SQLSTATE/message and the read-only diagnostic output (without tokens/keys/private account records). Review missing auth-schema permissions or unrelated project triggers; do not bypass them blindly. A 401 requires reauthentication, not a grant to all users.

The backend fix works with the existing Android AAB because the RPC contract is unchanged. The clearer shared-client error text reaches web after publication and Android when included in a later native build; a new AAB is not required to remove this server-side blocker.

## Why direct Authentication → Users deletion can fail

Shared groups, payment participants, shopping authors and archives reference auth.users. A direct hard delete can correctly fail its foreign-key checks. Do not add ON DELETE CASCADE indiscriminately: it can remove another person's financial/shared records. Use the account workflow to transfer/anonymize/close; expect the technical deleted+UUID@users.divzplit.invalid row to remain where references need it. Hard deletion of that technical row requires a separate, account-scoped data-retention/migration review.

## Storage cleanup remaining

After a successful close, query pending tombstones in a restricted admin context, scope to the intended account/groups and remove only their private receipt prefixes through Supabase Storage UI/API. Verify the files are removed, then mark only empty verified prefixes complete; do not use SQL DELETE on storage.objects and do not mark pending files erased prematurely. Shared-group receipts/descriptions/history can still contain personal information and require a scoped review under the existing privacy operations guide. No unattended file-erasure worker is introduced by this fix.

## Validation

The new isolated account-deletion database test exercises a real solo receipt with a Storage DELETE guard; shared ledger/owner preservation; membership access removal and old-token rejoin/create rejection; pending cancellation; unrelated-account isolation; session/identity/refresh cleanup; original-email reuse; repeat requests; anonymous/no-UID rejection; and last-active-member deletion. The full database command now includes it, preventing the old gap where privacy tests only exercised export/retention.

No live database/admin connector is available in this session. All database writes/deletions in this task are confined to a disposable, network-disabled PostgreSQL container with fictional accounts. Production rollout and intentional account deletion remain administrator/user actions.


Completed checks: all 12 suites in the updated test:database command and the native-push database suite passed on the isolated container. The final deletion regression additionally passes legacy deleted memberships, new-group/rejoin rejection, email reuse and repeat installation. Shared/web tests, syntax checks and the 119-test native suite passed during this change; the final account-specific permission-message path was rechecked with six client/privacy tests and the actual website in ES/EN/RO. The wrong email makes no RPC, and a simulated 403 leaves the account/form present with a localized account-specific message and SQLSTATE. The read-only diagnostic was also executed locally: function installed/definer/grant/owner permissions true, blocked Storage DELETE false, updated cleanup marker true. No production deployment has been performed.
