import type { ButtonHTMLAttributes } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  active: boolean;
}

/** Pill filter chip on the screen; filled white when active (§7). */
export function FilterChip({ active, children, ...rest }: Props) {
  return (
    <button type="button" className="filter-chip" aria-pressed={active} {...rest}>
      {children}
    </button>
  );
}
