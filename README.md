# Exam Permit System

Exam Permit System is a React and Supabase application for managing student examination permits, fee clearance, protected access, QR verification, and admin-side financial updates.

## Features

- Supabase email/password authentication
- Role-based routing for students and administrators
- Session restore through Supabase auth persistence
- Student permit dashboard with QR code, print, and PDF download flow
- Fee breakdown showing total fees, amount paid, remaining balance, and payment progress
- Print/download restriction until a student is fully cleared
- Admin panel for updating payments and clearing students for printing
- Responsive layouts for mobile, tablet, and desktop
- Automated tests for auth, login, protected routes, and dashboard restrictions
- Ready-to-deploy SPA rewrites for Vercel and Netlify

## Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Supabase
- React Router
- Vitest and Testing Library
- Lucide React
- react-qr-code
- react-to-print

## Prerequisites

- Node.js 20 or higher
- npm
- A Supabase project

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create your local environment file:
   ```bash
   copy .env.example .env
   ```
3. Add your Supabase values to `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Run the SQL in [supabase_setup.sql](c:/Users/kabuy/OneDrive/Desktop/project/supabase_setup.sql) inside the Supabase SQL editor.
5. Create users in Supabase Auth and insert matching rows into the `profiles` table.
6. If you want starter records, update the UUIDs in [supabase_sample_data.sql](c:/Users/kabuy/OneDrive/Desktop/project/supabase_sample_data.sql) to match your Supabase Auth user IDs and run it.
7. Start the development server:
   ```bash
   npm run dev
   ```

## Scripts

- `npm run dev` starts the Vite dev server
- `npm run build` creates the production build
- `npm run preview` previews the production build locally
- `npm run typecheck` runs TypeScript checks
- `npm run lint` runs ESLint
- `npm run test` runs the Vitest suite

## Supabase Data Model

The SQL setup creates:

- `profiles`: stores both admin and student records, role, permit data, and fee data
- `admin_activity_logs`: stores admin-side changes for auditing

The SQL also enables row-level security so:

- students can read only their own profile
- admins can read all profiles
- admins can update profile financial fields
- admins can insert and read activity logs

## Sample Data

Sample admin and student records are provided in [supabase_sample_data.sql](c:/Users/kabuy/OneDrive/Desktop/project/supabase_sample_data.sql).

If you prefer obvious named placeholders instead of numeric placeholder UUIDs, use [supabase_sample_data_template.sql](c:/Users/kabuy/OneDrive/Desktop/project/supabase_sample_data_template.sql).

It includes:

- 1 admin account profile
- 3 student profiles
- realistic exam and fee values
- an optional sample admin activity log

Before running it, replace the placeholder UUID values with the real IDs from your Supabase Auth users.

The seed file now includes a preflight check that throws a clear error if you forgot to create the auth users or forgot to replace the placeholder UUIDs.

Recommended usage:

- Use [supabase_sample_data.sql](c:/Users/kabuy/OneDrive/Desktop/project/supabase_sample_data.sql) if you want a safer seed with a built-in preflight validation block.
- Use [supabase_sample_data_template.sql](c:/Users/kabuy/OneDrive/Desktop/project/supabase_sample_data_template.sql) if you want a more manual but more readable placeholder-based template.

## Application Flow

### Student

1. Sign in with a Supabase account
2. The app loads the student profile from the `profiles` table
3. The student sees exam details, QR verification data, and current fee status
4. Printing and PDF download remain disabled until `feesBalance === 0`

### Admin

1. Sign in with an admin account
2. View all student profiles
3. Update amount paid for a student
4. Clear a student automatically by setting `amount_paid` equal to `total_fees`
5. Each admin financial action is written to `admin_activity_logs`

## Project Structure

```text
src/
  components/
    AdminPanel.tsx
    Dashboard.tsx
    ErrorBoundary.tsx
    Login.tsx
    ProtectedRoute.tsx
  context/
    AuthContext.tsx
  services/
    profileService.ts
  test/
    setup.ts
  App.tsx
  index.css
  main.tsx
  supabaseClient.ts
  types.ts
supabase_setup.sql
vercel.json
netlify.toml
```

## Testing

The project includes tests for:

- auth session restoration
- login form submission
- protected route redirects
- dashboard print restriction when fees are outstanding

Run them with:

```bash
npm run test
```

## Deployment

This project is configured as a single-page application for both:

- [vercel.json](c:/Users/kabuy/OneDrive/Desktop/project/vercel.json)
- [netlify.toml](c:/Users/kabuy/OneDrive/Desktop/project/netlify.toml)

Both configs rewrite all routes to `index.html` so client-side routing works in production.

## Notes

- If Supabase environment variables are missing, the app shows a configuration error instead of failing silently.
- The QR code encodes the loaded student permit record.
- The current app assumes profiles already exist for authenticated users in Supabase.