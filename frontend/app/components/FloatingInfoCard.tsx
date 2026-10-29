type Props = {
  icon?: React.ReactNode;
  thumb?: string;
  title: string;
  description: string;
  className?: string;
};

export default function FloatingInfoCard({ icon, thumb, title, description, className = "" }: Props) {
  return (
    <div
      className={`items-center gap-4 rounded-xl border border-line bg-white/[0.04] px-5 py-4 backdrop-blur-md ${className}`}
    >
      {thumb ? (
        <img src={thumb} alt="" className="h-14 w-14 rounded-lg object-cover" />
      ) : (
        <span className="font-serif text-4xl leading-none text-white">{icon}</span>
      )}
      <div>
        <div className="flex items-center gap-2 text-sm font-medium text-white">
          {title} <span aria-hidden>→</span>
        </div>
        <p className="mt-1 max-w-[150px] text-[13px] leading-snug text-muted">{description}</p>
      </div>
    </div>
  );
}