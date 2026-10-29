"use client";

import { useEffect, useRef } from "react";

type Props = {
  /** 0-100 arası ilerleme */
  progress: number;
  /** Yüklenen görselin blob adresi. Yoksa yedek büst şekli kullanılır. */
  imageUrl?: string | null;
  className?: string;
};

type Target = { x: number; y: number; r: number; g: number; b: number; c: string };

type Particle = {
  rank: number;
  yellow: boolean;
  kind: 0 | 1;
  size: number;
  phase: number;
  r0: number;
  a0: number;
  dir: number;
  spin: number;
  ti: number;
  x: number;
  y: number;
  k: number;
  locked: boolean;
};

const N = 2800;
const S = 180; // örnekleme çözünürlüğü
const LIME = "200,255,46"; // tasarımdaki --color-lime
const C_LIME = [200, 255, 46];
const C_YELLOW = [255, 208, 40];
const FILL_LIME = "rgb(200,255,46)";
const FILL_YELLOW = "rgb(255,208,40)";

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function mkTarget(x: number, y: number, r: number, g: number, b: number): Target {
  return { x, y, r, g, b, c: `rgb(${r},${g},${b})` };
}

/** Yüklenen görselden ön plan piksellerini ve renklerini çıkarır. */
function fromImage(img: HTMLImageElement): Target[] {
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const g = c.getContext("2d", { willReadFrequently: true });
  if (!g || !img.width || !img.height) return [];

  const sc = Math.min(S / img.width, S / img.height);
  const w = Math.max(4, Math.round(img.width * sc));
  const h = Math.max(4, Math.round(img.height * sc));
  const ox = Math.floor((S - w) / 2);
  const oy = Math.floor((S - h) / 2);
  g.drawImage(img, ox, oy, w, h);
  const d = g.getImageData(0, 0, S, S).data;

  let transparent = 0;
  for (let y = oy; y < oy + h; y++)
    for (let x = ox; x < ox + w; x++)
      if (d[(y * S + x) * 4 + 3] < 200) transparent++;
  const hasAlpha = transparent > w * h * 0.03;

  const cornerIdx = [
    [ox + 1, oy + 1],
    [ox + w - 2, oy + 1],
    [ox + 1, oy + h - 2],
    [ox + w - 2, oy + h - 2],
  ].map(([x, y]) => (y * S + x) * 4);
  const bg = [0, 1, 2].map(
    (k) => cornerIdx.reduce((s, i) => s + d[i + k], 0) / 4
  );

  const out: Target[] = [];
  for (let y = oy; y < oy + h; y++) {
    for (let x = ox; x < ox + w; x++) {
      const i = (y * S + x) * 4;
      if (d[i + 3] < 80) continue;
      if (!hasAlpha) {
        const dist =
          Math.abs(d[i] - bg[0]) +
          Math.abs(d[i + 1] - bg[1]) +
          Math.abs(d[i + 2] - bg[2]);
        if (dist < 90) continue;
      }
      // koyu pikseller siyah zeminde kaybolmasın diye hafif aydınlat
      const lift = (v: number) => Math.min(255, Math.round(v * 1.12 + 10));
      out.push(
        mkTarget((x / S - 0.5) * 2, (y / S - 0.5) * 2, lift(d[i]), lift(d[i + 1]), lift(d[i + 2]))
      );
    }
  }
  return out;
}

/** Görsel yoksa ya da ön plan bulunamazsa: lime/sarı büst silueti. */
function bust(): Target[] {
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const g = c.getContext("2d", { willReadFrequently: true });
  if (!g) return [];
  g.fillStyle = "#fff";
  g.beginPath();
  g.ellipse(S / 2, S * 0.3, S * 0.12, S * 0.16, 0, 0, Math.PI * 2);
  g.fill();
  g.fillRect(S * 0.45, S * 0.42, S * 0.1, S * 0.1);
  g.beginPath();
  g.ellipse(S / 2, S * 0.95, S * 0.36, S * 0.4, 0, Math.PI, Math.PI * 2);
  g.fill();
  const d = g.getImageData(0, 0, S, S).data;
  const out: Target[] = [];
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++)
      if (d[(y * S + x) * 4 + 3] > 80) {
        const col = Math.random() < 0.5 ? C_LIME : C_YELLOW;
        const f = 0.55 + Math.random() * 0.45;
        out.push(
          mkTarget(
            (x / S - 0.5) * 2,
            (y / S - 0.5) * 2,
            Math.round(col[0] * f),
            Math.round(col[1] * f),
            Math.round(col[2] * f)
          )
        );
      }
  return out;
}

