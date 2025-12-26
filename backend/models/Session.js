const { DataTypes } = require('sequelize');
const { sequelize } = require('../database');
const User = require('./User');

const Session = sequelize.define('Session', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  sessionId: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    field: 'session_id',
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'user_id',
    references: {
      model: 'users',
      key: 'id',
    },
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'expires_at',
  },
}, {
  tableName: 'sessions',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['session_id'],
    },
    {
      fields: ['user_id'],
    },
  ],
});

// 建立關聯
Session.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(Session, { foreignKey: 'userId', as: 'sessions' });

module.exports = Session;
