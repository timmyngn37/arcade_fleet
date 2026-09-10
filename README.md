# Scalable Architecture for a Networked Arcade Gaming Cabinet Fleet

IoT architecture prototype for the rhythm-game cabinet fleet: edge-tier
cabinets with local judgement processing, a shared NFC/coin-card input
cluster, a standalone comfort fan, and a set of event-driven cloud
microservices connected over MQTT.

## Architecture

- **Edge tier** (`edge/`) — physical sensors/actuators simulated in Node.js,
  plus one Node-RED flow doing local judgement (touch/motion grading,
  local and cross-cabinet haptic feedback).
- **Transport tier** — MQTT (HiveMQ public test broker for now). Topics are
  venue-scoped (`venue/{venueId}/...`) to support multiple arcade locations.
- **Cloud tier** (`microservices/`) — independent Node.js services, each
  with its own MongoDB model, communicating entirely over MQTT (no HTTP
  between services). `player-profile-service` resolves NFC scans directly;
  `session-service` binds resolved players to sessions and detects duo
  pairings via MongoDB; `leaderboard-service` reacts to completed sessions;
  `device-management-service` and `credits-service` maintain simple
  registries from cabinet/shared-IO events.

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
4. Seed sample data (once, after MongoDB is connected):
   - `cd microservices/session-service && node seed_duo_pairing.js`
   - `cd microservices/player-profile-service && node seed_profiles.js`

## Running the system

Start in this order, each in its own terminal:

1. `cd microservices/telemetry-service && node index.js`
2. `cd microservices/session-service && node index.js`
3. `cd microservices/leaderboard-service && node index.js`
4. `cd microservices/player-profile-service && node index.js`
5. `cd microservices/device-management-service && node index.js`
6. `cd microservices/credits-service && node index.js`
7. `node-red --userDir ./edge/node-red-flows` (open localhost:1880, import
   `judgement_flow.json` if not already loaded, then Deploy)
8. `cd edge/fan && node index.js`
9. `cd edge && node telemetry_agent.js`
10. `cd edge/cabinet && CABINET_ID=A node index.js`
11. `cd edge/cabinet && CABINET_ID=B node index.js` (needed to see duo
    pairing and cross-cabinet haptic effects — see Known Limitations)
12. `cd edge/shared-io && node index.js`

All edge nodes must use the same `VENUE_ID` in their `.env` (or rely on the
shared default `venue-01`) — topics are scoped per venue, so a mismatch
means messages won't be received.

## Current status

| Component | Status |
|---|---|
| Cabinet node (sensors/actuators, online status announcement) | Done |
| Shared-IO node (NFC/coin/buttons) | Done |
| Comfort-fan node (`edge/fan/`) | Done |
| telemetry_agent.js | Done |
| Node-RED judgement_flow.json | Done (venue-scoped topics) |
| session-service | Done - duo pairing via MongoDB, session completion, wellbeing, player binding |
| telemetry-service | Done |
| leaderboard-service | Done - creates entries for completed non-guest sessions |
| player-profile-service | Done - resolves NFC scans directly via MQTT, no HTTP |
| device-management-service | Done - basic cabinet registry from online announcements |
| credits-service | Done - records transactions (not yet linkable to a player) |
| AWS deployment | Not started - planned after AWS is covered in the unit |

## Known limitations

- Duo cabinet pairing (`A` ↔ `B`) is seeded via `seed_duo_pairing.js` rather
  than created dynamically; `session-service` queries this data from
  MongoDB correctly, but nothing yet creates a `DuoPairing` on demand.
- Binding a scanned player to a session is a simplification: a resolved
  playerId is held per-venue for 30 seconds and picked up by whichever
  session is created next at that venue, rather than a real
  "cabinet selection" input naming a specific cabinet. This can
  misattribute a player if two sessions start close together.
- `credits-service` records transactions as anonymous (`playerId: null`),
  since the coin/card reader doesn't currently report which card, if any,
  was tapped beforehand.
- `player_auth_flow.json` (Node-RED) is superseded by
  `player-profile-service` subscribing to NFC scans directly over MQTT,
  for consistency with how every other service in the system communicates;
  the flow file is no longer part of the active path.
- All topics assume a single venue in testing; multi-venue scaling is
  supported by the topic structure but not yet exercised with real
  multi-venue data.
- Health checks only cover the comfort fan; cabinet/shared-IO health
  reporting and the boot-time device certificate/token check described in
  the proposal have not been implemented.
- Storage currently uses MongoDB uniformly; the proposal's planned SQL/NoSQL
  split between session-credits and leaderboard-telemetry has not been
  implemented.

See `docs/project_status.pdf` for the full write-up.