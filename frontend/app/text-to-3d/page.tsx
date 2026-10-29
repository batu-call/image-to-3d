"use client";

import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import PreviewPanel from "../components/PreviewPanel";
import GeneratingScene from "../components/GeneratingScene";
import { useFakeRun } from "../components/useFakeRun";

const EXAMPLES = [
  "Black marble statue with golden cracks",
  "Futuristic sneaker with neon green details",
  "Small dragon sitting on a rock",
  "Modern leather armchair",
];

const STYLES = ["Realistic", "Stylized", "Sculpture", "Low Poly"];
const MAX = 400;

// useFakeRun progress değeri 0-1 arası dönüyorsa bunu 100 yap
const PROGRESS_SCALE = 1;

export default function TextTo3DPage() {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("Realistic");
  const { status, progress, start, reset } = useFakeRun();

  // iş bitince sahne %100'de kısa süre kalsın, sonra sonuç gösterilsin
  const [prevStatus, setPrevStatus] = useState(status);
  const [holding, setHolding] = useState(false);
  if (status !== prevStatus) {
    setPrevStatus(status);
    if (prevStatus === "running" && status !== "running" && status !== "idle") {
      setHolding(true);
    }
  }

  useEffect(() => {
    if (!holding) return;
    const id = setTimeout(() => setHolding(false), 1400);
    return () => clearTimeout(id);
  }, [holding]);

  const showScene = status === "running" || holding;
  const scenePct = holding ? 100 : progress * PROGRESS_SCALE;

  return (
    <main className="min-h-screen bg-ink">
      <Navbar />

      <section className="px-6 pb-16 pt-6 md:px-12">
        <div className="mono-label mb-4 flex items-center gap-3 text-xs font-bold text-lime">
          [ TEXT TO 3D ]
          <span className="h-px w-32 bg-lime/40" />
        </div>
        <h1 className="display-tight mb-4 text-[44px] text-cream md:text-[64px]">
          Text to <span className="text-lime">3D</span>
        </h1>
        <p className="mb-10 max-w-lg text-[16px] leading-relaxed text-white/85">
          Describe what you imagine and watch it become a 3D object.
        </p>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Sol: prompt */}
          <div className="flex flex-col gap-6">
            <div className="rounded-2xl border border-line bg-panel p-5 focus-within:border-lime/60">
              <textarea
                value={prompt}
                maxLength={MAX}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  if (status !== "idle") {
                    setHolding(false);
                    reset();
                  }
                }}
                placeholder="A black marble statue with glowing golden cracks..."
                className="h-44 w-full resize-none bg-transparent text-[15px] leading-relaxed text-white outline-none placeholder:text-white/30"
              />
              <div className="mono-label mt-2 text-right text-[11px] text-muted">
                {prompt.length} / {MAX}
              </div>
            </div>

            <div>
              <p className="mono-label mb-3 text-[11px] text-muted">TRY AN EXAMPLE</p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => {
                      setPrompt(ex);
                      setHolding(false);
                      reset();
                    }}
                    className="rounded-full border border-line px-4 py-2 text-[12px] text-white/90 transition hover:border-lime hover:text-lime"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mono-label mb-3 text-[11px] text-muted">STYLE</p>
              <div className="flex flex-wrap gap-3">
                {STYLES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStyle(s)}
                    className={`rounded-[3px] border px-4 py-2.5 text-[12px] font-medium uppercase tracking-wide transition ${
                      style === s
                        ? "border-lime bg-lime/10 text-lime"
                        : "border-line text-white hover:border-white/40"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              disabled={prompt.trim().length < 3 || status === "running" || holding}
              onClick={start}
              className="flex items-center justify-center gap-3 rounded-[3px] bg-lime px-6 py-4 text-[13px] font-bold uppercase tracking-wide text-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {status === "running" ? "Generating..." : "Generate 3D Model"}
              <span aria-hidden>→</span>
            </button>
          </div>

          {/* Sağ: üretim animasyonu, bitince önizleme */}
          {showScene ? (
            <GeneratingScene progress={scenePct} imageUrl={null} />
          ) : (
            <PreviewPanel
              status={status}
              progress={progress}
              idleText="DESCRIBE YOUR IDEA TO START"
            />
          )}
        </div>
      </section>
    </main>
  );
}