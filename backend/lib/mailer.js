const nodemailer = require('nodemailer');

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
  <!-- อีเมลไคลเอนต์ส่วนใหญ่ (โดยเฉพาะ Outlook) ตัด <link> ฟอนต์ภายนอกทิ้งอยู่ดี แต่บางตัว (Apple Mail, webmail บางเจ้า) รองรับ
       เลยลองโหลดฟอนต์เดียวกับเว็บไว้ ถ้าไม่รองรับก็ fallback ไปที่ font-family stack ปกติ ไม่กระทบอะไร -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Prompt:wght@400;500;600;700;800&family=Sarabun:wght@400;500;600&display=swap" rel="stylesheet">
  <!--[if mso]><style>* { font-family: 'Segoe UI', Tahoma, sans-serif !important; }</style><![endif]-->
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

// ส่งผ่าน Gmail SMTP ตรง ๆ (ไม่ผ่านบริการอีเมลภายนอกอย่าง Resend/Elastic Email อีกแล้ว) ใช้บัญชี Gmail ของค่ายเอง
// ต้องเปิด 2-Step Verification ที่บัญชี Gmail นั้นก่อน แล้วสร้าง App Password ที่ myaccount.google.com/apppasswords
// มาใส่ใน GMAIL_APP_PASSWORD (Gmail ไม่ให้ล็อกอิน SMTP ด้วยรหัสผ่านจริงตรง ๆ ต้องใช้ App Password เท่านั้น)
// สร้าง transporter ครั้งเดียวแล้วใช้ซ้ำ (ไม่สร้างใหม่ทุกครั้งที่ส่ง เปลืองการเชื่อมต่อโดยไม่จำเป็น)
let cachedTransporter = null;
function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    throw new Error('GMAIL_USER หรือ GMAIL_APP_PASSWORD ยังไม่ได้ตั้งค่าใน .env');
  }

  cachedTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
  return cachedTransporter;
}

async function sendMail({ to, subject, html }) {
  const user = process.env.GMAIL_USER;
  const from = process.env.EMAIL_FROM || `PeeTiwNong Camp <${user}>`;
  const transporter = getTransporter();

  try {
    await transporter.sendMail({ from, to, subject, html });
  } catch (error) {
    throw new Error(`ส่งอีเมลไม่สำเร็จ: ${error.message}`);
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

  await sendMail({ to, subject: content.subject, html: renderEmailWrapper(content.heading, body) });
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
  });
}

module.exports = { sendOtpEmail, sendApprovalEmail };
