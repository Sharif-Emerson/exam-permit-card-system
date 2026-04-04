# Exam Permit System

Exam Permit System is a React application backed by a REST API for managing student examination permits, fee clearance, protected access, QR verification, and admin-side financial updates for a single campus.

## Features

- REST-based email/password authentication
- Role-based routing for students and administrators
- Student permit dashboard with QR code, print, and PDF download flow
- Student dashboard sections for overview, applications, profile settings, and support
- Student self-service profile updates for name, email, phone number, avatar URL, and password
- Student-side permit application history and local request tracking
- Fee breakdown showing total fees, amount paid, remaining balance, and payment progress
- Print/download restriction until a student is fully cleared
- Admin panel for updating payments and clearing students for printing
- Admin panel support for editing student profile details and total fees
- Admin panel view of recent permit print and download activity
- Admin-side CSV export for permit print and download activity
- Admin template download, drag-and-drop preview, and Excel/CSV bulk financial upload
- Responsive layouts for mobile, tablet, and desktop
- Automated tests for auth, login, protected routes, and dashboard restrictions
- Ready-to-deploy SPA rewrites for Vercel and Netlify
- Local REST stack helpers for running the frontend and example backend together

## Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Vitest and Testing Library
- Playwright
- Lucide React
- qrcode
- papaparse
- read-excel-file

## Prerequisites

- Node.js 24 recommended
- npm

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

   This installs both frontend dependencies and the bundled REST backend dependencies.

2. Create your local environment file:

   ```bash
   copy .env.example .env
   ```

3. For an explicit backend URL, use:
   - `VITE_BACKEND_PROVIDER=rest`
   - `VITE_API_BASE_URL=http://localhost:4000`
   - Optional for QR scanning on phones: `VITE_PERMIT_PUBLIC_BASE_URL=http://<your-lan-ip>:4000`
4. Start the full local stack:

   ```bash
   npm run dev:rest
   ```

For a one-command first-time setup on a new machine, you can also run:

```bash
npm run setup
```

For local real-data work, create `examples/rest-backend/.env.local` with your persistent `APP_DB_PATH` and `BOOTSTRAP_ADMIN_*` values. The backend now loads that file automatically on `npm run dev:rest` and `npm run dev:rest:backend`.

This launcher streams both backend and frontend output and is configured to work from Windows `cmd`, PowerShell, and standard npm shells.

During local Vite development, frontend requests first go through `/api` using the built-in dev proxy, then fall back to `http://<current-host>:4000` when needed. This keeps fetches working on localhost, machine hostnames, and LAN IPs without extra CORS setup.

If the backend is offline or fails to start, the app now returns a direct REST API availability message instead of a bare `502` error.

If `VITE_API_BASE_URL` is set to `http://localhost:4000` during development, the app now still prefers the proxy path for browser requests so other devices on your network do not break.

If a QR code is scanned from another device and it cannot open `localhost`, set `VITE_PERMIT_PUBLIC_BASE_URL` to a URL that is reachable from that device (for example your machine LAN IP).

This starts:

- the frontend in REST mode
- the example backend at `http://localhost:4000`

The example backend reset flow clears student data and generated permit artifacts, but now preserves the customized identity of the three bootstrap admin accounts by ID. That means updated admin email, phone, password, and scope survive `npm run reset-data`.

You can also run the pieces separately:

- `npm run dev`
- `npm run dev:rest:frontend`
- `npm run dev:rest:backend`

## Scripts

- `npm run dev` starts the frontend in REST mode
- `npm run dev:rest` starts the frontend together with the example backend
- `npm run dev:rest:frontend` starts only the frontend
- `npm run dev:rest:backend` starts only the example backend
- `npm run build` creates the production build
- `npm run build:rest` creates the same REST production build explicitly
- `npm run check:rest` validates the example REST backend syntax before you start relying on it
- `npm run preview` previews the production build locally
- `npm run typecheck` runs TypeScript checks
- `npm run lint` runs ESLint
- `npm run test` runs the backend syntax check first, then the Vitest suite
- `npm run test:unit` runs focused unit tests for shared request/auth logic
- `npm run test:component` runs component-focused React tests
- `npm run test:integration` runs the backend API integration script plus the main frontend flow tests
- `npm run test:api` runs dedicated backend API contract checks
- `npm run test:security` runs backend authorization and CORS security checks
- `npm run test:performance` runs lightweight backend response-time smoke checks
- `npm run test:accessibility` runs automated accessibility checks against key screens
- `npm run test:snapshot` validates the current permit-card snapshot baseline
- `npm run test:snapshot:update` refreshes the permit-card snapshot baseline when the UI intentionally changes
- `npm run test:regression` runs high-risk regression coverage for request, dashboard, and admin flows
- `npm run test:e2e` runs real browser end-to-end tests with Playwright
- `npm run test:system` runs the full-stack API, integration, and browser system flow checks
- `npm run test:all` runs the full testing matrix across unit, component, accessibility, snapshot, regression, security, performance, and system suites

## Backend Contract

The frontend expects these REST endpoints:

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

Expected login response fields:

- a token in `token`, `accessToken`, or `access_token`
- a user id in `user.id`, `userId`, or `id`

Expected login request fields:

- `identifier` containing either an email address or registration number
- `password`

## Included Backend

The repository includes:

- [examples/rest-backend/README.md](examples/rest-backend/README.md)
- [examples/rest-backend/server.js](examples/rest-backend/server.js)

The backend starter includes:

- SQLite persistence through Node's built-in `node:sqlite`
- hashed passwords at rest
- expiring bearer-token sessions
- admin-only access checks on sensitive endpoints
- financial spreadsheet preview/apply endpoints
- upload archive storage
- a reset script for restoring seed data
- a Dockerfile for backend deployment

