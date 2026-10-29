"use client";

import dynamic from "next/dynamic";
import SceneBoundary from "./SceneBoundary";

const ModelViewer = dynamic(() => import("./GlbViewer"), { ssr: false });

type RunStatus = "idle" | "running" | "done" | "error";

type Props = {
  status: RunStatus;
  progress: number;
  modelUrl?: string | null;
  error?: string | null;
  idleText: string;
};

const FORMATS = ["GLB", "OBJ", "STL"];

export default function PreviewPanel({
  status,
  progress,
  modelUrl = null,
  error = null,
  idleText,
}: Props) {
  const pct = Math.round(progress);

  function download() {
    if (!modelUrl) return;
    const a = document.createElement("a");
    a.href = modelUrl;
    a.download = "model.glb";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div className="relative flex min-h-[420px] flex-col overflow-hidden rounded-2xl border border-line bg-panel">
      <span
        aria-hidden
        className="absolute right-0 top-0 z-10 h-6 w-9 rounded-tr-2xl border-r-2 border-t-2 border-lime"
      />

      <div
        aria-hidden
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(rgba(200,255,46,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(200,255,46,0.12) 1px, transparent 1px)",
          backgroundSize: "36px 36px",
        }}
      />
      <div
        aria-hidden
        className="absolute left-1/2 top-0 h-2/3 w-24 -translate-x-1/2 bg-lime/10 blur-3xl"
      />

      <div className="relative flex flex-1 items-center justify-center">
        {status === "idle" && (
          <div className="p-8 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-line text-2xl text-lime">
              ◇
            </div>
            <p className="mono-label text-xs text-muted">{idleText}</p>
          </div>
        )}

        {status === "running" && (
          <div className="w-full max-w-xs p-8 text-center">
            <div className="mx-auto mb-6 h-16 w-16 animate-spin rounded-full border-2 border-line border-t-lime" />
            <p className="mono-label mb-3 text-xs text-lime">
              GENERATING... {pct}%
            </p>
            <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-lime transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="p-8 text-center">
            <p className="mono-label mb-2 text-xs text-red-400">
              GENERATION FAILED
            </p>
            <p className="max-w-xs text-sm text-white/80">{error}</p>
          </div>
        )}

        {status === "done" && modelUrl && (
          <div className="absolute inset-0">
            <SceneBoundary key={modelUrl}>
              <ModelViewer url={modelUrl} />
            </SceneBoundary>
          </div>
        )}

        {status === "done" && !modelUrl && (
          <div className="p-8 text-center">
            <p className="mono-label text-xs text-lime">MODEL READY</p>
          </div>
        )}
      </div>

      <div className="relative flex items-center justify-between border-t border-line px-5 py-4">
        <div className="flex gap-2">
          {FORMATS.map((f) => (
            <span
              key={f}
              className={`mono-label rounded-[3px] border px-2.5 py-1 text-[11px] ${
                status === "done" && f === "GLB"
                  ? "border-lime text-lime"
                  : "border-line text-muted"
              }`}
            >
              {f}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={download}
          disabled={status !== "done" || !modelUrl}
          className="rounded-[3px] bg-lime px-4 py-2 text-[12px] font-bold uppercase tracking-wide text-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-30"
        >
          Download
        </button>
      </div>
    </div>
  );
}