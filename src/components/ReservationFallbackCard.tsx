import React, { useState } from 'react';
import { 
  AlertTriangle, 
  Terminal, 
  Check, 
  RefreshCw, 
  FileCode, 
  X, 
  Sparkles, 
  ShieldAlert,
  HelpCircle,
  Code
} from 'lucide-react';
import { ReservationErrorState, ReservationFallbackPayload } from '../types/bot';

interface ReservationFallbackCardProps {
  errorState: ReservationErrorState;
  onApplyCustomPayload: (payload: ReservationFallbackPayload) => void;
  onRetry?: () => void;
  onDismiss?: () => void;
  defaultTotalPrice?: number;
  selectedSeatsCount?: number;
}

export const ReservationFallbackCard: React.FC<ReservationFallbackCardProps> = ({
  errorState,
  onApplyCustomPayload,
  onRetry,
  onDismiss,
  defaultTotalPrice = 150,
  selectedSeatsCount = 2,
}) => {
  const [activeTab, setActiveTab] = useState<'json' | 'form'>('json');
  
  // JSON Editor state
  const defaultTemplate = JSON.stringify(
    {
      cartId: 'CUSTOM_WBK_' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      holdExpiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      totalPrice: defaultTotalPrice || 150,
      directCheckoutUrl: 'https://webook.com/ar/checkout',
      directBookingUrl: 'https://webook.com/ar',
      status: 'confirmed_by_custom_payload',
      seatsCount: selectedSeatsCount || 2,
      note: 'Custom verified test payload provided by user'
    },
    null,
    2
  );

  const [rawJson, setRawJson] = useState<string>(defaultTemplate);
  const [jsonError, setJsonError] = useState<string>('');

  // Form Editor state
  const [customCartId, setCustomCartId] = useState<string>('CUSTOM_CART_' + Date.now().toString().slice(-6));
  const [customPrice, setCustomPrice] = useState<number>(defaultTotalPrice || 150);
  const [customCheckoutUrl, setCustomCheckoutUrl] = useState<string>('https://webook.com/ar/checkout');

  const handleApplyJson = () => {
    try {
      setJsonError('');
      const parsed = JSON.parse(rawJson);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('يجب أن تكون الحمولة كائن JSON صالح {}');
      }

      onApplyCustomPayload({
        cartId: parsed.cartId || customCartId,
        holdExpiresAt: parsed.holdExpiresAt || new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        totalPrice: Number(parsed.totalPrice ?? customPrice),
        directCheckoutUrl: parsed.directCheckoutUrl || customCheckoutUrl,
        directBookingUrl: parsed.directBookingUrl || 'https://webook.com/ar',
        seats: parsed.seats,
        isCustomPayload: true,
        customRawJson: rawJson,
      });
    } catch (err: any) {
      setJsonError(`خطأ في صياغة JSON: ${err.message}`);
    }
  };

  const handleApplyForm = () => {
    onApplyCustomPayload({
      cartId: customCartId.trim() || ('CART_' + Date.now()),
      holdExpiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      totalPrice: Number(customPrice) || 0,
      directCheckoutUrl: customCheckoutUrl.trim() || 'https://webook.com/ar/checkout',
      directBookingUrl: 'https://webook.com/ar',
      isCustomPayload: true,
      customRawJson: JSON.stringify({
        cartId: customCartId,
        totalPrice: customPrice,
        directCheckoutUrl: customCheckoutUrl,
      }, null, 2),
    });
  };

  const handleResetTemplate = () => {
    setRawJson(defaultTemplate);
    setJsonError('');
  };

  return (
    <div className="bg-[#0c101a] border-2 border-amber-500/50 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5 animate-in fade-in relative overflow-hidden" dir="rtl">
      {/* Background Accent */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <ShieldAlert className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
                واجهة المعالجة التفاعلية (Fallback UI)
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {errorState.endpoint || '/api/webook/hold-seats'}
              </span>
            </div>
            <h4 className="text-sm sm:text-base font-bold text-white mt-1">
              تعذر استلام بيانات الحجز من نقطة النهاية (API Failure / Empty Data)
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              تم حظر إظهار أي تأكيد حجز وهمي أو شاشة نجاح مضللة. يمكنك فحص الخطأ أو إدخال استجابة JSON مخصصة مباشرة.
            </p>
          </div>
        </div>

        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-slate-500 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            title="إغلاق الواجهة البديلة"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Real Error Details Card */}
      <div className="bg-rose-950/30 border border-rose-500/40 rounded-2xl p-3.5 space-y-2 text-xs">
        <div className="flex items-center justify-between text-rose-300 font-bold">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>تفاصيل الرد من الخادم:</span>
          </div>
          {errorState.timestamp && (
            <span className="font-mono text-[10px] text-rose-400">{errorState.timestamp}</span>
          )}
        </div>
        <p className="text-rose-200/90 text-xs font-mono leading-relaxed bg-black/40 p-2.5 rounded-xl border border-rose-500/20 break-words">
          {errorState.message || 'لم يرجع خادم الحجز استجابة سلة صالحة. تم إيقاف أي شاشة تأكيد وهمية.'}
        </p>
      </div>

      {/* Interactive Mode Tabs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('json')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'json'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              <span>إدخال حمولة JSON مخصصة (Custom Payload)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('form')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'form'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>حقول إدخال يدوية سريعة</span>
            </button>
          </div>

          {activeTab === 'json' && (
            <button
              type="button"
              onClick={handleResetTemplate}
              className="text-[11px] text-slate-400 hover:text-amber-300 underline cursor-pointer"
            >
              استعادة نموذج الاختبار الافتراضي
            </button>
          )}
        </div>

        {/* Tab 1: Custom JSON Payload Textarea */}
        {activeTab === 'json' && (
          <div className="space-y-2">
            <div className="relative">
              <textarea
                value={rawJson}
                onChange={(e) => {
                  setRawJson(e.target.value);
                  setJsonError('');
                }}
                rows={7}
                placeholder="الصق هنا كائن استجابة JSON الخاص باختبار الحجز..."
                className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-2xl p-3.5 font-mono text-xs text-amber-200/90 leading-relaxed focus:outline-none shadow-inner"
                dir="ltr"
                spellCheck={false}
              />
            </div>

            {jsonError && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{jsonError}</span>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Manual Form Fields */}
        {activeTab === 'form' && (
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] text-slate-400 font-medium mb-1">
                رقم السلة / المرجع (Cart ID):
              </label>
              <input
                type="text"
                value={customCartId}
                onChange={(e) => setCustomCartId(e.target.value)}
                placeholder="مثال: WBK_CART_9981"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-amber-500 focus:outline-none"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 font-medium mb-1">
                السعر الإجمالي (ر.س):
              </label>
              <input
                type="number"
                value={customPrice}
                onChange={(e) => setCustomPrice(Number(e.target.value))}
                placeholder="150"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-amber-500 focus:outline-none"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 font-medium mb-1">
                رابط الدفع المباشر:
              </label>
              <input
                type="text"
                value={customCheckoutUrl}
                onChange={(e) => setCustomCheckoutUrl(e.target.value)}
                placeholder="https://webook.com/ar/checkout"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-amber-500 focus:outline-none"
                dir="ltr"
              />
            </div>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
        <div className="flex items-center gap-2">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>إعادة إرسال طلب الحجز (Retry API)</span>
            </button>
          )}

          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="px-3 py-2 text-slate-400 hover:text-slate-300 text-xs transition cursor-pointer"
            >
              تجاهل
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={activeTab === 'json' ? handleApplyJson : handleApplyForm}
          className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 transition flex items-center gap-2 cursor-pointer"
        >
          <Check className="w-4 h-4 stroke-[3]" />
          <span>تطبيق استجابة الاختبار المخصصة (Apply Test Payload)</span>
        </button>
      </div>
    </div>
  );
};
