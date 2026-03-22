# Exam Permit System

Exam Permit System is a React application backed by a REST API for managing student examination permits, fee clearance, protected access, QR verification, and admin-side financial updates for a single campus.

## Features

- REST-based email/password authentication
- Role-based routing for students and administrators
- Student permit dashboard with QR code, print, and PDF download flow
- Fee breakdown showing total fees, amount paid, remaining balance, and payment progress
- Print/download restriction until a student is fully cleared
- Admin panel for updating payments and clearing students for printing
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
3. The default frontend configuration is:
   - `VITE_BACKEND_PROVIDER=rest`
   - `VITE_API_BASE_URL=http://localhost:4000`
4. Start the full local stack:
   ```bash
   npm run dev:rest
   ```

This launcher streams both backend and frontend output and is configured to work on Windows shells as well.

This starts:

- the frontend in REST mode
- the example backend at `http://localhost:4000`

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
- `npm run preview` previews the production build locally
- `npm run typecheck` runs TypeScript checks
- `npm run lint` runs ESLint
- `npm run test` runs the Vitest suite

## Backend Contract

The frontend expects these REST endpoints:

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

Expected login response fields:

- a token in `token`, `accessToken`, or `access_token`
- a user id in `user.id`, `userId`, or `id`

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
3. The student sees exam details, QR verification data, and current fee status
4. Printing and PDF download remain disabled until `feesBalance === 0`

### Admin

1. Sign in with an admin account
2. View student profiles
3. Update amount paid for a student
4. Clear a student automatically by setting `amount_paid` equal to `total_fees`
5. Upload .xlsx or .csv files to bulk-update financial records
6. Each admin financial action is written to `admin_activity_logs`
7. Recent student print and download activity can be exported to CSV for reconciliation or audit work

### Admin Import Template

The admin panel includes:

- a `Download Template` button that exports a ready-to-fill CSV template
- drag-and-drop spreadsheet upload
- a preview table before applying changes
- an `Apply Import` action so admins can review rows first

Accepted spreadsheet columns:

- `student_id` or `email` or `id`
- `amount_paid`
- optional `total_fees`

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

## Deployment

This project is configured as a single-page application for both:

- [vercel.json](c:/Users/kabuy/OneDrive/Desktop/project/vercel.json)
- [netlify.toml](c:/Users/kabuy/OneDrive/Desktop/project/netlify.toml)

Both configs rewrite all routes to `index.html` so client-side routing works in production.

To deploy:

1. Deploy the frontend to Vercel or Netlify.
2. Set frontend environment variables:
   - `VITE_BACKEND_PROVIDER=rest`
   - `VITE_API_BASE_URL=https://your-backend.example.com`
3. Deploy [examples/rest-backend](c:/Users/kabuy/OneDrive/Desktop/project/examples/rest-backend) as a separate Node service using its Dockerfile.
4. Set backend environment variables:
   - `PORT`
   - `APP_DB_PATH`
   - `SESSION_TTL_HOURS`
   - `CORS_ALLOWED_ORIGINS`

## Notes

- The QR code encodes the loaded student permit record.
- The example REST backend uses Node's built-in SQLite support, which is still marked experimental in current Node releases.