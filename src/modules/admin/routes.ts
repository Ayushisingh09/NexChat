import { Router } from 'express';
import { AdminController } from './controller';
import { verifyAdminToken, adminHandler, adminIpWhitelist, checkLoginAttempts, adminRequestLogger } from './middleware';
import { authLimiter } from '../../middlewares/rateLimit';

const router = Router();

// Security middleware for all admin routes
router.use(adminIpWhitelist);
router.use(adminRequestLogger);

// Public routes (with login rate limiting)
router.post('/login', authLimiter, checkLoginAttempts, AdminController.login);

// Protected routes (all require admin token + active session)
router.use(verifyAdminToken);

// Session management
router.post('/logout', adminHandler(AdminController.logout));
router.post('/logout-all', adminHandler(AdminController.logoutAll));
router.get('/sessions', adminHandler(AdminController.getSessions));
router.get('/audit-log', adminHandler(AdminController.getAuditLog));

// Dashboard
router.get('/dashboard', adminHandler(AdminController.getDashboard));

// Users
router.get('/users', adminHandler(AdminController.getUsers));
router.get('/users/:id', adminHandler(AdminController.getUserDetail));
router.post('/users/:id/suspend', adminHandler(AdminController.suspendUser));
router.post('/users/:id/ban', adminHandler(AdminController.banUser));
router.delete('/users/:id', adminHandler(AdminController.deleteUser));

// System
router.get('/health', adminHandler(AdminController.getSystemHealth));
router.get('/db-stats', adminHandler(AdminController.getDbStats));
router.post('/backup', adminHandler(AdminController.backupDatabase));

// Feature Flags
router.get('/features', adminHandler(AdminController.getFeatureFlags));
router.post('/features', adminHandler(AdminController.setFeatureFlag));

// Communities
router.get('/communities', adminHandler(AdminController.getCommunities));

// Reports
router.get('/reports', adminHandler(AdminController.getReports));
router.post('/reports/:id/resolve', adminHandler(AdminController.resolveReport));
router.delete('/reports/:id', adminHandler(AdminController.deleteReport));

// Stories
router.get('/stories', adminHandler(AdminController.getStories));
router.delete('/stories/:id', adminHandler(AdminController.deleteStory));

// Stats
router.get('/stats/messages', adminHandler(AdminController.getMessageStats));
router.get('/stats/users', adminHandler(AdminController.getUserGrowthStats));

export default router;
