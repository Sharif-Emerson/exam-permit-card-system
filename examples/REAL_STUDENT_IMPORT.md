# Real Student Import

Use [examples/real-student-import-template.csv](c:/Users/kabuy/OneDrive/Desktop/project/examples/real-student-import-template.csv) as the first import file for real data.

## Required columns for new student creation

- `student_name`
- `student_id`
- `email`
- `course`
- `total_fees`

## Recommended columns for real onboarding

- `student_category`
- `phone_number`
- `program`
- `college`
- `department`
- `semester`
- `password`
- `course_units`

## Optional exam scheduling columns

- `instructions`
- `exam_date`
- `exam_time`
- `venue`
- `seat_number`

## Safe first import workflow

1. Start with 3 to 5 real students, not the full population.
2. Keep `student_id` and `email` unique.
3. Confirm `total_fees` and `amount_paid` are numeric only.
4. Use `student_category` values `local` or `international` only.
5. Upload in the admin Bulk Import screen and review the preview before applying.
6. After import, verify a few student records in the Students view before importing the next batch.