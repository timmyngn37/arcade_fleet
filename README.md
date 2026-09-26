# Scalable Architecture for a Networked Arcade Gaming Cabinet Fleet

IoT architecture prototype for a networked rhythm-game cabinet fleet. The system combines edge-side gameplay processing with event-driven cloud microservices so multiple arcade cabinets can coordinate sessions, player identity, leaderboards, credits, telemetry, device status, and cross-cabinet interactions.

## Architecture

The project follows an edge-to-cloud hybrid architecture:

- **Edge tier** (`edge/`) — simulated cabinet sensors and actuators, shared NFC/coin-card/buttons input, a standalone comfort fan, telemetry generation, and a Node-RED judgement flow for local gameplay processing.
- **Transport tier** — MQTT using venue-scoped topics such as `venue/{venueId}/...`.
- **Cloud tier** (`microservices/`) — independent Node.js services communicating over MQTT and persisting data to MongoDB Atlas.
- **AWS deployment** — the cloud services are containerised with Docker Compose and deployed on Amazon EC2. An Application Load Balancer fronts the operational dashboard, while an Auto Scaling Group provides instance-level scalability and resilience.

Latency-sensitive gameplay judgement remains at the edge, while coordination, persistence, telemetry, and fleet-level services run in the cloud.

## Core components

### Edge tier

- **Cabinet node** — simulates touch and motion inputs and local actuators.
- **Shared IO** — simulates NFC scans, credit/card input, and settings controls.
- **Comfort fan** — simulates temperature/humidity sensing and fan actuation.
- **Telemetry agent** — publishes device health information.
- **Node-RED judgement flow** — calculates note grades and routes local/cross-cabinet haptic feedback.

### Cloud microservices

- **session-service** — manages solo/duo sessions, player binding, duo pairing, session state, and duplicate-session protection.
- **telemetry-service** — ingests device health and telemetry events.
- **leaderboard-service** — creates leaderboard entries for completed non-guest sessions.
- **player-profile-service** — resolves NFC scans to player profiles.
- **device-management-service** — maintains cabinet/device status.
- **credits-service** — records credit transactions.

## Data layer

MongoDB Atlas is used for persistent storage, including:

- player profiles
- sessions
- duo pairings
- leaderboard entries
- health checks
- cabinet/device records
- credit transactions

## Prerequisites

- Node.js
- npm
- Docker and Docker Compose for cloud deployment
- Node-RED
- MongoDB Atlas
- MQTT broker access

## Environment setup

The repository includes `.env.example`. Do not commit real credentials.

Create the required environment files:

```bash
cp .env.example edge/.env
cp .env.example microservices/.env
```

Typical values include:

```env
MQTT_BROKER_URL=mqtt://broker.hivemq.com:1883
MONGODB_URI=your_mongodb_connection_string
VENUE_ID=venue-01
```

The edge tier should not require direct database access; cloud microservices connect to MongoDB Atlas.

## Install dependencies

```bash
cd edge
npm install

cd ../microservices
npm install
```

## Seed sample data

After configuring MongoDB:

```bash
cd microservices/session-service
node seed_duo_pairing.js
```

```bash
cd microservices/player-profile-service
node seed_profiles.js
```

## Run cloud microservices locally

From `microservices/`:

```bash
docker compose up -d
```

This starts:

- session-service
- telemetry-service
- leaderboard-service
- player-profile-service
- device-management-service
- credits-service

View logs with:

```bash
docker compose logs -f
```

## Run edge components

Start the required edge processes in separate terminals.

Cabinet A:

```bash
cd edge/cabinet
CABINET_ID=A node index.js
```

Cabinet B:

```bash
cd edge/cabinet
CABINET_ID=B node index.js
```

Shared IO:

```bash
cd edge/shared-io
node index.js
```

Comfort fan:

```bash
cd edge/fan
node index.js
```

Telemetry agent:

```bash
cd edge
node telemetry_agent.js
```

For Node-RED, import:

```
edge/node-red-flow/judgement_flow.json
```

and deploy the flow.

## AWS deployment

The final implementation has been deployed on AWS using:

- **EC2** for the containerised Node.js microservices
- **Docker Compose** to manage service processes
- **Application Load Balancer** for the operational dashboard
- **Auto Scaling Group** for instance-level scaling and resilience
- **CloudWatch** for operational monitoring

Core gameplay/session traffic continues to use MQTT directly. The Application Load Balancer is used for operational/dashboard HTTP traffic rather than as the MQTT data plane.

An Auto Scaling experiment was performed by generating sustained CPU load on the EC2 instance. CPU utilisation reached approximately 91%, triggering AWS to provision a second instance. Both instances subsequently registered as healthy targets in the target group.

## Validation performed

The final system was evaluated for:

- duo-session concurrency and duplicate-session prevention
- offline buffering and reconnection
- telemetry publishing under burst load
- malformed MQTT topic/input rejection
- AWS automatic scaling
- service health and data persistence

The edge nodes can temporarily buffer gameplay events during connectivity loss and flush them in order after MQTT connectivity is restored.

## Security

Implemented measures include:

- environment variables for credentials and configuration
- `.env` files excluded from Git
- input/topic validation in cloud services
- separation between edge nodes and direct database access
- AWS deployment with controlled cloud-side service exposure

The current project uses the public HiveMQ broker for prototype/testing purposes. A production deployment should use authenticated MQTT over TLS, device-specific credentials or certificates, and stricter broker-side access control.

## Current status

| Component | Status |
|---|---|
| Cabinet sensors/actuators | Done |
| Shared IO | Done |
| Comfort fan | Done |
| Telemetry agent | Done |
| Node-RED judgement flow | Done |
| Session service | Done |
| Telemetry service | Done |
| Leaderboard service | Done |
| Player profile service | Done |
| Device management service | Done |
| Credits service | Done |
| MongoDB Atlas persistence | Done |
| Docker Compose deployment | Done |
| AWS EC2 deployment | Done |
| Application Load Balancer | Done |
| Auto Scaling demonstration | Done |
| CloudWatch monitoring | Done |

## Known limitations

- Duo pairing between cabinets is currently seeded with `seed_duo_pairing.js` rather than created dynamically through a management UI.
- Player-to-session binding is simplified and uses a short-lived venue-level resolved player state rather than an explicit cabinet-selection workflow.
- Credit transactions are currently stored without a resolved player ID.
- Multi-venue topic isolation is supported by the MQTT topic structure but has not been extensively tested across real independent venues.
- Storage uses MongoDB for all service data rather than the earlier proposed relational/NoSQL split.
- The prototype uses a public MQTT broker and does not yet implement production-grade device certificate authentication.
- The current Docker Compose configuration uses bind-mounted source code with the Node Alpine image instead of dedicated per-service production Dockerfiles.

## Repository structure

```text
.
├── dashboard/
│   └── index.html
├── edge/
│   ├── cabinet/
│   ├── fan/
│   ├── node-red-flow/
│   ├── shared-io/
│   └── telemetry_agent.js
├── microservices/
│   ├── credits-service/
│   ├── device-management-service/
│   ├── leaderboard-service/
│   ├── player-profile-service/
│   ├── session-service/
│   ├── telemetry-service/
│   └── docker-compose.yml
├── .env.example
└── README.md
```

## Project context

This repository was developed as the implementation for a scalable IoT architecture project focused on a fleet of networked arcade rhythm-game cabinets.
