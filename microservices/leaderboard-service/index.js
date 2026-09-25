// microservices/leaderboard-service/index.js

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mqtt = require('mqtt');
const { connectDB } = require('../shared/db');
const LeaderboardEntry = require('./models/leaderboardEntry');

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
  // Guest sessions never produce a leaderboard entry, per the domain
  // model - a null playerId means no profile to credit the score to.
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
  // Simple average accuracy across all cabinets in the session (handles
  // both solo - one cabinet - and duo - two cabinets - the same way).
  if (!accuracyState || accuracyState.length === 0) return 0;

  const total = accuracyState.reduce((sum, cabinet) => sum + cabinet.accuracy, 0);
  return parseFloat((total / accuracyState.length).toFixed(2));
}

start();