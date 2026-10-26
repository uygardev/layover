# Layover

**A mini window for links from other apps.**

When you click a link in Mail, Slack, Messages, Notes or any other app, the browser normally drops it into your main window as yet another tab. Layover catches that link and opens it in a small, temporary popup window instead. Read it, then decide: keep it as a tab with one click, or close it and it's gone.

Layover is a Chrome extension (Manifest V3). It also works in other Chromium browsers such as Edge, Brave, Arc and Vivaldi.

## What it does

- **Links from other apps open in a mini window.** The window appears centred over your main window. Nothing in your tab bar changes.
- **A small floating bar inside the mini window** gives you four actions: go back, copy the link, add the page to your tabs, or close it.
- **Add to tabs** moves the page into your main window as it is. No reload, so logins, scroll position and form input stay.
- **Open any link in a mini window** with a modifier + click (⌥⌘ + click on Mac, Ctrl + Alt + click elsewhere) or from the right-click menu.
- **Search selected text** in a mini window, using the search engine your browser already uses.
- **Move the current tab into a mini window** by clicking the toolbar icon. Click it again inside a mini window to send the page back.
- **Keyboard shortcut** for "add to tabs" (Alt + Shift + O by default). Maximizing a mini window also adds it to your tabs.
- **Never-mini list.** Links to some sites (meeting links by default: Zoom, Google Meet, Teams) always open as normal tabs.
- **Auto-close.** Mini windows you haven't looked at for a while close by themselves. Windows playing sound are left alone.
- **Light and dark mode**, reduced-motion support, English and Turkish.

## How it recognises a link from another app

When the operating system hands a URL to the browser, the browser opens a new tab whose first navigation has the `AUTO_TOPLEVEL` transition type. Layover watches for that with the `webNavigation` API. Links clicked inside web pages, typed URLs and bookmarks have other transition types, so they are never affected. Tabs restored at browser launch are skipped as well.

## Privacy

Everything runs on your device. Layover does not collect, store or send your browsing data. It has no analytics, no remote code and no network requests of its own.

The extension needs the `webNavigation` permission and access to all sites to do its job (detecting the incoming link and drawing the floating bar on the page). If you turn on the diagnostics log in the settings, only the host name of each handled link is kept, locally, and the log is deleted when you turn it off.

## Install

### From source

1. Download or clone this repository.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and choose the project folder.

### Settings

Right-click the Layover icon in the toolbar and choose **Options**, or open it from `chrome://extensions`. There you can change the window size, the position of the floating bar, the click shortcut, the auto-close delay and the never-mini list, and try it out with a sample link.

## Project layout

| File | Purpose |
| --- | --- |
| `manifest.json` | Extension manifest (MV3) |
| `background.js` | Service worker: link detection, mini windows, context menus, auto-close |
| `content.js` | Modifier + click on links, runs on every page |
| `options.html`, `options.js`, `options.css` | Settings page |
| `_locales/` | English and Turkish strings |
| `icons/` | Extension icons |

No build step, no dependencies.

## Support

Layover is free. If it saves you time, you can [buy me a coffee](https://buymeacoffee.com/uygardev). ☕

---

### Türkçe

Layover, diğer uygulamalardan (Mail, Slack, Mesajlar…) gelen linkleri ana pencerenize sekme olarak atmak yerine küçük, geçici bir pencerede açan bir Chrome eklentisidir. Sayfayı okuyun; işinize yararsa tek tıkla sekmelere ekleyin, yaramazsa kapatın. Her şey cihazınızda çalışır, hiçbir veri toplanmaz veya gönderilmez.

Kurulum için `chrome://extensions` sayfasında **Geliştirici modu**'nu açın ve **Paketlenmemiş öğe yükle** ile proje klasörünü seçin.

İşinize yarıyorsa [bir kahve ısmarlayabilirsiniz](https://buymeacoffee.com/uygardev).
