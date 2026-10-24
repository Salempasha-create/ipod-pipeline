/** Five rising bars in the source color (§7). */
export function SpeedBars({ level, color }: { level: number; color: string }) {
  return (
    <span className="speed-bars" role="img" aria-label={`Speed ${level} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          style={{ height: `${3 + n * 3}px`, background: n <= level ? color : "var(--screen-bar-off)" }}
        />
      ))}
    </span>
  );
}
