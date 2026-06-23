import { prisma } from '../../config/database';

export class FriendsService {
  static async getFriends(userId: string) {
    const friendships = await prisma.friendship.findMany({
      where: { userId },
      include: {
        friend: { select: { id: true, displayName: true, avatar: true, username: true } },
      },
    });
    return friendships.map((f) => f.friend);
  }

  static async getFriendsWithPresence(userId: string) {
    const friendships = await prisma.friendship.findMany({
      where: { userId },
      include: {
        friend: { select: { id: true, displayName: true, avatar: true, username: true, lastSeen: true } },
      },
    });
    return friendships.map((f) => f.friend);
  }

  static async sendRequest(senderId: string, receiverId: string) {
    if (senderId === receiverId) throw Object.assign(new Error('Cannot send friend request to yourself'), { statusCode: 400 });

    const receiver = await prisma.user.findUnique({ where: { id: receiverId }, select: { id: true } });
    if (!receiver) throw Object.assign(new Error('User not found'), { statusCode: 404 });

    // Check existing friendship
    const existing = await prisma.friendship.findUnique({ where: { userId_friendId: { userId: senderId, friendId: receiverId } } });
    if (existing) throw Object.assign(new Error('Already friends'), { statusCode: 409 });

    // Check existing request
    const existingReq = await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId },
        ],
      },
    });
    if (existingReq) {
      if (existingReq.status === 'PENDING') throw Object.assign(new Error('Friend request already pending'), { statusCode: 409 });
      if (existingReq.status === 'ACCEPTED') throw Object.assign(new Error('Already friends'), { statusCode: 409 });
      // Rejected - can re-send, delete old request
      await prisma.friendRequest.delete({ where: { id: existingReq.id } });
    }

    const request = await prisma.friendRequest.create({
      data: { senderId, receiverId, status: 'PENDING' },
      include: {
        sender: { select: { id: true, displayName: true, avatar: true } },
        receiver: { select: { id: true, displayName: true, avatar: true } },
      },
    });
    return request;
  }

  static async acceptRequest(userId: string, requestId: string) {
    const request = await prisma.friendRequest.findUnique({ where: { id: requestId } });
    if (!request) throw Object.assign(new Error('Request not found'), { statusCode: 404 });
    if (request.receiverId !== userId) throw Object.assign(new Error('Not your request'), { statusCode: 403 });
    if (request.status !== 'PENDING') throw Object.assign(new Error('Request already handled'), { statusCode: 400 });

    await prisma.$transaction([
      prisma.friendRequest.update({ where: { id: requestId }, data: { status: 'ACCEPTED' } }),
      prisma.friendship.create({ data: { userId: request.senderId, friendId: request.receiverId } }),
      prisma.friendship.create({ data: { userId: request.receiverId, friendId: request.senderId } }),
    ]);

    return { success: true, senderId: request.senderId };
  }

  static async rejectRequest(userId: string, requestId: string) {
    const request = await prisma.friendRequest.findUnique({ where: { id: requestId } });
    if (!request) throw Object.assign(new Error('Request not found'), { statusCode: 404 });
    if (request.receiverId !== userId) throw Object.assign(new Error('Not your request'), { statusCode: 403 });
    if (request.status !== 'PENDING') throw Object.assign(new Error('Request already handled'), { statusCode: 400 });

    await prisma.friendRequest.update({ where: { id: requestId }, data: { status: 'REJECTED' } });
    return { success: true };
  }

  static async cancelRequest(userId: string, requestId: string) {
    const request = await prisma.friendRequest.findUnique({ where: { id: requestId } });
    if (!request) throw Object.assign(new Error('Request not found'), { statusCode: 404 });
    if (request.senderId !== userId) throw Object.assign(new Error('Not your request'), { statusCode: 403 });

    await prisma.friendRequest.delete({ where: { id: requestId } });
    return { success: true };
  }

  static async removeFriend(userId: string, friendId: string) {
    const result = await prisma.$transaction([
      prisma.friendship.deleteMany({ where: { userId, friendId } }),
      prisma.friendship.deleteMany({ where: { userId: friendId, friendId: userId } }),
    ]);
    // Also delete any accepted friend requests between them
    await prisma.friendRequest.deleteMany({
      where: {
        OR: [
          { senderId: userId, receiverId: friendId, status: 'ACCEPTED' },
          { senderId: friendId, receiverId: userId, status: 'ACCEPTED' },
        ],
      },
    });
    return { success: true, removed: result[0].count > 0 || result[1].count > 0 };
  }

  static async getPendingReceived(userId: string) {
    const requests = await prisma.friendRequest.findMany({
      where: { receiverId: userId, status: 'PENDING' },
      include: {
        sender: { select: { id: true, displayName: true, avatar: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return requests.map((r) => ({ id: r.id, sender: r.sender, createdAt: r.createdAt }));
  }

  static async getPendingSent(userId: string) {
    const requests = await prisma.friendRequest.findMany({
      where: { senderId: userId, status: 'PENDING' },
      include: {
        receiver: { select: { id: true, displayName: true, avatar: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return requests.map((r) => ({ id: r.id, receiver: r.receiver, createdAt: r.createdAt }));
  }
}
