export interface Tab<T extends string> {
  id: T;
  label: string;
}

interface Props<T extends string> {
  tabs: Tab<T>[];
  active: T | null;
  onSelect: (id: T) => void;
}

/** Screen page tabs: mono labels, active one underlined in orange (§5). */
export function PageTabs<T extends string>({ tabs, active, onSelect }: Props<T>) {
  return (
    <nav className="page-tabs" aria-label="Screen pages">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className="page-tab"
          aria-current={tab.id === active ? "page" : undefined}
          onClick={() => onSelect(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
