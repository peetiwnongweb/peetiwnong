/*
  Warnings:

  - You are about to drop the `camp_generation_settings` table. All the data in the column will be lost. Superseded by the `camps` table (added in the previous migration) — "ครั้งที่จัดค่ายล่าสุด" is now derived from `MAX(camps.generation_no)` instead of a standalone singleton value.

*/
-- DropTable
DROP TABLE "camp_generation_settings";
