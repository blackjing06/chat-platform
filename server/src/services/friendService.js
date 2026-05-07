const { Op } = require('sequelize');
const { Friendship, FriendGroup, User } = require('../models');
const { getIO } = require('../socket'); // 用于实时通知

// 发送好友请求
async function sendRequest(fromUserId, toUserId, groupId, message) {
  // 检查是否已有关系记录（pending/accepted/rejected）
  const existing = await Friendship.findOne({
    where: {
      user_id: fromUserId,
      friend_id: toUserId,
    },
  });
  if (existing) {
    throw new Error('已存在好友请求或已是好友');
  }

  // 确保接收方存在
  const toUser = await User.findByPk(toUserId);
  if (!toUser) throw new Error('用户不存在');

  // 确保分组属于发送者
  const group = await FriendGroup.findOne({
    where: { id: groupId, user_id: fromUserId },
  });
  if (!group) throw new Error('分组不存在');

  const friendship = await Friendship.create({
    user_id: fromUserId,
    friend_id: toUserId,
    group_id: groupId,
    status: 'pending',
    request_message: message || '',
  });

  // 实时通知接收方
  const io = getIO();
  io.to(`user:${toUserId}`).emit('notification', {
    type: 'friend_request',
    data: {
      friendshipId: friendship.id,
      fromUser: {
        id: fromUserId,
        nickname: (await User.findByPk(fromUserId)).nickname,
      },
      message: friendship.request_message,
      createdAt: friendship.created_at,
    },
  });

  return friendship;
}

// 接受好友请求
async function acceptRequest(friendshipId, userId) {
  const friendship = await Friendship.findByPk(friendshipId);
  if (!friendship) throw new Error('请求不存在');
  if (friendship.friend_id !== userId) throw new Error('无权限');
  if (friendship.status !== 'pending') throw new Error('请求已处理');

  friendship.status = 'accepted';
  await friendship.save();

    // 为接收方创建反向好友关系
    const defaultGroup = await FriendGroup.findOne({
        where: { user_id: userId, name: '我的好友' }
    });
    await Friendship.create({
        user_id: userId,
        friend_id: friendship.user_id,
        group_id: defaultGroup.id,
        status: 'accepted',
        request_message: '',
    });

  // 通知发送方
  const io = getIO();
  io.to(`user:${friendship.user_id}`).emit('notification', {
    type: 'friend_accepted',
    data: {
      friendshipId: friendship.id,
      friend: {
        id: userId,
        nickname: (await User.findByPk(userId)).nickname,
      },
    },
  });

  return friendship;
}

// 拒绝好友请求
async function rejectRequest(friendshipId, userId) {
  const friendship = await Friendship.findByPk(friendshipId);
  if (!friendship) throw new Error('请求不存在');
  if (friendship.friend_id !== userId) throw new Error('无权限');
  if (friendship.status !== 'pending') throw new Error('请求已处理');

  friendship.status = 'rejected';
  await friendship.save();

  return friendship;
}

// 重新发送验证信息（仅发送方可操作）
async function sendRequest(fromUserId, toUserId, groupId, message) {
    // 检查是否已有关系记录
    const existing = await Friendship.findOne({
        where: { user_id: fromUserId, friend_id: toUserId }
    });

    if (existing) {
        if (existing.status === 'accepted') {
            throw new Error('你们已经是好友了');
        } else if (existing.status === 'pending') {
            throw new Error('好友请求已发送，请等待对方处理');
        } else if (existing.status === 'rejected') {
            // 被拒绝后允许重新发送：更新状态、消息、时间
            existing.status = 'pending';
            existing.request_message = message || existing.request_message;
            existing.updated_at = new Date();
            await existing.save();

            const io = getIO();
            io.to(`user:${toUserId}`).emit('notification', {
                type: 'friend_request',
                data: {
                    friendshipId: existing.id,
                    fromUser: {
                        id: fromUserId,
                        nickname: (await User.findByPk(fromUserId)).nickname,
                    },
                    message: existing.request_message,
                    createdAt: existing.updated_at,
                },
            });

            return existing;
        }
    }

    // 无历史记录，新建
    const toUser = await User.findByPk(toUserId);
    if (!toUser) throw new Error('用户不存在');

    const group = await FriendGroup.findOne({
        where: { id: groupId, user_id: fromUserId },
    });
    if (!group) throw new Error('分组不存在');

    const friendship = await Friendship.create({
        user_id: fromUserId,
        friend_id: toUserId,
        group_id: groupId,
        status: 'pending',
        request_message: message || '',
    });

    const io = getIO();
    io.to(`user:${toUserId}`).emit('notification', {
        type: 'friend_request',
        data: {
            friendshipId: friendship.id,
            fromUser: {
                id: fromUserId,
                nickname: (await User.findByPk(fromUserId)).nickname,
            },
            message: friendship.request_message,
            createdAt: friendship.created_at,
        },
    });

    return friendship;
}

