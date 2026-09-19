// นโยบายรหัสผ่านที่ใช้ร่วมกันทั้งเว็บ (สมัครสมาชิก, เปลี่ยนรหัสผ่าน, ลืมรหัสผ่าน, แอดมินสร้าง/แก้ไขบัญชี):
// ต้องยาวอย่างน้อย 8 ตัวอักษร (บังคับเสมอ) และมีอย่างน้อย 3 ใน 4 ประเภทอักขระต่อไปนี้:
// ตัวพิมพ์เล็ก, ตัวพิมพ์ใหญ่, ตัวเลข, อักขระพิเศษ (ไม่บังคับครบทั้ง 4 ประเภท เผื่อบางคนไม่ถนัดจำอักขระพิเศษ)
function isPasswordValid(password) {
  if (typeof password !== 'string' || password.length < 8) return false;
  const categoriesMet = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;
  return categoriesMet >= 3;
}

const PASSWORD_REQUIREMENTS_MESSAGE = 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร และมีอย่างน้อย 3 ใน 4 ประเภทต่อไปนี้: ตัวพิมพ์เล็ก ตัวพิมพ์ใหญ่ ตัวเลข อักขระพิเศษ';

module.exports = { isPasswordValid, PASSWORD_REQUIREMENTS_MESSAGE };
