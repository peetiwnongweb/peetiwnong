-- ตาราง session ของ connect-pg-simple ถูกสร้างไว้แล้วบนฐานข้อมูลจริงโดย server.js (createTableIfMissing) ก่อนจะมี migration นี้
-- migration นี้ถูก mark เป็น applied ด้วย `prisma migrate resolve` โดยไม่รันจริง มีไว้ให้ shadow database ของ prisma migrate dev มีตารางนี้ตรงกับของจริง (กัน drift)
-- DDL ตรงกับ node_modules/connect-pg-simple/table.sql
CREATE TABLE "session" (
    "sid" VARCHAR NOT NULL,
    "sess" JSON NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);

CREATE INDEX "IDX_session_expire" ON "session"("expire");
