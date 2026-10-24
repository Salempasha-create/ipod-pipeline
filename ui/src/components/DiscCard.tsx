import type { ReactNode } from "react";
import type { SourceStyle } from "../sources";
import { Icon, type IconName } from "./Icon";
import { Minidisc } from "./Minidisc";
import { SegmentedProgress } from "./SegmentedProgress";

interface Props {
  album: string;
  artist: string;
  source: SourceStyle;
  stage: string;
  stageIcon: IconName;
  /** "70%" or "DONE". */
  pct: string;
  percent: number;
  detail: string;
  action?: ReactNode;
}

/** A loaded disc in the Changer: minidisc + stage, percent, album, detail, progress (§5). */
export function DiscCard({ album, artist, source, stage, stageIcon, pct, percent, detail, action }: Props) {
  return (
    <article className="disc-card">
      <Minidisc album={album} artist={artist.toUpperCase()} shell={source.shell} alt={`${album} minidisc from ${source.name}`} />
      <div className="disc-info">
        <div className="disc-head">
          <span className="disc-stage">
            <Icon name={stageIcon} size={18} back={source.color} ink="var(--ink)" />
            {stage}
          </span>
          <span className="disc-pct">{pct}</span>
        </div>
        <h3 className="disc-album">{album}</h3>
        <p className="disc-detail">{detail}</p>
        <SegmentedProgress percent={percent} color={source.color} label={`${album}: ${stage}, ${pct}`} />
        {action}
      </div>
    </article>
  );
}
