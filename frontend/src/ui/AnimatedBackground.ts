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

function findSafePosition(
  canvasWidth: number,
  canvasHeight: number,
  existing: Butterfly[],
  minDistance: number,
): { x: number; y: number } {
  const margin = 60;
  for (let attempt = 0; attempt < 30; attempt++) {
    const x = margin + Math.random() * (canvasWidth - margin * 2);
    const y = margin + Math.random() * (canvasHeight - margin * 2);
    let tooClose = false;
    for (const other of existing) {
      const otherX = other.dematerializing ? other.demTargetX : other.x;
      const otherY = other.dematerializing ? other.demTargetY : other.y;
      if (Math.hypot(x - otherX, y - otherY) < minDistance) {
        tooClose = true;
        break;
      }
    }
    if (!tooClose) return { x, y };
  }
  return { x: margin + Math.random() * (canvasWidth - margin * 2), y: margin + Math.random() * (canvasHeight - margin * 2) };
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

function drawDissolve(
  ctx: CanvasRenderingContext2D,
  b: Butterfly,
  progress: number,
) {
  const halfSize = b.size / 2;

  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.rotation);

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

    const wingFill = (wf: number, pts: { x: number; y: number }[]) => {
      ctx.save();
      ctx.scale(wf, 1);
      ctx.beginPath();
      ctx.moveTo(pts[0].x * halfSize, pts[0].y * halfSize);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x * halfSize, pts[i].y * halfSize);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    wingFill(wingFlap, DISSOLVE_FRAGMENTS[0].points);
    wingFill(-wingFlap, DISSOLVE_FRAGMENTS[0].points);
    wingFill(wingFlap * 0.7, DISSOLVE_FRAGMENTS[2].points);
    wingFill(-wingFlap * 0.7, DISSOLVE_FRAGMENTS[2].points);

    ctx.shadowBlur = 10 + 15 * p;
    ctx.beginPath();
    ctx.moveTo(DISSOLVE_FRAGMENTS[4].points[0].x * halfSize, DISSOLVE_FRAGMENTS[4].points[0].y * halfSize);
    for (let i = 1; i < DISSOLVE_FRAGMENTS[4].points.length; i++) ctx.lineTo(DISSOLVE_FRAGMENTS[4].points[i].x * halfSize, DISSOLVE_FRAGMENTS[4].points[i].y * halfSize);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    return;
  }

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

    if (fillAlpha > 0.01) {
      ctx.shadowBlur = 15 + 10 * dissolveP;
      ctx.shadowColor = b.color;
      ctx.fillStyle = b.color;
      ctx.globalAlpha = fillAlpha;
      ctx.beginPath();
      ctx.moveTo(frag.points[0].x * halfSize, frag.points[0].y * halfSize);
      for (let i = 1; i < frag.points.length; i++) ctx.lineTo(frag.points[i].x * halfSize, frag.points[i].y * halfSize);
      ctx.closePath();
      ctx.fill();
    }

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
      for (let i = 1; i < frag.points.length; i++) ctx.lineTo(frag.points[i].x * halfSize, frag.points[i].y * halfSize);
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
      const b = createButterfly(canvas.width, canvas.height);
      const pos = findSafePosition(canvas.width, canvas.height, butterflies, 160);
      b.x = pos.x;
      b.y = pos.y;
      b.cx = pos.x;
      b.cy = pos.y;
      butterflies.push(b);
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

  const drawButterflyFill = (b: Butterfly) => {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.rotation);

    const wingFlap = Math.sin(b.wingPhase) * 0.3 + 0.7;
    const halfSize = b.size / 2;

    ctx.shadowBlur = 20;
    ctx.shadowColor = b.color;
    ctx.fillStyle = b.color;

    const drawWing = (scale: number, fragPoints: { x: number; y: number }[]) => {
      ctx.save();
      ctx.scale(scale, 1);
      ctx.beginPath();
      ctx.moveTo(fragPoints[0].x * halfSize, fragPoints[0].y * halfSize);
      for (let i = 1; i < fragPoints.length; i++) ctx.lineTo(fragPoints[i].x * halfSize, fragPoints[i].y * halfSize);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    drawWing(wingFlap, DISSOLVE_FRAGMENTS[0].points);
    drawWing(-wingFlap, DISSOLVE_FRAGMENTS[0].points);
    drawWing(wingFlap * 0.7, DISSOLVE_FRAGMENTS[2].points);
    drawWing(-wingFlap * 0.7, DISSOLVE_FRAGMENTS[2].points);

    ctx.shadowBlur = 10;
    ctx.beginPath();
    const body = DISSOLVE_FRAGMENTS[4].points;
    ctx.moveTo(body[0].x * halfSize, body[0].y * halfSize);
    for (let i = 1; i < body.length; i++) ctx.lineTo(body[i].x * halfSize, body[i].y * halfSize);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  };

  const drawMaterialize = (b: Butterfly, progress: number) => {
    const halfSize = b.size / 2;
    const OUTLINE_END = 0.6;
    const fragCount = DISSOLVE_FRAGMENTS.length;
    const fragDuration = OUTLINE_END / fragCount;

    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.rotation);

    ctx.shadowBlur = 20;
    ctx.shadowColor = b.color;

    if (progress < OUTLINE_END) {
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = 1;

      for (let f = 0; f < fragCount; f++) {
        const fragStart = f * fragDuration;
        if (progress < fragStart) break;

        const localP = Math.min((progress - fragStart) / fragDuration, 1);
        const frag = DISSOLVE_FRAGMENTS[f];
        const pts = frag.points.map(p => ({ x: p.x * halfSize, y: p.y * halfSize }));
        const totalSegs = pts.length;

        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);

        const segsComplete = Math.floor(localP * totalSegs);
        for (let s = 0; s < segsComplete && s < totalSegs; s++) {
          const nextIdx = (s + 1) % pts.length;
          ctx.lineTo(pts[nextIdx].x, pts[nextIdx].y);
        }

        if (segsComplete < totalSegs && localP > 0) {
          const segFraction = (localP * totalSegs) % 1;
          const fromIdx = segsComplete % pts.length;
          const toIdx = (segsComplete + 1) % pts.length;
          const px = pts[fromIdx].x + (pts[toIdx].x - pts[fromIdx].x) * segFraction;
          const py = pts[fromIdx].y + (pts[toIdx].y - pts[fromIdx].y) * segFraction;
          ctx.lineTo(px, py);
        }

        ctx.stroke();
      }
    } else {
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = 1;

      for (const frag of DISSOLVE_FRAGMENTS) {
        const pts = frag.points.map(p => ({ x: p.x * halfSize, y: p.y * halfSize }));
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.closePath();
        ctx.stroke();
      }

      const fillAlpha = (progress - OUTLINE_END) / (1 - OUTLINE_END);
      ctx.globalAlpha = fillAlpha;
      ctx.fillStyle = b.color;

      for (const frag of DISSOLVE_FRAGMENTS) {
        const pts = frag.points.map(p => ({ x: p.x * halfSize, y: p.y * halfSize }));
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.closePath();
        ctx.fill();
      }
    }

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

          for (const other of butterflies) {
            if (other === b) continue;
            const otherX = other.dematerializing ? other.demTargetX : other.x;
            const otherY = other.dematerializing ? other.demTargetY : other.y;
            const dist = Math.hypot(b.x - otherX, b.y - otherY);
            const minDist = (b.size + other.size) * 0.85;
            if (dist < minDist && dist > 0) {
              const pushDist = (minDist - dist) / 2;
              b.x += ((b.x - otherX) / dist) * pushDist;
              b.y += ((b.y - otherY) / dist) * pushDist;
            }
          }

          b.trail = [];
          b.materializing = true;
          b.materializeProgress = 0;
        }
        return;
      }

      if (b.materializing) {
        b.materializeProgress += dt;
        b.wingPhase += b.wingBaseSpeed * 0.4 * dt;

        const progress = b.materializeProgress / MATERIALIZE_DURATION;
        drawMaterialize(b, Math.min(progress, 1));

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

      b.glideTimer -= dt;
      if (b.glideTimer <= 0) {
        b.gliding = !b.gliding;
        b.glideTimer = b.gliding ? (80 + Math.random() * 180) : (40 + Math.random() * 100);
        b.wingSpeed = b.gliding ? b.wingBaseSpeed * 0.3 : b.wingBaseSpeed;
      }

      b.wingPhase += b.wingSpeed * dt;

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

      const friction = Math.pow(b.gliding ? 0.992 : 0.975, dt);
      b.vx *= friction;
      b.vy *= friction;

      const maxSpd = b.gliding ? b.speed * 0.35 : b.speed;
      const spd = Math.hypot(b.vx, b.vy);
      if (spd > maxSpd) {
        const scale = maxSpd / spd;
        b.vx *= scale;
        b.vy *= scale;
      }

      b.x += b.vx * dt;
      b.y += b.vy * dt;

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

          if (dist < minDist * 0.5) {
            const overlap = (minDist * 0.5 - dist) * 0.3;
            b.x -= (dx / dist) * overlap * dt;
            b.y -= (dy / dist) * overlap * dt;
          }
        }
      });

      const margin = pad;
      const cw = canvas.width;
      const ch = canvas.height;
      const steer = 0.04 * dt;
      if (b.x < margin) { b.vx += steer; b.x = margin; }
      if (b.x > cw - margin) { b.vx -= steer; b.x = cw - margin; }
      if (b.y < margin) { b.vy += steer; b.y = margin; }
      if (b.y > ch - margin) { b.vy -= steer; b.y = ch - margin; }

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

      b.targetRotation = Math.atan2(b.vy, b.vx) + Math.PI / 2;
      b.rotation = lerpAngle(b.rotation, b.targetRotation, 0.06 * dt);

      b.trail.unshift({ x: b.x, y: b.y });
      if (b.trail.length > b.maxTrailLength) b.trail.pop();

      drawTrail(b);
      drawButterflyFill(b);
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