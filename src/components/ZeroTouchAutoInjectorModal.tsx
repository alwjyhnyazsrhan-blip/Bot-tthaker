import React, { useState } from 'react';
import { 
  X, Zap, Download, CheckCheck, Chrome, Bookmark, Laptop, 
  ShieldCheck, HelpCircle, ExternalLink, Sparkles, AlertCircle, Play, Copy
} from 'lucide-react';
import { WebookEvent, Seat, BotConfig, ReservationErrorState, ReservationFallbackPayload } from '../types/bot';
import { downloadWebookExtensionZip } from '../utils/extensionGenerator';
import { getBookmarkletCode, getWebookBookingUrl, getWebookDirectCheckoutUrl, getBrowserInstantBookerScript } from '../utils/webookUrls';
import { ReservationFallbackCard } from './ReservationFallbackCard';

interface ZeroTouchAutoInjectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: WebookEvent;
  selectedSeats: Seat[];
  config: BotConfig;
}

export const ZeroTouchAutoInjectorModal: React.FC<ZeroTouchAutoInjectorModalProps> = ({
  isOpen,
  onClose,
  event,
  selectedSeats,
  config,
}) => {
  const [activeTab, setActiveTab] = useState<'direct' | 'extension' | 'bookmarklet' | 'python'>('direct');
  const [isInjecting, setIsInjecting] = useState<boolean>(false);
  const [injectionResult, setInjectionResult] = useState<{
    success: boolean;
    cartId: string;
    expiresAt: string;
    totalPrice: number;
    message: string;
    isCustomPayload?: boolean;
  } | null>(null);
  const [apiError, setApiError] = useState<ReservationErrorState | null>(null);
  const [accountEmailInput, setAccountEmailInput] = useState<string>('');
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);
  const [copiedBookmarklet, setCopiedBookmarklet] = useState<boolean>(false);

  if (!isOpen) return null;

  const directBookingUrl = getWebookBookingUrl(event);
  const bookmarkletCode = getBookmarkletCode(config.ticketQuantity || selectedSeats.length || 2);

  const handleExecuteDirectInjection = async () => {
    setIsInjecting(true);
    setApiError(null);
    try {
      const res = await fetch('/api/webook/hold-seats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: event.id,
          eventUrl: event.url,
          seats: selectedSeats.length > 0 ? selectedSeats : [
            { id: 'seat_auto_1', row: 'A', number: 1, label: 'الصف A - مقعد 1', tierId: config.preferredTier || 'vip', tierNameAr: 'تذكرة مؤكدة', price: event.tiers[0]?.price || 150, status: 'available' },
            { id: 'seat_auto_2', row: 'A', number: 2, label: 'الصف A - مقعد 2', tierId: config.preferredTier || 'vip', tierNameAr: 'تذكرة مؤكدة', price: event.tiers[0]?.price || 150, status: 'available' },
          ],
          email: accountEmailInput.trim() || 'user@webook.com',
          date: config.selectedDate,
          tier: config.preferredTier,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data && data.success && data.cartId) {
        setInjectionResult({
          success: true,
          cartId: data.cartId,
          expiresAt: data.holdExpiresAt || new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          totalPrice: data.totalPrice || 150,
          message: data.message || 'تم حجز وقفل المقاعد بنجاح في سلة Webook الرسمية!',
          isCustomPayload: Boolean(data.isCustomPayload),
        });
        setApiError(null);
      } else {
        // Honest error handling - no fake mock cart or success state!
        setInjectionResult(null);
        setApiError({
          hasError: true,
          message: data?.message || `فشل الحجز السحابي من خادم المنصة (كود ${res.status}): لم يتم إرجاع سلة صالحة.`,
          endpoint: '/api/webook/hold-seats',
          timestamp: new Date().toLocaleTimeString(),
          rawError: data,
        });
      }
    } catch (err: any) {
      // Honest network error handling - no fake mock cart or success state!
      setInjectionResult(null);
      setApiError({
        hasError: true,
        message: `تعذر الاتصال بخادم الحجز: ${err.message || 'خطأ في الشبكة'}`,
        endpoint: '/api/webook/hold-seats',
        timestamp: new Date().toLocaleTimeString(),
        rawError: err,
      });
    } finally {
      setIsInjecting(false);
    }
  };

  const handleApplyCustomPayload = (payload: ReservationFallbackPayload) => {
    setInjectionResult({
      success: true,
      cartId: payload.cartId || ('CUSTOM_TEST_' + Date.now().toString().slice(-6)),
      expiresAt: payload.holdExpiresAt || new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      totalPrice: payload.totalPrice || 150,
      message: 'تم تطبيق استجابة الاختبار المخصصة بنجاح بواسطة المستخدم',
      isCustomPayload: true,
    });
    setApiError(null);
  };

  const handleDownloadExtension = async () => {
    setIsDownloading(true);
    try {
      await downloadWebookExtensionZip(event, selectedSeats, config);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 5000);
    } catch (err) {
      console.error('Failed to generate extension zip', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyBookmarklet = () => {
    navigator.clipboard.writeText(bookmarkletCode);
    setCopiedBookmarklet(true);
    setTimeout(() => setCopiedBookmarklet(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
      <div 
        className="bg-[#0e1322] border-2 border-purple-500/50 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-950/80 via-indigo-950/70 to-slate-900 px-5 sm:px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
              <Zap className="w-5 h-5 fill-purple-400 text-purple-400" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>الحقن التلقائي بالكامل (Zero-Touch)</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold">
                  بدون أي تدخل يدوي
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                قفل المقاعد في سلة حسابك على Webook تلقائياً فوراً دون فتح F12 ودون نسخ أي كود يدوي
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 p-2 gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('direct')}
            className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'direct'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Zap className="w-4 h-4 fill-amber-300 text-amber-300" />
            <span>⚡ 1. الحقن التلقائي الفوري (دون أي تدخل)</span>
          </button>

          <button
            onClick={() => setActiveTab('extension')}
            className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'extension'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Chrome className="w-4 h-4" />
            <span>2. إضافة كروم الذاتية</span>
          </button>

          <button
            onClick={() => setActiveTab('bookmarklet')}
            className={`flex-1 min-w-[110px] py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'bookmarklet'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Bookmark className="w-4 h-4" />
            <span>3. شريط الإشارات</span>
          </button>

          <button
            onClick={() => setActiveTab('python')}
            className={`flex-1 min-w-[110px] py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'python'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Laptop className="w-4 h-4" />
            <span>4. بوت بايثون المكتبي</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-right">
          {/* TAB 0: Direct Zero-Touch Autonomous Injection */}
          {activeTab === 'direct' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-emerald-950/50 via-slate-900 to-teal-950/50 border-2 border-emerald-500/50 rounded-2xl p-5 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-emerald-300 font-black text-sm">
                    <ShieldCheck className="w-6 h-6 text-emerald-400" />
                    <span>الحقن التلقائي الذاتي بنقرة واحدة (بدون أي تدخل يدوي إطلاقاً):</span>
                  </div>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold">
                    Zero-Touch Instant
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  يقوم البوت بالاتصال المباشر بخوادم <strong className="text-white">api.webook.com</strong> وقفل تذاكر فعالية (<strong className="text-emerald-300">{event.titleAr}</strong>) في السلة فوراً لمدة 10 دقائق دون أن تفتح أي كونسول، ودون نسخ أي أكواد، ودون فتح F12!
                </p>

                {/* Target Seats / Tiers Summary */}
                <div className="bg-slate-950/80 rounded-xl p-3.5 border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">المقاعد / التذاكر المستهدفة:</span>
                    <span className="font-bold text-white font-mono">
                      {selectedSeats.length > 0 
                        ? selectedSeats.map(s => s.label).join('، ') 
                        : `${config.ticketQuantity || 2} تذاكر (فئة ${config.preferredTier || 'المعتمدة'})`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">إجمالي المبلغ المحسوب:</span>
                    <span className="font-black text-emerald-400 font-mono text-sm">
                      {selectedSeats.reduce((a, b) => a + (b.price || 0), 0) || (event.tiers[0]?.price || 85) * (config.ticketQuantity || 2)} ر.س
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-900">
                    <span className="text-slate-400">حساب Webook المستهدف (اختياري):</span>
                    <input
                      type="text"
                      placeholder="بريدك أو رقم الجوال في Webook"
                      value={accountEmailInput}
                      onChange={(e) => setAccountEmailInput(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-500 text-left font-mono w-56 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Fallback Card if API Error occurs */}
                {apiError && (
                  <ReservationFallbackCard
                    errorState={apiError}
                    onApplyCustomPayload={handleApplyCustomPayload}
                    onRetry={handleExecuteDirectInjection}
                    onDismiss={() => setApiError(null)}
                    defaultTotalPrice={selectedSeats.reduce((a, b) => a + (b.price || 0), 0) || (event.tiers[0]?.price || 85) * (config.ticketQuantity || 2)}
                    selectedSeatsCount={selectedSeats.length || config.ticketQuantity || 2}
                  />
                )}

                {/* Result Box if Injected */}
                {injectionResult && !apiError && (
                  <div className="bg-emerald-950/80 border-2 border-emerald-400 rounded-2xl p-4 sm:p-5 text-center space-y-4 animate-in zoom-in-95">
                    <div className="w-11 h-11 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center mx-auto font-black text-xl shadow-lg shadow-emerald-500/40">
                      ✓
                    </div>
                    <div>
                      <div className="font-black text-base text-white">{injectionResult.message}</div>
                      {injectionResult.isCustomPayload && (
                        <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          تم الحجز باستخدام حمولة اختبار مخصصة
                        </span>
                      )}
                      <div className="text-xs text-emerald-300 font-mono mt-1">
                        رقم السلة / الجلسة: <strong className="text-white">{injectionResult.cartId}</strong>
                      </div>
                      <p className="text-xs text-slate-300 mt-2 leading-relaxed max-w-md mx-auto">
                        تم تجهيز الروابط المباشرة لتخطي صفحة الفعالية العامة والدخول مباشرة إلى السداد أو شاشة التذاكر:
                      </p>
                    </div>

                    {/* Action Buttons: Payment & Direct Booking */}
                    <div className="space-y-2.5 pt-1">
                      {/* Button 1: Direct Payment & Checkout */}
                      <a
                        href={getWebookDirectCheckoutUrl()}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-6 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-sm rounded-xl shadow-xl shadow-amber-500/30 transition transform hover:scale-[1.01]"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>💳 1. الانتقال المباشر لشاشة الدفع والسداد (/checkout)</span>
                      </a>
                      <div className="text-[11px] text-slate-400">
                        يفتح شاشة إتمام الدفع بالبطاقة أو مدى مباشرة إذا كانت جلستك نشطة في Webook
                      </div>

                      {/* Button 2: Direct Ticket Selection /book */}
                      <a
                        href={directBookingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-2 w-full py-3 px-6 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-lg transition transform hover:scale-[1.01]"
                      >
                        <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                        <span>⚡ 2. فتح مسار حجز التذاكر المباشر (/book)</span>
                      </a>
                      <div className="text-[11px] text-slate-400">
                        يتخطى صفحة الفعالية العامة وزر "احجز التذاكر" ويدخلك مباشرة لاختيار المقاعد وتأكيد الحجز
                      </div>
                    </div>

                    {/* Mobile Auto-Sniper Assistant */}
                    <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 text-right space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                          <Laptop className="w-4 h-4 text-emerald-400" />
                          <span>قناص الجوال التلقائي بنقرة واحدة (لـ Android و iPhone):</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const code = getBrowserInstantBookerScript(config.ticketQuantity || selectedSeats.length || 1);
                            navigator.clipboard.writeText(code);
                            setCopiedBookmarklet(true);
                            setTimeout(() => setCopiedBookmarklet(false), 3000);
                          }}
                          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-bold rounded-lg transition flex items-center gap-1 cursor-pointer"
                        >
                          {copiedBookmarklet ? (
                            <>
                              <CheckCheck className="w-3.5 h-3.5" />
                              <span>تم النسخ!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>نسخ كود القنص السريع</span>
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        عند فتح صفحة Webook على هاتفك، اضغط على شريط الإشارات أو الصق الكود ليتولى البوت اختيار التذاكر ونقلك لشاشة الدفع تلقائياً في أقل من ثانية!
                      </p>
                    </div>
                  </div>
                )}

                {/* Big Action Button */}
                {!injectionResult && (
                  <button
                    onClick={handleExecuteDirectInjection}
                    disabled={isInjecting}
                    className="w-full py-4 px-6 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-sm rounded-2xl shadow-xl shadow-emerald-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer transform hover:scale-[1.01]"
                  >
                    {isInjecting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                        <span>جاري الاتصال بخوادم Webook وقفل المقاعد تلقائياً...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-5 h-5 fill-slate-950" />
                        <span>🚀 تنفيذ الحقن التلقائي وقفل التذاكر فوراً (بدون تدخل)</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB 1: Chrome Extension */}
          {activeTab === 'extension' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-emerald-950/40 via-slate-900 to-purple-950/40 border border-emerald-500/40 rounded-2xl p-4.5 space-y-3">
                <div className="flex items-center gap-2.5 text-emerald-300 font-bold text-sm">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <span>الحل التلقائي الشامل بنسبة 100% دون فتح أدوات المطورين:</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  هذه إضافة Google Chrome رسمية مخصصة لفعاليتك الحالية (<strong className="text-white">{event.titleAr}</strong>).
                  بمجرد تثبيتها لمرة واحدة، تقوم الإضافة تلقائياً باكتشاف دخولك لمنصة Webook وتتولى قفل المقاعد واختيارها ونقلك لشاشة الدفع بالبطاقة في أقل من ثانية دون أن تلمس الكيبورد إطلاقاً!
                </p>

                {/* Big Download Button */}
                <div className="pt-2">
                  <button
                    onClick={handleDownloadExtension}
                    disabled={isDownloading}
                    className="w-full py-4 px-6 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-sm rounded-2xl shadow-xl shadow-emerald-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer transform hover:scale-[1.01]"
                  >
                    {isDownloading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                        <span>جاري إنشاء وتجهيز حزمة الإضافة...</span>
                      </>
                    ) : downloadSuccess ? (
                      <>
                        <CheckCheck className="w-5 h-5" />
                        <span>تم تنزيل حزمة الإضافة بنجاح (webook-auto-injector.zip)!</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-5 h-5" />
                        <span>⚡ تنزيل إضافة كروم للحقن التلقائي الفوري (Download ZIP)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* 3 Step Installation Guide */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4.5 space-y-3">
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span>طريقة التفعيل في متصفح Google Chrome (في دقيقة واحدة فقط):</span>
                </h4>

                <div className="space-y-2.5 text-xs text-slate-300">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-purple-600/30 text-purple-300 flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">1</span>
                    <span>قم بفك الضغط (Extract / Unzip) عن الملف الذي قمت بتنزيله.</span>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-purple-600/30 text-purple-300 flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">2</span>
                    <div>
                      <span>افتح متصفح Chrome واكتب في شريط العناوين: </span>
                      <code className="bg-slate-950 px-2 py-0.5 rounded text-pink-400 font-mono font-bold">chrome://extensions</code>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-purple-600/30 text-purple-300 flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">3</span>
                    <span>فعّل خيار <strong className="text-amber-400">"وضع مطور البرامج" (Developer mode)</strong> أعلى اليمين، ثم اضغط <strong className="text-emerald-400">"تحميل حزمة غير مضغوطة" (Load unpacked)</strong> واختر المجلد المفكوك.</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-500/30 text-xs text-purple-200 flex items-center gap-2">
                  <CheckCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>بعدها، افتح صفحة الفعالية في Webook وستجد المقاعد تُحجز فوراً في سلتك تلقائياً دون أي تدخل منك!</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Bookmarklet */}
          {activeTab === 'bookmarklet' && (
            <div className="space-y-4">
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4.5 space-y-3">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Bookmark className="w-4 h-4 text-amber-400" />
                  <span>طريقة شريط الإشارات (نقرة واحدة فقط بدون F12):</span>
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  إذا كنت لا ترغب بتثبيت إضافة على المتصفح، يمكنك وضع زر في شريط الإشارات (المفضلة Bookmarks Bar).
                  وعند فتح صفحة الفعالية على Webook تضغط نقرة واحدة على الإشارة ليقوم بحجز المقاعد فوراً دون فتح أي كونسول.
                </p>

                <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                  {/* Draggable Bookmarklet Link */}
                  <a
                    href={bookmarkletCode}
                    onClick={(e) => {
                      e.preventDefault();
                      handleCopyBookmarklet();
                    }}
                    className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-grab active:cursor-grabbing"
                    title="اسحب هذا الزر إلى شريط إشارات متصفحك (Bookmarks Bar)"
                  >
                    <Bookmark className="w-4 h-4 fill-slate-950" />
                    <span>⚡ اسحب هذا الزر لشريط الإشارات (Webook Auto-Hold)</span>
                  </a>

                  <button
                    onClick={handleCopyBookmarklet}
                    className="w-full sm:w-auto px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {copiedBookmarklet ? (
                      <>
                        <CheckCheck className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-300">تم نسخ رابط الإشارة!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>نسخ رابط الإشارة</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Desktop Python/Selenium Bot */}
          {activeTab === 'python' && (
            <div className="space-y-4">
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4.5 space-y-3">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Laptop className="w-4 h-4 text-blue-400" />
                  <span>تشغيل بوت المتصفح المكتبي التلقائي (Selenium / Playwright):</span>
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  يقوم سكربت البايثون بتشغيل متصفح Chrome الحقيقي على جهازك تلقائياً بالكامل، ويسجل الدخول بحسابك في Webook، ويحل اختبارات الحماية، ثم يحجز المقاعد المحددة في المخطط وينقلك لشاشة السداد مع إبقاء المتصفح مفتوحاً.
                </p>

                <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 font-mono text-xs text-slate-300 space-y-1">
                  <div className="text-slate-500"># تشغيل البوت بأمر واحد:</div>
                  <div className="text-emerald-400">pip install -r requirements.txt</div>
                  <div className="text-emerald-400">python main.py</div>
                </div>
              </div>
            </div>
          )}

          {/* Direct Link to Webook */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>صفحة الفعالية المستهدفة:</span>
            <a
              href={directBookingUrl}
              target="_blank"
              rel="noreferrer"
              className="text-pink-400 hover:text-pink-300 flex items-center gap-1 font-bold underline"
            >
              <span>فتح صفحة {event.titleAr} في Webook</span>
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
