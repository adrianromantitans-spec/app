# DivZplit native Android acceptance

Use the `1.2.0-native.4` / code 10 AAB only in a restricted test track. Confirm that its code is higher than all releases already in Play. The candidate keeps `com.divzplit.app` and the existing signing identity, so uploading it into the existing track will offer an update to that track's eligible testers. An AAB cannot be installed by tapping it: upload it to Play's test track and install from its tester link. Do not roll out to production before these checks.

The implementation gaps listed in PRs #11–13 now have native flows. The checklist below verifies them on hardware; it is not a list of work the user must implement. No new Firebase project, Supabase migration, signing key or website deployment is required for this source update. Existing backend capabilities used by the web app must remain enabled. No physical device is connected to the build environment.

## Accounts and links

- Upgrade a Play-installed test copy; expect native sign-in again and retain all server data. Verify Google and, if enabled, Apple return from the external secure browser into the app. Ordinary application screens must remain native.
- Register an eligible test account with explicit terms consent. Confirm its email and sign in explicitly; a session supplied in a URL must never switch accounts.
- Recover with an email code and with the stored PKCE link. Before setting and confirming a password, no groups should appear. After changing it, sign in with the new password. Try cancellation, expired links and resend.
- Sign out and sign into a second test account. Previous account groups, history, image selections and inbox entries must not reappear. Check session expiry and app restart.

## Groups, expenses and tickets

- Create every group type, optional budget and date range; edit details as owner. Invalid dates, reversed ranges, currency changes after transactions and stale form versions must be rejected. View owner/member roles, invite/copy/join/revoke links and test a nonowner.
- Delete a disposable group using its exact name. Check that its data disappears for all members, without implying that debts were paid. Use only disposable test data.
- Add/edit/delete expenses with each split mode, currency and payer. Switch split modes and review each person's share. Compare balances with the web app; foreign expenses must not be editable by an unauthorized member.
- Choose/cancel a photo, capture/cancel a camera image, rotate and crop. Read a clear Spanish/English/Romanian receipt, explicitly confirm selected OCR fields, and verify currency mismatch handling. Inspect the stored image from another authorized group member. Test large, blurred, transparent and rotated photos plus unsupported formats.
- Interrupt upload/save connectivity and retry. Only one financial expense should appear. Replacing/removing an image must not remove the old photo before the edited expense is confirmed.
- Create weekly/monthly/yearly series including a month-end anchor. Confirm generated dates, no copied receipt in occurrences, source edits, stop, individual occurrence deletion and source deletion. Past occurrences must remain.

## Collaboration, money and activity

- Create/edit/delete tasks and polls, assignments, important flags, deadlines and reminders using the native dialogs. Preserve poll options/votes when editing and task completion state; reject voting after the deadline. Verify reminder timezone, backend scheduling, consent and throttles with another account.
- Add/edit/check/delete shopping items; verify owner-only clearing and linked-item locks. Create an expense from bought items, explicitly reviewing amount/payer/split. Test concurrent checkout by two members and a lost network response: the existing server transaction must prevent duplicates.
- Compare basic and simplified settlement plans. Pending requests must reduce suggestions while actual balances remain unchanged. Confirm/reject as receiver and cancel as sender. Test a second account, stale versions, lost responses and navigation while a request completes.
- Fetch conversion quotes for EUR and non-EUR pairs, inspect source/date, let a quote expire and change the selected target while confirmation is open. The app must require another review rather than silently use a new quote. Amounts remain integer minor units.
- Check activity charts, expense filters, before/after history details and pagination. Owner-only history deletion, pending-request cancellation and repayment archiving must not erase the underlying expenses/balances.

## Notifications and Android UX

- Enable/deny device notifications; change categories and mute a group. Test foreground/background/killed-app, token rotation, reboot, logout and another account. No previous-account message should be shown.
- Open a current and an older inbox alert; inspect detail before navigating to the correct group's expenses/tasks/polls/shopping/activity. Test deleted groups, read-all, clear and pagination.
- Compare the intro and purple/white UI with the reference, mandatory Android splash transition, back handling, keyboard, rotation, larger fonts, TalkBack, reduced motion and offline/error messages. Check camera/crop cancellation and date/time dialog cancellation.
- Test physical 60 Hz and 120 Hz devices and a 16 KB page-size Android device. Static compilation/ELF checks do not establish runtime smoothness or compatibility.

Only after acceptance should the tested native release replace the published wrapper. Record device models, Android/WebView/browser versions used for external authentication, scenario results and any failures. Keep sensitive tokens, receipt images and account data out of public issue reports.

## Design restoration acceptance (code 11)

- Upgrade from code 10 through the same Google Play test track; verify session and groups remain intact.
- Compare with the current mobile website: purple Z/period, welcome scene, login/Google entry, compact home, photo-covered plans, expense detail/editor, activity, account, tasks, polls and shopping.
- Check the system splash → unchanged-timing native opening port → header handoff on cold and warm launch, reduced motion, tap-to-skip and Back. Compare motion with the original website; browser previews are not Android acceptance.
- Open and cancel group/currency/payer/split/assignee choice dialogs. Change a selection and verify the form reflects it.
- Check long group/member names, ES/EN/RO, 320–430 dp widths, large system text, keyboard input and system navigation bars. Verify sheets and the floating dock remain usable.
- In tasks, tap the assignee/avatar for edit/reminder/delete actions; verify owner/creator permissions still apply. Test shop checkboxes and existing checkout confirmation.

## Startup hotfix acceptance (code 12)

- Update code 11 to code 12 through Google Play without uninstalling or clearing data. Verify existing sign-in/groups remain available.
- Cold-start signed in: let the opening finish without touching the screen; verify the home page remains open and usable. Repeat after force-stop.
- Cold-start signed out: verify the full opening reaches welcome and login remains usable.
- Repeat with tap-to-skip, Back, reduced motion and a foreground/background transition during opening. Confirm no crash or frozen curtain.
- Compare opening layout/motion with code 11/the website; opacity, transforms, font sizes, colors and original durations should remain the same.
- If the device still closes the app, capture the fatal exception from Android Logcat or the corresponding Google Play Android vitals crash report; the host-free Animated test does not replace runtime diagnosis.
