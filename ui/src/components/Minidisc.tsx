interface Props {
  album: string;
  artist: string;
  /** Shell gradient, from the source (§4). */
  shell: string;
  /** Full description for screen readers, e.g. "Kind of Blue minidisc from BitTorrent". */
  alt: string;
  size?: "large" | "small";
}

/** Minidisc: source-colored shell, white label, metal shutter, write-protect notch (§7). */
export function Minidisc({ album, artist, shell, alt, size = "large" }: Props) {
  return (
    <div className={`minidisc minidisc-${size}`} role="img" aria-label={alt} style={{ background: shell }}>
      <div className="minidisc-label" aria-hidden="true">
        <div className="minidisc-album">{album}</div>
        <div className="minidisc-artist">{artist}</div>
      </div>
      <div className="minidisc-shutter" aria-hidden="true">
        <div className="minidisc-window" />
      </div>
      <div className="minidisc-notch" aria-hidden="true" />
    </div>
  );
}