## Application Flow

### Student

1. Sign in with a student account
2. The app loads the student profile from the active REST API
3. The student can review permit status, recent application history, and profile settings
4. The student sees exam details, QR verification data, and current fee status
5. Printing and PDF download remain disabled until `feesBalance === 0`

### Admin

1. Sign in with an admin account
2. View student profiles
3. Edit a student's profile details, registration number, course, and total fees
4. Update amount paid for a student
5. Clear a student automatically by setting `amount_paid` equal to `total_fees`
6. Upload .xlsx or .csv files to bulk-update financial records
7. Each admin financial action is written to `admin_activity_logs`
8. Recent student print and download activity can be exported to CSV for reconciliation or audit work

### Admin Import Template

The admin panel includes:

- a `Download Template` button that exports a ready-to-fill CSV template
- drag-and-drop spreadsheet upload
- a preview table before applying changes
- an `Apply Import` action so admins can review rows first

Use [examples/real-student-import-template.csv](examples/real-student-import-template.csv) as the first real-data import file, and follow [examples/REAL_STUDENT_IMPORT.md](examples/REAL_STUDENT_IMPORT.md) for a safe staged rollout.

Accepted spreadsheet columns:

- `student_name`
- `student_id` or `email` or `id`
- `amount_paid`
- optional `total_fees`

The bundled backend now starts without seeded student records. Use the admin panel to add/import real students after first login with an admin account.

For a real deployment, configure the backend with a persistent SQLite path and your own bootstrap admin credentials instead of using the default example admin accounts. See [examples/rest-backend/README.md](examples/rest-backend/README.md) for the `APP_DB_PATH` and `BOOTSTRAP_ADMIN_*` settings.

## Project Structure

```text
src/
  adapters/
  components/
    AdminPanel.tsx
    Dashboard.tsx
    ErrorBoundary.tsx
    Login.tsx
    ProtectedRoute.tsx
  context/
    AuthContext.tsx
  services/
    adminImportTemplate.ts
    profileService.ts
    spreadsheetImport.ts
  test/
    setup.ts
  App.tsx
  index.css
  main.tsx
  types.ts
examples/
  rest-backend/
    README.md
    package.json
    server.js
  rest-backend-express.js
vercel.json
netlify.toml
```

## Testing

Run the test suite with:

```bash
npm run test
```

Run browser end-to-end coverage with:

```bash
npm run test:e2e
```

Run the full testing pyramid with:

```bash
npm run test:all
```

## Deployment

This project is configured as a single-page application for both:

- [vercel.json](vercel.json)
- [netlify.toml](netlify.toml)

Both configs rewrite frontend routes to `index.html` so client-side routing works in production.

On Vercel, the SPA rewrite must not be treated as an API proxy. If `/api/*` is not backed by a real service, browser `POST` requests such as `/api/auth/login` will fail in preview or production.

For the app to work on any device anywhere, the backend must also be reachable from the public internet. There are two supported deployment models:

1. Set `VITE_API_BASE_URL` to a public backend URL such as `https://api.yourdomain.com`
2. Host the frontend behind a same-origin reverse proxy so browser requests to `/api/*` are forwarded to your backend

To deploy:

1. Deploy the frontend to Vercel or Netlify.
2. Choose one API strategy.

- Use a public backend URL with:
  - `VITE_BACKEND_PROVIDER=rest`
  - `VITE_API_BASE_URL=https://your-backend.example.com`
- Or expose your backend behind the same origin at `/api`.

1. Deploy [examples/rest-backend](examples/rest-backend) as a separate Node service using its Dockerfile.
2. Set backend environment variables:

- `PORT`
- `APP_DB_PATH`
- `APP_UPLOADS_DIR`
- `SESSION_TTL_HOURS`
- `CORS_ALLOWED_ORIGINS`

For Vercel Preview deployments, this repository now includes a same-origin `/api` proxy function. Set `API_BASE_URL=https://your-backend.example.com` in the Vercel project settings for `Preview` and `Production` so the proxy knows where to forward requests. If `API_BASE_URL` is missing, `/api/*` returns a deployment error instead of silently falling through to the SPA.

If you want a faster backend deployment path, this repository now includes a Render Blueprint at [render.yaml](render.yaml). It deploys [examples/rest-backend](examples/rest-backend) with a persistent disk and gives you the backend URL you can paste into Vercel `API_BASE_URL`.

If the frontend is public but the backend is still only running on your laptop, users in other locations will never be able to fetch data from it.

### Public Docker Deployment

This repository now includes a same-origin deployment option for a VPS or container host:

- [docker-compose.deploy.yml](docker-compose.deploy.yml)
- [deploy/frontend.Dockerfile](deploy/frontend.Dockerfile)
- [deploy/nginx.conf](deploy/nginx.conf)

This setup:

- builds the React frontend into an Nginx container
- proxies browser requests from `/api/*` to the backend container
- keeps the backend database and uploads in Docker volumes
- avoids browser CORS issues by serving frontend and API from the same public origin

To run it on a public server:

1. Install Docker and Docker Compose on the host.
2. Copy the repository to the host.
3. Start the stack:

  ```bash
  docker compose -f docker-compose.deploy.yml up -d --build
  ```

1. Point your domain at that server.
2. Put TLS in front of it with your platform load balancer, Caddy, Nginx Proxy Manager, or another reverse proxy.

With this setup, the frontend can use the default `/api` production path and does not need `VITE_API_BASE_URL` at build time.

## Notes

- Student application history and dark-mode preference are stored locally in the browser.
- The QR code encodes a permit verification URL/token for the public permit endpoint.
- The example REST backend uses Node's built-in SQLite support, which is still marked experimental in current Node releases.
