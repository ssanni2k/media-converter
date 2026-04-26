import '../css/AnimatedBackground.css';

interface Butterfly {
  x: number;
  y: number;
  size: number;
  speed: number;
  rotation: number;
  wingPhase: number;
  wingSpeed: number;
  color: string;
  trail: { x: number; y: number }[];
  maxTrailLength: number;
  pathPhaseX: number;
  pathPhaseY: number;
  pathSpeedX: number;
  pathSpeedY: number;
  vx: number;
  vy: number;
  materializing: boolean;
  materializeProgress: number;
  materializeCooldown: number;
}

interface OutlinePoint {
  x: number;
  y: number;
  type: 'move' | 'line';
}

const COLORS = ['#209CEE', '#33C2FF', '#8CD7FF'];
const BASE_COUNT_DESKTOP = 10;
const BASE_COUNT_MOBILE = 3;
const MATERIALIZE_DURATION = 300;

function createButterfly(canvasWidth: number, canvasHeight: number): Butterfly {
  const x = Math.random() * canvasWidth;
  const y = Math.random() * canvasHeight;

  return {
    x,
    y,
    size: 80 + Math.random() * 40,
    speed: 0.2 + Math.random() * 0.2,
    rotation: Math.random() * Math.PI * 2,
    wingPhase: Math.random() * Math.PI * 2,
    wingSpeed: 0.08 + Math.random() * 0.04,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    trail: [],
    maxTrailLength: 40 + Math.floor(Math.random() * 20),
    pathPhaseX: Math.random() * Math.PI * 2,
    pathPhaseY: Math.random() * Math.PI * 2,
    pathSpeedX: 0.004 + Math.random() * 0.003,
    pathSpeedY: 0.003 + Math.random() * 0.002,
    vx: (Math.random() - 0.5) * 2,
    vy: (Math.random() - 0.5) * 2,
    materializing: false,
    materializeProgress: 0,
    materializeCooldown: 0,
  };
}

function getButterflyOutline(b: Butterfly): OutlinePoint[] {
  const points: OutlinePoint[] = [];
  const halfSize = b.size / 2;

  points.push({ x: 0, y: 0, type: 'move' });

  points.push({ x: -halfSize * 0.9, y: -halfSize * 0.3, type: 'line' });
  points.push({ x: -halfSize * 1.1, y: -halfSize * 0.1, type: 'line' });
  points.push({ x: -halfSize * 0.7, y: halfSize * 0.1, type: 'line' });

  points.push({ x: -halfSize * 0.5, y: halfSize * 0.2, type: 'line' });
  points.push({ x: -halfSize * 0.7, y: halfSize * 0.4, type: 'line' });
  points.push({ x: -halfSize * 0.3, y: halfSize * 0.35, type: 'line' });

  points.push({ x: 0, y: 0, type: 'move' });

  points.push({ x: halfSize * 0.3, y: halfSize * 0.35, type: 'line' });
  points.push({ x: halfSize * 0.7, y: halfSize * 0.4, type: 'line' });
  points.push({ x: halfSize * 0.5, y: halfSize * 0.2, type: 'line' });

  points.push({ x: halfSize * 0.7, y: halfSize * 0.1, type: 'line' });
  points.push({ x: halfSize * 1.1, y: -halfSize * 0.1, type: 'line' });
  points.push({ x: halfSize * 0.9, y: -halfSize * 0.3, type: 'line' });

  points.push({ x: 0, y: 0, type: 'move' });

  points.push({ x: 0, y: -halfSize * 0.35, type: 'line' });
  points.push({ x: 0, y: halfSize * 0.35, type: 'line' });

  return points;
}

