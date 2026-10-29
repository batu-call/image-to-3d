"use client";

import { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { useGLTF, OrbitControls, Environment, Float } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

// Heykelin sahnedeki hedef konumu (dünya koordinatları) ve ölçeği.
const STATUE_TARGET: [number, number, number] = [0.6, 0, 0];
const STATUE_SCALE = 3.2;
// Halkanın omuz/gövde kesim çizgisinden ne kadar yukarıda duracağı.
const RING_HEIGHT_FRACTION = 0.16;

/* ------------------------------------------------------------------ */
/* Prosedürel "çatlak siyah-altın" materyali (değişmedi)              */
/* ------------------------------------------------------------------ */
function useCrackedGoldMaterial() {
  return useMemo(() => {
    const material = new THREE.MeshStandardMaterial({
      color: "#111111",
      metalness: 0.4,
      roughness: 0.5,
      emissive: new THREE.Color("#000000"),
      emissiveIntensity: 1,
    });

    material.onBeforeCompile = (shader) => {
      material.userData.shader = shader;

      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>\nvarying vec3 vPosW;`)
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>\nvPosW = position;`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
          varying vec3 vPosW;

          float hash(vec3 p) {
            p = fract(p * 0.3183099 + 0.1);
            p *= 17.0;
            return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
          }

          float noise(vec3 x) {
            vec3 i = floor(x);
            vec3 f = fract(x);
            f = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
                  mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
              mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                  mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
              f.z
            );
          }

          float crackLines(vec3 p, float freq, float width) {
            float n = noise(p * freq);
            return 1.0 - smoothstep(0.0, width, abs(n - 0.5));
          }
          `
        )
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>

          float macro = crackLines(vPosW, 5.0, 0.012);
          float micro = crackLines(vPosW + 12.3, 13.0, 0.01) * 0.6;
          float scatter = smoothstep(0.3, 0.7, noise(vPosW * 3.5 + 4.0));
          float crack = clamp((macro + micro), 0.0, 1.0) * scatter;

          vec3 gold = vec3(1.0, 0.62, 0.1);
          totalEmissiveRadiance += gold * crack * 0.9;
          diffuseColor.rgb = mix(diffuseColor.rgb, gold * 0.45, crack * 0.8);
          `
        );
    };

    return material;
  }, []);
}

function useStatueLayout() {
  const { scene } = useGLTF("/models/statue.glb");
  const crackedMaterial = useCrackedGoldMaterial();

  return useMemo(() => {
    const cloned = scene.clone(true);
    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        (child as THREE.Mesh).material = crackedMaterial;
      }
    });

    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    const localCenter = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(localCenter);

    const [tx, ty, tz] = STATUE_TARGET;
    cloned.position.set(
      tx - STATUE_SCALE * localCenter.x,
      ty - STATUE_SCALE * localCenter.y,
      tz - STATUE_SCALE * localCenter.z
    );
    cloned.scale.setScalar(STATUE_SCALE);

    const worldBottomY = cloned.position.y + STATUE_SCALE * box.min.y;
    const worldWidth = STATUE_SCALE * Math.max(size.x, size.z);

    const ringY = worldBottomY + size.y * STATUE_SCALE * RING_HEIGHT_FRACTION;
    const ringRadius = (worldWidth / 2) * 1.35;

    return { model: cloned, ringY, ringRadius };
  }, [scene, crackedMaterial]);
}

function StatueWithRing() {
  const { model, ringY, ringRadius } = useStatueLayout();
  const [tx, , tz] = STATUE_TARGET;

  return (
    <>
      <primitive object={model} />
      <mesh rotation={[Math.PI / 2, 0.15, 0]} position={[tx, ringY, tz]}>
        <torusGeometry args={[ringRadius, 0.02, 32, 240]} />
        <meshStandardMaterial
          color="#ffb347"
          emissive="#ff9900"
          emissiveIntensity={0.6}
          metalness={1}
          roughness={0.25}
        />
      </mesh>
    </>
  );
}

