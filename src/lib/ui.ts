/** Shared keyboard focus ring (visible on keyboard focus only). */
export const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

/** Focus ring for controls sitting on the primary-colored AppBar (white / on-primary outline). */
export const FOCUS_RING_ON_PRIMARY = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-primary';

/** MUI Paper at elevation 1 (light) / 1px divider border (dark). */
export const PAPER = 'rounded bg-surface shadow-elev1 border border-transparent dark:border-divider dark:shadow-none';

/** MUI outlined button; aria-pressed renders the selected state. */
export const BTN_OUTLINED = `inline-flex items-center gap-1.5 rounded border border-primary/50 px-3 py-1 text-sm font-medium text-primary hover:bg-primary/[0.04] aria-pressed:border-primary aria-pressed:bg-primary/[0.08] ${FOCUS_RING}`;

/** MUI outlined chip (pill). */
export const CHIP = 'inline-block rounded-full border border-fg/25 px-3 py-1 text-fg hover:bg-hover';

/** MUI h5 / h6 style headings (font-display comes from globals.css). */
export const H1 = 'font-medium text-[1.75rem] leading-[1.235] break-words sm:text-[2.125rem]';
export const H2 = 'font-medium text-[1.25rem] leading-[1.6]';