// 删除好友（任意一方操作，物理删除关系）
async function deleteFriend(friendshipId, userId) {
    const friendship = await Friendship.findByPk(friendshipId);
    if (!friendship) throw new Error('关系不存在');
    if (friendship.user_id !== userId && friendship.friend_id !== userId) {
        throw new Error('无权限');
    }

    const otherId = friendship.user_id === userId ? friendship.friend_id : friendship.user_id;

    // 删除当前用户持有的记录
    await friendship.destroy();

    // 同时删除对方的反向记录（如果存在）
    await Friendship.destroy({
        where: {
            user_id: otherId,
            friend_id: userId,
            status: 'accepted',
        },
    });

    const io = getIO();
    io.to(`user:${otherId}`).emit('notification', {
        type: 'friend_deleted',
        data: { friendshipId: friendship.id, deletedBy: userId },
    });

    return { deleted: true };
}

// 移动好友到不同分组
async function moveFriend(friendshipId, userId, newGroupId) {
  const friendship = await Friendship.findByPk(friendshipId);
  if (!friendship) throw new Error('关系不存在');
  if (friendship.user_id !== userId) throw new Error('只能移动自己分组中的好友');

  // 检查新分组是否属于该用户
  const group = await FriendGroup.findOne({ where: { id: newGroupId, user_id: userId } });
  if (!group) throw new Error('分组不存在');

  friendship.group_id = newGroupId;
  await friendship.save();
  return friendship;
}

// 分组管理
async function createGroup(userId, name) {
  const existing = await FriendGroup.findOne({ where: { user_id: userId, name } });
  if (existing) throw new Error('分组名已存在');
  const group = await FriendGroup.create({ user_id: userId, name });
  return group;
}

async function renameGroup(groupId, userId, newName) {
  const group = await FriendGroup.findOne({ where: { id: groupId, user_id: userId } });
  if (!group) throw new Error('分组不存在或无权操作');
  group.name = newName;
  await group.save();
  return group;
}
async function resendRequest(friendshipId, userId, newMessage) {
    const friendship = await Friendship.findByPk(friendshipId);
    if (!friendship) throw new Error('请求不存在');
    if (friendship.user_id !== userId) throw new Error('只能由发送方操作');
    if (friendship.status !== 'rejected' && friendship.status !== 'pending') {
        throw new Error('当前状态不可重新发送');
    }

    friendship.status = 'pending';
    friendship.request_message = newMessage || friendship.request_message;
    friendship.updated_at = new Date();
    await friendship.save();

    // 再次通知接收方
    const io = getIO();
    io.to(`user:${friendship.friend_id}`).emit('notification', {
        type: 'friend_request',
        data: {
            friendshipId: friendship.id,
            fromUser: {
                id: userId,
                nickname: (await User.findByPk(userId)).nickname,
            },
            message: friendship.request_message,
            createdAt: friendship.updated_at,
        },
    });

    return friendship;
}
async function deleteGroup(groupId, userId) {
  // 不能删除默认分组
  const defaultGroup = await FriendGroup.findOne({
    where: { user_id: userId, name: '我的好友' },
  });
  if (defaultGroup && defaultGroup.id === groupId) {
    throw new Error('默认分组不可删除');
  }

  const group = await FriendGroup.findOne({ where: { id: groupId, user_id: userId } });
  if (!group) throw new Error('分组不存在或无权操作');

  // 将该分组下的所有好友移至默认分组
  await Friendship.update(
    { group_id: defaultGroup.id },
    { where: { group_id: groupId, user_id: userId } }
  );

  await group.destroy();
  return { deleted: true };
}

module.exports = {
  sendRequest,
  acceptRequest,
  rejectRequest,
  resendRequest,
  deleteFriend,
  moveFriend,
  createGroup,
  renameGroup,
  deleteGroup,
};