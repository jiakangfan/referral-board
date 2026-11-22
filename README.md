# Referral Board

A shared board for job referrals. An applicant posts the job they want a referral for. An
employee who has verified a work email at that company claims the request, reads the resume,
and refers them. Every request shows who claimed it and how long it has waited, and a request
that stalls goes back on the board.

Built on the DeepSpace SDK (Cloudflare Workers + Durable Objects).

## Why

Asking a friend for a referral often means waiting and following up, with no idea whether
anything happened. This board makes the state visible (open → claimed → referred) and puts a
deadline on every claim, so a request can't sit with one person forever.

## How it works

1. **Verify as a referrer** (`/refer`). Enter a company name and a work email. The server emails
   a 6-digit code; entering it adds you to `referrers` for that email's domain. Personal domains
   (gmail.com, qq.com, …) are rejected. Only the domain is kept, never the full address.
2. **Ask** (`/ask`). Pick a company that has at least one verified referrer, enter the job ID,
   title and link, and paste your resume and (optionally) the job description.
3. **Claim** (`/home`). Referrers at that domain see the request under "You can refer". Claiming
   it is what lets them read the resume. A referrer can hold at most 3 claims at once.
4. **Refer**. The claimer can ask AI to draft the short note most referral forms ask for, edit it,
   then mark the request referred, or give it up so someone else can take it.
5. **Reminders**. An hourly job emails the claimer 3 days after claiming. After 7 days without a
   referral the claim is released and the request is open again.

## DeepSpace features used

| Feature | Where | What it does here |
|---|---|---|
| Collections with per-role permissions | `src/schemas/` | Four app tables; the server enforces who can read or write each one |
| Server actions | `src/actions/` | Every state change (verify, submit, claim, refer, withdraw) goes through a checked server action |
| `email/send` integration | `src/actions/referrers.ts`, `src/cron.ts` | Verification codes and 3-day reminders |
| `anthropic/chat-completion` integration | `src/actions/claims.ts` | Drafts the referral note from the resume (Claude Haiku 5.5) |
| Scheduled job (cron) | `src/cron.ts` | Hourly reminder and release check |
| Real-time queries | `useQuery` in `src/pages/` | Both sides see a claim or a referral appear without refreshing |
| Auth and user lookup | `useAuth`, `useUserLookup` | Sign-in and showing names instead of user IDs |

## Data model and who can see what

| Table | Holds | Read | Write |
|---|---|---|---|
| `requests` | Company, domain, job ID/title/link, status, claimer, timestamps, reminder and release counts | Every signed-in member | Server actions only |
| `request_private` | Resume, job description, referral note, `viewers` | The applicant and the current claimer (`viewers`) | The claimer can edit only `referralNote`; everything else through server actions |
| `referrers` | User ID, company name, verified domain | Every signed-in member | Server actions only: added after a correct code; removed by its owner only when they hold no claims at that company |
| `email_codes` | SHA-256 hash of the pending code, expiry, attempt count | Nobody (not even admin) | Server actions only; deleted once the code is used |
| `users`, `settings` | SDK defaults | | |

The resume lives in a separate table from the public request, so the board can show a request to
everyone while the resume reaches only the claimer. When a claim ends (give up, withdraw, or the
7-day release) the claimer is removed from `viewers` and loses access, and the next claim starts
with a blank referral note.

## Main tradeoffs

- **Resume visible only after claiming.** A referrer can't browse resumes and decide later; they
  commit first. This keeps resumes out of the hands of people who never act on them.
- **Work-email verification instead of self-declared referrers.** Without it anyone could claim to
  work anywhere and collect resumes. The cost is an email per verification and a little friction.
- **All writes go through server actions.** The browser can't edit `requests` directly, so rules
  like "only the claimer can mark referred" and "max 3 claims" can't be skipped.
- **No AI resume-to-job matching.** Tools like Simplify already do keyword matching; the AI here
  does the part referrers actually spend time on, writing the note.

## Known limitations

- **Claiming is not atomic.** If two referrers claim within the same instant, the later write wins
  and the other sees "Someone else claimed it first."
- **Verification codes are hashed without a secret.** A 6-digit code's hash could be reversed by
  brute force if the table leaked; in practice the table is unreadable, codes expire in 10 minutes,
  are deleted after use, and allow 5 tries. An HMAC with a server secret would close this.
- Requests can only be made for companies that already have a verified referrer.

## Next steps

- Atomic claim (compare-and-set on `status`).
- HMAC for verification codes.
- Let the applicant release a claimer who has gone quiet, instead of waiting 7 days.
- Allow requests for companies with no referrer yet, and notify referrers who join later.

## Run locally

Requires Node 22.15+, 24 or 26 (not 25).

```bash
npm install
npm run dev        # http://localhost:5173
```

Local data lives in `.wrangler/state` and is never deployed.

```bash
npx tsc --noEmit   # type check
npx vitest run     # unit tests
npm run deploy     # publish to <name>.app.space
```

## Project layout

```
src/schemas/      table definitions and permissions
src/actions/      server actions (referrers, requests, claims)
src/cron.ts       hourly reminder / release job
src/rules.ts      3-day reminder, 7-day release, max 3 claims
src/pages/        landing page (index.tsx) and the signed-in pages: home, ask, refer
src/components/   RequestCard, ClaimedPanel
```
