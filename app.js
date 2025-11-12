// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing...');
    
    // Canvas Setup
    const canvas = document.getElementById('graph-canvas');
    const ctx = canvas.getContext('2d');

    // Controls
    const termsSlider = document.getElementById('terms-slider');
    const termsValue = document.getElementById('terms-value');
    const centerSlider = document.getElementById('center-slider');
    const centerValue = document.getElementById('center-value');
    const functionSelect = document.getElementById('function-select');
    const playButton = document.getElementById('play-button');
    const resetButton = document.getElementById('reset-button');
    const formulaDisplay = document.getElementById('formula-display');

    // Animation state
    let isPlaying = false;
    let animationFrame = null;
    let currentTerms = 1;
    let targetTerms = 1;

    // Graph settings
    const PADDING = 60;
    const GRID_COLOR = '#e0e0e0';
    const AXIS_COLOR = '#333';
    const ORIGINAL_COLOR = '#667eea';
    const TAYLOR_COLOR = '#f5576c';
    const POINT_COLOR = '#764ba2';

    // Math functions and their derivatives
    const functions = {
        sin: {
            name: 'sin(x)',
            func: Math.sin,
            derivative: (x, n) => {
                const mod = n % 4;
                if (mod === 0) return Math.sin(x);
                if (mod === 1) return Math.cos(x);
                if (mod === 2) return -Math.sin(x);
                return -Math.cos(x);
            }
        },
        cos: {
            name: 'cos(x)',
            func: Math.cos,
            derivative: (x, n) => {
                const mod = n % 4;
                if (mod === 0) return Math.cos(x);
                if (mod === 1) return -Math.sin(x);
                if (mod === 2) return -Math.cos(x);
                return Math.sin(x);
            }
        },
        exp: {
            name: 'e^x',
            func: Math.exp,
            derivative: (x, n) => Math.exp(x)
        },
        ln: {
            name: 'ln(1+x)',
            func: x => Math.log(1 + x),
            derivative: (x, n) => {
                if (n === 0) return Math.log(1 + x);
                return Math.pow(-1, n - 1) * factorial(n - 1) / Math.pow(1 + x, n);
            }
        }
    };

    // Factorial helper
    function factorial(n) {
        if (n <= 1) return 1;
        let result = 1;
        for (let i = 2; i <= n; i++) {
            result *= i;
        }
        return result;
    }

    // Taylor series calculation
    function taylorSeries(x, center, n) {
        const selectedFunc = functions[functionSelect.value];
        let sum = 0;
        
        for (let i = 0; i < n; i++) {
            const derivative = selectedFunc.derivative(center, i);
            const term = (derivative / factorial(i)) * Math.pow(x - center, i);
            sum += term;
        }
        
        return sum;
    }

    // Coordinate transformation
    function toScreenX(x, xMin, xMax) {
        return PADDING + ((x - xMin) / (xMax - xMin)) * (canvas.width - 2 * PADDING);
    }

    function toScreenY(y, yMin, yMax) {
        return canvas.height - PADDING - ((y - yMin) / (yMax - yMin)) * (canvas.height - 2 * PADDING);
    }

    // Draw grid and axes
    function drawGrid(xMin, xMax, yMin, yMax) {
        ctx.strokeStyle = GRID_COLOR;
        ctx.lineWidth = 1;
        
        // Vertical grid lines
        for (let x = Math.ceil(xMin); x <= Math.floor(xMax); x++) {
            const screenX = toScreenX(x, xMin, xMax);
            ctx.beginPath();
            ctx.moveTo(screenX, PADDING);
            ctx.lineTo(screenX, canvas.height - PADDING);
            ctx.stroke();
        }
        
        // Horizontal grid lines
        for (let y = Math.ceil(yMin); y <= Math.floor(yMax); y++) {
            const screenY = toScreenY(y, yMin, yMax);
            ctx.beginPath();
            ctx.moveTo(PADDING, screenY);
            ctx.lineTo(canvas.width - PADDING, screenY);
            ctx.stroke();
        }
        
        // Axes
        ctx.strokeStyle = AXIS_COLOR;
        ctx.lineWidth = 2;
        
        // X-axis
        if (yMin <= 0 && yMax >= 0) {
            const y0 = toScreenY(0, yMin, yMax);
            ctx.beginPath();
            ctx.moveTo(PADDING, y0);
            ctx.lineTo(canvas.width - PADDING, y0);
            ctx.stroke();
        }
        
        // Y-axis
        if (xMin <= 0 && xMax >= 0) {
            const x0 = toScreenX(0, xMin, xMax);
            ctx.beginPath();
            ctx.moveTo(x0, PADDING);
            ctx.lineTo(x0, canvas.height - PADDING);
            ctx.stroke();
        }
        
        // Labels
        ctx.fillStyle = AXIS_COLOR;
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        
        // X-axis labels
        for (let x = Math.ceil(xMin); x <= Math.floor(xMax); x++) {
            if (x === 0) continue;
            const screenX = toScreenX(x, xMin, xMax);
            const screenY = toScreenY(0, yMin, yMax);
            const labelY = Math.min(Math.max(screenY + 20, PADDING + 20), canvas.height - PADDING + 20);
            ctx.fillText(x.toString(), screenX, labelY);
        }
        
        // Y-axis labels
        ctx.textAlign = 'right';
        for (let y = Math.ceil(yMin); y <= Math.floor(yMax); y++) {
            if (y === 0) continue;
            const screenX = toScreenX(0, xMin, xMax);
            const screenY = toScreenY(y, yMin, yMax);
            const labelX = Math.min(Math.max(screenX - 10, PADDING + 30), canvas.width - PADDING - 10);
            ctx.fillText(y.toString(), labelX, screenY + 5);
        }
    }

    // Draw function curve
    function drawFunction(func, xMin, xMax, yMin, yMax, color, lineWidth = 2, dashed = false) {
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        
        let started = false;
        const steps = 500;
        const dx = (xMax - xMin) / steps;
        
        for (let i = 0; i <= steps; i++) {
            const x = xMin + i * dx;
            let y;
            
            try {
                y = func(x);
                
                // Skip if y is not finite
                if (!isFinite(y)) continue;
                
                // Clamp y to visible range with some margin
                const margin = (yMax - yMin) * 0.1;
                if (y < yMin - margin || y > yMax + margin) continue;
                
                const screenX = toScreenX(x, xMin, xMax);
                const screenY = toScreenY(y, yMin, yMax);
                
                if (!started) {
                    ctx.moveTo(screenX, screenY);
                    started = true;
                } else {
                    ctx.lineTo(screenX, screenY);
                }
            } catch (e) {
                // Skip invalid points
                continue;
            }
        }
        
        if (dashed) {
            ctx.setLineDash([5, 5]);
        } else {
            ctx.setLineDash([]);
        }
        
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // Draw expansion point
    function drawExpansionPoint(center, xMin, xMax, yMin, yMax) {
        const selectedFunc = functions[functionSelect.value];
        const y = selectedFunc.func(center);
        
        if (!isFinite(y)) return;
        
        const screenX = toScreenX(center, xMin, xMax);
        const screenY = toScreenY(y, yMin, yMax);
        
        ctx.fillStyle = POINT_COLOR;
        ctx.beginPath();
        ctx.arc(screenX, screenY, 6, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.strokeStyle = POINT_COLOR;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Label
        ctx.fillStyle = POINT_COLOR;
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`a = ${center.toFixed(1)}`, screenX, screenY - 15);
    }

    // Draw legend
    function drawLegend() {
        const x = canvas.width - PADDING - 150;
        const y = PADDING + 20;
        
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'left';
        
        // Original function
        ctx.strokeStyle = ORIGINAL_COLOR;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 30, y);
        ctx.stroke();
        ctx.fillStyle = AXIS_COLOR;
        ctx.fillText(functions[functionSelect.value].name, x + 40, y + 5);
        
        // Taylor approximation
        ctx.strokeStyle = TAYLOR_COLOR;
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(x, y + 25);
        ctx.lineTo(x + 30, y + 25);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillText(`Taylor (n=${Math.round(currentTerms)})`, x + 40, y + 30);
    }

    // Main draw function
    function draw() {
        const center = parseFloat(centerSlider.value);
        const terms = Math.round(currentTerms);
        const selectedFunc = functions[functionSelect.value];
        
        console.log('Drawing with terms:', terms, 'center:', center, 'function:', functionSelect.value);
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Define view bounds
        const xMin = -2 * Math.PI;
        const xMax = 2 * Math.PI;
        let yMin = -3;
        let yMax = 3;
        
        // Adjust bounds for exponential
        if (functionSelect.value === 'exp') {
            yMin = -2;
            yMax = 10;
        }
        
        // Draw grid
        drawGrid(xMin, xMax, yMin, yMax);
        
        // Draw original function
        drawFunction(selectedFunc.func, xMin, xMax, yMin, yMax, ORIGINAL_COLOR, 3, false);
        
        // Draw Taylor approximation
        const taylorFunc = x => taylorSeries(x, center, terms);
        drawFunction(taylorFunc, xMin, xMax, yMin, yMax, TAYLOR_COLOR, 3, true);
        
        // Draw expansion point
        drawExpansionPoint(center, xMin, xMax, yMin, yMax);
        
        // Draw legend
        drawLegend();
    }

    // Update formula display
    function updateFormula() {
        const center = parseFloat(centerSlider.value);
        const terms = parseInt(termsSlider.value);
        const selectedFunc = functions[functionSelect.value];
        
        let formula = `${selectedFunc.name} ≈ `;
        const maxDisplay = Math.min(terms, 5);
        
        for (let i = 0; i < maxDisplay; i++) {
            const derivative = selectedFunc.derivative(center, i);
            const coeff = derivative / factorial(i);
            
            if (i > 0 && coeff >= 0) formula += ' + ';
            else if (i > 0 && coeff < 0) formula += ' - ';
            
            const absCoeff = Math.abs(coeff);
            
            if (i === 0) {
                formula += absCoeff.toFixed(3);
            } else if (i === 1) {
                if (Math.abs(absCoeff - 1) < 0.001) {
                    formula += `(x - ${center})`;
                } else {
                    formula += `${absCoeff.toFixed(3)}(x - ${center})`;
                }
            } else {
                if (Math.abs(absCoeff - 1) < 0.001) {
                    formula += `(x - ${center})^${i}`;
                } else {
                    formula += `${absCoeff.toFixed(3)}(x - ${center})^${i}`;
                }
            }
        }
        
        if (terms > 5) {
            formula += ' + ...';
        }
        
        formulaDisplay.textContent = formula;
    }

    // Animation loop
    function animate() {
        if (!isPlaying) return;
        
        if (currentTerms < targetTerms) {
            currentTerms += 0.5;
            if (currentTerms > targetTerms) currentTerms = targetTerms;
            
            termsSlider.value = Math.round(currentTerms);
            termsValue.textContent = Math.round(currentTerms);
            updateFormula();
            draw();
            
            animationFrame = requestAnimationFrame(animate);
        } else {
            isPlaying = false;
            playButton.textContent = '▶ Abspielen';
        }
    }

    // Set canvas size
    function resizeCanvas() {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        console.log('Canvas resized to:', canvas.width, 'x', canvas.height);
        draw();
    }

    // Event listeners
    termsSlider.addEventListener('input', (e) => {
        currentTerms = parseInt(e.target.value);
        targetTerms = currentTerms;
        termsValue.textContent = currentTerms;
        console.log('Terms changed to:', currentTerms);
        updateFormula();
        draw();
    });

    centerSlider.addEventListener('input', (e) => {
        centerValue.textContent = parseFloat(e.target.value).toFixed(1);
        console.log('Center changed to:', e.target.value);
        updateFormula();
        draw();
    });

    functionSelect.addEventListener('change', () => {
        console.log('Function changed to:', functionSelect.value);
        updateFormula();
        draw();
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
            isPlaying = true;
            playButton.textContent = '⏸ Pause';
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
        
        updateFormula();
        draw();
    });

    window.addEventListener('resize', resizeCanvas);
    
    // Initial setup
    console.log('Initial draw...');
    resizeCanvas();
    updateFormula();

}); // End of DOMContentLoaded
