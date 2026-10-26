'use strict';
(() => {
  const SHORTCUTS = ['primary+alt', 'alt+shift', 'shift', 'alt', 'off'];
  const isMac = /Mac/i.test((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '');
  let combo = 'primary+alt';

  const alive = () => { try { return !!(chrome.runtime && chrome.runtime.id); } catch { return false; } };

  try {
    chrome.storage.local.get({ linkShortcut: 'primary+alt' }).then((s) => {
      combo = SHORTCUTS.includes(s.linkShortcut) ? s.linkShortcut : 'primary+alt';
    }).catch(() => {});
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.linkShortcut) {
        const v = changes.linkShortcut.newValue;
        combo = SHORTCUTS.includes(v) ? v : 'primary+alt';
      }
    });
  } catch {}

  function matches(e) {
    const primary = isMac ? e.metaKey : e.ctrlKey;
    const otherKey = isMac ? e.ctrlKey : e.metaKey;
    if (otherKey) return false;
    switch (combo) {
      case 'primary+alt': return primary && e.altKey && !e.shiftKey;
      case 'alt+shift': return e.altKey && e.shiftKey && !primary;
      case 'shift': return e.shiftKey && !e.altKey && !primary;
      case 'alt': return e.altKey && !e.shiftKey && !primary;
      default: return false;
    }
  }

  function linkUrl(e) {
    for (const node of e.composedPath()) {
      if (node instanceof HTMLAnchorElement || node instanceof HTMLAreaElement) return node.href;
      if (typeof SVGAElement !== 'undefined' && node instanceof SVGAElement) {
        try { return new URL(node.href.baseVal, document.baseURI).href; } catch { return ''; }
      }
      if (node === document.body) break;
    }
    return '';
  }

  function onClick(e) {
    if (!e.isTrusted || e.button !== 0 || combo === 'off' || !matches(e)) return;
    const url = linkUrl(e);
    if (!/^https?:\/\//i.test(url)) return;
    if (!alive()) { window.removeEventListener('click', onClick, true); return; }
    e.preventDefault();
    e.stopImmediatePropagation();
    try { chrome.runtime.sendMessage({ type: 'layover-open', url }); } catch {}
  }

  if (typeof window.__layoverClick === 'function') window.removeEventListener('click', window.__layoverClick, true);
  window.__layoverClick = onClick;
  window.addEventListener('click', onClick, true);
})();
