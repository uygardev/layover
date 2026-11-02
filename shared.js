'use strict';
globalThis.LAYOVER = Object.freeze({
  DEFAULTS: Object.freeze({
    enabled: true,
    width: 1100,
    height: 780,
    barPos: 'top-center',
    barCompact: true,
    effects: true,
    linkShortcut: 'primary+alt',
    neverMini: Object.freeze(['zoom.us', 'meet.google.com', 'teams.microsoft.com', 'teams.live.com']),
    autoCloseHours: 6,
    debug: false,
  }),
  AUTO_CLOSE_OPTIONS: Object.freeze([0, 1, 6, 12, 24]),
  POSITIONS: Object.freeze(['top-center', 'top-right', 'bottom-center', 'bottom-right']),
  SHORTCUTS: Object.freeze(['primary+alt', 'alt+shift', 'shift', 'alt', 'off']),
  MIN_W: 400, MIN_H: 300, MAX_W: 4000, MAX_H: 3000,
  cleanHost(v) {
    let h = String(v || '').trim().toLowerCase();
    h = h.replace(/^[a-z]+:\/\//, '').split(/[/?#]/)[0].replace(/^\*\./, '').replace(/^www\./, '').replace(/:\d+$/, '');
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(h) ? h : '';
  },
});
