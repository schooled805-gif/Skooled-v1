---
name: Fee/payment webhook integrity
description: Cross-file requirements for crediting school-fee payments safely via provider webhooks.
---

# Fee/payment webhook integrity

Balance is credited ONLY inside a verified provider webhook handler, never on the
client redirect/return.

**Why:** the redirect return URL is attacker-controllable; only the signed
server-to-server webhook proves payment. Crediting on return would let anyone fake a
paid balance.

**How to apply:**
- Paystack webhook verification is HMAC-SHA512 over the **raw** request body, so the
  Express app must capture `rawBody` (via `express.json({ verify })`) and the webhook
  paths must be in PUBLIC_ROUTES (they have no Bearer token). Both live in
  `artifacts/api-server/src/app.ts`.
- Ozow verification is a lowercase SHA512 hash of concatenated response fields +
  private key.
- The credit path must be transactional: conditionally claim the payment row
  `pending -> complete` (idempotency guard), then insert the ledger row and apply an
  **atomic SQL increment** (`balanceCents = balanceCents + delta`) — not read-then-write
  — all in one `db.transaction`. Read-then-write loses concurrent updates and a
  non-transactional claim can mark a payment complete without crediting.
- Verify the webhook amount against the stored `feePayments.amountCents`; allocate to
  the student from the stored payment row only, never from webhook/client payload.
