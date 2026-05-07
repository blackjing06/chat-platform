const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Conversation = sequelize.define('Conversation', {
    id: {
        type: DataTypes.STRING(64),
        primaryKey: true,
    },
    type: {
        type: DataTypes.ENUM('private', 'group'),
        allowNull: false,
    },
    group_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    user1_id: {
        type: DataTypes.INTEGER,
        allowNull: true,   // 只有 private 会话时有值
    },
    user2_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    last_message: {
        type: DataTypes.JSONB,
        defaultValue: null,
    },
});

module.exports = Conversation;