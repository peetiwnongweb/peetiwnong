const express = require('express');
const { login, logout, me, updateAvatar, getMyGroupMembers, changePassword, requestRegistrationOtp, completeRegistration, checkRegistrationStatus, forgotPassword, verifyOtp, resetPassword } = require('../controllers/authController');
const { requireAuth } = require('../middleware/requireAuth');
const { loginLimiter, otpRequestLimiter, otpVerifyLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.post('/login', loginLimiter, login);
router.post('/logout', logout);
router.get('/me', me);
router.put('/avatar', requireAuth, updateAvatar);
// ไม่มี PUT /profile หรือ /participant-profile แล้ว - พี่ค่ายและน้องค่ายแก้ข้อมูลส่วนตัวของตัวเองไม่ได้ (ดูอย่างเดียว) แก้รูปโปรไฟล์เองได้เท่านั้น (updateAvatar ด้านบน) ต้องให้แอดมินแก้ข้อมูลอื่นให้ผ่าน /api/users/:id
router.get('/my-group-members', requireAuth, getMyGroupMembers);
router.put('/password', requireAuth, changePassword);
router.post('/register/request-otp', otpRequestLimiter, requestRegistrationOtp);
router.post('/register/complete', otpVerifyLimiter, completeRegistration);
router.get('/register/status', checkRegistrationStatus);
router.post('/forgot-password', otpRequestLimiter, forgotPassword);
router.post('/verify-otp', otpVerifyLimiter, verifyOtp);
router.post('/reset-password', otpVerifyLimiter, resetPassword);

module.exports = router;
