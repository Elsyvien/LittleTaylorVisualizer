document.addEventListener('DOMContentLoaded', function() {
    const canvas = document.getElementById('graph-canvas');
    const ctx = canvas.getContext('2d');
    const termsSlider = document.getElementById('terms-slider');
    const termsValue = document.getElementById('terms-value');
    const centerSlider = document.getElementById('center-slider');
    const centerValue = document.getElementById('center-value');
    const functionSelect = document.getElementById('function-select');
    const customFunctionInput = document.getElementById('custom-function');
    const customFunctionGroup = document.getElementById('custom-function-group');
    const customFunctionLabel = document.querySelector('label[for="custom-function"]');
    const customError = document.getElementById('custom-error');
    const centerSliderY = document.getElementById('center-slider-y');
    const centerValueY = document.getElementById('center-value-y');
    const centerYGroup = document.getElementById('center-y-group');
    const centerSliderZ = document.getElementById('center-slider-z');
    const centerValueZ = document.getElementById('center-value-z');
    const centerZGroup = document.getElementById('center-z-group');
    const multiHint = document.getElementById('multi-hint');
    const multiHintText = document.getElementById('multi-hint-text');
    const playButton = document.getElementById('play-button');
    const resetButton = document.getElementById('reset-button');
    const formulaDisplay = document.getElementById('formula-display');

    let isPlaying = false;
    let currentTerms = 1;
    let targetTerms = 1;
    let drawProgress = 0;
    let lastFrameTime = null;
    let needsFormulaUpdate = true;
    const viewState = {
        yaw: -0.7,
        pitch: 0.35,
        distance: 900,
        isDragging: false,
        lastX: 0,
        lastY: 0
    };

    const PADDING = 60;
    const GRID_COLOR = 'rgba(120, 119, 198, 0.15)';
    const AXIS_COLOR = 'rgba(120, 119, 198, 0.5)';
    const ORIGINAL_COLOR = '#7877c6';
    const TAYLOR_COLOR = '#4895ef';
    const POINT_COLOR = '#ff6b9d';
    const TERM_EASING = 6;
    const DRAW_SPEED_PLAYING = 6;
    const DRAW_SPEED_IDLE = 4;
    const MAX_TERMS = {
        1: 100,
        2: 12,
        3: 6
    };
    const SLIDER_RANGES = {
        y: {
            min: parseFloat(centerSliderY?.min || '-5'),
            max: parseFloat(centerSliderY?.max || '5')
        },
        z: {
            min: parseFloat(centerSliderZ?.min || '-5'),
            max: parseFloat(centerSliderZ?.max || '5')
        }
    };

    const CUSTOM_LABELS = {
        1: 'Eigene Funktion (z.B. x^2, sin(x)*x)',
        2: 'Eigene Funktion (z.B. sin(x) + cos(y), x*y)',
        3: 'Eigene Funktion (z.B. sin(x) + y*z, x*y*z)'
    };
    const CUSTOM_PLACEHOLDERS = {
        1: 'z.B. x^2 + 2*x',
        2: 'z.B. sin(x)*y + y^2',
        3: 'z.B. x*y + z^2'
    };

    const customFunctions = { 1: null, 2: null, 3: null };
    const customFunctionStrings = { 1: '', 2: '', 3: '' };

    function invalidateFormula() {
        needsFormulaUpdate = true;
    }

    function parseCustomFunction(expr, dimensions) {
        try {
            expr = expr.replace(/\^/g, '**').replace(/(\d)([a-z])/gi, '$1*$2');
            const argNames = ['x', 'y', 'z', 'w'];
            const args = argNames.slice(0, dimensions).join(', ');
            const func = new Function(args, `
                with (Math) { return ${expr}; }
            `);
            const zeros = new Array(dimensions).fill(0);
            const testValue = func(...zeros);
            if (!isFinite(testValue)) throw new Error();
            return func;
        } catch (e) {
            return null;
        }
    }

    function drawFunction3D(func, xMin, xMax, yMin, yMax, color, lineWidth, dashed, progress, centerPoint, depthMeta, dims, zeroHeight) {
        const depthValue = depthMeta.value;
        const depthRange = depthMeta.range;
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.shadowBlur = 15;
        ctx.shadowColor = color;
        ctx.beginPath();
        let started = false;
        const steps = 500;
        const maxStep = Math.floor(steps * progress);
        for (let i = 0; i <= maxStep; i++) {
            const x = xMin + i * (xMax - xMin) / steps;
            try {
                const y = func(x);
                if (!isFinite(y) || y < yMin - 3 || y > yMax + 3) continue;
                const worldPoint = {
                    x: toWorldX(x, xMin, xMax, dims.width),
                    y: toWorldY(y, yMin, yMax, dims.height, zeroHeight),
                    z: toWorldZ(depthValue, depthRange.min, depthRange.max, dims.depth)
                };
                const screen = projectPoint3D(worldPoint);
                if (!started) {
                    ctx.moveTo(screen.x, screen.y);
                    started = true;
                } else {
                    ctx.lineTo(screen.x, screen.y);
                }
            } catch (e) { continue; }
        }
        if (dashed) ctx.setLineDash([8, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
        if (progress < 1 && started) {
            const x = xMin + maxStep * (xMax - xMin) / steps;
            try {
                const y = func(x);
                if (isFinite(y)) {
                    const worldPoint = {
                        x: toWorldX(x, xMin, xMax, dims.width),
                        y: toWorldY(y, yMin, yMax, dims.height, zeroHeight),
                        z: toWorldZ(depthValue, depthRange.min, depthRange.max, dims.depth)
                    };
                    const screen = projectPoint3D(worldPoint);
                    ctx.fillStyle = color;
                    ctx.shadowBlur = 20;
                    ctx.shadowColor = color;
                    ctx.beginPath();
                    ctx.arc(screen.x, screen.y, 3 + Math.sin(Date.now() / 100), 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.shadowBlur = 0;
                }
            } catch (e) {}
        }
    }

    const derivCache = new Map();
    const multiDerivCache = new Map();
    function numericalDerivative(func, x, order = 1, h = 0.001) {
        if (order === 0) return func(x);
        if (order > 20) return 0;
        const key = `${x.toFixed(6)}_${order}`;
        if (derivCache.has(key)) return derivCache.get(key);
        let result;
        if (order === 1) {
            result = (func(x + h) - func(x - h)) / (2 * h);
        } else {
            const df = (x) => numericalDerivative(func, x, order - 1, h);
            result = (df(x + h) - df(x - h)) / (2 * h);
        }
        if (derivCache.size > 500) derivCache.clear();
        derivCache.set(key, result);
        return result;
    }

    const functions = {
        sin: {
            name: 'sin(x)',
            dimensions: 1,
            func: ([x]) => Math.sin(x),
            derivative: (x, n) => [Math.sin, Math.cos, (t) => -Math.sin(t), (t) => -Math.cos(t)][n % 4](x),
            yRange: [-3, 3]
        },
        cos: {
            name: 'cos(x)',
            dimensions: 1,
            func: ([x]) => Math.cos(x),
            derivative: (x, n) => [Math.cos, (t) => -Math.sin(t), (t) => -Math.cos(t), Math.sin][n % 4](x),
            yRange: [-3, 3]
        },
        exp: {
            name: 'e^x',
            dimensions: 1,
            func: ([x]) => Math.exp(x),
            derivative: (x, n) => Math.exp(x),
            yRange: [-2, 10]
        },
        ln: {
            name: 'ln(1+x)',
            dimensions: 1,
            func: ([x]) => Math.log(1 + x),
            derivative: (x, n) => n === 0 ? Math.log(1 + x) : Math.pow(-1, n - 1) * factorial(n - 1) / Math.pow(1 + x, n),
            yRange: [-3, 3]
        },
        sinxy: {
            name: 'sin(x) + cos(y)',
            dimensions: 2,
            func: ([x, y]) => Math.sin(x) + Math.cos(y),
            yRange: [-3, 3]
        },
        expxy: {
            name: 'e^{x·y}',
            dimensions: 2,
            func: ([x, y]) => Math.exp(x * y),
            yRange: [-2, 10]
        },
        paraboloid: {
            name: 'x² + y²',
            dimensions: 2,
            func: ([x, y]) => x * x + y * y,
            yRange: [-5, 45]
        },
        saddle: {
            name: 'x · y',
            dimensions: 2,
            func: ([x, y]) => x * y,
            yRange: [-25, 25]
        },
        sinxyz: {
            name: 'sin(x) + cos(y) + sin(z)',
            dimensions: 3,
            func: ([x, y, z]) => Math.sin(x) + Math.cos(y) + Math.sin(z),
            yRange: [-4, 4]
        },
        exp3d: {
            name: 'e^{(x+y+z)/3}',
            dimensions: 3,
            func: ([x, y, z]) => Math.exp((x + y + z) / 3),
            yRange: [-2, 20]
        },
        sphere: {
            name: 'x² + y² + z²',
            dimensions: 3,
            func: ([x, y, z]) => x * x + y * y + z * z,
            yRange: [-5, 120]
        },
        mixprod: {
            name: 'xy + yz + zx',
            dimensions: 3,
            func: ([x, y, z]) => x * y + y * z + z * x,
            yRange: [-80, 80]
        },
        custom: {
            name: 'f(x)',
            dimensions: 1,
            func: ([x]) => {
                const fn = customFunctions[1];
                return fn ? fn(x) : 0;
            },
            derivative: (x, n) => {
                const fn = customFunctions[1];
                return fn ? numericalDerivative(fn, x, n) : 0;
            },
            getSignature: () => `custom:${customFunctionStrings[1] || 'empty'}`,
            yRange: [-3, 3]
        },
        custom2d: {
            name: 'f(x,y)',
            dimensions: 2,
            func: ([x, y]) => {
                const fn = customFunctions[2];
                return fn ? fn(x, y) : 0;
            },
            getSignature: () => `custom2d:${customFunctionStrings[2] || 'empty'}`,
            yRange: [-3, 3]
        },
        custom3d: {
            name: 'f(x,y,z)',
            dimensions: 3,
            func: ([x, y, z]) => {
                const fn = customFunctions[3];
                return fn ? fn(x, y, z) : 0;
            },
            getSignature: () => `custom3d:${customFunctionStrings[3] || 'empty'}`,
            yRange: [-3, 3]
        }
    };

    function factorial(n) {
        if (n > 170) return Infinity;
        if (n <= 1) return 1;
        let r = 1;
        for (let i = 2; i <= n; i++) r *= i;
        return r;
    }

    function getCurrentFunctionDef() {
        return functions[functionSelect.value];
    }

    function getCurrentDimensions() {
        const def = getCurrentFunctionDef();
        return def && def.dimensions ? def.dimensions : 1;
    }

    function getFunctionDisplayName(def = getCurrentFunctionDef()) {
        if (functionSelect.value === 'custom') {
            return customFunctionStrings[1] || 'f(x)';
        }
        if (functionSelect.value === 'custom2d') {
            return customFunctionStrings[2] || 'f(x,y)';
        }
        if (functionSelect.value === 'custom3d') {
            return customFunctionStrings[3] || 'f(x,y,z)';
        }
        return def.name;
    }

    function getFunctionSignature(def = getCurrentFunctionDef()) {
        if (typeof def.getSignature === 'function') {
            return def.getSignature();
        }
        return functionSelect.value;
    }

    function getCenterPoint() {
        const dims = getCurrentDimensions();
        const point = [parseFloat(centerSlider.value)];
        if (dims >= 2) point.push(parseFloat(centerSliderY.value));
        if (dims >= 3) point.push(parseFloat(centerSliderZ.value));
        return point;
    }

    function getDepthMeta(centerPoint) {
        const dims = centerPoint.length;
        if (dims >= 3) {
            return {
                value: centerPoint[2],
                range: SLIDER_RANGES.z,
                label: 'z'
            };
        }
        if (dims === 2) {
            return {
                value: centerPoint[1],
                range: SLIDER_RANGES.y,
                label: 'y'
            };
        }
        return {
            value: 0,
            range: { min: -5, max: 5 },
            label: ''
        };
    }

    function buildPointForX(x, centerPoint) {
        const point = centerPoint.slice();
        point[0] = x;
        return point;
    }

    function safeEvaluate(def, point) {
        try {
            const value = def.func(point);
            return isFinite(value) ? value : NaN;
        } catch (e) {
            return NaN;
        }
    }

    function getDefaultRange(def) {
        if (def && Array.isArray(def.yRange)) {
            return def.yRange;
        }
        return [-3, 3];
    }

    function determineRange(evaluator, xMin, xMax, def) {
        const steps = 200;
        let min = Infinity;
        let max = -Infinity;
        for (let i = 0; i <= steps; i++) {
            const x = xMin + (i / steps) * (xMax - xMin);
            const y = evaluator(x);
            if (!isFinite(y)) continue;
            if (y < min) min = y;
            if (y > max) max = y;
        }
        if (!isFinite(min) || !isFinite(max)) {
            return getDefaultRange(def);
        }
        if (Math.abs(max - min) < 1e-3) {
            return [min - 1, max + 1];
        }
        const padding = (max - min) * 0.1;
        return [min - padding, max + padding];
    }

    function enumerateMultiIndices(dimensions, order) {
        const results = [];
        function helper(idx, remaining, current) {
            if (idx === dimensions) {
                if (remaining === 0) results.push(current);
                return;
            }
            for (let i = 0; i <= remaining; i++) {
                helper(idx + 1, remaining - i, [...current, i]);
            }
        }
        helper(0, order, []);
        return results;
    }

    function multiFactorial(multiIndex) {
        return multiIndex.reduce((acc, value) => acc * factorial(value), 1);
    }

    function getDerivativeValue(def, signature, centerPoint, multiIndex) {
        if (def.dimensions === 1 && typeof def.derivative === 'function' && multiIndex.length === 1) {
            return def.derivative(centerPoint[0], multiIndex[0]);
        }
        return numericalMultiDerivative(def, signature, centerPoint, multiIndex);
    }

    function numericalMultiDerivative(def, signature, point, orders, h = 0.001) {
        const key = `${signature}|${point.map(v => v.toFixed(4)).join(',')}|${orders.join(',')}`;
        if (multiDerivCache.has(key)) return multiDerivCache.get(key);
        let result;
        if (orders.every(order => order === 0)) {
            result = safeEvaluate(def, point);
        } else {
            const axis = orders.findIndex(order => order > 0);
            const reducedOrders = orders.slice();
            reducedOrders[axis] -= 1;
            const forwardPoint = point.slice();
            forwardPoint[axis] += h;
            const backwardPoint = point.slice();
            backwardPoint[axis] -= h;
            const forward = numericalMultiDerivative(def, signature, forwardPoint, reducedOrders, h);
            const backward = numericalMultiDerivative(def, signature, backwardPoint, reducedOrders, h);
            result = (forward - backward) / (2 * h);
        }
        if (!isFinite(result)) result = 0;
        if (multiDerivCache.size > 1000) multiDerivCache.clear();
        multiDerivCache.set(key, result);
        return result;
    }

    function evaluateOneDimTaylor(def, centerPoint, x, terms) {
        let sum = 0;
        for (let i = 0; i < terms; i++) {
            try {
                const d = def.derivative(centerPoint[0], i);
                const fact = factorial(i);
                if (!isFinite(d) || !isFinite(fact)) continue;
                const term = (d / fact) * Math.pow(x - centerPoint[0], i);
                if (isFinite(term)) sum += term;
            } catch (e) { continue; }
        }
        return sum;
    }

    function evaluateMultiDimTaylor(def, signature, centerPoint, point, terms) {
        const dims = def.dimensions;
        const deltas = point.map((value, idx) => value - centerPoint[idx]);
        let sum = 0;
        for (let totalOrder = 0; totalOrder < terms; totalOrder++) {
            const multiIndices = enumerateMultiIndices(dims, totalOrder);
            for (const multiIdx of multiIndices) {
                const derivative = getDerivativeValue(def, signature, centerPoint, multiIdx);
                if (!isFinite(derivative)) continue;
                const denom = multiFactorial(multiIdx);
                if (!isFinite(denom) || denom === 0) continue;
                let product = 1;
                for (let i = 0; i < dims; i++) {
                    if (multiIdx[i] === 0) continue;
                    product *= Math.pow(deltas[i], multiIdx[i]);
                }
                if (!isFinite(product)) continue;
                sum += (derivative / denom) * product;
            }
        }
        return sum;
    }

    function evaluateTaylorAt(point, centerPoint, terms, def, signature) {
        if (def.dimensions === 1) {
            return evaluateOneDimTaylor(def, centerPoint, point[0], terms);
        }
        return evaluateMultiDimTaylor(def, signature, centerPoint, point, terms);
    }

    function clearDerivativeCaches() {
        derivCache.clear();
        multiDerivCache.clear();
    }

    function adjustTermsSlider(dimensions) {
        const max = MAX_TERMS[dimensions] || MAX_TERMS[1];
        termsSlider.max = max;
        if (parseInt(termsSlider.value, 10) > max) {
            termsSlider.value = max;
            currentTerms = targetTerms = max;
            termsValue.textContent = max;
        }
    }

    function updateDimensionUI(dimensions) {
        const showY = dimensions >= 2;
        const showZ = dimensions >= 3;
        centerYGroup.style.display = showY ? 'flex' : 'none';
        centerSliderY.disabled = !showY;
        centerZGroup.style.display = showZ ? 'flex' : 'none';
        centerSliderZ.disabled = !showZ;
        if (dimensions > 1) {
            multiHint.style.display = 'flex';
            if (dimensions === 2) {
                multiHintText.textContent = 'Bei 2D-Funktionen wird der Schnitt entlang der x-Achse bei festem y = a_y angezeigt.';
            } else {
                multiHintText.textContent = 'Bei 3D-Funktionen wird der Schnitt entlang der x-Achse bei festem y = a_y und z = a_z angezeigt.';
            }
        } else {
            multiHint.style.display = 'none';
        }
        adjustTermsSlider(dimensions);
    }

    function updateCustomInputMeta(dimensions) {
        customFunctionLabel.textContent = CUSTOM_LABELS[dimensions];
        customFunctionInput.placeholder = CUSTOM_PLACEHOLDERS[dimensions];
        customFunctionInput.value = customFunctionStrings[dimensions];
    }

    function toScreenX(x, xMin, xMax) {
        return PADDING + ((x - xMin) / (xMax - xMin)) * (canvas.width - 2 * PADDING);
    }

    function toScreenY(y, yMin, yMax) {
        return canvas.height - PADDING - ((y - yMin) / (yMax - yMin)) * (canvas.height - 2 * PADDING);
    }

    function getWorldDimensions() {
        const width = canvas.width - 2 * PADDING;
        const depth = width * 0.7;
        const height = canvas.height - 2 * PADDING;
        return { width, depth, height };
    }

    function toWorldX(value, min, max, width) {
        const t = (value - min) / (max - min || 1);
        return (t - 0.5) * width;
    }

    function toWorldZ(value, min, max, depth) {
        const t = (value - min) / (max - min || 1);
        return (t - 0.5) * depth;
    }

    function toWorldY(value, min, max, height, zeroHeight) {
        const t = (value - min) / (max - min || 1);
        return t * height - zeroHeight;
    }

    function computeZeroHeight(min, max, height) {
        return ((0 - min) / (max - min || 1)) * height;
    }

    function projectPoint3D(point) {
        const cosYaw = Math.cos(viewState.yaw);
        const sinYaw = Math.sin(viewState.yaw);
        const cosPitch = Math.cos(viewState.pitch);
        const sinPitch = Math.sin(viewState.pitch);
        let x = point.x;
        let y = point.y;
        let z = point.z;
        const rotatedX = x * cosYaw - z * sinYaw;
        let rotatedZ = x * sinYaw + z * cosYaw;
        const rotatedY = y * cosPitch - rotatedZ * sinPitch;
        rotatedZ = y * sinPitch + rotatedZ * cosPitch + viewState.distance;
        const perspective = viewState.distance / (viewState.distance + rotatedZ);
        return {
            x: canvas.width / 2 + rotatedX * perspective,
            y: canvas.height - PADDING - rotatedY * perspective
        };
    }

    function draw2DGrid(xMin, xMax, yMin, yMax) {
        ctx.strokeStyle = GRID_COLOR;
        ctx.lineWidth = 1;
        for (let x = Math.ceil(xMin); x <= Math.floor(xMax); x++) {
            ctx.beginPath();
            ctx.moveTo(toScreenX(x, xMin, xMax), PADDING);
            ctx.lineTo(toScreenX(x, xMin, xMax), canvas.height - PADDING);
            ctx.stroke();
        }
        for (let y = Math.ceil(yMin); y <= Math.floor(yMax); y++) {
            ctx.beginPath();
            ctx.moveTo(PADDING, toScreenY(y, yMin, yMax));
            ctx.lineTo(canvas.width - PADDING, toScreenY(y, yMin, yMax));
            ctx.stroke();
        }
        ctx.strokeStyle = AXIS_COLOR;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(120, 119, 198, 0.5)';
        if (yMin <= 0 && yMax >= 0) {
            ctx.beginPath();
            ctx.moveTo(PADDING, toScreenY(0, yMin, yMax));
            ctx.lineTo(canvas.width - PADDING, toScreenY(0, yMin, yMax));
            ctx.stroke();
        }
        if (xMin <= 0 && xMax >= 0) {
            ctx.beginPath();
            ctx.moveTo(toScreenX(0, xMin, xMax), PADDING);
            ctx.lineTo(toScreenX(0, xMin, xMax), canvas.height - PADDING);
            ctx.stroke();
        }
        ctx.shadowBlur = 0;
        ctx.fillStyle = AXIS_COLOR;
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        for (let x = Math.ceil(xMin); x <= Math.floor(xMax); x++) {
            if (x === 0) continue;
            ctx.fillText(x.toString(), toScreenX(x, xMin, xMax), toScreenY(0, yMin, yMax) + 20);
        }
        ctx.textAlign = 'right';
        for (let y = Math.ceil(yMin); y <= Math.floor(yMax); y++) {
            if (y === 0) continue;
            ctx.fillText(y.toString(), toScreenX(0, xMin, xMax) - 10, toScreenY(y, yMin, yMax) + 4);
        }
    }

    function draw3DCoordinateSystem(xMin, xMax, yMin, yMax, depthMeta, dims, zeroHeight) {
        const depthRange = depthMeta.range;
        const xSteps = 12;
        const zSteps = 8;
        const planeColor = ctx.createLinearGradient(0, canvas.height - PADDING, 0, PADDING);
        planeColor.addColorStop(0, 'rgba(20, 20, 40, 0.5)');
        planeColor.addColorStop(1, 'rgba(20, 20, 60, 0.2)');
        const corners = [
            projectPoint3D({
                x: toWorldX(xMin, xMin, xMax, dims.width),
                y: toWorldY(0, yMin, yMax, dims.height, zeroHeight),
                z: toWorldZ(depthRange.min, depthRange.min, depthRange.max, dims.depth)
            }),
            projectPoint3D({
                x: toWorldX(xMax, xMin, xMax, dims.width),
                y: toWorldY(0, yMin, yMax, dims.height, zeroHeight),
                z: toWorldZ(depthRange.min, depthRange.min, depthRange.max, dims.depth)
            }),
            projectPoint3D({
                x: toWorldX(xMax, xMin, xMax, dims.width),
                y: toWorldY(0, yMin, yMax, dims.height, zeroHeight),
                z: toWorldZ(depthRange.max, depthRange.min, depthRange.max, dims.depth)
            }),
            projectPoint3D({
                x: toWorldX(xMin, xMin, xMax, dims.width),
                y: toWorldY(0, yMin, yMax, dims.height, zeroHeight),
                z: toWorldZ(depthRange.max, depthRange.min, depthRange.max, dims.depth)
            })
        ];
        ctx.fillStyle = planeColor;
        ctx.beginPath();
        ctx.moveTo(corners[0].x, corners[0].y);
        for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i].x, corners[i].y);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = 'rgba(120, 119, 198, 0.12)';
        ctx.lineWidth = 1;
        for (let xi = 0; xi <= xSteps; xi++) {
            const t = xi / xSteps;
            const xVal = xMin + t * (xMax - xMin);
            const start = projectPoint3D({
                x: toWorldX(xVal, xMin, xMax, dims.width),
                y: toWorldY(0, yMin, yMax, dims.height, zeroHeight),
                z: toWorldZ(depthRange.min, depthRange.min, depthRange.max, dims.depth)
            });
            const end = projectPoint3D({
                x: toWorldX(xVal, xMin, xMax, dims.width),
                y: toWorldY(0, yMin, yMax, dims.height, zeroHeight),
                z: toWorldZ(depthRange.max, depthRange.min, depthRange.max, dims.depth)
            });
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
        }
        for (let zi = 0; zi <= zSteps; zi++) {
            const t = zi / zSteps;
            const zVal = depthRange.min + t * (depthRange.max - depthRange.min);
            const start = projectPoint3D({
                x: toWorldX(xMin, xMin, xMax, dims.width),
                y: toWorldY(0, yMin, yMax, dims.height, zeroHeight),
                z: toWorldZ(zVal, depthRange.min, depthRange.max, dims.depth)
            });
            const end = projectPoint3D({
                x: toWorldX(xMax, xMin, xMax, dims.width),
                y: toWorldY(0, yMin, yMax, dims.height, zeroHeight),
                z: toWorldZ(zVal, depthRange.min, depthRange.max, dims.depth)
            });
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
        }

        // Slice indicator
        if (!isNaN(depthMeta.value)) {
            const sliceVal = Math.max(depthRange.min, Math.min(depthRange.max, depthMeta.value));
            const sliceStart = projectPoint3D({
                x: toWorldX(xMin, xMin, xMax, dims.width),
                y: toWorldY(0, yMin, yMax, dims.height, zeroHeight),
                z: toWorldZ(sliceVal, depthRange.min, depthRange.max, dims.depth)
            });
            const sliceEnd = projectPoint3D({
                x: toWorldX(xMax, xMin, xMax, dims.width),
                y: toWorldY(0, yMin, yMax, dims.height, zeroHeight),
                z: toWorldZ(sliceVal, depthRange.min, depthRange.max, dims.depth)
            });
            ctx.strokeStyle = 'rgba(120, 119, 198, 0.35)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(sliceStart.x, sliceStart.y);
            ctx.lineTo(sliceEnd.x, sliceEnd.y);
            ctx.stroke();
        }

        function drawAxis(fromPoint, toPoint, label, color) {
            const from = projectPoint3D(fromPoint);
            const to = projectPoint3D(toPoint);
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.shadowBlur = 8;
            ctx.shadowColor = color;
            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.fillStyle = color;
            ctx.font = '12px sans-serif';
            ctx.fillText(label, to.x + 6, to.y - 6);
        }

        const originPoint = {
            x: toWorldX(0, xMin, xMax, dims.width),
            y: toWorldY(0, yMin, yMax, dims.height, zeroHeight),
            z: toWorldZ(0, depthRange.min, depthRange.max, dims.depth)
        };
        drawAxis(
            { ...originPoint, x: toWorldX(xMin, xMin, xMax, dims.width) },
            { ...originPoint, x: toWorldX(xMax, xMin, xMax, dims.width) },
            'x',
            'rgba(120, 119, 198, 0.8)'
        );
        const fMin = Math.min(0, yMin);
        const fMax = Math.max(0, yMax);
        drawAxis(
            { ...originPoint, y: toWorldY(fMin, yMin, yMax, dims.height, zeroHeight) },
            { ...originPoint, y: toWorldY(fMax, yMin, yMax, dims.height, zeroHeight) },
            'f',
            'rgba(120, 119, 198, 0.8)'
        );
        if (depthMeta.label) {
            drawAxis(
                { ...originPoint, z: toWorldZ(depthRange.min, depthRange.min, depthRange.max, dims.depth) },
                { ...originPoint, z: toWorldZ(depthRange.max, depthRange.min, depthRange.max, dims.depth) },
                depthMeta.label,
                'rgba(72, 149, 239, 0.9)'
            );
        }
    }

    function drawFunction2D(func, xMin, xMax, yMin, yMax, color, lineWidth, dashed, progress) {
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.shadowBlur = 15;
        ctx.shadowColor = color;
        ctx.beginPath();
        let started = false;
        const steps = 500;
        const maxStep = Math.floor(steps * progress);
        for (let i = 0; i <= maxStep; i++) {
            const x = xMin + i * (xMax - xMin) / steps;
            try {
                const y = func(x);
                if (!isFinite(y) || y < yMin - 3 || y > yMax + 3) continue;
                const sx = toScreenX(x, xMin, xMax);
                const sy = toScreenY(y, yMin, yMax);
                if (!started) {
                    ctx.moveTo(sx, sy);
                    started = true;
                } else {
                    ctx.lineTo(sx, sy);
                }
            } catch (e) { continue; }
        }
        if (dashed) ctx.setLineDash([8, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
        if (progress < 1 && started) {
            const x = xMin + maxStep * (xMax - xMin) / steps;
            try {
                const y = func(x);
                if (isFinite(y)) {
                    ctx.fillStyle = color;
                    ctx.shadowBlur = 20;
                    ctx.shadowColor = color;
                    ctx.beginPath();
                    ctx.arc(toScreenX(x, xMin, xMax), toScreenY(y, yMin, yMax), 3 + Math.sin(Date.now() / 100), 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.shadowBlur = 0;
                }
            } catch (e) {}
        }
    }

    function drawExpansionPoint2D(centerPoint, xMin, xMax, yMin, yMax, def) {
        const y = safeEvaluate(def, centerPoint);
        if (!isFinite(y)) return;
        const sx = toScreenX(centerPoint[0], xMin, xMax);
        const sy = toScreenY(y, yMin, yMax);
        const time = Date.now() / 1000;
        for (let i = 0; i < 3; i++) {
            const phase = (time + i * 0.3) % 1;
            const radius = 10 + phase * 20;
            const alpha = (1 - phase) * 0.3;
            const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
            grad.addColorStop(0, `rgba(255, 107, 157, ${alpha})`);
            grad.addColorStop(1, 'rgba(255, 107, 157, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(sx, sy, radius, 0, 2 * Math.PI);
            ctx.fill();
        }
        ctx.fillStyle = POINT_COLOR;
        ctx.shadowBlur = 20;
        ctx.shadowColor = POINT_COLOR;
        ctx.beginPath();
        ctx.arc(sx, sy, 6, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 0;
        ctx.stroke();
        ctx.fillStyle = POINT_COLOR;
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowBlur = 10;
        const label = centerPoint.length === 1
            ? `a = ${centerPoint[0].toFixed(1)}`
            : `a = (${centerPoint.map(v => v.toFixed(1)).join(', ')})`;
        ctx.fillText(label, sx, sy - 25);
        ctx.shadowBlur = 0;
    }

    function drawExpansionPoint3D(centerPoint, xMin, xMax, yMin, yMax, def, depthMeta, dims, zeroHeight) {
        const depthRange = depthMeta.range;
        const depthValue = depthMeta.value;
        const y = safeEvaluate(def, centerPoint);
        if (!isFinite(y)) return;
        const worldPoint = {
            x: toWorldX(centerPoint[0], xMin, xMax, dims.width),
            y: toWorldY(y, yMin, yMax, dims.height, zeroHeight),
            z: toWorldZ(depthValue, depthRange.min, depthRange.max, dims.depth)
        };
        const screen = projectPoint3D(worldPoint);
        const time = Date.now() / 1000;
        for (let i = 0; i < 3; i++) {
            const phase = (time + i * 0.3) % 1;
            const radius = 10 + phase * 20;
            const alpha = (1 - phase) * 0.3;
            const grad = ctx.createRadialGradient(screen.x, screen.y, 0, screen.x, screen.y, radius);
            grad.addColorStop(0, `rgba(255, 107, 157, ${alpha})`);
            grad.addColorStop(1, 'rgba(255, 107, 157, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(screen.x, screen.y, radius, 0, 2 * Math.PI);
            ctx.fill();
        }
        ctx.fillStyle = POINT_COLOR;
        ctx.shadowBlur = 20;
        ctx.shadowColor = POINT_COLOR;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, 6, 0, 2 * Math.PI);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = POINT_COLOR;
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
            centerPoint.length === 2
                ? `a = (${centerPoint[0].toFixed(1)}, ${centerPoint[1].toFixed(1)})`
                : `a = (${centerPoint[0].toFixed(1)}, ${centerPoint[1].toFixed(1)}, ${centerPoint[2].toFixed(1)})`,
            screen.x,
            screen.y - 25
        );
    }

    function drawLegend(def) {
        const x = canvas.width - PADDING - 200;
        const y = PADDING + 25;
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'left';
        ctx.strokeStyle = ORIGINAL_COLOR;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 10;
        ctx.shadowColor = ORIGINAL_COLOR;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 40, y);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#e0e0e0';
        const fname = getFunctionDisplayName(def);
        ctx.fillText(fname, x + 50, y + 5);
        ctx.strokeStyle = TAYLOR_COLOR;
        ctx.setLineDash([8, 4]);
        ctx.shadowBlur = 10;
        ctx.shadowColor = TAYLOR_COLOR;
        ctx.beginPath();
        ctx.moveTo(x, y + 30);
        ctx.lineTo(x + 40, y + 30);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#b8b8d1';
        ctx.fillText(`Taylor (n=${Math.round(currentTerms)})`, x + 50, y + 35);
    }

    function draw() {
        const funcDef = getCurrentFunctionDef();
        const centerPoint = getCenterPoint();
        const terms = Math.round(currentTerms);
        const signature = getFunctionSignature(funcDef);
        const dimensions = funcDef.dimensions || 1;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const xMin = -2 * Math.PI;
        const xMax = 2 * Math.PI;
        const actualEvaluator = (x) => safeEvaluate(funcDef, buildPointForX(x, centerPoint));
        const [yMin, yMax] = determineRange(actualEvaluator, xMin, xMax, funcDef);
        if (dimensions === 1) {
            draw2DGrid(xMin, xMax, yMin, yMax);
            drawFunction2D(
                actualEvaluator,
                xMin,
                xMax,
                yMin,
                yMax,
                ORIGINAL_COLOR,
                3,
                false,
                1
            );
            drawFunction2D(
                (x) => evaluateTaylorAt(buildPointForX(x, centerPoint), centerPoint, terms, funcDef, signature),
                xMin,
                xMax,
                yMin,
                yMax,
                TAYLOR_COLOR,
                3,
                true,
                drawProgress
            );
            drawExpansionPoint2D(centerPoint, xMin, xMax, yMin, yMax, funcDef);
        } else {
            const dimsInfo = getWorldDimensions();
            const zeroHeight = computeZeroHeight(yMin, yMax, dimsInfo.height);
            const depthMeta = getDepthMeta(centerPoint);
            draw3DCoordinateSystem(xMin, xMax, yMin, yMax, depthMeta, dimsInfo, zeroHeight);
            drawFunction3D(
                actualEvaluator,
                xMin,
                xMax,
                yMin,
                yMax,
                ORIGINAL_COLOR,
                3,
                false,
                1,
                centerPoint,
                depthMeta,
                dimsInfo,
                zeroHeight
            );
            drawFunction3D(
                (x) => evaluateTaylorAt(buildPointForX(x, centerPoint), centerPoint, terms, funcDef, signature),
                xMin,
                xMax,
                yMin,
                yMax,
                TAYLOR_COLOR,
                3,
                true,
                drawProgress,
                centerPoint,
                depthMeta,
                dimsInfo,
                zeroHeight
            );
            drawExpansionPoint3D(centerPoint, xMin, xMax, yMin, yMax, funcDef, depthMeta, dimsInfo, zeroHeight);
        }
        drawLegend(funcDef);
    }

    const VARIABLE_LABELS = ['x', 'y', 'z', 'w'];

    function formatTermProduct(powers, centerPoint) {
        const parts = [];
        powers.forEach((power, idx) => {
            if (power === 0) return;
            const label = VARIABLE_LABELS[idx] || `x${idx + 1}`;
            const base = `(${label} - ${centerPoint[idx].toFixed(2)})`;
            parts.push(power === 1 ? base : `${base}^${power}`);
        });
        return parts.join('·');
    }

    function buildFormulaFromTerms(termsList, centerPoint) {
        if (!termsList.length) return '0';
        return termsList.map((term, index) => {
            const sign = term.coeff >= 0 ? (index === 0 ? '' : ' + ') : (index === 0 ? '-' : ' - ');
            const absCoeff = Math.abs(term.coeff);
            const hasVariables = term.powers.some(power => power > 0);
            let coeffStr = absCoeff.toFixed(3);
            if (hasVariables && Math.abs(absCoeff - 1) < 0.001) {
                coeffStr = '';
            }
            const product = formatTermProduct(term.powers, centerPoint);
            let body = '';
            if (!product) {
                body = coeffStr;
            } else if (!coeffStr) {
                body = product;
            } else {
                body = `${coeffStr}·${product}`;
            }
            if (!body) body = '0';
            return `${sign}${body}`;
        }).join('');
    }

    function formatOneDimFormula(def, centerPoint, terms) {
        let result = '';
        const maxTerms = Math.min(terms, 5);
        for (let i = 0; i < maxTerms; i++) {
            try {
                const d = def.derivative(centerPoint[0], i);
                const fact = factorial(i);
                if (!isFinite(d) || !isFinite(fact)) continue;
                const c = d / fact;
                if (Math.abs(c) < 1e-6) continue;
                if (result) result += c >= 0 ? ' + ' : ' - ';
                else if (c < 0) result += '-';
                const ac = Math.abs(c);
                if (i === 0) {
                    result += ac.toFixed(3);
                } else if (i === 1) {
                    const coeff = Math.abs(ac - 1) < 0.001 ? '' : ac.toFixed(3);
                    result += `${coeff}(x - ${centerPoint[0].toFixed(2)})`;
                } else {
                    const coeff = Math.abs(ac - 1) < 0.001 ? '' : ac.toFixed(3);
                    result += `${coeff}(x - ${centerPoint[0].toFixed(2)})^${i}`;
                }
            } catch (e) { continue; }
        }
        if (!result) result = '0';
        if (terms > 5) result += ' + ...';
        return result;
    }

    function formatMultiDimFormula(def, centerPoint, terms) {
        const signature = getFunctionSignature(def);
        const maxOrder = Math.min(terms, 3);
        const pieces = [];
        for (let totalOrder = 0; totalOrder < maxOrder; totalOrder++) {
            const indices = enumerateMultiIndices(def.dimensions, totalOrder);
            for (const multiIdx of indices) {
                const derivative = getDerivativeValue(def, signature, centerPoint, multiIdx);
                if (!isFinite(derivative)) continue;
                const denom = multiFactorial(multiIdx);
                if (!isFinite(denom) || denom === 0) continue;
                const coeff = derivative / denom;
                if (Math.abs(coeff) < 1e-6) continue;
                pieces.push({ coeff, powers: multiIdx });
            }
        }
        let formula = buildFormulaFromTerms(pieces, centerPoint);
        if (terms > maxOrder) {
            formula += ' + ...';
        }
        return formula;
    }

    function updateFormula() {
        const def = getCurrentFunctionDef();
        const dims = getCurrentDimensions();
        const centerPoint = getCenterPoint();
        const terms = parseInt(termsSlider.value, 10);
        const base = `${getFunctionDisplayName(def)} ≈ `;
        const body = dims === 1
            ? formatOneDimFormula(def, centerPoint, terms)
            : formatMultiDimFormula(def, centerPoint, terms);
        formulaDisplay.textContent = base + body;
    }

    function frameLoop(timestamp) {
        if (lastFrameTime === null) {
            lastFrameTime = timestamp;
        }
        const delta = timestamp - lastFrameTime;
        lastFrameTime = timestamp;
        const dt = Math.min(0.1, delta / 1000);

        if (isPlaying) {
            if (currentTerms < targetTerms) {
                const prevRounded = Math.round(currentTerms);
                const easing = 1 - Math.exp(-dt * TERM_EASING);
                currentTerms += (targetTerms - currentTerms) * easing;
                if (Math.abs(targetTerms - currentTerms) < 0.01) {
                    currentTerms = targetTerms;
                }
                const rounded = Math.max(1, Math.round(currentTerms));
                if (rounded !== prevRounded) {
                    drawProgress = 0;
                    invalidateFormula();
                }
                termsSlider.value = rounded;
                termsValue.textContent = rounded;
            } else {
                isPlaying = false;
                playButton.textContent = '▶ Abspielen';
            }
        }

        if (drawProgress < 1) {
            const speed = isPlaying ? DRAW_SPEED_PLAYING : DRAW_SPEED_IDLE;
            const progressEase = 1 - Math.exp(-dt * speed);
            drawProgress += (1 - drawProgress) * progressEase;
            if (drawProgress > 0.999) drawProgress = 1;
        }

        draw();
        if (needsFormulaUpdate) {
            updateFormula();
            needsFormulaUpdate = false;
        }

        requestAnimationFrame(frameLoop);
    }

    function resizeCanvas() {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        draw();
    }

    function handleFunctionChange() {
        const def = getCurrentFunctionDef();
        const dimensions = getCurrentDimensions();
        const isCustom = ['custom', 'custom2d', 'custom3d'].includes(functionSelect.value);
        customFunctionGroup.style.display = isCustom ? 'flex' : 'none';
        if (isCustom) {
            updateCustomInputMeta(dimensions);
        }
        customError.classList.remove('show');
        isPlaying = false;
        playButton.textContent = '▶ Abspielen';
        viewState.isDragging = false;
        updateDimensionUI(dimensions);
        clearDerivativeCaches();
        drawProgress = 0;
        invalidateFormula();
    }

    functionSelect.addEventListener('change', handleFunctionChange);

    customFunctionInput.addEventListener('input', (e) => {
        const def = getCurrentFunctionDef();
        const dimensions = def.dimensions;
        const expr = e.target.value.trim();
        customFunctionStrings[dimensions] = expr;
        if (!expr) {
            customFunctions[dimensions] = null;
            customError.classList.remove('show');
            clearDerivativeCaches();
            drawProgress = 0;
            invalidateFormula();
            return;
        }
        const parsed = parseCustomFunction(expr, dimensions);
        if (parsed) {
            customFunctions[dimensions] = parsed;
            customError.classList.remove('show');
            clearDerivativeCaches();
            drawProgress = 0;
            invalidateFormula();
        } else {
            customFunctions[dimensions] = null;
            customError.classList.add('show');
            clearDerivativeCaches();
            drawProgress = 0;
            invalidateFormula();
        }
    });

    termsSlider.addEventListener('input', (e) => {
        const max = parseInt(termsSlider.max, 10);
        let value = parseInt(e.target.value, 10);
        if (value > max) value = max;
        termsSlider.value = value;
        currentTerms = targetTerms = value;
        termsValue.textContent = value;
        isPlaying = false;
        playButton.textContent = '▶ Abspielen';
        drawProgress = 0;
        invalidateFormula();
    });

    centerSlider.addEventListener('input', (e) => {
        centerValue.textContent = parseFloat(e.target.value).toFixed(1);
        clearDerivativeCaches();
        drawProgress = 0;
        invalidateFormula();
    });

    centerSliderY.addEventListener('input', (e) => {
        centerValueY.textContent = parseFloat(e.target.value).toFixed(1);
        if (getCurrentDimensions() === 1) return;
        clearDerivativeCaches();
        drawProgress = 0;
        invalidateFormula();
    });

    centerSliderZ.addEventListener('input', (e) => {
        centerValueZ.textContent = parseFloat(e.target.value).toFixed(1);
        if (getCurrentDimensions() < 3) return;
        clearDerivativeCaches();
        drawProgress = 0;
        invalidateFormula();
    });

    playButton.addEventListener('click', () => {
        if (isPlaying) {
            isPlaying = false;
            playButton.textContent = '▶ Abspielen';
            return;
        }
        currentTerms = 1;
        targetTerms = parseInt(termsSlider.value, 10);
        drawProgress = 0;
        isPlaying = true;
        playButton.textContent = '⏸ Pause';
        termsSlider.value = 1;
        termsValue.textContent = 1;
        lastFrameTime = null;
        invalidateFormula();
    });

    resetButton.addEventListener('click', () => {
        isPlaying = false;
        playButton.textContent = '▶ Abspielen';
        termsSlider.value = 1;
        currentTerms = 1;
        targetTerms = 1;
        termsValue.textContent = 1;
        centerSlider.value = 0;
        centerValue.textContent = '0.0';
        centerSliderY.value = 0;
        centerValueY.textContent = '0.0';
        centerSliderZ.value = 0;
        centerValueZ.textContent = '0.0';
        functionSelect.value = 'sin';
        handleFunctionChange();
        drawProgress = 1;
        invalidateFormula();
        draw();
    });

    function attachRotationControls() {
        canvas.addEventListener('pointerdown', (e) => {
            if (getCurrentDimensions() === 1) return;
            viewState.isDragging = true;
            viewState.lastX = e.clientX;
            viewState.lastY = e.clientY;
            if (canvas.setPointerCapture) {
                canvas.setPointerCapture(e.pointerId);
            }
        });
        canvas.addEventListener('pointermove', (e) => {
            if (!viewState.isDragging) return;
            const dx = e.clientX - viewState.lastX;
            const dy = e.clientY - viewState.lastY;
            viewState.yaw += dx * 0.005;
            viewState.pitch = Math.max(-0.2, Math.min(1.2, viewState.pitch + dy * 0.003));
            viewState.lastX = e.clientX;
            viewState.lastY = e.clientY;
            draw();
        });
        function endDrag(e) {
            if (viewState.isDragging) {
                viewState.isDragging = false;
                if (e.pointerId !== undefined && canvas.hasPointerCapture && canvas.hasPointerCapture(e.pointerId)) {
                    canvas.releasePointerCapture(e.pointerId);
                }
            }
        }
        canvas.addEventListener('pointerup', endDrag);
        canvas.addEventListener('pointerleave', endDrag);
    }

    handleFunctionChange();
    attachRotationControls();
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    updateFormula();
    needsFormulaUpdate = false;
    requestAnimationFrame(frameLoop);
});
