-- Custom Supabase seed for the Exam Permit System
--
-- Filled with the real UUIDs provided so far:
--   admin    = 876af05d-da9a-479f-b9a1-73640ab02017
--   student1 = e1489bd8-1687-4465-9b57-7bedf6865e8f
--   student2 = 424425eb-4026-465d-82b6-458f3c7b7573
--   student3 = 30f00bfb-0847-45e4-a410-022348705432
--
-- All required UUIDs are now filled.
--
-- Run order:
-- 1. Run supabase_setup.sql
-- 2. Create the matching auth users in Supabase Authentication
-- 3. Run this file in the Supabase SQL editor

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
    '876af05d-da9a-479f-b9a1-73640ab02017',
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
    'e1489bd8-1687-4465-9b57-7bedf6865e8f',
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
    '424425eb-4026-465d-82b6-458f3c7b7573',
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
    '30f00bfb-0847-45e4-a410-022348705432',
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

INSERT INTO admin_activity_logs (
  admin_id,
  target_profile_id,
  action,
  details
) VALUES (
  '876af05d-da9a-479f-b9a1-73640ab02017',
  'e1489bd8-1687-4465-9b57-7bedf6865e8f',
  'update_student_financials',
  '{"amount_paid": 500.00}'::jsonb
);