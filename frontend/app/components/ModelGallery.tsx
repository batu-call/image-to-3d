import ModelViewer3D from "./ModelViewer3D";

const MODELS = [
  {
    label: "Product Models",
    alt: "3D ayakkabı modeli",
    poster:
      "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?q=80&w=900&auto=format&fit=crop",
    src: null, // "/models/sneaker.glb"
  },
  {
    label: "Character Models",
    alt: "3D ejderha karakter modeli",
    poster:
      "https://images.unsplash.com/photo-1577896851231-70ef18881754?q=80&w=900&auto=format&fit=crop",
    src: null, // "/models/dragon.glb"
  },
  {
    label: "Object Models",
    alt: "3D koltuk modeli",
    poster:
      "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?q=80&w=900&auto=format&fit=crop",
    src: null, // "/models/chair.glb"
  },
];

export default function ModelGallery() {
  return (
    <section className="px-6 py-16 md:px-12">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[0.8fr_2.2fr]">
        {/* Sol: başlık bloğu */}
        <div>
          <div className="mono-label mb-5 flex items-center gap-3 text-xs text-lime">
            01 / 04
            <span className="h-px w-10 bg-lime/40" />
          </div>
          <h2 className="display-tight text-4xl text-white">
            From image
            <br />
            to 3D model
          </h2>
          <p className="mt-4 max-w-xs text-[15px] leading-relaxed text-muted">
            Upload any image and turn it into a high-quality 3D model in
            seconds.
          </p>
          <a
            href="#"
            aria-label="Sonraki örneğe geç"
            className="mt-8 flex h-11 w-11 items-center justify-center rounded-full border border-line text-lime transition-colors hover:border-lime"
          >
            →
          </a>
        </div>

        {/* Sağ: 3 model kartı */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {MODELS.map((model) => (
            <div
              key={model.label}
              className="group flex h-[420px] flex-col overflow-hidden rounded-2xl border border-line bg-panel"
            >
              <div className="relative flex-1 overflow-hidden">
                <ModelViewer3D
                  src={model.src}
                  poster={model.poster}
                  alt={model.alt}
                  className="transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="flex items-center justify-between border-t border-line px-5 py-4">
                <span className="text-sm font-medium text-white">
                  {model.label}
                </span>
                <span aria-hidden className="text-lime">→</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}