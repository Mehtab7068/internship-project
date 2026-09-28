const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/feedants_competition';
    const conn = await mongoose.connect(uri);
    console.log('[Database] MongoDB Connected: ' + conn.connection.host);
    return conn;
  } catch (error) {
    console.error('[Database Error] ' + error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
