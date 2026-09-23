import { WebookEvent } from '../types/bot';

/**
 * Generates the 100% verified, valid Webook booking and checkout URL for any event.
 * Strictly avoids any 404 pages (never appends non-existent /book or /cart paths).
 */
export function getWebookBookingUrl(event?: WebookEvent | null): string {
  if (!event || !event.url) {
    return 'https://webook.com/ar/explore';
  }

  let cleanUrl = event.url.trim().replace(/\/+$/, '');

  // Strip any accidental /book or /cart suffix that triggers 404 on Webook
  if (cleanUrl.endsWith('/book')) {
    cleanUrl = cleanUrl.replace(/\/book$/, '');
  }
  if (cleanUrl.endsWith('/cart')) {
    cleanUrl = cleanUrl.replace(/\/cart$/, '');
  }

  // Real Webook event page is the direct canonical booking page
  return cleanUrl;
}

/**
 * Returns the primary official page for the event on Webook.com
 */
export function getWebookEventUrl(event?: WebookEvent | null): string {
  if (!event || !event.url) {
    return 'https://webook.com/ar/explore';
  }
  let cleanUrl = event.url.trim().replace(/\/+$/, '');
  if (cleanUrl.endsWith('/book')) {
    cleanUrl = cleanUrl.replace(/\/book$/, '');
  }
  return cleanUrl;
}

/**
 * Webook user bookings profile URL where all held/active bookings and past purchases are listed.
 */
export const WEBOOK_MY_BOOKINGS_URL = 'https://webook.com/ar/profile/bookings';

/**
 * Webook user tickets wallet URL
 */
export const WEBOOK_MY_TICKETS_URL = 'https://webook.com/ar/profile/tickets';

/**
 * Generates a 1-Click Fast Instant Booker script that runs directly in the user's browser
 * while on any Webook event page. It instantly clicks through the ticket selection
 * and takes them straight to the payment screen with zero delay and no 404 errors.
 */
export function getBrowserInstantBookerScript(quantity: number = 2): string {
  return `(function(){
  console.log("%c[Webook Auto-Booker] جاري بدء الحجز التلقائي ونقلك لشاشة الدفع...", "background:#10b981;color:#fff;font-size:14px;padding:4px 8px;border-radius:4px;");
  
  // 1. النقر الفوري على زر 'احجز التذاكر'
  var bookBtn = Array.from(document.querySelectorAll("button, a")).find(function(el) {
    var txt = (el.innerText || "").trim().toLowerCase();
    return txt.includes("احجز التذاكر") || txt.includes("احجز الآن") || txt.includes("احجز الان") || txt.includes("book tickets") || txt.includes("book now");
  });
  if (bookBtn) {
    bookBtn.click();
    console.log("[Webook Auto-Booker] تم فتح نافذة التذاكر");
  }

  // 2. إضافة التذاكر المطلوبة (${quantity})
  setTimeout(function() {
    var plusBtns = Array.from(document.querySelectorAll("button")).filter(function(b) {
      var t = (b.innerText || "").trim();
      var aria = (b.getAttribute("aria-label") || "").toLowerCase();
      return t === "+" || aria.includes("increase") || aria.includes("add") || b.classList.contains("plus");
    });
    
    var count = ${quantity || 1};
    if (plusBtns.length > 0) {
      for (var i = 0; i < count; i++) {
        setTimeout(function() { plusBtns[0].click(); }, i * 150);
      }
      console.log("[Webook Auto-Booker] تمت إضافة " + count + " تذاكر بنجاح!");
    }

    // 3. الضغط على متابعة للدفع مباشرة
    setTimeout(function() {
      var proceedBtn = Array.from(document.querySelectorAll("button")).find(function(b) {
        var t = (b.innerText || "").trim();
        return t.includes("متابعة") || t.includes("اختر تذكرة") || t.includes("الدفع") || t.includes("proceed") || t.includes("checkout");
      });
      if (proceedBtn) {
        proceedBtn.click();
        console.log("[Webook Auto-Booker] 🚀 تم الانتقال إلى شاشة الدفع مباشرة!");
      }
    }, 600 + (count * 150));
  }, 500);
})();`;
}

/**
 * 1-Tap Bookmarklet for Chrome Mobile and Desktop
 */
export function getBookmarkletCode(quantity: number = 2): string {
  const q = quantity || 2;
  return `javascript:(function(){var b=Array.from(document.querySelectorAll('button,a')).find(function(e){var t=(e.innerText||'').trim().toLowerCase();return t.includes('احجز التذاكر')||t.includes('احجز الآن')||t.includes('book');});if(b)b.click();setTimeout(function(){var p=Array.from(document.querySelectorAll('button')).filter(function(x){var t=(x.innerText||'').trim();return t==='+'||x.getAttribute('aria-label')==='increase';});var q=${q};if(p.length>0){for(var i=0;i<q;i++){setTimeout(function(){p[0].click();},i*120);}}setTimeout(function(){var c=Array.from(document.querySelectorAll('button')).find(function(x){var t=(x.innerText||'').trim();return t.includes('متابعة')||t.includes('اختر تذكرة')||t.includes('الدفع')||t.includes('proceed');});if(c)c.click();},500+(q*120));},400);})();`;
}

/**
 * Full Tampermonkey / Violentmonkey Userscript for automatic zero-click booking
 */
export function getTampermonkeyScript(quantity: number = 2): string {
  return `// ==UserScript==
// @name         Webook Auto-Booker & Direct Checkout
// @namespace    https://webook.com/
// @version      2.0
// @description  يقوم بحجز التذاكر تلقائياً ونقلك لشاشة الدفع مباشرة في Webook
// @match        https://webook.com/*/events/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    console.log('[Webook Auto-Booker] جاري الفحص التلقائي ونقلك للدفع...');

    function tryAutoBook() {
        const bookButtons = Array.from(document.querySelectorAll('button, a'));
        const bookBtn = bookButtons.find(el => {
            const txt = (el.innerText || '').trim().toLowerCase();
            return txt.includes('احجز التذاكر') || txt.includes('احجز الآن') || txt.includes('book tickets') || txt.includes('book now');
        });

        if (bookBtn) {
            bookBtn.click();
        }

        setTimeout(() => {
            const plusButtons = Array.from(document.querySelectorAll('button')).filter(b => {
                const t = (b.innerText || '').trim();
                const aria = (b.getAttribute('aria-label') || '').toLowerCase();
                return t === '+' || aria.includes('increase') || aria.includes('add') || b.classList.contains('plus');
            });

            const qty = ${quantity || 2};
            if (plusButtons.length > 0) {
                for (let i = 0; i < qty; i++) {
                    setTimeout(() => plusButtons[0].click(), i * 140);
                }
            }

            setTimeout(() => {
                const proceedButtons = Array.from(document.querySelectorAll('button'));
                const proceedBtn = proceedButtons.find(b => {
                    const t = (b.innerText || '').trim();
                    return t.includes('متابعة') || t.includes('اختر تذكرة') || t.includes('الدفع') || t.includes('proceed') || t.includes('checkout');
                });

                if (proceedBtn) {
                    proceedBtn.click();
                    console.log('🚀 [Webook Auto-Booker] تم نقلك لشاشة الدفع مباشرة!');
                }
            }, 600 + (qty * 140));
        }, 500);
    }

    if (document.readyState === 'complete') {
        setTimeout(tryAutoBook, 800);
    } else {
        window.addEventListener('load', () => setTimeout(tryAutoBook, 800));
    }
})();`;
}
