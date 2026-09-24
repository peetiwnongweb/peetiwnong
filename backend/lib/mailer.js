const { google } = require('googleapis');

const OTP_EMAIL_CONTENT = {
  reset: {
    subject: 'รหัส OTP สำหรับตั้งรหัสผ่านใหม่ - PeeTiwNong Camp',
    heading: 'ตั้งรหัสผ่านใหม่',
  },
  register: {
    subject: 'รหัส OTP สำหรับยืนยันการลงทะเบียน - PeeTiwNong Camp',
    heading: 'ยืนยัน Email',
  },
};

// ห่อเนื้อหาอีเมลด้วยธีมเดียวกับหน้าเว็บ (โทนสีส้ม/กราไฟต์เดียวกับ header ของเว็บ) ใช้ inline style ล้วน
// เพราะอีเมลไคลเอนต์ (โดยเฉพาะ Outlook) ไม่รองรับ flexbox/CSS variable/background-clip:text เลยเลี่ยงของพวกนี้ทั้งหมด
function renderEmailWrapper(heading, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PEETIWNONG Academics Camp</title>
  <!-- ไม่โหลดฟอนต์/สไตล์จากภายนอก (Google Fonts ฯลฯ) - ตัวกรองสแปมให้คะแนนลบกับอีเมลที่ดึงทรัพยากรภายนอก ใช้ font-family stack ของเครื่องแทน -->
</head>
<body style="margin:0; padding:0;">
    <div style="background-color:#f8fafc; padding:32px 16px; font-family:'Prompt', 'Sarabun', 'Segoe UI', Tahoma, sans-serif;">
      <div style="max-width:480px; margin:0 auto; background-color:#ffffff; border-radius:16px; overflow:hidden; border:1px solid #e2e8f0;">
        <div style="background-color:#fff7ed; padding:28px 32px 20px 32px; border-bottom:1px solid #f1f5f9;">
          <div style="font-size:18px; font-weight:800; color:#ff7220; letter-spacing:-0.02em; line-height:1.3;">PEETIWNONG</div>
          <div style="font-size:12px; font-weight:700; color:#64748b; line-height:1.3;">Academics Camp</div>
        </div>
        <div style="padding:32px;">
          <h1 style="margin:0 0 16px 0; font-size:20px; font-weight:700; color:#0f172a;">${heading}</h1>
          ${bodyHtml}
        </div>
        <div style="padding:16px 32px; background-color:#f8fafc; border-top:1px solid #f1f5f9; text-align:center;">
          <span style="font-size:12px; color:#94a3b8;">ค่ายวิชาการ "พี่ติวน้อง" — PEETIWNONG Academics Camp</span>
        </div>
      </div>
    </div>
</body>
</html>`;
}

// ส่งผ่าน Gmail API (ไม่ใช่ SMTP ตรงแบบเดิมอีกต่อไป) เพราะ Render แผนฟรีบล็อกพอร์ต SMTP ขาออกทั้งหมด (25/465/587)
// ทำให้ nodemailer ค้างไม่มีวันเสร็จ - Gmail API เป็น HTTPS ธรรมดา ไม่โดนบล็อก และใช้ credential ชุดเดียวกับ Google Drive ได้เลย
// (GOOGLE_OAUTH_REFRESH_TOKEN ต้องขอสิทธิ์ "gmail.send" เพิ่มด้วย ดู scripts/get-drive-refresh-token.js)
let gmailClientPromise = null;
function getGmailClient() {
  if (!gmailClientPromise) {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
    if (!clientId || !clientSecret || !refreshToken || !process.env.GMAIL_USER) {
      throw new Error('ยังไม่ได้ตั้งค่าการส่งอีเมล (ต้องมี GOOGLE_OAUTH_CLIENT_ID/SECRET/REFRESH_TOKEN และ GMAIL_USER ใน .env)');
    }
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    gmailClientPromise = Promise.resolve(google.gmail({ version: 'v1', auth: oauth2Client }));
  }
  return gmailClientPromise;
}

// เข้ารหัสหัวเรื่องภาษาไทย (RFC 2047 encoded-word) กัน subject เพี้ยน/อ่านไม่ออกในบาง mail client
function encodeSubject(subject) {
  return `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;
}

// base64 ต้องตัดบรรทัดละไม่เกิน 76 ตัวอักษรตามมาตรฐาน MIME (RFC 2045) บรรทัดยาวผิดมาตรฐานโดนตัวกรองสแปมบางเจ้าหักคะแนน
function toBase64Lines(text) {
  return Buffer.from(text, 'utf8').toString('base64').replace(/.{1,76}/g, '$&\r\n').trimEnd();
}

