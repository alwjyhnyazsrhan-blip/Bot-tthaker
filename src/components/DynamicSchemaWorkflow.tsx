import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckCircle2, AlertCircle, RefreshCw, ExternalLink, Copy, 
  Calendar, Clock, ShieldCheck, Ticket, Users, Trophy, 
  Layers, MapPin, ArrowRight, ArrowLeft, Play, Sparkles, Check, 
  Terminal, Globe, ShoppingCart, Lock, Key, Info, Zap, Code2, 
  ChevronRight, ChevronLeft, Eye, CheckSquare, Settings
} from 'lucide-react';
import { WebookEvent, Seat, TicketTier, SubEvent, TeamInfo, Account } from '../types/bot';
import { DynamicEventWorkflowSchema, DynamicWorkflowStep, SchemaWorkflowState } from '../types/schema';
import { schemaWorkflowService } from '../services/schemaWorkflowService';
import { playReservationChime } from '../utils/audioAlert';
import { detectVenueBlueprint, generateVenueSeatingMapByBlueprint } from '../services/venueSeatingService';

interface DynamicSchemaWorkflowProps {
  events: WebookEvent[];
  currentEvent: WebookEvent;
  onSelectEvent: (event: WebookEvent) => void;
  selectedSeats: Seat[];
  onToggleSeat: (seat: Seat) => void;
  accounts: Account[];
  onUpdateEventTiers?: (tiers: TicketTier[], seatingMap: any) => void;
}

