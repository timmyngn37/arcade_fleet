# Scalable Architecture for a Networked Arcade Gaming Cabinet Fleet

IoT architecture prototype for the rhythm-game cabinet fleet: edge-tier
cabinets with local judgement processing, a shared NFC/coin-card input
cluster, a standalone comfort fan, and a set of event-driven cloud
microservices connected over MQTT.

## Architecture

- **Edge tier** (`edge/`) — physical sensors/actuators simulated in Node.js,
  plus two Node-RED flows: local judgement (touch/motion grading, haptic
  feedback) and player authentication (NFC scan resolution).
- **Transport tier** — MQTT (HiveMQ public test broker for now). Topics are
  venue-scoped (`venue/{venueId}/...`) to support multiple arcade locations.
- **Cloud tier** (`microservices/`) — independent Node.js services, each
  with its own MongoDB model, subscribing to relevant MQTT topics.

AWS deployment is intentionally out of scope until covered later in the
unit; all cloud-tier services currently run as local Node processes
standing in for what will later be AWS Lambda/managed services.

## Prerequisites

- Node.js
- npm packages: run `npm install` inside both `edge/` and `microservices/`
- Node-RED installed globally: `npm install -g node-red`
- A MongoDB Atlas cluster (see `.env.example`)

## Setup

1. Copy `.env.example` to `.env` in **both** `edge/` and `microservices/`.
   - `edge/.env` needs `MQTT_BROKER_URL` and `VENUE_ID` (no `MONGODB_URI` —
     edge nodes never connect to the database directly, only via MQTT).
   - `microservices/.env` needs `MQTT_BROKER_URL` and `MONGODB_URI`.
2. `cd edge && npm install`
3. `cd microservices && npm install`

## Running the system

Start in this order, each in its own terminal:

1. `cd microservices/telemetry-service && node index.js`
2. `cd microservices/session-service && node index.js`
3. `node-red --userDir ./edge/node-red-flows` (open localhost:1880, import
   both `judgement_flow.json` and `player_auth_flow.json` if not already
   loaded, then Deploy)
4. `cd edge/fan && node index.js`
5. `cd edge && node telemetry_agent.js`
6. `cd edge/cabinet && CABINET_ID=A node index.js`
7. `cd edge/cabinet && CABINET_ID=B node index.js` (optional, for testing
   cross-cabinet duo effects)
8. `cd edge/shared-io && node index.js`

All edge nodes must use the same `VENUE_ID` in their `.env` (or rely on the
shared default `venue-01`) — topics are scoped per venue, so a mismatch
means messages won't be received.

## Current status

| Component | Status |
|---|---|
| Cabinet node (sensors/actuators) | Done |
| Shared-IO node (NFC/coin/buttons) | Done |
| Comfort-fan node (`edge/fan/`) | Done |
| telemetry_agent.js | Done |
| Node-RED judgement_flow.json | Done (venue-scoped topics) |
| Node-RED player_auth_flow.json | Guest branch done; profile-lookup branch pending player-profile-service |
| session-service | Done (basic session + wellbeing logic) |
| telemetry-service | Done |
| leaderboard-service | Model only, logic pending |
| player-profile-service | Model only, logic pending |
| device-management-service | Model stubs only |
| credits-service | Model stub only |
| AWS deployment | Not started - planned after AWS is covered in the unit |

## Known limitations

- Duo cabinet pairing (`A` ↔ `B`) is currently hardcoded in the Node-RED
  judgement flow rather than queried from `DuoPairing` in MongoDB.
- All topics assume a single venue in testing; multi-venue scaling is
  supported by the topic structure but not yet exercised with real
  multi-venue data.

See `docs/project_status.pdf` for the full write-up.