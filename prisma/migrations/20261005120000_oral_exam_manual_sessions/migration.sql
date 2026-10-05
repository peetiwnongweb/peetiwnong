-- รอบสอบอธิบายที่บันทึกผลจากกระดาษ (กรณีระบบ QR ใช้งานไม่ได้)
ALTER TABLE "oral_exam_sessions" ADD COLUMN "is_manual" BOOLEAN NOT NULL DEFAULT false;
