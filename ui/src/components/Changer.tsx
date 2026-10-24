import { useState } from "react";
import type { Job } from "../api";
import { jobArtist, jobStage, jobTitle } from "../jobs";
import type { SourceStyle } from "../sources";
import { DiscCard } from "./DiscCard";
import { Icon } from "./Icon";
import { Key } from "./Key";

const MAX_DISCS = 6;

interface Props {
  jobs: Job[];
  sourceFor: (id: string) => SourceStyle;
}

/** The disc changer (§5): every loaded album is a minidisc in its source's color. */
export function Changer({ jobs, sourceFor }: Props) {
  const [notice, setNotice] = useState<string | null>(null);
  // Active discs first, then the most recent finished ones.
  const live = jobs.filter((j) => j.status === "running" || j.status === "queued");
  const rest = jobs.filter((j) => j.status !== "running" && j.status !== "queued");
  const discs = [...live, ...rest].slice(0, MAX_DISCS);
  const ready = jobs.filter((j) => j.status === "done").length;

  return (
    <section className="changer" aria-label="Changer">
      <div className="changer-head">
        <div className="changer-title">
          <h2>CHANGER</h2>
          <span className="changer-status">
            {discs.length} {discs.length === 1 ? "DISC" : "DISCS"} LOADED · {ready} READY · DISC COLOR = SOURCE
          </span>
        </div>
        <Key
          icon="iopenpod"
          iconBack="var(--action)"
          iconSize={24}
          onClick={() => setNotice("Sending to iOpenPod arrives with the iOpenPod handoff (issue #16).")}
        >
          SEND TO iOPENPOD
        </Key>
      </div>
      <div className="changer-slots">
        {discs.map((job) => {
          const stage = jobStage(job);
          return (
            <DiscCard
              key={job.id}
              album={jobTitle(job)}
              artist={jobArtist(job)}
              source={sourceFor(job.source_id)}
              stage={stage.name}
              stageIcon={stage.icon}
              pct={stage.pct}
              percent={job.percent}
              detail={stage.detail}
            />
          );
        })}
        <button
          type="button"
          className="drop-key"
          onClick={() => setNotice("Adding files from your computer arrives with the Local files source (issue #3).")}
        >
          <Icon name="add" size={28} />
          DROP FILES
          <span className="drop-key-hint">or folders from your computer</span>
        </button>
      </div>
      {notice && (
        <p className="changer-notice" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
