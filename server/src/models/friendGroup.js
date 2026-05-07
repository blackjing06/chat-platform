const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const FriendGroup = sequelize.define('FriendGroup', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    name: {
        type: DataTypes.STRING(50),
        allowNull: false,
    },
    sort_order: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },
});

module.exports = FriendGroup;