# Revenue implementation and operation

Current contract: 2026-10-08. **Zero operator spend on provider subscriptions before launch; customers may buy subscriptions and posting packages.** Payment transaction fees are deducted from revenue. Older statements that every customer must remain free or live charging is permanently blocked are superseded. No paid provider purchase or hosting upgrade was made.

## Products and access

| Product ID | Price in INR | Delivery |
|---|---:|---|
| candidate_pro | ₹299/month | Candidate Pro limits; featured priority only with discoverable, non-anonymous candidate consent |
| recruiter_starter | ₹999/month | Starter recruiter limits and eligible database access |
| recruiter_growth | ₹2,499/month | Growth recruiter limits and eligible database access |
| recruiter_enterprise | ₹5,999/month | Enterprise recruiter limits and eligible database access |
| posting_single | ₹499 | 1 first-publication credit |
| posting_five | ₹1,999 | 5 first-publication credits |
| posting_twenty | ₹6,999 | 20 first-publication credits |

The public `billing_products` catalog stores integer paise and INR. Provider plans must match the exact amount, monthly period and currency. Existing subscriptions request 12 cycles; this is not a lifetime mandate. Free account limits remain available. Effective access selects an active, unexpired **live** paid period, then any valid complimentary pilot assignment, then free limits. Test grants never unlock real paid access. Feature eligibility still requires company verification, ownership and candidate privacy consent.

`billing_policy.paid_access=false` currently preserves existing free recruiter discovery/publication. A service-only operator change may enable paid recruiter gating **after** compliant commercial hosting, real checkout/renewal/refund/dispute acceptance and communication to users. Browser clients cannot alter this policy. Posting credits are spent atomically on first publication only; closing/reopening does not spend again. Refunding a previously spent package creates credit debt rather than restoring free posting.

## Configuration and activation

