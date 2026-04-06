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

- SQLite persistence through `better-sqlite3`
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
3. Deploy [examples/rest-backend](examples/rest-backend) as a separate Node service using its Dockerfile.
4. Set backend environment variables:
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

## 3.7 Functional Requirements

Functional requirements define the specific behaviours, operations, and capabilities that the system must provide to satisfy the needs of its intended users. The Exam Permit System serves two distinct user roles — students and administrators — and must fulfil a set of clearly defined functions for each. The requirements that follow are derived from the system's design, implemented features, and the operational needs of a university examination administration context.

**3.7.1 Authentication and Session Management**

FR-01: The system shall allow users to authenticate using a registered email address, phone number, or student registration number together with a password.

FR-02: The system shall validate credentials against the backend user store and return an appropriate error message when invalid credentials are submitted, without disclosing whether the email or password was the incorrect field.

FR-03: The system shall issue a short-lived bearer token upon successful authentication and use it to authorise all subsequent API requests.

FR-04: The system shall automatically expire sessions after a configurable period of inactivity and require the user to re-authenticate.

FR-05: The system shall support university single sign-on (SSO) via an OpenID Connect (OIDC) flow, allowing eligible institutions to authenticate users through their existing identity provider.

FR-06: The system shall enforce role-based routing, redirecting authenticated students to the student dashboard and authenticated administrators to the admin panel immediately after login.

FR-07: The system shall prevent unauthenticated users from accessing any protected route and redirect them to the login page.

FR-08: The system shall provide a password reset flow that allows a registered user to set a new password by supplying a verification credential.

FR-09: The system shall prompt an administrator to change their password on first login if the account was provisioned with a temporary credential.

**3.7.2 Student Portal — Permit and Eligibility**

FR-10: The system shall display the student's current examination permit status prominently on the dashboard, indicating whether the student is cleared, has an outstanding fee balance, or is subject to a print restriction.

FR-11: The system shall display the student's fee summary, including total assessed fees, amount paid, outstanding balance, and a visual payment progress indicator.

FR-12: The system shall allow a student whose fee balance is zero and who has not exceeded their monthly print limit to print their examination permit directly from the browser.

FR-13: The system shall allow an eligible student to download their examination permit as a PDF file.

FR-14: The system shall enforce a monthly print limit per student and disable the print and download actions once the limit is reached, displaying a clear message stating the reason.

FR-15: The system shall generate and display a QR code on the permit card that encodes a publicly accessible verification URL unique to each student's permit token.

FR-16: The system shall display the student's examination details on the permit card, including course name, programme, examination date, time, venue, and seat number.

FR-17: The system shall display all registered course units for the student on the permit card.

FR-18: The system shall block permit printing for students whose enrollment status is recorded as graduated or on leave, and display a descriptive message directing them to the relevant administrative office.

**3.7.3 Student Portal — Profile and Support**

FR-19: The system shall allow a student to view their own profile information, including name, student ID, email address, phone number, department, programme, college, and avatar.

FR-20: The system shall allow a student to update their own name, email address, phone number, avatar URL, and password through a self-service profile settings interface.

FR-21: The system shall display the student's permit print and download history, including the semester associated with each recorded action.

FR-22: The system shall provide a support section within the student dashboard where the student can view frequently asked questions and contact information for relevant university support desks.

FR-23: The system shall allow a student to submit a support request with a subject, description, and optional file attachment.

**3.7.4 Administrator Portal — Student Management**

FR-24: The system shall display a paginated list of all registered student profiles in the admin panel, supporting search by name, email, or registration number.

FR-25: The system shall allow an administrator to filter the student list by department, programme, course, semester, student category, enrollment status, and fee clearance status.

FR-26: The system shall allow an authorised administrator to create a new student profile by entering the student's name, email address, registration number, programme, course, department, examination details, and initial fee values.

FR-27: The system shall allow an authorised administrator to edit an existing student's profile details, including name, email address, phone number, registration number, programme, course, department, examination schedule, and avatar.

