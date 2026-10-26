# Chrome Web Store listing: Layover 1.2.1

## Package
- File: `layover-1.2.1.zip` (16 files, about 55 KB uncompressed)
- Manifest V3. No remote code, no analytics, no network requests.

## Store listing tab

**Name:** Layover – Mini window for links
**Category:** Productivity → Workflow & Planning
**Language:** English (Turkish is also included in `_locales/tr`)

**Short description (from manifest, 113 chars)**
Links from other apps stop over in a small, temporary window. Keep the page as a tab with one click, or close it.

**Detailed description (EN)**
Click a link in Mail, Slack, Messages or any other app and it stops over in a small, temporary window instead of piling up in your tab bar. You can open any link on the web the same way: hold ⌥⌘ (Ctrl+Alt on Windows) and click it, or right-click it and choose "Open in Layover".

• Glance at the page without losing your place
• "Add to tabs" moves it into your main window as a normal tab. No reload, logins and scroll position stay.
• "×" or ⌘W closes it
• ⌥⌘ + click any link (Ctrl + Alt + click on Windows). Pick another shortcut or turn it off in the settings.
• Right-click any link › Open in Layover
• Select text, right-click › Search in Layover: results from your own default search engine open in a mini window
• Stack as many mini windows as you like: each new one opens a step lower and to the right
• Click the toolbar icon to move the current tab into a mini window (and back)
• Back and Copy link buttons right in the mini window
• Unused mini windows close by themselves after the time you choose (1 to 24 hours, or never)
• Keep some sites out: links from other apps to meeting sites like Zoom or Google Meet open as normal tabs
• Maximizing the mini window also adds it to your tabs
• Shortcut: ⌥⇧O / Alt+Shift+O (changeable)
• Choose where the buttons sit: top, top right, bottom or bottom right
• The window size is remembered
• Links you click inside web pages, typed addresses and bookmarks open as usual. Only links coming from other apps, and links you open with the shortcut or the right-click menu, open in a mini window.

Private by design: Layover runs entirely on your device. It doesn't collect, store or send your browsing data. There are no accounts, no analytics and no network requests.

Layover is free. If it saves you time, you can buy me a coffee: https://buymeacoffee.com/uygardev

**Detailed description (TR)**
Mail, Slack, Mesajlar ya da başka bir uygulamada bir linke tıkladığında sayfa, sekme çubuğuna eklenmek yerine önce küçük, geçici bir pencereye uğrar. Web'deki herhangi bir linki de aynı şekilde açabilirsin: ⌥⌘ tuşlarına (Windows'ta Ctrl+Alt) basılı tutup tıkla ya da sağ tıklayıp "Layover ile aç"ı seç.

