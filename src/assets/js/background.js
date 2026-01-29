/**
 * Interactive Escher-style Background
 * Impossible shapes with sketch aesthetic
 */
(function() {
    const canvas = document.createElement('canvas');
    canvas.id = 'bg-canvas';
    canvas.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: -1;
        pointer-events: none;
        opacity: 0.08;
    `;
    document.body.insertBefore(canvas, document.body.firstChild);

    const ctx = canvas.getContext('2d');
    let width, height;
    let mouseX = 0, mouseY = 0;
    let targetMouseX = 0, targetMouseY = 0;
    let shapes = [];
    let time = 0;

    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
        initShapes();
    }

    // Sketch-style wobbly line
    function sketchLine(x1, y1, x2, y2, wobble = 2) {
        const dist = Math.sqrt((x2-x1)**2 + (y2-y1)**2);
        const steps = Math.max(dist / 8, 4);
        
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const x = x1 + (x2 - x1) * t + (Math.random() - 0.5) * wobble;
            const y = y1 + (y2 - y1) * t + (Math.random() - 0.5) * wobble;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    // Penrose Triangle (impossible triangle)
    function drawPenroseTriangle(cx, cy, size, rotation, phase) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rotation + Math.sin(phase) * 0.05);
        
        const s = size;
        const thickness = s * 0.18;
        
        // Three interlocking bars creating impossible geometry
        const angles = [0, Math.PI * 2/3, Math.PI * 4/3];
        
        angles.forEach((angle, i) => {
            ctx.save();
            ctx.rotate(angle);
            
            // Outer edge
            sketchLine(-s * 0.5, s * 0.29, s * 0.5, s * 0.29);
            sketchLine(-s * 0.5, s * 0.29, -s * 0.35, s * 0.29 - thickness);
            sketchLine(s * 0.5, s * 0.29, s * 0.35, s * 0.29 - thickness);
            
            // Inner connector (creates impossible effect)
            if (i === 0) {
                sketchLine(-s * 0.35, s * 0.29 - thickness, s * 0.1, s * 0.29 - thickness);
            }
            
            ctx.restore();
        });
        
        ctx.restore();
    }

    // Impossible cube (Necker cube variant)
    function drawImpossibleCube(cx, cy, size, rotation, phase) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rotation);
        
        const s = size * 0.5;
        const offset = s * 0.4;
        const wobblePhase = Math.sin(phase) * 2;
        
        // Front face
        sketchLine(-s, -s, s, -s, 1 + wobblePhase * 0.1);
        sketchLine(s, -s, s, s, 1 + wobblePhase * 0.1);
        sketchLine(s, s, -s, s, 1 + wobblePhase * 0.1);
        sketchLine(-s, s, -s, -s, 1 + wobblePhase * 0.1);
        
        // Back face (offset)
        sketchLine(-s + offset, -s - offset, s + offset, -s - offset, 1);
        sketchLine(s + offset, -s - offset, s + offset, s - offset, 1);
        sketchLine(s + offset, s - offset, -s + offset, s - offset, 1);
        sketchLine(-s + offset, s - offset, -s + offset, -s - offset, 1);
        
        // Connecting edges (some intentionally "wrong" for impossible effect)
        sketchLine(-s, -s, -s + offset, -s - offset, 1);
        sketchLine(s, -s, s + offset, -s - offset, 1);
        sketchLine(s, s, s + offset, s - offset, 1);
        // This edge creates the impossible connection
        sketchLine(-s, s, -s + offset, -s - offset, 1);
        
        ctx.restore();
    }

    // Penrose stairs segment
    function drawEscherStairs(cx, cy, size, rotation, phase) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rotation + phase * 0.02);
        
        const steps = 5;
        const stepW = size / steps;
        const stepH = size * 0.15;
        
        for (let i = 0; i < steps; i++) {
            const x = -size/2 + i * stepW;
            const yOffset = Math.sin(phase + i * 0.5) * 2;
            
            // Step top
            sketchLine(x, -i * stepH + yOffset, x + stepW, -i * stepH + yOffset);
            // Step riser
            sketchLine(x + stepW, -i * stepH + yOffset, x + stepW, -(i+1) * stepH + yOffset);
        }
        
        // Impossible return (stairs that go up but end at same level)
        sketchLine(-size/2, 0, -size/2, -steps * stepH);
        sketchLine(-size/2, -steps * stepH, size/2 - stepW, -steps * stepH);
        
        ctx.restore();
    }

    // Hexagonal tessellation
    function drawHexPattern(cx, cy, size, rotation, phase) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rotation + Math.sin(phase * 0.5) * 0.1);
        
        const hexRadius = size * 0.3;
        
        for (let ring = 0; ring < 2; ring++) {
            const count = ring === 0 ? 1 : 6;
            const ringRadius = ring * hexRadius * 1.8;
            
            for (let i = 0; i < count; i++) {
                const angle = (i / count) * Math.PI * 2 + phase * 0.1;
                const hx = Math.cos(angle) * ringRadius;
                const hy = Math.sin(angle) * ringRadius;
                
                // Draw hexagon
                for (let j = 0; j < 6; j++) {
                    const a1 = (j / 6) * Math.PI * 2;
                    const a2 = ((j + 1) / 6) * Math.PI * 2;
                    sketchLine(
                        hx + Math.cos(a1) * hexRadius,
                        hy + Math.sin(a1) * hexRadius,
                        hx + Math.cos(a2) * hexRadius,
                        hy + Math.sin(a2) * hexRadius,
                        1
                    );
                }
            }
        }
        
        ctx.restore();
    }

    function initShapes() {
        shapes = [];
        const shapeTypes = [drawPenroseTriangle, drawImpossibleCube, drawEscherStairs, drawHexPattern];
        const count = Math.floor((width * height) / 120000) + 5;
        
        for (let i = 0; i < count; i++) {
            shapes.push({
                x: Math.random() * width,
                y: Math.random() * height,
                size: 40 + Math.random() * 60,
                rotation: Math.random() * Math.PI * 2,
                speed: 0.2 + Math.random() * 0.5,
                parallax: 0.02 + Math.random() * 0.04,
                draw: shapeTypes[Math.floor(Math.random() * shapeTypes.length)],
                phase: Math.random() * Math.PI * 2
            });
        }
    }

    function animate() {
        ctx.clearRect(0, 0, width, height);
        
        // Smooth mouse following
        mouseX += (targetMouseX - mouseX) * 0.05;
        mouseY += (targetMouseY - mouseY) * 0.05;
        
        time += 0.01;
        
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        shapes.forEach(shape => {
            const offsetX = (mouseX - width/2) * shape.parallax;
            const offsetY = (mouseY - height/2) * shape.parallax;
            
            shape.draw(
                shape.x + offsetX,
                shape.y + offsetY,
                shape.size,
                shape.rotation + time * shape.speed * 0.1,
                time * shape.speed + shape.phase
            );
        });
        
        requestAnimationFrame(animate);
    }

    // Event listeners
    window.addEventListener('resize', resize);
    document.addEventListener('mousemove', (e) => {
        targetMouseX = e.clientX;
        targetMouseY = e.clientY;
    });

    // Initialize
    resize();
    animate();
})();
