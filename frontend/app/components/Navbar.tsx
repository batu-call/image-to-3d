"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Image to 3D", href: "/image-to-3d" },
  { label: "Text to 3D", href: "/text-to-3d" },
  { label: "Pricing", href: "#" },
  { label: "Docs", href: "#" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href !== "#" && (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="relative z-20 border-b border-white/10 bg-black/40 backdrop-blur-sm">
      <div className="flex items-center justify-between px-6 py-5 md:px-12">
        <Link href="/" className="flex items-center gap-2.5">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            className="text-lime"
            aria-hidden
          >
            <path
              d="M12 0L13.6 9.2L20.5 3.5L14.8 10.4L24 12L14.8 13.6L20.5 20.5L13.6 14.8L12 24L10.4 14.8L3.5 20.5L9.2 13.6L0 12L9.2 10.4L3.5 3.5L10.4 9.2L12 0Z"
              fill="currentColor"
            />
          </svg>
          <span className="text-[20px] font-semibold tracking-tight text-white">
            BA3D
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Main">
          {NAV_LINKS.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.label}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`relative pb-1 text-[14px] font-medium transition-colors duration-200 ${
                  active ? "text-lime" : "text-white/75 hover:text-white"
                }`}
              >
                {link.label}
                <span
                  className={`absolute -bottom-[1px] left-0 h-[2px] w-full bg-lime transition-opacity duration-200 ${
                    active ? "opacity-100" : "opacity-0"
                  }`}
                  aria-hidden
                />
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          {/* `group` eklendi: ok animasyonu artık gerçekten çalışıyor.
              rounded-[3px]: Hero butonlarıyla aynı köşe yarıçapı. */}
          <Link
            href="/image-to-3d"
            className="group flex h-10 items-center gap-2 rounded-[3px] bg-lime px-4 text-[13px] font-semibold uppercase tracking-wide text-ink transition hover:brightness-110"
          >
            Get Started
            <span
              aria-hidden
              className="transition-transform duration-200 group-hover:translate-x-0.5"
            >
              →
            </span>
          </Link>

          {/* Mobil menü butonu (önceden mobilde hiç menü yoktu) */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label="Toggle menu"
            className="flex h-10 w-10 items-center justify-center rounded-[3px] border border-white/15 text-white md:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
              {open ? (
                <path d="M3 3L15 15M15 3L3 15" stroke="currentColor" strokeWidth="1.6" />
              ) : (
                <path d="M2 5H16M2 9H16M2 13H16" stroke="currentColor" strokeWidth="1.6" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <nav
          className="flex flex-col border-t border-white/10 px-6 py-3 md:hidden"
          aria-label="Mobile"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              onClick={() => setOpen(false)}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={`py-3 text-[15px] font-medium ${
                isActive(link.href) ? "text-lime" : "text-white/80"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}