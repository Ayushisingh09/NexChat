import { Router } from 'express';
import { FriendsController } from './controller';
import { verifyAccessToken, authHandler } from '../../middlewares/auth';
import { validateBody } from '../../middlewares/validate';
import { z } from 'zod';

const router = Router();
router.use(verifyAccessToken);

const sendRequestSchema = z.object({ userId: z.string().uuid() });

router.get('/', authHandler(FriendsController.list));
router.get('/presence', authHandler(FriendsController.listWithPresence));
router.get('/pending/received', authHandler(FriendsController.pendingReceived));
router.get('/pending/sent', authHandler(FriendsController.pendingSent));
router.post('/request', validateBody(sendRequestSchema), authHandler(FriendsController.sendRequest));
router.post('/accept/:requestId', authHandler(FriendsController.acceptRequest));
router.post('/reject/:requestId', authHandler(FriendsController.rejectRequest));
router.post('/cancel/:requestId', authHandler(FriendsController.cancelRequest));
router.delete('/:friendId', authHandler(FriendsController.removeFriend));

export default router;
