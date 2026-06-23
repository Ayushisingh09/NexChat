import { Router } from 'express';
import { ConversationsController } from './controller';
import { verifyAccessToken, authHandler } from '../../middlewares/auth';

const router = Router();

router.use(verifyAccessToken);

router.get('/:token', authHandler(ConversationsController.previewInvite));
router.post('/:token/join', authHandler(ConversationsController.joinViaInvite));
router.delete('/:token', authHandler(ConversationsController.revokeInvite));

export default router;
