// The hook. A 1-D bumpy landscape, drawn ONCE as a clear static figure. Several
// points start at fixed spots and do pure greedy descent; each trail is colored
// by where it ends up. Only the few that start inside the global basin (green)
// reach the true bottom; the rest settle into whichever local dip they were
// nearest (red). That stuck-ness is the whole reason metaheuristics exist.
import { setupCanvas, tag } from "./landscape.js";

const LO = -4.2, HI = 5.2;
// A hand-tuned wiggle with several dips of different depths.
function f(x) {
  return 0.85 * Math.cos(1.7 * x) + 0.5 * Math.cos(3.6 * x + 1.1)
       + 0.32 * Math.cos(6.1 * x + 0.4) + 0.09 * x * x - 0.15 * x;
}
function grad(x) { const h = 1e-3; return (f(x + h) - f(x - h)) / (2 * h); }

// find global min by dense scan
let GX = LO, GMIN = Infinity;
for (let x = LO; x <= HI; x += 0.001) { const v = f(x); if (v < GMIN) { GMIN = v; GX = x; } }

// Greedy descent from x0: return the resting point and the path it took.
function descend(x0) {
  let x = x0;
  const path = [x];
  for (let s = 0; s < 800; s++) {
    const gx = grad(x);
    if (Math.abs(gx) < 1e-4) break;
    x = Math.max(LO, Math.min(HI, x - 0.05 * Math.sign(gx) * Math.min(1, Math.abs(gx) + 0.3)));
    if (s % 3 === 0) path.push(x);
  }
  path.push(x);
  return { rest: x, path };
}

// Fixed start positions — the story is the same every render.
const STARTS = Array.from({ length: 13 }, (_, i) => LO + 0.35 + (i + 0.5) / 13 * (HI - LO - 0.7));

export function mountTrap(root) {
  root.innerHTML = "";
  const head = document.createElement("div"); head.className = "demo-head";
  head.innerHTML = `<span class="title">greedy descent lands in the nearest basin, not the deepest</span><span class="stat" id="ts">·</span>`;
  const stat = head.querySelector("#ts");
  const cw = document.createElement("div"); cw.className = "canvas-wrap solo";
  const canvas = document.createElement("canvas"); cw.appendChild(canvas);
  root.appendChild(head); root.appendChild(cw);

  let ctx, W, H;
  const PADX = 16, PADT = 24, PADB = 30;

  function ymm() {
    let lo = Infinity, hi = -Infinity;
    for (let x = LO; x <= HI; x += 0.01) { const v = f(x); lo = Math.min(lo, v); hi = Math.max(hi, v); }
    return [lo - 0.2, hi + 0.2];
  }
  let YLO, YHI;
  const X2 = (x) => PADX + ((x - LO) / (HI - LO)) * (W - 2 * PADX);
  const Y2 = (y) => PADT + (1 - (y - YLO) / (YHI - YLO)) * (H - PADT - PADB);

  function draw() {
    const d = setupCanvas(canvas); ctx = d.ctx; W = d.W; H = d.H;
    [YLO, YHI] = ymm();
    ctx.clearRect(0, 0, W, H);

    // fill under the curve with a cool gradient
    const g = ctx.createLinearGradient(0, PADT, 0, H - PADB);
    g.addColorStop(0, "rgba(40,175,140,0.10)");
    g.addColorStop(1, "rgba(16,52,99,0.35)");
    ctx.beginPath(); ctx.moveTo(X2(LO), H - PADB);
    for (let x = LO; x <= HI; x += 0.02) ctx.lineTo(X2(x), Y2(f(x)));
    ctx.lineTo(X2(HI), H - PADB); ctx.closePath(); ctx.fillStyle = g; ctx.fill();

    // the curve
    ctx.strokeStyle = "#7fd4c4"; ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let x = LO; x <= HI; x += 0.02) { const px = X2(x), py = Y2(f(x)); x === LO ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }
    ctx.stroke();

    // run every descent, bucket by resting basin so stacked balls don't overlap
    const runs = STARTS.map((x0) => { const r = descend(x0); return { ...r, found: Math.abs(r.rest - GX) < 0.25 }; });
    const buckets = new Map();
    for (const r of runs) { const key = Math.round(r.rest / 0.25); (buckets.get(key) || buckets.set(key, []).get(key)).push(r); }

    // faint descent trails first (under the markers)
    for (const r of runs) {
      ctx.strokeStyle = r.found ? "rgba(86,211,100,0.40)" : "rgba(255,123,114,0.34)";
      ctx.lineWidth = 1.5; ctx.beginPath();
      r.path.forEach((x, i) => { const px = X2(x), py = Y2(f(x)); i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); });
      ctx.stroke();
    }

    // start markers (gray, hollow) at each release point
    for (const r of runs) {
      const px = X2(r.path[0]), py = Y2(f(r.path[0]));
      ctx.strokeStyle = "rgba(154,166,178,0.85)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI * 2); ctx.stroke();
    }

    // the real bottom
    const gx = X2(GX), gy = Y2(GMIN);
    ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(gx, gy, 8, 0, Math.PI * 2); ctx.stroke();
    tag(ctx, "global minimum", gx + 12, gy + 2, "rgba(255,255,255,0.92)", "#0c1320");

    // resting balls, fanned out within each basin so the count is legible
    for (const group of buckets.values()) {
      group.forEach((r, i) => {
        const off = (i - (group.length - 1) / 2) * 11;
        const px = X2(r.rest) + off, py = Y2(f(r.rest)) - 6;
        ctx.fillStyle = r.found ? "#56d364" : "#ff7b72";
        ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.4)"; ctx.shadowBlur = 4;
        ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      });
    }

    const found = runs.filter((r) => r.found).length;
    stat.textContent = `${found} of ${runs.length} starts reached the global minimum`;
  }

  let rt; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(draw, 200); });
  draw();
}
