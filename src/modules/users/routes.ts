import { Router } from 'express';
import { UsersController } from './controller';
import { verifyAccessToken, authHandler } from '../../middlewares/auth';

const router = Router();

router.use(verifyAccessToken);

router.get('/me', authHandler(UsersController.me));
router.get('/search', authHandler(UsersController.search));
router.post('/fcm-token', authHandler(UsersController.saveFcmToken));
router.put('/profile', authHandler(UsersController.updateProfile));
router.get('/by-username/:username', authHandler(UsersController.getByUsername));
router.get('/sessions', authHandler(UsersController.listSessions));
router.delete('/sessions/:id', authHandler(UsersController.revokeSession));
router.post('/sessions/revoke-others', authHandler(UsersController.revokeOtherSessions));
router.get('/blocked', authHandler(UsersController.getBlocked));
router.post('/block', authHandler(UsersController.block));
router.post('/unblock', authHandler(UsersController.unblock));
router.delete('/me', authHandler(UsersController.deleteAccount));

export default router;
