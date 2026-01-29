/**
 * Eye Floater Physics Background
 * Primitive shapes with physics, edge bouncing, and mouse repulsion
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
    `;
    document.body.insertBefore(canvas, document.body.firstChild);

    const ctx = canvas.getContext('2d');
    let width, height;
    let mouse = { x: -1000, y: -1000 };
    let shapes = [];

    // Physics constants
    const FRICTION = 0.98;
    const MOUSE_REPEL_RADIUS = 150;
    const MOUSE_REPEL_FORCE = 0.8;
    const DRIFT_FORCE = 0.02;
    const MAX_SPEED = 3;
    const BOUNCE_DAMPING = 0.7;

    // Shape types
    const SHAPE_TYPES = ['circle', 'triangle', 'square', 'hexagon', 'diamond'];

    class Shape {
        constructor() {
            this.reset();
        }

        reset() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.vx = (Math.random() - 0.5) * 2;
            this.vy = (Math.random() - 0.5) * 2;
            this.size = 15 + Math.random() * 35;
            this.rotation = Math.random() * Math.PI * 2;
            this.rotationSpeed = (Math.random() - 0.5) * 0.02;
            this.type = SHAPE_TYPES[Math.floor(Math.random() * SHAPE_TYPES.length)];
            this.opacity = 0.04 + Math.random() * 0.06;
            this.strokeWidth = 1 + Math.random() * 1.5;
            
            // Eye floater drift - each shape has its own drift direction
            this.driftAngle = Math.random() * Math.PI * 2;
            this.driftSpeed = Math.random() * DRIFT_FORCE;
            this.driftPhase = Math.random() * Math.PI * 2;
        }

        update() {
            // Eye floater drift (slow organic movement)
            this.driftPhase += 0.005;
            const driftX = Math.cos(this.driftAngle + Math.sin(this.driftPhase) * 0.5) * this.driftSpeed;
            const driftY = Math.sin(this.driftAngle + Math.cos(this.driftPhase * 0.7) * 0.5) * this.driftSpeed;
            this.vx += driftX;
            this.vy += driftY;

            // Mouse repulsion
            const dx = this.x - mouse.x;
            const dy = this.y - mouse.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < MOUSE_REPEL_RADIUS && dist > 0) {
                const force = (MOUSE_REPEL_RADIUS - dist) / MOUSE_REPEL_RADIUS * MOUSE_REPEL_FORCE;
                const angle = Math.atan2(dy, dx);
                this.vx += Math.cos(angle) * force;
                this.vy += Math.sin(angle) * force;
            }

            // Apply friction
            this.vx *= FRICTION;
            this.vy *= FRICTION;

            // Clamp speed
            const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            if (speed > MAX_SPEED) {
                this.vx = (this.vx / speed) * MAX_SPEED;
                this.vy = (this.vy / speed) * MAX_SPEED;
            }

            // Update position
            this.x += this.vx;
            this.y += this.vy;

            // Rotate
            this.rotation += this.rotationSpeed;

            // Bounce off edges
            const padding = this.size;
            
            if (this.x < padding) {
                this.x = padding;
                this.vx = Math.abs(this.vx) * BOUNCE_DAMPING;
            } else if (this.x > width - padding) {
                this.x = width - padding;
                this.vx = -Math.abs(this.vx) * BOUNCE_DAMPING;
            }
            
            if (this.y < padding) {
                this.y = padding;
                this.vy = Math.abs(this.vy) * BOUNCE_DAMPING;
            } else if (this.y > height - padding) {
                this.y = height - padding;
                this.vy = -Math.abs(this.vy) * BOUNCE_DAMPING;
            }
        }

        draw() {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.rotation);
            ctx.strokeStyle = `rgba(0, 0, 0, ${this.opacity})`;
            ctx.lineWidth = this.strokeWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            const s = this.size;

            switch(this.type) {
                case 'circle':
                    ctx.beginPath();
                    ctx.arc(0, 0, s, 0, Math.PI * 2);
                    ctx.stroke();
                    // Inner circle for depth
                    ctx.beginPath();
                    ctx.arc(0, 0, s * 0.5, 0, Math.PI * 2);
                    ctx.stroke();
                    break;

                case 'triangle':
                    ctx.beginPath();
                    for (let i = 0; i < 3; i++) {
                        const angle = (i / 3) * Math.PI * 2 - Math.PI / 2;
                        const x = Math.cos(angle) * s;
                        const y = Math.sin(angle) * s;
                        if (i === 0) ctx.moveTo(x, y);
                        else ctx.lineTo(x, y);
                    }
                    ctx.closePath();
                    ctx.stroke();
                    break;

                case 'square':
                    ctx.strokeRect(-s, -s, s * 2, s * 2);
                    // Inner square rotated
                    ctx.save();
                    ctx.rotate(Math.PI / 4);
                    ctx.strokeRect(-s * 0.5, -s * 0.5, s, s);
                    ctx.restore();
                    break;

                case 'hexagon':
                    ctx.beginPath();
                    for (let i = 0; i < 6; i++) {
                        const angle = (i / 6) * Math.PI * 2;
                        const x = Math.cos(angle) * s;
                        const y = Math.sin(angle) * s;
                        if (i === 0) ctx.moveTo(x, y);
                        else ctx.lineTo(x, y);
                    }
                    ctx.closePath();
                    ctx.stroke();
                    break;

                case 'diamond':
                    ctx.beginPath();
                    ctx.moveTo(0, -s);
                    ctx.lineTo(s * 0.6, 0);
                    ctx.lineTo(0, s);
                    ctx.lineTo(-s * 0.6, 0);
                    ctx.closePath();
                    ctx.stroke();
                    // Cross lines
                    ctx.beginPath();
                    ctx.moveTo(0, -s * 0.5);
                    ctx.lineTo(0, s * 0.5);
                    ctx.moveTo(-s * 0.3, 0);
                    ctx.lineTo(s * 0.3, 0);
                    ctx.stroke();
                    break;
            }

            ctx.restore();
        }
    }

    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
        initShapes();
    }

    function initShapes() {
        shapes = [];
        // More shapes for larger screens
        const count = Math.floor((width * height) / 40000) + 8;
        
        for (let i = 0; i < count; i++) {
            shapes.push(new Shape());
        }
    }

    function animate() {
        ctx.clearRect(0, 0, width, height);

        shapes.forEach(shape => {
            shape.update();
            shape.draw();
        });

        requestAnimationFrame(animate);
    }

    // Event listeners
    window.addEventListener('resize', resize);
    
    document.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    });

    document.addEventListener('mouseleave', () => {
        mouse.x = -1000;
        mouse.y = -1000;
    });

    // Touch support
    document.addEventListener('touchmove', (e) => {
        if (e.touches.length > 0) {
            mouse.x = e.touches[0].clientX;
            mouse.y = e.touches[0].clientY;
        }
    });

    document.addEventListener('touchend', () => {
        mouse.x = -1000;
        mouse.y = -1000;
    });

    // Initialize
    resize();
    animate();
})();
