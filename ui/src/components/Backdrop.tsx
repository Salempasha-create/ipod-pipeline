export type BackdropFit = "fill" | "fit" | "center";

interface Props {
  /** Built-in color, or "image" when imageUrl is set. */
  kind: "white" | "black" | "system" | "image";
  imageUrl?: string | null;
  fit?: BackdropFit;
  /** 0–80 (percent). */
  darken?: number;
  blur?: boolean;
}

/** What sits behind the device (DESIGN.md §10). */
export function Backdrop({ kind, imageUrl, fit = "fill", darken = 0, blur = false }: Props) {
  return (
    <div className="backdrop" data-kind={kind} aria-hidden="true">
      {kind === "image" && imageUrl && (
        <div
          className={`backdrop-image${blur ? " blurred" : ""}`}
          data-fit={fit}
          style={{ backgroundImage: `url("${imageUrl}")` }}
        />
      )}
      {darken > 0 && <div className="backdrop-scrim" style={{ opacity: darken / 100 }} />}
    </div>
  );
}
