// Audio quality rules for pills and the selection strip (SPEC §6.3–§6.4, DESIGN.md §7).
import type { IconName } from "./components/Icon";

export interface AudioQuality {
  format: string;
  bit_depth?: number | null;
  sample_rate?: number | null;
  bitrate?: number | null;
}

const LOSSLESS = new Set(["FLAC", "ALAC", "WAV", "AIFF"]);
const IPOD_LOSSY = new Set(["MP3", "AAC"]);

export const isLossless = (q: AudioQuality) => LOSSLESS.has(q.format.toUpperCase());

export const isHiRes = (q: AudioQuality) =>
  isLossless(q) && ((q.bit_depth ?? 16) > 16 || (q.sample_rate ?? 44100) > 48000);

/** Short label such as "FLAC 16/44", "FLAC 24/96" or "MP3 320". */
export function qualityLabel(q: AudioQuality): string {
  const format = q.format.toUpperCase();
  if (isLossless(q)) return `${format} ${q.bit_depth ?? 16}/${Math.floor((q.sample_rate ?? 44100) / 1000)}`;
  return q.bitrate ? `${format} ${q.bitrate}` : format;
}

export interface RouteStep {
  label: string;
  icon: IconName;
}

export interface Plan {
  /** Plain-language note on what will happen to the files. */
  note: string;
  route: RouteStep[];
}

const TAG: RouteStep = { label: "TAG", icon: "tag" };
const LIBRARY: RouteStep = { label: "LIBRARY", icon: "library" };

interface Completeness {
  track_count: number;
  tracks_expected: number | null;
}

/** What the default pipeline (ALAC 16/44.1 profile) will do with a download. */
export function plan(q: AudioQuality & Completeness): Plan {
  const format = q.format.toUpperCase();
  const label = qualityLabel(q);
  let note: string;
  let middle: RouteStep;
  if (isHiRes(q)) {
    note = "Hi-res. Will be converted down to 16/44.1 so the iPod can play it.";
    middle = { label: "ALAC 16/44.1", icon: "convert" };
  } else if (isLossless(q)) {
    note = "CD-quality lossless. Converts to ALAC 16/44.1 with no quality loss.";
    middle = { label: "ALAC 16/44.1", icon: "convert" };
  } else if (IPOD_LOSSY.has(format)) {
    note = `Lossy. Kept as ${label}, not converted (converting would only add size).`;
    middle = { label: `KEEP ${format}`, icon: "convert" };
  } else {
    note = `The iPod can't play ${format}. Will be converted to AAC 256, which loses a little quality.`;
    middle = { label: "AAC 256", icon: "convert" };
  }
  if (q.tracks_expected && q.track_count < q.tracks_expected) {
    note = `Incomplete: ${q.track_count} of ${q.tracks_expected} tracks. Will check the uploader's folder for the rest.`;
  }
  return { note, route: [TAG, middle, LIBRARY] };
}

export function formatSize(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${Math.round(bytes / 1e6)} MB`;
  return `${Math.max(1, Math.round(bytes / 1e3))} KB`;
}
