"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RunStatus = "idle" | "running" | "done";

export function useFakeRun(duration = 6000) {
  const [status, setStatus] = useState<RunStatus>("idle");
  const [progress, setProgress] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const clear = useCallback(() => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  const start = useCallback(() => {
    clear();
    setStatus("running");
    setProgress(0);
    const t0 = Date.now();
    timer.current = setInterval(() => {
      const p = Math.min(100, Math.round(((Date.now() - t0) / duration) * 100));
      setProgress(p);
      if (p >= 100) {
        clear();
        setStatus("done");
      }
    }, 100);
  }, [clear, duration]);

  const reset = useCallback(() => {
    clear();
    setStatus("idle");
    setProgress(0);
  }, [clear]);

  useEffect(() => clear, [clear]);

  return { status, progress, start, reset };
}