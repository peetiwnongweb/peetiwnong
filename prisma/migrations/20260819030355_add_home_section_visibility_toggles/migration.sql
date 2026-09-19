-- เพิ่มสวิตช์เปิด/ปิดแยกส่วน "ทำเนียบประธานค่าย" และ "ข่าวสารล่าสุด" ที่หน้าแรก (ทำนองเดียวกับ hero_card_visible)
ALTER TABLE "site_settings" ADD COLUMN "committee_section_visible" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "site_settings" ADD COLUMN "news_section_visible" BOOLEAN NOT NULL DEFAULT true;
