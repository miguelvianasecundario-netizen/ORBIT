const paths: Record<string, string> = {
  briefcase:
    '<rect x="3" y="7" width="18" height="14" rx="3"/><path d="M8 7V4h8v3M3 12l9 3 9-3M10 13v4h4v-4"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7Zm-10 9 10 5 10-5M2 16l10 5 10-5"/>',

  moon: '<path d="M20.5 13A9 9 0 0 1 11 3.5 9 9 0 1 0 20.5 13Z"/>',
  book: '<path d="M12 5C8 2 4 3 2 4v15c4-2 7-1 10 1 3-2 6-3 10-1V4c-4-2-7-1-10 1Zm0 0v15"/>',
  play: '<rect x="2" y="4" width="20" height="15" rx="4"/><path d="m10 8 5 3.5-5 3.5Z"/>',
  gamepad:
    '<path d="M7 7h10c3 0 4 3 5 9 .5 4-3 4-5 1H7c-2 3-5.5 3-5-1 1-6 2-9 5-9Z"/><path d="M7 10v5m-2.5-2.5h5M16 11h.01M19 14h.01"/>',
  palette:
    '<circle cx="12" cy="12" r="9"/><circle cx="8" cy="8" r="1"/><circle cx="16" cy="8" r="1"/><circle cx="7" cy="14" r="1"/><path d="M17 14c-7-2-6 5-2 6"/>',
  chevronLeft: '<path d="m15 6-6 6 6 6"/>',
  orbit:
    '<ellipse cx="12" cy="12" rx="11" ry="5" transform="rotate(-35 12 12)"/><circle cx="12" cy="12" r="3"/><circle cx="20" cy="5" r="1.5" fill="currentColor"/>',
  globe:
    '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 6.5h14M5 17.5h14"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  folder:
    '<path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm0 1h18"/>',
  bolt: '<path d="m13 2-9 12h7l-1 8 10-12h-8l1-8Z"/>',
  settings:
    '<path d="m9 3 1-2h4l1 2 2 1 2-.1 2 3-1 2v3l1 2-2 3-2-.1-2 1-1 2h-4l-1-2-2-1-2 .1-2-3 1-2V9L3 7l2-3 2 .1Z" transform="translate(0 1)"/><circle cx="12" cy="12" r="3"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  back: '<path d="M19 12H5m6-6-6 6 6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  youtube:
    '<rect x="2" y="5" width="20" height="14" rx="5" fill="currentColor" stroke="none"/><path d="m10 9 6 3-6 3Z" fill="white" stroke="none"/>',
  chatgpt:
    '<path d="M12 3c5-3 10 3 7 7 5 3 2 10-3 9-1 5-9 5-10 0-5 0-7-7-3-10-2-5 5-9 9-6Zm0 0v7l6 4m1-4-6 3v7m3-1-6-3-6 3m2 0v-7L1 9m2 0 6 3 6-3M12 3 6 6v6"/>',
  github:
    '<path d="M9 19c-4 1-4-2-6-2m13 5v-4c0-1-.3-2-1-2 4-.5 6-2 6-6 0-2-.5-3-2-4 .5-1 .5-3 0-4-2 0-3 1-4 2a13 13 0 0 0-6 0C8 3 7 2 5 2c-.5 1-.5 3 0 4-1.5 1-2 2-2 4 0 4 2 5.5 6 6-.7 0-1 1-1 2v4"/>',
  google:
    '<path d="M21 12h-9m9 0c0 6-7 11-13 7C1 15 3 5 10 3c4-1 7 1 8 2" stroke-width="3"/>',
  code: '<path d="m8 6-6 6 6 6m8-12 6 6-6 6M14 3l-4 18"/>',
  note: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M9 7h6m-6 5h6m-6 5h4"/>',
  download: '<path d="M12 2v13m-5-5 5 5 5-5M3 16v5h18v-5"/>',
  activity: '<path d="M2 12h5l3-8 4 16 3-8h5"/>',
  star: '<path d="m12 2 3 6.5 7 1-5 5 1.2 7-6.2-3.3-6.2 3.3 1.2-7-5-5 7-1Z"/>',
  cursor: '<path d="m5 2 14 12-7 1-3 7-4-20Z"/>',
  shield:
    '<path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6l9-4Z"/><path d="m8 12 3 3 5-6"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',
  keyboard:
    '<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M6 9h1m4 0h1m4 0h1M6 12h1m4 0h1m4 0h1M7 16h10"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
};
export function icon(name: string, cls = ""): string {
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] ?? paths.folder}</svg>`;
}
