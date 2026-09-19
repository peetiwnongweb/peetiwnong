// สคริปต์ช่วยขอ Google refresh token ครั้งเดียว (รันเองด้วยมือ ไม่ใช่ส่วนหนึ่งของแอปที่รันตลอด)
// ขอสิทธิ์รวม 2 อย่างในโทเคนเดียว: Drive (สำรองข้อมูล/เอกสาร/รูปภาพ) + Gmail Send (ส่ง OTP/อีเมลแจ้งเตือน แทน SMTP ที่ Render แผนฟรีบล็อก)
//
// ก่อนรัน ต้องมีใน .env แล้ว:
//   GOOGLE_OAUTH_CLIENT_ID=...
//   GOOGLE_OAUTH_CLIENT_SECRET=...
// (สร้างได้จาก Google Cloud Console > APIs & Services > Credentials > Create Credentials > OAuth client ID
//  เลือกประเภท "Desktop app" แล้วเปิดใช้งาน Google Drive API + Gmail API ให้โปรเจกต์นั้นก่อน)
//
// วิธีรัน: node scripts/get-drive-refresh-token.js
// สคริปต์จะพิมพ์ลิงก์ให้เปิดในเบราว์เซอร์ (ล็อกอินด้วยบัญชี Google ที่จะใช้เก็บไฟล์สำรอง/ส่งอีเมล) กด "อนุญาต"
// แล้วเบราว์เซอร์จะ redirect กลับมาที่ localhost เอง สคริปต์จะจับรหัสและแลกเป็น refresh token ให้อัตโนมัติ
// เอา refresh token ที่ได้ไปแทนที่ค่าเดิมใน .env ที่ GOOGLE_OAUTH_REFRESH_TOKEN (ตัวเดิมใช้ต่อไม่ได้แล้วเพราะสิทธิ์ไม่ครอบคลุม Gmail)

require('dotenv').config();
const http = require('http');
const { google } = require('googleapis');

const PORT = 53682;
const REDIRECT_URI = `http://localhost:${PORT}`;

async function main() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error('กรุณาใส่ GOOGLE_OAUTH_CLIENT_ID และ GOOGLE_OAUTH_CLIENT_SECRET ใน .env ก่อนรันสคริปต์นี้');
    process.exit(1);
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // บังคับให้ Google ออก refresh_token ให้ใหม่เสมอ แม้เคยอนุญาตแอปนี้มาก่อน
    scope: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/gmail.send',
    ],
  });

  console.log('\nเปิดลิงก์นี้ในเบราว์เซอร์ แล้วล็อกอินด้วยบัญชี Google ที่จะใช้เก็บไฟล์สำรอง:\n');
  console.log(authUrl);
  console.log(`\nกำลังรอ redirect กลับมาที่ ${REDIRECT_URI} ...\n`);

  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, REDIRECT_URI);
      const receivedCode = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        res.end('เกิดข้อผิดพลาด ปิดหน้าต่างนี้แล้วดูรายละเอียดที่ terminal');
        server.close();
        reject(new Error(error));
        return;
      }
      if (!receivedCode) {
        res.end('ไม่พบรหัสยืนยัน');
        return;
      }

      res.end('รับรหัสยืนยันสำเร็จแล้ว ปิดหน้าต่างนี้ได้เลย และกลับไปที่ terminal');
      server.close();
      resolve(receivedCode);
    });
    server.listen(PORT);
  });

  const { tokens } = await oauth2Client.getToken(code);
  if (!tokens.refresh_token) {
    console.error('\nไม่ได้ refresh_token กลับมา (อาจเคยอนุญาตแอปนี้ไปแล้วและ Google ไม่ออกให้ซ้ำ)');
    console.error('ลองไปที่ https://myaccount.google.com/permissions ถอนสิทธิ์แอปนี้ออกก่อน แล้วรันสคริปต์นี้ใหม่');
    process.exit(1);
  }

  console.log('\nสำเร็จ! เอาบรรทัดนี้ไปใส่ในไฟล์ .env:\n');
  console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}`);
  console.log('');
}

main().catch((error) => {
  console.error('ขอ refresh token ไม่สำเร็จ:', error.message);
  process.exit(1);
});