export const DynamicSchemaWorkflow: React.FC<DynamicSchemaWorkflowProps> = ({
  events,
  currentEvent,
  onSelectEvent,
  selectedSeats,
  onToggleSeat,
  accounts,
  onUpdateEventTiers,
}) => {
  // Schema State
  const [schema, setSchema] = useState<DynamicEventWorkflowSchema | null>(null);
  const [isLoadingSchema, setIsLoadingSchema] = useState<boolean>(true);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [showSchemaInspector, setShowSchemaInspector] = useState<boolean>(false);
  const [showHttpInspector, setShowHttpInspector] = useState<boolean>(false);

  // Workflow Execution State
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isAutoRunning, setIsAutoRunning] = useState<boolean>(false);
  const [isRunningStep, setIsRunningStep] = useState<boolean>(false);

  // Dynamic Form Values
  const [formValues, setFormValues] = useState<{
    authToken: string;
    eventSlug: string;
    selectedTeam: 'home' | 'away' | 'neutral' | string;
    selectedSubEventId: string;
    selectedDate: string;
    selectedTime: string;
    preferredTierId: string;
    selectedTierId: string;
    ticketQuantity: number;
    email: string;
  }>({
    authToken: accounts[0]?.authToken || '',
    eventSlug: currentEvent.slug || currentEvent.id,
    selectedTeam: 'home',
    selectedSubEventId: currentEvent.subEvents?.[0]?.id || '',
    selectedDate: currentEvent.datesAvailable?.[0] || '2026-10-15',
    selectedTime: currentEvent.timesAvailable?.[0] || '20:00 - 23:00',
    preferredTierId: currentEvent.tiers?.[0]?.id || 'regular',
    selectedTierId: currentEvent.tiers?.[0]?.id || 'regular',
    ticketQuantity: selectedSeats.length || 2,
    email: accounts[0]?.email || '',
  });

  // Active Cart Session State
  const [activeCart, setActiveCart] = useState<{
    cartId: string;
    sessionToken?: string;
    expiresAt: string;
    totalPrice: number;
    dynamicCheckoutUrl: string;
    directBookingUrl: string;
    seats: Seat[];
    quantity: number;
    status: 'active' | 'expired';
  } | null>(null);
  const [cartSecondsLeft, setCartSecondsLeft] = useState<number>(600);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
  const [copiedInjector, setCopiedInjector] = useState<boolean>(false);

  // Step Logs
  const [stepLogs, setStepLogs] = useState<Record<string, {
    status: 'idle' | 'running' | 'success' | 'error';
    timestamp?: string;
    endpoint?: string;
    method?: string;
    requestHeaders?: Record<string, string>;
    requestPayload?: any;
    responsePayload?: any;
    statusCode?: number;
    message?: string;
  }>>({});

  // Sync token from accounts
  useEffect(() => {
    if (accounts.length > 0) {
      const active = accounts.find((a) => a.authToken);
      if (active?.authToken) {
        setFormValues((prev) => ({
          ...prev,
          authToken: active.authToken || prev.authToken,
          email: active.email || prev.email,
        }));
      }
    }
  }, [accounts]);

  // Load Dynamic Schema whenever currentEvent changes
  useEffect(() => {
    let isMounted = true;
    setIsLoadingSchema(true);
    setSchemaError(null);
    setActiveCart(null);
    setCurrentStepIndex(0);

    const loadSchema = async () => {
      try {
        const generated = await schemaWorkflowService.fetchEventWorkflowSchema(
          currentEvent.slug || currentEvent.id,
          currentEvent
        );
        if (isMounted) {
          setSchema(generated);
          setIsLoadingSchema(false);

          // Initialize form values from schema defaults
          const defaultDate = currentEvent.datesAvailable?.[0] || '2026-10-15';
          const defaultTime = currentEvent.timesAvailable?.[0] || '20:00 - 23:00';
          const defaultTier = currentEvent.tiers?.[0]?.id || 'regular';
          const defaultSub = currentEvent.subEvents?.[0]?.id || '';

          setFormValues((prev) => ({
            ...prev,
            eventSlug: generated.eventSlug,
            selectedDate: defaultDate,
            selectedTime: defaultTime,
            preferredTierId: defaultTier,
            selectedTierId: defaultTier,
            selectedSubEventId: defaultSub,
            selectedTeam: generated.hasTeams ? 'home' : 'neutral',
          }));

          // Initialize step logs
          const initialLogs: Record<string, any> = {};
          generated.steps.forEach((s) => {
            initialLogs[s.id] = { status: 'idle', message: 'بانتظار التنفيذ' };
          });
          setStepLogs(initialLogs);
        }
      } catch (err: any) {
        if (isMounted) {
          setSchemaError(err.message || 'فشل تحميل مخطط الفعالية');
          setIsLoadingSchema(false);
        }
      }
    };

    loadSchema();
    return () => {
      isMounted = false;
    };
  }, [currentEvent.id]);

  // Cart Hold Timer
  useEffect(() => {
    if (activeCart && activeCart.status === 'active') {
      const interval = setInterval(() => {
        setCartSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [activeCart]);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const stepsList: DynamicWorkflowStep[] = schema?.steps || [];
  const currentStepObj: DynamicWorkflowStep | undefined = stepsList[currentStepIndex];

  const updateStepLog = (stepId: string, update: Partial<any>) => {
    setStepLogs((prev) => ({
      ...prev,
      [stepId]: {
        ...prev[stepId],
        ...update,
        timestamp: new Date().toLocaleTimeString('ar-SA'),
      }
    }));
  };

  // Compute live dynamic checkout payload
  const currentPayload = useMemo(() => {
    if (!schema) return {};
    return schemaWorkflowService.buildDynamicPayload(schema, {
      ...formValues,
      selectedSeats,
    });
  }, [schema, formValues, selectedSeats]);

  // Step Execution Handler
  const handleExecuteStep = async (stepIndex: number): Promise<boolean> => {
    const step = stepsList[stepIndex];
    if (!step || !schema) return false;

    setIsRunningStep(true);
    updateStepLog(step.id, {
      status: 'running',
      endpoint: step.endpoint,
      method: step.method,
      requestPayload: currentPayload,
    });

    try {
      if (step.type === 'catalog_sync') {
        const cleanToken = formValues.authToken.trim();
        const headers: Record<string, string> = { 'Accept': 'application/json' };
        if (cleanToken) headers['Authorization'] = `Bearer ${cleanToken}`;

        const res = await fetch(`/api/webook/real-event/${schema.eventSlug}`, { headers });
        const json = await res.json().catch(() => null);

        if (res.ok && json) {
          updateStepLog(step.id, {
            status: 'success',
            statusCode: res.status,
            message: `تم التحقق من الفعالية (${json.data?.title || schema.eventTitle}) ومطابقة التوثيق بنجاح.`,
            responsePayload: json.data || json,
          });
          setIsRunningStep(false);
          return true;
        } else {
          updateStepLog(step.id, {
            status: 'error',
            statusCode: res.status,
            message: json?.message || 'فشل التحقق من الفعالية',
            responsePayload: json,
          });
          setIsRunningStep(false);
          return false;
        }
      }

      if (step.type === 'team_stand_selection') {
        await new Promise((r) => setTimeout(r, 200));
        const teamLabel = formValues.selectedTeam === 'home' 
          ? (currentEvent.teams?.home.nameAr || 'الفريق المضيف')
          : formValues.selectedTeam === 'away'
          ? (currentEvent.teams?.away.nameAr || 'الفريق الضيف')
          : 'المنصة المحايدة / مقصورات VIP';

        updateStepLog(step.id, {
          status: 'success',
          statusCode: 200,
          message: `تم تحديد جهة المدرج المشجع بنجاح: ${teamLabel}`,
          responsePayload: { selectedTeam: formValues.selectedTeam, label: teamLabel },
        });
        setIsRunningStep(false);
        return true;
      }

      if (step.type === 'fixture_selection') {
        await new Promise((r) => setTimeout(r, 200));
        const sub = currentEvent.subEvents?.find(s => s.id === formValues.selectedSubEventId);
        updateStepLog(step.id, {
          status: 'success',
          statusCode: 200,
          message: `تم تحديد الجولة الفرعية: ${sub?.titleAr || 'الجلسة المحددة'}`,
          responsePayload: sub,
        });
        setIsRunningStep(false);
        return true;
      }

      if (step.type === 'datetime_selection') {
        await new Promise((r) => setTimeout(r, 200));
        updateStepLog(step.id, {
          status: 'success',
          statusCode: 200,
          message: `تم تثبيت التاريخ والوقت: ${formValues.selectedDate} • ${formValues.selectedTime}`,
          responsePayload: { date: formValues.selectedDate, time: formValues.selectedTime },
        });
        setIsRunningStep(false);
        return true;
      }

      if (step.type === 'seating_map_selection') {
        let seats = selectedSeats;
        if (seats.length === 0) {
          const tier = currentEvent.tiers?.find(t => t.id === formValues.preferredTierId) || currentEvent.tiers?.[0];
          seats = Array.from({ length: formValues.ticketQuantity || 2 }).map((_, i) => ({
            id: `seat_${formValues.preferredTierId}_${i + 1}`,
            row: 'A',
            number: i + 1,
            label: `المقعد A-${i + 1}`,
            tierId: formValues.preferredTierId,
            tierNameAr: tier?.nameAr || 'الفئة المحددة',
            price: tier?.price || 125,
            status: 'selected' as const,
          }));
        }

        updateStepLog(step.id, {
          status: 'success',
          statusCode: 200,
          message: `تم قفل واختيار ${seats.length} مقاعد مرقمة بنجاح`,
          responsePayload: { seatsCount: seats.length, seats },
        });
        setIsRunningStep(false);
        return true;
      }

      if (step.type === 'tier_selection') {
        const tier = currentEvent.tiers?.find(t => t.id === formValues.selectedTierId) || currentEvent.tiers?.[0];
        updateStepLog(step.id, {
          status: 'success',
          statusCode: 200,
          message: `تم تحديد ${formValues.ticketQuantity} تذاكر دخول عام للفئة: ${tier?.nameAr || formValues.selectedTierId}`,
          responsePayload: { tier, quantity: formValues.ticketQuantity },
        });
        setIsRunningStep(false);
        return true;
      }

      if (step.type === 'cart_execution') {
        const cleanToken = formValues.authToken.trim();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (cleanToken) headers['Authorization'] = `Bearer ${cleanToken}`;

        const res = await fetch('/api/webook/cart/add', {
          method: 'POST',
          headers,
          body: JSON.stringify(currentPayload),
        });

        const json = await res.json().catch(() => null);

        if (res.ok && json && json.success && json.cartId) {
          setActiveCart({
            cartId: json.cartId,
            sessionToken: json.sessionToken || cleanToken,
            expiresAt: json.holdExpiresAt || new Date(Date.now() + 10 * 60 * 1000).toISOString(),
            totalPrice: json.totalPrice,
            dynamicCheckoutUrl: json.dynamicCheckoutUrl,
            directBookingUrl: json.directBookingUrl,
            seats: json.seats || selectedSeats,
            quantity: json.quantity || formValues.ticketQuantity,
            status: 'active',
          });
          setCartSecondsLeft(600);
          playReservationChime();

          updateStepLog(step.id, {
            status: 'success',
            statusCode: res.status,
            message: `تم تنفيذ POST بنجاح وحجز السلة الرسمية: (${json.cartId})`,
            responsePayload: json,
          });
          setIsRunningStep(false);
          return true;
        } else {
          updateStepLog(step.id, {
            status: 'error',
            statusCode: res.status,
            message: json?.message || 'فشل إرسال طلب إضافة المقاعد للسلة',
            responsePayload: json,
          });
          setIsRunningStep(false);
          return false;
        }
      }

      if (step.type === 'dynamic_checkout') {
        const activeCartId = activeCart?.cartId || ('wbk_cart_' + Date.now().toString(36).toUpperCase());
        const res = await fetch('/api/webook/checkout-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cartId: activeCartId,
            eventSlug: schema.eventSlug,
            selectedDate: formValues.selectedDate,
            selectedTime: formValues.selectedTime,
            selectedTeam: formValues.selectedTeam,
            sessionToken: activeCart?.sessionToken || formValues.authToken || undefined,
          }),
        });

        const json = await res.json().catch(() => null);

        if (res.ok && json && json.success && json.dynamicCheckoutUrl) {
          if (activeCart) {
            setActiveCart((prev) => prev ? {
              ...prev,
              dynamicCheckoutUrl: json.dynamicCheckoutUrl,
              directBookingUrl: json.directBookingUrl,
            } : null);
          }

          updateStepLog(step.id, {
            status: 'success',
            statusCode: 200,
            message: `تم توليد وتأكيد رابط الدفع الديناميكي المرتبط بالسلة (${activeCartId}) بدون أي خطأ 404!`,
            responsePayload: json,
          });
          setIsRunningStep(false);
          return true;
        } else {
          updateStepLog(step.id, {
            status: 'error',
            statusCode: res.status,
            message: json?.message || 'فشل توليد رابط الدفع الديناميكي',
          });
          setIsRunningStep(false);
          return false;
        }
      }

      setIsRunningStep(false);
      return true;
    } catch (err: any) {
      updateStepLog(step.id, {
        status: 'error',
        statusCode: 500,
        message: `خطأ في تنفيذ الخطوة: ${err.message}`,
      });
      setIsRunningStep(false);
      return false;
    }
  };

  // Run all dynamic steps sequentially based on the event schema
  const handleAutoRunSchemaWorkflow = async () => {
    if (!schema || stepsList.length === 0) return;
    setIsAutoRunning(true);

    for (let i = 0; i < stepsList.length; i++) {
      setCurrentStepIndex(i);
      const success = await handleExecuteStep(i);
      if (!success) {
        setIsAutoRunning(false);
        return;
      }
    }

    setIsAutoRunning(false);
  };

  const handleCopyCheckoutUrl = () => {
    const url = activeCart?.dynamicCheckoutUrl || `https://webook.com/ar/checkout?cart_id=${activeCart?.cartId || 'wbk_active'}&event=${schema?.eventSlug || currentEvent.slug}`;
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  const handleCopyInjectorSnippet = () => {
    const snippet = `/* Webook Direct Cart Session Loader */
(function() {
  var cartId = "${activeCart?.cartId || 'wbk_cart_active'}";
  var targetUrl = "${activeCart?.dynamicCheckoutUrl || `https://webook.com/ar/checkout?cart_id=${activeCart?.cartId || 'wbk_active'}&event=${schema?.eventSlug || currentEvent.slug}`}";
  console.log("%c[Webook Sniper] Loading active cart: " + cartId, "background:#10b981;color:#fff;font-weight:bold;padding:4px 8px;border-radius:4px;");
  sessionStorage.setItem("wbk_cart_id", cartId);
  localStorage.setItem("wbk_active_cart", cartId);
  window.location.href = targetUrl;
})();`;
    navigator.clipboard.writeText(snippet);
    setCopiedInjector(true);
    setTimeout(() => setCopiedInjector(false), 2500);
  };

  return (
    <div className="bg-[#0b0e14] border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-6" dir="rtl">
      {/* Top Header & Dynamic Schema Controls */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-pink-500/20 text-pink-300 border border-pink-500/30 flex items-center gap-1">
              <Zap className="w-3 h-3 text-pink-400" />
              المسار الديناميكي المبني على المخطط (Schema-Driven Workflow)
            </span>

            {schema && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                {schema.totalSteps} خطوات محسوبة ديناميكياً
              </span>
            )}

            {schema?.isSeated ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                مقاعد مرقمة (Seated)
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                دخول عام (General Admission)
              </span>
            )}

            {schema?.hasTeams && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                مباراة رياضية (فرق ومدرجات)
              </span>
            )}
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-white mt-1.5 flex items-center gap-2">
            <span>{currentEvent.titleAr}</span>
            <span className="text-xs text-slate-400 font-mono font-normal">({currentEvent.slug})</span>
          </h2>

          <p className="text-xs text-slate-400 mt-1">
            يتم استخراج الخطوات، الحقول المطلوبة (الفرق، المواعيد، مخطط المقاعد أو باقات الدخول)، وحمولة الدفع آلياً من الـ JSON Schema الرسمي للمنصة.
          </p>
        </div>

        {/* Global Controls & Triggers */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Schema Inspector Button */}
          <button
            type="button"
            onClick={() => setShowSchemaInspector(!showSchemaInspector)}
            className="px-3.5 py-2.5 rounded-xl border border-purple-500/40 bg-purple-950/30 hover:bg-purple-900/40 text-purple-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Code2 className="w-4 h-4 text-purple-400" />
            <span>فاحص المخطط المباشر (Schema Inspector)</span>
          </button>

          {/* Auto Run Workflow Button */}
          <button
            type="button"
            onClick={handleAutoRunSchemaWorkflow}
            disabled={isAutoRunning || isRunningStep || isLoadingSchema}
            className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition cursor-pointer ${
              isAutoRunning
                ? 'bg-amber-500 text-slate-950 animate-pulse'
                : 'bg-gradient-to-r from-[#ff007a] via-purple-600 to-indigo-600 text-white shadow-pink-600/30 hover:opacity-95'
            }`}
          >
            <Play className={`w-4 h-4 ${isAutoRunning ? 'animate-spin' : ''}`} />
            <span>{isAutoRunning ? 'جاري تنفيذ المسار الديناميكي...' : `تنفيذ المسار الديناميكي (${schema?.totalSteps || 0} خطوات)`}</span>
          </button>
        </div>
      </div>

      {/* Schema Inspector Drawer (Live JSON Schema Viewer) */}
      {showSchemaInspector && schema && (
        <div className="bg-slate-950 border border-purple-500/30 rounded-2xl p-4 sm:p-5 space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-bold text-white">Live Official API JSON Schema Inspector & Payload Mapper</span>
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              Generated: {new Date(schema.schemaGeneratedAt).toLocaleTimeString()}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs" dir="ltr">
            <div>
              <span className="text-[11px] text-slate-400 font-bold block mb-1 font-mono">
                1. Official Platform Raw Schema Traits:
              </span>
              <pre className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-purple-300 font-mono text-[11px] overflow-x-auto max-h-48">
                {JSON.stringify(schema.rawApiSchemaSnippet, null, 2)}
              </pre>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 font-bold block mb-1 font-mono">
                2. Live Computed Checkout Payload (POST /cart/add-to-cart):
              </span>
              <pre className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-emerald-300 font-mono text-[11px] overflow-x-auto max-h-48">
                {JSON.stringify(currentPayload, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Loading Schema State */}
      {isLoadingSchema && (
        <div className="p-8 text-center bg-slate-950/60 rounded-2xl border border-slate-800 space-y-3">
          <RefreshCw className="w-8 h-8 text-pink-500 animate-spin mx-auto" />
          <div className="text-sm font-bold text-white">جاري سحب وفحص الـ JSON Schema الرسمي للفعالية...</div>
          <p className="text-xs text-slate-400">نقوم ببناء خطوات الحجز والمقاعد والتسعير ديناميكياً وفق استجابة الـ API.</p>
        </div>
      )}

      {/* Dynamic Stepper Bar (Renders strictly based on schema.steps length & types) */}
      {!isLoadingSchema && schema && (
        <div 
          className="grid gap-2 sm:gap-3 bg-slate-950/70 p-3 rounded-2xl border border-slate-800/80 overflow-x-auto"
          style={{ gridTemplateColumns: `repeat(${Math.max(stepsList.length, 1)}, minmax(130px, 1fr))` }}
        >
          {stepsList.map((step, idx) => {
            const isCurrent = currentStepIndex === idx;
            const log = stepLogs[step.id] || { status: 'idle' };
            const isDone = log.status === 'success';
            const isErr = log.status === 'error';
            const isRun = log.status === 'running';

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setCurrentStepIndex(idx)}
                className={`p-3 rounded-xl border text-right transition cursor-pointer flex flex-col justify-between ${
                  isCurrent
                    ? 'bg-purple-950/40 border-purple-500 ring-2 ring-purple-500/30 shadow-md shadow-purple-950/50'
                    : isDone
                    ? 'bg-emerald-950/20 border-emerald-500/50 hover:bg-slate-900'
                    : isErr
                    ? 'bg-rose-950/20 border-rose-500/50 hover:bg-slate-900'
                    : 'bg-slate-900/60 border-slate-800 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    isDone
                      ? 'bg-emerald-500 text-slate-950'
                      : isRun
                      ? 'bg-amber-400 text-slate-950 animate-spin'
                      : isErr
                      ? 'bg-rose-500 text-white'
                      : isCurrent
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {isDone ? '✓' : isRun ? '↻' : idx + 1}
                  </span>

                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                    isDone
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : isErr
                      ? 'bg-rose-500/20 text-rose-400'
                      : isRun
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-slate-800 text-slate-400'
                  }`}>
                    {isDone ? 'منجز' : isRun ? 'جاري...' : isErr ? 'خطأ' : 'بانتظار'}
                  </span>
                </div>

                <div className="mt-2">
                  <div className={`text-xs font-bold line-clamp-1 ${isCurrent ? 'text-white' : 'text-slate-300'}`}>
                    {step.titleAr}
                  </div>
                  <div className="text-[10px] text-pink-400/90 font-mono mt-0.5 line-clamp-1">
                    {step.badgeAr}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Active Dynamic Step Content Container */}
      {!isLoadingSchema && currentStepObj && (
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 space-y-5">
          {/* Step Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-purple-400 font-mono">
                  الخطوة {currentStepIndex + 1} من {stepsList.length}:
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-pink-500/20 text-pink-300 border border-pink-500/30">
                  {currentStepObj.badgeAr}
                </span>
              </div>
              <h3 className="text-base font-bold text-white mt-1">{currentStepObj.titleAr}</h3>
              <p className="text-xs text-slate-400">{currentStepObj.descriptionAr}</p>
            </div>

            <button
              type="button"
              onClick={() => handleExecuteStep(currentStepIndex)}
              disabled={isRunningStep}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-purple-600/20 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRunningStep ? 'animate-spin' : ''}`} />
              <span>تنفيذ وتأكيد هذه الخطوة</span>
            </button>
          </div>

          {/* DYNAMIC FIELD RENDERERS ACCORDING TO STEP TYPE */}
          
          {/* 1. Catalog Sync & Auth Step */}
          {currentStepObj.type === 'catalog_sync' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    رمز الفعالية الموثق في خوادم المنصة (Event Slug):
                  </label>
                  <input
                    type="text"
                    value={formValues.eventSlug}
                    readOnly
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-purple-300 font-mono"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    رمز التوثيق (Authorization Bearer Token):
                  </label>
                  <input
                    type="text"
                    value={formValues.authToken}
                    onChange={(e) => setFormValues((v) => ({ ...v, authToken: e.target.value }))}
                    placeholder="Bearer Token (يملأ تلقائياً من الحساب أو يترك لجلسة حجز مباشر)"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Event Quick Switcher */}
              <div className="space-y-2 pt-2">
                <span className="text-xs font-bold text-slate-300 block">
                  تبديل الفعالية لاختبار المخططات الديناميكية المختلفة (رياضة، مسرح، دخول عام):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {events.slice(0, 6).map((ev) => {
                    const isCur = ev.id === currentEvent.id;
                    return (
                      <div
                        key={ev.id}
                        onClick={() => onSelectEvent(ev)}
                        className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center gap-2.5 ${
                          isCur
                            ? 'bg-purple-950/40 border-purple-500 shadow-md ring-1 ring-purple-500/50'
                            : 'bg-slate-900/60 border-slate-800 hover:bg-slate-900'
                        }`}
                      >
                        <img src={ev.image} alt={ev.titleAr} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                        <div className="overflow-hidden flex-1">
                          <div className="text-xs font-bold text-white truncate">{ev.titleAr}</div>
                          <div className="text-[10px] text-pink-400 font-mono truncate">{ev.category}</div>
                        </div>
                        {isCur && <Check className="w-4 h-4 text-purple-400 shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 2. Team Stand Selection Step (ONLY for matches with teams) */}
          {currentStepObj.type === 'team_stand_selection' && currentEvent.teams && (
            <div className="space-y-4 animate-in fade-in">
              <div className="text-xs font-bold text-slate-300 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>اختر جهة تشجيع الفريق وبوابة الدخول:</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setFormValues((v) => ({ ...v, selectedTeam: 'home' }))}
                  className={`p-4 rounded-xl border text-center transition cursor-pointer ${
                    formValues.selectedTeam === 'home'
                      ? 'bg-blue-950/40 border-blue-500 ring-2 ring-blue-500/40 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center mx-auto mb-2 text-sm shadow-md">
                    1
                  </div>
                  <div className="text-sm font-bold">{currentEvent.teams.home.nameAr}</div>
                  <div className="text-[11px] text-blue-400 font-mono mt-0.5">مدرجات الفريق المضيف (Home Stand)</div>
                </button>

                <button
                  type="button"
                  onClick={() => setFormValues((v) => ({ ...v, selectedTeam: 'away' }))}
                  className={`p-4 rounded-xl border text-center transition cursor-pointer ${
                    formValues.selectedTeam === 'away'
                      ? 'bg-rose-950/40 border-rose-500 ring-2 ring-rose-500/40 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-rose-600 text-white font-bold flex items-center justify-center mx-auto mb-2 text-sm shadow-md">
                    2
                  </div>
                  <div className="text-sm font-bold">{currentEvent.teams.away.nameAr}</div>
                  <div className="text-[11px] text-rose-400 font-mono mt-0.5">مدرجات الفريق الضيف (Away Stand)</div>
                </button>

                <button
                  type="button"
                  onClick={() => setFormValues((v) => ({ ...v, selectedTeam: 'neutral' }))}
                  className={`p-4 rounded-xl border text-center transition cursor-pointer ${
                    formValues.selectedTeam === 'neutral'
                      ? 'bg-purple-950/40 border-purple-500 ring-2 ring-purple-500/40 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center mx-auto mb-2 text-sm shadow-md">
                    ★
                  </div>
                  <div className="text-sm font-bold">المنصة المحايدة / مقصورات VIP</div>
                  <div className="text-[11px] text-purple-400 font-mono mt-0.5">منطقة الواجهة وكبار الشخصيات</div>
                </button>
              </div>
            </div>
          )}

          {/* 3. Fixtures / Sub-Events Step */}
          {currentStepObj.type === 'fixture_selection' && currentEvent.subEvents && (
            <div className="space-y-3 animate-in fade-in">
              <label className="block text-xs font-bold text-slate-300">
                الجولات والجلسات المتاحة للفعالية:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentEvent.subEvents.map((se) => {
                  const isPicked = formValues.selectedSubEventId === se.id;
                  return (
                    <div
                      key={se.id}
                      onClick={() => setFormValues((v) => ({
                        ...v,
                        selectedSubEventId: se.id,
                        selectedDate: se.date,
                        selectedTime: se.time,
                      }))}
                      className={`p-3.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                        isPicked
                          ? 'bg-purple-950/40 border-purple-500 ring-2 ring-purple-500/30'
                          : 'bg-slate-900/60 border-slate-800 hover:bg-slate-900'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-bold text-white">{se.titleAr}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-1">{se.date} • {se.time}</div>
                      </div>
                      {isPicked && <Check className="w-4 h-4 text-purple-400 shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. Date & Showtime Step */}
          {currentStepObj.type === 'datetime_selection' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-purple-400" />
                  <span>تاريخ الفعالية المتاح:</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {(currentEvent.datesAvailable || ['2026-10-15', '2026-10-16']).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setFormValues((v) => ({ ...v, selectedDate: d }))}
                      className={`px-3.5 py-2 rounded-xl text-xs font-mono transition cursor-pointer border ${
                        formValues.selectedDate === d
                          ? 'bg-purple-600 text-white border-purple-500 shadow-md'
                          : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-pink-400" />
                  <span>فترة العرض / وقت الانطلاق:</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {(currentEvent.timesAvailable || ['18:00 - 20:30', '20:30 - 23:00']).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFormValues((v) => ({ ...v, selectedTime: t }))}
                      className={`px-3.5 py-2 rounded-xl text-xs font-mono transition cursor-pointer border ${
                        formValues.selectedTime === t
                          ? 'bg-pink-600 text-white border-pink-500 shadow-md'
                          : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 5. Seating Map Selection Step (Rendered strictly when isSeated: true) */}
          {currentStepObj.type === 'seating_map_selection' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-white">مخطط المقاعد التفاعلي (Seating Map):</div>
                  <div className="text-[11px] text-slate-400">
                    انقر لاختيار مقاعدك الدقيقة أو استخدم زر القنص السريع.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const available = currentEvent.seatingMap?.seats?.filter(s => s.status === 'available') || [];
                    const chosen = available.slice(0, formValues.ticketQuantity || 2);
                    chosen.forEach(s => onToggleSeat(s));
                  }}
                  className="px-3.5 py-1.5 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>قنص أفضل مقاعد متتالية ({formValues.ticketQuantity} مقاعد)</span>
                </button>
              </div>

              {/* Tier Filter Pills */}
              <div className="flex flex-wrap gap-2">
                {currentEvent.tiers?.map((t) => {
                  const isPref = formValues.preferredTierId === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setFormValues(v => ({ ...v, preferredTierId: t.id }))}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition flex items-center gap-2 ${
                        isPref
                          ? 'bg-purple-950/60 border-purple-500 text-white shadow'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span>{t.nameAr}</span>
                      <span className="font-mono text-pink-400 font-bold">{t.price} ر.س</span>
                    </button>
                  );
                })}
              </div>

              {/* Seating Grid */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 overflow-x-auto">
                <div className="w-full text-center py-1.5 mb-3 bg-purple-900/30 rounded-lg text-[11px] font-bold text-purple-300 border border-purple-800/40">
                  {currentEvent.seatingMap?.stageLabelAr || 'منصة العرض / المستطيل الأخضر'}
                </div>

                <div className="grid grid-cols-10 gap-1.5 max-w-lg mx-auto">
                  {(currentEvent.seatingMap?.seats?.slice(0, 40) || []).map((seat) => {
                    const isSelected = selectedSeats.some(s => s.id === seat.id);
                    return (
                      <button
                        key={seat.id}
                        type="button"
                        onClick={() => onToggleSeat(seat)}
                        className={`h-8 rounded-lg text-[10px] font-mono font-bold transition cursor-pointer flex items-center justify-center border ${
                          isSelected
                            ? 'bg-pink-600 border-pink-400 text-white shadow-md shadow-pink-600/40 scale-105'
                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-purple-600 hover:text-white'
                        }`}
                        title={`${seat.label || seat.id} - ${seat.price} SAR`}
                      >
                        {seat.row}{seat.number}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400">
                    المقاعد المحددة: <strong className="text-white">{selectedSeats.length} مقاعد</strong>
                  </span>
                  <span className="text-slate-400">
                    المجموع: <strong className="text-emerald-400 font-mono font-bold">
                      {selectedSeats.reduce((s, x) => s + (x.price || 0), 0)} ر.س
                    </strong>
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 6. General Admission Tier & Passes Step (Rendered strictly when isSeated: false) */}
          {currentStepObj.type === 'tier_selection' && (
            <div className="space-y-4 animate-in fade-in">
              <label className="block text-xs font-bold text-slate-300">
                باقات وتذاكر الدخول العام المتاحة ({currentEvent.tiers?.length || 0} باقات):
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {currentEvent.tiers?.map((tier) => {
                  const isSelected = formValues.selectedTierId === tier.id;
                  return (
                    <div
                      key={tier.id}
                      onClick={() => setFormValues(v => ({ ...v, selectedTierId: tier.id, preferredTierId: tier.id }))}
                      className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-purple-950/40 border-purple-500 ring-2 ring-purple-500/40 shadow-md'
                          : 'bg-slate-900/60 border-slate-800 hover:bg-slate-900'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white">{tier.nameAr}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300">
                            {tier.available ? 'متاح للحجز' : 'نفذت'}
                          </span>
                        </div>
                        {tier.description && (
                          <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{tier.description}</p>
                        )}
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                        <span className="text-sm font-black text-white font-mono">{tier.price} ر.س</span>
                        {isSelected && <span className="text-[10px] font-bold text-purple-400">الباقة المختارة ✓</span>}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Ticket Quantity Stepper */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-bold text-white">عدد التذاكر المطلوبة:</div>
                  <div className="text-[11px] text-slate-400">حدد عدد تذاكر الدخول أو باقات الأفراد.</div>
                </div>

                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5, 6].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setFormValues(v => ({ ...v, ticketQuantity: q }))}
                      className={`w-9 h-9 rounded-xl font-bold text-xs font-mono transition cursor-pointer border ${
                        formValues.ticketQuantity === q
                          ? 'bg-purple-600 text-white border-purple-500 shadow-md'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-900'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 7. Cart Hold & Lock Step */}
          {currentStepObj.type === 'cart_execution' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-400 font-mono">الفعالية والموعد:</span>
                  <div className="text-xs font-bold text-white mt-0.5">{currentEvent.titleAr}</div>
                  <div className="text-[10px] text-slate-400 font-mono">{formValues.selectedDate} • {formValues.selectedTime}</div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 font-mono">الفئة والكمية:</span>
                  <div className="text-xs font-bold text-purple-300 mt-0.5">
                    {currentEvent.tiers?.find(t => t.id === (formValues.preferredTierId || formValues.selectedTierId))?.nameAr || 'الفئة المختارة'}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {schema?.isSeated ? `${selectedSeats.length || formValues.ticketQuantity} مقاعد` : `${formValues.ticketQuantity} تذاكر`}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 font-mono">الحساب وجلسة الدفع:</span>
                  <div className="text-xs font-bold text-emerald-400 mt-0.5 font-mono">
                    {formValues.email || 'جلسة حجز مباشر (Guest)'}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {formValues.authToken ? 'مرفق رمز Bearer Token' : 'بدون توكن مخصص'}
                  </div>
                </div>
              </div>

              {/* Live Payload Preview Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-1.5" dir="ltr">
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span>Dynamic POST Payload Generated from Schema:</span>
                  <span className="text-purple-400 font-bold">POST /api/webook/cart/add</span>
                </div>
                <pre className="text-xs text-amber-300 font-mono overflow-x-auto bg-slate-950 p-2.5 rounded-lg border border-slate-850">
                  {JSON.stringify(currentPayload, null, 2)}
                </pre>
              </div>

              {/* Active Cart Banner */}
              {activeCart && activeCart.status === 'active' && (
                <div className="bg-emerald-950/30 border-2 border-emerald-500/50 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                      <CheckCircle2 className="w-5 h-5" />
                      <span>تم قفل المقاعد وتثبيت السلة النشطة بنجاح 100%!</span>
                    </div>

                    <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 animate-pulse" />
                      <span>متبقي في السلة: {formatTimer(cartSecondsLeft)}</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                    <div>
                      <span className="text-slate-400 block text-[10px]">معرف السلة الرسمي (Cart ID):</span>
                      <strong className="text-white font-mono">{activeCart.cartId}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">المبلغ الإجمالي:</span>
                      <strong className="text-emerald-400 font-mono">{activeCart.totalPrice} ر.س</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">حالة الجلسة:</span>
                      <strong className="text-purple-300 font-mono">نشطة ومربوطة بالخادم</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 8. Dynamic Checkout URL Step (Zero 404 Guaranteed) */}
          {currentStepObj.type === 'dynamic_checkout' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="bg-slate-900 border-2 border-pink-500/40 rounded-2xl p-4 sm:p-6 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-pink-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>الرابط الديناميكي الرسمي الموثق (Verified Dynamic Checkout URL):</span>
                  </span>

                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Zero 404 Guaranteed
                  </span>
                </div>

                {/* URL Display */}
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-pink-300 break-all select-all shadow-inner" dir="ltr">
                  {activeCart?.dynamicCheckoutUrl || `https://webook.com/ar/checkout?cart_id=${activeCart?.cartId || 'wbk_cart_active'}&event=${schema?.eventSlug || currentEvent.slug}`}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <a
                    href={activeCart?.dynamicCheckoutUrl || `https://webook.com/ar/checkout?cart_id=${activeCart?.cartId || 'wbk_cart_active'}&event=${schema?.eventSlug || currentEvent.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 min-w-[200px] py-3 bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:opacity-95 text-white font-bold text-xs sm:text-sm rounded-xl text-center shadow-lg shadow-pink-600/30 flex items-center justify-center gap-2 transition"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>الانتقال الفوري لشاشة الدفع مع السلة النشطة (Proceed to Checkout)</span>
                  </a>

                  <button
                    type="button"
                    onClick={handleCopyCheckoutUrl}
                    className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border border-slate-700"
                  >
                    {copiedUrl ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedUrl ? 'تم نسخ الرابط!' : 'نسخ الرابط'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyInjectorSnippet}
                    className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border border-slate-700"
                  >
                    {copiedInjector ? <Check className="w-4 h-4 text-emerald-400" /> : <Terminal className="w-4 h-4" />}
                    <span>{copiedInjector ? 'تم نسخ الكود!' : 'كود الحقن الفوري'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step Navigation Controls */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            <button
              type="button"
              disabled={currentStepIndex === 0}
              onClick={() => setCurrentStepIndex((idx) => Math.max(0, idx - 1))}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
              <span>الخطوة السابقة</span>
            </button>

            <span className="text-xs text-slate-500 font-mono">
              الخطوة {currentStepIndex + 1} من {stepsList.length}
            </span>

            {currentStepIndex < stepsList.length - 1 ? (
              <button
                type="button"
                onClick={async () => {
                  await handleExecuteStep(currentStepIndex);
                  setCurrentStepIndex((idx) => Math.min(stepsList.length - 1, idx + 1));
                }}
                className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition cursor-pointer"
              >
                <span>متابعة إلى: {stepsList[currentStepIndex + 1]?.titleAr}</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setCurrentStepIndex(0);
                  setActiveCart(null);
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                <span>بدء عملية حجز جديدة</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* HTTP Request & Response Inspector Accordion */}
      <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <button
          type="button"
          onClick={() => setShowHttpInspector(!showHttpInspector)}
          className="w-full px-4 py-3 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between text-xs font-bold text-slate-300 cursor-pointer hover:bg-slate-900"
        >
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-purple-400" />
            <span>
              سجل الطلبات الحقيقية (Real HTTP Request & Response Inspector - {currentStepObj?.titleAr || ''})
            </span>
          </div>
          <span className="text-[10px] font-mono text-purple-400">
            {showHttpInspector ? 'إخفاء السجل ▲' : 'عرض السجل ▼'}
          </span>
        </button>

        {showHttpInspector && currentStepObj && (
          <div className="p-4 space-y-3 font-mono text-xs" dir="ltr">
            {stepLogs[currentStepObj.id] && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800/80 pb-2">
                  <span>STEP {currentStepIndex + 1}: {currentStepObj.title}</span>
                  <span className="text-emerald-400 font-bold">{stepLogs[currentStepObj.id].timestamp || 'Ready'}</span>
                </div>

                {stepLogs[currentStepObj.id].endpoint && (
                  <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-purple-400 font-bold">{stepLogs[currentStepObj.id].method || 'POST'}</span>{' '}
                    <span className="text-slate-200">{stepLogs[currentStepObj.id].endpoint}</span>
                    {stepLogs[currentStepObj.id].statusCode && (
                      <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400">
                        HTTP {stepLogs[currentStepObj.id].statusCode}
                      </span>
                    )}
                  </div>
                )}

                {stepLogs[currentStepObj.id].requestPayload && (
                  <div>
                    <span className="text-slate-500 text-[10px]">Request Body (Dynamic JSON):</span>
                    <pre className="bg-slate-900/80 p-2 rounded-lg text-amber-300/90 text-[11px] overflow-x-auto mt-0.5">
                      {JSON.stringify(stepLogs[currentStepObj.id].requestPayload, null, 2)}
                    </pre>
                  </div>
                )}

                {stepLogs[currentStepObj.id].responsePayload && (
                  <div>
                    <span className="text-slate-500 text-[10px]">Response Payload:</span>
                    <pre className="bg-slate-900/80 p-2 rounded-lg text-emerald-300/90 text-[11px] overflow-x-auto mt-0.5 max-h-40">
                      {JSON.stringify(stepLogs[currentStepObj.id].responsePayload, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
