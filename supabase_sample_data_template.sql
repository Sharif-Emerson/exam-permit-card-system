-- Supabase seed template for the Exam Permit System
--
-- Use this file if you want clearly labeled placeholders instead of the default
-- numeric placeholder UUIDs in supabase_sample_data.sql.
--
-- How to use:
-- 1. Create these users first in Supabase Authentication:
--      admin@example.com
--      student1@example.com
--      student2@example.com
--      student3@example.com
-- 2. Replace every PLACEHOLDER value below with the real auth.users UUID.
-- 3. Run supabase_setup.sql first.
-- 4. Run this file in the Supabase SQL editor.

-- Replace these values before running:
--   ADMIN_UUID_HERE
--   STUDENT1_UUID_HERE
--   STUDENT2_UUID_HERE
--   STUDENT3_UUID_HERE

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
    'ADMIN_UUID_HERE',
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
    'STUDENT1_UUID_HERE',
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
    'STUDENT2_UUID_HERE',
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
    'STUDENT3_UUID_HERE',
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
  );

INSERT INTO admin_activity_logs (
  admin_id,
  target_profile_id,
  action,
  details
) VALUES (
  'ADMIN_UUID_HERE',
  'STUDENT1_UUID_HERE',
  'update_student_financials',
  '{"amount_paid": 500.00}'::jsonb
);