import { forwardRef, type InputHTMLAttributes } from "react";
import { Icon } from "./Icon";

/** Large search field on the screen, labelled FIND, with the search icon (§7). */
export const SearchInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function SearchInput(props, ref) {
    return (
      <div className="search-field">
        <label htmlFor="find" className="screen-label">
          FIND
        </label>
        <div className="search-line">
          <Icon name="search" size={28} back="var(--action)" ink="var(--screen-text)" />
          <input ref={ref} id="find" type="search" autoComplete="off" spellCheck={false} {...props} />
        </div>
      </div>
    );
  },
);
