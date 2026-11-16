# Search result language and favicon

Prepared on `feature/search-branding-96`; the user approved production publication after requesting a brand-only title. The existing public result shown by the user has the older app title, so recrawling is needed even after the source changes are published.

The static landing now starts in English, including its description, headings, default screenshots, Open Graph metadata and language selector. The title is exactly `DivZplit` in all three languages, including after client-side language switching; the existing descriptions remain localized for visitors. The existing JavaScript still adapts all copy/screenshots to Spanish, English or Romanian according to the visitor's preference. App code, authentication, Supabase, startup/dock effects, layout and CSS are unchanged.

The homepage declares the existing DZ logo as a stable `image/png` favicon at `/assets/app-icon-192.png`, with explicit square 192×192 dimensions. No new logo was drawn. PNG is among the favicon formats in Google's current documentation; the previous SVG declaration is replaced. The asset already exists and is crawlable under the current robots policy.

Google independently selects search titles/snippets and whether to show a favicon. Neither an instant change nor an exact appearance is guaranteed. After approved publication, the owner can request indexing of `https://divzplit.com/` using Search Console's URL Inspection tool. No Search Console action has been performed here.

Reference: https://developers.google.com/search/docs/appearance/favicon-in-search

Validation: English static content without JavaScript, square PNG asset, and the existing three-language landing browser suite; app/domain source invariants and generator syntax checks. The private review copy is excluded from indexing and does not connect to Supabase.
