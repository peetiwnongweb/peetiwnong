const express = require('express');
const { login, logout, me, updateAvatar, updateProfile, getMyGroupMembers, changePassword, requestRegistrationOtp, completeRegistration, checkRegistrationStatus, forgotPassword, verifyOtp, resetPassword } = require('../controllers/authController');
const { requireAuth } = require('../middleware/requireAuth');
const { loginLimiter, otpRequestLimiter, otpVerifyLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.post('/login', loginLimiter, login);
router.post('/logout', logout);
router.get('/me', me);
router.put('/avatar', requireAuth, updateAvatar);
router.put('/profile', requireAuth, updateProfile);
// ไม่มี PUT /participant-profile แล้ว - น้องค่ายแก้ข้อมูลโปรไฟล์เองไม่ได้ (ดูอย่างเดียว ดู participant/profile.html) ต้องให้แอดมินแก้ให้
router.get('/my-group-members', requireAuth, getMyGroupMembers);
router.put('/password', requireAuth, changePassword);
router.post('/register/request-otp', otpRequestLimiter, requestRegistrationOtp);
router.post('/register/complete', otpVerifyLimiter, completeRegistration);
router.get('/register/status', checkRegistrationStatus);
router.post('/forgot-password', otpRequestLimiter, forgotPassword);
router.post('/verify-otp', otpVerifyLimiter, verifyOtp);
router.post('/reset-password', otpVerifyLimiter, resetPassword);

module.exports = router;
