// edge/telemetry_agent.js
//
// The only file that bridges "silent" local devices (comfort fan, and
// anything similar added later) to the cloud. It imports device modules
// directly - same process, no network - then publishes what it finds
// over MQTT. The devices themselves never import mqtt or know this
// file exists.
//
// Run with: node telemetry_agent.js

require('dotenv').config();

const mqtt = require('mqtt');

const { getFanStatus } =
    require('./fan/actuators/fan_motor');

const { readTemperature } =
    require('./fan/sensors/temperature');

const { createDetector } =
    require('./anomaly_detector');

const mqttBrokerUrl =
    process.env.MQTT_BROKER_URL ||
    'mqtt://broker.hivemq.com:1883';

const venueId =
    process.env.VENUE_ID ||
    'venue-01';

const REPORT_INTERVAL_MS =
    Number(process.env.REPORT_INTERVAL_MS) ||
    30000;

const FILTER_MODE =
    process.env.FILTER_MODE ||
    'baseline';

const detector =
    FILTER_MODE === 'baseline'
        ? null
        : createDetector(
            FILTER_MODE,
            {
                zWindowSize:
                    Number(
                        process.env.Z_WINDOW_SIZE
                    ) || 20,

                zThreshold:
                    Number(
                        process.env.Z_THRESHOLD
                    ) || 3.0,

                ifTrainingSize:
                    Number(
                        process.env.IF_TRAINING_SIZE
                    ) || 32,

                ifTrees:
                    Number(
                        process.env.IF_TREES
                    ) || 64,

                ifSampleSize:
                    Number(
                        process.env.IF_SAMPLE_SIZE
                    ) || 32,

                ifThreshold:
                    Number(
                        process.env.IF_THRESHOLD
                    ) || 0.60,

                ifRetrainInterval:
                    Number(
                        process.env.IF_RETRAIN_INTERVAL
                    ) || 10
            }
        );

const client =
    mqtt.connect(mqttBrokerUrl);

client.on('connect', () => {
    console.log('Telemetry agent connected');
    console.log(`Filter mode: ${FILTER_MODE}`);

    scheduleReports();
});

client.on('error', (error) => {
    console.log(
        `MQTT Error: ${error.message}`
    );
});

function scheduleReports() {
    setInterval(
        reportFanHealth,
        REPORT_INTERVAL_MS
    );
}

function reportFanHealth() {
    // Direct function call - no MQTT between telemetry_agent and the fan.
    const fanStatus =
        getFanStatus();

    const temperature =
        readTemperature();

    // ------------------------------------------------
    // Baseline mode:
    // preserve the original behaviour and publish
    // every telemetry reading.
    // ------------------------------------------------
    if (FILTER_MODE === 'baseline') {
        publishFanHealth({
            fanStatus,
            temperature,
            anomaly: false,
            anomalyScore: null,
            reason: 'baseline'
        });

        return;
    }

    // ------------------------------------------------
    // Filtered mode:
    // evaluate the temperature at the edge.
    // ------------------------------------------------
    const result =
        detector.evaluate(
            temperature
        );

    // During warm-up, publish the readings normally
    // while the detector builds its initial baseline.
    if (result.warmup) {
        publishFanHealth({
            fanStatus,
            temperature,
            anomaly: false,
            anomalyScore: result.score,
            reason: 'warmup'
        });

        return;
    }

    // Always publish a hardware fault.
    if (fanStatus.status === 'fault') {
        publishFanHealth({
            fanStatus,
            temperature,
            anomaly: result.anomaly,
            anomalyScore: result.score,
            reason: 'fault'
        });

        return;
    }

    // Publish anomalous temperature readings.
    if (result.anomaly) {
        publishFanHealth({
            fanStatus,
            temperature,
            anomaly: true,
            anomalyScore: result.score,
            reason: 'anomaly'
        });

        return;
    }

    // Otherwise, suppress the reading at the edge.
    console.log(
        `[FILTERED] ` +
        `temperature=${temperature}°C ` +
        `score=${formatScore(result.score)}`
    );
}

function publishFanHealth({
    fanStatus,
    temperature,
    anomaly,
    anomalyScore,
    reason
}) {
    const payload = {
        deviceId: 'fan-01',
        deviceType: 'comfort-fan',

        status:
            fanStatus.status,

        currentSpeed:
            fanStatus.currentSpeed,

        temperature,

        filterMode:
            FILTER_MODE,

        anomaly,

        anomalyScore:
            Number.isFinite(anomalyScore)
                ? Number(
                    anomalyScore.toFixed(4)
                )
                : null,

        timestamp:
            Date.now()
    };

    const topic =
        `venue/${venueId}/device/fan-01/health`;

    const message =
        JSON.stringify(payload);

    client.publish(
        topic,
        message
    );

    console.log(
        `[PUBLISHED] ` +
        `reason=${reason} ` +
        `temperature=${temperature}°C ` +
        `score=${formatScore(anomalyScore)}`
    );

    console.log(
        `Published to ${topic}: ${message}`
    );
}

function formatScore(score) {
    if (
        score === null ||
        score === undefined
    ) {
        return 'N/A';
    }

    if (!Number.isFinite(score)) {
        return 'Infinity';
    }

    return score.toFixed(4);
}