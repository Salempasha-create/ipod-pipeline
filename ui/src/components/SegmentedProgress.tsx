interface Props {
  percent: number;
  /** Lit-segment color: the source color (§5). */
  color: string;
  label: string;
  segments?: number;
}

/** 20-segment progress bar. */
export function SegmentedProgress({ percent, color, label, segments = 20 }: Props) {
  const clamped = Math.max(0, Math.min(100, percent));
  const lit = Math.round((clamped / 100) * segments);
  return (
    <div
      className="segments"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
    >
      {Array.from({ length: segments }, (_, i) => (
        <span key={i} style={{ background: i < lit ? color : "var(--dim)" }} />
      ))}
    </div>
  );
}
