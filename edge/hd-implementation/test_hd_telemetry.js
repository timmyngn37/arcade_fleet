// edge/hd-implementation/test_hd_telemetry.js
//
// Controlled HD telemetry experiment.
//
// Modes:
//   baseline
//   zscore
//   isolation_forest
//
// Run from edge/:
//
// $env:MODE="baseline"
// node hd-implementation/test_hd_telemetry.js

require('dotenv').config();

const mqtt =
    require('mqtt');

const {
    buildTelemetryTrace
} =
    require('./telemetry_trace');

const {
    createDetector
} =
    require('../anomaly_detector');

const MODE =
    process.env.MODE ||
    'baseline';

const DEVICES =
    Number(
        process.env.DEVICES
    ) || 1;

const TRACE_REPEAT =
    Number(
        process.env.TRACE_REPEAT
    ) || 1;

const SAMPLE_INTERVAL_MS =
    Number(
        process.env.SAMPLE_INTERVAL_MS
    ) || 50;

const HEARTBEAT_EVERY_SAMPLES =
    Number(
        process.env.HEARTBEAT_EVERY_SAMPLES
    ) || 20;

const MQTT_BROKER_URL =
    process.env.MQTT_BROKER_URL ||
    'mqtt://broker.hivemq.com:1883';

const VENUE_ID =
    process.env.VENUE_ID ||
    'venue-hd-timmy';

const Z_WINDOW_SIZE =
    Number(
        process.env.Z_WINDOW_SIZE
    ) || 20;

const Z_THRESHOLD =
    Number(
        process.env.Z_THRESHOLD
    ) || 3.0;

const IF_TRAINING_SIZE =
    Number(
        process.env.IF_TRAINING_SIZE
    ) || 32;

const IF_TREES =
    Number(
        process.env.IF_TREES
    ) || 64;

const IF_SAMPLE_SIZE =
    Number(
        process.env.IF_SAMPLE_SIZE
    ) || 32;

const IF_THRESHOLD =
    Number(
        process.env.IF_THRESHOLD
    ) || 0.60;

const IF_RETRAIN_INTERVAL =
    Number(
        process.env.IF_RETRAIN_INTERVAL
    ) || 8;

const IF_HISTORY_SIZE =
    Number(
        process.env.IF_HISTORY_SIZE
    ) || 64;

const trace =
    buildTelemetryTrace(
        TRACE_REPEAT
    );

const client =
    mqtt.connect(
        MQTT_BROKER_URL
    );

let totalInput = 0;
let published = 0;
let suppressed = 0;
let warmupReadings = 0;

let truePositive = 0;
let falsePositive = 0;
let trueNegative = 0;
let falseNegative = 0;

let detectorCalls = 0;
let detectorTimeNs = 0n;

let pendingPublishes = 0;

const devices = [];

for (
    let i = 0;
    i < DEVICES;
    i++
) {
    const deviceId =
        `fan-hd-${String(
            i + 1
        ).padStart(3, '0')}`;

    let detector = null;

    if (
        MODE !== 'baseline'
    ) {
        detector =
            createDetector(
                MODE,
                {
                    zWindowSize:
                        Z_WINDOW_SIZE,

                    zThreshold:
                        Z_THRESHOLD,

                    ifTrainingSize:
                        IF_TRAINING_SIZE,

                    ifTrees:
                        IF_TREES,

                    ifSampleSize:
                        IF_SAMPLE_SIZE,

                    ifThreshold:
                        IF_THRESHOLD,

                    ifRetrainInterval:
                        IF_RETRAIN_INTERVAL,

                    ifHistorySize:
                        IF_HISTORY_SIZE
                }
            );
    }

    devices.push({
        deviceId,
        detector,

        // Used to calculate a robust local
        // temperature-change feature.
        recentTemperatures: [],

        samplesSincePublish: 0
    });
}

function median(values) {
    if (
        values.length === 0
    ) {
        return null;
    }

    const sorted =
        [...values].sort(
            (a, b) => a - b
        );

    const middle =
        Math.floor(
            sorted.length / 2
        );

    if (
        sorted.length % 2 === 0
    ) {
        return (
            sorted[middle - 1] +
            sorted[middle]
        ) / 2;
    }

    return sorted[middle];
}

function calculateDeltaTemperature(
    device,
    temperature
) {
    if (
        device.recentTemperatures
            .length === 0
    ) {
        return 0;
    }

    const reference =
        median(
            device.recentTemperatures
        );

    return Number(
        (
            temperature -
            reference
        ).toFixed(4)
    );
}

function updateTemperatureHistory(
    device,
    temperature
) {
    device.recentTemperatures.push(
        temperature
    );

    // Small robust window used only for
    // feature engineering.
    if (
        device.recentTemperatures
            .length > 5
    ) {
        device.recentTemperatures
            .shift();
    }
}

