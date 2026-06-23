import { Router } from 'express';
import { MessagesController } from './controller';
import { verifyAccessToken, authHandler } from '../../middlewares/auth';
import { validateBody } from '../../middlewares/validate';
import { createMessageSchema, editMessageSchema } from './dto';
import { messageSendLimiter, messageActionLimiter } from '../../middlewares/rateLimit';

const router = Router();

router.use(verifyAccessToken);

router.post('/forward', messageSendLimiter, authHandler(MessagesController.forward));
router.get('/global-search', authHandler(MessagesController.globalSearch));
router.get('/starred', authHandler(MessagesController.getStarred));
router.delete('/scheduled/:id', authHandler(MessagesController.cancelScheduled));
router.get('/:conversationId/scheduled', authHandler(MessagesController.getScheduled));
router.get('/:conversationId/search', authHandler(MessagesController.search));
router.get('/:conversationId/stats', authHandler(MessagesController.getStats));
router.get('/:conversationId/media', authHandler(MessagesController.listMedia));
router.get('/:conversationId/pinned', authHandler(MessagesController.listPinned));
router.get('/:conversationId', authHandler(MessagesController.list));
router.post('/read/:conversationId', authHandler(MessagesController.markAsRead));
router.post('/', messageSendLimiter, validateBody(createMessageSchema), authHandler(MessagesController.create));
router.patch('/:id', messageActionLimiter, validateBody(editMessageSchema), authHandler(MessagesController.edit));
router.post('/:id/star', messageActionLimiter, authHandler(MessagesController.toggleStar));
router.post('/:id/poll-vote', messageActionLimiter, authHandler(MessagesController.pollVote));
router.get('/:id/poll-votes', authHandler(MessagesController.getPollVotes));
router.post('/:id/reactions', messageActionLimiter, authHandler(MessagesController.toggleReaction));
router.post('/:id/pin', messageActionLimiter, authHandler(MessagesController.togglePin));
router.get('/:id/reactions', authHandler(MessagesController.getReactions));
router.get('/:id/read-by', authHandler(MessagesController.readBy));
router.delete('/:id', authHandler(MessagesController.delete));

export default router;
