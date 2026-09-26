// edge/hd-implementation/detectors/isolation_forest.js
//
// Lightweight multidimensional Isolation Forest implementation.
//
// Input example:
//
// [
//     temperature,
//     humidity,
//     deltaTemperature
// ]
//
// The implementation uses random feature selection and random
// partitioning to isolate unusual observations.

function harmonicNumber(n) {
    let result = 0;

    for (let i = 1; i <= n; i++) {
        result += 1 / i;
    }

    return result;
}

function averagePathLength(n) {
    if (n <= 1) {
        return 0;
    }

    if (n === 2) {
        return 1;
    }

    return (
        2 * harmonicNumber(n - 1) -
        (2 * (n - 1)) / n
    );
}

// Deterministic pseudo-random generator.
// This keeps experiments reproducible.
function mulberry32(seed) {
    return function () {
        let t =
            seed += 0x6D2B79F5;

        t =
            Math.imul(
                t ^ (t >>> 15),
                t | 1
            );

        t ^=
            t +
            Math.imul(
                t ^ (t >>> 7),
                t | 61
            );

        return (
            (
                t ^
                (t >>> 14)
            ) >>> 0
        ) / 4294967296;
    };
}

function randomInt(
    random,
    max
) {
    return Math.floor(
        random() * max
    );
}

function sampleWithoutReplacement(
    data,
    size,
    random
) {
    const copy = [...data];

    for (
        let i = copy.length - 1;
        i > 0;
        i--
    ) {
        const j =
            randomInt(
                random,
                i + 1
            );

        [
            copy[i],
            copy[j]
        ] = [
            copy[j],
            copy[i]
        ];
    }

    return copy.slice(
        0,
        Math.min(size, copy.length)
    );
}

class IsolationTree {
    constructor({
        maxDepth,
        random
    }) {
        this.maxDepth =
            maxDepth;

        this.random =
            random;

        this.root =
            null;
    }

    fit(data) {
        this.root =
            this.buildTree(
                data,
                0
            );
    }

    buildTree(
        data,
        depth
    ) {
        if (
            depth >= this.maxDepth ||
            data.length <= 1
        ) {
            return {
                leaf: true,
                size: data.length
            };
        }

        const dimensions =
            data[0].length;

        // Find dimensions that actually vary.
        const validDimensions = [];

        for (
            let dimension = 0;
            dimension < dimensions;
            dimension++
        ) {
            let min = Infinity;
            let max = -Infinity;

            for (const point of data) {
                const value =
                    point[dimension];

                if (value < min) {
                    min = value;
                }

                if (value > max) {
                    max = value;
                }
            }

            if (min < max) {
                validDimensions.push({
                    dimension,
                    min,
                    max
                });
            }
        }

        // No feature varies anymore.
        if (
            validDimensions.length === 0
        ) {
            return {
                leaf: true,
                size: data.length
            };
        }

        const selected =
            validDimensions[
                randomInt(
                    this.random,
                    validDimensions.length
                )
            ];

        const split =
            selected.min +
            this.random() *
            (
                selected.max -
                selected.min
            );

        const left = [];
        const right = [];

        for (const point of data) {
            if (
                point[
                    selected.dimension
                ] < split
            ) {
                left.push(point);
            } else {
                right.push(point);
            }
        }

        if (
            left.length === 0 ||
            right.length === 0
        ) {
            return {
                leaf: true,
                size: data.length
            };
        }

        return {
            leaf: false,

            dimension:
                selected.dimension,

            split,

            left:
                this.buildTree(
                    left,
                    depth + 1
                ),

            right:
                this.buildTree(
                    right,
                    depth + 1
                )
        };
    }

    pathLength(
        point,
        node = this.root,
        depth = 0
    ) {
        if (node.leaf) {
            return (
                depth +
                averagePathLength(
                    node.size
                )
            );
        }

        if (
            point[node.dimension] <
            node.split
        ) {
            return this.pathLength(
                point,
                node.left,
                depth + 1
            );
        }

        return this.pathLength(
            point,
            node.right,
            depth + 1
        );
    }
}

