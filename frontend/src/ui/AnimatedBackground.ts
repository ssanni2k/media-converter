import '../css/AnimatedBackground.css';

interface Butterfly {
  x: number;
  y: number;
  size: number;
  speed: number;
  rotation: number;
  targetRotation: number;
  wingPhase: number;
  wingSpeed: number;
  wingBaseSpeed: number;
  color: string;
  trail: { x: number; y: number }[];
  maxTrailLength: number;
  pathPhaseX: number;
  pathPhaseY: number;
  pathSpeedX: number;
  pathSpeedY: number;
  pathRadiusX: number;
  pathRadiusY: number;
  cx: number;
  cy: number;
  vx: number;
  vy: number;
  materializing: boolean;
  materializeProgress: number;
  dematerializing: boolean;
  dematerializeProgress: number;
  demTargetX: number;
  demTargetY: number;
  materializeCooldown: number;
  glideTimer: number;
  gliding: boolean;
}

interface OutlinePoint {
  x: number;
  y: number;
  type: 'move' | 'line';
}

interface DissolveFragment {
  points: { x: number; y: number }[];
  driftDx: number;
  driftDy: number;
}

const COLORS = ['#209CEE', '#33C2FF', '#8CD7FF'];
const BASE_COUNT_DESKTOP = 10;
const BASE_COUNT_MOBILE = 3;
const MATERIALIZE_DURATION = 300;
const DEMATERIALIZE_DURATION = 350;

const DISSOLVE_FRAGMENTS: DissolveFragment[] = [
  { points: [{x:0,y:0}, {x:-0.9,y:-0.3}, {x:-1.1,y:-0.1}, {x:-0.7,y:0.1}], driftDx: -0.8, driftDy: -0.3 },
  { points: [{x:0,y:0}, {x:0.9,y:-0.3}, {x:1.1,y:-0.1}, {x:0.7,y:0.1}], driftDx: 0.8, driftDy: -0.3 },
  { points: [{x:0,y:0}, {x:-0.5,y:0.2}, {x:-0.7,y:0.4}, {x:-0.3,y:0.35}], driftDx: -0.6, driftDy: 0.5 },
  { points: [{x:0,y:0}, {x:0.5,y:0.2}, {x:0.7,y:0.4}, {x:0.3,y:0.35}], driftDx: 0.6, driftDy: 0.5 },
  { points: [{x:0,y:-0.35}, {x:-0.08,y:0}, {x:0,y:0.35}, {x:0.08,y:0}], driftDx: 0, driftDy: 0.2 },
];

