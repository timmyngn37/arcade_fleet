// edge/anomaly_detector.js

const {
    ZScoreDetector
} = require(
    './hd-implementation/detectors/zscore'
);

const {
    IsolationForestDetector
} = require(
    './hd-implementation/detectors/isolation_forest'
);

function createDetector(
    mode,
    options = {}
) {
    switch (mode) {
        case 'zscore':
            return new ZScoreDetector({
                windowSize:
                    options.zWindowSize,

                threshold:
                    options.zThreshold
            });

        case 'isolation_forest':
        case 'isolation-forest':
        case 'iforest':
            return new IsolationForestDetector({
                trainingSize:
                    options.ifTrainingSize,

                numberOfTrees:
                    options.ifTrees,

                sampleSize:
                    options.ifSampleSize,

                threshold:
                    options.ifThreshold,

                retrainInterval:
                    options.ifRetrainInterval,

                historySize:
                    options.ifHistorySize
            });

        default:
            throw new Error(
                `Unknown detector mode: ${mode}`
            );
    }
}

module.exports = {
    createDetector
};