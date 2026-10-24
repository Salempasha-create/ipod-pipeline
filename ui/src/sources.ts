// The four sources from DESIGN.md §4. Each owns one color: LED, icon backing and disc shell.
import type { IconName } from "./components/Icon";
import type { PluginInfo } from "./api";

export interface SourceStyle {
  id: string;
  name: string;
  code: string;
  color: string;
  shell: string;
  icon: IconName;
}

export const KNOWN_SOURCES: SourceStyle[] = [
  { id: "soulseek", name: "Soulseek", code: "SLSK", color: "var(--src-slsk)", shell: "var(--shell-slsk)", icon: "soulseek" },
  { id: "usenet", name: "Usenet", code: "USNT", color: "var(--src-usnt)", shell: "var(--shell-usnt)", icon: "usenet" },
  { id: "bittorrent", name: "BitTorrent", code: "BTRT", color: "var(--src-btrt)", shell: "var(--shell-btrt)", icon: "bittorrent" },
  { id: "local", name: "Local files", code: "LOCL", color: "var(--src-locl)", shell: "var(--shell-locl)", icon: "local" },
];

/** Disc shell for a color that has no design token: light → color → dark at 160deg. */
const shellFor = (color: string) =>
  `linear-gradient(160deg, color-mix(in srgb, ${color} 60%, white) 0%, ${color} 45%, color-mix(in srgb, ${color} 75%, black) 100%)`;

/** Visual identity of a source plugin: the design's own for known sources, else what the plugin declares. */
export function sourceStyle(plugin: Pick<PluginInfo, "id" | "name" | "icon" | "code" | "color">): SourceStyle {
  const known = KNOWN_SOURCES.find((s) => s.id === plugin.id);
  if (known) return known;
  const color = plugin.color ?? "var(--src-locl)";
  return {
    id: plugin.id,
    name: plugin.name,
    code: (plugin.code ?? plugin.id.slice(0, 4)).toUpperCase(),
    color,
    shell: shellFor(color),
    icon: "music",
  };
}