function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function createButterfly(canvasWidth: number, canvasHeight: number): Butterfly {
  return {
    x: Math.random() * canvasWidth,
    y: Math.random() * canvasHeight,
    size: 80 + Math.random() * 40,
    speed: 0.12 + Math.random() * 0.12,
    rotation: Math.random() * Math.PI * 2,
    targetRotation: Math.random() * Math.PI * 2,
    wingPhase: Math.random() * Math.PI * 2,
    wingSpeed: 0.055 + Math.random() * 0.025,
    wingBaseSpeed: 0.055 + Math.random() * 0.025,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    trail: [],
    maxTrailLength: 50 + Math.floor(Math.random() * 25),
    pathPhaseX: Math.random() * Math.PI * 2,
    pathPhaseY: Math.random() * Math.PI * 2,
    pathSpeedX: 0.0015 + Math.random() * 0.002,
    pathSpeedY: 0.001 + Math.random() * 0.0015,
    pathRadiusX: 100 + Math.random() * 200,
    pathRadiusY: 80 + Math.random() * 160,
    cx: canvasWidth * (0.15 + Math.random() * 0.7),
    cy: canvasHeight * (0.15 + Math.random() * 0.7),
    vx: (Math.random() - 0.5) * 0.3,
    vy: (Math.random() - 0.5) * 0.3,
    materializing: true,
    materializeProgress: 0,
    dematerializing: false,
    dematerializeProgress: 0,
    demTargetX: 0,
    demTargetY: 0,
    materializeCooldown: 0,
    glideTimer: 100 + Math.random() * 200,
    gliding: false,
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

function drawDissolve(
  ctx: CanvasRenderingContext2D,
  b: Butterfly,
  progress: number,
) {
  const halfSize = b.size / 2;

  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.rotation);

  // Phase 1 (0-30%): glow intensifies, fill fades out, wings stop flapping
  if (progress < 0.3) {
    const p = progress / 0.3;
    const wingFlap = 1 - (1 - (Math.sin(b.wingPhase) * 0.3 + 0.7)) * (1 - p);
    const alpha = 1 - p * 0.7;

    ctx.beginPath();
    ctx.arc(0, 0, halfSize * 1.5, 0, Math.PI * 2);
    ctx.clip();

    ctx.shadowBlur = 20 + 30 * p;
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

    ctx.shadowBlur = 10 + 15 * p;
    ctx.beginPath();
    ctx.moveTo(0, -halfSize * 0.35);
    ctx.lineTo(-halfSize * 0.08, 0);
    ctx.lineTo(0, halfSize * 0.35);
    ctx.lineTo(halfSize * 0.08, 0);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
    return;
  }

  // Phase 2 (30-100%): fragments separate and drift outward
  const dissolveP = (progress - 0.3) / 0.7;
  const easedP = easeOutCubic(dissolveP);

  const fillAlpha = Math.max(0, 0.3 * (1 - dissolveP * 2));
  const strokeAlpha = dissolveP < 0.5 ? 0.5 : 0.5 * (1 - (dissolveP - 0.5) * 2);
  const driftMag = easedP * halfSize * 0.6;

  for (const frag of DISSOLVE_FRAGMENTS) {
    const dx = frag.driftDx * driftMag;
    const dy = frag.driftDy * driftMag;

    ctx.save();
    ctx.translate(dx, dy);

    // Fill
    if (fillAlpha > 0.01) {
      ctx.shadowBlur = 15 + 10 * dissolveP;
      ctx.shadowColor = b.color;
      ctx.fillStyle = b.color;
      ctx.globalAlpha = fillAlpha;
      ctx.beginPath();
      ctx.moveTo(frag.points[0].x * halfSize, frag.points[0].y * halfSize);
      for (let i = 1; i < frag.points.length; i++) {
        ctx.lineTo(frag.points[i].x * halfSize, frag.points[i].y * halfSize);
      }
      ctx.closePath();
      ctx.fill();
    }

    // Stroke
    if (strokeAlpha > 0.01) {
      ctx.shadowBlur = 10;
      ctx.shadowColor = b.color;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = strokeAlpha;
      ctx.beginPath();
      ctx.moveTo(frag.points[0].x * halfSize, frag.points[0].y * halfSize);
      for (let i = 1; i < frag.points.length; i++) {
        ctx.lineTo(frag.points[i].x * halfSize, frag.points[i].y * halfSize);
      }
      ctx.closePath();
      ctx.stroke();
    }

    ctx.restore();
  }

  ctx.restore();
}

export function mountAnimatedBackground(canvas: HTMLCanvasElement, toggleBtn: HTMLButtonElement): () => void {
  const ctx = canvas.getContext('2d')!;
  let butterflies: Butterfly[] = [];
  let animationRef = 0;
  let uiElements: DOMRect[] = [];
  let enabled = true;
  let lastTime = 0;

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

  const drawTrail = (b: Butterfly) => {
    const trail = b.trail;
    if (trail.length < 3) return;

    for (let i = 1; i < trail.length; i++) {
      const t = i / trail.length;
      ctx.beginPath();
      ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
      ctx.lineTo(trail[i].x, trail[i].y);
      ctx.strokeStyle = b.color;
      ctx.globalAlpha = (1 - t) * 0.3;
      ctx.lineWidth = Math.max(0.5, 3.5 * (1 - t));
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
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

  const animate = (timestamp: number) => {
    const dt = lastTime ? Math.min((timestamp - lastTime) / 16.67, 3) : 1;
    lastTime = timestamp;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!enabled) {
      animationRef = requestAnimationFrame(animate);
      return;
    }

    butterflies.forEach((b, idx) => {
      const pad = b.size * 0.4;

      if (b.dematerializing) {
        b.dematerializeProgress += dt;
        b.wingPhase += b.wingBaseSpeed * dt;

        const progress = Math.min(b.dematerializeProgress / DEMATERIALIZE_DURATION, 1);
        drawDissolve(ctx, b, progress);

        if (b.trail.length > 0) {
          const removeCount = Math.ceil(3 * dt);
          b.trail.splice(b.trail.length - removeCount, removeCount);
          if (b.trail.length > 0) drawTrail(b);
        }

        if (b.dematerializeProgress >= DEMATERIALIZE_DURATION) {
          b.dematerializing = false;
          b.dematerializeProgress = 0;
          b.x = b.demTargetX;
          b.y = b.demTargetY;
          b.trail = [];
          b.materializing = true;
          b.materializeProgress = 0;
        }
        return;
      }

      if (b.materializing) {
        b.materializeProgress += dt;

        const progress = b.materializeProgress / MATERIALIZE_DURATION;

        if (progress < 0.6) {
          drawButterflyOutline(b, progress / 0.6);
          b.wingPhase += b.wingBaseSpeed * 0.3 * dt;
        } else {
          const fillProgress = (progress - 0.6) / 0.4;
          drawButterflyOutline(b, 1);
          drawButterflyFill(b, fillProgress);
          b.wingPhase += b.wingBaseSpeed * 0.5 * dt;
        }

        if (b.materializeProgress >= MATERIALIZE_DURATION) {
          b.materializing = false;
          b.materializeProgress = 0;
          b.materializeCooldown = 120;
        }
        return;
      }

      if (b.materializeCooldown > 0) {
        b.materializeCooldown -= dt;
      }

      // Glide toggle
      b.glideTimer -= dt;
      if (b.glideTimer <= 0) {
        b.gliding = !b.gliding;
        b.glideTimer = b.gliding ? (80 + Math.random() * 180) : (40 + Math.random() * 100);
        b.wingSpeed = b.gliding ? b.wingBaseSpeed * 0.3 : b.wingBaseSpeed;
      }

      b.wingPhase += b.wingSpeed * dt;

      // Organic Lissajous path with secondary harmonics
      b.pathPhaseX += b.pathSpeedX * dt;
      b.pathPhaseY += b.pathSpeedY * dt;

      const tx = Math.sin(b.pathPhaseX) * b.pathRadiusX
        + Math.sin(b.pathPhaseX * 0.6 + 1.7) * b.pathRadiusX * 0.25
        + b.cx;
      const ty = Math.cos(b.pathPhaseY) * b.pathRadiusY
        + Math.cos(b.pathPhaseY * 0.5 + 2.3) * b.pathRadiusY * 0.2
        + b.cy;

      const attraction = b.gliding ? 0.001 : 0.003;
      b.vx += (tx - b.x) * attraction * dt;
      b.vy += (ty - b.y) * attraction * dt;

      // Friction instead of hard cap
      const friction = Math.pow(b.gliding ? 0.992 : 0.975, dt);
      b.vx *= friction;
      b.vy *= friction;

      // Soft speed limit
      const maxSpd = b.gliding ? b.speed * 0.35 : b.speed;
      const spd = Math.hypot(b.vx, b.vy);
      if (spd > maxSpd) {
        const scale = maxSpd / spd;
        b.vx *= scale;
        b.vy *= scale;
      }

      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Repulsion from other butterflies (increased hitbox)
      butterflies.forEach((other, otherIdx) => {
        if (idx === otherIdx) return;
        const dx = other.x - b.x;
        const dy = other.y - b.y;
        const dist = Math.hypot(dx, dy);
        const minDist = (b.size + other.size) * 0.85;

        if (dist < minDist && dist > 0.1) {
          const push = (minDist - dist) * 0.02 * dt;
          b.vx -= (dx / dist) * push;
          b.vy -= (dy / dist) * push;

          // Positional correction to prevent visual overlap
          if (dist < minDist * 0.5) {
            const overlap = (minDist * 0.5 - dist) * 0.3;
            b.x -= (dx / dist) * overlap * dt;
            b.y -= (dy / dist) * overlap * dt;
          }
        }
      });

      // Soft boundary steering (no hard bounce)
      const margin = pad;
      const cw = canvas.width;
      const ch = canvas.height;
      const steer = 0.04 * dt;
      if (b.x < margin) { b.vx += steer; b.x = margin; }
      if (b.x > cw - margin) { b.vx -= steer; b.x = cw - margin; }
      if (b.y < margin) { b.vy += steer; b.y = margin; }
      if (b.y > ch - margin) { b.vy -= steer; b.y = ch - margin; }

      // UI element avoidance — dematerialize, then rematerialize elsewhere
      if (b.materializeCooldown <= 0) {
        for (const rect of uiElements) {
          if (b.x >= rect.left && b.x <= rect.right && b.y >= rect.top && b.y <= rect.bottom) {
            const dl = b.x - rect.left;
            const dr = rect.right - b.x;
            const dt2 = b.y - rect.top;
            const db = rect.bottom - b.y;
            const m = Math.min(dl, dr, dt2, db);

            if (m === dl) { b.demTargetX = rect.left - b.size; b.vx = -0.5; }
            else if (m === dr) { b.demTargetX = rect.right + b.size; b.vx = 0.5; }
            else { b.demTargetX = b.x; }

            if (m === dt2) { b.demTargetY = rect.top - b.size; b.vy = -0.5; }
            else if (m === db) { b.demTargetY = rect.bottom + b.size; b.vy = 0.5; }
            else { b.demTargetY = b.y; }

            b.dematerializing = true;
            b.dematerializeProgress = 0;
            return;
          }
        }
      }

      // Smooth rotation
      b.targetRotation = Math.atan2(b.vy, b.vx) + Math.PI / 2;
      b.rotation = lerpAngle(b.rotation, b.targetRotation, 0.06 * dt);

      // Trail
      b.trail.unshift({ x: b.x, y: b.y });
      if (b.trail.length > b.maxTrailLength) b.trail.pop();

      drawTrail(b);
      drawButterflyFill(b, 1);
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
  animationRef = requestAnimationFrame(animate);

  return () => {
    window.removeEventListener('resize', resize);
    cancelAnimationFrame(animationRef);
  };
}