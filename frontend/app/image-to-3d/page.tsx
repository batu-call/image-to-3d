"use client";

import { useEffect, useRef, useState } from "react";
import Navbar from "../components/Navbar";
import PreviewPanel from "../components/PreviewPanel";
import GeneratingScene from "../components/GeneratingScene";
import { useGeneration } from "../components/useGeneration";

const QUALITY = ["Standard", "High", "Ultra"];

// useGeneration progress değeri 0-1 arası dönüyorsa bunu 100 yap
const PROGRESS_SCALE = 1;

export default function ImageTo3DPage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [quality, setQuality] = useState("High");
  const inputRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<string | null>(null);
  const { status, progress, modelUrl, error, run, reset } = useGeneration();

  // iş bitince sahne %100'de kısa süre kalsın, sonra model gösterilsin
  const [prevStatus, setPrevStatus] = useState(status);
  const [holding, setHolding] = useState(false);
  if (status !== prevStatus) {
    setPrevStatus(status);
    if (prevStatus === "running" && status !== "running" && !error) {
      setHolding(true);
    }
  }

  useEffect(() => {
    if (!holding) return;
    const id = setTimeout(() => setHolding(false), 1400);
    return () => clearTimeout(id);
  }, [holding]);

  // sayfadan çıkarken son adresi serbest bırak
  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  function setImage(f: File | null) {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const url = f ? URL.createObjectURL(f) : null;
    urlRef.current = url;
    setFile(f);
    setPreviewUrl(url);
    setHolding(false);
    reset();
  }

  function pick(f: File | undefined) {
    if (f && f.type.startsWith("image/")) setImage(f);
  }

  function clearFile() {
    setImage(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const showScene = status === "running" || holding;
  const scenePct = holding ? 100 : progress * PROGRESS_SCALE;

  return (
    <main className="min-h-screen bg-ink">
      <Navbar />

      <section className="px-6 pb-16 pt-6 md:px-12">
        <div className="mono-label mb-4 flex items-center gap-3 text-xs font-bold text-lime">
          [ IMAGE TO 3D ]
          <span className="h-px w-32 bg-lime/40" />
        </div>
        <h1 className="display-tight mb-4 text-[44px] text-cream md:text-[64px]">
          Image to <span className="text-lime">3D</span>
        </h1>
        <p className="mb-10 max-w-lg text-[16px] leading-relaxed text-white/85">
          Upload any image and turn it into a high-quality 3D model in seconds.
        </p>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Sol: yükleme */}
          <div className="flex flex-col gap-6">
            <div
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                pick(e.dataTransfer.files[0]);
              }}
              className={`relative flex min-h-[320px] cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed bg-panel transition ${
                dragging ? "border-lime bg-lime/5" : "border-line hover:border-lime/60"
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => pick(e.target.files?.[0])}
              />

              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Yüklenen görsel"
                  className="max-h-[320px] w-full object-contain p-4"
                />
              ) : (
                <div className="px-6 text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-lime text-2xl text-lime">
                    ↑
                  </div>
                  <p className="text-[15px] font-medium text-white">
                    Drop your image here
                  </p>
                  <p className="mono-label mt-2 text-[11px] text-muted">
                    PNG, JPG, WEBP · MAX 10MB
                  </p>
                </div>
              )}
            </div>

            {file && (
              <div className="flex items-center justify-between rounded-xl border border-line bg-white/[0.04] px-4 py-3">
                <span className="truncate text-sm text-white">{file.name}</span>
                <button
                  type="button"
                  onClick={clearFile}
                  className="ml-4 text-xs uppercase tracking-wide text-muted hover:text-lime"
                >
                  Remove
                </button>
              </div>
            )}

            <div>
              <p className="mono-label mb-3 text-[11px] text-muted">QUALITY</p>
              <div className="flex gap-3">
                {QUALITY.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setQuality(q)}
                    className={`rounded-[3px] border px-4 py-2.5 text-[12px] font-medium uppercase tracking-wide transition ${
                      quality === q
                        ? "border-lime bg-lime/10 text-lime"
                        : "border-line text-white hover:border-white/40"
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              disabled={!file || status === "running" || holding}
              onClick={() => file && run(file, quality)}
              className="flex items-center justify-center gap-3 rounded-[3px] bg-lime px-6 py-4 text-[13px] font-bold uppercase tracking-wide text-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {status === "running" ? "Generating..." : "Generate 3D Model"}
              <span aria-hidden>→</span>
            </button>
          </div>

      
          {showScene ? (
            <GeneratingScene progress={scenePct} imageUrl={previewUrl} />
          ) : (
            <PreviewPanel
              status={status}
              progress={progress}
              modelUrl={modelUrl}
              error={error}
              idleText="UPLOAD AN IMAGE TO START"
            />
          )}
        </div>
      </section>
    </main>
  );
}