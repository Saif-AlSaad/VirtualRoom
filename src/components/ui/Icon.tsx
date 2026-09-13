/**
 * Icon set.
 *
 * Hand-picked 24×24 stroke paths rather than an icon package: the app needs
 * about thirty glyphs, and a consistent 1.6 stroke weight across all of them
 * does more for a "designed" feel than any library's default mix would.
 */

export type IconName =
  | 'plus'
  | 'search'
  | 'close'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-down'
  | 'undo'
  | 'redo'
  | 'trash'
  | 'copy'
  | 'lock'
  | 'unlock'
  | 'eye'
  | 'eye-off'
  | 'rotate'
  | 'cube'
  | 'grid'
  | 'walk'
  | 'camera'
  | 'sun'
  | 'moon'
  | 'share'
  | 'download'
  | 'upload'
  | 'settings'
  | 'keyboard'
  | 'check'
  | 'alert'
  | 'info'
  | 'star'
  | 'star-filled'
  | 'door'
  | 'window'
  | 'ruler'
  | 'layers'
  | 'receipt'
  | 'sparkle'
  | 'home'
  | 'more'
  | 'present'
  | 'magnet'
  | 'cloud-off'
  | 'align-left'
  | 'align-center'
  | 'align-right'
  | 'distribute'
  | 'snap-face'
  | 'touch'
  | 'joystick';

const PATHS: Record<IconName, string> = {
  plus: 'M12 5v14M5 12h14',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35',
  close: 'M18 6 6 18M6 6l12 12',
  'chevron-left': 'm15 18-6-6 6-6',
  'chevron-right': 'm9 18 6-6-6-6',
  'chevron-down': 'm6 9 6 6 6-6',
  undo: 'M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-4',
  redo: 'm15 14 5-5-5-5M20 9H9a5 5 0 0 0 0 10h4',
  trash: 'M4 7h16M10 11v6M14 11v6M5 7l1 13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-13M9 7V4h6v3',
  copy: 'M9 9h10v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V9zM5 15V5a2 2 0 0 1 2-2h10',
  lock: 'M6 11h12v10H6zM9 11V7a3 3 0 0 1 6 0v4',
  unlock: 'M6 11h12v10H6zM9 11V7a3 3 0 0 1 5.6-1.5',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  'eye-off': 'M3 3l18 18M10.6 10.6A3 3 0 0 0 12 15a3 3 0 0 0 2.4-1.2M6.7 6.8C3.9 8.4 2 12 2 12s3.6 7 10 7c1.9 0 3.5-.6 4.9-1.4M9.9 5.2A9.9 9.9 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-2.7 3.5',
  rotate: 'M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5',
  cube: 'M12 2 3 7v10l9 5 9-5V7l-9-5zM3 7l9 5 9-5M12 12v10',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  walk: 'M13 5a1.6 1.6 0 1 0 0-3.2A1.6 1.6 0 0 0 13 5zM11 21l1.4-6L10 13l1-5 3.2 1.4L17 11M12.4 15 9 21',
  camera: 'M4 8h3l1.5-2h7L17 8h3v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v3M12 20v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1 12h3M20 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  share: 'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4',
  download: 'M12 3v12M7 11l5 5 5-5M4 21h16',
  upload: 'M12 17V5M7 9l5-5 5 5M4 21h16',
  settings:
    'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7.1 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 13.9H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 7.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9.3A1.6 1.6 0 0 0 10.3 3.1V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1h.1a2 2 0 1 1 0 4H21a1.6 1.6 0 0 0-1.5 1z',
  keyboard: 'M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M17 10h.01M7 14h10',
  check: 'm4 12 5 5L20 6',
  alert: 'M12 8v5M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01',
  star: 'm12 3 2.6 5.5 6 .9-4.3 4.3 1 6.1-5.3-2.9-5.3 2.9 1-6.1L3.4 9.4l6-.9L12 3z',
  'star-filled': 'm12 3 2.6 5.5 6 .9-4.3 4.3 1 6.1-5.3-2.9-5.3 2.9 1-6.1L3.4 9.4l6-.9L12 3z',
  door: 'M5 21h14M7 21V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v17M14 12h.01',
  window: 'M4 4h16v16H4zM12 4v16M4 12h16',
  ruler: 'm3 15 6-6 6 6-6 6-6-6zM14.5 3.5 21 10M8 12l1.5 1.5M11 9l1.5 1.5M17 6.5 18.5 8',
  layers: 'm12 3 9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 18l9 5 9-5',
  receipt: 'M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2V3zM9 8h6M9 12h6',
  sparkle: 'M12 3v6M12 15v6M3 12h6M15 12h6M6.3 6.3 9 9M15 15l2.7 2.7M17.7 6.3 15 9M9 15l-2.7 2.7',
  home: 'm3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10z',
  more: 'M12 6h.01M12 12h.01M12 18h.01',
  present: 'M3 4h18M4 4v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V4M12 15v5M9 20h6',
  magnet: 'M6 4v8a6 6 0 0 0 12 0V4h-4v8a2 2 0 0 1-4 0V4H6zM6 8h4M14 8h4',
  'cloud-off': 'M3 3l18 18M7 17h9a4 4 0 0 0 1.6-7.7A6 6 0 0 0 8.2 7.6M5.5 9.5A4 4 0 0 0 7 17',
  'align-left': 'M4 4v16M8 6h10v4H8zM8 14h6v4H8z',
  'align-center': 'M12 3v18M5 6h14v4H5zM7 14h10v4H7z',
  'align-right': 'M20 4v16M6 6h10v4H6zM10 14h6v4H10z',
  distribute: 'M4 5v14M20 5v14M9 8h6v8H9z',
  'snap-face': 'M4 6h7v12H4zM11 6h9v12h-9z',
  touch: 'M12 4a2 2 0 0 0-2 2v7.5l-1.5-1.5a1.8 1.8 0 0 0-2.5 2.5l5 5a7 7 0 0 0 10-5V10a2 2 0 0 0-4 0v1a2 2 0 0 0-4 0V6a2 2 0 0 0-2-2z',
  joystick: 'M6 12a6 6 0 0 0 12 0v-2H6v2zM12 4v6M9 4h6',
};

interface Props {
  name: IconName;
  className?: string;
  /** Filled icons need no stroke; used for the favourite star. */
  filled?: boolean;
  strokeWidth?: number;
}

export function Icon({ name, className = 'h-4 w-4', filled, strokeWidth = 1.6 }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
