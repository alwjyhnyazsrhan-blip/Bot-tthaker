import React from 'react';
import { 
  X, Zap, CheckCircle2, ExternalLink, ShieldCheck, 
  Sparkles, CreditCard, Ticket, Clock, Check
} from 'lucide-react';
import { WEBOOK_MY_BOOKINGS_URL } from '../utils/webookUrls';

interface BotGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInstantBook?: () => void;
}

export const BotGuideModal: React.FC<BotGuideModalProps> = ({
  isOpen,
  onClose,
  onInstantBook,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div 
        className="bg-[#0e1322] border-2 border-purple-500/40 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-5 left-5 text-slate-400 hover:text-white p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-right">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold mb-3 border border-emerald-500/30">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>نظام الحجز التلقائي الجاهز (بدون أوامر برمجية أو برامج إضافية)</span>
          </div>

          <h3 className="text-xl font-black text-white mb-2">
            كيف يعمل البوت مباشرة لنقلك لشاشة الدفع فقط؟
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed mb-6">
            النظام مهيأ بالكامل ليعمل بشكل سحابي ومباشر من واجهة المتصفح، بدون الحاجة لتثبيت بايثون، ولا كتابة أوامر في الطرفية (CMD)، ولا تشغيل أي برامج خارجية.
          </p>

          <div className="space-y-4 text-xs">
            {/* Step 1 */}
            <div className="bg-[#080b12] p-4 rounded-2xl border border-slate-800 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-xl bg-purple-600/30 border border-purple-500/40 text-purple-300 font-black flex items-center justify-center text-xs">
                  1
                </span>
                <h4 className="font-bold text-white text-sm">اختيار الفعالية وتحديد المقاعد</h4>
              </div>
              <p className="text-slate-300 mr-9 leading-relaxed">
                اختر الفعالية من المنصة الرسمية أو مخطط المقاعد التفاعلي، وحدد عدد التذاكر التي ترغب بها (أو اختر المقاعد المحددة بنفسك).
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-[#080b12] p-4 rounded-2xl border border-slate-800 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-xl bg-purple-600/30 border border-purple-500/40 text-purple-300 font-black flex items-center justify-center text-xs">
                  2
                </span>
                <h4 className="font-bold text-white text-sm">الضغط على زر الحجز السريع المباشر (1-Click)</h4>
              </div>
              <p className="text-slate-300 mr-9 leading-relaxed">
                اضغط على زر <strong className="text-emerald-400 font-bold">"🚀 الحجز التلقائي ونقلي للدفع فوراً"</strong>. يتولى البوت أوتوماتيكياً كافة العمليات في أجزاء من الثانية.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-[#080b12] p-4 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-xl bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 font-black flex items-center justify-center text-xs">
                  3
                </span>
                <h4 className="font-bold text-white text-sm">الدفع النهائي ببطاقتك البنكية فقط</h4>
              </div>
              <p className="text-slate-300 mr-9 leading-relaxed">
                تفتح شاشة الدفع المباشرة مع حجز مقاعدك لمدة 10 دقائق رسمياً. كل ما عليك هو اختيار طريقة السداد (Apple Pay أو مدى أو فيزا) وتأكيد الدفع بأمان.
              </p>
            </div>

            {/* Guarantees Box */}
            <div className="bg-slate-900/90 border border-purple-500/30 p-4 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 font-bold text-white">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>مميزات الأتمتة المباشرة:</span>
              </div>
              <ul className="text-[11px] text-slate-300 space-y-1.5 mr-2">
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>بدون أي أكواد أو برامج: يعمل مباشرة على جوالك أو حاسوبك بنقرة زر واحدة.</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>روابط موثقة 100%: تم إلغاء كافة مسارات الخطأ 404 نهائياً.</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>تثبيت حجز المقاعد لمدة 10 دقائق لضمان عدم سرقتها أثناء كتابة بيانات بطاقتك.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Action Button */}
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => {
                onClose();
                if (onInstantBook) onInstantBook();
              }}
              className="flex-1 py-3.5 px-4 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-500/25 transition cursor-pointer flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4 fill-slate-950" />
              <span>فهمت — أريد الحجز التلقائي المباشر الآن</span>
            </button>

            <a
              href={WEBOOK_MY_BOOKINGS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="py-3.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 text-center"
            >
              <span>التحقق من صفحة "حجوزاتي"</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
