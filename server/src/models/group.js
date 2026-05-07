const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Group = sequelize.define('Group', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false,
    },
    avatar: {
        type: DataTypes.STRING(500),
        defaultValue: '',
    },
    owner_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    announcement: {
        type: DataTypes.TEXT,
        allowNull: true, defaultValue: ''
    }

});

module.exports = Group;