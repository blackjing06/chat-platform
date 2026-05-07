const { Group, GroupMember, User, Conversation, ConversationParticipant } = require('../models');
const { getIO } = require('../socket');

// 通知群内所有成员（通过 WebSocket）
async function notifyGroupUpdate(groupId) {
    const members = await GroupMember.findAll({ where: { group_id: groupId } });
    const io = getIO();
    const group = await Group.findByPk(groupId, { attributes: ['id', 'name', 'avatar', 'announcement'] });
    const payload = { group_id: groupId, group };
    members.forEach(m => io.to(`user:${m.user_id}`).emit('group_updated', payload));
}

// 获取群成员列表
async function getMembers(groupId) {
    return await GroupMember.findAll({
        where: { group_id: groupId },
        include: [{ model: User, attributes: ['id', 'nickname', 'avatar'] }],
        order: [['role', 'ASC']], // owner > admin > member
    });
}

// 修改群名
async function updateGroupName(groupId, userId, newName) {
    const gm = await GroupMember.findOne({ where: { group_id: groupId, user_id: userId } });
    if (!gm || gm.role === 'member') throw new Error('只有群主或管理员可修改群名');
    await Group.update({ name: newName }, { where: { id: groupId } });
    await notifyGroupUpdate(groupId);
}

// 修改群公告
async function updateAnnouncement(groupId, userId, announcement) {
    const gm = await GroupMember.findOne({ where: { group_id: groupId, user_id: userId } });
    if (!gm || gm.role === 'member') throw new Error('只有群主或管理员可修改公告');
    await Group.update({ announcement }, { where: { id: groupId } });
    await notifyGroupUpdate(groupId);
}

// 移除成员
async function removeMember(groupId, operatorId, targetUserId) {
    // 权限检查
    const operator = await GroupMember.findOne({ where: { group_id: groupId, user_id: operatorId } });
    if (!operator) throw new Error('你不在群中');
    if (operator.role === 'member') throw new Error('普通成员无权移除他人');

    const target = await GroupMember.findOne({ where: { group_id: groupId, user_id: targetUserId } });
    if (!target) throw new Error('目标成员不在群中');

    // 群主不能被移除
    if (target.role === 'owner') throw new Error('不能移除群主');
    // 管理员不能移除其他管理员（除非是群主）
    if (target.role === 'admin' && operator.role !== 'owner') throw new Error('只有群主可以移除管理员');

    await target.destroy();
    // 同时移除会话参与者记录
    const convId = `group_${groupId}`;
    await ConversationParticipant.destroy({ where: { conversation_id: convId, user_id: targetUserId } });

    // 通知被移出者（推送离开会话事件）
    const io = getIO();
    io.to(`user:${targetUserId}`).emit('kicked_from_group', { group_id: groupId });

    await notifyGroupUpdate(groupId);
}

// 设置/取消管理员
async function setAdmin(groupId, ownerId, targetUserId, isAdmin) {
    const owner = await GroupMember.findOne({ where: { group_id: groupId, user_id: ownerId, role: 'owner' } });
    if (!owner) throw new Error('只有群主可以设置管理员');

    const target = await GroupMember.findOne({ where: { group_id: groupId, user_id: targetUserId } });
    if (!target) throw new Error('目标成员不在群中');
    if (target.role === 'owner') throw new Error('不能设置群主');

    target.role = isAdmin ? 'admin' : 'member';
    await target.save();
    await notifyGroupUpdate(groupId);
}

// 转让群主
async function transferOwner(groupId, ownerId, newOwnerId) {
    const owner = await GroupMember.findOne({ where: { group_id: groupId, user_id: ownerId, role: 'owner' } });
    if (!owner) throw new Error('只有群主可以转让');

    const newOwner = await GroupMember.findOne({ where: { group_id: groupId, user_id: newOwnerId } });
    if (!newOwner) throw new Error('目标成员不在群中');

    // 更新角色
    owner.role = 'admin'; // 原群主变管理员（或成员，按需）
    await owner.save();
    newOwner.role = 'owner';
    await newOwner.save();
    // 同时更新 Group 表的 owner_id
    await Group.update({ owner_id: newOwnerId }, { where: { id: groupId } });

    await notifyGroupUpdate(groupId);
}

// 退出群聊（自己退出，非群主）
async function leaveGroup(groupId, userId) {
    const member = await GroupMember.findOne({ where: { group_id: groupId, user_id: userId } });
    if (!member) throw new Error('你不在群中');
    if (member.role === 'owner') throw new Error('群主不能直接退出，请先转让群主');

    // 删除成员记录
    await member.destroy();
    // 移除会话参与者记录
    const convId = `group_${groupId}`;
    await ConversationParticipant.destroy({ where: { conversation_id: convId, user_id: userId } });

    // 通知群内剩余成员（成员列表更新）
    await notifyGroupUpdate(groupId);

    // 通知退出的用户（他自己需要移除会话）
    const io = getIO();
    io.to(`user:${userId}`).emit('kicked_from_group', { group_id: groupId });

    return { success: true };
}

async function getGroupInfo(groupId) {
    const group = await Group.findByPk(groupId, { attributes: ['name', 'announcement'] });
    if (!group) throw new Error('群不存在');
    return { name: group.name, announcement: group.announcement || '' };
}

// 邀请成员（群主、管理员均可邀请，普通成员也可邀请，为了灵活性不做角色限制）
async function inviteMembers(groupId, inviterId, inviteeIds) {
    // 检查邀请者是否在群内
    const inviter = await GroupMember.findOne({ where: { group_id: groupId, user_id: inviterId } });
    if (!inviter) throw new Error('你不在群中，无法邀请');

    // 获取群对应的会话 ID
    const convId = `group_${groupId}`;

    const addedUsers = [];
    for (const uid of inviteeIds) {
        // 检查是否已在群中
        const existing = await GroupMember.findOne({ where: { group_id: groupId, user_id: uid } });
        if (existing) continue; // 已在群中，跳过

        // 添加为群成员（角色 member）
        await GroupMember.create({ group_id: groupId, user_id: uid, role: 'member' });
        // 添加会话参与者
        await ConversationParticipant.findOrCreate({
            where: { user_id: uid, conversation_id: convId },
            defaults: { user_id: uid, conversation_id: convId, last_read_at: new Date() }
        });

        addedUsers.push(uid);
    }

    if (addedUsers.length === 0) {
        throw new Error('所选用户均已在该群中');
    }

    // 通知新成员：新会话事件（让他们侧边栏出现该群）
    const group = await Group.findByPk(groupId, { attributes: ['name', 'avatar'] });
    const io = getIO();
    const now = new Date();
    for (const uid of addedUsers) {
        io.to(`user:${uid}`).emit('new_conversation', {
            id: convId,
            type: 'group',
            name: group.name,
            avatar: group.avatar || '',
            last_message: null,
            unread_count: 0,
            updated_at: now.toISOString(),
        });
    }

    // 通知群内所有成员：成员更新
    await notifyGroupUpdate(groupId);

    return { addedUsers };
}

module.exports = {
    getMembers,
    updateGroupName,
    updateAnnouncement,
    removeMember,
    setAdmin,
    transferOwner,
    leaveGroup,
    getGroupInfo,
    inviteMembers,

};