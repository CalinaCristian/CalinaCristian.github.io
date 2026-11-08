class Utils {
    static RADIUS_DIVIDER = 10000;
    static COUNT_DIVIDER = 15000;
    static MOUSE_COLLISION_TIMEOUT = 100;
    // (round 6 note 39) small glowing city lights drifting over the road background instead of big grey bubbles
    static MIN_RADIUS = 1.6;
    static MAX_RADIUS = 4.2;
    static MOUSE_RADIUS = 90;
    static MIN_BALLS = 24;
    static MAX_BALLS = 90;
    static COLORS = ['rgba(251, 191, 36, 0.85)', 'rgba(96, 165, 250, 0.8)', 'rgba(250, 70, 22, 0.75)', 'rgba(226, 232, 240, 0.7)', 'rgba(56, 189, 248, 0.75)'];

    static GenerateRandomPosition = (canvas, radius) => ({
        x: Math.floor(Math.random() * (canvas.width - radius * 2)) + radius,
        y: Math.floor(Math.random() * (canvas.height - radius * 2)) + radius
    })

    static GenerateRandomNonNulLVelocity = () => {
        const velocity = (Math.random() * 0.9 + 0.25) * (Math.random() < 0.5 ? -1 : 1);
        return velocity;
    }

    static GenerateRandomVelocity = () => ({
        x: Utils.GenerateRandomNonNulLVelocity(),
        y: Utils.GenerateRandomNonNulLVelocity()
    })

    static GenerateRadius = () => Utils.MIN_RADIUS + Math.random() * (Utils.MAX_RADIUS - Utils.MIN_RADIUS)

    static GenerateRandomBall = (canvas) => {
        const radius = Utils.GenerateRadius(canvas);

        return {
            position: Utils.GenerateRandomPosition(canvas, radius),
            velocity: Utils.GenerateRandomVelocity(),
            radius,
            color: Utils.COLORS[Math.floor(Math.random() * Utils.COLORS.length)]
        }
    }

    static GetBallsCount = (canvas) => {
        return Math.round(Math.min(Math.max(canvas.height * canvas.width / 24000, Utils.MIN_BALLS), Utils.MAX_BALLS));
    }
}

class BallGame {
    constructor() {
        this.canvas = document.getElementById('cv-game');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.ballsCount = Utils.GetBallsCount(this.canvas);
        this.mouse = new Mouse(this.canvas);

        this.initBalls();

        let portrait = window.matchMedia("(orientation: portrait)");

        portrait.addEventListener("change", this.resizeCanvas);
        window.addEventListener('resize', this.resizeCanvas);
        window.addEventListener("mousemove", this.moveMouse);
        window.addEventListener("mouseout", () => {
            this.mouse.updatePosition();
        })

        this.animate();
    }

    initBalls = () => {
        this.balls = [];
        this.addBalls(this.ballsCount);
    }

    moveMouse = (ev) => {
        this.mouse.updatePosition(ev.x, ev.y);
    }

    resizeCanvas = () => {
        this.stop();
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.ballsCount = Utils.GetBallsCount(this.canvas);

        this.mouse.updateRadius(this.canvas);
        this.removeOutOfBoundsBalls();
    }

    removeOutOfBoundsBalls = () => {
        this.balls = this.balls.filter(ball => {
            return ball.position.x - ball.radius > 0 && ball.position.x + ball.radius < this.canvas.width && ball.position.y - ball.radius > 0 && ball.position.y + ball.radius < this.canvas.height;
        }).map(ball => {
            return ball;
        });

        if (this.balls.length < this.ballsCount) {
            this.addBalls(this.ballsCount - this.balls.length);
        }

        if (this.balls.length > this.ballsCount) {
            this.removeBalls(this.balls.length - this.ballsCount);
        }

        this.animate();
    }

    addBalls = (count) => {
        for (let i = 0; i < count; i++) {
            this.balls.push(new Ball(this.canvas, this.ctx, Utils.GenerateRandomBall(this.canvas)));
        }
    }

    removeBalls = (count) => {
        for (let i = 0; i < count; i++) {
            this.balls.pop();
        }
    }

    animate = () => {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.balls.forEach((ball) => {
            ball.draw();
            ball.move(this.mouse);
        });

        this.animationFrame = requestAnimationFrame(this.animate);
    }

    stop = () => {
        cancelAnimationFrame(this.animationFrame);
    }
}

class Mouse {
    constructor(canvas, x, y) {
        this.radius = Utils.MOUSE_RADIUS;
        this.x = x;
        this.y = y;
    }

    updateRadius = () => {
        this.radius = Utils.MOUSE_RADIUS;
    }

    updatePosition = (x, y) => {
        this.lastClick = new Date().getTime();
        this.x = x;
        this.y = y;
    }
}

class Ball {
    constructor(canvas, ctx, ball) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.position = ball.position;
        this.velocity = ball.velocity;
        this.color = ball.color;
        this.radius = ball.radius;

        this.previousAngle = Infinity;
    }

    updateRadius = (newRadius) => {
        this.radius = newRadius;
    }

    handleWallCollision = () => {
        if (this.position.x + this.velocity.x + this.radius > this.canvas.width || this.position.x + this.velocity.x - this.radius < 0) {
            this.velocity.x = -this.velocity.x;
        }

        if (this.position.y + this.velocity.y + this.radius > this.canvas.height || this.position.y + this.velocity.y - this.radius < 0) {
            this.velocity.y = -this.velocity.y;
        }
    }

    handleMouseCollision = (mouse) => {
        if (new Date().getTime() - mouse.lastClick > Utils.MOUSE_COLLISION_TIMEOUT) {
            return;
        }

        const dx = mouse.x - this.position.x;
        const dy = mouse.y - this.position.y;

        const distance = Math.sqrt(dx ** 2 + dy ** 2);

        if (distance < mouse.radius + this.radius) {
            if (mouse.x < this.position.x && this.position.x < this.canvas.width - this.radius - 10) {
                this.position.x += 10;
                this.velocity.x = -this.velocity.x;
            }

            if (mouse.x > this.position.x && this.position.x > this.radius + 10) {
                this.position.x -= 10;
                this.velocity.x = -this.velocity.x;
            }

            if (mouse.y < this.position.y && this.position.y < this.canvas.height - this.radius - 10) {
                this.position.y += 10;
                this.velocity.y = -this.velocity.y;
            }

            if (mouse.y > this.position.y && this.position.y > this.radius + 10) {
                this.position.y -= 10;
                this.velocity.y = -this.velocity.y;
            }
        }
    }

    move = (mouse) => {
        this.handleWallCollision();
        this.handleMouseCollision(mouse);

        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;
    }

    draw = () => {
        // a soft glow + a bright core (headlights / city lights in the distance)
        const { x, y } = this.position, r = this.radius, g = this.ctx.createRadialGradient(x, y, 0, x, y, r * 4);
        g.addColorStop(0, this.color); g.addColorStop(0.25, this.color.replace(/[\d.]+\)$/, '0.35)')); g.addColorStop(1, this.color.replace(/[\d.]+\)$/, '0)'));
        this.ctx.beginPath(); this.ctx.arc(x, y, r * 4, 0, 2 * Math.PI); this.ctx.fillStyle = g; this.ctx.fill();
    }
}

const canvas = new BallGame();