// แนบทั้งเวอร์ชันข้อความธรรมดา (text/plain) และ HTML (multipart/alternative) - อีเมลที่มีแต่ HTML ล้วนโดนตัวกรองสแปมให้คะแนนแย่กว่า
// และบางกล่องจดหมาย (โดยเฉพาะของหน่วยงาน/Outlook) คัดทิ้งหรือส่งเข้าขยะง่ายกว่า
// Gmail API รับอีเมลเป็นข้อความ RFC 2822 ดิบทั้งฉบับ เข้ารหัส base64url (ไม่ใช่ base64 ธรรมดา ต้องแทน +/ ด้วย -_ และตัด padding ออก)
function buildRawMessage({ from, to, subject, html, text }) {
  const boundary = `ptn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeSubject(subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    toBase64Lines(text),
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    toBase64Lines(html),
    `--${boundary}--`,
    '',
  ].join('\r\n');

  return Buffer.from(message, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function sendMail({ to, subject, html, text }) {
  const user = process.env.GMAIL_USER;
  const from = process.env.EMAIL_FROM || `PeeTiwNong Camp <${user}>`;
  const gmail = await getGmailClient();

  try {
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: buildRawMessage({ from, to, subject, html, text }) },
    });
  } catch (error) {
    throw new Error(`ส่งอีเมลไม่สำเร็จ: ${error.message}`);
  }
}

// ส่งผ่าน Brevo (transactional API) จากโดเมนของค่ายเอง ใช้กับ OTP โดยเฉพาะ - อีเมลอัตโนมัติจาก @gmail.com ส่วนตัวถูกหลายกล่องจดหมาย
// (Outlook/อีเมลโรงเรียน) คัดเข้าขยะหรือกักไว้เงียบ ๆ ส่วนอีเมลอื่น (แจ้งผลอนุมัติ) ยังส่งผ่าน Gmail ตามเดิม
// ยังไม่ได้ตั้งค่า BREVO_API_KEY/BREVO_SENDER_EMAIL = ส่ง OTP ผ่าน Gmail ไปก่อน ไม่ทำให้ระบบพัง
function isBrevoConfigured() {
  return !!(process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL);
}

async function sendMailViaBrevo({ to, subject, html, text }) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { email: process.env.BREVO_SENDER_EMAIL, name: process.env.BREVO_SENDER_NAME || 'PEETIWNONG Academics Camp' },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`ส่งอีเมลไม่สำเร็จ (Brevo ${res.status}): ${body.slice(0, 300)}`);
  }
}

// purpose: 'reset' (ลืมรหัสผ่าน) หรือ 'register' (สมัครลงทะเบียนใหม่) แค่เปลี่ยนหัวเรื่อง/ข้อความให้ตรงบริบท เนื้อหา OTP เหมือนกัน
async function sendOtpEmail(to, otpCode, purpose = 'reset') {
  const content = OTP_EMAIL_CONTENT[purpose] || OTP_EMAIL_CONTENT.reset;

  const body = `
    <p style="margin:0 0 20px 0; font-size:14px; color:#334155; line-height:1.6;">รหัส OTP ของคุณคือ:</p>
    <div style="background-color:#fff7ed; border:1px solid #fed7aa; border-radius:12px; padding:20px; text-align:center; margin-bottom:20px;">
      <span style="font-size:36px; font-weight:800; letter-spacing:0.15em; color:#0f172a;">${otpCode}</span>
    </div>
    <p style="margin:0; font-size:13px; color:#94a3b8; line-height:1.6;">รหัสนี้จะหมดอายุภายใน 10 นาที หากคุณไม่ได้เป็นผู้ร้องขอ กรุณาเพิกเฉยต่ออีเมลนี้</p>
  `;

  const text = [
    content.heading,
    '',
    `รหัส OTP ของคุณคือ: ${otpCode}`,
    '',
    'รหัสนี้จะหมดอายุภายใน 10 นาที หากคุณไม่ได้เป็นผู้ร้องขอ กรุณาเพิกเฉยต่ออีเมลนี้',
    '',
    'ค่ายวิชาการ "พี่ติวน้อง" - PEETIWNONG Academics Camp',
  ].join('\n');

  const message = { to, subject: content.subject, html: renderEmailWrapper(content.heading, body), text };
  await (isBrevoConfigured() ? sendMailViaBrevo(message) : sendMail(message));
}

// แจ้งผลตอนบัญชีที่สมัครเองได้รับการอนุมัติแล้ว (เข้าสู่ระบบได้ทันที)
async function sendApprovalEmail(to, role) {
  const roleLabel = role === 'STAFF' ? 'พี่ค่าย' : 'น้องค่าย';

  const body = `
    <p style="margin:0 0 12px 0; font-size:14px; color:#334155; line-height:1.6;">บัญชี${roleLabel}ของคุณได้รับการตรวจสอบและอนุมัติเรียบร้อยแล้ว</p>
    <p style="margin:0; font-size:14px; color:#334155; line-height:1.6;">ตอนนี้คุณสามารถเข้าสู่ระบบด้วยอีเมลและรหัสผ่านที่ตั้งไว้ตอนลงทะเบียนได้ทันทีที่หน้าเว็บไซต์หลักของค่าย</p>
  `;

  await sendMail({
    to,
    subject: 'การลงทะเบียนของคุณได้รับการอนุมัติแล้ว - PeeTiwNong Camp',
    html: renderEmailWrapper('ลงทะเบียนสำเร็จ!', body),
    text: [
      'ลงทะเบียนสำเร็จ!',
      '',
      `บัญชี${roleLabel}ของคุณได้รับการตรวจสอบและอนุมัติเรียบร้อยแล้ว`,
      'ตอนนี้คุณสามารถเข้าสู่ระบบด้วยอีเมลและรหัสผ่านที่ตั้งไว้ตอนลงทะเบียนได้ทันทีที่หน้าเว็บไซต์หลักของค่าย',
      '',
      'ค่ายวิชาการ "พี่ติวน้อง" - PEETIWNONG Academics Camp',
    ].join('\n'),
  });
}

module.exports = { sendOtpEmail, sendApprovalEmail };
