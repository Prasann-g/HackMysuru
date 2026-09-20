# Setup & Run Instructions

[← Back to README](../README.md)

> **Scope note:** These instructions describe the current CivicBridge project structure and intentionally do **not** include demo seeding. The project requirement is to use database-backed data and avoid unmarked dummy users or complaints.
>
> Any environment variable whose exact name is not explicitly listed here must be taken from the committed `server/.env.example` file. Do not invent values or commit real credentials.

## Prerequisites

| Tool | Required version / requirement |
|---|---|
| Node.js | Use the version supported by the active `client/package.json` and `server/package.json`; verify before setup |
| npm | Installed with Node.js |
| Git | Required to clone the repository |
| Supabase project | Required for the persistent database/storage configuration |
| Email provider | Required for live citizen email OTP delivery; the project uses the Resend/Nodemailer SMTP integration when configured |
| Modern browser | Chrome, Edge or another browser capable of running the React application |

> **Important:** The project contains separate frontend and backend applications under `client/` and `server/`. Run their commands from the appropriate directory or use npm's `--prefix` option.

## 1. Clone

```bash
git clone <repo-url>
cd HackMysuru
```

Replace `<repo-url>` with the actual repository URL.

The expected project layout includes:

```text
HackMysuru/
├── client/
├── server/
├── e2e/
├── supabase/
├── README.md
└── ...
```

## 2. Environment Variables

### Backend configuration

The backend environment template is:

```text
server/.env.example
```

Create the backend environment file using the same variable names shown in that template.

On macOS/Linux:

```bash
cp server/.env.example server/.env
```

On Windows PowerShell:

```powershell
Copy-Item server/.env.example server/.env
```

### Frontend configuration

The frontend uses the `VITE_API_URL` configuration value for the backend API base URL.

If the repository contains a frontend environment template, copy it according to that template. Otherwise, create the frontend environment file only after checking the variables referenced by the client source code.

Typical local API configuration is conceptually:

```text
VITE_API_URL=http://localhost:5000
```

Use the exact variable names and required values from the repository's environment templates and source configuration.

### Environment variable reference

| Variable / configuration | Required | Purpose |
|---|---:|---|
| `VITE_API_URL` | Yes for a separate frontend/backend setup | URL of the CivicBridge Express API |
| Supabase URL setting | Yes for Supabase-backed operation | Connects the backend to the configured Supabase project |
| Supabase service credential setting | Yes for server-side Supabase operations | Authenticates backend access to Supabase |
| JWT/session settings | Required for officer/session authentication | Controls the backend authentication/session configuration |
| Email provider settings | Required for live email OTP delivery | Configures Resend/Nodemailer SMTP delivery |
| Storage settings | Required for evidence-file storage | Configures complaint evidence storage |
| Other backend variables | Check `server/.env.example` | Additional runtime, security, provider and test configuration |

> **Security:** Never commit `.env` files or real secrets. Commit only environment templates such as `.env.example`.

## 3. Install Dependencies

Install frontend dependencies:

```powershell
npm --prefix client install
```

Install backend dependencies:

```powershell
npm --prefix server install
```

If the repository root has its own `package.json`, install the root dependencies according to that file as well.

## 4. Database and Data Preparation

CivicBridge is designed around a repository/data-access layer that can use:

- Supabase PostgreSQL for persistent application data;
- SQLite for local or test-driver scenarios;
- in-memory stores for suitable ephemeral test scenarios.

### Supabase setup

1. Create or select the Supabase project used by the deployment.
2. Review the SQL files in:

   ```text
   supabase/
   ```

3. Apply only the migrations that have been reviewed and approved for the target environment.
4. Configure the backend using the exact values required by `server/.env.example`.
5. Configure the evidence-storage bucket and its access policies according to the active application configuration.

### Dummy data policy

There is **no seed command documented here** because the current project requirement is to avoid unmarked dummy business data, dummy users and dummy complaints.

Do not run an unreviewed seed script against the configured Supabase project.

Before changing or deleting existing database records:

- inspect the records;
- distinguish test data from potentially real data;
- obtain explicit approval for destructive actions;
- take an appropriate backup/export when required.

## 5. Run the Application

Start the backend API:

```powershell
npm --prefix server run dev
```

Start the frontend development server in a separate terminal:

```powershell
npm --prefix client run dev
```

The backend's local port is configured by the backend environment/configuration. The frontend's displayed URL is provided by Vite in the terminal.

The commonly used local API base is:

```text
http://localhost:5000
```

If the frontend uses a different port or the backend configuration specifies another port, use the values printed by the running processes and the configured `VITE_API_URL`.

