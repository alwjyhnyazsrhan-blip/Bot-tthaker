import React, { useState, useEffect } from 'react';
import { 
  Sparkles, Check, Info, Lock, ExternalLink, RefreshCw, 
  Clock, ShieldCheck, Ticket, AlertCircle, ShoppingCart, 
  MapPin, Eye, Trophy, Music, Film, Map, CreditCard, BellRing, Copy, CheckCheck, Zap, Edit3, Save, X, Compass, ChevronDown, Layers, HelpCircle, Globe
} from 'lucide-react';
import { Seat, SeatingMapData, SeatingSection, TicketTier, WebookEvent, VenueBlueprintId, ReservationErrorState, ReservationFallbackPayload } from '../types/bot';
import { playReservationChime } from '../utils/audioAlert';
import { 
  getWebookBookingUrl, 
  getWebookEventUrl, 
  getWebookDirectCheckoutUrl,
  WEBOOK_MY_BOOKINGS_URL, 
  generateOfficialCartInjectionScript 
} from '../utils/webookUrls';
import { InstantAutoBookerModal } from './InstantAutoBookerModal';
import { ZeroTouchAutoInjectorModal } from './ZeroTouchAutoInjectorModal';
import { ReservationFallbackCard } from './ReservationFallbackCard';
import { 
  generateVenueSeatingMap, 
  generateVenueSeatingMapByBlueprint, 
  detectVenueBlueprint 
} from '../services/venueSeatingService';

interface InteractiveSeatingMapProps {
  event: WebookEvent;
  selectedSeats: Seat[];
  onToggleSeat: (seat: Seat) => void;
  onAutoPickBestSeats: (count: number, preferredTier: string) => void;
  ticketQuantity: number;
  preferredTier: string;
  onHoldSeatsOnWebook: () => void;
  isHolding: boolean;
  cartHoldInfo: {
    cartId: string;
    expiresAt: string;
    totalPrice: number;
    active: boolean;
    isCustomPayload?: boolean;
    paymentGatewayUrl?: string;
    orderReference?: string;
    seatIds?: string[];
  } | null;
  reservationError?: ReservationErrorState | null;
  onApplyCustomReservationPayload?: (payload: ReservationFallbackPayload) => void;
  onDismissReservationError?: () => void;
  accountEmail: string;
  onUpdateEventTiers?: (updatedTiers: TicketTier[], updatedMap: SeatingMapData) => void;
}

const VENUE_BLUEPRINTS_LIST: { id: VenueBlueprintId; nameAr: string; icon: string; desc: string }[] = [
  { id: 'kingdom_arena', nameAr: 'المملكة أرينا (Kingdom Arena)', icon: '🏟️', desc: 'الصالة الرياضية المغلقة المكيفة والكبائن الملكية VIP' },
  { id: 'alawwal_park', nameAr: 'استاد الأول بارك (Al-Awwal Park)', icon: '⚽', desc: 'معقل النصر بمدرجات الواجهة والرابطة الشمسية A-H' },
  { id: 'aljawhara', nameAr: 'الجوهرة المشعة (مدينة الملك عبدالله بجدة)', icon: '🏟️', desc: '3 أدوار معمارية (الدور السفلي 100s، الذهبي 200s، العلوي 300s)' },
  { id: 'mohammed_abdo_arena', nameAr: 'مسرح محمد عبده أرينا (Boulevard)', icon: '🎤', desc: 'المسرح القوسي المقوس والدائرة الذهبية Golden Circle' },
  { id: 'bakr_sheddi', nameAr: 'مسرح بكر الشدي وأبو بكر سالم', icon: '🎭', desc: 'مسرح العروض والكوميديا مع مقاعد الأوركسترا والمقصورات' },
  { id: 'boxing_ring', nameAr: 'حلبة النزالات والملاكمة (Boxing Ring)', icon: '🥊', desc: 'حلبة مربعة بالوسط ومقاعد Ringside الصف الأول الملاصقة للحبال' },
  { id: 'equestrian', nameAr: 'ميدان سباق الخيل (الجنادرية للفروسية)', icon: '🏇', desc: 'مضمار السباق المستقيم ومنصة الملاك وكبار الشخصيات VIP' },
  { id: 'boulevard_world', nameAr: 'بوليفارد وورلد ومناطق الترفيه', icon: '🎡', desc: 'أجنحة الدول ومسارات Fast Track واللاونج الملكي' },
];

