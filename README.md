# Exam Permit System

Exam Permit System is a React application backed by a REST API for managing student examination permits, fee clearance, protected access, QR verification, and admin-side financial updates for a single campus.

## Features

- REST-based email/password authentication
- Role-based routing for students and administrators
- Student permit dashboard with QR code, print, and PDF download flow
- Student dashboard sections for overview, applications, profile settings, and support
- Student self-service profile updates for name, email, avatar URL, and password
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
2. Create your local environment file:
   ```bash
   copy .env.example .env
   ```
3. For an explicit backend URL, use:
   - `VITE_BACKEND_PROVIDER=rest`
   - `VITE_API_BASE_URL=http://localhost:4000`
4. Start the full local stack:
   ```bash
   npm run dev:rest
   ```

This launcher streams both backend and frontend output and is configured to work on Windows shells as well.

During local Vite development, frontend requests first go through `/api` using the built-in dev proxy, then fall back to `http://<current-host>:4000` when needed. This keeps fetches working on localhost, machine hostnames, and LAN IPs without extra CORS setup.

If the backend is offline or fails to start, the app now returns a direct REST API availability message instead of a bare `502` error.

If `VITE_API_BASE_URL` is set to `http://localhost:4000` during development, the app now still prefers the proxy path for browser requests so other devices on your network do not break.

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
- `npm run test:integration` runs the backend API integration script plus the main frontend flow tests
- `npm run test:e2e` runs real browser end-to-end tests with Playwright
- `npm run test:all` runs unit, integration, and browser E2E suites together

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

- [examples/rest-backend/README.md](c:/Users/kabuy/OneDrive/Desktop/project/examples/rest-backend/README.md)
- [examples/rest-backend/server.js](c:/Users/kabuy/OneDrive/Desktop/project/examples/rest-backend/server.js)

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
4. The student can review permit status, recent application history, and profile settings
5. The student sees exam details, QR verification data, and current fee status
6. Printing and PDF download remain disabled until `feesBalance === 0`

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

Accepted spreadsheet columns:

- `student_name`
- `student_id` or `email` or `id`
- `amount_paid`
- optional `total_fees`

The bundled backend now starts without seeded student records. Use the admin panel to add/import real students after first login with an admin account.

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

- [vercel.json](c:/Users/kabuy/OneDrive/Desktop/project/vercel.json)
- [netlify.toml](c:/Users/kabuy/OneDrive/Desktop/project/netlify.toml)

Both configs rewrite frontend routes to `index.html` so client-side routing works in production.

For the app to work on any device anywhere, the backend must also be reachable from the public internet. There are two supported deployment models:

1. Set `VITE_API_BASE_URL` to a public backend URL such as `https://api.yourdomain.com`
2. Host the frontend behind a same-origin reverse proxy so browser requests to `/api/*` are forwarded to your backend

To deploy:

1. Deploy the frontend to Vercel or Netlify.
2. Choose one API strategy:
  - Set frontend environment variables:
   - `VITE_BACKEND_PROVIDER=rest`
   - `VITE_API_BASE_URL=https://your-backend.example.com`
  - or expose your backend behind the same origin at `/api`
3. Deploy [examples/rest-backend](c:/Users/kabuy/OneDrive/Desktop/project/examples/rest-backend) as a separate Node service using its Dockerfile.
4. Set backend environment variables:
   - `PORT`
   - `APP_DB_PATH`
   - `SESSION_TTL_HOURS`
   - `CORS_ALLOWED_ORIGINS`

If the frontend is public but the backend is still only running on your laptop, users in other locations will never be able to fetch data from it.

### Public Docker Deployment

This repository now includes a same-origin deployment option for a VPS or container host:

- [docker-compose.deploy.yml](c:/Users/kabuy/OneDrive/Desktop/project/docker-compose.deploy.yml)
- [deploy/frontend.Dockerfile](c:/Users/kabuy/OneDrive/Desktop/project/deploy/frontend.Dockerfile)
- [deploy/nginx.conf](c:/Users/kabuy/OneDrive/Desktop/project/deploy/nginx.conf)

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
4. Point your domain at that server.
5. Put TLS in front of it with your platform load balancer, Caddy, Nginx Proxy Manager, or another reverse proxy.

With this setup, the frontend can use the default `/api` production path and does not need `VITE_API_BASE_URL` at build time.

## Notes

- Student application history and dark-mode preference are stored locally in the browser.
- The QR code encodes a permit verification URL/token for the public permit endpoint.
- The example REST backend uses Node's built-in SQLite support, which is still marked experimental in current Node releases.