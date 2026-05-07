const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    username: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
    },
    password_hash: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    nickname: {
        type: DataTypes.STRING(100),
        allowNull: false,
    },
    avatar: {
        type: DataTypes.STRING(500),
        defaultValue: '',
    },
});

module.exports = User;