function createFeatureVector(
    device,
    sample
) {
    const deltaTemperature =
        calculateDeltaTemperature(
            device,
            sample.temperature
        );

    return {
        vector: [
            sample.temperature,
            sample.humidity,
            deltaTemperature
        ],

        deltaTemperature
    };
}

function publishTelemetry(
    device,
    sample,
    extra = {}
) {
    const payload = {
        deviceId:
            device.deviceId,

        deviceType:
            'comfort-fan',

        status:
            'ok',

        currentSpeed:
            'medium',

        temperature:
            sample.temperature,

        humidity:
            sample.humidity,

        expectedAnomaly:
            sample.expectedAnomaly,

        filterMode:
            MODE,

        timestamp:
            Date.now(),

        ...extra
    };

    const topic =
        `venue/${VENUE_ID}/device/${device.deviceId}/health`;

    pendingPublishes++;

    client.publish(
        topic,
        JSON.stringify(payload),
        () => {
            published++;
            pendingPublishes--;
        }
    );
}

function recordClassification(
    expected,
    predicted
) {
    if (
        expected &&
        predicted
    ) {
        truePositive++;
    } else if (
        !expected &&
        predicted
    ) {
        falsePositive++;
    } else if (
        !expected &&
        !predicted
    ) {
        trueNegative++;
    } else {
        falseNegative++;
    }
}

function evaluateSample(
    device,
    sample
) {
    totalInput++;

    // ------------------------------------------------
    // Baseline
    // ------------------------------------------------

    if (
        MODE === 'baseline'
    ) {
        publishTelemetry(
            device,
            sample,
            {
                reason:
                    'baseline'
            }
        );

        updateTemperatureHistory(
            device,
            sample.temperature
        );

        return;
    }

    let detectorInput;

    let deltaTemperature =
        null;

    if (
        MODE ===
        'isolation_forest'
    ) {
        const features =
            createFeatureVector(
                device,
                sample
            );

        detectorInput =
            features.vector;

        deltaTemperature =
            features.deltaTemperature;
    } else {
        // Z-score continues using temperature only.
        detectorInput =
            sample.temperature;
    }

    const start =
        process.hrtime.bigint();

    const result =
        device.detector.evaluate(
            detectorInput
        );

    const end =
        process.hrtime.bigint();

    detectorCalls++;

    detectorTimeNs +=
        end - start;

    updateTemperatureHistory(
        device,
        sample.temperature
    );

    // ------------------------------------------------
    // Detector warm-up
    // ------------------------------------------------

    if (result.warmup) {
        warmupReadings++;

        publishTelemetry(
            device,
            sample,
            {
                reason:
                    'warmup',

                deltaTemperature,

                anomaly:
                    false,

                anomalyScore:
                    null
            }
        );

        console.log(
            `[PUBLISHED] ` +
            `${device.deviceId} ` +
            `temp=${sample.temperature} ` +
            `reason=warmup`
        );

        return;
    }

    recordClassification(
        sample.expectedAnomaly,
        result.anomaly
    );

    if (
    sample.expectedAnomaly &&
    !result.anomaly
) {
    console.log(
        `[MISSED] ` +
        `${device.deviceId} ` +
        `temp=${sample.temperature} ` +
        `humidity=${sample.humidity} ` +
        (
            deltaTemperature !== null
                ? `delta=${deltaTemperature} `
                : ''
        ) +
        `score=${result.score.toFixed(4)}`
    );
}

    device.samplesSincePublish++;

    // ------------------------------------------------
    // Detected anomaly
    // ------------------------------------------------

    if (result.anomaly) {
        publishTelemetry(
            device,
            sample,
            {
                reason:
                    'anomaly',

                deltaTemperature,

                anomaly:
                    true,

                anomalyScore:
                    Number(
                        result.score
                            .toFixed(4)
                    )
            }
        );

        device.samplesSincePublish =
            0;

        console.log(
            `[ANOMALY] ` +
            `${device.deviceId} ` +
            `temp=${sample.temperature} ` +
            `humidity=${sample.humidity} ` +
            (
                deltaTemperature !== null
                    ? `delta=${deltaTemperature} `
                    : ''
            ) +
            `expected=${sample.expectedAnomaly} ` +
            `score=${result.score.toFixed(4)}`
        );

        return;
    }

    // ------------------------------------------------
    // Heartbeat
    // ------------------------------------------------

    if (
        device.samplesSincePublish >=
        HEARTBEAT_EVERY_SAMPLES
    ) {
        publishTelemetry(
            device,
            sample,
            {
                reason:
                    'heartbeat',

                deltaTemperature,

                anomaly:
                    false,

                anomalyScore:
                    Number(
                        result.score
                            .toFixed(4)
                    )
            }
        );

        device.samplesSincePublish =
            0;

        console.log(
            `[PUBLISHED] ` +
            `${device.deviceId} ` +
            `temp=${sample.temperature} ` +
            `reason=heartbeat`
        );

        return;
    }

    suppressed++;
}

