# Layover Privacy Policy

_Last updated: 2 November 2026_

Layover is a browser extension that opens links in a small, temporary window: links that come from other apps, and any link you open with the keyboard shortcut (default ⌥⌘ + click) or with "Open in Layover" in the right-click menu.

## What Layover does not do
- It does not collect, sell or share any personal data.
- It does not send any data to the developer or to third parties. The extension makes no network requests.
- It does not read, record or change the content of the websites you visit.
- It has no accounts, analytics, ads or tracking.

## What stays on your device
- **Settings:** on/off, animations, button position, compact buttons, window size, click shortcut, auto-close time and your list of sites that never open in a mini window are saved with the browser's extension storage (`chrome.storage.local`) on your device.
- **Window position:** while the browser is open, Layover remembers where you last moved a mini window so the next one opens there. This is kept in session storage (`chrome.storage.session`) and is cleared when the browser closes.
- **Optional diagnostics log:** off by default. If you turn it on in the settings, Layover keeps the last 30 events on your device, with only the website's host name (for example `example.com`), the navigation type and the action taken. Turning it off deletes the log.

## Permissions
- **webNavigation:** checks whether a new tab was opened by another app (navigation type only).
- **scripting and access to all sites:** adds the Back, Copy link, "Add to tabs" and Close buttons to the page shown in a mini window, copies the page's address to your clipboard when you press the copy-link shortcut, and lets a small script on each page notice clicks on links made while the shortcut keys are held. That script only looks at the clicked link's address, and only for those clicks.
- **search:** "Search in Layover" hands the text you selected to the search engine you set as default in your browser, only when you choose that menu item. If the browser can't run that search, the mini window opens a Google search for the same text instead. Layover itself doesn't keep or send it anywhere else.
- **alarms:** checks every few minutes for mini windows you haven't used for the chosen time and closes them.
- **storage:** saves your settings (including your list of sites that never open in a mini window), and during a browser session remembers which windows are mini windows and where the last one was moved.
- **contextMenus:** adds "Open in Layover" to the right-click menu of links, "Search in Layover" for selected text, and "Add to tabs" inside mini windows.

## Contact
Questions: [me@uygar.dev](mailto:me@uygar.dev)

---

# Layover Gizlilik Politikası

Layover, linkleri küçük, geçici bir pencerede açan bir tarayıcı eklentisidir. Bu linkler diğer uygulamalardan gelenler ve kısayolla (varsayılan ⌥⌘ + tık) ya da sağ tık menüsündeki "Layover ile aç" ile açtıklarındır.

- Sayfalardaki küçük betik sadece kısayol tuşlarına basılıyken yapılan link tıklamalarını fark eder ve sadece tıklanan linkin adresine bakar.

- Kişisel veri toplamaz, satmaz, paylaşmaz.
- Geliştiriciye ya da üçüncü taraflara hiçbir veri göndermez. Eklenti hiçbir ağ isteği yapmaz.
- Ziyaret ettiğin sitelerin içeriğini okumaz, kaydetmez, değiştirmez.
- Ayarların (açık/kapalı, animasyonlar, buton konumu, kompakt butonlar, pencere boyutu, kısayol, otomatik kapanma süresi, hariç tuttuğun siteler) sadece cihazında saklanır.
- Tarayıcı açıkken mini pencereyi en son taşıdığın yer hatırlanır, bir sonraki oraya açılır. Bu bilgi tarayıcı kapanınca silinir.
- Linki kopyala kısayolu sadece bastığında sayfanın adresini panona kopyalar.
- "Layover ile ara" seçtiğin metni, sadece bu menü öğesini seçtiğinde, tarayıcında varsayılan olarak ayarlı arama motoruna verir. Tarayıcı bu aramayı yapamazsa aynı metin için Google araması açılır. Layover bu metni saklamaz, başka bir yere göndermez.
- İsteğe bağlı tanılama kaydı varsayılan olarak kapalıdır. Açılırsa son 30 olay cihazında tutulur ve bunlarda sadece sitenin alan adı, gezinme türü ve yapılan işlem bulunur. Kapatınca kayıt silinir.

İletişim: [me@uygar.dev](mailto:me@uygar.dev)
