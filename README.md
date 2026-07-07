# Sanjivani CodeArena — University Coding Test Platform

A full-stack platform for running coding assessments: staff build a question
bank, assemble timed tests, students attend them in a live code editor
(JavaScript, Python, C, C++, Java), and submissions are auto-judged against
test cases with a live leaderboard. Three roles — Student, Staff, Admin — each
have their own routes and permissions.

## Stack
- **Backend:** Node.js, Express, Prisma ORM, PostgreSQL, JWT auth
- **Frontend:** React (Vite), React Router, Monaco Editor (VS Code's editor, in-browser)
- **Judge engine:** sandboxed subprocess execution for JS, Python, C, C++, and Java (see security note below)

## Roles & routes
- **Student** (`/dashboard`, `/test/:id`) — self-registers via `/register`, attends published tests, writes/runs/submits code.
- **Staff** (`/staff`, `/staff/questions/new`, `/staff/tests/new`, `/staff/tests/:id/results`) — builds the question bank, assembles/publishes tests, views leaderboards.
- **Admin** (`/admin`) — everything Staff can do (also reachable at `/staff`), plus creates/deletes Staff, Admin, and Student accounts.

Staff and Admin accounts can't self-register — an existing Admin creates them from `/admin` (backed by `POST /api/users`).

## Project structure
```
sanjivani-platform/
  backend/          Express API
    Dockerfile              Node + gcc/g++/javac/python3 for the judge
    prisma/schema.prisma    Database models (Role: STUDENT / STAFF / ADMIN)
    prisma/seed.js          Creates a default admin account
    src/routes/             auth, users, tests, questions, submissions
    src/utils/judge.js      Code execution & grading engine (5 languages)
  frontend/         React app (Vite)
    src/pages/               Login, Register, Student/Staff/Admin dashboards, Test-taking, Results
    src/components/          Navbar, ChalkUnderline (brand mark)
```

## Setup

### 1. Backend
```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init   # creates dev.db (SQLite) and tables
npm run seed                          # creates admin@sanjivani.edu.in / Admin@123
npm run dev                           # starts API on http://localhost:4000
```
Edit `backend/.env` to change `JWT_SECRET` (do this before any real deployment)
and `DATABASE_URL`.

### 2. Frontend
```bash
cd frontend
npm install
npm run dev      # starts on http://localhost:5173
```
`frontend/.env` points to `http://localhost:4000/api` by default — update
`VITE_API_URL` for a deployed backend.

### 3. Try it out
1. Log in as the seeded admin (`admin@sanjivani.edu.in` / `Admin@123`).
2. Create a question (with sample + hidden test cases).
3. Create a test, select the question, set a start/end window that includes
   right now.
4. Publish the test.
5. Register a student account, log in, attend the live test, write code, run
   against sample cases, and submit.
6. Back in the admin view, open **Results** on the test to see the leaderboard.

## Deploying so students can access it (Render + Vercel, both have free tiers)

The schema is already set to PostgreSQL. Steps:

### 0. Push this project to GitHub
```bash
cd sanjivani-platform
git init && git add . && git commit -m "initial commit"
```
Create an empty repo on GitHub, then:
```bash
git remote add origin <your-repo-url>
git push -u origin main
```

### 1. Backend + database on Render
This repo includes `render.yaml`, so Render can set almost everything up
automatically:
1. Go to https://render.com → **New** → **Blueprint** → connect your GitHub repo.
2. Render reads `render.yaml` and provisions a free PostgreSQL database and
   a web service for `backend/` together, wiring `DATABASE_URL` and a random
   `JWT_SECRET` automatically.
3. Click **Apply**. First deploy takes a few minutes (it runs
   `npx prisma migrate deploy` for you).
4. Once live, note the backend URL, e.g. `https://sanjivani-codearena-backend.onrender.com`.
5. Open the Render **Shell** tab for the backend service and run:
   ```bash
   npm run seed
   ```
   This creates the admin login (`admin@sanjivani.edu.in` / `Admin@123`) —
   change that password after first login.

   (No Blueprint support / doing it manually instead: create a PostgreSQL
   instance on Render, then a Web Service pointing at `backend/` with build
   command `npm install && npx prisma generate && npx prisma migrate deploy`
   and start command `npm start`, and set `DATABASE_URL` + `JWT_SECRET`
   yourself as env vars.)

### 2. Frontend on Vercel
1. Go to https://vercel.com → **Add New** → **Project** → import the same repo.
2. Set **Root Directory** to `frontend`.
3. Add an environment variable: `VITE_API_URL` = `https://<your-render-backend-url>/api`
4. Deploy. Vercel gives you a link like `https://sanjivani-codearena.vercel.app`.

**That Vercel link is what you share with students.**

### 3. Test it live
- Log in as admin, change the seeded password (there's no in-app "change
  password" screen yet — for now, update it directly via the seed script or
  a quick Prisma Studio session against the live `DATABASE_URL`).
- Create a question, create a test with a start/end window covering now,
  publish it.
- Share the Vercel link + tell students to register.

### Local testing with Postgres before you deploy
A `docker-compose.yml` is included so you can run Postgres locally instead of
using SQLite:
```bash
docker compose up -d
# then in backend/.env, DATABASE_URL="postgresql://sanjivani:sanjivani_dev_pw@localhost:5432/sanjivani_codearena"
cd backend && npx prisma migrate dev --name init && npm run seed && npm run dev
```

## ⚠️ Security note on code execution
The included judge (`backend/src/utils/judge.js`) runs submitted code with
Node's `child_process` and OS-level timeouts. That's fine for local
development or a trusted, small-scale pilot, but it is **not** a strong
enough sandbox for a public-facing production deployment — a student could
attempt to read files, exhaust memory, or otherwise abuse the host.

Before going live campus-wide, swap the internals of `judgeSubmission()` for
a real sandboxing layer, e.g.:
- **Judge0** (open-source, self-hostable, or via RapidAPI) — purpose-built for
  this exact use case, supports 60+ languages
- Per-submission **Docker containers** with strict CPU/memory/network/
  filesystem limits (or gVisor/Firecracker for stronger isolation)

The rest of the app (routes, DB schema, scoring logic) doesn't need to change
— only what happens inside `judgeSubmission`.

## What's already handled
- Role-based auth (Student / Staff / Admin) with JWT, separate routes per role
- Admin can create/delete Staff, Admin, and Student accounts
- Question bank with difficulty, points, sample + hidden test cases
- Test scheduling (start/end window), publish/unpublish
- Live timer, auto-finalize when time runs out
- Run-against-sample (ungraded) vs Submit (graded, saved) flows, in JS/Python/C/C++/Java
- Per-question best-score aggregation into a total test score
- Leaderboard per test

## Natural next steps
- Staff analytics (per-question difficulty stats, time-to-solve)
- Plagiarism/similarity detection across submissions
- More languages (C++, Java) via the Judge0 swap above
- Email notifications when a test is published
- CSV export of results
