/** Black inset display with the album count in orange digits (§5). */
export function LibCounter({ albums }: { albums: number }) {
  const digits = String(Math.max(0, Math.min(999999, albums))).padStart(6, "0");
  return (
    <div
      className="lib-counter"
      role="img"
      aria-label={`Library holds ${albums.toLocaleString()} ${albums === 1 ? "album" : "albums"}`}
    >
      <span className="lib-counter-label">LIB</span>
      <span className="lib-counter-digits">{digits}</span>
    </div>
  );
}
