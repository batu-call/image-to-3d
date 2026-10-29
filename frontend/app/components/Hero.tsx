"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import FloatingInfoCard from "./FloatingInfoCard";

const HeroScene = dynamic(() => import("./HeroScene"), { ssr: false });

// İki buton da AYNI sabit yükseklikte (h-[52px]) -> hizalı ve eşit.
const BTN_BASE =
  "flex h-[52px] items-center gap-3 rounded-[3px] px-6 text-[13px] uppercase tracking-wide transition";

const PRIMARY_BTN = `${BTN_BASE} bg-lime font-bold text-ink hover:brightness-110`;

const SECONDARY_BTN = `${BTN_BASE} border border-line bg-white/[0.03] pl-4 font-medium text-white hover:border-lime`;

export default function Hero() {
  return (
    // Navbar yüksekliği (~81px) düşülerek tam ekran: halka artık altta kesilmiyor.
    <section className="relative flex min-h-[calc(100vh-81px)] items-center overflow-hidden px-6 pb-10 pt-6 md:px-12">
      {/* Kaya arkaplan resmi */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
        <Image
          src="/images/main_image.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/45 to-black/85" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-black/30" />
        <div className="absolute inset-0 bg-[radial-gradient(140%_140%_at_100%_100%,rgba(182,255,46,0.35),transparent_55%)]" />
      </div>

      {/* 3D sahne */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <HeroScene />
      </div>

      {/* Alt kenar fade: sert kesimi ve halkanın kesik ucunu yumuşatır.
          Sonraki bölümün arka plan rengi siyah değilse from-black'i ona eşitle. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-40 bg-gradient-to-t from-black via-black/70 to-transparent"
      />

      {/* Metin */}
      <div className="relative z-10 max-w-xl">
        <div className="mono-label mb-5 flex items-center gap-3 text-[13px] font-bold text-lime">
          [ IMAGE TO 3D / TEXT TO 3D ]
          <span className="h-px max-w-[140px] flex-1 bg-lime/40" />
        </div>

        <h1 className="display-tight text-[52px] text-cream sm:text-7xl lg:text-[80px]">
          {/* -ml-2 + px-2: kutu sola taşar, yazı alt satırlarla aynı hizada başlar */}
          <span className="-ml-2 inline-block bg-lime px-2 text-ink">
            Turn your
          </span>
          <br />
          ideas into
          <br />
          <span className="text-lime">3D</span> reality.
        </h1>

        <p className="mt-8 max-w-md text-[16px] leading-relaxed text-white/90">
          Transform images and text into stunning 3D models with the power of
          AI. Create, customize, and bring your imagination to life —
          effortlessly.
        </p>

        <div className="mt-9 flex flex-wrap items-center gap-4">
          <Link href="/image-to-3d" className={PRIMARY_BTN}>
            Start Creating
            <span aria-hidden>→</span>
          </Link>
          <Link href="#" className={SECONDARY_BTN}>
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-lime text-lime">
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="currentColor"
                aria-hidden
              >
                <path d="M1 0L10 5L1 10Z" />
              </svg>
            </span>
            Watch Demo
          </Link>
        </div>
      </div>

      {/* Floating kartlar: tek sütunda, birbirine yakın ve aynı hizada */}
      <div className="absolute right-6 top-24 z-10 hidden flex-col gap-4 lg:flex">
        <Link href="/image-to-3d" className="block">
          <FloatingInfoCard
            thumb="/images/thumb-statue.jpg"
            title="Image to 3D"
            description="Realistic models from any image"
            className="flex transition hover:border-lime"
          />
        </Link>
        <Link href="/text-to-3d" className="block">
          <FloatingInfoCard
            icon="T"
            title="Text to 3D"
            description="Turn your words into 3D objects"
            className="flex transition hover:border-lime"
          />
        </Link>
      </div>

      {/* SCROLL göstergesi: kartların yerini boşalttık, alta aldık */}
      <div className="mono-label absolute bottom-10 right-6 z-10 hidden flex-col items-center gap-3 text-[11px] text-white/80 xl:flex">
        SCROLL
        <span className="h-12 w-px bg-white/40" />
        <span className="h-3 w-3 rounded-full border border-white/70" />
      </div>
    </section>
  );
}