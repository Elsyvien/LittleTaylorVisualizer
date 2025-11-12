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
    const customError = document.getElementById('custom-error');
    const playButton = document.getElementById('play-button');
    const resetButton = document.getElementById('reset-button');
    const formulaDisplay = document.getElementById('formula-display');

    let isPlaying = false;
    let currentTerms = 1;
    let targetTerms = 1;
    let drawProgress = 0;
    let lastFrameTime = null;
    let needsFormulaUpdate = true;

    const PADDING = 60;
    const GRID_COLOR = 'rgba(120, 119, 198, 0.15)';
    const AXIS_COLOR = 'rgba(120, 119, 198, 0.5)';
    const ORIGINAL_COLOR = '#7877c6';
    const TAYLOR_COLOR = '#4895ef';
    const POINT_COLOR = '#ff6b9d';
    const TERM_EASING = 6;
    const DRAW_SPEED_PLAYING = 6;
    const DRAW_SPEED_IDLE = 4;

    let customFunction = null;
    let customFunctionStr = '';
    function invalidateFormula() {
        needsFormulaUpdate = true;
    }

    function parseCustomFunction(expr) {
        try {
            expr = expr.replace(/\^/g, '**').replace(/(\d)([a-z])/gi, '$1*$2');
            const func = new Function('x', `
                with (Math) { return ${expr}; }
            `);
            if (!isFinite(func(0))) throw new Error();
            return func;
        } catch (e) {
            return null;
        }
    }

    const derivCache = new Map();
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
            func: Math.sin,
            derivative: (x, n) => [Math.sin, Math.cos, (x) => -Math.sin(x), (x) => -Math.cos(x)][n % 4](x)
        },
        cos: {
            name: 'cos(x)',
            func: Math.cos,
            derivative: (x, n) => [Math.cos, (x) => -Math.sin(x), (x) => -Math.cos(x), Math.sin][n % 4](x)
        },
        exp: {
            name: 'e^x',
            func: Math.exp,
            derivative: (x, n) => Math.exp(x)
        },
        ln: {
            name: 'ln(1+x)',
            func: x => Math.log(1 + x),
            derivative: (x, n) => n === 0 ? Math.log(1 + x) : Math.pow(-1, n - 1) * factorial(n - 1) / Math.pow(1 + x, n)
        },
        custom: {
            name: 'f(x)',
            func: x => customFunction ? customFunction(x) : 0,
            derivative: (x, n) => customFunction ? numericalDerivative(customFunction, x, n) : 0
        }
    };

    function factorial(n) {
        if (n > 170) return Infinity;
        if (n <= 1) return 1;
        let r = 1;
        for (let i = 2; i <= n; i++) r *= i;
        return r;
    }

    function taylorSeries(x, center, n) {
        const f = functions[functionSelect.value];
        let sum = 0;
        for (let i = 0; i < n; i++) {
            try {
                const d = f.derivative(center, i);
                const fact = factorial(i);
                if (!isFinite(d) || !isFinite(fact)) continue;
                const term = (d / fact) * Math.pow(x - center, i);
                if (isFinite(term)) sum += term;
            } catch (e) { continue; }
        }
        return sum;
    }

    function toScreenX(x, xMin, xMax) {
        return PADDING + ((x - xMin) / (xMax - xMin)) * (canvas.width - 2 * PADDING);
    }

    function toScreenY(y, yMin, yMax) {
        return canvas.height - PADDING - ((y - yMin) / (yMax - yMin)) * (canvas.height - 2 * PADDING);
    }

    function drawGrid(xMin, xMax, yMin, yMax) {
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

    function drawFunction(func, xMin, xMax, yMin, yMax, color, lineWidth, dashed, progress) {
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

    function drawExpansionPoint(center, xMin, xMax, yMin, yMax) {
        const y = functions[functionSelect.value].func(center);
        if (!isFinite(y)) return;
        const sx = toScreenX(center, xMin, xMax);
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
        ctx.fillText(`a = ${center.toFixed(1)}`, sx, sy - 25);
        ctx.shadowBlur = 0;
    }

    function drawLegend() {
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
        const fname = functionSelect.value === 'custom' ? customFunctionStr || 'f(x)' : functions[functionSelect.value].name;
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
        const center = parseFloat(centerSlider.value);
        const terms = Math.round(currentTerms);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const xMin = -2 * Math.PI, xMax = 2 * Math.PI;
        let yMin = -3, yMax = 3;
        if (functionSelect.value === 'exp') { yMin = -2; yMax = 10; }
        drawGrid(xMin, xMax, yMin, yMax);
        drawFunction(functions[functionSelect.value].func, xMin, xMax, yMin, yMax, ORIGINAL_COLOR, 3, false, 1);
        drawFunction(x => taylorSeries(x, center, terms), xMin, xMax, yMin, yMax, TAYLOR_COLOR, 3, true, drawProgress);
        drawExpansionPoint(center, xMin, xMax, yMin, yMax);
        drawLegend();
    }

    function updateFormula() {
        const center = parseFloat(centerSlider.value);
        const terms = parseInt(termsSlider.value);
        const f = functions[functionSelect.value];
        let formula = (functionSelect.value === 'custom' ? customFunctionStr || 'f(x)' : f.name) + ' ≈ ';
        for (let i = 0; i < Math.min(terms, 5); i++) {
            try {
                const d = f.derivative(center, i);
                const fact = factorial(i);
                if (!isFinite(d) || !isFinite(fact)) continue;
                const c = d / fact;
                if (i > 0 && c >= 0) formula += ' + ';
                else if (i > 0 && c < 0) formula += ' - ';
                const ac = Math.abs(c);
                if (i === 0) formula += ac.toFixed(3);
                else if (i === 1) formula += (Math.abs(ac - 1) < 0.001 ? '' : ac.toFixed(3)) + `(x - ${center})`;
                else formula += (Math.abs(ac - 1) < 0.001 ? '' : ac.toFixed(3)) + `(x - ${center})^${i}`;
            } catch (e) {}
        }
        if (terms > 5) formula += ' + ...';
        formulaDisplay.textContent = formula;
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

    functionSelect.addEventListener('change', () => {
        customFunctionGroup.style.display = functionSelect.value === 'custom' ? 'flex' : 'none';
        derivCache.clear();
        drawProgress = 0;
        invalidateFormula();
    });

    customFunctionInput.addEventListener('input', (e) => {
        customFunctionStr = e.target.value.trim();
        if (!customFunctionStr) { customError.classList.remove('show'); return; }
        const f = parseCustomFunction(customFunctionStr);
        if (f) {
            customFunction = f;
            customError.classList.remove('show');
            derivCache.clear();
            drawProgress = 0;
            invalidateFormula();
        } else {
            customError.classList.add('show');
        }
    });

    termsSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value, 10);
        currentTerms = targetTerms = value;
        termsValue.textContent = value;
        isPlaying = false;
        playButton.textContent = '▶ Abspielen';
        drawProgress = 0;
        invalidateFormula();
    });

    centerSlider.addEventListener('input', (e) => {
        centerValue.textContent = parseFloat(e.target.value).toFixed(1);
        derivCache.clear();
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
        functionSelect.value = 'sin';
        customFunctionGroup.style.display = 'none';
        derivCache.clear();
        drawProgress = 1;
        invalidateFormula();
        draw();
    });

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    updateFormula();
    needsFormulaUpdate = false;
    requestAnimationFrame(frameLoop);
});