export default function GeneratingScene({
  progress,
  imageUrl,
  className = "",
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const progRef = useRef(progress);
  const targetsRef = useRef<Target[]>([]);

  useEffect(() => {
    progRef.current = progress;
  }, [progress]);

  // hedef şekil: yüklenen görselin silueti ve renkleri
  useEffect(() => {
    let dead = false;
    if (!imageUrl) {
      targetsRef.current = shuffle(bust());
      return;
    }
    const img = new Image();
    img.onload = () => {
      if (dead) return;
      let t: Target[] = [];
      try {
        t = fromImage(img);
      } catch {
        t = [];
      }
      if (t.length < 200) t = bust();
      targetsRef.current = shuffle(t);
    };
    img.onerror = () => {
      if (!dead) targetsRef.current = shuffle(bust());
    };
    img.src = imageUrl;
    return () => {
      dead = true;
    };
  }, [imageUrl]);

  // animasyon döngüsü
  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let raf = 0;
    let disp = 0;
    const t0 = performance.now();

    const resize = () => {
      const r = root.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width;
      h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(root);

    const ranks = shuffle(Array.from({ length: N }, (_, i) => i));
    const ps: Particle[] = ranks.map((rank) => ({
      rank,
      yellow: Math.random() < 0.5,
      kind: Math.random() < 0.6 ? 0 : 1,
      size: 2 + Math.random() * 2.6,
      phase: Math.random(),
      r0: 0.45 + Math.random() * 0.85,
      a0: Math.random() * Math.PI * 2,
      dir: Math.random() < 0.5 ? -1 : 1,
      spin: 0.7 + Math.random() * 0.9,
      ti: Math.floor(Math.random() * 1e6),
      x: 0,
      y: 0,
      k: 0,
      locked: false,
    }));
    ps.sort((a, b) => Number(a.yellow) - Number(b.yellow)); // renk gruplama

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (!w || !h) return;
      const t = (now - t0) / 1000;

      disp += (progRef.current - disp) * 0.05;
      if (Math.abs(progRef.current - disp) < 0.05) disp = progRef.current;
      const pr = clamp(disp / 100, 0, 1);

      const cx = w / 2;
      const cy = h * 0.46;
      const sc = Math.min(w, h) * 0.34;
      const maxR = Math.max(w, h) * 0.6;
      const psz = clamp(sc / 150, 0.7, 1.4);
      const count = Math.floor(clamp(pr * 1.03, 0, 1) * N);
      const tg = targetsRef.current;

      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";

      // çekirdek ışığı
      const coreA = (1 - pr * 0.75) * (0.75 + 0.25 * Math.sin(t * 3));
      const cr = 40 + 110 * (1 - pr * 0.5);
      const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr);
      gr.addColorStop(0, `rgba(255,250,200,${0.9 * coreA})`);
      gr.addColorStop(0.25, `rgba(${LIME},${0.35 * coreA})`);
      gr.addColorStop(1, `rgba(${LIME},0)`);
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.fill();

      // erken evre: dönen eğik halkalar
      const ringsA = 1 - smooth(0.35, 0.75, pr);
      ctx.lineWidth = 1.2;
      if (ringsA > 0.01) {
        for (let i = 0; i < 3; i++) {
          const rx = (70 + i * 28) * psz;
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(t * (0.5 + i * 0.35) * (i % 2 ? -1 : 1) + i);
          ctx.strokeStyle = `rgba(${LIME},${0.55 * ringsA})`;
          ctx.beginPath();
          ctx.ellipse(0, 0, rx, rx * 0.42, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }

      // geç evre: model etrafında halkalar ve tabanda dalgalar
      const haloA = smooth(0.3, 0.6, pr);
      if (haloA > 0.01) {
        for (let k = 0; k < 2; k++) {
          const y = cy + Math.sin(t * 0.8 + k * 3.1) * sc * 0.6;
          const rx = sc * (0.85 + k * 0.15);
          ctx.strokeStyle = `rgba(${LIME},${0.5 * haloA})`;
          ctx.beginPath();
          ctx.ellipse(cx, y, rx, rx * 0.2, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        const by = cy + sc * 0.95;
        const endBoost = 0.4 + 0.6 * smooth(0.7, 1, pr);
        for (let k = 0; k < 3; k++) {
          const ph = (t * 0.4 + k / 3) % 1;
          const rx = sc * (0.5 + 0.9 * ph);
          ctx.strokeStyle = `rgba(${LIME},${(1 - ph) * haloA * endBoost * 0.9})`;
          ctx.beginPath();
          ctx.ellipse(cx, by, rx, rx * 0.22, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // 1. geçiş: akan parçacıklar (parlak, toplamalı karışım)
      let curFill = "";
      ctx.lineWidth = 1;
      for (const p of ps) {
        const want = p.rank < count;

        const cyc = (t * 0.11 * p.spin + p.phase) % 1;
        const r = p.r0 * maxR * (1 - cyc);
        const ang = p.a0 + cyc * 5 * p.dir + t * 0.25 * p.dir;
        const sx = cx + Math.cos(ang) * r;
        const sy = cy + Math.sin(ang) * r * 0.62;

        if (want && !p.locked) {
          p.locked = true;
          p.k = 0;
          p.x = sx;
          p.y = sy;
        } else if (!want && p.locked) {
          p.locked = false;
        }

        if (p.locked) {
          const T = tg.length ? tg[p.ti % tg.length] : null;
          p.x += ((T ? cx + T.x * sc : cx) - p.x) * 0.06;
          p.y += ((T ? cy + T.y * sc : cy) - p.y) * 0.06;
          p.k += (1 - p.k) * 0.05;
          continue;
        }

        const fill = p.yellow ? FILL_YELLOW : FILL_LIME;
        if (fill !== curFill) {
          ctx.fillStyle = fill;
          ctx.strokeStyle = fill;
          curFill = fill;
        }
        const a = clamp(cyc * 6, 0, 1) * clamp((1 - cyc) * 3 + 0.2, 0, 1) * 0.9;
        if (a > 0.1) {
          const c2 = Math.max(0, cyc - 0.03);
          const r2 = p.r0 * maxR * (1 - c2);
          const ang2 = p.a0 + c2 * 5 * p.dir + t * 0.25 * p.dir;
          ctx.globalAlpha = a * 0.35;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(ang2) * r2, cy + Math.sin(ang2) * r2 * 0.62);
          ctx.lineTo(sx, sy);
          ctx.stroke();
        }
        ctx.globalAlpha = a;
        const s = p.size * psz;
        if (p.kind === 0) {
          ctx.fillRect(sx - s / 2, sy - s / 2, s, s);
        } else {
          ctx.beginPath();
          ctx.arc(sx, sy, s * 0.55, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 2. geçiş: oturan parçacıklar, görselin gerçek renkleriyle (normal karışım)
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 0.95;
      const ls = clamp(sc / 40, 2.6, 5.5);
      for (const p of ps) {
        if (!p.locked) continue;
        const T = tg.length ? tg[p.ti % tg.length] : null;
        const base = p.yellow ? C_YELLOW : C_LIME;
        if (T && p.k > 0.97) {
          ctx.fillStyle = T.c;
        } else {
          const to = T ? [T.r, T.g, T.b] : base;
          const k = p.k;
          ctx.fillStyle = `rgb(${Math.round(base[0] + (to[0] - base[0]) * k)},${Math.round(
            base[1] + (to[1] - base[1]) * k
          )},${Math.round(base[2] + (to[2] - base[2]) * k)})`;
        }
        const x = p.x + Math.sin(t * 1.7 + p.phase * 20) * 0.6;
        const y = p.y + Math.cos(t * 1.3 + p.phase * 20) * 0.6;
        const s = ls * (0.85 + 0.3 * p.phase);
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
      }
      ctx.globalAlpha = 1;

      // sayaç ve durum yazısı
      const shown = Math.round(disp);
      if (numRef.current) numRef.current.textContent = `${shown}%`;
      if (labelRef.current) {
        labelRef.current.textContent =
          shown >= 100
            ? "FINALIZING MODEL"
            : shown >= 70
            ? "REFINING DETAILS"
            : shown >= 30
            ? "BUILDING MESH"
            : "GATHERING PARTICLES";
      }
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={`relative min-h-[420px] overflow-hidden rounded-2xl border border-line bg-panel ${className}`}
    >
      {/* perspektif grid */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(200,255,46,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(200,255,46,0.07) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage:
            "radial-gradient(ellipse at 50% 46%, black 10%, transparent 70%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at 50% 46%, black 10%, transparent 70%)",
        }}
      />
      <canvas ref={canvasRef} className="absolute inset-0" />

      <div className="pointer-events-none absolute inset-x-0 bottom-6 flex flex-col items-center gap-3">
        <span ref={labelRef} className="mono-label text-[11px] text-lime">
          GATHERING PARTICLES
        </span>
        <div className="relative border border-white/15 bg-black/40 px-8 py-2">
          <span
            ref={numRef}
            className="block min-w-[4ch] text-center font-mono text-2xl font-bold tabular-nums text-white"
          >
            0%
          </span>
          <i className="absolute -left-px -top-px h-2 w-2 border-l border-t border-lime" />
          <i className="absolute -right-px -top-px h-2 w-2 border-r border-t border-lime" />
          <i className="absolute -bottom-px -left-px h-2 w-2 border-b border-l border-lime" />
          <i className="absolute -bottom-px -right-px h-2 w-2 border-b border-r border-lime" />
        </div>
      </div>
    </div>
  );
}