FR-28: The system shall allow an authorised administrator to soft-delete a student profile, placing it in a recoverable trash state rather than permanently removing it.

FR-29: The system shall allow an authorised administrator to restore a soft-deleted student profile from the trash or permanently purge it.

FR-30: The system shall allow an authorised administrator to grant a student additional permit print allocations beyond the standard monthly limit.

**3.7.5 Administrator Portal — Financial Management**

FR-31: The system shall allow an authorised administrator to update a student's amount paid and total fees individually through a financial edit form.

FR-32: The system shall automatically clear a student for permit printing when their recorded payment is set equal to or greater than their total assessed fees, without requiring a separate clearance action.

FR-33: The system shall allow an authorised administrator to upload a financial data file in Excel (.xlsx) or CSV (.csv) format for bulk updating of student payment records.

FR-34: The system shall parse the uploaded spreadsheet and display a preview table of all matched and unmatched rows before any changes are applied to the database.

FR-35: The system shall apply bulk financial changes to the database only after the administrator explicitly confirms the import from the preview screen.

FR-36: The system shall provide an administrator-downloadable CSV import template pre-populated with the correct column headers and formatting for financial data submission.

**3.7.6 Administrator Portal — Audit and Reporting**

FR-37: The system shall record every administrator-initiated financial action — including payment updates, profile edits, and bulk imports — to an activity log that captures the administrator identity, affected student, action type, and timestamp.

FR-38: The system shall display the recent activity log to authorised administrators within the admin panel.

FR-39: The system shall allow an authorised administrator to export the permit print and download activity history to a CSV file for institutional audit and reconciliation.

FR-40: The system shall display summary statistics on the admin dashboard, including the number of students cleared, those with outstanding balances, and recent permit activity counts.

**3.7.7 Administrator Portal — Access Control**

FR-41: The system shall support multiple administrator permission levels, including super-admin, registrar, finance, operations, and assistant-admin, each carrying a defined set of permitted actions.

FR-42: The system shall prevent an administrator from performing actions outside their assigned permission scope and return an appropriate error if an unauthorised action is attempted.

FR-43: The system shall support assistant administrator roles that restrict access to student records belonging to specific departments only.

**3.7.8 Permit Verification**

FR-44: The system shall provide a public permit verification endpoint that accepts a student's permit token via QR code scan and returns the permit details, enabling invigilators to verify a student's examination eligibility without requiring a login.

**3.7.9 General System Requirements**

FR-45: The system shall present a responsive user interface that functions correctly on mobile, tablet, and desktop screen sizes.

FR-46: The system shall support a light and dark display mode, with the user's preference persisted locally in the browser.

FR-47: The system shall display descriptive error messages to the user when a backend operation fails, without exposing internal implementation details.

FR-48: The system shall preserve unsaved form changes and prompt the user for confirmation before navigating away from a page with pending edits.

## 3.8 Non-Functional Requirements

Non-functional requirements define the quality attributes, constraints, and operational standards that the system must satisfy beyond its core functional behaviour. Where functional requirements specify what the system does, non-functional requirements specify how well it does it. The following requirements govern the performance, security, usability, reliability, maintainability, and portability of the Exam Permit System.

**3.8.1 Performance**

NFR-01: The system shall load the student dashboard and admin panel initial view within three seconds on a standard broadband connection under normal server load.

NFR-02: The system shall return API responses for read operations — such as fetching a student profile or listing student records — within two seconds under a concurrent load of at least fifty active users.

NFR-03: The system shall generate and display a permit QR code within one second of the student permit data being received from the backend.

NFR-04: The financial spreadsheet preview operation shall parse and display results for files containing up to five hundred student rows within five seconds.

**3.8.2 Security**

NFR-05: All passwords shall be stored exclusively as salted, hashed values using a key-derivation function; plaintext passwords shall never be persisted to the database or written to application logs.

NFR-06: All session tokens shall expire after a configurable period and shall be invalidated on explicit sign-out, preventing token reuse after a session ends.

