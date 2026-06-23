import { Router } from 'express';
import { CallController } from './controller';
import { verifyAccessToken, authHandler } from '../../middlewares/auth';
import { validateBody } from '../../middlewares/validate';
import { createCallSchema } from './dto';

const router = Router();

// LiveKit webhook — must be BEFORE verifyAccessToken (no JWT, LiveKit signs body)
router.post('/webhook', CallController.webhook);

router.use(verifyAccessToken);

router.post('/initiate', validateBody(createCallSchema), authHandler(CallController.initiate));
router.post('/:callId/accept', authHandler(CallController.accept));
router.post('/:callId/reject', authHandler(CallController.reject));
router.post('/:callId/end', authHandler(CallController.end));
router.post('/:callId/cancel', authHandler(CallController.cancel));
router.get('/:callId/token', authHandler(CallController.token));
router.get('/pending', authHandler(CallController.pending));
router.get('/', authHandler(CallController.history));

export default router;
