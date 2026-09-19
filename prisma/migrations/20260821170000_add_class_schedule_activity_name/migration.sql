ALTER TABLE "class_schedules" ADD COLUMN "activity_name" TEXT;

-- ย้ายข้อมูลเดิม: แถวที่ไม่มีวิชา (subject_id ว่าง) แต่มี note คือใช้ note เป็นชื่อกิจกรรมอยู่แล้ว ย้ายไป activity_name แทน
-- ส่วนแถวที่มีวิชาอยู่แล้ว note ยังคงความหมายเป็นหมายเหตุเหมือนเดิม ไม่ต้องย้าย
UPDATE "class_schedules"
SET "activity_name" = "note", "note" = NULL
WHERE "subject_id" IS NULL AND "note" IS NOT NULL;
