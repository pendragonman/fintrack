# FinTrack — Personal Finance Tracker

A full-stack personal finance tracker for recording income and expenses, setting monthly budgets, and working toward savings goals — with charts, CSV export, and email/Google sign-in.

**Live app:** https://finance-tracker-client-three.vercel.app
**API:** https://finance-tracker-api-kappa.vercel.app/api

---

## Features

- **Authentication** — email/password sign-up with email verification codes, plus Google sign-in
- **Transactions** — add, edit, and delete income/expense records, filter them, and export to CSV
- **Budgets** — set a monthly limit per category and track spending against it
- **Savings goals** — create goals with target amounts and dates, and contribute toward them
- **Reports & dashboard** — spending trends and category breakdowns rendered with Recharts
- **Settings** — update your name, password, and preferred currency
- **Theme** — light/dark mode with the choice persisted locally

## Tech Stack

| Layer | Stack |
|---|---|
| Frontend | React 19, Vite, React Router 7, Axios, Recharts |
| Backend | Node.js, Express, Prisma, Zod |
| Database | PostgreSQL (Neon) |
| Auth | JWT, bcryptjs, Google Identity Services |
| Email | Nodemailer (Gmail SMTP) |
| Hosting | Vercel (client + API) |

## Project Structure

```
.
├── client/                  # React + Vite frontend
│   ├── src/
│   │   ├── components/       # Layout, ProtectedRoute, ThemeToggle, GoogleButton, ...
│   │   ├── context/          # AuthContext, ThemeContext
│   │   ├── pages/            # Dashboard, Transactions, Budgets, Goals, Reports, Settings, auth pages
│   │   ├── api.js            # Axios instance (base URL from VITE_API_URL)
│   │   └── main.jsx
│   └── vercel.json
└── server/                  # Express + Prisma API
    ├── api/index.js          # Vercel serverless entry point
    ├── prisma/schema.prisma  # Database schema
    ├── src/
    │   ├── routes/           # auth, transactions, budgets, goals, reports
    │   ├── middleware/       # JWT auth
    │   ├── lib/              # prisma client, mailer, categories, asyncHandler
    │   └── index.js          # Express app
    └── vercel.json
```

## API Overview

All routes are served under `/api`:

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/auth/signup` | Create an account (sends a verification code) |
| `POST` | `/api/auth/login` | Log in and receive a JWT |
| `POST` | `/api/auth/google` | Sign in with a Google ID token |
| `POST` | `/api/auth/verify-email` | Confirm the emailed verification code |
| `PATCH` | `/api/auth/me` | Update the signed-in user |
| `GET/POST/PUT/DELETE` | `/api/transactions` | Manage transactions (`/export` returns CSV) |
| `GET/POST/DELETE` | `/api/budgets` | Manage monthly category budgets |
| `GET/POST/DELETE` | `/api/goals` | Manage savings goals (`/:id/contribute`) |
| `GET` | `/api/reports/trend` | Spending trend data for charts |
| `GET` | `/api/health` | Health check |

## Local Development

### 1. Backend

```bash
cd server
npm install                 # also runs `prisma generate`
cp .env.example .env        # then fill in the values
npm run prisma:migrate      # create/apply database migrations
npm run dev                 # http://localhost:4000
```

### 2. Frontend

```bash
cd client
npm install
# set VITE_API_URL in client/.env to http://localhost:4000/api
npm run dev
```

## Environment Variables

### `server/.env`

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (e.g. Neon) |
| `JWT_SECRET` | Secret used to sign auth tokens |
| `PORT` | Local port (defaults to `4000`) |
| `CLIENT_ORIGIN` | Allowed browser origin(s), comma-separated |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GMAIL_USER` | Gmail address used to send verification codes |
| `GMAIL_APP_PASSWORD` | Gmail app password for SMTP |

### `client/.env`

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Base URL of the API, including `/api` |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client ID |

> ⚠️ Never commit `.env` files. They are listed in `.gitignore`.

## Deployment

Both halves deploy to Vercel as two separate projects:

| Project | Root Directory | Notes |
|---|---|---|
| `client` | `client` | Vite static build |
| `server` | `server` | Express app served as a serverless function via `api/index.js` |

Environment variables must be set in each Vercel project (see the tables above). For the API, `CLIENT_ORIGIN` must contain the deployed frontend URL, and the frontend's `VITE_API_URL` must point at the API URL — **including the `/api` suffix**. Since Vite inlines `VITE_*` variables at build time, the frontend must be redeployed after changing them.

Prisma on Vercel requires the additional binary target declared in `prisma/schema.prisma`:

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "rhel-openssl-3.0.x"]
}
```
