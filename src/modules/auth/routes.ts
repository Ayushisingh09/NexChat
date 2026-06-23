import { Router } from 'express';
import { AuthController } from './controller';
import { validateBody } from '../../middlewares/validate';
import { sendOtpSchema, verifyOtpSchema, registerSchema, loginSchema, refreshSchema, changePasswordSchema, forgotPasswordSchema, resetPasswordSchema } from './dto';
import { authLimiter } from '../../middlewares/rateLimit';
import { verifyAccessToken, authHandler } from '../../middlewares/auth';

const router = Router();

router.post('/send-otp', authLimiter, validateBody(sendOtpSchema), AuthController.sendOtp);
router.post('/verify-otp', authLimiter, validateBody(verifyOtpSchema), AuthController.verifyOtp);
router.post('/register', authLimiter, validateBody(registerSchema), AuthController.register);
router.post('/login', authLimiter, validateBody(loginSchema), AuthController.login);
router.post('/refresh', authLimiter, validateBody(refreshSchema), AuthController.refresh);
router.post('/logout', authLimiter, validateBody(refreshSchema), AuthController.logout);
router.post('/forgot-password', authLimiter, validateBody(forgotPasswordSchema), AuthController.forgotPassword);
router.post('/reset-password', authLimiter, validateBody(resetPasswordSchema), AuthController.resetPassword);
router.put('/password', verifyAccessToken, validateBody(changePasswordSchema), authHandler(AuthController.changePassword));

export default router;
