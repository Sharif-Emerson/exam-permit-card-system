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

## Demo Accounts

- `admin@example.com` / `Permit@2026`
- `student1@example.com` / `Permit@2026`
- `student2@example.com` / `Permit@2026`
- `student3@example.com` / `Permit@2026` (fees fully cleared)

## Included Endpoints

- `GET /health`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`
- `GET /profiles/:id`
- `GET /profiles?role=student`
- `PATCH /profiles/:id/financials`
- `POST /admin-activity-logs`
- `GET /admin-activity-logs`
- `POST /imports/financials/preview`
- `POST /imports/financials/apply`

## Persistence

- Data is stored in SQLite at `data/app.sqlite` by default
- Passwords are hashed before storage
- Bearer sessions expire automatically based on `SESSION_TTL_HOURS`
- Reset the backend state with:

```bash
npm run reset-data
```

- Run an end-to-end import smoke test with:

```bash
npm run smoke-test
```

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