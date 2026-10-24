import { Icon } from "./Icon";

/** Orange BEST badge with a star (§7). */
export function BestBadge() {
  return (
    <span className="best-badge">
      <Icon name="best" size={14} back="var(--action-soft)" ink="var(--screen)" />
      BEST
    </span>
  );
}
