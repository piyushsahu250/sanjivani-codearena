# Migrating the backend to Google Cloud Run (free tier)

## Why

Render's free tier gives this whole app **0.1 vCPU / 512MB**, shared by the
Express server, every database query, and every spawned judge process
(gcc/g++/javac/java/python3/node). The code judge is hard-capped to 2
concurrent compile/run jobs (`JUDGE_CONCURRENCY`) because pushing that number
higher on 0.1 vCPU risks OOM-killing the whole container — not just the
judge, everything, for everyone.

Cloud Run's Always Free tier (2M requests, 180,000 vCPU-seconds, 360,000
GiB-seconds **per month**, renewing every month, not a one-time trial) gives
each instance a full vCPU by default and — critically — **auto-scales to
multiple instances** under concurrent load, instead of one fixed weak box.
A single exam session with 120 students uses a small fraction of that
monthly allowance (see the cost breakdown discussed separately) — this
should land at $0.

This doesn't change any application code — same Dockerfile, same Prisma
schema, same Neon database. It's purely a hosting swap for the backend.
The frontend (Vercel) and database (Neon) don't need to move.

## Prerequisites (only you can do these — I can't create accounts or add
billing on your behalf)

1. A Google Cloud account with a billing account attached (card required by
   Google for verification; see the pricing conversation for what actually
   triggers a charge — adding the card alone does not).
2. Easiest path: use **Cloud Shell** (https://console.cloud.google.com →
   the `>_` icon top-right) — it's free, browser-based, and has `gcloud` and
   `git` pre-installed, so you don't need to install anything locally.
   Alternatively, install the `gcloud` CLI locally and run `gcloud init`.

## Deploy steps

### 1. Get the code into Cloud Shell (or your local machine)
```bash
git clone https://github.com/piyushsahu250/sanjivani-codearena.git
cd sanjivani-codearena/backend
```

### 2. Set your project
```bash
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com
```

### 3. Deploy directly from source
`--source .` tells Cloud Run to build the existing `Dockerfile` via Cloud
Build and deploy it — no manual image push step needed.

```bash
gcloud run deploy sanjivani-backend \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --concurrency 20 \
  --min-instances 0 \
  --max-instances 10 \
  --set-env-vars \
JWT_SECRET="<generate a long random string>",\
DATABASE_URL="<your Neon pooled connection string>",\
DIRECT_DATABASE_URL="<your Neon direct connection string>",\
FRONTEND_URL="https://sanjivani-codearena.vercel.app",\
JUDGE_CONCURRENCY=4,\
JUDGE_CASE_CONCURRENCY=3
```

Notes on the flags:
- **Don't set `PORT`** — Cloud Run injects it automatically (8080) and the
  app already reads `process.env.PORT`, same as on Render.
- `--max-instances 10` is a deliberate **cost safety cap**: even in a runaway
  scenario, Cloud Run will never spin up more than 10 instances, which bounds
  your worst-case exposure regardless of traffic. At `--concurrency 20` per
  instance, 10 instances comfortably covers 120 concurrent students with
  headroom; raise it later if needed.
- `JUDGE_CONCURRENCY=4` / `JUDGE_CASE_CONCURRENCY=3` are a modest bump from
  Render's defaults (2/2) — reasonable given a full vCPU + 1GiB per instance
  here, still conservative to avoid one instance choking on Java's JVM
  startup cost under a burst. Revisit once you've watched real load.
- Copy `RESEND_API_KEY` and `MAIL_FROM` into `--set-env-vars` too if you're
  using email delivery (omit them and the app just logs instead of emailing,
  same graceful fallback as today).
- Use your **Neon pooled connection string** for `DATABASE_URL` (not the
  direct one) — Cloud Run instances scaling up/down means more concurrent
  connections than a single fixed Render box, so pooling matters more here.

### 4. Note the URL Cloud Run gives you
Looks like `https://sanjivani-backend-xxxxxxxxxx-uc.a.run.app`. Verify it:
```bash
curl https://sanjivani-backend-xxxxxxxxxx-uc.a.run.app/api/health
```

### 5. Point the frontend at it
In Vercel → your project → Settings → Environment Variables, update:
```
VITE_API_URL = https://sanjivani-backend-xxxxxxxxxx-uc.a.run.app/api
```
Redeploy the frontend (Vercel → Deployments → redeploy latest, or push any
commit) so the new env var takes effect.

### 6. Verify end-to-end before telling students
Log in, start a test, run/submit code in a couple of languages, confirm
results save. Once confirmed, Render can stay as an idle fallback (still
free, no reason to delete it) or you can spin it down.

## Safety net
Set a billing budget alert regardless of everything above:
Console → Billing → Budgets & alerts → Create budget → e.g. ₹100 threshold,
email notification. Free to set up, and it's the actual backstop if any of
the estimates here turn out to be wrong.
