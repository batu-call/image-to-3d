"use client";

import { Suspense, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import {
  Bounds,
  Center,
  Environment,
  Lightformer,
  OrbitControls,
  useGLTF,
} from "@react-three/drei";

type Check =
  | { state: "loading" }
  | { state: "ok"; src: string }
  | { state: "error"; message: string };

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return (
    <Bounds fit clip observe margin={1.4}>
      <Center>
        <primitive object={scene} />
      </Center>
    </Bounds>
  );
}

// url değişince iç bileşen baştan mount edilir, state kendiliğinden sıfırlanır
export default function GlbViewer({ url }: { url: string }) {
  return <GlbViewerInner key={url} url={url} />;
}

function GlbViewerInner({ url }: { url: string }) {
  const [check, setCheck] = useState<Check>({ state: "loading" });

  // dosyayı indir, gerçekten GLB mi doğrula, blob adresi üret
  useEffect(() => {
    let dead = false;
    let blobUrl: string | null = null;

    (async () => {
      try {
        const res = await fetch(url, { cache: "no-store" });
        const type = res.headers.get("content-type") ?? "bilinmiyor";
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} (${type}) - ${url}`);
        }
        const buf = await res.arrayBuffer();
        const magic = new TextDecoder().decode(new Uint8Array(buf, 0, 4));
        if (magic !== "glTF") {
          throw new Error(
            `Dosya GLB değil (Content-Type: ${type}, boyut: ${buf.byteLength} bayt) - ${url}`
          );
        }
        if (dead) return; // bileşen kapandıysa blob üretme
        blobUrl = URL.createObjectURL(
          new Blob([buf], { type: "model/gltf-binary" })
        );
        setCheck({ state: "ok", src: blobUrl });
      } catch (e) {
        if (!dead)
          setCheck({
            state: "error",
            message: e instanceof Error ? e.message : "Bilinmeyen hata",
          });
      }
    })();

    return () => {
      dead = true;
      if (blobUrl) {
        const u = blobUrl;
        setTimeout(() => {
          URL.revokeObjectURL(u);
          useGLTF.clear(u);
        }, 1000);
      }
    };
  }, [url]);

  if (check.state === "loading") {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="mono-label text-xs text-lime">LOADING MODEL...</p>
      </div>
    );
  }

  if (check.state === "error") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="mono-label text-xs text-red-400">MODEL COULD NOT BE LOADED</p>
        <p className="max-w-md break-all text-xs text-white/70">{check.message}</p>
      </div>
    );
  }

  return (
    <Canvas
      camera={{ position: [0, 0.5, 4], fov: 35 }}
      gl={{ alpha: true }}
      dpr={[1, 2]}
    >
      <hemisphereLight intensity={0.9} groundColor="#222222" />
      <ambientLight intensity={0.4} />
      <directionalLight position={[3, 4, 3]} intensity={2} />
      <directionalLight position={[-3, 2, -3]} intensity={1.5} color="#c8ff2e" />
      <Suspense fallback={null}>
        {/* yerel ortam ışığı, internetten HDR çekmez */}
        <Environment resolution={256} environmentIntensity={0.6}>
          <Lightformer form="rect" intensity={2} position={[0, 5, -6]} scale={[10, 4, 1]} />
          <Lightformer form="rect" intensity={1.5} position={[-5, 1, 2]} scale={[4, 6, 1]} />
          <Lightformer form="rect" intensity={1.5} position={[5, 1, 2]} scale={[4, 6, 1]} />
        </Environment>
        <Model key={check.src} url={check.src} />
      </Suspense>
      <OrbitControls
        makeDefault
        enablePan={false}
        autoRotate
        autoRotateSpeed={1.2}
      />
    </Canvas>
  );
}