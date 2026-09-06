require('dotenv').config();
const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set. Copy .env.example to .env and fill it in.');
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');
}

module.exports = { connectDB };
