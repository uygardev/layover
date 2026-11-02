'use strict';
(() => {
  const { SHORTCUTS, DEFAULTS } = globalThis.LAYOVER;
  const isMac = /Mac/i.test((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '');
  let combo = null;
  let loading = false;

  const alive = () => { try { return !!(chrome.runtime && chrome.runtime.id); } catch { return false; } };
  const valid = (v) => (SHORTCUTS.includes(v) ? v : DEFAULTS.linkShortcut);

  function load() {
    if (loading) return;
    loading = true;
    try {
      chrome.storage.local.get({ linkShortcut: DEFAULTS.linkShortcut }).then((s) => { combo = valid(s.linkShortcut); }).catch(() => {});
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.linkShortcut) combo = valid(changes.linkShortcut.newValue);
      });
    } catch {}
  }

  function onPrep(e) {
    if (e.altKey || e.shiftKey || e.metaKey || e.ctrlKey || e.key === 'Alt' || e.key === 'Shift' || e.key === 'Meta' || e.key === 'Control') load();
  }

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
    if (!e.isTrusted || e.button !== 0 || !combo || combo === 'off' || !matches(e)) return;
    const url = linkUrl(e);
    if (!/^https?:\/\//i.test(url)) return;
    if (!alive()) { detach(); return; }
    e.preventDefault();
    e.stopImmediatePropagation();
    try { chrome.runtime.sendMessage({ type: 'layover-open', url }); } catch {}
  }

  function detach() {
    window.removeEventListener('click', onClick, true);
    window.removeEventListener('keydown', onPrep, true);
    window.removeEventListener('pointerdown', onPrep, true);
  }

  if (typeof window.__layoverDetach === 'function') window.__layoverDetach();
  else if (typeof window.__layoverClick === 'function') window.removeEventListener('click', window.__layoverClick, true);
  window.__layoverDetach = detach;
  window.addEventListener('keydown', onPrep, true);
  window.addEventListener('pointerdown', onPrep, true);
  window.addEventListener('click', onClick, true);
})();