class IsolationForestModel {
    constructor({
        numberOfTrees = 64,
        sampleSize = 32,
        seed = 314159
    } = {}) {
        this.numberOfTrees =
            numberOfTrees;

        this.sampleSize =
            sampleSize;

        this.seed =
            seed;

        this.trees = [];
    }

    fit(data) {
        if (
            !Array.isArray(data) ||
            data.length < 2
        ) {
            throw new Error(
                'Isolation Forest requires at least two training samples'
            );
        }

        this.trees = [];

        const effectiveSampleSize =
            Math.min(
                this.sampleSize,
                data.length
            );

        const maxDepth =
            Math.ceil(
                Math.log2(
                    effectiveSampleSize
                )
            );

        for (
            let i = 0;
            i < this.numberOfTrees;
            i++
        ) {
            const random =
                mulberry32(
                    this.seed + i
                );

            const sample =
                sampleWithoutReplacement(
                    data,
                    effectiveSampleSize,
                    random
                );

            const tree =
                new IsolationTree({
                    maxDepth,
                    random
                });

            tree.fit(sample);

            this.trees.push(tree);
        }
    }

    score(point) {
        if (
            this.trees.length === 0
        ) {
            throw new Error(
                'Isolation Forest has not been trained'
            );
        }

        let totalPathLength = 0;

        for (const tree of this.trees) {
            totalPathLength +=
                tree.pathLength(point);
        }

        const averagePath =
            totalPathLength /
            this.trees.length;

        const normalisation =
            averagePathLength(
                this.sampleSize
            );

        if (normalisation === 0) {
            return 0;
        }

        return Math.pow(
            2,
            -averagePath /
            normalisation
        );
    }
}

class IsolationForestDetector {
    constructor({
        trainingSize = 32,
        numberOfTrees = 64,
        sampleSize = 32,
        threshold = 0.60,
        retrainInterval = 8,
        historySize = 64,
        seed = 314159
    } = {}) {
        this.trainingSize =
            trainingSize;

        this.numberOfTrees =
            numberOfTrees;

        this.sampleSize =
            sampleSize;

        this.threshold =
            threshold;

        this.retrainInterval =
            retrainInterval;

        this.historySize =
            historySize;

        this.seed =
            seed;

        this.history = [];

        this.model = null;

        this.samplesSinceRetrain =
            0;
    }

    evaluate(features) {
        if (
            !Array.isArray(features)
        ) {
            throw new Error(
                'IsolationForestDetector expects a feature vector'
            );
        }

        // ------------------------------------------------
        // Initial warm-up
        // ------------------------------------------------

        if (
            this.history.length <
            this.trainingSize
        ) {
            this.history.push(
                [...features]
            );

            if (
                this.history.length ===
                this.trainingSize
            ) {
                this.trainModel();
            }

            return {
                ready: false,
                warmup: true,
                anomaly: false,
                score: null
            };
        }

        const score =
            this.model.score(
                features
            );

        const anomaly =
            score >=
            this.threshold;

        // ------------------------------------------------
        // Adaptive sliding history.
        //
        // The new observation is added AFTER it is scored.
        // Sparse anomalies may temporarily enter the
        // history, but the bounded sliding window prevents
        // permanent model freezing when normal conditions
        // gradually drift.
        // ------------------------------------------------

        this.history.push(
            [...features]
        );

        if (
            this.history.length >
            this.historySize
        ) {
            this.history.shift();
        }

        this.samplesSinceRetrain++;

        if (
            this.samplesSinceRetrain >=
            this.retrainInterval
        ) {
            this.trainModel();

            this.samplesSinceRetrain =
                0;
        }

        return {
            ready: true,
            warmup: false,
            anomaly,
            score
        };
    }

    trainModel() {
        this.model =
            new IsolationForestModel({
                numberOfTrees:
                    this.numberOfTrees,

                sampleSize:
                    Math.min(
                        this.sampleSize,
                        this.history.length
                    ),

                seed:
                    this.seed
            });

        this.model.fit(
            this.history
        );
    }
}

module.exports = {
    IsolationForestDetector
};