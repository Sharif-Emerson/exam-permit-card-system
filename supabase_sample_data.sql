-- Sample data for the Exam Permit System
--
-- Before running this file:
-- 1. Run supabase_setup.sql first.
-- 2. Create matching users in Supabase Auth.
-- 3. Replace the UUID values below with the real auth.users IDs from your Supabase project.

INSERT INTO profiles (
  id,
  email,
  role,
  name,
  student_id,
  course,
  exam_date,
  exam_time,
  venue,
  seat_number,
  instructions,
  profile_image,
  total_fees,
  amount_paid
) VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    'admin@example.com',
    'admin',
    'Administrator',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    'https://via.placeholder.com/150',
    0.00,
    0.00
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'student1@example.com',
    'student',
    'John Doe',
    'STU001',
    'Computer Science',
    '2026-04-15',
    '10:00 AM',
    'Hall A',
    'A-001',
    'Bring valid ID and arrive 30 minutes early.',
    'https://via.placeholder.com/150',
    3000.00,
    500.00
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'student2@example.com',
    'student',
    'Jane Smith',
    'STU002',
    'Mathematics',
    '2026-04-16',
    '2:00 PM',
    'Hall B',
    'B-002',
    'No calculators allowed. Bring pencils only.',
    'https://via.placeholder.com/150',
    3000.00,
    3000.00
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    'student3@example.com',
    'student',
    'Bob Johnson',
    'STU003',
    'Physics',
    '2026-04-17',
    '9:00 AM',
    'Hall C',
    'C-003',
    'Lab coat required. Safety goggles mandatory.',
    'https://via.placeholder.com/150',
    3000.00,
    1749.50
  )
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  name = EXCLUDED.name,
  student_id = EXCLUDED.student_id,
  course = EXCLUDED.course,
  exam_date = EXCLUDED.exam_date,
  exam_time = EXCLUDED.exam_time,
  venue = EXCLUDED.venue,
  seat_number = EXCLUDED.seat_number,
  instructions = EXCLUDED.instructions,
  profile_image = EXCLUDED.profile_image,
  total_fees = EXCLUDED.total_fees,
  amount_paid = EXCLUDED.amount_paid;

-- Optional sample admin activity log.
-- Replace the IDs below if you changed the sample UUIDs above.
INSERT INTO admin_activity_logs (
  admin_id,
  target_profile_id,
  action,
  details
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  'update_student_financials',
  '{"amount_paid": 500.00}'::jsonb
)
ON CONFLICT DO NOTHING;