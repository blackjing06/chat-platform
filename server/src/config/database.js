const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: false,  // 生产环境可设为 false，开发时 console.log 方便调试
    define: {
      timestamps: true,       // 自动维护 createdAt/updatedAt
      underscored: true,     // 字段名为下划线风格（user_id）
    },
  }
);

module.exports = { sequelize };