const User = require('./user');
const FriendGroup = require('./friendGroup');
const Friendship = require('./friendship');
const Group = require('./group');
const GroupMember = require('./groupMember');
const Conversation = require('./conversation');
const Message = require('./message');
const ConversationParticipant = require('./conversationParticipant');

// 好友分组属于用户
FriendGroup.belongsTo(User, { foreignKey: 'user_id', onDelete: 'CASCADE' });
User.hasMany(FriendGroup, { foreignKey: 'user_id' });

// 好友关系关联
Friendship.belongsTo(User, { foreignKey: 'user_id', as: 'Requester' });
Friendship.belongsTo(User, { foreignKey: 'friend_id', as: 'Target' });
Friendship.belongsTo(FriendGroup, { foreignKey: 'group_id' });

// 群组关联
Group.belongsTo(User, { foreignKey: 'owner_id', as: 'Owner' });
GroupMember.belongsTo(Group, { foreignKey: 'group_id', onDelete: 'CASCADE' });
GroupMember.belongsTo(User, { foreignKey: 'user_id', onDelete: 'CASCADE' });
Group.hasMany(GroupMember, { foreignKey: 'group_id' });

// 会话关联
Conversation.belongsTo(Group, { foreignKey: 'group_id', constraints: false });

// 消息关联
Message.belongsTo(Conversation, { foreignKey: 'conversation_id' });
Conversation.hasMany(Message, { foreignKey: 'conversation_id' });
Message.belongsTo(User, { foreignKey: 'sender_id', as: 'Sender' });

// 参与者关联
ConversationParticipant.belongsTo(Conversation, { foreignKey: 'conversation_id' });
Conversation.hasMany(ConversationParticipant, { foreignKey: 'conversation_id' });
ConversationParticipant.belongsTo(User, { foreignKey: 'user_id' });

module.exports = {
    User,
    FriendGroup,
    Friendship,
    Group,
    GroupMember,
    Conversation,
    Message,
    ConversationParticipant,
};