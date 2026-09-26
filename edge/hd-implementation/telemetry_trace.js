// edge/hd-implementation/telemetry_trace.js
//
// Deterministic telemetry trace for HD experiments.
//
// Each sample contains:
//   - temperature
//   - humidity
//   - expectedAnomaly
//   - label
//
// The trace contains stable operation, gradual environmental drift,
// and deliberately injected abnormal temperature readings.

const TEMP_VARIATION = [
    0.0,
    0.1,
    -0.1,
    0.2,
    -0.2,
    0.1,
    0.0,
    -0.1
];

const HUMIDITY_VARIATION = [
    0,
    1,
    -1,
    0,
    2,
    -1,
    1,
    0
];

function normalSample(
    temperature,
    humidity,
    label
) {
    return {
        temperature:
            Number(temperature.toFixed(2)),

        humidity:
            Number(humidity.toFixed(2)),

        expectedAnomaly: false,
        label
    };
}

function anomalySample(
    temperature,
    humidity,
    label
) {
    return {
        temperature,
        humidity,
        expectedAnomaly: true,
        label
    };
}

function buildSingleTrace() {
    const trace = [];

    // ------------------------------------------------
    // Phase 1: stable environment
    // ------------------------------------------------

    for (let i = 0; i < 40; i++) {
        trace.push(
            normalSample(
                25 +
                    TEMP_VARIATION[
                        i % TEMP_VARIATION.length
                    ],

                55 +
                    HUMIDITY_VARIATION[
                        i % HUMIDITY_VARIATION.length
                    ],

                'stable-baseline'
            )
        );
    }

    // Strong temperature anomaly.
    trace.push(
        anomalySample(
            34.5,
            55,
            'high-temperature-spike'
        )
    );

    // ------------------------------------------------
    // Phase 2: gradual environmental drift
    // ------------------------------------------------

    for (let i = 0; i < 20; i++) {
        trace.push(
            normalSample(
                25.2 +
                    i * 0.015 +
                    TEMP_VARIATION[
                        i % TEMP_VARIATION.length
                    ],

                55.5 +
                    i * 0.02 +
                    HUMIDITY_VARIATION[
                        i % HUMIDITY_VARIATION.length
                    ],

                'gradual-drift-1'
            )
        );
    }

    // Strong low-temperature anomaly.
    trace.push(
        anomalySample(
            16.5,
            56,
            'low-temperature-spike'
        )
    );

    // ------------------------------------------------
    // Phase 3: continued gradual drift
    // ------------------------------------------------

    for (let i = 0; i < 20; i++) {
        trace.push(
            normalSample(
                25.6 +
                    i * 0.02 +
                    TEMP_VARIATION[
                        (i + 3) %
                        TEMP_VARIATION.length
                    ],

                56 +
                    i * 0.015 +
                    HUMIDITY_VARIATION[
                        (i + 2) %
                        HUMIDITY_VARIATION.length
                    ],

                'gradual-drift-2'
            )
        );
    }

    // Another high anomaly.
    trace.push(
        anomalySample(
            33.0,
            56,
            'second-high-spike'
        )
    );

    // ------------------------------------------------
    // Phase 4: new stable operating region
    // ------------------------------------------------

    for (let i = 0; i < 20; i++) {
        trace.push(
            normalSample(
                26.1 +
                    TEMP_VARIATION[
                        (i + 5) %
                        TEMP_VARIATION.length
                    ],

                56 +
                    HUMIDITY_VARIATION[
                        (i + 4) %
                        HUMIDITY_VARIATION.length
                    ],

                'new-stable-region'
            )
        );
    }

    // Final low anomaly.
    trace.push(
        anomalySample(
            18.0,
            55,
            'second-low-spike'
        )
    );

    return trace;
}

function buildTelemetryTrace(
    repeats = 1
) {
    const output = [];

    for (
        let cycle = 0;
        cycle < repeats;
        cycle++
    ) {
        const trace =
            buildSingleTrace();

        for (const sample of trace) {
            output.push({
                ...sample,
                cycle: cycle + 1
            });
        }
    }

    return output;
}

module.exports = {
    buildTelemetryTrace
};