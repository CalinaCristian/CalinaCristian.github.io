class Utils {
    static RADIUS_DIVIDER = 10000;
    static COUNT_DIVIDER = 15000;
    static MOUSE_COLLISION_TIMEOUT = 100;
    static MIN_RADIUS = 75;
    static MAX_RADIUS = 120;
    static MIN_BALLS = 10;
    static MAX_BALLS = 200;

    static GenerateRandomPosition = (canvas, radius) => ({
        x: Math.floor(Math.random() * (canvas.width - radius * 2)) + radius,
        y: Math.floor(Math.random() * (canvas.height - radius * 2)) + radius
    })

    static GenerateRandomNonNulLVelocity = () => {
        const velocity = Math.floor(Math.random() * 5) - 2.5;
        return velocity === 0 ? 1 : velocity;
    }

    static GenerateRandomVelocity = () => ({
        x: Utils.GenerateRandomNonNulLVelocity(),
        y: Utils.GenerateRandomNonNulLVelocity()
    })

    static GenerateRadius = (canvas) => {
        const radius = Math.min(Math.max(canvas.height * canvas.width / Utils.RADIUS_DIVIDER, Utils.MIN_RADIUS), Utils.MAX_RADIUS);
        return radius;
    }

    static GenerateRandomBall = (canvas) => {
        const radius = Utils.GenerateRadius(canvas);

        return {
            position: Utils.GenerateRandomPosition(canvas, radius),
            velocity: Utils.GenerateRandomVelocity(),
            radius,
            color: 'rgb(0, 0, 0, 1)'
        }
    }

    static GetBallsCount = (canvas) => {
        return Math.min(Math.max(canvas.height * canvas.width / Utils.COUNT_DIVIDER / 2, Utils.MIN_BALLS), Utils.MAX_BALLS);
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
            ball.updateRadius(Utils.GenerateRadius(this.canvas));
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
        this.radius = Utils.GenerateRadius(canvas);
        this.x = x;
        this.y = y;
    }

    updateRadius = (canvas) => {
        this.radius = Utils.GenerateRadius(canvas);
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
        this.ctx.beginPath();
        this.ctx.arc(this.position.x, this.position.y, this.radius, 0, 2 * Math.PI);
        this.ctx.fillStyle = this.color;

        this.ctx.fill();
    }
}

const canvas = new BallGame();