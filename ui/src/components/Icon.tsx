import type { CSSProperties } from "react";
import backSprite from "../assets/design/icons-duotone-back.svg";
import frontSprite from "../assets/design/icons-duotone-front.svg";
import "./Icon.css";

// Sprite order (docs/DESIGN.md §8): 24 Phosphor duotone icons in one row.
export const ICON_NAMES = [
  "search",
  "download",
  "tag",
  "convert",
  "library",
  "soulseek",
  "usenet",
  "bittorrent",
  "local",
  "queue",
  "iopenpod",
  "sources",
  "cassette",
  "setup",
  "eject",
  "best",
  "done",
  "minimize",
  "list",
  "backdrop",
  "skin",
  "add",
  "levels",
  "music",
] as const;

export type IconName = (typeof ICON_NAMES)[number];

export const isIconName = (name: unknown): name is IconName =>
  typeof name === "string" && (ICON_NAMES as readonly string[]).includes(name);

interface Props {
  name: IconName;
  size?: number;
  /** Fill of the back layer (the signal color). Defaults to the skin's icon-back color. */
  back?: string;
  /** Color of the front line drawing. Defaults to the current text color. */
  ink?: string;
  /** Accessible name. Omit for decorative icons next to visible text. */
  label?: string;
  className?: string;
}

/** Two-tone duotone icon drawn with CSS masks over the sprites (§8). */
export function Icon({ name, size = 24, back = "var(--icon-back)", ink = "currentColor", label, className }: Props) {
  const index = ICON_NAMES.indexOf(name);
  const style = {
    width: size,
    height: size,
    "--ico-pos": `${(index / (ICON_NAMES.length - 1)) * 100}% 0`,
    "--ico-back-url": `url("${backSprite}")`,
    "--ico-front-url": `url("${frontSprite}")`,
  } as CSSProperties;
  return (
    <span
      className={className ? `ico ${className}` : "ico"}
      style={style}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <span className="ico-b" style={{ background: back }} />
      <span className="ico-f" style={{ background: ink }} />
    </span>
  );
}