NFR-07: Every API endpoint that modifies or returns sensitive data shall enforce server-side authentication and role-based authorisation checks; client-side role filtering alone shall not be considered sufficient protection.

NFR-08: The system shall enforce rate limiting on the login endpoint to mitigate brute-force credential attacks.

NFR-09: The system shall not expose internal error messages, stack traces, or database schema details in API error responses returned to the client.

NFR-10: Cross-Origin Resource Sharing (CORS) shall be explicitly configured on the backend to restrict API access to known, authorised origins only.

NFR-11: All data transmitted between the client and the server in a production deployment shall be encrypted using TLS (HTTPS); unencrypted HTTP communication shall not be permitted in production.

**3.8.3 Usability**

NFR-12: The user interface shall be fully operable on screen widths from 320 px (small mobile) to 1920 px (large desktop) without horizontal scrolling or loss of content.

NFR-13: All interactive elements — including buttons, form fields, and navigation items — shall meet a minimum touch target size of 44 × 44 pixels to support mobile and touch-based interaction.

NFR-14: Error messages displayed to the user shall be written in plain language that clearly describes the problem and, where possible, the corrective action required.

NFR-15: The system shall provide visual feedback — such as a loading indicator or disabled state — whenever an asynchronous operation is in progress, preventing duplicate submissions.

NFR-16: The system shall support a light and a dark colour scheme, persisting the user's choice across sessions without requiring re-selection after each login.

NFR-17: Key screens — including the login page, student dashboard, and permit card — shall pass automated accessibility checks for colour contrast, keyboard navigability, and ARIA labelling in conformance with WCAG 2.1 Level AA.

**3.8.4 Reliability and Availability**

NFR-18: The system shall be designed for continuous availability and shall be deployable to hosting environments that provide an uptime service-level agreement of at least 99.5%.

NFR-19: The application shall handle backend unavailability gracefully, presenting a descriptive error message to the user rather than an unhandled exception or blank screen.

NFR-20: The system shall preserve data consistency during bulk financial imports by executing the apply step as an atomic operation; a partial failure shall not leave the database in an inconsistent state.

NFR-21: The backend database shall be stored on a persistent volume that survives container restarts and redeployments, ensuring that no student or financial data is lost due to infrastructure changes.

**3.8.5 Maintainability**

NFR-22: The frontend codebase shall be written in TypeScript with strict type checking enabled, reducing the likelihood of runtime type errors and improving long-term maintainability.

NFR-23: The system shall include an automated test suite covering unit, component, integration, regression, security, accessibility, and end-to-end scenarios, enabling changes to be validated quickly without manual regression testing.

NFR-24: The frontend and backend shall communicate exclusively through a documented REST API contract, allowing either component to be replaced or upgraded independently without requiring simultaneous changes to the other.

NFR-25: Application configuration — including API base URL, session duration, CORS origins, and database path — shall be provided through environment variables rather than hard-coded values, enabling the system to be reconfigured for different deployment environments without modifying source code.

**3.8.6 Scalability**

NFR-26: The backend shall support horizontal scaling by remaining stateless with respect to session data; authentication state shall be carried in the bearer token rather than stored in server memory.

NFR-27: The student list endpoint shall support server-side pagination so that the system can manage institutions with thousands of student records without degrading response times or client memory consumption.

**3.8.7 Portability and Deployability**

NFR-28: The frontend shall be deployable as a static single-page application to any hosting platform that supports SPA route rewrites, including Vercel, Netlify, and self-hosted Nginx.

NFR-29: The backend shall be containerised using Docker, enabling it to be deployed consistently across development, staging, and production environments regardless of the host operating system.

NFR-30: The system shall support a same-origin deployment model — where the frontend and backend are served from the same domain — to eliminate cross-origin browser restrictions in production without requiring CORS configuration.

## 3.9 Ethical Consideration

The development of software systems that process personal and financial data carries significant ethical responsibilities. The Exam Permit System was designed with these responsibilities in mind, ensuring that the collection, storage, and use of student information adheres to principles of privacy, fairness, security, and accountability. This section outlines the ethical considerations that informed the design and implementation of the system.

