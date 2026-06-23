import { Router } from 'express';
import { ConversationsController } from './controller';
import { verifyAccessToken, authHandler } from '../../middlewares/auth';

const router = Router();

router.use(verifyAccessToken);

router.get('/public-groups', authHandler(ConversationsController.listPublicGroups));
router.get('/', authHandler(ConversationsController.list));
router.post('/', authHandler(ConversationsController.create));
router.post('/:id/join', authHandler(ConversationsController.joinPublicGroup));
router.post('/:id/clear', authHandler(ConversationsController.clear));
router.post('/:id/pin', authHandler(ConversationsController.togglePin));
router.post('/:id/mute', authHandler(ConversationsController.mute));
router.post('/:id/archive', authHandler(ConversationsController.archive));
router.post('/:id/disappearing', authHandler(ConversationsController.setDisappearing));
router.post('/:id/invites', authHandler(ConversationsController.createInvite));
router.get('/:id/invites', authHandler(ConversationsController.listInvites));
router.put('/:id/group', authHandler(ConversationsController.updateGroup));
router.post('/:id/participants', authHandler(ConversationsController.addParticipants));
router.delete('/:id/participants/:userId', authHandler(ConversationsController.removeParticipant));
router.put('/:id/participants/:userId/role', authHandler(ConversationsController.updateParticipantRole));
router.get('/:id/join-requests', authHandler(ConversationsController.listJoinRequests));
router.post('/:id/join-requests/:requestId/resolve', authHandler(ConversationsController.resolveJoinRequest));
router.get('/:id/audit-log', authHandler(ConversationsController.listAuditLogs));
router.post('/:id/notification-preference', authHandler(ConversationsController.updateNotificationPreference));
router.get('/:id/participants', authHandler(ConversationsController.listParticipants));
router.get('/:id/contact-details', authHandler(ConversationsController.getContactDetails));
router.delete('/:id', authHandler(ConversationsController.delete));

export default router;