/* Yumuşak yeşil ışık huzmesi.
   DÜZELTME: Eski gradient yarıçapı (cx * 0.95) canvas genişliğinden büyüktü,
   yani plane'in sol/sağ kenarında alfa hâlâ ~0.13 idi -> arka planda dikey,
   sert kenarlı açık bir şerit oluşuyordu. Şimdi gradient elipstir ve tam
   kenarlara varmadan alfa 0'a iner, hiçbir kenar görünmez. */
function GreenBeam() {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 1024;
    const ctx = canvas.getContext("2d")!;

    // Dikeyde 2x uzatılmış radyal gradient = dikey elips
    ctx.save();
    ctx.scale(1, 2);
    const cx = canvas.width / 2; // 256
    const cy = canvas.height / 4; // ölçekten sonra 512'ye denk gelir
    const radius = cx * 0.98; // yarıçap = yarım genişlik -> kenarda alfa 0
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    gradient.addColorStop(0, "rgba(182,255,46,0.5)");
    gradient.addColorStop(0.2, "rgba(182,255,46,0.38)");
    gradient.addColorStop(0.4, "rgba(182,255,46,0.22)");
    gradient.addColorStop(0.6, "rgba(182,255,46,0.1)");
    gradient.addColorStop(0.8, "rgba(182,255,46,0.03)");
    gradient.addColorStop(1, "rgba(182,255,46,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height / 2);
    ctx.restore();

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, []);

  return (
    <mesh position={[0.7, 0, -2.4]}>
      <planeGeometry args={[7, 11]} />
      <meshBasicMaterial
        map={texture}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

export default function HeroScene() {
  return (
    <Canvas
      // z: 5.0 -> 5.6. Sahne biraz uzaklaştı; halka artık üstten ve alttan kesilmiyor.
      camera={{ position: [0.3, 0.3, 5.6], fov: 38 }}
      gl={{ alpha: true, antialias: true }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1;
      }}
      dpr={[1, 2]}
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.2} />

        <spotLight
          position={[4, 3.5, -2]}
          intensity={6}
          color="#ffb347"
          angle={0.55}
          penumbra={0.9}
        />
        <spotLight
          position={[-3.5, 2, 3]}
          intensity={3.5}
          color="#c8ff2e"
          angle={0.6}
          penumbra={1}
        />
        <pointLight position={[0.6, -1.5, 1.5]} intensity={1.2} color="#ff9900" />
        {/* Küre yeni konuma taşındığı için yansıma ışığı da onunla birlikte taşındı */}
        <pointLight position={[-1.6, -0.2, 2.2]} intensity={3} color="#ffcf6b" />
        <Environment preset="sunset" environmentIntensity={0.3} />

        <GreenBeam />
        <StatueWithRing />

        {/* Altın küre: başlığın arkasından çıkarıldı, sol alta (boş alana) taşındı.
            Hem okunabilirliği düzeltir hem de kompozisyonun sağa ağır kalmasını dengeler. */}
        <Float speed={1.5} floatIntensity={0.6}>
          <mesh position={[-1.1, -0.75, 1.1]}>
            <sphereGeometry args={[0.28, 64, 64]} />
            <meshStandardMaterial color="#d4a017" metalness={1} roughness={0.1} />
          </mesh>
        </Float>

        <Float speed={1.2} floatIntensity={0.5}>
          <mesh position={[3.4, -0.1, -0.6]}>
            <icosahedronGeometry args={[0.42, 2]} />
            <meshBasicMaterial color="#999" wireframe />
          </mesh>
        </Float>

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate
          autoRotateSpeed={0.5}
          minPolarAngle={Math.PI / 2.6}
          maxPolarAngle={Math.PI / 2.05}
        />

        <EffectComposer multisampling={0}>
          <Bloom
            intensity={0.25}
            luminanceThreshold={0.85}
            luminanceSmoothing={0.3}
            mipmapBlur
          />
        </EffectComposer>
      </Suspense>
    </Canvas>
  );
}

useGLTF.preload("/models/statue.glb");