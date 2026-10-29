"use client";

import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { failed: boolean; message: string };

export default class SceneBoundary extends Component<Props, State> {
  state: State = { failed: false, message: "" };

  static getDerivedStateFromError(e: unknown): State {
    return { failed: true, message: e instanceof Error ? e.message : String(e) };
  }

  componentDidCatch(e: unknown) {
    console.error("Model viewer hatası:", e);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
          <p className="mono-label text-xs text-red-400">MODEL COULD NOT BE LOADED</p>
          <p className="max-w-md break-all text-xs text-white/70">{this.state.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}