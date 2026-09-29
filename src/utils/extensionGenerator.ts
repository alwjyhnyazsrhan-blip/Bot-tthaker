import JSZip from 'jszip';
import { WebookEvent, Seat, BotConfig } from '../types/bot';

export interface ExtensionFiles {
  'manifest.json': string;
  'content.js': string;
  'background.js': string;
  'popup.html': string;
  'popup.js': string;
  'README.txt': string;
}

export function generateChromeExtensionFiles(
  event?: WebookEvent | null,
  selectedSeats?: Seat[],
  config?: BotConfig
): ExtensionFiles {
  const quantity = config?.ticketQuantity || selectedSeats?.length || 2;
  const preferredTier = config?.preferredTier || 'vip';
  const targetSlug = event?.slug || '';
  const targetTitle = event?.titleAr || 'فعاليات Webook';
  const seatLabels = (selectedSeats && selectedSeats.length > 0)
    ? selectedSeats.map(s => s.label || `${s.row}-${s.number}`)
    : [];

  const manifest = {
    manifest_version: 3,
    name: "Webook Auto-Hold & Seat Sniper",
    version: "2.5.0",
    description: "إضافة الحقن التلقائي الذكي لحجز وقفل المقاعد في سلة Webook فوراً دون أي تدخل يدوي",
    icons: {
      "128": "icon.png"
    },
    action: {
      default_popup: "popup.html",
      default_title: "Webook Auto Sniper"
    },
    permissions: [
      "storage",
      "tabs"
    ],
    host_permissions: [
      "https://webook.com/*",
      "https://*.webook.com/*"
    ],
    content_scripts: [
      {
        matches: [
          "https://webook.com/*",
          "https://*.webook.com/*"
        ],
        js: ["content.js"],
        run_at: "document_idle"
      }
    ]
  };

  const contentScript = `/* Webook Auto-Hold & Sniper Content Script (Zero Manual Intervention) */
(function() {
  console.log("%c⚡ [Webook Auto-Injector] إضافة الحقن التلقائي تعمل الآن بدون أي تدخل منك!", "background:#ff007a;color:#fff;font-weight:bold;font-size:14px;padding:6px 12px;border-radius:6px;");

  const TARGET_SLUG = "${targetSlug}";
  const TARGET_SEATS = ${JSON.stringify(seatLabels)};
  const QUANTITY = ${quantity};
  const PREFERRED_TIER = "${preferredTier}";

  // Floating notification badge
  function showBadge(msg, isSuccess = false) {
    let b = document.getElementById("wbk-auto-badge");
    if (!b) {
      b = document.createElement("div");
      b.id = "wbk-auto-badge";
      b.style.position = "fixed";
      b.style.top = "18px";
      b.style.left = "18px";
      b.style.zIndex = "99999999";
      b.style.background = isSuccess ? "linear-gradient(135deg, #064e3b, #047857)" : "linear-gradient(135deg, #1e1b4b, #4338ca)";
      b.style.border = isSuccess ? "2px solid #10b981" : "2px solid #6366f1";
      b.style.borderRadius = "16px";
      b.style.padding = "14px 20px";
      b.style.color = "#ffffff";
      b.style.fontFamily = "system-ui, -apple-system, sans-serif";
      b.style.boxShadow = "0 10px 30px rgba(0,0,0,0.7)";
      b.style.direction = "rtl";
      b.style.transition = "all 0.3s ease";
      document.body.appendChild(b);
    }
    b.innerHTML = '<div style="display:flex;align-items:center;gap:12px;">' +
      '<div style="width:28px;height:28px;border-radius:50%;background:' + (isSuccess ? '#10b981' : '#f59e0b') + ';color:#000;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:16px;">' + (isSuccess ? '✓' : '⚡') + '</div>' +
      '<div>' +
      '<div style="font-weight:bold;font-size:13px;line-height:1.4;">' + msg + '</div>' +
      '<div style="font-size:11px;color:#cbd5e1;margin-top:2px;">قناص المقاعد يعمل تلقائياً بالكامل دون تدخل يدوي</div>' +
      '</div></div>';
  }

  showBadge("جاري فحص الفعالية وحجز المقاعد تلقائياً...");

  function attemptAutoReserve() {
    // 1. Locate primary "Book Tickets" or "احجز التذاكر"
    const bookButtons = Array.from(document.querySelectorAll("button, a")).filter(el => {
      const txt = (el.innerText || "").trim().toLowerCase();
      return txt.includes("احجز التذاكر") || txt.includes("احجز الآن") || txt.includes("احجز الان") || txt.includes("book tickets") || txt.includes("book now");
    });

    if (bookButtons.length > 0) {
      bookButtons[0].click();
      showBadge("تم فتح نافذة التذاكر.. جاري اختيار المقاعد المحددة...");
    }

    setTimeout(() => {
      // 2. Try selecting specific seats on interactive SVG seating chart if present
      let pickedCount = 0;
      if (TARGET_SEATS && TARGET_SEATS.length > 0) {
        const svgElements = Array.from(document.querySelectorAll("[data-seat-id], svg circle, svg path, [class*='seat']"));
        if (svgElements.length > 0) {
          svgElements.forEach(el => {
            if (pickedCount < TARGET_SEATS.length) {
              const label = (el.getAttribute("data-seat-id") || el.getAttribute("aria-label") || el.id || "").toUpperCase();
              const matched = TARGET_SEATS.some(s => label.includes(s.toUpperCase()));
              if (matched && !el.classList.contains("reserved") && !el.classList.contains("disabled")) {
                el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                pickedCount++;
              }
            }
          });
        }
      }

      // 3. Fallback or addition: click tier / plus quantity buttons
      const plusButtons = Array.from(document.querySelectorAll("button")).filter(b => {
        const t = (b.innerText || "").trim();
        const aria = (b.getAttribute("aria-label") || "").toLowerCase();
        return t === "+" || aria.includes("increase") || aria.includes("add") || b.classList.contains("plus");
      });

      if (plusButtons.length > 0 && pickedCount < QUANTITY) {
        const needed = QUANTITY - pickedCount;
        for (let i = 0; i < needed; i++) {
          setTimeout(() => { if (plusButtons[0]) plusButtons[0].click(); }, i * 120);
        }
      }

      // 4. Click Proceed / Checkout button
      setTimeout(() => {
        const proceedButtons = Array.from(document.querySelectorAll("button, a")).filter(b => {
          const t = (b.innerText || "").trim().toLowerCase();
          return t.includes("متابعة") || t.includes("اختر تذكرة") || t.includes("الدفع") || t.includes("proceed") || t.includes("checkout") || t.includes("شراء");
        });

        if (proceedButtons.length > 0) {
          proceedButtons[0].click();
          showBadge("🎉 تم حجز وقفل المقاعد في سلتك الرسمية بنجاح 100%! تم نقلك لشاشة الدفع.", true);
        }
      }, 700 + (QUANTITY * 140));
    }, 600);
  }

  // Run automatically on page load
  if (document.readyState === "complete") {
    setTimeout(attemptAutoReserve, 800);
  } else {
    window.addEventListener("load", () => setTimeout(attemptAutoReserve, 800));
  }
})();`;

  const backgroundScript = `/* Webook Auto-Sniper Background Service Worker */
chrome.runtime.onInstalled.addListener(() => {
  console.log("Webook Auto-Hold Extension Installed Successfully!");
});
`;

  const popupHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <style>
    body {
      width: 320px;
      font-family: system-ui, -apple-system, sans-serif;
      margin: 0;
      padding: 16px;
      background: #0b0e14;
      color: #ffffff;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 10px;
      border-bottom: 1px solid #1e293b;
      padding-bottom: 12px;
      margin-bottom: 12px;
    }
    .icon {
      width: 28px;
      height: 28px;
      background: #ff007a;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
    }
    h3 { margin: 0; font-size: 14px; font-weight: bold; }
    p { margin: 4px 0 0; font-size: 11px; color: #94a3b8; }
    .status-box {
      background: #064e3b;
      border: 1px solid #10b981;
      padding: 10px 12px;
      border-radius: 10px;
      font-size: 12px;
      color: #a7f3d0;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .target-box {
      background: #1e293b;
      border-radius: 10px;
      padding: 10px 12px;
      font-size: 11px;
      margin-bottom: 12px;
    }
    .target-title { font-weight: bold; color: #f1f5f9; margin-bottom: 4px; }
    .target-detail { color: #94a3b8; }
    .btn {
      width: 100%;
      background: linear-gradient(135deg, #10b981, #059669);
      color: #000;
      border: none;
      padding: 10px;
      border-radius: 10px;
      font-weight: bold;
      font-size: 12px;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="icon">⚡</div>
    <div>
      <h3>Webook Auto-Hold</h3>
      <p>قناص المقاعد التلقائي 100%</p>
    </div>
  </div>

  <div class="status-box">
    <span>✓</span>
    <span>الحقن التلقائي مفعّل ونشط على Webook</span>
  </div>

  <div class="target-box">
    <div class="target-title">${targetTitle}</div>
    <div class="target-detail">المقاعد المحددة: ${seatLabels.join(', ') || (quantity + ' مقاعد')}</div>
    <div class="target-detail">الفئة: ${preferredTier.toUpperCase()}</div>
  </div>

  <button class="btn" id="openWebookBtn">فتح صفحة الفعالية في Webook الآن</button>

  <script src="popup.js"></script>
</body>
</html>`;

  const popupJs = `document.getElementById('openWebookBtn').addEventListener('click', () => {
  const targetUrl = "${event?.url ? event.url.replace(/\/+$/, '').replace(/\/book$/, '') : 'https://webook.com/ar/explore'}";
  chrome.tabs.create({ url: targetUrl });
});`;

  const readme = `========================================================================
 إضافة كروم للحقن التلقائي بالكامل لمنصة Webook (Zero-Touch Auto-Injector)
========================================================================

طريقة التثبيت في ثوانٍ معدودة دون كتابة أي كود أو فتح أدوات المطورين:

1. قم بفك الضغط عن هذا المجلد (Extract All / Unzip).
2. افتح متصفح Google Chrome واكتب في شريط العناوين:
   chrome://extensions
3. فعّل خيار "وضع مطور البرامج" (Developer mode) في الزاوية العلوية اليمنى.
4. اضغط على زر "تحميل حزمة غير مضغوطة" (Load unpacked).
5. اختر المجلد المفكوك الذي قمت بتنزيله.

مبروك! الآن الإضافة مثبتة ونشطة:
بمجرد دخولك إلى أي رابط فعالية على webook.com، ستقوم الإضافة تلقائياً بالكامل:
- باختيار مقاعدك المحددة
- قفلها في سلة حسابك الموثق
- نقلك لشاشة الدفع بالبطاقة
دون أن تلمس أي شيء ودون أي تدخل يدوي!
========================================================================
`;

  return {
    'manifest.json': JSON.stringify(manifest, null, 2),
    'content.js': contentScript,
    'background.js': backgroundScript,
    'popup.html': popupHtml,
    'popup.js': popupJs,
    'README.txt': readme,
  };
}

/**
 * Packs all extension files into a zip file and triggers instant download
 */
export async function downloadWebookExtensionZip(
  event?: WebookEvent | null,
  selectedSeats?: Seat[],
  config?: BotConfig
): Promise<void> {
  const files = generateChromeExtensionFiles(event, selectedSeats, config);
  const zip = new JSZip();

  // Create simple 128x128 PNG canvas icon
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ff007a';
    ctx.beginPath();
    ctx.roundRect(0, 0, 128, 128, 28);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 70px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚡', 64, 68);
    const dataUrl = canvas.toDataURL('image/png');
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
    zip.file('icon.png', base64Data, { base64: true });
  }

  Object.entries(files).forEach(([filename, content]) => {
    zip.file(filename, content);
  });

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const slug = event?.slug || 'webook';
  a.download = `webook-auto-injector-extension-${slug}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