Configure server-only matching `BILLING_MODE=test|live`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` and the four `RAZORPAY_PLAN_*` names in [.env.example](../../.env.example). Test keys must start `rzp_test_`; live keys `rzp_live_`. Live additionally requires `BILLING_LIVE_ENABLED=true`. Missing/mismatched configuration disables checkout. The activation flag does not bypass merchant onboarding/KYC, bank settlement, provider plan verification or commercial hosting eligibility.

Create exact monthly provider plans, register `/api/billing/webhook` for applicable subscription, payment-link, payment, refund and `payment.dispute.*` events, and configure its signing secret. Never expose secrets or use live payment details during test acceptance. Complete test purchase, duplicate event replay, current-period renewal, cancellation, refund, dispute hold/win/loss and expired access tests before enabling live. Verify one genuine paid customer journey and settlement before claiming revenue operation.

[Razorpay pricing](https://razorpay.com/pricing/) documents transaction charges; no monthly gateway purchase was added. [Vercel Hobby](https://vercel.com/docs/plans/hobby) restricts commercial use. [Netlify Free](https://www.netlify.com/blog/introducing-netlify-free-plan/) supports commercial apps, with current [usage limits](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/). Its native [Next.js integration](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/) needs no new application dependency; deployment, scheduler replacement and worker runtime compatibility remain unverified until a hosting account is available. Do not activate revenue on the current Hobby deployment.

## Customer journey and API contracts

- `/plans` shows the stored subscription and package prices. It labels pending/test checkout accurately; `/billing` is authenticated.
- `GET /api/billing`: owner-filtered products, latest 50 intents/payments, mode-separated credits, effective plan and safe configuration readiness. No secrets, checkout lease token or raw provider body is returned. Errors: 401/403 account denial, 503 storage/setup failure.
- `POST /api/billing/checkout`: strict `{product}`; active account, same-origin bounded JSON, verified recruiter for recruiter products. Persists a price/credit snapshot before the native provider POST. Returns a validated hosted checkout URL. Missing configuration 503; pending/duplicate intent conflict prevents duplicate creation. The browser redirect/callback alone never grants access.
- `PATCH /api/billing`: strict `{id,action}`; actions `refresh`, `cancel`, `cancel_now`; `recover` also requires `{reference}`. Owner and configured mode must match. Invalid body 400, unknown/foreign intent 404, unbound resource 409, busy/provider reconciliation failure 503. The response is `{saved:true}` only after successful reconciliation.
- `cancel` schedules renewal cancellation at the paid cycle end. `cancel_now` stops the mandate immediately after customer confirmation. Neither automatically refunds a paid period; valid unrefunded paid-period access remains until expiry. Refresh/reload after timeouts before retrying.
- `recover` accepts the native `sub_...` / `plink_...` reference for an ambiguous creation. The server fetches the resource and validates JobPilot checkout note, product kind, price, currency, configured plan/reference and hosted URL. The service RPC binds only an unbound creating intent (or the identical already-bound resource). It never replaces a bound resource or creates a duplicate provider checkout.
- `POST /api/billing/webhook`: no cookie authentication; raw body ≤256 KiB, HMAC signature and bounded event ID mandatory. Canonical native payment/invoice/resource data is fetched before grants; event leases and IDs prevent concurrent/repeated application. Bad signature/input 400, oversized 413, unavailable/unmapped-dispute/reconciliation failure 503 so the provider can retry; accepted/irrelevant events 200.
- `GET /api/billing/receipts?id=pay_...`: owner-only paid record and PDF receipt. Receipts are **not tax invoices**. Canonically verified provider invoice links appear where available; real merchant/tax invoice adequacy is not certified.

## Money and privacy invariants

`billing_intents` snapshots price, mode and package credits. Native IDs are checked and hosted links must use the allowed provider HTTPS host. Captured payments must exactly match snapshot amount/currency and be linked to the checkout. Subscription expiry uses the **paid invoice billing period**, not a later unpaid period. Refund amounts are monotonic; refunded replays cannot resurrect access.

`billing_disputes` records only verified native ID, owner/intent/payment relationship, status and amount. Any case not `won` holds the intent's access and reverses a granted package once. Resolving one case cannot clear another unresolved/lost case. When all cases are won, canonical still-paid/unrefunded verification may restore valid access; expiry/refunds still apply. Disputes use the same required non-null current lease as payment reconciliation. No raw webhook, card data or payment instrument is stored.

All money mutation RPCs are service-only; owner-select RLS additionally checks active native account state. Account export includes owned dispute/history/credit/entitlement metadata and excludes credentials/leases/checkout URLs. Native Auth deletion anonymizes retained payment/intent/dispute owners; other private account data follows its existing cascade policy.

Account deletion is refused with 409 while a live subscription intent is nonterminal, including ambiguous creating intents. This happens before deletion markers, session revocation or file removal. Cancel and reconcile the native mandate first; cycle-end cancellation may remain nonterminal until the provider completes it, so immediate cancellation is available. Account deletion itself is not a bank-mandate cancellation mechanism.

## Deployment evidence and unresolved gates

Production migration `20261008004447_billing_recovery_disputes.sql` is applied after isolated complete reconstruction, dry run and security checks. Read-only production verification: dispute RLS enabled; browser recovery execution/dispute writes denied; subscription deletion trigger present; paid gate false; zero checkout/dispute rows. Local validation: 229 full Node tests, 28 SQL security files, lint, TypeScript-inclusive webpack production build; database advisors report no issues. Later targeted notification/billing/account tests also pass after email activation was separated from optional paid AI.

Production gateway credentials/plans are absent. No genuine checkout, subscription, settlement, invoice or dispute has been processed. Email sender/API, real subscribed-device receipt, Google/Outlook OAuth acceptance, commercial-host deployment, backup/off-device restore, legal/entity adequacy and real candidate/recruiter/admin pilots remain explicit release gates. Code coverage is not provider activation.

Final current Node command (`node --test $(rg --files lib scripts -g "*.test.mjs")`): **228 tests pass**. The previous 229-count validation is retained as historical evidence; current reproducible source-suite count is 228. Documentation coverage: 66 handlers / 106 HTTP methods, 63 table creation references, 35 settings, 90 runnable check files, all 41 original feature rows and 375 repository links pass.
