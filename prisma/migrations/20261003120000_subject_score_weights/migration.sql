-- สัดส่วนคะแนนอธิบาย:คะแนนสอบ แยกรายวิชา (ผู้สอนกำหนดเอง) + เลือกได้ว่าวิชานี้สอบอธิบายไหม
ALTER TABLE "subjects" ADD COLUMN "has_explanation" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "subjects" ADD COLUMN "explanation_weight" INTEGER NOT NULL DEFAULT 70;
ALTER TABLE "subjects" ADD COLUMN "achievement_weight" INTEGER NOT NULL DEFAULT 30;

-- ตั้งค่าเริ่มต้นของทุกวิชาเดิมให้เท่ากับสัดส่วนกลางที่ใช้อยู่ คะแนนรวมจะไม่เปลี่ยนหลัง migrate
UPDATE "subjects" SET
  "explanation_weight" = s."explanation_weight",
  "achievement_weight" = s."achievement_weight"
FROM "score_weight_settings" s
WHERE s."id" = 1;