**3.9.1 Data Privacy and Minimal Collection**

A fundamental principle guiding the design of this system is data minimisation — the practice of collecting only the information that is strictly necessary to fulfil the system's purpose. In the context of the Exam Permit System, the data required to determine a student's eligibility for an examination permit is limited to: full name, email address, phone number, registration number, total assessed fees, and amount paid. No biometric data, geographic location data, or behavioural analytics are collected at any point. Furthermore, non-sensitive preferences such as application history and interface settings are stored exclusively within the user's own browser using local storage mechanisms and are never transmitted to the server. This approach minimises the exposure of personal data and reduces the potential harm in the event of a security incident.

**3.9.2 Data Security and Integrity**

The system applies industry-standard measures to protect personal and financial data at rest and in transit. All user passwords are processed through a key-derivation function prior to being written to the database, ensuring that plaintext credentials are never stored or logged. Session authentication is implemented using short-lived bearer tokens that expire automatically, limiting the window of exposure in the event that a token is compromised. Server-side role validation is enforced on every endpoint that reads or modifies sensitive data, preventing a student account from accessing another student's records or any administrative functionality. These controls collectively ensure that the system's data integrity and confidentiality obligations are met at the infrastructure level rather than relying solely on client-side enforcement.

**3.9.3 Role-Based Access Control and the Principle of Least Privilege**

The system enforces strict role-based access control across all operations. Student accounts are authorised only to view and update their own profile information. Administrative accounts are granted the ability to manage financial records and student clearance status; however, individual administrator roles carry different levels of permission, and no role is able to exceed its defined scope. This implementation of the principle of least privilege reduces the risk of accidental or deliberate misuse of elevated access. Every financial modification performed by an administrator is recorded in a dedicated activity log that captures the identity of the acting administrator, the affected student record, and a timestamp of the action. This log is immutable from within the application and exists to create a clear accountability trail.

**3.9.4 Fairness and Transparency in Financial Decision-Making**

A critical ethical concern in systems of this nature is the potential for opaque or biased decision-making that could unjustly affect a student's ability to sit an examination. To address this, the fee clearance decision within the system is fully deterministic and automated: a student is eligible to print or download their permit if and only if their recorded payment equals or exceeds their total assessed fees. No subjective judgement or undocumented manual intervention is possible without a corresponding logged administrative action. Students are provided with an itemised view of their financial status at all times, including total fees, amount paid, and remaining balance. This transparency ensures that students are always informed of the specific reason their permit is withheld and are not subject to unexplained restrictions.

**3.9.5 Human Oversight in Automated Processes**

Despite the system's use of automated processing, critical actions are designed to keep a human decision-maker in the loop. Bulk financial imports — which have the potential to affect a large number of student records simultaneously — are staged behind a mandatory preview step. Administrators are required to review the parsed data and confirm the changes before any records are modified in the database. This design choice reflects a deliberate commitment to responsible automation, ensuring that errors in imported data can be identified and corrected prior to application rather than discovered after the fact.

**3.9.6 Regulatory and Institutional Compliance**

The system has been designed with awareness of data-protection obligations consistent with frameworks such as the General Data Protection Regulation (GDPR). Student records may be updated or corrected by both the student and an authorised administrator, supporting the right to data accuracy. The system does not transmit personal data to third-party services. The institution deploying the system assumes the role of data controller and bears responsibility for ensuring that its use conforms to the applicable legal and regulatory requirements of the jurisdiction in which it operates. Deployment documentation included with the repository directs operators to configure the system with appropriately restricted credentials and persistent storage paths, rather than retaining default example values that may not meet institutional security standards.

## Notes

- Student application history and dark-mode preference are stored locally in the browser.
- The QR code encodes a permit verification URL/token for the public permit endpoint.
- The example REST backend uses Node's built-in SQLite support, which is still marked experimental in current Node releases.