## 6. Open CivicBridge

1. Start the backend.
2. Start the frontend.
3. Open the frontend URL printed by Vite.
4. Use the citizen email OTP flow if the email provider is configured.
5. Use the officer login flow only with an authorized officer account and the configured credentials.

The application separates citizen-facing and officer-facing workflows through authentication and role-aware access controls.

## 7. Functional Smoke Test

Use this checklist after startup:

- [ ] The frontend loads without a build/runtime error.
- [ ] The frontend can reach the configured backend API.
- [ ] The citizen authentication modal opens.
- [ ] Email OTP request works when the email provider is configured.
- [ ] OTP verification establishes the expected citizen session.
- [ ] The officer login flow rejects invalid credentials.
- [ ] An authorized officer can access the officer dashboard.
- [ ] A complaint can be submitted using the configured backend and storage.
- [ ] Complaint status can be retrieved through the tracking flow.
- [ ] Evidence metadata and verification results are displayed where available.
- [ ] Ward lookup works with valid coordinates and the bundled ward data.
- [ ] Public map/analytics views load backend-backed data.
- [ ] No unmarked dummy complaints or users appear in the main application views.

## 8. Testing

### Frontend build

```powershell
npm --prefix client run build
```

### Frontend lint

```powershell
npm --prefix client run lint
```

### Backend tests

Use the test script defined in `server/package.json`:

```powershell
npm --prefix server test
```

If the backend package uses a different script name, inspect:

```powershell
Get-Content server/package.json
```

and run the corresponding test script.

### End-to-end tests

The browser tests are located under:

```text
e2e/
```

Run the Playwright command defined in the repository's package configuration after ensuring that the frontend and backend test prerequisites are available.

Do not treat a test report from an older run as proof of the current code state. Record the result of the latest test run.

## Testing Without External Email

The project includes OTP storage abstractions for suitable local/test scenarios, including an in-memory OTP store. However, the live citizen email OTP experience depends on the configured email-delivery path.

For a local test:

1. Check the active test configuration.
2. Use the test-specific OTP/provider setup documented in the repository.
3. Do not expose real OTPs, service credentials or personal data in committed logs.

## Troubleshooting

| Problem | Checks / fix |
|---|---|
| `npm` is not recognized | Install Node.js and reopen the terminal |
| Frontend cannot reach the API | Confirm the backend is running and check `VITE_API_URL` |
| Port already in use | Stop the process using the port or change the configured development port |
| Supabase connection fails | Check the Supabase URL, server credential configuration and project status |
| Email OTP is not delivered | Check Resend/Nodemailer SMTP configuration, sender verification and provider logs |
| Evidence upload fails | Check Supabase Storage configuration, bucket name and storage policies |
| Officer login fails | Verify the account, password configuration, JWT/session settings and backend logs |
| Ward lookup fails | Confirm that `server/data/mysuru-wards.geojson` exists and is readable by the backend |
| Build fails after dependency changes | Remove and reinstall dependencies only after reviewing the lockfiles and project instructions |
| Tests fail because a service is unavailable | Check test-specific configuration and distinguish environment failures from code failures |
| Unexpected dummy data appears | Stop the demo flow, inspect the source and database, and do not delete records without review |
| Environment file is missing | Copy the appropriate `.env.example` file and fill in only the required values |

## Current Capability Notes

- Citizen authentication uses an email OTP flow when the email provider is configured.
- Officer authentication uses the implemented password/JWT session flow.
- Verification is explainable and uses available metadata, geographic and image-derived signals.
- Image-related processing includes dHash comparison and 32-dimensional spatial luminance embeddings.
- Duplicate correlation is a similarity-based workflow; it is not a guarantee of fraud detection.
- Mysuru ward lookup uses the bundled 65-ward GeoJSON and point-in-polygon logic.
- The road-damage classifier integration point is currently unavailable through `NotAvailableClassifier`.
- Live SMS OTP delivery is not documented as integrated with Twilio or SNS.
- ML-based delay-risk prediction should not be treated as implemented unless confirmed in the active codebase.
- Supabase is the intended persistent production-oriented store; SQLite and in-memory drivers support local/test scenarios.

## Reproducibility and Safety Rules

1. Use the committed package manifests and lockfiles as the source of truth for dependency installation.
2. Use the exact environment variable names from `server/.env.example` and any verified frontend environment template.
3. Never commit real secrets.
4. Do not run destructive database cleanup during setup.
5. Do not run unreviewed seed scripts against a shared Supabase project.
6. Keep production data separate from test data.
7. Record the exact commands and test results used for a submission or deployment.