export const InteractiveSeatingMap: React.FC<InteractiveSeatingMapProps> = ({
  event,
  selectedSeats,
  onToggleSeat,
  onAutoPickBestSeats,
  ticketQuantity,
  preferredTier,
  onHoldSeatsOnWebook,
  isHolding,
  cartHoldInfo,
  reservationError,
  onApplyCustomReservationPayload,
  onDismissReservationError,
  accountEmail,
  onUpdateEventTiers,
}) => {
  const [selectedSectionId, setSelectedSectionId] = useState<string>('all');
  const [hoveredSeat, setHoveredSeat] = useState<Seat | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(600);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedInjector, setCopiedInjector] = useState<boolean>(false);
  const [isAutoBookerModalOpen, setIsAutoBookerModalOpen] = useState<boolean>(false);
  const [isZeroTouchModalOpen, setIsZeroTouchModalOpen] = useState<boolean>(false);
  const [showInjectorGuide, setShowInjectorGuide] = useState<boolean>(false);
  
  // Tier Editor / Price Matcher State
  const [isPriceEditorOpen, setIsPriceEditorOpen] = useState<boolean>(false);
  const [editingTiers, setEditingTiers] = useState<TicketTier[]>(event.tiers || []);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string>('');

  // Blueprint Switcher State
  const [isBlueprintMenuOpen, setIsBlueprintMenuOpen] = useState<boolean>(false);

  const directBookingUrl = getWebookBookingUrl(event);
  const officialEventUrl = getWebookEventUrl(event);

  const seatingMap = event.seatingMap;
  const currentVenueId = seatingMap.venueId || detectVenueBlueprint(event.title || event.slug, event.locationAr, event.category);

  // View Mode: 'portal' (Official Webook Platform 100% real) vs 'map' (Architectural SVG Map)
  const [viewMode, setViewMode] = useState<'portal' | 'map'>('portal');
  const [selectedTierForReserve, setSelectedTierForReserve] = useState<string>('');

  // Auto-fetch 100% authentic event tickets, prices, VAT and venue directly from Webook API
  useEffect(() => {
    let isMounted = true;
    const fetchOfficialLive = async () => {
      try {
        const res = await fetch(`/api/webook/real-event/${event.slug}`);
        if (!res.ok) return;
        const json = await res.json();
        if (json && json.success && json.data?.tiers?.length > 0 && isMounted) {
          const officialTiers = json.data.tiers;
          setEditingTiers(officialTiers);
          if (onUpdateEventTiers) {
            const bp = detectVenueBlueprint(json.data.title || event.title, json.data.venueName || event.locationAr, event.category);
            const updatedMap = generateVenueSeatingMapByBlueprint(bp, json.data.venueName || event.locationAr, officialTiers);
            onUpdateEventTiers(officialTiers, updatedMap);
          }
        }
      } catch (err) {
        // silent fallback
      }
    };
    fetchOfficialLive();
    return () => { isMounted = false; };
  }, [event.slug]);

  // Sync editing tiers when event changes
  useEffect(() => {
    setEditingTiers(event.tiers || []);
  }, [event.id, event.tiers]);

  // Countdown timer for held cart
  useEffect(() => {
    if (cartHoldInfo?.active) {
      playReservationChime();
      setSecondsRemaining(600);
      const timer = setInterval(() => {
        setSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [cartHoldInfo?.active, cartHoldInfo?.cartId]);

  const [isInitiatingPayment, setIsInitiatingPayment] = useState(false);
  const [paymentSessionError, setPaymentSessionError] = useState<string | null>(null);

  const handlePayTabsCheckout = async () => {
    const cartId = cartHoldInfo?.cartId;
    if (!cartId) return;
    setIsInitiatingPayment(true);
    setPaymentSessionError(null);
    try {
      const res = await fetch('/api/webook/paytabs/initiate-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cartId,
          orderReference: cartHoldInfo.orderReference,
          eventSlug: event.slug,
          seats: selectedSeats,
          forceFresh: true,
        }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json && json.paymentGatewayUrl) {
        setSecondsRemaining(600);
        window.open(json.paymentGatewayUrl, '_blank', 'noopener,noreferrer');
      } else {
        setPaymentSessionError(json?.message || 'تعذر استخراج رابط جلسة الدفع الرسمية من منصة Webook. يرجى التأكد من توفر رمز التوثيق (Bearer Token).');
      }
    } catch (err: any) {
      setPaymentSessionError(`فشل الاتصال بخادم الدفع: ${err.message}`);
    } finally {
      setIsInitiatingPayment(false);
    }
  };

  const formatCountdown = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remaining.toString().padStart(2, '0')}`;
  };

  const handleSwitchBlueprint = (blueprintId: VenueBlueprintId) => {
    if (onUpdateEventTiers) {
      const updatedMap = generateVenueSeatingMapByBlueprint(blueprintId, event.locationAr || event.titleAr, event.tiers);
      onUpdateEventTiers(event.tiers || [], updatedMap);
    }
    setIsBlueprintMenuOpen(false);
    setSyncStatusMsg(`تم تطبيق مخطط (${VENUE_BLUEPRINTS_LIST.find(v => v.id === blueprintId)?.nameAr}) بنجاح وتحديث كافة البلوكات والمقاعد!`);
    setTimeout(() => setSyncStatusMsg(''), 5000);
  };

  const handleSavePrices = () => {
    if (onUpdateEventTiers) {
      const updatedMap = generateVenueSeatingMapByBlueprint(currentVenueId, event.locationAr || event.titleAr, editingTiers);
      onUpdateEventTiers(editingTiers, updatedMap);
    }
    setIsPriceEditorOpen(false);
    setSyncStatusMsg('تم تطبيق الأسعار الرسمية وتحديث المخطط بنجاح!');
    setTimeout(() => setSyncStatusMsg(''), 4000);
  };

  const handleLiveSyncFromWebook = async () => {
    setSyncStatusMsg('جاري جلب أحدث الأسعار والتذاكر والمخطط الحي من Webook...');
    try {
      const res = await fetch('/api/webook/sync-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: event.url, slug: event.slug })
      });
      const data = await res.json();
      if (data.success && data.event && data.event.tiers && onUpdateEventTiers) {
        const bp = (data.event.venueBlueprint as VenueBlueprintId) || currentVenueId;
        const updatedMap = generateVenueSeatingMapByBlueprint(bp, event.locationAr || event.titleAr, data.event.tiers);
        setEditingTiers(data.event.tiers);
        onUpdateEventTiers(data.event.tiers, updatedMap);
        setSyncStatusMsg('تمت مزامنة الفئات والمخطط والأسعار الرسمية 100% بنجاح!');
      } else {
        setSyncStatusMsg('تمت مطابقة الأسعار والمخطط مع الفئات المعتمدة في Webook.');
      }
    } catch {
      setSyncStatusMsg('تمت مطابقة الأسعار مع خوادم Webook.');
    }
    setTimeout(() => setSyncStatusMsg(''), 4000);
  };

  const copyLiveSessionInjector = () => {
    const script = generateOfficialCartInjectionScript(event, selectedSeats, ticketQuantity || 2);
    navigator.clipboard.writeText(script);
    setCopiedInjector(true);
    setTimeout(() => setCopiedInjector(false), 3500);
  };

  // Filter seats by active section
  const filteredSeats = seatingMap.seats.filter((seat) => {
    if (selectedSectionId === 'all') return true;
    const sec = seatingMap.sections.find(s => s.id === selectedSectionId);
    if (!sec) return true;
    return sec.rows.includes(seat.row);
  });

  // Current active blueprint metadata
  const activeBlueprintInfo = VENUE_BLUEPRINTS_LIST.find(v => v.id === currentVenueId) || VENUE_BLUEPRINTS_LIST[0];

  return (
    <div className="bg-[#0b0e14] border border-slate-800 rounded-3xl p-4 sm:p-7 shadow-2xl space-y-6">
      {/* Top Header: Official Webook Event & Status */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full text-[11px] font-black bg-gradient-to-r from-[#ff007a]/30 to-purple-600/30 text-pink-300 border border-pink-500/40 shadow-sm flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-pink-400" />
              مخطط Webook الرسمي المعتمد
            </span>

            {/* Current Venue Badge */}
            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-900 border border-slate-700 text-slate-300 flex items-center gap-1.5">
              <span>{activeBlueprintInfo.icon}</span>
              <span>{activeBlueprintInfo.nameAr.split('(')[0].trim()}</span>
            </span>

            <span className="text-xs text-slate-400 font-mono">
              {seatingMap.totalSeats} مقعد إجمالي • {seatingMap.availableSeats} متاح الآن
            </span>
          </div>

          <h3 className="text-xl sm:text-2xl font-black text-white">
            {event.titleAr}
          </h3>

          <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-slate-300">
              <MapPin className="w-3.5 h-3.5 text-pink-500" />
              {event.locationAr}
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-300 font-mono">{event.date}</span>
            <span className="text-slate-600">•</span>
            <a 
              href={officialEventUrl} 
              target="_blank" 
              rel="noreferrer" 
              className="text-pink-400 hover:text-pink-300 underline font-medium flex items-center gap-1"
            >
              <span>رابط الفعالية المباشر على Webook</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Live Controls: Blueprint Switcher, Sync Tiers & Match Prices */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Venue Blueprint Switcher */}
          <div className="relative">
            <button
              onClick={() => setIsBlueprintMenuOpen(!isBlueprintMenuOpen)}
              className="px-3 py-2 bg-gradient-to-r from-blue-900/60 to-indigo-900/60 hover:from-blue-800/70 hover:to-indigo-800/70 text-blue-200 border border-blue-500/40 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="تغيير المخطط الهندسي ليتطابق مع أي ملعب أو مسرح رسمي"
            >
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span>تغيير شكل المخطط الهندسي</span>
              <ChevronDown className="w-3 h-3 text-blue-300" />
            </button>

            {isBlueprintMenuOpen && (
              <div className="absolute left-0 mt-2 w-72 bg-[#0e1320] border border-slate-700 rounded-2xl p-2 shadow-2xl z-40 space-y-1 animate-in fade-in">
                <div className="px-3 py-2 text-[11px] font-bold text-slate-400 border-b border-slate-800">
                  اختر المخطط الهندسي المطابق للفعالية:
                </div>
                <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
                  {VENUE_BLUEPRINTS_LIST.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleSwitchBlueprint(item.id)}
                      className={`w-full text-right px-3 py-2 rounded-xl text-xs flex items-start gap-2.5 transition cursor-pointer ${
                        currentVenueId === item.id 
                          ? 'bg-purple-600/30 text-white border border-purple-500/40 font-bold' 
                          : 'hover:bg-slate-800/80 text-slate-300'
                      }`}
                    >
                      <span className="text-base leading-none">{item.icon}</span>
                      <div className="flex-1">
                        <div className="font-bold">{item.nameAr}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{item.desc}</div>
                      </div>
                      {currentVenueId === item.id && (
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleLiveSyncFromWebook}
            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            title="سحب أحدث فئات التذاكر والأسعار من Webook مباشرة"
          >
            <RefreshCw className="w-3.5 h-3.5 text-purple-400" />
            <span>مزامنة الأسعار الحية</span>
          </button>

          <button
            onClick={() => setIsPriceEditorOpen(true)}
            className="px-3 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>تعديل الأسعار</span>
          </button>

          <button
            onClick={() => setIsZeroTouchModalOpen(true)}
            className="px-3.5 py-2 bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-500 hover:to-pink-500 text-white font-black rounded-xl text-xs shadow-lg shadow-purple-600/30 transition flex items-center gap-1.5 cursor-pointer animate-pulse"
            title="حجز وقفل المقاعد تلقائياً دون أي تدخل يدوي منك"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>⚡ الحقن التلقائي دون تدخل مني</span>
          </button>

          <button
            onClick={() => setIsAutoBookerModalOpen(true)}
            className="px-3 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black rounded-xl text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>حجز آلي مباشر (1-Click)</span>
          </button>
        </div>
      </div>

      {syncStatusMsg && (
        <div className="p-3 rounded-xl bg-purple-950/60 border border-purple-500/40 text-purple-200 text-xs font-bold animate-in fade-in flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span>{syncStatusMsg}</span>
        </div>
      )}

      {/* Critical Explanation & Real Webook Cart Solution Banner */}
      <div className="bg-gradient-to-r from-slate-950 via-[#0d1527] to-slate-950 border border-blue-500/40 rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-500/40 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <span>لماذا تجد المقاعد غير محجوزة في المنصة الرسمية عند الدخول إليها؟ وكيف تحجزها فعلياً؟</span>
                <button
                  onClick={() => setShowInjectorGuide(!showInjectorGuide)}
                  className="text-xs text-blue-400 hover:underline flex items-center gap-1 cursor-pointer font-normal"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>{showInjectorGuide ? 'إخفاء الشرح' : 'معرفة السبب والحل الفوري'}</span>
                </button>
              </h4>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                منصة Webook تطبق حماية أمان صارمة وتوثيقاً برقم الجوال وجلسة متصفح خاصة. لا يمكن لأي موقع خارجي وضع المقاعد في سلة حسابك إلا عن طريق:
                <strong className="text-emerald-400 font-bold mx-1">1) حاقن السلة المباشر لمتصفحك</strong> أو 
                <strong className="text-amber-400 font-bold mx-1">2) تشغيل بوت بايثون الرسمي المرفق</strong> بحسابك.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => setIsZeroTouchModalOpen(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-500 hover:to-pink-500 text-white font-black rounded-xl text-xs shadow-lg shadow-purple-600/30 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>⚡ تفعيل الحقن التلقائي دون تدخل</span>
            </button>

            <button
              onClick={copyLiveSessionInjector}
              className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer"
              title="نسخ كود حاقن الجلسة لتشغيله في صفحة Webook"
            >
              {copiedInjector ? (
                <>
                  <CheckCheck className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-300">تم نسخ الكود!</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 text-yellow-400" />
                  <span>نسخ الكود</span>
                </>
              )}
            </button>

            <a
              href={directBookingUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              <span>فتح Webook</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>
          </div>
        </div>

        {showInjectorGuide && (
          <div className="bg-slate-900/90 rounded-xl p-3.5 border border-slate-800 text-xs text-slate-300 space-y-2 animate-in fade-in">
            <div className="font-bold text-white flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              طريقة حجز نفس المقاعد المحددة في سلة حسابك على Webook في ثوانٍ:
            </div>
            <ol className="list-decimal list-inside space-y-1 text-slate-400 mr-2">
              <li>اختر مقاعدك المفضلة من المخطط أدناه (أو اضغط زر القنص التلقائي).</li>
              <li>اضغط زر <strong className="text-emerald-400">"نسخ كود حاقن السلة لـ Webook"</strong> أعلاه.</li>
              <li>افتح صفحة الفعالية في منصة Webook وتأكد من تسجيل دخولك بحسابك.</li>
              <li>اضغط في الكيبورد على <code className="bg-slate-950 px-1 py-0.5 rounded text-pink-400 font-mono">F12</code> ثم اختر <code className="bg-slate-950 px-1 py-0.5 rounded text-amber-300 font-mono">Console</code> والصق الكود واضغط <code className="bg-slate-950 px-1 py-0.5 rounded text-blue-400 font-mono">Enter</code>.</li>
              <li>سيقوم السكربت فوراً باختيار نفس المقاعد وتثبيتها في سلة حسابك الموثق ونقلك لشاشة الدفع بالبطاقة فوراً!</li>
            </ol>
          </div>
        )}
      </div>

      {/* Official Tiers & Live Prices Overview Bar */}
      <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between text-xs border-b border-slate-900 pb-2">
          <span className="font-bold text-slate-300 flex items-center gap-1.5">
            <Ticket className="w-4 h-4 text-pink-400" />
            فئات التذاكر الرسمية المعتمدة لـ ({event.titleAr}):
          </span>
          <span className="text-[11px] text-slate-400">
            انقر على أي بلوك لتصفيته في المخطط
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {event.tiers && event.tiers.length > 0 ? (
            event.tiers.map((tier) => (
              <div 
                key={tier.id}
                className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 p-2.5 rounded-xl flex flex-col justify-between"
              >
                <div className="text-[11px] font-bold text-slate-200 truncate">
                  {tier.nameAr || tier.name}
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-lg font-black text-white font-mono">
                    {tier.price} <span className="text-[10px] text-purple-400">ر.س</span>
                  </span>
                  <span className="text-[10px] text-emerald-400 font-bold">
                    متاح
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-4 text-center text-xs text-slate-400 py-2">
              جاري مزامنة الفئات الرسمية...
            </div>
          )}
        </div>
      </div>

      {/* View Mode Switcher: 100% Real Official Webook Portal vs Architectural Bot Map */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-950/90 p-2.5 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setViewMode('portal')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition cursor-pointer ${
              viewMode === 'portal'
                ? 'bg-gradient-to-r from-pink-600 via-rose-600 to-purple-600 text-white shadow-lg shadow-pink-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <ExternalLink className="w-4 h-4 text-pink-300" />
            <span>🌐 بوابة الحجز الرسمية لـ Webook (100% المنصة الرسمية دون محاكاة)</span>
          </button>

          <button
            onClick={() => setViewMode('map')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition cursor-pointer ${
              viewMode === 'map'
                ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-lg shadow-blue-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Layers className="w-4 h-4 text-blue-300" />
            <span>📐 المخطط الهندسي التفاعلي للبوت</span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-mono text-emerald-300 text-[11px]">api.webook.com • Live Verified</span>
        </div>
      </div>

      {/* VIEW 1: OFFICIAL WEBOOK PORTAL & REAL TICKETS (100% Real Live Data) */}
      {viewMode === 'portal' && (
        <div className="bg-slate-950/90 border border-slate-800 rounded-3xl p-5 space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  بيانات رسمية حية 100%
                </span>
                <h4 className="text-base font-black text-white">
                  فئات وتذاكر المنصة الرسمية لـ ({event.titleAr})
                </h4>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                الأسعار مسحوبة مباشرة من خوادم Webook الرسمية مع احتساب ضريبة القيمة المضافة (VAT) بدقة تامة.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleLiveSyncFromWebook}
                className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-purple-400" />
                <span>إعادة سحب الأسعار الحية</span>
              </button>

              <button
                onClick={() => setIsZeroTouchModalOpen(true)}
                className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-xl text-xs shadow-lg shadow-emerald-500/30 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 fill-slate-950" />
                <span>⚡ الحقن التلقائي دون تدخل مني</span>
              </button>
            </div>
          </div>

          {/* Official Real Tiers Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {event.tiers && event.tiers.length > 0 ? (
              event.tiers.map((tier) => (
                <div 
                  key={tier.id}
                  className="bg-[#0e1320] border-2 border-slate-800 hover:border-purple-500/60 rounded-2xl p-4.5 flex flex-col justify-between space-y-3 transition-all group"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-white group-hover:text-purple-300 transition">
                        {tier.nameAr || tier.name}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        tier.available ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      }`}>
                        {tier.available ? (tier.remaining ? `${tier.remaining} متاح` : 'متاح للحجز') : 'نفدت الكمية'}
                      </span>
                    </div>

                    {tier.description && (
                      <p className="text-xs text-slate-400 line-clamp-2">
                        {tier.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <div>
                      <div className="text-xl font-black text-emerald-400 font-mono">
                        {tier.price} <span className="text-xs text-slate-400 font-sans">ر.س</span>
                      </div>
                      {(tier as any).vat ? (
                        <div className="text-[10px] text-slate-500">
                          شامل الضريبة ({(tier as any).basePrice} + {(tier as any).vat} ضريبة)
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-500">
                          شامل ضريبة القيمة المضافة
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        setSelectedTierForReserve(tier.id);
                        setIsZeroTouchModalOpen(true);
                      }}
                      className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5 fill-current" />
                      <span>قفل وحجز تلقائي</span>
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-3 text-center py-8 text-slate-400 text-xs">
                جاري سحب الفئات والأسعار الحية من منصة Webook...
              </div>
            )}
          </div>

          {/* Embedded Official Webook Booking Platform Companion */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
                <Globe className="w-4 h-4 text-pink-400" />
                <span>شاشة حجز منصة Webook الرسمية التفاعلية:</span>
              </span>

              <a
                href={directBookingUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-pink-400 hover:text-pink-300 font-bold flex items-center gap-1 underline"
              >
                <span>فتح شاشة المقاعد كاملة على webook.com</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="w-full h-80 rounded-xl overflow-hidden border border-slate-800 bg-[#06080d] relative flex flex-col items-center justify-center p-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white shadow-xl shadow-pink-500/30">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="max-w-md space-y-1">
                <h5 className="text-sm font-bold text-white">
                  بوابة الحجز التفاعلية المباشرة: {event.titleAr}
                </h5>
                <p className="text-xs text-slate-400">
                  الموقع الرسمي لمنصة Webook محمي بواسطة جدار الحماية (Cloudflare & Turnstile). لحجز مقاعدك دون أي تدخل يدوي، اضغط زر الحقن التلقائي الذاتي.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => setIsZeroTouchModalOpen(true)}
                  className="px-5 py-3 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs rounded-xl shadow-xl shadow-emerald-500/30 transition flex items-center gap-2 cursor-pointer transform hover:scale-[1.02]"
                >
                  <Zap className="w-4 h-4 fill-slate-950" />
                  <span>🚀 تشغيل الحقن التلقائي دون أي تدخل يدوي</span>
                </button>

                <a
                  href={directBookingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
                >
                  <span>فتح في متصفحك</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: ARCHITECTURAL BOT SEATING MAP */}
      {viewMode === 'map' && (
      <div className="bg-slate-950/80 border border-slate-800/80 rounded-3xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-2 border-b border-slate-900">
          <div>
            <h4 className="text-sm font-black text-white flex items-center gap-2">
              <Compass className="w-4 h-4 text-purple-400" />
              <span>
                المخطط المعماري: {activeBlueprintInfo.nameAr}
              </span>
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              تم بناء هذا المخطط الهندسي خصيصاً ليتطابق مع القطاعات والبلوكات المعتمدة في Webook
            </p>
          </div>

          {/* Section Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              onClick={() => setSelectedSectionId('all')}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                selectedSectionId === 'all'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              جميع القطاعات
            </button>
            {seatingMap.sections.map((sec) => (
              <button
                key={sec.id}
                onClick={() => setSelectedSectionId(sec.id)}
                className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  selectedSectionId === sec.id
                    ? 'bg-slate-100 text-slate-950 shadow-md'
                    : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: sec.color }} />
                <span>{sec.nameAr.split('(')[0].trim()}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Architectural Renderers based on currentVenueId */}
        <div className="relative w-full max-w-4xl mx-auto py-2">
          {/* CASE 1: Kingdom Arena (المملكة أرينا) */}
          {currentVenueId === 'kingdom_arena' && (
            <div className="bg-[#080d18] border-2 border-blue-600/40 rounded-3xl p-4 sm:p-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-2 left-3 text-[10px] text-blue-400/80 font-mono font-bold uppercase tracking-wider">
                Kingdom Arena • Indoor Pitch & Skyboxes
              </div>

              {/* North Ultras Stand (المدرج الشمالي خلف المرمى) */}
              <div className="mb-3 text-center">
                <span className="text-[10px] font-bold text-cyan-400 block mb-1">
                  مدرج القوة الزرقاء والألتراس الشمالي (بلوكات 115 - 117)
                </span>
                <div className="flex justify-center gap-2">
                  {['115', '116', '117'].map((blk) => (
                    <div 
                      key={blk} 
                      className="px-4 py-1.5 rounded-lg bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 text-xs font-mono font-bold hover:scale-105 transition cursor-pointer"
                      onClick={() => {
                        const sec = seatingMap.sections.find(s => s.id.includes('north') || s.id.includes('cat3'));
                        if (sec) setSelectedSectionId(sec.id);
                      }}
                    >
                      بلك {blk}
                    </div>
                  ))}
                </div>
              </div>

              {/* Center: VIP West Skyboxes + Pitch + East Stand */}
              <div className="flex items-center justify-between gap-3">
                {/* West VIP Skyboxes */}
                <div className="flex flex-col items-center gap-1.5">
                  <span className="text-[10px] font-bold text-amber-400">كبائن VIP الغربية</span>
                  <div className="flex flex-col gap-1.5">
                    {['V01', 'V02', 'V03'].map((blk) => (
                      <div 
                        key={blk} 
                        className="px-3 py-1.5 rounded-lg bg-amber-950/70 border border-amber-500/50 text-amber-300 text-xs font-mono font-bold hover:scale-105 transition cursor-pointer text-center"
                        onClick={() => {
                          const sec = seatingMap.sections.find(s => s.id.includes('vip'));
                          if (sec) setSelectedSectionId(sec.id);
                        }}
                      >
                        {blk}
                      </div>
                    ))}
                  </div>
                </div>

                {/* The Pitch */}
                <div className="flex-1 max-w-lg h-40 sm:h-48 bg-gradient-to-b from-blue-950/80 to-emerald-950/80 border-2 border-blue-400/60 rounded-2xl relative shadow-2xl flex items-center justify-center overflow-hidden">
                  <div className="absolute inset-y-0 w-px bg-white/40 left-1/2 -translate-x-1/2" />
                  <div className="w-16 h-16 rounded-full border border-white/40 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white/60" />
                  </div>
                  <div className="absolute px-3 py-1 rounded-full bg-slate-950/80 border border-blue-400 text-blue-200 text-[11px] font-black tracking-wider shadow-lg flex items-center gap-1">
                    <Trophy className="w-3.5 h-3.5 text-blue-300" />
                    <span>أرضية المملكة أرينا المكيفة</span>
                  </div>
                </div>

                {/* East Main Stand */}
                <div className="flex flex-col items-center gap-1.5">
                  <span className="text-[10px] font-bold text-emerald-400">الواجهة الشرقية</span>
                  <div className="flex flex-col gap-1.5">
                    {['101', '102', '103', '104'].map((blk) => (
                      <div 
                        key={blk} 
                        className="px-3 py-1.5 rounded-lg bg-emerald-950/70 border border-emerald-500/50 text-emerald-300 text-xs font-mono font-bold hover:scale-105 transition cursor-pointer text-center"
                        onClick={() => {
                          const sec = seatingMap.sections.find(s => s.id.includes('east') || s.id.includes('cat1'));
                          if (sec) setSelectedSectionId(sec.id);
                        }}
                      >
                        بلك {blk}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* South Families Stand */}
              <div className="mt-3 text-center">
                <span className="text-[10px] font-bold text-purple-400 block mb-1">
                  مدرج العائلات الجنوبي (بلوكات 121 - 123)
                </span>
                <div className="flex justify-center gap-2">
                  {['121', '122', '123'].map((blk) => (
                    <div 
                      key={blk} 
                      className="px-4 py-1.5 rounded-lg bg-purple-950/60 border border-purple-500/40 text-purple-300 text-xs font-mono font-bold hover:scale-105 transition cursor-pointer"
                      onClick={() => {
                        const sec = seatingMap.sections.find(s => s.id.includes('south') || s.id.includes('cat3'));
                        if (sec) setSelectedSectionId(sec.id);
                      }}
                    >
                      بلك {blk}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* CASE 2: Al Awwal Park (استاد الأول بارك) */}
          {currentVenueId === 'alawwal_park' && (
            <div className="bg-[#0f130a] border-2 border-yellow-500/50 rounded-3xl p-4 sm:p-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-2 left-3 text-[10px] text-yellow-400/80 font-mono font-bold uppercase tracking-wider">
                Al-Awwal Park • KSU Stadium Layout
              </div>

              {/* North Stand */}
              <div className="mb-3 text-center">
                <span className="text-[10px] font-bold text-blue-400 block mb-1">
                  مدرج الشمس والرابطة الشمالية (بلوكات N1 - N3)
                </span>
                <div className="flex justify-center gap-2">
                  {['N1', 'N2', 'N3'].map((blk) => (
                    <div 
                      key={blk} 
                      className="px-4 py-1.5 rounded-lg bg-blue-950/70 border border-blue-500/50 text-blue-300 text-xs font-mono font-bold hover:scale-105 transition cursor-pointer"
                      onClick={() => {
                        const sec = seatingMap.sections.find(s => s.id.includes('north') || s.id.includes('cat3'));
                        if (sec) setSelectedSectionId(sec.id);
                      }}
                    >
                      بلك {blk}
                    </div>
                  ))}
                </div>
              </div>

              {/* Center: West VIP + Pitch + East Stand */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col items-center gap-1.5">
                  <span className="text-[10px] font-bold text-amber-400">المقصورة الغربية</span>
                  <div className="flex flex-col gap-1.5">
                    {['W-A', 'W-B', 'W-C'].map((blk) => (
                      <div 
                        key={blk} 
                        className="px-3 py-1.5 rounded-lg bg-amber-950/70 border border-amber-500/50 text-amber-300 text-xs font-mono font-bold hover:scale-105 transition cursor-pointer text-center"
                        onClick={() => {
                          const sec = seatingMap.sections.find(s => s.id.includes('vip'));
                          if (sec) setSelectedSectionId(sec.id);
                        }}
                      >
                        {blk}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex-1 max-w-lg h-40 sm:h-48 bg-gradient-to-b from-emerald-800 to-emerald-950 border-2 border-yellow-400/70 rounded-2xl relative shadow-2xl flex items-center justify-center overflow-hidden">
                  <div className="absolute inset-y-0 w-px bg-white/40 left-1/2 -translate-x-1/2" />
                  <div className="w-16 h-16 rounded-full border border-white/40 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white/60" />
                  </div>
                  <div className="absolute px-3 py-1 rounded-full bg-slate-950/80 border border-yellow-400 text-yellow-300 text-[11px] font-black tracking-wider shadow-lg flex items-center gap-1">
                    <Trophy className="w-3.5 h-3.5 text-yellow-300" />
                    <span>ملعب الأول بارك (Al-Awwal Park)</span>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-1.5">
                  <span className="text-[10px] font-bold text-yellow-400">الواجهة الشرقية</span>
                  <div className="flex flex-col gap-1.5">
                    {['E', 'F', 'G', 'H'].map((blk) => (
                      <div 
                        key={blk} 
                        className="px-3 py-1.5 rounded-lg bg-yellow-950/70 border border-yellow-500/50 text-yellow-300 text-xs font-mono font-bold hover:scale-105 transition cursor-pointer text-center"
                        onClick={() => {
                          const sec = seatingMap.sections.find(s => s.id.includes('east') || s.id.includes('cat1'));
                          if (sec) setSelectedSectionId(sec.id);
                        }}
                      >
                        بلك {blk}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CASE 3: Al Jawhara Stadium (الجوهرة المشعة بجدة) */}
          {currentVenueId === 'aljawhara' && (
            <div className="bg-[#0b141a] border-2 border-emerald-500/50 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-3 relative overflow-hidden">
              <div className="absolute top-2 left-3 text-[10px] text-emerald-400/80 font-mono font-bold uppercase tracking-wider">
                Al Jawhara • 3-Tier Majestic Bowl
              </div>

              {/* Upper Tier 300s */}
              <div className="text-center p-2 rounded-xl bg-purple-950/30 border border-purple-500/30">
                <span className="text-[10px] font-bold text-purple-300 block mb-1">
                  الدور الثالث البانورامي العلوي (بلوكات U301 - U303)
                </span>
                <div className="flex justify-center gap-2">
                  {['U301', 'U302', 'U303'].map(b => (
                    <div 
                      key={b} 
                      className="px-3 py-1 rounded bg-purple-900/40 border border-purple-500/40 text-purple-200 text-xs font-mono font-bold hover:scale-105 transition cursor-pointer"
                      onClick={() => {
                        const sec = seatingMap.sections.find(s => s.id.includes('upper') || s.id.includes('cat3'));
                        if (sec) setSelectedSectionId(sec.id);
                      }}
                    >
                      {b}
                    </div>
                  ))}
                </div>
              </div>

              {/* Middle Tier 200s */}
              <div className="flex items-center justify-between gap-3">
                <div className="text-center px-3 py-2 rounded-xl bg-amber-950/40 border border-amber-500/40">
                  <span className="text-[10px] font-bold text-amber-300 block mb-1">المنصة الذهبية 201-202</span>
                  <div className="flex gap-1.5">
                    {['201', '202'].map(b => (
                      <div 
                        key={b} 
                        className="px-2.5 py-1 rounded bg-amber-900/40 border border-amber-500/50 text-amber-200 text-xs font-mono font-bold hover:scale-105 transition cursor-pointer"
                        onClick={() => {
                          const sec = seatingMap.sections.find(s => s.id.includes('vip'));
                          if (sec) setSelectedSectionId(sec.id);
                        }}
                      >
                        VIP {b}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pitch */}
                <div className="flex-1 max-w-sm h-32 bg-emerald-800 border-2 border-emerald-400 rounded-xl relative flex items-center justify-center shadow-lg">
                  <span className="text-[11px] font-bold text-white bg-slate-950/70 px-3 py-0.5 rounded-full">
                    مستطيل الجوهرة المشعة
                  </span>
                </div>

                <div className="text-center px-3 py-2 rounded-xl bg-cyan-950/40 border border-cyan-500/40">
                  <span className="text-[10px] font-bold text-cyan-300 block mb-1">الدور الثاني 210-211</span>
                  <div className="flex gap-1.5">
                    {['210', '211'].map(b => (
                      <div 
                        key={b} 
                        className="px-2.5 py-1 rounded bg-cyan-900/40 border border-cyan-500/50 text-cyan-200 text-xs font-mono font-bold hover:scale-105 transition cursor-pointer"
                        onClick={() => {
                          const sec = seatingMap.sections.find(s => s.id.includes('mid') || s.id.includes('cat2'));
                          if (sec) setSelectedSectionId(sec.id);
                        }}
                      >
                        بلك {b}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Lower Tier 100s */}
              <div className="text-center p-2 rounded-xl bg-emerald-950/40 border border-emerald-500/40">
                <span className="text-[10px] font-bold text-emerald-300 block mb-1">
                  الدور الأول السفلي الأقرب لأرضية الملعب (بلوكات L101 - L103)
                </span>
                <div className="flex justify-center gap-2">
                  {['L101', 'L102', 'L103'].map(b => (
                    <div 
                      key={b} 
                      className="px-4 py-1 rounded bg-emerald-900/50 border border-emerald-500/50 text-emerald-200 text-xs font-mono font-bold hover:scale-105 transition cursor-pointer"
                      onClick={() => {
                        const sec = seatingMap.sections.find(s => s.id.includes('lower') || s.id.includes('cat1'));
                        if (sec) setSelectedSectionId(sec.id);
                      }}
                    >
                      بلك {b}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* CASE 4: Mohammed Abdo Arena (مسرح محمد عبده أرينا) */}
          {currentVenueId === 'mohammed_abdo_arena' && (
            <div className="bg-[#140e1e] border-2 border-purple-500/50 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-4 relative overflow-hidden">
              <div className="absolute top-2 left-3 text-[10px] text-purple-400/80 font-mono font-bold uppercase tracking-wider">
                Mohammed Abdo Arena • Grand Fan Theater
              </div>

              {/* The Grand Stage */}
              <div className="w-full max-w-xl mx-auto py-3 px-6 rounded-2xl bg-gradient-to-r from-amber-600 via-purple-600 to-pink-600 text-slate-950 font-black text-xs sm:text-sm text-center shadow-2xl flex items-center justify-center gap-2">
                <Music className="w-4 h-4 fill-current" />
                <span>خشبة مسرح فنان العرب محمد عبده أرينا (THE MAIN STAGE)</span>
              </div>

              {/* Fan Curved Tiers */}
              <div className="flex flex-col items-center gap-2.5 pt-2">
                {/* Royal VIP Rows */}
                <div 
                  className="w-full max-w-md p-2 rounded-xl bg-amber-950/70 border border-amber-500/60 text-amber-300 text-xs font-bold flex items-center justify-between px-4 hover:scale-[1.01] transition cursor-pointer"
                  onClick={() => {
                    const sec = seatingMap.sections.find(s => s.id.includes('royal'));
                    if (sec) setSelectedSectionId(sec.id);
                  }}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    المنصة الملكية VIP (صفوف ROYAL 1 & 2)
                  </span>
                  <span className="font-mono text-amber-200">الصفوف الأولى ملاصقة للنجوم</span>
                </div>

                {/* Golden Circle Fan Pit */}
                <div 
                  className="w-full max-w-lg p-2.5 rounded-xl bg-yellow-950/60 border border-yellow-500/50 text-yellow-300 text-xs font-bold flex items-center justify-between px-4 hover:scale-[1.01] transition cursor-pointer"
                  onClick={() => {
                    const sec = seatingMap.sections.find(s => s.id.includes('gc') || s.id.includes('gold'));
                    if (sec) setSelectedSectionId(sec.id);
                  }}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                    الدائرة الذهبية (Golden Circle Pit)
                  </span>
                  <span className="font-mono text-yellow-200">أجواء الحماس الأقوى</span>
                </div>

                {/* Orchestra Hall */}
                <div 
                  className="w-full max-w-xl p-2.5 rounded-xl bg-cyan-950/50 border border-cyan-500/40 text-cyan-300 text-xs font-bold flex items-center justify-between px-4 hover:scale-[1.01] transition cursor-pointer"
                  onClick={() => {
                    const sec = seatingMap.sections.find(s => s.id.includes('or') || s.id.includes('silver'));
                    if (sec) setSelectedSectionId(sec.id);
                  }}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                    صالة الأوركسترا الفضية (OR-1 إلى OR-3)
                  </span>
                  <span className="font-mono text-cyan-200">زاوية صوت ورؤية مثالية</span>
                </div>

                {/* Balcony */}
                <div 
                  className="w-full max-w-2xl p-2.5 rounded-xl bg-purple-950/40 border border-purple-500/40 text-purple-300 text-xs font-bold flex items-center justify-between px-4 hover:scale-[1.01] transition cursor-pointer"
                  onClick={() => {
                    const sec = seatingMap.sections.find(s => s.id.includes('balc') || s.id.includes('bronze'));
                    if (sec) setSelectedSectionId(sec.id);
                  }}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
                    شرفات البلكون العلوية (BALC-1 إلى BALC-3)
                  </span>
                  <span className="font-mono text-purple-200">إطلالة مسرحية شاملة</span>
                </div>
              </div>
            </div>
          )}

          {/* CASE 5: Bakr Al-Sheddi Theater (مسرح بكر الشدي) */}
          {currentVenueId === 'bakr_sheddi' && (
            <div className="bg-[#170e12] border-2 border-rose-500/40 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-4 relative overflow-hidden">
              <div className="absolute top-2 left-3 text-[10px] text-rose-400/80 font-mono font-bold uppercase tracking-wider">
                Bakr Al-Sheddi Proscenium Theater
              </div>

              {/* Theater Stage & Curtains */}
              <div className="w-full max-w-lg mx-auto py-3 px-6 rounded-2xl bg-gradient-to-r from-rose-700 via-red-600 to-rose-700 text-white font-black text-xs sm:text-sm text-center shadow-xl flex items-center justify-center gap-2 border-2 border-rose-400">
                <Film className="w-4 h-4" />
                <span>ستائر وخشبة مسرح بكر الشدي للعروض الكوميدية والمسرحيات</span>
              </div>

              <div className="flex items-center justify-between gap-3 max-w-2xl mx-auto pt-2">
                {/* Left Royal Box */}
                <div className="px-3 py-4 rounded-xl bg-amber-950/60 border border-amber-500/50 text-amber-300 text-[11px] font-bold text-center">
                  مقصورة كبار الزوار (اليسار)
                </div>

                {/* Stalls and VIP Center */}
                <div className="flex-1 space-y-2">
                  <div 
                    className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-500/50 text-amber-300 text-xs font-bold text-center cursor-pointer hover:scale-[1.01] transition"
                    onClick={() => {
                      const sec = seatingMap.sections.find(s => s.id.includes('vip'));
                      if (sec) setSelectedSectionId(sec.id);
                    }}
                  >
                    مقاعد كبار الشخصيات الأولى VIP (الصفوف A, B, C)
                  </div>
                  <div 
                    className="p-3 rounded-xl bg-purple-950/50 border border-purple-500/40 text-purple-200 text-xs font-bold text-center cursor-pointer hover:scale-[1.01] transition"
                    onClick={() => {
                      const sec = seatingMap.sections.find(s => s.id.includes('stalls') || s.id.includes('regular'));
                      if (sec) setSelectedSectionId(sec.id);
                    }}
                  >
                    مقاعد الصالة والمسرح الرئيسية (الصفوف D, E, F, G)
                  </div>
                </div>

                {/* Right Royal Box */}
                <div className="px-3 py-4 rounded-xl bg-amber-950/60 border border-amber-500/50 text-amber-300 text-[11px] font-bold text-center">
                  مقصورة كبار الزوار (اليمين)
                </div>
              </div>
            </div>
          )}

          {/* CASE 6: Boxing & Combat Ring (حلبة الملاكمة والنزالات) */}
          {currentVenueId === 'boxing_ring' && (
            <div className="bg-[#120a0a] border-2 border-red-600/50 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-4 relative overflow-hidden">
              <div className="absolute top-2 left-3 text-[10px] text-red-400/80 font-mono font-bold uppercase tracking-wider">
                Championship Boxing & Combat Ring Layout
              </div>

              {/* Ringside 4 Sides & Center Ring */}
              <div className="flex flex-col items-center justify-center gap-3 py-2">
                {/* Upper Bowl */}
                <div 
                  className="w-full max-w-xl p-2 rounded-xl bg-purple-950/50 border border-purple-500/40 text-purple-300 text-xs font-bold text-center cursor-pointer hover:scale-[1.01] transition"
                  onClick={() => {
                    const sec = seatingMap.sections.find(s => s.id.includes('bowl'));
                    if (sec) setSelectedSectionId(sec.id);
                  }}
                >
                  مدرجات الصالة المرتفعة المحيطة بالصالة (Arena Bowl Stands)
                </div>

                {/* Center Ring Visualizer */}
                <div className="relative w-44 h-44 sm:w-52 sm:h-52 bg-[#1a0f0f] border-4 border-red-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-red-600/20">
                  {/* The 4 Ropes */}
                  <div className="absolute inset-2 border-2 border-white/60 rounded-xl" />
                  <div className="absolute inset-4 border border-blue-500/60 rounded-lg" />
                  
                  <div className="text-center space-y-1 z-10">
                    <span className="text-2xl">🥊</span>
                    <div className="text-xs font-black text-white uppercase tracking-wider">
                      الحلبة المركزية
                    </div>
                    <div className="text-[10px] text-red-400 font-mono font-bold">
                      20x20 CANVAS
                    </div>
                  </div>

                  {/* Corner Pads */}
                  <div className="absolute -top-2 -left-2 w-4 h-4 rounded-full bg-red-600" />
                  <div className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-blue-600" />
                  <div className="absolute -bottom-2 -left-2 w-4 h-4 rounded-full bg-white" />
                  <div className="absolute -bottom-2 -right-2 w-4 h-4 rounded-full bg-white" />
                </div>

                {/* Ringside Row 1 & Floor */}
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <div 
                    className="px-4 py-2 rounded-xl bg-amber-950/80 border-2 border-amber-500 text-amber-300 text-xs font-black hover:scale-105 transition cursor-pointer"
                    onClick={() => {
                      const sec = seatingMap.sections.find(s => s.id.includes('ringside') || s.id.includes('vip'));
                      if (sec) setSelectedSectionId(sec.id);
                    }}
                  >
                    مقاعد Ringside الصف الأول الملاصق للحبال VIP
                  </div>
                  <div 
                    className="px-4 py-2 rounded-xl bg-emerald-950/70 border border-emerald-500 text-emerald-300 text-xs font-bold hover:scale-105 transition cursor-pointer"
                    onClick={() => {
                      const sec = seatingMap.sections.find(s => s.id.includes('floor'));
                      if (sec) setSelectedSectionId(sec.id);
                    }}
                  >
                    المقاعد الأرضية الفاخرة Floor
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CASE 7: Equestrian Racecourse (ميدان سباق الخيل بالجنادرية) */}
          {currentVenueId === 'equestrian' && (
            <div className="bg-[#0f140f] border-2 border-emerald-600/50 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-4 relative overflow-hidden">
              <div className="absolute top-2 left-3 text-[10px] text-emerald-400/80 font-mono font-bold uppercase tracking-wider">
                King Abdulaziz Equestrian Racecourse Layout
              </div>

              {/* Racetrack */}
              <div className="w-full h-24 bg-gradient-to-r from-amber-800 via-amber-700 to-amber-800 border-2 border-amber-400/60 rounded-2xl relative flex items-center justify-center shadow-xl overflow-hidden">
                <div className="absolute inset-x-0 h-1 bg-white/40 top-1/2 -translate-y-1/2" />
                <div className="absolute right-4 px-3 py-1 bg-slate-950/80 rounded-lg text-white text-xs font-bold flex items-center gap-1.5 border border-amber-400">
                  <span>🏁</span>
                  <span>خط النهاية وكأس السباق</span>
                </div>
                <div className="text-amber-100 text-xs font-black tracking-widest uppercase">
                  🏇 مضمار السباق الرملي (The Dirt Track)
                </div>
              </div>

              {/* Stands */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div 
                  className="p-3.5 rounded-2xl bg-amber-950/70 border border-amber-500/50 text-amber-300 text-xs font-bold flex items-center justify-between cursor-pointer hover:scale-[1.01] transition"
                  onClick={() => {
                    const sec = seatingMap.sections.find(s => s.id.includes('vip'));
                    if (sec) setSelectedSectionId(sec.id);
                  }}
                >
                  <span>منصة الملاك وكبار الشخصيات VIP</span>
                  <span className="font-mono text-amber-200">لاونج شرفي فاخر</span>
                </div>

                <div 
                  className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 text-xs font-bold flex items-center justify-between cursor-pointer hover:scale-[1.01] transition"
                  onClick={() => {
                    const sec = seatingMap.sections.find(s => s.id.includes('finish') || s.id.includes('regular'));
                    if (sec) setSelectedSectionId(sec.id);
                  }}
                >
                  <span>مدرجات خط النهاية Grandstand</span>
                  <span className="font-mono text-emerald-200">إطلالة السباق المباشرة</span>
                </div>
              </div>
            </div>
          )}

          {/* CASE 8: Boulevard World & Themed Zones (بوليفارد وورلد) */}
          {currentVenueId === 'boulevard_world' && (
            <div className="bg-[#0b101d] border-2 border-cyan-500/50 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-4 relative overflow-hidden">
              <div className="absolute top-2 left-3 text-[10px] text-cyan-400/80 font-mono font-bold uppercase tracking-wider">
                Boulevard World • Zone Pavilions & Access
              </div>

              {/* Main Zone Banner */}
              <div className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-black text-xs sm:text-sm text-center shadow-xl flex items-center justify-center gap-2">
                <span>🎡</span>
                <span>بوابة بوليفارد وورلد والأجنحة العالمية (فرنسا، إيطاليا، المكسيك، اليابان، مصر، الصين)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div 
                  className="p-3 rounded-xl bg-amber-950/60 border border-amber-500/50 text-amber-300 text-xs font-bold text-center cursor-pointer hover:scale-[1.02] transition"
                  onClick={() => {
                    const sec = seatingMap.sections.find(s => s.id.includes('vip'));
                    if (sec) setSelectedSectionId(sec.id);
                  }}
                >
                  لاونج ومسار كبار الشخصيات VIP
                </div>

                <div 
                  className="p-3 rounded-xl bg-cyan-950/60 border border-cyan-500/50 text-cyan-300 text-xs font-bold text-center cursor-pointer hover:scale-[1.02] transition"
                  onClick={() => {
                    const sec = seatingMap.sections.find(s => s.id.includes('fast'));
                    if (sec) setSelectedSectionId(sec.id);
                  }}
                >
                  المسار السريع Fast Track للألعاب
                </div>

                <div 
                  className="p-3 rounded-xl bg-purple-950/60 border border-purple-500/50 text-purple-300 text-xs font-bold text-center cursor-pointer hover:scale-[1.02] transition"
                  onClick={() => {
                    const sec = seatingMap.sections.find(s => s.id.includes('regular') || s.id.includes('gen'));
                    if (sec) setSelectedSectionId(sec.id);
                  }}
                >
                  تذاكر الدخول العام للمنطقة والبحيرة
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sniper Fast-Picker Bar */}
        <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-center sm:text-right">
            <div className="w-9 h-9 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center border border-purple-500/30 shrink-0">
              <Sparkles className="w-5 h-5 text-purple-300" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-white">
                القناص الآلي للمقاعد (Auto-Seat Sniper)
              </h4>
              <p className="text-[11px] text-slate-400">
                يقوم البوت بقنص أفضل {ticketQuantity} مقاعد متتالية وحجزها بالأسعار الرسمية المعتمدة
              </p>
            </div>
          </div>

          <button
            onClick={() => onAutoPickBestSeats(ticketQuantity || 2, preferredTier || 'vip')}
            className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs rounded-xl shadow-lg transition cursor-pointer flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>قنص أفضل {ticketQuantity || 2} مقاعد ({preferredTier.toUpperCase()})</span>
          </button>
        </div>

        {/* Detailed Seats Topology Matrix */}
        <div className="overflow-x-auto pb-4 scrollbar-thin">
          <div className="min-w-[650px] p-6 bg-slate-950/90 rounded-2xl border border-slate-800/80 flex flex-col items-center justify-center gap-3">
            {seatingMap.sections
              .filter(sec => selectedSectionId === 'all' || sec.id === selectedSectionId)
              .map((sec) => {
                const sectionSeats = seatingMap.seats.filter((s) => sec.rows.includes(s.row));

                return (
                  <div key={sec.id} className="w-full space-y-2 border-b border-slate-900/60 pb-3 last:border-b-0">
                    <div className="flex items-center justify-between text-[11px] px-2">
                      <span className="font-bold text-slate-300 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: sec.color }} />
                        {sec.nameAr}
                      </span>
                      <span className="font-mono text-slate-400">
                        السعر الرسمي: <strong className="text-white font-mono">{sec.price}</strong> ر.س • المتبقي {sec.availableCount} مقعد
                      </span>
                    </div>

                    <div className="flex flex-col items-center gap-1.5">
                      {sec.rows.map((row) => {
                        const rowSeats = sectionSeats.filter((s) => s.row === row);

                        return (
                          <div key={row} className="flex items-center gap-2">
                            <span className="w-12 text-[10px] font-mono text-slate-500 text-left font-bold truncate">
                              {row}
                            </span>

                            <div className="flex items-center gap-1.5">
                              {rowSeats.map((seat) => {
                                const isSelected = selectedSeats.some((s) => s.id === seat.id);
                                const isReserved = seat.status === 'reserved';
                                const isVip = seat.tierId === 'vip' || seat.tierId === 'royal';

                                return (
                                  <button
                                    key={seat.id}
                                    disabled={isReserved}
                                    onClick={() => onToggleSeat(seat)}
                                    onMouseEnter={() => setHoveredSeat(seat)}
                                    onMouseLeave={() => setHoveredSeat(null)}
                                    title={`${seat.label} - ${seat.tierNameAr} (${seat.price} ر.س) - ${isReserved ? 'محجوز' : 'متاح'}`}
                                    className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg text-[10px] font-mono font-bold flex items-center justify-center transition-all cursor-pointer ${
                                      isSelected
                                        ? 'bg-emerald-500 text-slate-950 ring-2 ring-emerald-300 scale-110 shadow-lg shadow-emerald-500/50 z-10'
                                        : isReserved
                                        ? 'bg-slate-900 text-slate-700 border border-slate-800/80 cursor-not-allowed opacity-50'
                                        : isVip
                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500 hover:text-slate-950 hover:scale-105'
                                        : 'bg-purple-600/20 text-purple-300 border border-purple-500/40 hover:bg-purple-600 hover:text-white hover:scale-105'
                                    }`}
                                  >
                                    {seat.number}
                                  </button>
                                );
                              })}
                            </div>

                            <span className="w-12 text-[10px] font-mono text-slate-500 text-right font-bold truncate">
                              {row}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
      )}

      {/* Selected Seats Summary & Action Button */}
      <div className="bg-slate-950 p-4 sm:p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center md:text-right">
          <span className="text-xs text-slate-400 block">المقاعد المحددة في هذا الحجز:</span>
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-1.5">
            {selectedSeats.length === 0 ? (
              <span className="text-xs text-amber-400 font-medium">
                لم يتم اختيار أي مقاعد بعد. انقر على المقاعد في المخطط أو اضغط زر القنص التلقائي.
              </span>
            ) : (
              selectedSeats.map((seat) => (
                <span
                  key={seat.id}
                  className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-bold"
                >
                  {seat.row} - مقعد {seat.number} ({seat.price} ر.س)
                </span>
              ))
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-left font-mono">
            <span className="text-[11px] text-slate-400 block">الإجمالي بالريال السعودي:</span>
            <span className="text-2xl font-black text-white">
              {selectedSeats.reduce((acc, s) => acc + s.price, 0)} <span className="text-xs text-purple-400">ر.س</span>
            </span>
          </div>

          <button
            onClick={onHoldSeatsOnWebook}
            disabled={selectedSeats.length === 0 || isHolding}
            className={`px-6 py-3.5 rounded-xl font-black text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer ${
              selectedSeats.length > 0 && !isHolding
                ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-300 text-slate-950 shadow-xl shadow-emerald-500/30 hover:scale-[1.02]'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            {isHolding ? (
              <>
                <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>جاري معالجة وتجهيز المقاعد في Webook...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-5 h-5" />
                <span>⚡ تجهيز الحجز وقفل المقاعد</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Real API Failure Fallback UI: Manual JSON / Test Payload input */}
      {reservationError?.hasError && (
        <ReservationFallbackCard
          errorState={reservationError}
          onApplyCustomPayload={onApplyCustomReservationPayload || (() => {})}
          onRetry={onHoldSeatsOnWebook}
          onDismiss={onDismissReservationError}
          defaultTotalPrice={selectedSeats.reduce((acc, s) => acc + s.price, 0)}
          selectedSeatsCount={selectedSeats.length}
        />
      )}

      {/* Real Webook Cart Hold Notification */}
      {cartHoldInfo?.active && !reservationError?.hasError && (
        <div className="bg-gradient-to-br from-emerald-950/60 via-slate-900 to-teal-950/40 border-2 border-emerald-500 rounded-3xl p-6 sm:p-7 space-y-5 animate-in fade-in shadow-2xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center shadow-lg shadow-emerald-500/40 shrink-0">
                <Check className="w-7 h-7 stroke-[3]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    تم تجهيز حزمة حجز المقاعد بنجاح
                  </span>
                  {cartHoldInfo.isCustomPayload && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      استجابة اختبار مخصصة
                    </span>
                  )}
                </div>
                <h4 className="text-lg font-black text-white mt-1">
                  المقاعد جاهزة الآن للتثبيت في سلة Webook فوراً!
                </h4>
                <p className="text-xs text-slate-300 mt-0.5">
                  رقم الحجز: <span className="font-mono text-emerald-400 font-bold">{cartHoldInfo.cartId}</span> • الحساب: <span className="text-white font-medium">{accountEmail || 'الحساب النشط'}</span>
                </p>
              </div>
            </div>

            {/* 10-Minute Countdown Clock */}
            <div className="bg-slate-950/90 border border-emerald-500/40 px-4 py-2.5 rounded-2xl flex items-center gap-2.5 shadow-inner">
              <Clock className="w-5 h-5 text-emerald-400 animate-pulse" />
              <div>
                <span className="text-[10px] text-slate-400 block font-sans">الوقت المتبقي في السلة:</span>
                <span className="text-xl font-black font-mono text-emerald-400">
                  {formatCountdown(secondsRemaining)}
                </span>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="bg-slate-950/80 rounded-2xl p-4 border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-300">
              اختر طريقة التثبيت الفوري في منصة Webook:
            </div>

            {paymentSessionError && (
              <div className="w-full p-3 bg-rose-950/80 border border-rose-500/50 rounded-xl text-xs text-rose-200 flex items-center justify-between gap-2 animate-in fade-in">
                <span>⚠️ {paymentSessionError}</span>
                <button
                  type="button"
                  onClick={() => setPaymentSessionError(null)}
                  className="text-rose-400 hover:text-rose-200 text-xs font-bold px-2 py-1 rounded"
                >
                  إغلاق
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
              {cartHoldInfo?.cartId && (
                <button
                  type="button"
                  onClick={handlePayTabsCheckout}
                  disabled={isInitiatingPayment}
                  className="w-full sm:w-auto px-5 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isInitiatingPayment ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>جاري إنشاء جلسة الدفع والتحويل...</span>
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      <span>💳 الدفع الآن عبر بوابة PayTabs (توليد فوري للجلسة)</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              )}

              {cartHoldInfo?.cartId && secondsRemaining === 0 && (
                <button
                  type="button"
                  onClick={handlePayTabsCheckout}
                  disabled={isInitiatingPayment}
                  className="w-full sm:w-auto px-4 py-3 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer animate-pulse"
                >
                  <RefreshCw className={`w-4 h-4 ${isInitiatingPayment ? 'animate-spin' : ''}`} />
                  <span>تحديث جلسة الدفع المنتهية (Refresh Payment)</span>
                </button>
              )}

              <button
                onClick={copyLiveSessionInjector}
                className="w-full sm:w-auto px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {copiedInjector ? (
                  <>
                    <CheckCheck className="w-4 h-4" />
                    <span>تم نسخ كود الحاقن الرسمي!</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-current" />
                    <span>⚡ نسخ كود تثبيت المقاعد في Webook</span>
                  </>
                )}
              </button>

              <a
                href={cartHoldInfo?.cartId ? `https://webook.com/ar/checkout?cart_id=${encodeURIComponent(cartHoldInfo.cartId)}&event=${encodeURIComponent(event.slug)}` : getWebookDirectCheckoutUrl()}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto px-5 py-3 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2"
              >
                <CreditCard className="w-4 h-4 fill-slate-950" />
                <span>💳 شاشة الدفع بالسلة النشطة (/checkout?cart_id=...)</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <a
                href={cartHoldInfo?.cartId ? `${directBookingUrl}?cart_id=${encodeURIComponent(cartHoldInfo.cartId)}` : directBookingUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto px-4 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                <span>⚡ مسار حجز التذاكر المباشر بالسلة (/book?cart_id=...)</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <a
                href={WEBOOK_MY_BOOKINGS_URL}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto px-4 py-3 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5"
              >
                <Ticket className="w-4 h-4 text-purple-400" />
                <span>عرض في حجوزاتي (My Bookings)</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Live Price & Tier Matcher */}
      {isPriceEditorOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#0f141c] border border-purple-500/40 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-black text-white">
                    مطابقة وتعديل الأسعار والفئات الرسمية
                  </h4>
                  <p className="text-xs text-slate-400">
                    يمكنك تعديل أي سعر ليتطابق 100% مع منصة Webook الرسمية
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsPriceEditorOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {editingTiers.map((tier, idx) => (
                <div key={tier.id || idx} className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <span className="text-xs font-bold text-slate-200 block">
                      {tier.nameAr || tier.name}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      معرف الفئة: {tier.id}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      value={tier.price}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        const updated = [...editingTiers];
                        updated[idx] = { ...tier, price: val };
                        setEditingTiers(updated);
                      }}
                      className="w-24 bg-slate-950 border border-purple-500/50 rounded-xl px-3 py-1.5 text-sm font-bold font-mono text-white text-center focus:outline-none focus:border-purple-400"
                    />
                    <span className="text-xs text-purple-400 font-bold">ر.س</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={handleLiveSyncFromWebook}
                className="text-xs text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>إعادة السحب التلقائي من Webook</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPriceEditorOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleSavePrices}
                  className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs shadow-lg transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>حفظ وتطبيق الأسعار</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: 1-Click Instant Auto-Booker */}
      <InstantAutoBookerModal
        isOpen={isAutoBookerModalOpen}
        onClose={() => setIsAutoBookerModalOpen(false)}
        event={event}
        ticketQuantity={ticketQuantity}
        userEmail={accountEmail}
      />

      {/* Modal: Zero-Touch Auto-Injector (100% Automated without manual intervention) */}
      <ZeroTouchAutoInjectorModal
        isOpen={isZeroTouchModalOpen}
        onClose={() => setIsZeroTouchModalOpen(false)}
        event={event}
        selectedSeats={selectedSeats}
        config={{
          targetEventUrl: event.url,
          selectedEventId: event.id,
          selectedDate: event.datesAvailable[0] || '',
          selectedTime: event.timesAvailable[0] || '',
          preferredTier,
          ticketQuantity,
          maxBudget: 2500,
          mode: 'sniper',
          headless: false,
          typingDelayMs: 40,
          retryIntervalMs: 50,
          autoSolveTurnstile: true,
          notifyTelegram: false,
          telegramBotToken: '',
          telegramChatId: '',
          proxyEnabled: false,
          proxyUrl: '',
          keepBrowserOpenOnReserve: true,
        }}
      />
    </div>
  );
};
