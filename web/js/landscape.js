// Shared rendering toys: the 2-D objective landscapes, a clean topographic
// "depth map" renderer (dark basins = low/good, contour lines for legibility),
// pixel <-> domain mapping, easing, and small drawing helpers. No dependencies.

export const TWO_PI = Math.PI * 2;
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

// f: R^2 -> R, minimized. Low = good. Each carries its own box and optimum.
export const FUNCS = {
  rastrigin: {
    label: "Rastrigin", lo: -5.12, hi: 5.12, opt: [0, 0],
    f: (x, y) => 20 + (x * x - 10 * Math.cos(TWO_PI * x)) + (y * y - 10 * Math.cos(TWO_PI * y)),
    blurb: "highly multimodal, ~10^d minima",
  },
  ackley: {
    label: "Ackley", lo: -5, hi: 5, opt: [0, 0],
    f: (x, y) => {
      const s1 = x * x + y * y, s2 = Math.cos(TWO_PI * x) + Math.cos(TWO_PI * y);
      return -20 * Math.exp(-0.2 * Math.sqrt(s1 / 2)) - Math.exp(s2 / 2) + 20 + Math.E;
    },
    blurb: "flat outer plateau, central funnel",
  },
  himmelblau: {
    label: "Himmelblau", lo: -5, hi: 5, opt: [3, 2],
    f: (x, y) => Math.pow(x * x + y - 11, 2) + Math.pow(x + y * y - 7, 2),
    blurb: "four equal global optima",
  },
  rosenbrock: {
    label: "Rosenbrock", lo: -2, hi: 2, opt: [1, 1],
    f: (x, y) => 100 * Math.pow(y - x * x, 2) + Math.pow(1 - x, 2),
    blurb: "ill-conditioned curved valley",
  },
  sphere: {
    label: "Sphere", lo: -5, hi: 5, opt: [0, 0],
    f: (x, y) => x * x + y * y, blurb: "convex, unimodal",
  },
};

export function makeMapper(fn, W, H) {
  const { lo, hi } = fn, span = hi - lo;
  return {
    toPx: (x, y) => [((x - lo) / span) * W, H - ((y - lo) / span) * H],
    toDom: (px, py) => [lo + (px / W) * span, lo + ((H - py) / H) * span],
    lo, hi, span,
  };
}

// Topographic depth map: dark = low (good basin), light = high, with crisp
// iso-contours. Calm and low-saturation so the bright agents read clearly.
export function renderLandscape(fn, W, H) {
  const off = document.createElement("canvas");
  off.width = W; off.height = H;
  const ctx = off.getContext("2d");
  const img = ctx.createImageData(W, H);
  const { lo, hi } = fn, span = hi - lo;
  const BANDS = 11;

  let vmin = Infinity, vmax = -Infinity;
  for (let py = 0; py < H; py += 2)
    for (let px = 0; px < W; px += 2) {
      const v = Math.log1p(Math.max(0, fn.f(lo + (px / W) * span, lo + ((H - py) / H) * span)));
      if (v < vmin) vmin = v; if (v > vmax) vmax = v;
    }
  const rng = vmax - vmin || 1;
  // deep (good) -> shallow (bad): navy to cool slate, faint warm tint up high.
  const deep = [9, 16, 33], shallow = [104, 120, 150];

  for (let py = 0; py < H; py++)
    for (let px = 0; px < W; px++) {
      const v = Math.log1p(Math.max(0, fn.f(lo + (px / W) * span, lo + ((H - py) / H) * span)));
      const t = (v - vmin) / rng;
      let r = lerp(deep[0], shallow[0], t) + 28 * Math.max(0, t - 0.6);
      let g = lerp(deep[1], shallow[1], t);
      let b = lerp(deep[2], shallow[2], t);
      // iso-contour lines at band boundaries
      const band = (t * BANDS) % 1;
      const edge = Math.min(band, 1 - band);
      if (edge < 0.045) { const k = 1.5; r *= k; g *= k; b *= k; }
      const idx = (py * W + px) * 4;
      img.data[idx] = Math.min(255, r); img.data[idx + 1] = Math.min(255, g);
      img.data[idx + 2] = Math.min(255, b); img.data[idx + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);

  // soft vignette for depth
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
  vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.28)");
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

  // mark global optima with a crisp white target + label
  const map = makeMapper(fn, W, H);
  const opts = fn.label === "Himmelblau"
    ? [[3, 2], [-2.805, 3.131], [-3.779, -3.283], [3.584, -1.848]] : [fn.opt];
  ctx.save();
  for (const [ox0, oy0] of opts) {
    const [ox, oy] = map.toPx(ox0, oy0);
    ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(ox, oy, 9, 0, TWO_PI); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ox - 14, oy); ctx.lineTo(ox - 5, oy); ctx.moveTo(ox + 5, oy); ctx.lineTo(ox + 14, oy);
    ctx.moveTo(ox, oy - 14); ctx.lineTo(ox, oy - 5); ctx.moveTo(ox, oy + 5); ctx.lineTo(ox, oy + 14); ctx.stroke();
  }
  const [lx, ly] = map.toPx(opts[0][0], opts[0][1]);
  tag(ctx, "global optimum  x★", lx + 14, ly - 14, "rgba(255,255,255,0.9)", "#0a0f1a");
  ctx.restore();
  return off;
}

// pill label
export function tag(ctx, text, x, y, bg, fg) {
  ctx.save();
  ctx.font = "600 11px ui-monospace, monospace";
  const w = ctx.measureText(text).width + 12;
  const cw = ctx.canvas.width / (window.devicePixelRatio || 1);
  if (x + w > cw) x -= w + 18;
  if (y < 12) y += 24;
  ctx.fillStyle = bg; roundRect(ctx, x, y - 11, w, 17, 5); ctx.fill();
  ctx.fillStyle = fg; ctx.textBaseline = "middle"; ctx.fillText(text, x + 6, y - 2);
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function setupCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const W = Math.max(320, Math.floor(rect.width));
  const H = Math.max(380, Math.floor(rect.height || 400));
  canvas.width = W * dpr; canvas.height = H * dpr;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, W, H };
}

export function rngFrom(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function gauss(rand) {
  let u = 0, v = 0;
  while (u === 0) u = rand(); while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TWO_PI * v);
}
