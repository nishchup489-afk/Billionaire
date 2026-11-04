# Billionaire Swipe

Upload your bills. Generous patrons swipe right to pay them.

- **Post** a bill: title, amount, story, photo, and a payment link (the biller's pay page or your PayPal/Venmo/etc.).
- **Swipe**: right = pledge to pay, left = pass. One patron per bill.
- **Pay**: the patron pays directly through the link. Money never goes through this site.
- **Confirm**: the poster marks the bill as paid once the money arrives. Patrons can release a pledge they can't fulfil.
- **Report**: a bill with 3 reports drops out of the swipe deck.

Not affiliated with any billionaire, company or social network.

## Stack (all free tier)

- Frontend: Vite + React + TypeScript, hosted on Vercel Hobby
- Backend: Supabase Free (Postgres + Auth + Storage), with Row Level Security on every table
- Bill photos go in a private storage bucket, served through short-lived signed URLs to signed-in users

## Run locally

```bash
npm install
npm run dev
```

`.env` holds the public Supabase URL and publishable key. These are browser-safe; Row Level Security protects the data.

## Database

The schema is in `supabase/schema.sql`. Tables: `profiles`, `bills`, `swipes`, `reports`. RPCs: `next_bills`, `swipe`, `release_pledge`, `report_bill`, `stats`.