export function mountAnimatedBackground(canvas: HTMLCanvasElement, toggleBtn: HTMLButtonElement): () => void {
  const ctx = canvas.getContext('2d')!;
  let butterflies: Butterfly[] = [];
  let animationRef = 0;
  let uiElements: DOMRect[] = [];
  let enabled = true;

  const resize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const count = window.innerWidth >= 1024
      ? BASE_COUNT_DESKTOP
      : window.innerWidth >= 640
        ? BASE_COUNT_DESKTOP - 2
        : BASE_COUNT_MOBILE;

    butterflies = [];
    for (let i = 0; i < count; i++) {
      butterflies.push(createButterfly(canvas.width, canvas.height));
    }

    uiElements = [];
    const converterCard = document.querySelector('.converter-card') as HTMLElement;
    const historyContainer = document.querySelector('.job-history') as HTMLElement;
    if (converterCard) uiElements.push(converterCard.getBoundingClientRect());
    if (historyContainer) uiElements.push(historyContainer.getBoundingClientRect());
  };

  const drawTrail = (trail: { x: number; y: number }[]) => {
    if (trail.length < 2) return;

    ctx.beginPath();
    ctx.moveTo(trail[0].x, trail[0].y);
    for (let i = 1; i < trail.length; i++) {
      ctx.lineTo(trail[i].x, trail[i].y);
    }

    const gradient = ctx.createLinearGradient(
      trail[0].x, trail[0].y,
      trail[trail.length - 1].x, trail[trail.length - 1].y
    );
    gradient.addColorStop(0, 'rgba(32, 156, 238, 0.8)');
    gradient.addColorStop(1, 'rgba(32, 156, 238, 0)');

    ctx.strokeStyle = gradient;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const drawButterflyOutline = (b: Butterfly, progress: number) => {
    const outline = getButterflyOutline(b);
    const totalPoints = outline.length;
    const pointsToDraw = Math.floor(totalPoints * progress);

    if (pointsToDraw < 1) return;

    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.rotation);

    ctx.shadowBlur = 20;
    ctx.shadowColor = b.color;
    ctx.strokeStyle = b.color;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();

    for (let i = 0; i < pointsToDraw && i < outline.length; i++) {
      const pt = outline[i];
      if (pt.type === 'move') {
        ctx.moveTo(pt.x, pt.y);
      } else {
        ctx.lineTo(pt.x, pt.y);
      }
    }

    if (pointsToDraw < totalPoints && pointsToDraw > 0) {
      const nextPt = outline[pointsToDraw];
      if (nextPt && nextPt.type === 'line') {
        const prevPt = outline[pointsToDraw - 1];
        const partialProgress = (totalPoints * progress) % 1;
        const partialX = prevPt.x + (nextPt.x - prevPt.x) * partialProgress;
        const partialY = prevPt.y + (nextPt.y - prevPt.y) * partialProgress;
        ctx.lineTo(partialX, partialY);
      }
    }

    ctx.stroke();
    ctx.restore();
  };

  const drawButterflyFill = (b: Butterfly, alpha: number, fillProgress: number = 1) => {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.rotation);

    const wingFlap = Math.sin(b.wingPhase) * 0.3 + 0.7;
    const halfSize = b.size / 2;

    ctx.beginPath();
    ctx.arc(0, 0, halfSize * 1.5 * fillProgress, 0, Math.PI * 2);
    ctx.clip();

    ctx.shadowBlur = 20;
    ctx.shadowColor = b.color;
    ctx.fillStyle = b.color;
    ctx.globalAlpha = alpha;

    ctx.save();
    ctx.scale(wingFlap, 1);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-halfSize * 0.9, -halfSize * 0.3);
    ctx.lineTo(-halfSize * 1.1, -halfSize * 0.1);
    ctx.lineTo(-halfSize * 0.7, halfSize * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.scale(-wingFlap, 1);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-halfSize * 0.9, -halfSize * 0.3);
    ctx.lineTo(-halfSize * 1.1, -halfSize * 0.1);
    ctx.lineTo(-halfSize * 0.7, halfSize * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.scale(wingFlap * 0.7, 1);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-halfSize * 0.5, halfSize * 0.2);
    ctx.lineTo(-halfSize * 0.7, halfSize * 0.4);
    ctx.lineTo(-halfSize * 0.3, halfSize * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.scale(-wingFlap * 0.7, 1);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-halfSize * 0.5, halfSize * 0.2);
    ctx.lineTo(-halfSize * 0.7, halfSize * 0.4);
    ctx.lineTo(-halfSize * 0.3, halfSize * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(0, -halfSize * 0.35);
    ctx.lineTo(-halfSize * 0.08, 0);
    ctx.lineTo(0, halfSize * 0.35);
    ctx.lineTo(halfSize * 0.08, 0);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  };

  const animate = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!enabled) {
      animationRef = requestAnimationFrame(animate);
      return;
    }

    butterflies.forEach((b, idx) => {
      const halfSize = b.size;

      if (b.materializing) {
        b.materializeProgress++;

        const progress = b.materializeProgress / MATERIALIZE_DURATION;

        if (progress < 0.6) {
          const outlineProgress = progress / 0.6;
          drawButterflyOutline(b, outlineProgress);
          b.wingPhase += b.wingSpeed * 0.3;
        } else {
          const fillProgress = (progress - 0.6) / 0.4;
          drawButterflyOutline(b, 1);
          drawButterflyFill(b, fillProgress);
          b.wingPhase += b.wingSpeed * 0.5;
        }

        if (b.materializeProgress >= MATERIALIZE_DURATION) {
          b.materializing = false;
          b.materializeProgress = 0;
          b.materializeCooldown = 120;
          b.vx = (Math.random() - 0.5) * b.speed;
          b.vy = (Math.random() - 0.5) * b.speed;
        }
      } else {
        if (b.materializeCooldown > 0) {
          b.materializeCooldown--;
        }

        b.trail.unshift({ x: b.x, y: b.y });
        if (b.trail.length > b.maxTrailLength) {
          b.trail.pop();
        }

        b.wingPhase += b.wingSpeed;

        b.pathPhaseX += b.pathSpeedX;
        b.pathPhaseY += b.pathSpeedY;

        const targetX = Math.sin(b.pathPhaseX) * 100 + canvas.width / 2;
        const targetY = Math.cos(b.pathPhaseY) * 70 + canvas.height / 2;

        b.vx += (targetX - b.x) * 0.002;
        b.vy += (targetY - b.y) * 0.002;

        const currentSpeed = Math.hypot(b.vx, b.vy);
        if (currentSpeed > b.speed) {
          b.vx = (b.vx / currentSpeed) * b.speed;
          b.vy = (b.vy / currentSpeed) * b.speed;
        }

        b.x += b.vx;
        b.y += b.vy;

        butterflies.forEach((other, otherIdx) => {
          if (idx === otherIdx) return;
          const dx = other.x - b.x;
          const dy = other.y - b.y;
          const dist = Math.hypot(dx, dy);
          const minDist = b.size + other.size;

          if (dist < minDist && dist > 0) {
            const push = (minDist - dist) * 0.02;
            b.vx -= (dx / dist) * push;
            b.vy -= (dy / dist) * push;
          }
        });

        if (b.x - halfSize < 0) { b.vx = Math.abs(b.vx); b.x = halfSize; }
        if (b.x + halfSize > canvas.width) { b.vx = -Math.abs(b.vx); b.x = canvas.width - halfSize; }
        if (b.y - halfSize < 0) { b.vy = Math.abs(b.vy); b.y = halfSize; }
        if (b.y + halfSize > canvas.height) { b.vy = -Math.abs(b.vy); b.y = canvas.height - halfSize; }

        if (b.materializeCooldown === 0) {
          for (const rect of uiElements) {
            if (b.x - halfSize >= rect.left && b.x + halfSize <= rect.right &&
                b.y - halfSize >= rect.top && b.y + halfSize <= rect.bottom) {

              const distLeft = b.x - rect.left;
              const distRight = rect.right - b.x;
              const distTop = b.y - rect.top;
              const distBottom = rect.bottom - b.y;

              const minDist = Math.min(distLeft, distRight, distTop, distBottom);

              if (minDist === distLeft || minDist === distRight) {
                if (distLeft < distRight) {
                  b.x = rect.left - halfSize - 20;
                } else {
                  b.x = rect.right + halfSize + 20;
                }
                b.y = Math.max(halfSize, Math.min(canvas.height - halfSize, Math.random() * canvas.height));
              } else {
                if (distTop < distBottom) {
                  b.y = rect.top - halfSize - 20;
                } else {
                  b.y = rect.bottom + halfSize + 20;
                }
                b.x = Math.max(halfSize, Math.min(canvas.width - halfSize, Math.random() * canvas.width));
              }

              b.materializing = true;
              b.materializeProgress = 0;
              b.trail = [];
              break;
            }
          }
        }

        b.rotation = Math.atan2(b.vy, b.vx) + Math.PI / 2;

        drawTrail(b.trail);
        drawButterflyFill(b, 1);
      }
    });

    animationRef = requestAnimationFrame(animate);
  };

  const clearCanvas = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  toggleBtn.addEventListener('click', () => {
    enabled = !enabled;
    toggleBtn.textContent = enabled ? '⏸' : '▶';
    toggleBtn.className = enabled
      ? 'animated-background__toggle'
      : 'animated-background__toggle animated-background__toggle--disabled';

    if (!enabled) clearCanvas();
  });

  resize();
  window.addEventListener('resize', resize);
  animate();

  return () => {
    window.removeEventListener('resize', resize);
    cancelAnimationFrame(animationRef);
  };
}
