interface Props {
  color: string;
  on: boolean;
  code: string;
  /** Full source name, for screen readers. */
  name: string;
}

/** Source status LED with its printed code (§5). Glows in the source color when on. */
export function Led({ color, on, code, name }: Props) {
  return (
    <span className="led" style={{ "--led": color } as React.CSSProperties}>
      <span className={on ? "led-dot on" : "led-dot"} aria-hidden="true" />
      <span aria-hidden="true">{code}</span>
      <span className="visually-hidden">
        {name} {on ? "on" : "off"}
      </span>
    </span>
  );
}
