const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const mqtt = require('mqtt');
const { connectDB } = require('../shared/db');
const LeaderboardEntry = require('./models/leaderboardEntry');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.get('/api/leaderboard/top', async (req, res) => {
  try {
    const topEntries = await LeaderboardEntry.find().sort({ score: -1 }).limit(10);
    res.json(topEntries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const HTTP_PORT = process.env.HTTP_PORT || 3001;
app.listen(HTTP_PORT, () => {
  console.log(`Leaderboard HTTP Server running on port ${HTTP_PORT}`);
});

async function start() {
  await connectDB();

  const client = mqtt.connect(process.env.MQTT_BROKER_URL || 'mqtt://broker.hivemq.com:1883');

  client.on('connect', () => {
    console.log('Leaderboard service connected');
    client.subscribe('venue/+/session/+/completed');
  });

  client.on('message', async (topic, message) => {
    try {
      const session = JSON.parse(message.toString());
      await handleSessionCompleted(session);
    } catch (error) {
      console.log(`Failed to process message on ${topic}: ${error.message}`);
    }
  });

  client.on('error', (error) => {
    console.log(`MQTT Error: ${error.message}`);
  });
}

async function handleSessionCompleted(session) {
  if (!session.playerId) {
    console.log(`Session ${session.sessionId} completed as guest - no leaderboard entry created`);
    return;
  }

  const score = calculateScore(session.accuracyState);

  const entry = new LeaderboardEntry({
    entryId: `entry-${session.sessionId}`,
    playerId: session.playerId,
    sessionId: session.sessionId,
    venueId: session.venueId,
    score: score
  });

  await entry.save();
  console.log(`Leaderboard entry created for player ${session.playerId}: score ${score}`);
}

function calculateScore(accuracyState) {
  if (!accuracyState || accuracyState.length === 0) return 0;

  const total = accuracyState.reduce((sum, cabinet) => sum + cabinet.accuracy, 0);
  return parseFloat((total / accuracyState.length).toFixed(2));
}

start();