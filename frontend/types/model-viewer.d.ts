import type { DetailedHTMLProps, HTMLAttributes } from "react";

interface ModelViewerAttributes extends HTMLAttributes<HTMLElement> {
  src?: string;
  poster?: string;
  alt?: string;
  "camera-controls"?: boolean | string;
  "auto-rotate"?: boolean | string;
  "rotation-per-second"?: string;
  "shadow-intensity"?: string;
  exposure?: string;
  "environment-image"?: string;
  "interaction-prompt"?: string;
}

type ModelViewerJSX = DetailedHTMLProps<ModelViewerAttributes, HTMLElement>;

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": ModelViewerJSX;
    }
  }
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": ModelViewerJSX;
    }
  }
}

export {};