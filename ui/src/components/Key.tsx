import type { ButtonHTMLAttributes } from "react";
import { Icon, type IconName } from "./Icon";
import "./Key.css";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary = the one orange key per screen; secondary = quiet key; square = 44px icon key. */
  variant?: "primary" | "secondary" | "square";
  icon?: IconName;
  /** Back-layer color of the icon. Defaults by variant (§8). */
  iconBack?: string;
  iconSize?: number;
}

/** Physical-looking key (DESIGN.md §7). */
export function Key({ variant = "secondary", icon, iconBack, iconSize, children, className, type, ...rest }: Props) {
  const primary = variant === "primary";
  return (
    <button
      type={type ?? "button"}
      className={`key key-${variant}${className ? ` ${className}` : ""}`}
      {...rest}
    >
      {icon && (
        <Icon
          name={icon}
          size={iconSize ?? (primary ? 28 : variant === "square" ? 22 : 22)}
          back={iconBack ?? (primary ? "var(--action-soft)" : "var(--icon-back)")}
          ink={primary ? "var(--action-label)" : "var(--ink)"}
        />
      )}
      {children}
    </button>
  );
}
