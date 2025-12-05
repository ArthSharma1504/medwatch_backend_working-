const { Sequelize, DataTypes, Op } = require('sequelize');

require('dotenv').config();
const MYSQL_URI = process.env.MYSQL_URI || 'mysql://root:password@localhost:3306/medwatch';

// Create Sequelize instance BEFORE defining models
const sequelize = new Sequelize(MYSQL_URI, {
  logging: false,
  define: {
    timestamps: false   // <<--- DISABLE global timestamps (createdAt/updatedAt)
  },
  dialectOptions: {}
});

// Define models after sequelize is created
const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  username: { type: DataTypes.STRING, unique: true, allowNull: false },
  // map JS attribute passwordHash -> DB column `password_hash`
  passwordHash: { type: DataTypes.STRING, allowNull: false, field: 'password_hash' },
  // role might already exist in DB; map it explicitly to avoid mismatch
  role: { type: DataTypes.ENUM('admin','doctor','staff'), allowNull: false, field: 'role' }
}, { tableName: 'users', timestamps: false });

const RawEvent = sequelize.define('RawEvent', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  uid: { type: DataTypes.STRING },
  profile: { type: DataTypes.STRING },
  room: { type: DataTypes.STRING },
  entry_time: { type: DataTypes.DATE },
  exit_time: { type: DataTypes.DATE },
  status: { type: DataTypes.STRING }
}, { tableName: 'raw_events', timestamps: false });

const Person = sequelize.define('Person', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  uid: { type: DataTypes.STRING, unique: true },
  name: { type: DataTypes.STRING },
  profile: { type: DataTypes.STRING }
}, { tableName: 'persons', timestamps: false });

const ContactEdge = sequelize.define('ContactEdge', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  person_a_uid: { type: DataTypes.STRING },
  person_b_uid: { type: DataTypes.STRING },
  room: { type: DataTypes.STRING },
  overlap_start: { type: DataTypes.DATE },
  overlap_end: { type: DataTypes.DATE },
  weight: { type: DataTypes.FLOAT, defaultValue: 1 }
}, { tableName: 'contact_edges', timestamps: false });

const MdrCase = sequelize.define('MdrCase', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  uid: { type: DataTypes.STRING },
  detected_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  organism: { type: DataTypes.STRING }
}, { tableName: 'mdr_cases', timestamps: false });

const Alert = sequelize.define('Alert', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  type: { type: DataTypes.STRING },
  message: { type: DataTypes.TEXT },
  priority: { type: DataTypes.INTEGER, defaultValue: 1 }
}, { tableName: 'alerts', timestamps: false });

// Export everything
module.exports = {
  sequelize,
  Sequelize,
  Op,
  User,
  RawEvent,
  Person,
  ContactEdge,
  MdrCase,
  Alert
};
