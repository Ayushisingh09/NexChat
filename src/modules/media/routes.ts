import { Router } from 'express';
import express from 'express';
import { MediaController } from './controller';
import { verifyAccessToken, authHandler } from '../../middlewares/auth';
import { mediaLimiter, aiImageLimiter } from '../../middlewares/rateLimit';

const router = Router();

router.post('/presigned-url', verifyAccessToken, mediaLimiter, authHandler(MediaController.getPresignedUrl));
router.post('/generate-image', verifyAccessToken, aiImageLimiter, authHandler(MediaController.generateImage));
router.post('/link-preview', verifyAccessToken, authHandler(MediaController.linkPreview));
router.post('/translate', verifyAccessToken, authHandler(MediaController.translate));

// express.raw() parses the binary body before the global json() middleware sees it
// Authorization is done via the Redis grant (set by getPresignedUrl, which requires JWT). 
// No verifyAccessToken here — the client uploads binary via raw axios.put without auth headers.
router.put('/upload', mediaLimiter, express.raw({ type: '*/*', limit: '50mb' }), MediaController.upload);

export default router;