• Sayfaya hızlıca göz at, kaldığın yeri kaybetme
• "Sekmelere ekle" sayfayı ana pencereye normal bir sekme olarak taşır. Sayfa yeniden yüklenmez, oturumlar ve kaydırma konumu korunur.
• "×" veya ⌘W ile kapat
• Herhangi bir linke ⌥⌘ + tık (Windows'ta Ctrl + Alt + tık). Ayarlardan başka bir kısayol seçebilir ya da kapatabilirsin.
• Herhangi bir linke sağ tık › Layover ile aç
• Metni seç, sağ tık › Layover ile ara: sonuçlar kendi varsayılan arama motorunla mini pencerede açılır
• İstediğin kadar mini pencere aç: her yenisi bir öncekinin biraz sağında ve altında, deste gibi açılır
• Araç çubuğundaki ikona tıklayarak açık sekmeyi mini pencereye al (ve geri döndür)
• Mini pencerede Geri ve Linki kopyala butonları
• Kullanılmayan mini pencereler seçtiğin süre sonunda (1 ile 24 saat arası ya da hiçbir zaman) kendiliğinden kapanır
• Bazı siteleri hariç tut: diğer uygulamalardan Zoom, Google Meet gibi toplantı sitelerine gelen linkler normal sekmede açılır
• Mini pencereyi büyütmek de sayfayı sekmelere ekler
• Kısayol: ⌥⇧O / Alt+Shift+O (değiştirilebilir)
• Butonların konumunu seç: üst, sağ üst, alt ya da sağ alt
• Pencere boyutu hatırlanır
• Web sayfalarının içinde tıkladığın linkler, yazdığın adresler ve yer imleri her zamanki gibi açılır. Sadece diğer uygulamalardan gelen linkler ve kısayolla ya da sağ tık menüsüyle açtığın linkler mini pencerede açılır.

Gizlilik önceliklidir: Layover tamamen cihazında çalışır. Gezinme verilerini toplamaz, saklamaz ve hiçbir yere göndermez. Hesap, analiz ya da ağ isteği yoktur.

Layover ücretsiz. İşine yarıyorsa bir kahve ısmarlayabilirsin: https://buymeacoffee.com/uygardev

**Graphics**
- Icon 128×128: `icons/icon128.png` (inside the zip)
- Screenshots 1280×800: `screenshot-1-mini-window.png`, `screenshot-2-open-any-link.png`, `screenshot-3-stack.png`, `screenshot-4-settings.png`, `screenshot-5-search.png`
- Small promo tile 440×280: `promo-tile-440x280.png`

## Privacy practices tab

**Single purpose**
Open links in a small temporary window (links that come from other apps, or any link the user opens with a modifier + click or the right-click menu, or a search for selected text), with a one-click option to keep the page as a tab.

**Permission justifications**
| Permission | Why it's needed |
|---|---|
| `webNavigation` | To recognise links handed to the browser by other apps. The extension only checks the navigation transition type of newly created tabs ("start_page"/auto_toplevel). Nothing is stored or sent. |
| `scripting` | To add the two floating buttons (Add to tabs, Close) to the page shown in a mini window. It is used only in mini windows. |
| Host permission `<all_urls>` | Links can point to any website, so the buttons must be shown on whatever page opens in the mini window. A small content script on all sites listens only for clicks on links made while the chosen keys (default ⌥⌘) are held, so the shortcut works everywhere. The extension doesn't read or change page content. |
| `search` | To run "Search in Layover" with the search engine the user has set as default in the browser. The selected text is searched only when the user picks this menu item. |
| `alarms` | To check every few minutes for mini windows that haven't been used for the chosen time and close them. |
| `storage` | To save the user's settings (on/off, animations, button position, window size). |
| `contextMenus` | To add "Open in Layover" for links, "Search in Layover" for selected text, and "Add to tabs" inside mini windows to the right-click menu. |

**Remote code:** No, I am not using remote code.

**Data usage:** Collects none of the listed data types. Certify:
- not sold or transferred to third parties
- not used or transferred for purposes unrelated to the item's single purpose
- not used or transferred to determine creditworthiness or for lending

**Privacy policy URL:** host `privacy-policy.md` somewhere public (for example GitHub Pages or a published Google Doc) and paste the link.

## Support link
- In both descriptions (above) and on the extension's settings page: https://buymeacoffee.com/uygardev
- Developer dashboard › Store listing › Support URL: better for a help page or email (for example mailto:me@uygar.dev).

## Distribution
- Visibility: Public (or Unlisted for a soft launch)
- Regions: All
- Price: Free

## What reviewers and users will see
- Install warnings: access to data on all websites and browsing history. These come from `<all_urls>` and `webNavigation`, and both are needed for the feature.
- Broad host permissions usually mean a longer, more detailed review.

## Name check (24 Oct 2026)
No browser extension or browser feature named "Layover" turned up in a web search. The name is used by travel apps (airport layover guides), which is a different field. Names I checked and dropped: Linkpop (Shopify product), Porthole (existing Chrome extension), Foyer (Chrome Web Store publisher "Foyer Tech"), Gander, Oriel, Peeklet, Floatab (registered pharma trademark).
