// edge/hd-implementation/detectors/zscore.js
class ZScoreDetector {
    constructor({
        windowSize = 20,
        threshold = 3.0
    } = {}) {
        this.windowSize = windowSize;
        this.threshold = threshold;
        this.history = [];
    }

    evaluate(value) {
        if (!Number.isFinite(value)) {
            throw new Error(`Invalid value: ${value}`);
        }

        // Warm-up: build the initial normal baseline.
        if (this.history.length < this.windowSize) {
            this.addNormalValue(value);

            return {
                ready: false,
                warmup: true,
                anomaly: false,
                score: null,
                mean: null,
                stdDev: null
            };
        }

        const mean =
            this.history.reduce((sum, x) => sum + x, 0) /
            this.history.length;

        const variance =
            this.history.reduce(
                (sum, x) => sum + Math.pow(x - mean, 2),
                0
            ) / this.history.length;

        const stdDev = Math.sqrt(variance);

        let zScore;

        if (stdDev === 0) {
            zScore = value === mean ? 0 : Infinity;
        } else {
            zScore = (value - mean) / stdDev;
        }

        const score = Math.abs(zScore);
        const anomaly = score >= this.threshold;

        // Do not allow a detected anomaly to immediately
        // contaminate the rolling normal baseline.
        if (!anomaly) {
            this.addNormalValue(value);
        }

        return {
            ready: true,
            warmup: false,
            anomaly,
            score,
            zScore,
            mean,
            stdDev
        };
    }

    addNormalValue(value) {
        this.history.push(value);

        if (this.history.length > this.windowSize) {
            this.history.shift();
        }
    }

    reset() {
        this.history = [];
    }
}

module.exports = { ZScoreDetector };