function sleep(ms) {
    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                ms
            )
    );
}

async function waitForPublishes() {
    const timeout =
        Date.now() + 5000;

    while (
        pendingPublishes > 0 &&
        Date.now() < timeout
    ) {
        await sleep(50);
    }
}

function printResults() {
    const reduction =
        totalInput === 0
            ? 0
            : (
                (
                    totalInput -
                    published
                ) /
                totalInput
            ) * 100;

    console.log(
        '\n=== EXPERIMENT RESULTS ==='
    );

    console.log(
        `Mode                : ${MODE}`
    );

    console.log(
        `Devices             : ${DEVICES}`
    );

    console.log(
        `Input readings      : ${totalInput}`
    );

    console.log(
        `Messages published  : ${published}`
    );

    console.log(
        `Messages suppressed : ${totalInput - published}`
    );

    console.log(
        `Traffic reduction   : ${reduction.toFixed(2)}%`
    );

    console.log(
        `Warm-up readings    : ${warmupReadings}`
    );

    if (
        MODE !== 'baseline'
    ) {
        const precision =
            truePositive +
            falsePositive ===
            0
                ? 0
                : truePositive /
                  (
                      truePositive +
                      falsePositive
                  );

        const recall =
            truePositive +
            falseNegative ===
            0
                ? 0
                : truePositive /
                  (
                      truePositive +
                      falseNegative
                  );

        const f1 =
            precision + recall === 0
                ? 0
                : (
                    2 *
                    precision *
                    recall
                ) /
                  (
                      precision +
                      recall
                  );

        console.log(
            '\n--- Detection Quality ---'
        );

        console.log(
            `True positives      : ${truePositive}`
        );

        console.log(
            `False positives     : ${falsePositive}`
        );

        console.log(
            `True negatives      : ${trueNegative}`
        );

        console.log(
            `False negatives     : ${falseNegative}`
        );

        console.log(
            `Precision           : ${(precision * 100).toFixed(2)}%`
        );

        console.log(
            `Recall              : ${(recall * 100).toFixed(2)}%`
        );

        console.log(
            `F1 score            : ${f1.toFixed(4)}`
        );

        const totalMs =
            Number(
                detectorTimeNs
            ) /
            1e6;

        const averageMs =
            detectorCalls === 0
                ? 0
                : totalMs /
                  detectorCalls;

        console.log(
            '\n--- Edge Cost ---'
        );

        console.log(
            `Detector calls      : ${detectorCalls}`
        );

        console.log(
            `Total detector time : ${totalMs.toFixed(4)} ms`
        );

        console.log(
            `Avg detector time   : ${averageMs.toFixed(6)} ms`
        );
    }

    console.log(
        '=========================='
    );
}

async function runExperiment() {
    console.log(
        '\n=== HD TELEMETRY EXPERIMENT ==='
    );

    console.log(
        `Mode             : ${MODE}`
    );

    console.log(
        `Devices          : ${DEVICES}`
    );

    console.log(
        `Trace length     : ${trace.length}`
    );

    console.log(
        `Sample interval  : ${SAMPLE_INTERVAL_MS} ms`
    );

    console.log(
        `Heartbeat samples: ${HEARTBEAT_EVERY_SAMPLES}`
    );

    if (
        MODE === 'zscore'
    ) {
        console.log(
            `Z window         : ${Z_WINDOW_SIZE}`
        );

        console.log(
            `Z threshold      : ${Z_THRESHOLD}`
        );
    }

    if (
        MODE ===
        'isolation_forest'
    ) {
        console.log(
            `IF training size : ${IF_TRAINING_SIZE}`
        );

        console.log(
            `IF trees         : ${IF_TREES}`
        );

        console.log(
            `IF sample size   : ${IF_SAMPLE_SIZE}`
        );

        console.log(
            `IF threshold     : ${IF_THRESHOLD}`
        );

        console.log(
            `IF history size  : ${IF_HISTORY_SIZE}`
        );

        console.log(
            `IF retrain every : ${IF_RETRAIN_INTERVAL}`
        );
    }

    console.log(
        '================================'
    );

    for (const sample of trace) {
        for (const device of devices) {
            evaluateSample(
                device,
                sample
            );
        }

        await sleep(
            SAMPLE_INTERVAL_MS
        );
    }

    await waitForPublishes();

    printResults();

    client.end();
}

client.on(
    'connect',
    () => {
        runExperiment()
            .catch(error => {
                console.error(
                    error
                );

                client.end();
            });
    }
);

client.on(
    'error',
    error => {
        console.error(
            `MQTT error: ${error.message}`
        );
    }
);