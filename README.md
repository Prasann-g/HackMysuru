# CivicBridge

**AI-powered civic complaint verification platform for Mysuru.**  
Built for HackMysuru 1.0.

---

## What it does

CivicBridge helps citizens submit civic complaints (potholes, garbage dumping, broken streetlights, etc.) and uses explainable AI signals to flag possible duplicates before they reach municipal officers. Officers get a prioritised review queue with verification context. The public can track complaints and view anonymised municipal analytics.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Tailwind CSS (Vite) |
| Backend | Node.js + Express + TypeScript |
| Database | Supabase (PostgreSQL) + SQLite (offline fallback) |
| Storage | Supabase Storage (complaint evidence images) |
| Auth | JWT + bcrypt |
| AI/Verification | Jaccard similarity, SHA-256 image dedup, dHash perceptual hashing |

---

## Prerequisites

- Node.js 18+
- npm 9+

---

## Quick Start

### 1. Configure the backend

```bash
cp server/.env.example server/.env
```

Edit `server/.env` and fill in real values:

```env
DATA_STORE=supabase

SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

JWT_SECRET=<a-strong-random-secret>
OFFICER_INVITE_SECRET=<invite-code-for-officer-registration>
```

> ⚠️ **Never commit `server/.env` to Git.** It is excluded by `.gitignore`.

### 2. Configure the frontend

```bash
cp client/.env.example client/.env
```

Edit `client/.env`:

```env
VITE_API_URL=http://localhost:5000
```

> For a remotely hosted environment, set `VITE_API_URL=https://<your-server-host>`.

### 3. Install dependencies

```bash
npm install
npm --prefix server install
npm --prefix client install
```

### 4. Start development servers

In two separate terminals:

```bash
# Terminal 1 — Backend
npm --prefix server run dev
# Starts on http://localhost:5000

# Terminal 2 — Frontend
npm --prefix client run dev
# Starts on http://localhost:5173
```

Open **http://localhost:5173** in your browser.

---

## Authentication & Role Access

In production-first mode, default and demo credentials tables have been removed for data security:

- **Citizens:** Register or authenticate directly through the Citizen Portal using mobile number or email with password. Authenticated citizens can track their personal submissions, view review stages, and access profile details.
- **Municipal Officers:** MCC administrative officers sign in to access the Officer Queue and Review Action Panel. New officer account registration requires a valid municipal invite key matching `OFFICER_INVITE_SECRET`.


## Core Demo Flows

1. **Citizen** → Log in → Report a civic issue with GPS photo evidence → Receive tracking token
2. **Duplicate detection** → Submit duplicate or near-duplicate report → Receive explainable signals or rejection
3. **Follow-Through Tracking** → Citizen views chronological activity ledger and SLA milestones with zero exposed internal notes
4. **Officer Operations** → Log in → View triage queue → Inspect evidence forensics, duplicate clusters, SLA window consumption, dormancy indicators, and full activity event ledger
5. **Officer Review & Lifecycle Commit** → Update status, reassign department, or log notes → Automatic real-time ledger updates
6. **Analytics & Public Visibility** → View public metrics, area breakdown, and interactive complaint map

---

## Running Tests

```bash
# Backend (Vitest) — 17 test files, 224 passed
npm --prefix server test

# Client lint
npm --prefix client run lint

# Client production build
npm --prefix client run build

# Server TypeScript build
npm --prefix server run build
```

---

## Project Structure

```
HackMysuru/
├── client/                  # React frontend (Vite)
│   ├── src/
│   │   ├── components/      # UI components by feature area
│   │   ├── services/api.ts  # All backend API calls
│   │   └── App.tsx          # Root routing
│   └── .env.example
├── server/                  # Express API backend
│   ├── src/
│   │   ├── db/              # Dual-driver stores (SQLite + Supabase)
│   │   ├── middleware/      # Auth, file upload
│   │   ├── routes/          # API route handlers
│   │   ├── services/        # Verification engine, auth service
│   │   └── index.ts
│   ├── tests/               # Vitest test suite
│   └── .env.example
├── supabase/
│   └── schema.sql           # Supabase PostgreSQL schema
└── AGENTS.md                # Project agent rulebook
```

---

## Data Integrity

- Supabase baseline: **13 users**, **11 complaints**, **7 evidence images**
- SQLite fallback database: `server/data/civictrust.db`
- Switch between backends: `DATA_STORE=sqlite` or `DATA_STORE=supabase` in `server/.env`

---

## Security Notes

- All citizen PII is excluded from public-facing endpoints
- Photo evidence is labelled as citizen-submitted evidence only — authenticity unverified
- JWT tokens expire per `JWT_EXPIRES_IN` (default: `7d`)
- Officer registration requires an invite code
- Supabase service role key is **never** sent to the frontend

---

*CivicBridge — HackMysuru 1.0*
