import { isLossless, qualityLabel, type AudioQuality } from "../quality";

/** Format pill: solid outline for lossless, dashed for lossy (§4). */
export function QualityPill({ quality }: { quality: AudioQuality }) {
  const lossless = isLossless(quality);
  return (
    <span className={`quality-pill ${lossless ? "lossless" : "lossy"}`}>
      {qualityLabel(quality)}
      <span className="visually-hidden">{lossless ? " lossless" : " lossy"}</span>
    </span>
  );
}
