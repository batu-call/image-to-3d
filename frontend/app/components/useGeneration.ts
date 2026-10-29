"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createImageJob, getJob, type JobState } from "../lib/api";

export type RunStatus = "idle" | "running" | "done" | "error";

export function useGeneration() {
  const [status, setStatus] = useState<RunStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const runId = useRef(0);

  useEffect(() => {
    return () => {
      runId.current++;
    };
  }, []);

  const reset = useCallback(() => {
    runId.current++;
    setStatus("idle");
    setProgress(0);
    setModelUrl(null);
    setError(null);
  }, []);

  const run = useCallback(async (file: File, quality: string) => {
    const my = ++runId.current;
    const alive = () => runId.current === my;

    setStatus("running");
    setProgress(0);
    setModelUrl(null);
    setError(null);

    // Yüzde artık backend'den geliyor (geri gitmesin diye max alınır)
    const apply = (job: JobState) => {
      if (job.progress !== undefined) {
        const value = job.progress;
        setProgress((p) => Math.max(p, value));
      }
    };

    try {
      let job = await createImageJob(file, quality);
      if (!alive()) return;
      apply(job);

      while (job.status === "running") {
        if (!job.id) throw new Error("Backend iş numarası döndürmedi");
        await new Promise((r) => setTimeout(r, 1000));
        if (!alive()) return;
        job = await getJob(job.id);
        if (!alive()) return;
        apply(job);
      }

      if (job.status === "error") throw new Error(job.error);

      setProgress(100);
      setModelUrl(job.modelUrl ?? null);
      setStatus("done");
    } catch (e) {
      if (!alive()) return;
      setError(e instanceof Error ? e.message : "Bilinmeyen hata");
      setStatus("error");
    }
  }, []);

  return { status, progress, modelUrl, error, run, reset };
}