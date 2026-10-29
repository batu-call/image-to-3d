type ModelViewer3DProps = {
  src?: string | null;
  poster?: string;
  alt?: string;
  autoRotate?: boolean;
  className?: string;
};

export default function ModelViewer3D({
  src,
  poster,
  alt = "3D model",
  autoRotate = true,
  className = "",
}: ModelViewer3DProps) {
  if (!src) {
    return (
      <img
        src={poster}
        alt={alt}
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }

  return (
    <model-viewer
      src={src}
      poster={poster}
      alt={alt}
      camera-controls
      auto-rotate={autoRotate ? "" : undefined}
      rotation-per-second="18deg"
      shadow-intensity="1"
      exposure="1"
      environment-image="neutral"
      interaction-prompt="none"
      className={className}
    />
  );
}