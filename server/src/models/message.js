const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Message = sequelize.define('Message', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
    },
    conversation_id: {
        type: DataTypes.STRING(64),
        allowNull: false,
    },
    sender_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    message_type: {
        type: DataTypes.ENUM('text', 'image', 'audio'),
        allowNull: false,
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    status: {
        type: DataTypes.SMALLINT,
        defaultValue: 0,   // 0正常，1撤回
    },
});

module.exports = Message;