# Referral Board

A job-referral board with verified referrers and claim deadlines, built with the [DeepSpace SDK](https://github.com/deepdotspace).

**Live: [referral-board.app.space](https://referral-board.app.space)**

## Features

- Referral requests — post the company, job ID and link with your resume; everyone sees the status (open → claimed → referred)
- Work-email verification — referrers confirm a company email with a 6-digit code; only the domain is stored
- Claim to read — a resume is visible only to the referrer who claims the request (at most 3 claims at a time)
- AI referral note — drafts the short note referral forms ask for, from the resume only (doesn't invent experience)
- Reminders and release — an hourly job emails the claimer after 3 days and puts the request back on the board after 7
- Real-time board — claims and referrals appear for both sides without a refresh

## Development

```bash
npm install
npm run dev
```

## Testing

```bash
npm run validate    # type check + unit tests
```

## Deployment

```bash
npm run deploy
```
