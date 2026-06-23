import { Router } from 'express';
import { ReportController } from './controller';
import { authHandler, verifyAccessToken } from '../../middlewares/auth';

const router = Router();

router.post('/', verifyAccessToken, authHandler(ReportController.create));

export default router;
