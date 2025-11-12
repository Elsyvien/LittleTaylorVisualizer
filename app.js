// Wait for DOM to be fully loaded// Wait for DOM to be fully loaded

document.addEventListener('DOMContentLoaded', function() {document.addEventListener('DOMContentLoaded', function() {

    console.log('DOM loaded, initializing...');    console.log('DOM loaded, initializing...');

        

    // Canvas Setup    // Canvas Setup

    const canvas = document.getElementById('graph-canvas');    const canvas = document.getElementById('graph-canvas');

    const ctx = canvas.getContext('2d');    const ctx = canvas.getContext('2d');



    // Controls    // Controls

    const termsSlider = document.getElementById('terms-slider');    const termsSlider = document.getElementById('terms-slider');

    const termsValue = document.getElementById('terms-value');    const termsValue = document.getElementById('terms-value');

    const centerSlider = document.getElementById('center-slider');    const centerSlider = document.getElementById('center-slider');

    const centerValue = document.getElementById('center-value');    const centerValue = document.getElementById('center-value');

    const functionSelect = document.getElementById('function-select');    const functionSelect = document.getElementById('function-select');

    const customFunctionInput = document.getElementById('custom-function');    const customFunctionInput = document.getElementById('custom-function');

    const customFunctionGroup = document.getElementById('custom-function-group');    const customFunctionGroup = document.getElementById('custom-function-group');

    const customError = document.getElementById('custom-error');    const customError = document.getElementById('custom-error');

    const playButton = document.getElementById('play-button');    const playButton = document.getElementById('play-button');

    const resetButton = document.getElementById('reset-button');    const resetButton = document.getElementById('reset-button');

    const formulaDisplay = document.getElementById('formula-display');    const formulaDisplay = document.getElementById('formula-display');



    // Animation state    // Animation state

    let isPlaying = false;    let isPlaying = false;

    let animationFrame = null;    let animationFrame = null;

    let currentTerms = 1;    let currentTerms = 1;

    let targetTerms = 1;    let targetTerms = 1;

    let drawProgress = 0;    let animationProgress = 0;

    let targetDrawProgress = 1;

    let lastTime = Date.now();    // Graph settings

    const PADDING = 60;

    // Graph settings    const GRID_COLOR = '#1a1a1a';

    const PADDING = 60;    const AXIS_COLOR = '#666';

    const GRID_COLOR = 'rgba(120, 119, 198, 0.15)';    const ORIGINAL_COLOR = '#ffffff';

    const AXIS_COLOR = 'rgba(120, 119, 198, 0.5)';    const TAYLOR_COLOR = '#888';

    const ORIGINAL_COLOR = '#7877c6';    const POINT_COLOR = '#fff';

    const TAYLOR_COLOR = '#4895ef';

    const POINT_COLOR = '#ff6b9d';    // Custom function state

    let customFunction = null;

    // Custom function state    let customFunctionStr = '';

    let customFunction = null;

    let customFunctionStr = '';    // Parse custom function

    function parseCustomFunction(expr) {

    // Parse custom function        try {

    function parseCustomFunction(expr) {            // Replace common math notation

        try {            expr = expr.replace(/\^/g, '**');

            expr = expr.replace(/\^/g, '**');            expr = expr.replace(/(\d)([a-z])/gi, '$1*$2'); // 2x -> 2*x

            expr = expr.replace(/(\d)([a-z])/gi, '$1*$2');            

                        // Create function

            const func = new Function('x', `            const func = new Function('x', `

                const sin = Math.sin;                const sin = Math.sin;

                const cos = Math.cos;                const cos = Math.cos;

                const tan = Math.tan;                const tan = Math.tan;

                const exp = Math.exp;                const exp = Math.exp;

                const log = Math.log;                const log = Math.log;

                const ln = Math.log;                const ln = Math.log;

                const sqrt = Math.sqrt;                const sqrt = Math.sqrt;

                const abs = Math.abs;                const abs = Math.abs;

                const PI = Math.PI;                const PI = Math.PI;

                const E = Math.E;                const E = Math.E;

                return ${expr};                return ${expr};

            `);            `);

                        

            const testResult = func(0);            // Test function

            if (!isFinite(testResult)) throw new Error('Invalid result');            const testResult = func(0);

                        if (!isFinite(testResult)) throw new Error('Invalid result');

            return func;            

        } catch (e) {            return func;

            return null;        } catch (e) {

        }            return null;

    }        }

    }

    // Numerical derivative

    function numericalDerivative(func, x, order = 1, h = 0.001) {    // Numerical derivative

        if (order === 0) return func(x);    function numericalDerivative(func, x, order = 1, h = 0.001) {

                if (order === 0) return func(x);

        if (order === 1) {        

            return (func(x + h) - func(x - h)) / (2 * h);        if (order === 1) {

        }            return (func(x + h) - func(x - h)) / (2 * h);

                }

        const derivFunc = (x) => numericalDerivative(func, x, order - 1, h);        

        return (derivFunc(x + h) - derivFunc(x - h)) / (2 * h);        // Higher order derivatives using recursive approach

    }        const derivFunc = (x) => numericalDerivative(func, x, order - 1, h);

        return (derivFunc(x + h) - derivFunc(x - h)) / (2 * h);

    // Math functions and their derivatives    }

    const functions = {

        sin: {    // Math functions and their derivatives

            name: 'sin(x)',    const functions = {

            func: Math.sin,        sin: {

            derivative: (x, n) => {            name: 'sin(x)',

                const mod = n % 4;            func: Math.sin,

                if (mod === 0) return Math.sin(x);            derivative: (x, n) => {

                if (mod === 1) return Math.cos(x);                const mod = n % 4;

                if (mod === 2) return -Math.sin(x);                if (mod === 0) return Math.sin(x);

                return -Math.cos(x);                if (mod === 1) return Math.cos(x);

            }                if (mod === 2) return -Math.sin(x);

        },                return -Math.cos(x);

        cos: {            }

            name: 'cos(x)',        },

            func: Math.cos,        cos: {

            derivative: (x, n) => {            name: 'cos(x)',

                const mod = n % 4;            func: Math.cos,

                if (mod === 0) return Math.cos(x);            derivative: (x, n) => {

                if (mod === 1) return -Math.sin(x);                const mod = n % 4;

                if (mod === 2) return -Math.cos(x);                if (mod === 0) return Math.cos(x);

                return Math.sin(x);                if (mod === 1) return -Math.sin(x);

            }                if (mod === 2) return -Math.cos(x);

        },                return Math.sin(x);

        exp: {            }

            name: 'e^x',        },

            func: Math.exp,        exp: {

            derivative: (x, n) => Math.exp(x)            name: 'e^x',

        },            func: Math.exp,

        ln: {            derivative: (x, n) => Math.exp(x)

            name: 'ln(1+x)',        },

            func: x => Math.log(1 + x),        ln: {

            derivative: (x, n) => {            name: 'ln(1+x)',

                if (n === 0) return Math.log(1 + x);            func: x => Math.log(1 + x),

                return Math.pow(-1, n - 1) * factorial(n - 1) / Math.pow(1 + x, n);            derivative: (x, n) => {

            }                if (n === 0) return Math.log(1 + x);

        },                return Math.pow(-1, n - 1) * factorial(n - 1) / Math.pow(1 + x, n);

        custom: {            }

            name: 'f(x)',        },

            func: x => customFunction ? customFunction(x) : 0,        custom: {

            derivative: (x, n) => customFunction ? numericalDerivative(customFunction, x, n) : 0            name: 'f(x)',

        }            func: x => customFunction ? customFunction(x) : 0,

    };            derivative: (x, n) => customFunction ? numericalDerivative(customFunction, x, n) : 0

        }

    // Factorial helper    };

    function factorial(n) {

        if (n <= 1) return 1;    // Factorial helper

        let result = 1;    function factorial(n) {

        for (let i = 2; i <= n; i++) {        if (n <= 1) return 1;

            result *= i;        let result = 1;

        }        for (let i = 2; i <= n; i++) {

        return result;            result *= i;

    }        }

        return result;

    // Taylor series calculation    }

    function taylorSeries(x, center, n) {

        const selectedFunc = functions[functionSelect.value];    // Taylor series calculation

        let sum = 0;    function taylorSeries(x, center, n) {

                const selectedFunc = functions[functionSelect.value];

        for (let i = 0; i < n; i++) {        let sum = 0;

            const derivative = selectedFunc.derivative(center, i);        

            const term = (derivative / factorial(i)) * Math.pow(x - center, i);        for (let i = 0; i < n; i++) {

            sum += term;            const derivative = selectedFunc.derivative(center, i);

        }            const term = (derivative / factorial(i)) * Math.pow(x - center, i);

                    sum += term;

        return sum;        }

    }        

        return sum;

    // Coordinate transformation    }

    function toScreenX(x, xMin, xMax) {

        return PADDING + ((x - xMin) / (xMax - xMin)) * (canvas.width - 2 * PADDING);    // Coordinate transformation

    }    function toScreenX(x, xMin, xMax) {

        return PADDING + ((x - xMin) / (xMax - xMin)) * (canvas.width - 2 * PADDING);

    function toScreenY(y, yMin, yMax) {    }

        return canvas.height - PADDING - ((y - yMin) / (yMax - yMin)) * (canvas.height - 2 * PADDING);

    }    function toScreenY(y, yMin, yMax) {

        return canvas.height - PADDING - ((y - yMin) / (yMax - yMin)) * (canvas.height - 2 * PADDING);

    // Draw grid and axes with glow    }

    function drawGrid(xMin, xMax, yMin, yMax) {

        ctx.strokeStyle = GRID_COLOR;    // Draw grid and axes

        ctx.lineWidth = 1;    function drawGrid(xMin, xMax, yMin, yMax) {

                ctx.strokeStyle = GRID_COLOR;

        // Vertical grid lines        ctx.lineWidth = 1;

        for (let x = Math.ceil(xMin); x <= Math.floor(xMax); x++) {        

            const screenX = toScreenX(x, xMin, xMax);        // Vertical grid lines

            ctx.beginPath();        for (let x = Math.ceil(xMin); x <= Math.floor(xMax); x++) {

            ctx.moveTo(screenX, PADDING);            const screenX = toScreenX(x, xMin, xMax);

            ctx.lineTo(screenX, canvas.height - PADDING);            ctx.beginPath();

            ctx.stroke();            ctx.moveTo(screenX, PADDING);

        }            ctx.lineTo(screenX, canvas.height - PADDING);

                    ctx.stroke();

        // Horizontal grid lines        }

        for (let y = Math.ceil(yMin); y <= Math.floor(yMax); y++) {        

            const screenY = toScreenY(y, yMin, yMax);        // Horizontal grid lines

            ctx.beginPath();        for (let y = Math.ceil(yMin); y <= Math.floor(yMax); y++) {

            ctx.moveTo(PADDING, screenY);            const screenY = toScreenY(y, yMin, yMax);

            ctx.lineTo(canvas.width - PADDING, screenY);            ctx.beginPath();

            ctx.stroke();            ctx.moveTo(PADDING, screenY);

        }            ctx.lineTo(canvas.width - PADDING, screenY);

                    ctx.stroke();

        // Axes with glow        }

        ctx.strokeStyle = AXIS_COLOR;        

        ctx.lineWidth = 2;        // Axes

        ctx.shadowBlur = 10;        ctx.strokeStyle = AXIS_COLOR;

        ctx.shadowColor = 'rgba(120, 119, 198, 0.5)';        ctx.lineWidth = 1.5;

                

        // X-axis        // X-axis

        if (yMin <= 0 && yMax >= 0) {        if (yMin <= 0 && yMax >= 0) {

            const y0 = toScreenY(0, yMin, yMax);            const y0 = toScreenY(0, yMin, yMax);

            ctx.beginPath();            ctx.beginPath();

            ctx.moveTo(PADDING, y0);            ctx.moveTo(PADDING, y0);

            ctx.lineTo(canvas.width - PADDING, y0);            ctx.lineTo(canvas.width - PADDING, y0);

            ctx.stroke();            ctx.stroke();

        }        }

                

        // Y-axis        // Y-axis

        if (xMin <= 0 && xMax >= 0) {        if (xMin <= 0 && xMax >= 0) {

            const x0 = toScreenX(0, xMin, xMax);            const x0 = toScreenX(0, xMin, xMax);

            ctx.beginPath();            ctx.beginPath();

            ctx.moveTo(x0, PADDING);            ctx.moveTo(x0, PADDING);

            ctx.lineTo(x0, canvas.height - PADDING);            ctx.lineTo(x0, canvas.height - PADDING);

            ctx.stroke();            ctx.stroke();

        }        }

                

        ctx.shadowBlur = 0;        // Labels

                ctx.fillStyle = AXIS_COLOR;

        // Labels        ctx.font = '11px -apple-system, sans-serif';

        ctx.fillStyle = AXIS_COLOR;        ctx.textAlign = 'center';

        ctx.font = '12px -apple-system, sans-serif';        

        ctx.textAlign = 'center';        // X-axis labels

                for (let x = Math.ceil(xMin); x <= Math.floor(xMax); x++) {

        // X-axis labels            if (x === 0) continue;

        for (let x = Math.ceil(xMin); x <= Math.floor(xMax); x++) {            const screenX = toScreenX(x, xMin, xMax);

            if (x === 0) continue;            const screenY = toScreenY(0, yMin, yMax);

            const screenX = toScreenX(x, xMin, xMax);            const labelY = Math.min(Math.max(screenY + 20, PADDING + 20), canvas.height - PADDING + 20);

            const screenY = toScreenY(0, yMin, yMax);            ctx.fillText(x.toString(), screenX, labelY);

            const labelY = Math.min(Math.max(screenY + 20, PADDING + 20), canvas.height - PADDING + 20);        }

            ctx.fillText(x.toString(), screenX, labelY);        

        }        // Y-axis labels

                ctx.textAlign = 'right';

        // Y-axis labels        for (let y = Math.ceil(yMin); y <= Math.floor(yMax); y++) {

        ctx.textAlign = 'right';            if (y === 0) continue;

        for (let y = Math.ceil(yMin); y <= Math.floor(yMax); y++) {            const screenX = toScreenX(0, xMin, xMax);

            if (y === 0) continue;            const screenY = toScreenY(y, yMin, yMax);

            const screenX = toScreenX(0, xMin, xMax);            const labelX = Math.min(Math.max(screenX - 10, PADDING + 30), canvas.width - PADDING - 10);

            const screenY = toScreenY(y, yMin, yMax);            ctx.fillText(y.toString(), labelX, screenY + 4);

            const labelX = Math.min(Math.max(screenX - 10, PADDING + 30), canvas.width - PADDING - 10);        }

            ctx.fillText(y.toString(), labelX, screenY + 4);    }

        }

    }    // Draw function curve with animation

    function drawFunction(func, xMin, xMax, yMin, yMax, color, lineWidth = 2, dashed = false, progress = 1) {

    // Draw function curve with progressive animation        ctx.strokeStyle = color;

    function drawFunction(func, xMin, xMax, yMin, yMax, color, lineWidth = 3, dashed = false, progress = 1) {        ctx.lineWidth = lineWidth;

        const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);        ctx.beginPath();

        gradient.addColorStop(0, color);        

        gradient.addColorStop(1, color + 'cc');        let started = false;

                const steps = 500;

        ctx.strokeStyle = gradient;        const maxStep = Math.floor(steps * progress);

        ctx.lineWidth = lineWidth;        const dx = (xMax - xMin) / steps;

        ctx.shadowBlur = 15;        

        ctx.shadowColor = color;        for (let i = 0; i <= maxStep; i++) {

                    const x = xMin + i * dx;

        ctx.beginPath();            let y;

                    

        let started = false;            try {

        const steps = 500;                y = func(x);

        const maxStep = Math.floor(steps * progress);                

        const dx = (xMax - xMin) / steps;                if (!isFinite(y)) continue;

                        

        for (let i = 0; i <= maxStep; i++) {                const margin = (yMax - yMin) * 0.1;

            const x = xMin + i * dx;                if (y < yMin - margin || y > yMax + margin) continue;

            let y;                

                            const screenX = toScreenX(x, xMin, xMax);

            try {                const screenY = toScreenY(y, yMin, yMax);

                y = func(x);                

                                if (!started) {

                if (!isFinite(y)) continue;                    ctx.moveTo(screenX, screenY);

                                    started = true;

                const margin = (yMax - yMin) * 0.1;                } else {

                if (y < yMin - margin || y > yMax + margin) continue;                    ctx.lineTo(screenX, screenY);

                                }

                const screenX = toScreenX(x, xMin, xMax);            } catch (e) {

                const screenY = toScreenY(y, yMin, yMax);                continue;

                            }

                if (!started) {        }

                    ctx.moveTo(screenX, screenY);        

                    started = true;        if (dashed) {

                } else {            ctx.setLineDash([4, 4]);

                    ctx.lineTo(screenX, screenY);        } else {

                }            ctx.setLineDash([]);

            } catch (e) {        }

                continue;        

            }        ctx.stroke();

        }        ctx.setLineDash([]);

            }

        if (dashed) {

            ctx.setLineDash([8, 4]);    // Draw expansion point with pulse animation

        } else {    function drawExpansionPoint(center, xMin, xMax, yMin, yMax, pulse = 1) {

            ctx.setLineDash([]);        const selectedFunc = functions[functionSelect.value];

        }        const y = selectedFunc.func(center);

                

        ctx.stroke();        if (!isFinite(y)) return;

        ctx.setLineDash([]);        

        ctx.shadowBlur = 0;        const screenX = toScreenX(center, xMin, xMax);

                const screenY = toScreenY(y, yMin, yMax);

        // Draw point at the end of the curve during animation        

        if (progress < 1 && started) {        // Outer glow

            const x = xMin + maxStep * dx;        const glowRadius = 12 * pulse;

            try {        const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, glowRadius);

                const y = func(x);        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');

                if (isFinite(y)) {        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

                    const screenX = toScreenX(x, xMin, xMax);        ctx.fillStyle = gradient;

                    const screenY = toScreenY(y, yMin, yMax);        ctx.beginPath();

                            ctx.arc(screenX, screenY, glowRadius, 0, 2 * Math.PI);

                    // Pulsating point        ctx.fill();

                    const pulseSize = 3 + Math.sin(Date.now() / 100) * 1;        

                    ctx.fillStyle = color;        // Main point

                    ctx.shadowBlur = 20;        ctx.fillStyle = POINT_COLOR;

                    ctx.shadowColor = color;        ctx.beginPath();

                    ctx.beginPath();        ctx.arc(screenX, screenY, 5, 0, 2 * Math.PI);

                    ctx.arc(screenX, screenY, pulseSize, 0, 2 * Math.PI);        ctx.fill();

                    ctx.fill();        

                    ctx.shadowBlur = 0;        ctx.strokeStyle = '#0a0a0a';

                }        ctx.lineWidth = 2;

            } catch (e) {}        ctx.stroke();

        }        

    }        // Label

        ctx.fillStyle = POINT_COLOR;

    // Draw expansion point with animated glow        ctx.font = 'bold 12px -apple-system, sans-serif';

    function drawExpansionPoint(center, xMin, xMax, yMin, yMax) {        ctx.textAlign = 'center';

        const selectedFunc = functions[functionSelect.value];        ctx.fillText(`a = ${center.toFixed(1)}`, screenX, screenY - 20);

        const y = selectedFunc.func(center);    }

        

        if (!isFinite(y)) return;    // Draw legend

            function drawLegend() {

        const screenX = toScreenX(center, xMin, xMax);        const x = canvas.width - PADDING - 180;

        const screenY = toScreenY(y, yMin, yMax);        const y = PADDING + 20;

                

        // Animated glow rings        ctx.font = '13px -apple-system, sans-serif';

        const time = Date.now() / 1000;        ctx.textAlign = 'left';

        for (let i = 0; i < 3; i++) {        

            const phase = (time + i * 0.3) % 1;        // Original function

            const radius = 10 + phase * 20;        ctx.strokeStyle = ORIGINAL_COLOR;

            const alpha = (1 - phase) * 0.3;        ctx.lineWidth = 2.5;

                    ctx.beginPath();

            const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, radius);        ctx.moveTo(x, y);

            gradient.addColorStop(0, `rgba(255, 107, 157, ${alpha})`);        ctx.lineTo(x + 35, y);

            gradient.addColorStop(1, `rgba(255, 107, 157, 0)`);        ctx.stroke();

                    ctx.fillStyle = '#e0e0e0';

            ctx.fillStyle = gradient;        const funcName = functionSelect.value === 'custom' ? customFunctionStr || 'f(x)' : functions[functionSelect.value].name;

            ctx.beginPath();        ctx.fillText(funcName, x + 45, y + 4);

            ctx.arc(screenX, screenY, radius, 0, 2 * Math.PI);        

            ctx.fill();        // Taylor approximation

        }        ctx.strokeStyle = TAYLOR_COLOR;

                ctx.lineWidth = 2.5;

        // Main point        ctx.setLineDash([4, 4]);

        ctx.fillStyle = POINT_COLOR;        ctx.beginPath();

        ctx.shadowBlur = 20;        ctx.moveTo(x, y + 25);

        ctx.shadowColor = POINT_COLOR;        ctx.lineTo(x + 35, y + 25);

        ctx.beginPath();        ctx.stroke();

        ctx.arc(screenX, screenY, 6, 0, 2 * Math.PI);        ctx.setLineDash([]);

        ctx.fill();        ctx.fillStyle = '#a0a0a0';

                ctx.fillText(`Taylor (n=${Math.round(currentTerms)})`, x + 45, y + 29);

        ctx.strokeStyle = '#1a1a2e';    }

        ctx.lineWidth = 2;

        ctx.shadowBlur = 0;    // Main draw function

        ctx.stroke();    function draw(animProgress = 1) {

                const center = parseFloat(centerSlider.value);

        // Label with glow        const terms = Math.round(currentTerms);

        ctx.fillStyle = POINT_COLOR;        const selectedFunc = functions[functionSelect.value];

        ctx.font = 'bold 13px -apple-system, sans-serif';        

        ctx.textAlign = 'center';        // Clear canvas

        ctx.shadowBlur = 10;        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.shadowColor = POINT_COLOR;        

        ctx.fillText(`a = ${center.toFixed(1)}`, screenX, screenY - 25);        // Define view bounds

        ctx.shadowBlur = 0;        const xMin = -2 * Math.PI;

    }        const xMax = 2 * Math.PI;

        let yMin = -3;

    // Draw legend        let yMax = 3;

    function drawLegend() {        

        const x = canvas.width - PADDING - 200;        if (functionSelect.value === 'exp') {

        const y = PADDING + 25;            yMin = -2;

                    yMax = 10;

        ctx.font = '14px -apple-system, sans-serif';        }

        ctx.textAlign = 'left';        

                // Draw grid

        // Original function        drawGrid(xMin, xMax, yMin, yMax);

        ctx.strokeStyle = ORIGINAL_COLOR;        

        ctx.lineWidth = 3;        // Draw original function

        ctx.shadowBlur = 10;        drawFunction(selectedFunc.func, xMin, xMax, yMin, yMax, ORIGINAL_COLOR, 2.5, false, 1);

        ctx.shadowColor = ORIGINAL_COLOR;        

        ctx.beginPath();        // Draw Taylor approximation

        ctx.moveTo(x, y);        const taylorFunc = x => taylorSeries(x, center, terms);

        ctx.lineTo(x + 40, y);        drawFunction(taylorFunc, xMin, xMax, yMin, yMax, TAYLOR_COLOR, 2.5, true, animProgress);

        ctx.stroke();        

        ctx.shadowBlur = 0;        // Draw expansion point with pulse

                const pulse = 1 + Math.sin(Date.now() / 500) * 0.1;

        ctx.fillStyle = '#e0e0e0';        drawExpansionPoint(center, xMin, xMax, yMin, yMax, pulse);

        const funcName = functionSelect.value === 'custom' ? customFunctionStr || 'f(x)' : functions[functionSelect.value].name;        

        ctx.fillText(funcName, x + 50, y + 5);        // Draw legend

                drawLegend();

        // Taylor approximation    }

        ctx.strokeStyle = TAYLOR_COLOR;

        ctx.lineWidth = 3;    // Update formula display

        ctx.setLineDash([8, 4]);    function updateFormula() {

        ctx.shadowBlur = 10;        const center = parseFloat(centerSlider.value);

        ctx.shadowColor = TAYLOR_COLOR;        const terms = parseInt(termsSlider.value);

        ctx.beginPath();        const selectedFunc = functions[functionSelect.value];

        ctx.moveTo(x, y + 30);        

        ctx.lineTo(x + 40, y + 30);        let formula = '';

        ctx.stroke();        if (functionSelect.value === 'custom') {

        ctx.setLineDash([]);            formula = `${customFunctionStr || 'f(x)'} ≈ `;

        ctx.shadowBlur = 0;        } else {

                    formula = `${selectedFunc.name} ≈ `;

        ctx.fillStyle = '#b8b8d1';        }

        ctx.fillText(`Taylor (n=${Math.round(currentTerms)})`, x + 50, y + 35);        

    }        const maxDisplay = Math.min(terms, 5);

        

    // Main draw function        for (let i = 0; i < maxDisplay; i++) {

    function draw() {            const derivative = selectedFunc.derivative(center, i);

        const center = parseFloat(centerSlider.value);            const coeff = derivative / factorial(i);

        const terms = Math.round(currentTerms);            

        const selectedFunc = functions[functionSelect.value];            if (i > 0 && coeff >= 0) formula += ' + ';

                    else if (i > 0 && coeff < 0) formula += ' - ';

        // Clear canvas            

        ctx.clearRect(0, 0, canvas.width, canvas.height);            const absCoeff = Math.abs(coeff);

                    

        // Define view bounds            if (i === 0) {

        const xMin = -2 * Math.PI;                formula += absCoeff.toFixed(3);

        const xMax = 2 * Math.PI;            } else if (i === 1) {

        let yMin = -3;                if (Math.abs(absCoeff - 1) < 0.001) {

        let yMax = 3;                    formula += `(x - ${center})`;

                        } else {

        if (functionSelect.value === 'exp') {                    formula += `${absCoeff.toFixed(3)}(x - ${center})`;

            yMin = -2;                }

            yMax = 10;            } else {

        }                if (Math.abs(absCoeff - 1) < 0.001) {

                            formula += `(x - ${center})^${i}`;

        // Draw grid                } else {

        drawGrid(xMin, xMax, yMin, yMax);                    formula += `${absCoeff.toFixed(3)}(x - ${center})^${i}`;

                        }

        // Draw original function            }

        drawFunction(selectedFunc.func, xMin, xMax, yMin, yMax, ORIGINAL_COLOR, 3, false, 1);        }

                

        // Draw Taylor approximation with animation        if (terms > 5) {

        const taylorFunc = x => taylorSeries(x, center, terms);            formula += ' + ...';

        drawFunction(taylorFunc, xMin, xMax, yMin, yMax, TAYLOR_COLOR, 3, true, drawProgress);        }

                

        // Draw expansion point        formulaDisplay.textContent = formula;

        drawExpansionPoint(center, xMin, xMax, yMin, yMax);    }

        

        // Draw legend    // Animation loop

        drawLegend();    function animate() {

    }        if (!isPlaying) return;

        

    // Update formula display        if (currentTerms < targetTerms) {

    function updateFormula() {            currentTerms += 0.3;

        const center = parseFloat(centerSlider.value);            if (currentTerms > targetTerms) currentTerms = targetTerms;

        const terms = parseInt(termsSlider.value);            

        const selectedFunc = functions[functionSelect.value];            animationProgress += 0.05;

                    if (animationProgress > 1) animationProgress = 1;

        let formula = '';            

        if (functionSelect.value === 'custom') {            termsSlider.value = Math.round(currentTerms);

            formula = `${customFunctionStr || 'f(x)'} ≈ `;            termsValue.textContent = Math.round(currentTerms);

        } else {            updateFormula();

            formula = `${selectedFunc.name} ≈ `;            draw(animationProgress);

        }            

                    animationFrame = requestAnimationFrame(animate);

        const maxDisplay = Math.min(terms, 5);        } else {

                    isPlaying = false;

        for (let i = 0; i < maxDisplay; i++) {            playButton.textContent = '▶ Abspielen';

            const derivative = selectedFunc.derivative(center, i);            animationProgress = 1;

            const coeff = derivative / factorial(i);            draw(1);

                    }

            if (i > 0 && coeff >= 0) formula += ' + ';    }

            else if (i > 0 && coeff < 0) formula += ' - ';

                // Continuous animation for pulse effect

            const absCoeff = Math.abs(coeff);    function continuousAnimate() {

                    if (!isPlaying) {

            if (i === 0) {            draw();

                formula += absCoeff.toFixed(3);        }

            } else if (i === 1) {        requestAnimationFrame(continuousAnimate);

                if (Math.abs(absCoeff - 1) < 0.001) {    }

                    formula += `(x - ${center})`;    continuousAnimate();

                } else {

                    formula += `${absCoeff.toFixed(3)}(x - ${center})`;    // Set canvas size

                }    function resizeCanvas() {

            } else {        const rect = canvas.getBoundingClientRect();

                if (Math.abs(absCoeff - 1) < 0.001) {        canvas.width = rect.width;

                    formula += `(x - ${center})^${i}`;        canvas.height = rect.height;

                } else {        console.log('Canvas resized to:', canvas.width, 'x', canvas.height);

                    formula += `${absCoeff.toFixed(3)}(x - ${center})^${i}`;        draw();

                }    }

            }

        }    // Event listeners

            functionSelect.addEventListener('change', () => {

        if (terms > 5) {        if (functionSelect.value === 'custom') {

            formula += ' + ...';            customFunctionGroup.style.display = 'flex';

        }        } else {

                    customFunctionGroup.style.display = 'none';

        formulaDisplay.textContent = formula;        }

    }        updateFormula();

        draw();

    // Animation loop    });

    function animate() {

        if (!isPlaying) return;    customFunctionInput.addEventListener('input', (e) => {

                const expr = e.target.value.trim();

        const now = Date.now();        customFunctionStr = expr;

        const deltaTime = (now - lastTime) / 1000;        

        lastTime = now;        if (expr === '') {

                    customError.classList.remove('show');

        // Animate terms            return;

        if (currentTerms < targetTerms) {        }

            currentTerms += deltaTime * 8; // Speed of term increase        

            if (currentTerms > targetTerms) currentTerms = targetTerms;        const func = parseCustomFunction(expr);

                    if (func) {

            termsSlider.value = Math.round(currentTerms);            customFunction = func;

            termsValue.textContent = Math.round(currentTerms);            customError.classList.remove('show');

                        functions.custom.name = expr;

            // Reset draw progress when terms change            updateFormula();

            drawProgress = 0;            draw();

            targetDrawProgress = 1;        } else {

        }            customError.classList.add('show');

                }

        // Animate drawing    });

        if (drawProgress < targetDrawProgress) {

            drawProgress += deltaTime * 2; // Speed of drawing    termsSlider.addEventListener('input', (e) => {

            if (drawProgress > targetDrawProgress) drawProgress = targetDrawProgress;        currentTerms = parseInt(e.target.value);

        }        targetTerms = currentTerms;

                termsValue.textContent = currentTerms;

        updateFormula();        updateFormula();

        draw();        draw();

            });

        if (currentTerms >= targetTerms && drawProgress >= targetDrawProgress) {

            isPlaying = false;    centerSlider.addEventListener('input', (e) => {

            playButton.textContent = '▶ Abspielen';        centerValue.textContent = parseFloat(e.target.value).toFixed(1);

        } else {        updateFormula();

            animationFrame = requestAnimationFrame(animate);        draw();

        }    });

    }

    playButton.addEventListener('click', () => {

    // Continuous animation for glow effects        if (isPlaying) {

    function continuousAnimate() {            isPlaying = false;

        draw();            playButton.textContent = '▶ Abspielen';

        requestAnimationFrame(continuousAnimate);            if (animationFrame) {

    }                cancelAnimationFrame(animationFrame);

                }

    // Set canvas size        } else {

    function resizeCanvas() {            currentTerms = 1;

        const rect = canvas.getBoundingClientRect();            targetTerms = parseInt(termsSlider.value);

        canvas.width = rect.width;            animationProgress = 0;

        canvas.height = rect.height;            isPlaying = true;

        console.log('Canvas resized to:', canvas.width, 'x', canvas.height);            playButton.textContent = '⏸ Pause';

        draw();            animate();

    }        }

    });

    // Event listeners

    functionSelect.addEventListener('change', () => {    resetButton.addEventListener('click', () => {

        if (functionSelect.value === 'custom') {        isPlaying = false;

            customFunctionGroup.style.display = 'flex';        if (animationFrame) {

        } else {            cancelAnimationFrame(animationFrame);

            customFunctionGroup.style.display = 'none';        }

        }        playButton.textContent = '▶ Abspielen';

        drawProgress = 0;        

        targetDrawProgress = 1;        termsSlider.value = 1;

        updateFormula();        currentTerms = 1;

        continuousAnimate();        targetTerms = 1;

    });        termsValue.textContent = 1;

        

    customFunctionInput.addEventListener('input', (e) => {        centerSlider.value = 0;

        const expr = e.target.value.trim();        centerValue.textContent = '0.0';

        customFunctionStr = expr;        

                functionSelect.value = 'sin';

        if (expr === '') {        customFunctionGroup.style.display = 'none';

            customError.classList.remove('show');        

            return;        animationProgress = 1;

        }        updateFormula();

                draw();

        const func = parseCustomFunction(expr);    });

        if (func) {

            customFunction = func;    window.addEventListener('resize', resizeCanvas);

            customError.classList.remove('show');    

            functions.custom.name = expr;    // Initial setup

            drawProgress = 0;    console.log('Initial draw...');

            targetDrawProgress = 1;    resizeCanvas();

            updateFormula();    updateFormula();

            continuousAnimate();

        } else {}); // End of DOMContentLoaded

            customError.classList.add('show');
        }
    });

    termsSlider.addEventListener('input', (e) => {
        currentTerms = parseInt(e.target.value);
        targetTerms = currentTerms;
        termsValue.textContent = currentTerms;
        drawProgress = 0;
        targetDrawProgress = 1;
        updateFormula();
        continuousAnimate();
    });

    centerSlider.addEventListener('input', (e) => {
        centerValue.textContent = parseFloat(e.target.value).toFixed(1);
        drawProgress = 0;
        targetDrawProgress = 1;
        updateFormula();
        continuousAnimate();
    });

    playButton.addEventListener('click', () => {
        if (isPlaying) {
            isPlaying = false;
            playButton.textContent = '▶ Abspielen';
            if (animationFrame) {
                cancelAnimationFrame(animationFrame);
            }
        } else {
            currentTerms = 1;
            targetTerms = parseInt(termsSlider.value);
            drawProgress = 0;
            targetDrawProgress = 1;
            isPlaying = true;
            playButton.textContent = '⏸ Pause';
            lastTime = Date.now();
            animate();
        }
    });

    resetButton.addEventListener('click', () => {
        isPlaying = false;
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
        }
        playButton.textContent = '▶ Abspielen';
        
        termsSlider.value = 1;
        currentTerms = 1;
        targetTerms = 1;
        termsValue.textContent = 1;
        
        centerSlider.value = 0;
        centerValue.textContent = '0.0';
        
        functionSelect.value = 'sin';
        customFunctionGroup.style.display = 'none';
        
        drawProgress = 1;
        targetDrawProgress = 1;
        updateFormula();
        draw();
    });

    window.addEventListener('resize', resizeCanvas);
    
    // Initial setup
    console.log('Initial draw...');
    resizeCanvas();
    updateFormula();
    continuousAnimate();

}); // End of DOMContentLoaded
