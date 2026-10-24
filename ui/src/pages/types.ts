export interface PageProps {
  /** Whether this page is on the screen. Hidden pages stay mounted to keep their state. */
  active: boolean;
  /** Registers what the wheel's center button does on this page. */
  registerPrimary: (action: (() => void) | null) => void;
  /** Sets the status line at the top right of the screen. */
  setStatus: (text: string) => void;
}
