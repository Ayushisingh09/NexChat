import { Router } from 'express';
import { StoriesController } from './controller';
import { verifyAccessToken, authHandler } from '../../middlewares/auth';
import { rateLimitRedis } from '../../middlewares/rateLimit';

const storyPostLimiter = rateLimitRedis({
  name: 'story-post',
  windowSeconds: 60,
  max: 60,
  message: 'You are posting stories too fast. Please wait a moment.',
});

const storyActionLimiter = rateLimitRedis({
  name: 'story-action',
  windowSeconds: 60,
  max: 120,
  message: 'Too many requests. Please wait a moment.',
});

const router = Router();

router.use(verifyAccessToken);

router.post('/', storyPostLimiter, authHandler(StoriesController.create));
router.get('/feed', authHandler(StoriesController.feed));
router.post('/:id/view', storyActionLimiter, authHandler(StoriesController.markViewed));
router.post('/:id/react', storyActionLimiter, authHandler(StoriesController.react));
router.get('/:id/views', authHandler(StoriesController.getViews));
router.delete('/:id', storyActionLimiter, authHandler(StoriesController.delete));

export default router;
