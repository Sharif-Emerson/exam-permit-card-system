# REST Backend Starter

This is a hardened backend starter for the provider-agnostic exam permit frontend in a single-campus setup.

## Requirements

- Node.js 24 recommended
- npm

## Run

1. Install dependencies:

```bash
npm install
```

2. Start the server:

```bash
npm run dev
```

The server starts on `http://localhost:4000` by default.

If you want to reset the database before starting:

```bash
npm run reset-data
```

## Frontend Settings

Use these frontend environment values:

```bash
VITE_BACKEND_PROVIDER=rest
VITE_API_BASE_URL=http://localhost:4000
```

## Bootstrap Admin Accounts

- First startup seeds these bootstrap admin IDs:
	- `admin-1` as super-admin
	- `admin-2` as registrar
	- `admin-3` as finance
- On a brand new database, the default login credentials are:
	- `admin@example.com` / `Permit@2026`
	- `registrar@example.com` / `Permit@2026`
	- `finance@example.com` / `Permit@2026`
- After you change a bootstrap admin's email, phone number, or password in the app, `npm run reset-data` preserves those customized values for the same bootstrap admin ID while still clearing students, permits, uploads, and activity data.

No student accounts are seeded by default. Create students from the admin panel or import real records into the backend.

## Admin Scopes

- `admin@example.com`: `super-admin` with full access
- `registrar@example.com`: can view students, manage student profiles, handle support requests, and view audit activity
- `finance@example.com`: can view students, manage financial records and imports, and view audit activity

Admin login and session responses include `scope` and `permissions` for admin accounts so the frontend can align its UI with backend-enforced access rules.

## Included Endpoints

- `GET /health`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`
- `GET /permits/:token`
- `GET /profiles/:id`
- `GET /profiles?role=student`
- `PATCH /profiles/:id/account`
- `PATCH /profiles/:id/admin`
- `PATCH /profiles/:id/financials`
- `POST /admin-activity-logs`
- `GET /admin-activity-logs`
- `POST /imports/financials/preview`
- `POST /imports/financials/apply`

Login requests must send:

- `identifier`: email address or registration number
- `password`

Financial import spreadsheets may include `student_name`, `student_id`, `email`, `amount_paid`, and optional `total_fees`. The preview endpoint preserves `student_name` in the returned rows.

## Persistence

- Data is stored in SQLite at `data/app.sqlite` by default
- Passwords are hashed before storage
- Bearer sessions expire automatically based on `SESSION_TTL_HOURS`
- Reset the backend state with:

```bash
npm run reset-data
```

- Run an end-to-end backend smoke test with:

```bash
npm run smoke-test
```

`npm run reset-data` clears student records, generated permit artifacts, uploads, sessions, and activity logs. It preserves the customized identity of the three bootstrap admin accounts by ID so admin access is not forced back to the original seed email and password after every reset.

## Uploads

- Applied spreadsheets are copied into `uploads/`
- The import endpoints accept `multipart/form-data` with a `file` field
- Student permit print and download activity is stored in `admin_activity_logs` and visible to admins
- The frontend admin panel can export those permit activity records as CSV for reporting

## Environment Variables

- `PORT`: backend port, default `4000`
- `APP_DB_PATH`: SQLite file path, default `./data/app.sqlite`
- `SESSION_TTL_HOURS`: token lifetime in hours, default `12`
- `CORS_ALLOWED_ORIGINS`: optional comma-separated frontend origin allowlist

## Local Full-Stack Workflow

From the project root you can run the frontend and this backend together with:

```bash
npm run dev:rest
```

The launcher is set up to stream both processes cleanly on Windows and Unix-like shells.

## Deployment

A Dockerfile is included, so you can deploy this backend to any container host.

Typical deployment shape:

1. Build and run the backend with the provided Dockerfile
2. Mount persistent storage for `data/app.sqlite` and `uploads/` if your platform supports it
3. Set `CORS_ALLOWED_ORIGINS` to your frontend domain
4. Point the frontend's `VITE_API_BASE_URL` to the deployed backend URL