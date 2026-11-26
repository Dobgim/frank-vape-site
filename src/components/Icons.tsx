import type { CSSProperties } from "react";

/** MWAH vector wordmark (Figma Logo Lockup 387:5), shared by nav, footer and age gate. */
export function WordmarkPaths() {
  return (
    <>
      <path d="M79.62 93.68V39.31H78.9L52.65 83.06H46.91L20.66 39.31H19.94V93.68H0V0H19.65L50.35 51.36H50.64L81.2 0H100.28V93.68H79.62Z" />
      <path d="M143.06 0L160.99 61.54H161.85L181.07 0H196.13L215.21 61.54H216.07L234.14 0H255.66L225.68 93.68H206.17L188.53 38.02H187.67L170.17 93.68H150.66L120.68 0H143.06Z" />
      <path d="M300.65 0H318.3L361.77 93.68H339.25L330.64 73.88H287.32L278.86 93.68H257.2L300.67 0H300.65ZM294.34 57.67H323.6L309.4 24.53H308.54L294.34 57.67Z" />
      <path d="M381.08 93.68V0H401.74V34.72H445.92V0H466.58V93.68H445.92V52.08H401.74V93.68H381.08Z" />
    </>
  );
}

export function Wordmark({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 467 94" fill="currentColor" aria-hidden="true">
      <WordmarkPaths />
    </svg>
  );
}

export function TrademarkMark({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 42 19" fill="currentColor" aria-hidden="true">
      <path d="M15.75 0.0100002V3.12H9.73999V18.8H6.01001V3.12H0V0.0100002H15.75ZM36.05 18.79L35.36 7.74C35.29 6.29 35.29 4.49 35.23 2.49H35.02C34.54 4.15 33.99 6.36 33.43 8.09L30.04 18.52H26.17L22.78 7.81C22.44 6.36 21.89 4.15 21.47 2.49H21.26C21.26 4.22 21.19 6.01 21.12 7.74L20.43 18.79H16.84L18.22 0H23.81L27.06 9.19C27.47 10.64 27.82 12.02 28.3 13.95H28.37C28.85 12.22 29.27 10.64 29.68 9.25L32.93 0H38.32L39.77 18.79H36.04H36.05Z" />
    </svg>
  );
}

export function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

export function XIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644Z" />
    </svg>
  );
}

export function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.51a8.16 8.16 0 0 0 4.77 1.52V6.59a4.85 4.85 0 0 1-1.84.1Z" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <line x1="5" y1="5" x2="19" y2="19" />
      <line x1="19" y1="5" x2="5" y2="19" />
    </svg>
  );
}

export function CheckIcon({ size = 24, strokeWidth = 2, d = "m5 12 4 4L19 6" }: { size?: number; strokeWidth?: number; d?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
