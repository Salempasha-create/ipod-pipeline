import { useRef, type KeyboardEvent } from "react";
import { Icon, type IconName } from "./Icon";
import "./ClickWheel.css";

export type Page = "search" | "queue" | "library" | "sources";

const BUTTONS: { page: Page; label: string; icon: IconName; key: string }[] = [
  { page: "search", label: "SEARCH", icon: "search", key: "ArrowUp" },
  { page: "queue", label: "QUEUE", icon: "queue", key: "ArrowRight" },
  { page: "library", label: "LIBRARY", icon: "library", key: "ArrowDown" },
  { page: "sources", label: "SOURCES", icon: "sources", key: "ArrowLeft" },
];

interface Props {
  /** The page shown on the screen, or null when the screen shows Setup. */
  active: Page | null;
  onNavigate: (page: Page) => void;
  /** Center button: runs the current page's primary action (§6). */
  onSelect: () => void;
  /** What the center button will do, for screen readers. */
  selectHint: string;
}

/** Click wheel (DESIGN.md §6). Its four buttons mirror the screen's page tabs. */
export function ClickWheel({ active, onNavigate, onSelect, selectHint }: Props) {
  const refs = useRef<Partial<Record<Page, HTMLButtonElement | null>>>({});

  const onKeyDown = (event: KeyboardEvent) => {
    const target = BUTTONS.find((b) => b.key === event.key);
    if (target) {
      event.preventDefault();
      onNavigate(target.page);
      refs.current[target.page]?.focus();
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  };

  return (
    <nav className="wheel" aria-label="Click wheel" onKeyDown={onKeyDown}>
      <span className="wheel-recess" aria-hidden="true" />
      {BUTTONS.map((b) => (
        <button
          key={b.page}
          ref={(el) => {
            refs.current[b.page] = el;
          }}
          type="button"
          className={`wheel-button wheel-${b.page}`}
          aria-current={active === b.page ? "page" : undefined}
          tabIndex={active === b.page || (active === null && b.page === "search") ? 0 : -1}
          onClick={() => onNavigate(b.page)}
        >
          <span className="wheel-marker" aria-hidden="true" />
          <Icon name={b.icon} size={26} />
          <span className="wheel-label">{b.label}</span>
        </button>
      ))}
      <button
        type="button"
        className="wheel-center"
        aria-label="Select"
        aria-describedby="wheel-select-hint"
        onClick={onSelect}
      />
      <span id="wheel-select-hint" className="visually-hidden">
        {selectHint}
      </span>
    </nav>
  );
}
