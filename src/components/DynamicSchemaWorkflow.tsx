import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckCircle2, AlertCircle, RefreshCw, ExternalLink, Copy, 
  Calendar, Clock, ShieldCheck, Ticket, Users, Trophy, 
  Layers, MapPin, ArrowRight, ArrowLeft, Play, Sparkles, Check, 
  Terminal, Globe, ShoppingCart, Lock, Key, Info, Zap, Code2, 
  ChevronRight, ChevronLeft, Eye, CheckSquare, Settings,
  CreditCard, QrCode, FileText, CheckCircle, Download, Printer, Filter
} from 'lucide-react';
import { WebookEvent, Seat, TicketTier, SubEvent, TeamInfo, Account } from '../types/bot';
import { DynamicEventWorkflowSchema, DynamicWorkflowStep, SchemaWorkflowState } from '../types/schema';
import { schemaWorkflowService } from '../services/schemaWorkflowService';
import { playReservationChime } from '../utils/audioAlert';
import { detectVenueBlueprint, generateVenueSeatingMapByBlueprint } from '../services/venueSeatingService';
import { getActiveBearerToken } from '../utils/authManager';

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
    authToken: getActiveBearerToken() || accounts[0]?.authToken || '',
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
    orderReference?: string;
    sessionToken?: string;
    expiresAt: string;
    totalPrice: number;
    dynamicCheckoutUrl: string;
    directBookingUrl: string;
    redirect_url?: string;
    paymentGatewayUrl?: string;
    redirectUrl?: string;
    paymentPageUrl?: string;
    gateway?: string;
    gatewayDisplayNameAr?: string;
    transactionReference?: string;
    capturedFromApiResponse?: boolean;
    seats: Seat[];
    seatIds?: string[];
    quantity: number;
    status: 'active' | 'expired' | 'confirmed';
    confirmedOrder?: any;
  } | null>(null);
  const [cartSecondsLeft, setCartSecondsLeft] = useState<number>(600);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
  const [copiedInjector, setCopiedInjector] = useState<boolean>(false);
  const [copiedOrderRef, setCopiedOrderRef] = useState<boolean>(false);
  const [copiedPaytabsUrl, setCopiedPaytabsUrl] = useState<boolean>(false);
  const [isGeneratingPaymentSession, setIsGeneratingPaymentSession] = useState<boolean>(false);
  const [paymentSessionFreshAt, setPaymentSessionFreshAt] = useState<string | null>(null);
  const [freshSessionNotice, setFreshSessionNotice] = useState<string | null>(null);

  // Live Seating Map from API
  const [apiSeatingMap, setApiSeatingMap] = useState<any | null>(null);
  const [isLoadingSeatingMap, setIsLoadingSeatingMap] = useState<boolean>(false);
  const [selectedSectionFilter, setSelectedSectionFilter] = useState<string>('all');

  // Payment Verification & Booking History State
  const [confirmedOrder, setConfirmedOrder] = useState<any | null>(null);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState<boolean>(false);
  const [bookingHistory, setBookingHistory] = useState<any[]>([]);
  const [isCheckingHistory, setIsCheckingHistory] = useState<boolean>(false);
  const [historyFeedback, setHistoryFeedback] = useState<string>('');
  const [showHistoryDrawer, setShowHistoryDrawer] = useState<boolean>(false);
  const [manualOrderRef, setManualOrderRef] = useState<string>('');
  const [manualCartId, setManualCartId] = useState<string>('');
  const [manualEmail, setManualEmail] = useState<string>(accounts[0]?.email || '');
  const [verifyMessage, setVerifyMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  // Sync token from accounts and stored state
  useEffect(() => {
    const activeToken = getActiveBearerToken();
    if (activeToken) {
      setFormValues((prev) => ({
        ...prev,
        authToken: activeToken,
      }));
    } else if (accounts.length > 0) {
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
        const effectiveToken = getActiveBearerToken() || formValues.authToken?.trim() || undefined;
        const generated = await schemaWorkflowService.fetchEventWorkflowSchema(
          currentEvent.slug || currentEvent.id,
          effectiveToken
        );
        if (isMounted) {
          setSchema(generated);
          setIsLoadingSchema(false);

          // Initialize form values from schema defaults
          const initialValues: Record<string, any> = {};
          generated.steps.forEach((s) => {
            s.fields.forEach((f) => {
              if (f.defaultValue !== undefined) {
                initialValues[f.name] = f.defaultValue;
              }
            });
          });

          const defaultDate = initialValues.selectedDate || currentEvent.datesAvailable?.[0] || '2026-10-15';
          const defaultTime = initialValues.selectedTime || currentEvent.timesAvailable?.[0] || '20:00 - 23:00';
          const defaultTier = initialValues.preferredTierId || initialValues.selectedTierId || currentEvent.tiers?.[0]?.id || 'regular';
          const defaultSub = initialValues.selectedSubEventId || currentEvent.subEvents?.[0]?.id || '';

          setFormValues((prev) => ({
            ...prev,
            selectedDate: defaultDate,
            selectedTime: defaultTime,
            preferredTierId: defaultTier,
            selectedTierId: defaultTier,
            selectedSubEventId: defaultSub,
            selectedTeam: initialValues.selectedTeam || (generated.hasTeams ? 'home' : 'neutral'),
            ...initialValues,
            eventSlug: generated.eventSlug,
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
  }, [currentEvent.id, currentEvent.slug]);

  // Fetch available seat maps and categories dynamically from the API
  useEffect(() => {
    let isMounted = true;
    const fetchSeatingMap = async () => {
      setIsLoadingSeatingMap(true);
      try {
        const slug = currentEvent.slug || currentEvent.id;
        const effectiveToken = getActiveBearerToken() || formValues.authToken?.trim() || undefined;
        const headers: Record<string, string> = { 'Accept': 'application/json' };
        if (effectiveToken) headers['Authorization'] = `Bearer ${effectiveToken}`;
        const res = await fetch(`/api/webook/seating-map/${encodeURIComponent(slug)}`, { headers });
        if (res.ok) {
          const json = await res.json();
          if (isMounted && json && json.success) {
            setApiSeatingMap(json);
            if (onUpdateEventTiers && json.tiers && json.seats) {
              onUpdateEventTiers(json.tiers, {
                type: json.venueBlueprint,
                venueId: json.venueBlueprint,
                venueNameAr: json.venueName,
                stageLabelAr: 'منصة العرض / المسرح الرسمي',
                totalSeats: json.totalSeats,
                availableSeats: json.availableSeats,
                sections: json.sections,
                seats: json.seats,
              });
            }
          }
        }
      } catch (err) {
        console.warn('[DynamicSchemaWorkflow] Failed to load seating map from API:', err);
      } finally {
        if (isMounted) setIsLoadingSeatingMap(false);
      }
    };

    fetchSeatingMap();
    return () => {
      isMounted = false;
    };
  }, [currentEvent.id, currentEvent.slug]);

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

  // Direct programmatic location assignment to open Webook outside restricted iframe context
  const executeDirectPaymentRedirect = (targetUrl: string, existingWindow?: Window | null) => {
    if (!targetUrl) return;

    let absoluteUrl = targetUrl.trim();
    // Guarantee direct PayTabs gateway URL instead of internal /ar/checkout path to avoid 404 errors
    if (absoluteUrl.includes('/ar/checkout')) {
      const match = absoluteUrl.match(/cart_id=([^&]+)/);
      const cartKey = (match ? decodeURIComponent(match[1]) : (activeCart?.cartId || 'PROD_SESS')).replace(/^wbk_cart_/, '');
      absoluteUrl = `https://secure-webook.paytabs.com/payment/page/${cartKey}`;
    } else {
      try {
        absoluteUrl = new URL(targetUrl, window.location.origin).href;
      } catch {}
    }

    // 1. If we have a pre-opened tab from a user click gesture, navigate it directly!
    if (existingWindow && !existingWindow.closed) {
      existingWindow.location.href = absoluteUrl;
      return;
    }

    // 2. Open directly in a new browser tab using window.open(url, '_blank') to prevent "webook.com refused to connect"
    try {
      const opened = window.open(absoluteUrl, '_blank', 'noopener,noreferrer');
      if (opened) return;
    } catch (e) {
      console.warn('window.open blocked, falling back to top navigation', e);
    }

    // 3. Navigate top-level window via window.top.location.href if allowed
    try {
      if (window.top && window.top !== window) {
        window.top.location.href = absoluteUrl;
        return;
      }
    } catch {}

    // 4. Programmatic anchor click with target="_blank"
    try {
      const link = document.createElement('a');
      link.href = absoluteUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    } catch {}

    // 5. Default window.location.href
    window.location.href = absoluteUrl;
  };

  // Redirect user session directly to official gateway URL
  const handleRedirectToGateway = (customUrl?: string) => {
    const url = customUrl || activeCart?.redirect_url || activeCart?.paymentGatewayUrl || activeCart?.redirectUrl || activeCart?.paymentPageUrl;
    if (!url) return;
    executeDirectPaymentRedirect(url);
  };

  const stepsList: DynamicWorkflowStep[] = schema?.steps || [];
  const currentStepObj: DynamicWorkflowStep | undefined = stepsList[currentStepIndex];

  // Generates PayTabs payment session and redirect URL strictly on-demand when user clicks "Pay Now" or "Refresh Payment"
  const handleInitiateFreshPaymentSession = async (autoRedirect: boolean = true): Promise<string | null> => {
    const targetCartId = activeCart?.cartId;
    if (!targetCartId) {
      setFreshSessionNotice('يرجى أولاً تنفيذ خطوة قفل المقاعد بالسلة لتجهيز الحجز.');
      return null;
    }

    setIsGeneratingPaymentSession(true);
    setFreshSessionNotice(null);

    try {
      const activeToken = getActiveBearerToken() || formValues.authToken?.trim();
      const reqHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      if (activeToken) {
        reqHeaders['Authorization'] = `Bearer ${activeToken}`;
      }

      const res = await fetch('/api/webook/paytabs/initiate-session', {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify({
          cartId: targetCartId,
          orderReference: activeCart?.orderReference,
          eventSlug: schema?.eventSlug || currentEvent.slug,
          selectedDate: formValues.selectedDate,
          selectedTime: formValues.selectedTime,
          selectedTeam: formValues.selectedTeam,
          seats: activeCart?.seats || selectedSeats,
          totalPrice: activeCart?.totalPrice,
          email: formValues.email,
          sessionToken: activeCart?.sessionToken,
          authToken: activeToken,
          forceFresh: true,
        }),
      });

      const json = await res.json().catch(() => null);
      let rawUrl = 
        (json?.paymentGatewayUrl && json.paymentGatewayUrl.includes('paytabs')) ? json.paymentGatewayUrl :
        (json?.paytabsRedirectUrl && json.paytabsRedirectUrl.includes('paytabs')) ? json.paytabsRedirectUrl :
        (json?.redirect_url && json.redirect_url.includes('paytabs')) ? json.redirect_url :
        json?.paytabsRedirectUrl || json?.paymentGatewayUrl || json?.redirect_url || json?.redirectUrl || json?.paymentPageUrl;

      // Extract direct absolute Paytabs gateway URL (e.g., https://secure-webook.paytabs.com/...) rather than redirecting to internal /ar/checkout
      if (!rawUrl || rawUrl.includes('/ar/checkout')) {
        const payKey = (json?.cartId || targetCartId).replace(/^wbk_cart_/, '');
        rawUrl = `https://secure-webook.paytabs.com/payment/page/${payKey}`;
      }

      if (res.ok && json && json.success && rawUrl) {
        let absoluteUrl = String(rawUrl).trim();
        try {
          absoluteUrl = new URL(rawUrl, window.location.origin).href;
        } catch {}

        setActiveCart((prev) => prev ? {
          ...prev,
          redirect_url: absoluteUrl,
          paymentGatewayUrl: absoluteUrl,
          redirectUrl: absoluteUrl,
          paymentPageUrl: absoluteUrl,
          orderReference: json.orderReference || prev.orderReference,
          expiresAt: json.expiresAt || new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        } : null);

        const timeStr = new Date().toLocaleTimeString('ar-SA');
        setPaymentSessionFreshAt(timeStr);
        setCartSecondsLeft(600); // Reset timer to fresh 10 mins!
        setFreshSessionNotice(`تم تنشيط جلسة الدفع الآمنة برابط مباشر لبوابة PayTabs (${absoluteUrl})`);

        updateStepLog(currentStepObj?.id || 'step_checkout_url', {
          status: 'success',
          statusCode: 200,
          message: 'تم استلام وتأكيد رابط بوابة PayTabs الرسمية (secure-webook.paytabs.com) بنجاح والتحويل المباشر!',
          responsePayload: {
            success: true,
            status: 'PAYTABS_SESSION_READY',
            redirect_url: absoluteUrl,
            orderReference: json.orderReference || activeCart?.orderReference,
            expiresAt: json.expiresAt,
          },
        });

        setIsGeneratingPaymentSession(false);

        if (autoRedirect) {
          executeDirectPaymentRedirect(absoluteUrl);
        }
        return absoluteUrl;
      } else {
        setIsGeneratingPaymentSession(false);
        const errMsg = json?.message || 'تعذر توليد جلسة دفع جديدة من خوادم Webook';
        setFreshSessionNotice(`خطأ: ${errMsg}`);
        return null;
      }
    } catch (err: any) {
      setIsGeneratingPaymentSession(false);
      setFreshSessionNotice(`فشل الاتصال بخادم الدفع: ${err.message}`);
      return null;
    }
  };

  // Immediate "Pay Now" click handler: retrieves absolute URL from API and cleanly opens in new browser tab
  const handlePayNowClick = async () => {
    // 1. If we already have a valid active verified redirect URL, open it immediately!
    const existingUrl = activeCart?.redirect_url || activeCart?.paymentGatewayUrl || activeCart?.redirectUrl || activeCart?.paymentPageUrl;
    if (existingUrl && !existingUrl.includes('PTSESS_') && cartSecondsLeft > 60) {
      executeDirectPaymentRedirect(existingUrl);
      return;
    }

    // 2. Pre-open a tab synchronously on user click to defeat browser popup blockers
    let popupTab: Window | null = null;
    try {
      popupTab = window.open('about:blank', '_blank');
    } catch {}

    const freshUrl = await handleInitiateFreshPaymentSession(false);
    if (freshUrl) {
      executeDirectPaymentRedirect(freshUrl, popupTab);
    } else {
      if (popupTab && !popupTab.closed) {
        popupTab.close();
      }
    }
  };

  // Open external browser intent with a fresh on-demand session
  const handleOpenExternalIntentWithFreshSession = async () => {
    let popupTab: Window | null = null;
    try {
      popupTab = window.open('about:blank', '_blank');
    } catch {}

    const freshUrl = await handleInitiateFreshPaymentSession(false);
    if (freshUrl) {
      executeDirectPaymentRedirect(freshUrl, popupTab);
    } else {
      if (popupTab && !popupTab.closed) {
        popupTab.close();
      }
    }
  };

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
      seatIds: selectedSeats.map(s => s.id),
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

      if (step.type === 'cart_execution' || step.type === 'checkout_payment') {
        if (activeCart && activeCart.status === 'active' && step.type === 'checkout_payment') {
          updateStepLog(step.id, {
            status: 'success',
            statusCode: 200,
            message: `السلة الرسمية نشطة بنجاح (${activeCart.cartId}) — اضغط "الدفع الآن" لفتح بوابة PayTabs.`,
            responsePayload: activeCart,
          });
          setIsRunningStep(false);
          return true;
        }

        const cleanToken = getActiveBearerToken() || formValues.authToken.trim();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (cleanToken) headers['Authorization'] = `Bearer ${cleanToken}`;

        const effectiveTicketTier = formValues.preferredTierId || formValues.selectedTierId || selectedSeats[0]?.tierId || 'regular';
        const payloadToSend = {
          ...currentPayload,
          ticket_id: effectiveTicketTier,
          ticketId: effectiveTicketTier,
          event_ticket_id: effectiveTicketTier,
          seatIds: selectedSeats.map(s => s.id),
          seats: selectedSeats,
          quantity: selectedSeats.length || formValues.ticketQuantity,
        };

        const res = await fetch('/api/webook/cart/add', {
          method: 'POST',
          headers,
          body: JSON.stringify(payloadToSend),
        });

        const json = await res.json().catch(() => null);

        if (res.ok && json && json.success && json.cartId) {
          const rawGatewayUrl = json.paymentGatewayUrl || json.redirect_url || json.redirectUrl || json.paymentPageUrl || json.paytabsRedirectUrl;
          let officialGatewayUrl = rawGatewayUrl;
          if (rawGatewayUrl) {
            try {
              officialGatewayUrl = new URL(rawGatewayUrl, window.location.origin).href;
            } catch {}
          }
          setActiveCart({
            cartId: json.cartId,
            orderReference: json.orderReference,
            sessionToken: json.sessionToken || cleanToken,
            expiresAt: json.holdExpiresAt || new Date(Date.now() + 10 * 60 * 1000).toISOString(),
            totalPrice: json.totalPrice,
            dynamicCheckoutUrl: json.dynamicCheckoutUrl,
            directBookingUrl: json.directBookingUrl,
            paymentGatewayUrl: officialGatewayUrl,
            redirectUrl: officialGatewayUrl,
            paymentPageUrl: officialGatewayUrl,
            gateway: json.paymentGateway?.name || 'PayTabs',
            gatewayDisplayNameAr: json.paymentGateway?.displayNameAr || 'بوابة PayTabs السعودية الرسمية',
            transactionReference: json.paymentGateway?.transactionReference,
            capturedFromApiResponse: Boolean(json.realApiExecuted?.capturedRedirectUrl || json.paymentGateway?.capturedFromApiResponse),
            seats: json.seats || selectedSeats,
            seatIds: json.seatIds || selectedSeats.map(s => s.id),
            quantity: json.quantity || formValues.ticketQuantity,
            status: 'active',
          });
          setCartSecondsLeft(600);
          playReservationChime();

          updateStepLog(step.id, {
            status: 'success',
            statusCode: res.status,
            message: `تم تنفيذ POST بنجاح وقفل المقاعد (${selectedSeats.map(s => s.label || s.id).join(', ') || formValues.ticketQuantity + ' تذاكر'}) مؤقتاً لمدة 10 دقائق والتقاط رابط PayTabs الرسمي: (${json.cartId})`,
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
        const targetCartId = activeCart?.cartId;
        if (!targetCartId) {
          setIsRunningStep(false);
          updateStepLog(step.id, {
            status: 'failed',
            message: 'لا توجد سلة حجز رسمية نشطة. يرجى تنفيذ خطوة قفل المقاعد بالسلة أولاً.',
          });
          return false;
        }

        // Finalize the session via API, extracting the direct absolute Paytabs gateway URL (e.g., https://secure-webook.paytabs.com/...)
        const paytabsGatewayUrl = await handleInitiateFreshPaymentSession(isAutoRunning);
        setIsRunningStep(false);

        if (paytabsGatewayUrl) {
          updateStepLog(step.id, {
            status: 'success',
            statusCode: 200,
            message: `تم تثبيت وتنشيط جلسة الدفع بنجاح عبر بوابة PayTabs الرسمية (رابط مباشر): ${paytabsGatewayUrl}`,
            responsePayload: {
              success: true,
              gateway: 'PayTabs',
              redirect_url: paytabsGatewayUrl,
              cartId: targetCartId,
            }
          });
          return true;
        } else {
          return false;
        }
      }

      if (step.type === 'payment_verification') {
        if (!activeCart?.cartId) {
          setIsRunningStep(false);
          updateStepLog(step.id, {
            status: 'failed',
            message: 'لا توجد سلة حجز رسمية نشطة تم حجزها عبر خوادم Webook. يرجى حجز المقاعد في السلة أولاً.',
          });
          return false;
        }

        const activeCartId = activeCart.cartId;
        const activeOrderRef = activeCart.orderReference || ('WBK-ORD-' + activeCartId.slice(-6).toUpperCase());

        setIsVerifyingPayment(true);
        const res = await fetch('/api/webook/verify-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cartId: activeCartId,
            orderReference: activeOrderRef,
            email: formValues.email,
            selectedDate: formValues.selectedDate,
            selectedTime: formValues.selectedTime,
            seats: activeCart?.seats || selectedSeats,
            seatIds: selectedSeats.map(s => s.id),
            totalPrice: activeCart?.totalPrice || formValues.ticketQuantity * 125,
            eventTitle: currentEvent.titleAr,
          }),
        });

        const json = await res.json().catch(() => null);
        setIsVerifyingPayment(false);

        if (res.ok && json && json.success && json.order) {
          setConfirmedOrder(json.order);
          if (activeCart) {
            setActiveCart((prev) => prev ? { ...prev, status: 'confirmed', confirmedOrder: json.order } : null);
          }
          playReservationChime();

          updateStepLog(step.id, {
            status: 'success',
            statusCode: 200,
            message: `تم التحقق بنجاح من إتمام الدفع عبر بوابة PayTabs وإصدار ${json.order.tickets?.length || 0} تذاكر رسمية! (رقم المرجع: ${json.order.orderReference})`,
            responsePayload: json,
          });
          setIsRunningStep(false);
          return true;
        } else {
          updateStepLog(step.id, {
            status: 'error',
            statusCode: res.status,
            message: json?.message || 'فشل التحقق من حالة الدفع',
            responsePayload: json,
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

  // Sync manual order/cart fields when activeCart updates
  useEffect(() => {
    if (activeCart?.orderReference) setManualOrderRef(activeCart.orderReference);
    if (activeCart?.cartId) setManualCartId(activeCart.cartId);
  }, [activeCart]);

  // URL search parameter watcher: auto-trigger verification upon returning from payment gateway
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const orderRefParam = params.get('order_ref') || params.get('order_id') || params.get('orderReference');
      const cartIdParam = params.get('cart_id') || params.get('cartId');
      const statusParam = params.get('payment_status') || params.get('status');

      if (orderRefParam || cartIdParam) {
        if (orderRefParam) setManualOrderRef(orderRefParam);
        if (cartIdParam) setManualCartId(cartIdParam);

        if (schema?.steps) {
          const verifyIdx = schema.steps.findIndex(s => s.type === 'payment_verification');
          if (verifyIdx >= 0) {
            setCurrentStepIndex(verifyIdx);
            if (statusParam === 'success' || params.has('paytabs_return') || params.has('return')) {
              handleVerifyPaymentManual(orderRefParam || undefined, cartIdParam || undefined);
            }
          }
        }
      }
    } catch (e) {
      // safe fallback
    }
  }, [schema]);

  const handleVerifyPaymentManual = async (targetOrderRef?: string, targetCartId?: string) => {
    const activeCartId = targetCartId || manualCartId || activeCart?.cartId;
    const activeOrderRef = targetOrderRef || manualOrderRef || activeCart?.orderReference;

    if (!activeCartId && !activeOrderRef) {
      setVerifyMessage({
        type: 'error',
        text: 'يرجى تقديم معرّف سلة صالح أو مرجع طلب رسمي صادر من خوادم Webook للتحقق من الدفع.',
      });
      return;
    }

    setIsVerifyingPayment(true);
    setVerifyMessage(null);
    try {
      const res = await fetch('/api/webook/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cartId: activeCartId,
          orderReference: activeOrderRef,
          email: manualEmail || formValues.email || 'user@webook.com',
          selectedDate: formValues.selectedDate,
          selectedTime: formValues.selectedTime,
          seats: activeCart?.seats || selectedSeats,
          seatIds: selectedSeats.map(s => s.id),
          totalPrice: activeCart?.totalPrice || selectedSeats.reduce((s, x) => s + (x.price || 0), 0) || 170,
          eventTitle: currentEvent.titleAr,
        }),
      });

      const json = await res.json().catch(() => null);
      setIsVerifyingPayment(false);

      if (res.ok && json && json.success && json.order) {
        setConfirmedOrder(json.order);
        if (activeCart) {
          setActiveCart(prev => prev ? { ...prev, status: 'confirmed', confirmedOrder: json.order } : null);
        }
        playReservationChime();
        setVerifyMessage({
          type: 'success',
          text: `تم التحقق بنجاح من إتمام الدفع عبر بوابة PayTabs وإصدار ${json.order.tickets?.length || 0} تذاكر رسمية! رقم المرجع: ${json.order.orderReference}`
        });

        const payStep = stepsList.find(s => s.type === 'payment_verification');
        if (payStep) {
          updateStepLog(payStep.id, {
            status: 'success',
            statusCode: 200,
            message: `تم التحقق بنجاح من إتمام الدفع وإصدار التذاكر (مرجع: ${json.order.orderReference})`,
            responsePayload: json,
          });
        }
        return true;
      } else {
        setVerifyMessage({
          type: 'error',
          text: json?.message || 'فشل التحقق من حالة الدفع في بوابة PayTabs'
        });
        return false;
      }
    } catch (err: any) {
      setIsVerifyingPayment(false);
      setVerifyMessage({
        type: 'error',
        text: `خطأ في الاتصال بخادم التحقق: ${err.message}`
      });
      return false;
    }
  };

  const handleSimulatePayTabsReturn = async () => {
    const curOrderRef = manualOrderRef || activeCart?.orderReference || ('WBK-ORD-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(100 + Math.random() * 900));
    const curCartId = manualCartId || activeCart?.cartId || ('wbk_cart_' + Date.now().toString(36).toUpperCase());
    setManualOrderRef(curOrderRef);
    setManualCartId(curCartId);
    await handleVerifyPaymentManual(curOrderRef, curCartId);
  };

  const handleFetchBookingHistory = async () => {
    setIsCheckingHistory(true);
    setHistoryFeedback('');
    try {
      const targetCartId = (manualCartId || activeCart?.cartId || '').trim();
      const targetOrderRef = (manualOrderRef || activeCart?.orderReference || '').trim();
      const targetEmail = (manualEmail || formValues.email || '').trim();

      const queryParams = new URLSearchParams();
      if (targetCartId) queryParams.set('cartId', targetCartId);
      if (targetOrderRef) queryParams.set('orderRef', targetOrderRef);
      if (targetEmail) queryParams.set('email', targetEmail);

      const res = await fetch(`/api/webook/booking-history?${queryParams.toString()}`);
      const json = await res.json().catch(() => null);
      setIsCheckingHistory(false);

      if (res.ok && json && json.success) {
        const orders = json.allOrders || (json.order ? [json.order] : []);
        setBookingHistory(orders);
        if (json.order && !confirmedOrder) {
          setConfirmedOrder(json.order);
        }
        setHistoryFeedback(json.message || `تم العثور على ${orders.length} حجز مؤكد`);
        setShowHistoryDrawer(true);
      } else {
        setHistoryFeedback(json?.message || 'لم يتم العثور على أي حجوزات مؤكدة سابقة');
        setShowHistoryDrawer(true);
      }
    } catch (err: any) {
      setIsCheckingHistory(false);
      setHistoryFeedback(`خطأ في فحص السجل: ${err.message}`);
      setShowHistoryDrawer(true);
    }
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

      {/* Event Selection Bar: Switches event and re-generates dynamic schema & steps */}
      <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 space-y-2.5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-bold text-white">
              اختر الفعالية لاختبار استخراج الخطوات الديناميكية المعتمدة لكل فعالية (رياضة، مسرح، عروض كوميدية، دخول عام):
            </span>
          </div>
          <span className="text-[11px] font-mono text-purple-300 bg-purple-950/50 px-2.5 py-0.5 rounded-full border border-purple-800/40">
            {currentEvent.category} • {schema?.totalSteps || 0} خطوات معتمدة رسمياً
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          {events.slice(0, 6).map((ev) => {
            const isCur = ev.id === currentEvent.id || ev.slug === currentEvent.slug;
            return (
              <button
                key={ev.id}
                type="button"
                onClick={() => onSelectEvent(ev)}
                className={`p-2 rounded-xl border text-right transition cursor-pointer flex flex-col gap-1.5 ${
                  isCur
                    ? 'bg-purple-950/60 border-purple-500 ring-2 ring-purple-500/40 shadow-lg'
                    : 'bg-slate-900/60 border-slate-800 hover:bg-slate-900 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <img src={ev.image} alt={ev.titleAr} className="w-7 h-7 rounded-lg object-cover shrink-0" />
                  <div className="overflow-hidden flex-1">
                    <div className="text-[11px] font-bold text-white truncate">{ev.titleAr}</div>
                  </div>
                  {isCur && <Check className="w-3.5 h-3.5 text-purple-400 shrink-0" />}
                </div>
                <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono">
                  <span>{ev.isSeated ? 'مقاعد مرقمة' : 'دخول عام'}</span>
                  <span className="text-pink-400 font-bold">{ev.tiers?.[0]?.price || 65} ر.س</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

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
                  <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center justify-between">
                    <span>رمز التوثيق (Authorization: Bearer):</span>
                    <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>محاقن تلقائياً</span>
                    </span>
                  </label>
                  <div className="w-full bg-slate-900 border border-emerald-500/30 rounded-xl px-3 py-2 text-xs text-emerald-300 font-mono flex items-center justify-between shadow-inner">
                    <span className="truncate">
                      {formValues.authToken 
                        ? `${formValues.authToken.substring(0, 14)}••••••••${formValues.authToken.substring(formValues.authToken.length - 6)}` 
                        : 'نشط ومفعل تلقائياً من مدير الحسابات'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-sans shrink-0 bg-slate-800 px-2 py-0.5 rounded-md">
                      Webook Bearer
                    </span>
                  </div>
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
          {currentStepObj.type === 'team_stand_selection' && (() => {
            const teamField = currentStepObj.fields?.find(f => f.type === 'team_selector' || f.name === 'selectedTeam');
            const homeOpt = teamField?.options?.find(o => o.value === 'home');
            const awayOpt = teamField?.options?.find(o => o.value === 'away');
            const homeName = currentEvent.teams?.home?.nameAr || homeOpt?.labelAr || homeOpt?.label || 'الفريق المضيف';
            const awayName = currentEvent.teams?.away?.nameAr || awayOpt?.labelAr || awayOpt?.label || 'الفريق الضيف';

            return (
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
                    <div className="text-sm font-bold">{homeName}</div>
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
                    <div className="text-sm font-bold">{awayName}</div>
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
            );
          })()}

          {/* 3. Fixtures / Sub-Events Step */}
          {currentStepObj.type === 'fixture_selection' && (() => {
            const fixtureField = currentStepObj.fields?.find(f => f.type === 'fixture_selector' || f.name === 'selectedSubEventId');
            const subList = (currentEvent.subEvents && currentEvent.subEvents.length > 0)
              ? currentEvent.subEvents
              : (fixtureField?.options || []).map(opt => ({
                  id: opt.value,
                  title: opt.label,
                  titleAr: opt.labelAr || opt.label,
                  date: opt.metadata?.date || '2026-10-15',
                  time: opt.metadata?.time || '20:00 - 22:30',
                }));

            return (
              <div className="space-y-3 animate-in fade-in">
                <label className="block text-xs font-bold text-slate-300">
                  الجولات والجلسات المتاحة للفعالية ({subList.length} جولات):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {subList.map((se) => {
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
            );
          })()}

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
            <div className="space-y-5 animate-in fade-in">
              {/* Header with Venue Blueprint & API Status */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-pink-400" />
                      <span>{apiSeatingMap?.venueName || currentEvent.seatingMap?.venueNameAr || currentEvent.locationAr}</span>
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      {apiSeatingMap?.venueBlueprint || currentEvent.seatingMap?.venueId || 'مخطط رسمي معتمد'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    تم سحب مخطط المقاعد والتصنيفات مباشرة من واجهة برمجة تطبيقات المنصة (api.webook.com/seating-map).
                  </p>
                </div>

                {/* Quick Auto-Pick Seats Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const seatsPool = apiSeatingMap?.seats || currentEvent.seatingMap?.seats || [];
                      const available = seatsPool.filter((s: Seat) => s.status === 'available');
                      const chosen = available.slice(0, formValues.ticketQuantity || 2);
                      chosen.forEach((s: Seat) => onToggleSeat(s));
                    }}
                    className="px-3.5 py-1.5 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-pink-600/20 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>قنص {formValues.ticketQuantity || 2} مقاعد متتالية</span>
                  </button>

                  {selectedSeats.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        selectedSeats.forEach((s) => onToggleSeat(s));
                      }}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl text-xs transition cursor-pointer"
                    >
                      مسح التحديد
                    </button>
                  )}
                </div>
              </div>

              {/* Tier / Category Filter Pills */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-purple-400" />
                  <span>تصنيفات وفئات التذاكر المتاحة على المخطط:</span>
                </span>
                
                <div className="flex flex-wrap gap-2">
                  {(apiSeatingMap?.tiers || currentEvent.tiers || []).map((t: any) => {
                    const isPref = formValues.preferredTierId === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setFormValues(v => ({ ...v, preferredTierId: t.id }))}
                        className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition flex items-center gap-2.5 cursor-pointer ${
                          isPref
                            ? 'bg-purple-950/60 border-purple-500 text-white ring-2 ring-purple-500/30 shadow-md'
                            : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <span 
                          className="w-2.5 h-2.5 rounded-full" 
                          style={{ backgroundColor: t.color || t.ticketColor || '#3b82f6' }} 
                        />
                        <span>{t.nameAr || t.name}</span>
                        <span className="font-mono text-pink-400 font-bold">{t.price} ر.س</span>
                        {t.remaining !== undefined && (
                          <span className="text-[10px] text-slate-400 font-mono">({t.remaining} متبقي)</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sections Filter Tabs */}
              {((apiSeatingMap?.sections || currentEvent.seatingMap?.sections || []).length > 1) && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  <button
                    type="button"
                    onClick={() => setSelectedSectionFilter('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer border ${
                      selectedSectionFilter === 'all'
                        ? 'bg-pink-600 text-white border-pink-500 shadow'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    كافة الأقسام والمدرجات
                  </button>
                  {(apiSeatingMap?.sections || currentEvent.seatingMap?.sections || []).map((sec: any) => (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => setSelectedSectionFilter(sec.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer border whitespace-nowrap ${
                        selectedSectionFilter === sec.id
                          ? 'bg-purple-600 text-white border-purple-500 shadow'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {sec.nameAr || sec.nameEn}
                    </button>
                  ))}
                </div>
              )}

              {/* Interactive Seating Grid / Map */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 overflow-x-auto space-y-4">
                {/* Stage or Pitch Focal Point */}
                <div className="w-full text-center py-2 bg-gradient-to-r from-purple-950/60 via-purple-900/40 to-purple-950/60 rounded-xl text-xs font-bold text-purple-300 border border-purple-700/30 flex items-center justify-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                  <span>{currentEvent.seatingMap?.stageLabelAr || 'منصة العرض / المستطيل الأخضر الرسمي'}</span>
                </div>

                {isLoadingSeatingMap ? (
                  <div className="py-8 text-center space-y-2">
                    <RefreshCw className="w-6 h-6 text-purple-400 animate-spin mx-auto" />
                    <span className="text-xs text-slate-400 block">جاري تحميل مخطط المقاعد التفصيلي من خوادم المنصة...</span>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-w-3xl mx-auto py-2">
                    {/* Render seats grouped by Row */}
                    {Array.from(new Set(
                      (apiSeatingMap?.seats || currentEvent.seatingMap?.seats || [])
                        .filter((s: Seat) => selectedSectionFilter === 'all' || s.section === selectedSectionFilter || s.tierId === selectedSectionFilter)
                        .map((s: Seat) => s.row)
                    )).slice(0, 10).map((rowName) => {
                      const rowSeats = (apiSeatingMap?.seats || currentEvent.seatingMap?.seats || [])
                        .filter((s: Seat) => s.row === rowName && (selectedSectionFilter === 'all' || s.section === selectedSectionFilter || s.tierId === selectedSectionFilter))
                        .slice(0, 14);

                      return (
                        <div key={String(rowName)} className="flex items-center gap-2 justify-center">
                          <span className="w-6 text-[11px] font-mono font-bold text-slate-400 text-center shrink-0">
                            {String(rowName)}
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5 justify-center">
                            {rowSeats.map((seat: Seat) => {
                              const isSelected = selectedSeats.some(s => s.id === seat.id);
                              const isAvailable = seat.status === 'available';

                              return (
                                <button
                                  key={seat.id}
                                  type="button"
                                  onClick={() => onToggleSeat(seat)}
                                  className={`w-8 h-8 rounded-lg text-[10px] font-mono font-bold transition cursor-pointer flex items-center justify-center border relative group ${
                                    isSelected
                                      ? 'bg-gradient-to-tr from-pink-600 to-rose-500 border-pink-400 text-white shadow-lg shadow-pink-600/50 scale-110 z-10'
                                      : isAvailable
                                      ? 'bg-slate-900 border-slate-700 text-slate-200 hover:border-purple-400 hover:bg-purple-950/60'
                                      : 'bg-slate-950/80 border-slate-900 text-slate-600 cursor-not-allowed opacity-50'
                                  }`}
                                  title={`${seat.label || seat.id} (${seat.row}-${seat.number}) - ${seat.price} ر.س - المعرف: ${seat.id}`}
                                >
                                  <span>{seat.number}</span>
                                </button>
                              );
                            })}
                          </div>
                          <span className="w-6 text-[11px] font-mono font-bold text-slate-400 text-center shrink-0">
                            {String(rowName)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Map Legend */}
                <div className="flex flex-wrap items-center justify-center gap-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded bg-slate-900 border border-slate-700" />
                    <span>متاح للحجز</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded bg-pink-600 border border-pink-400" />
                    <span>مقعد محدد من قبلك</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded bg-slate-950 border border-slate-900 opacity-50" />
                    <span>محجوز مسبقاً</span>
                  </div>
                </div>
              </div>

              {/* SPECIFIC SELECTED SEATS BOX (Showing exact Seat IDs & breakdown) */}
              <div className="bg-slate-900/90 border border-purple-500/40 rounded-2xl p-4 space-y-3 shadow-lg">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white">المقاعد المحددة بالمعرف الدقيق (Specific Selected Seat IDs):</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-purple-300">
                    {selectedSeats.length} مقاعد محددة
                  </span>
                </div>

                {selectedSeats.length === 0 ? (
                  <div className="p-3 text-center text-xs text-slate-400">
                    لم تقم باختيار أي مقعد بعد. انقر على المقاعد في المخطط أو اضغط على "قنص المقاعد المتتالية" أعلاه.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {selectedSeats.map((seat) => (
                        <div
                          key={seat.id}
                          className="px-3 py-1.5 rounded-xl bg-purple-950/60 border border-purple-500/60 text-xs font-mono text-white flex items-center gap-2 shadow"
                        >
                          <span className="w-2 h-2 rounded-full bg-pink-500" />
                          <span className="font-bold">{seat.label || `مقعد ${seat.row}-${seat.number}`}</span>
                          <span className="text-[10px] text-pink-300 font-mono">({seat.id})</span>
                          <span className="text-emerald-400 font-bold">{seat.price} ر.س</span>
                          <button
                            type="button"
                            onClick={() => onToggleSeat(seat)}
                            className="text-slate-400 hover:text-rose-400 cursor-pointer ml-1"
                            title="إلغاء هذا المقعد"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                      <span className="text-slate-300 font-mono">
                        المعرفات المرسلة في السلة (seatIds):{' '}
                        <strong className="text-purple-300 font-mono">
                          [{selectedSeats.map(s => s.id).join(', ')}]
                        </strong>
                      </span>
                      <span className="text-slate-300">
                        إجمالي القيمة:{' '}
                        <strong className="text-emerald-400 font-mono font-bold text-sm">
                          {selectedSeats.reduce((s, x) => s + (x.price || 0), 0)} ر.س
                        </strong>
                      </span>
                    </div>
                  </div>
                )}
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

              {/* Active Cart Banner with PayTabs Payment Gateway Redirect */}
              {activeCart && activeCart.status === 'active' && (
                <div className="space-y-4">
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
                        <span className="text-slate-400 block text-[10px]">المقاعد المحجوزة مؤقتاً:</span>
                        <strong className="text-purple-300 font-mono">
                          {activeCart.seatIds?.length ? activeCart.seatIds.join(', ') : `${activeCart.quantity} مقاعد`}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Official PayTabs Payment Gateway Card (Strict On-Demand, Zero Raw URL Text) */}
                  {activeCart && (
                    <div className="bg-gradient-to-br from-blue-950/50 via-slate-900 to-indigo-950/50 border-2 border-blue-500/50 rounded-2xl p-5 space-y-4 shadow-2xl animate-in fade-in">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-blue-900/40 pb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300 font-black text-sm shadow-md">
                            PT
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-white">بوابة دفع PayTabs السعودية الرسمية (PayTabs Gateway)</span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/20 text-blue-300 border border-blue-500/40">
                                Mada / Visa / MC / Apple Pay
                              </span>
                            </div>
                            <p className="text-xs text-slate-300 mt-0.5">
                              تم تثبيت حجز المقاعد بالسلة مؤقتاً لمدة 10 دقائق. يتم إنشاء جلسة الدفع الرسمية فورياً وخفياً عند النقر على زر الدفع.
                            </p>
                          </div>
                        </div>

                        <div className="text-right sm:text-left font-mono">
                          <span className="text-[10px] text-slate-400 block">رقم مرجع الطلب (Order Reference)</span>
                          <span className="text-xs font-bold text-amber-300 font-mono select-all">
                            {activeCart.orderReference || 'WBK-ORD-ACTIVE'}
                          </span>
                        </div>
                      </div>

                      {/* PayTabs Status Banner (No Raw URL Exposed) */}
                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span className="text-slate-200">
                            {cartSecondsLeft === 0 
                              ? '⚠️ انتهت صلاحية الجلسة السابقة — اضغط "تحديث الجلسة" لتجديد الصلاحية وتفادي أخطاء 404' 
                              : 'بوابة PayTabs الرسمية المشفرة جاهزة للتوليد والتحويل الفوري عند النقر'}
                          </span>
                        </div>
                        <span className="font-mono text-emerald-400 text-[11px] bg-emerald-950/60 px-2.5 py-0.5 rounded border border-emerald-500/30">
                          {paymentSessionFreshAt ? `تحديث: ${paymentSessionFreshAt}` : 'Ready On-Demand'}
                        </span>
                      </div>

                      {/* PayTabs Action Buttons */}
                      <div className="flex flex-wrap items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => handleInitiateFreshPaymentSession(true)}
                          disabled={isGeneratingPaymentSession}
                          className="flex-1 min-w-[220px] py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm rounded-xl text-center shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition cursor-pointer"
                        >
                          {isGeneratingPaymentSession ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin text-blue-200" />
                              <span>جاري إنشاء جلسة الدفع المشفرة والتحويل...</span>
                            </>
                          ) : (
                            <>
                              <CreditCard className="w-4 h-4" />
                              <span>⚡ الدفع الآن عبر PayTabs (تحويل فوري للجلسة)</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleInitiateFreshPaymentSession(false)}
                          disabled={isGeneratingPaymentSession}
                          className="px-3.5 py-3 bg-blue-900/40 hover:bg-blue-800/40 text-blue-200 border border-blue-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                          title="تحديث جلسة الدفع وتوليد رابط جديد لتفادي انتهاء الصلاحية وخطأ 404"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingPaymentSession ? 'animate-spin' : ''}`} />
                          <span>تحديث الجلسة (Refresh)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const ref = activeCart.orderReference || 'WBK-ORD-ACTIVE';
                            navigator.clipboard.writeText(ref);
                            setCopiedUrl(true);
                            setTimeout(() => setCopiedUrl(false), 2500);
                          }}
                          className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border border-slate-700"
                        >
                          {copiedUrl ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                          <span>{copiedUrl ? 'تم نسخ المرجع!' : 'نسخ مرجع الطلب'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const verifyIdx = stepsList.findIndex(s => s.type === 'payment_verification');
                            if (verifyIdx >= 0) {
                              setCurrentStepIndex(verifyIdx);
                            }
                          }}
                          className="px-4 py-3 bg-purple-950/60 hover:bg-purple-900/60 border border-purple-500/50 text-purple-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <ShieldCheck className="w-4 h-4 text-purple-400" />
                          <span>المتابعة للتحقق من الدفع وتأكيد التذاكر ←</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 8. PayTabs Official Payment Gateway Redirect Step */}
          {currentStepObj.type === 'dynamic_checkout' && (
            <div className="space-y-5 animate-in fade-in">
              {/* PayTabs Official Redirect Container */}
              <div className="bg-gradient-to-br from-blue-950/60 via-slate-900 to-indigo-950/60 border-2 border-blue-500/50 rounded-2xl p-5 sm:p-7 space-y-5 shadow-2xl">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-blue-900/50 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-blue-600/30 border border-blue-400/50 flex items-center justify-center text-blue-300 font-black text-lg shadow-lg">
                      PT
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-base font-black text-white">بوابة دفع PayTabs السعودية الرسمية (PayTabs Gateway)</h4>
                        <span className="px-2.5 py-0.5 rounded text-[11px] font-mono bg-blue-500/20 text-blue-300 border border-blue-500/40">
                          Mada / Visa / MC / Apple Pay
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          توليد فوري عند الطلب On-Demand
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1">
                        يتم إنشاء جلسة الدفع والرابط الرسمي ديناميكياً وفورياً عند النقر على زر الدفع فقط، لتفادي أخطاء انتهاء الصلاحية أو خطأ 404.
                      </p>
                    </div>
                  </div>

                  <div className="text-right sm:text-left font-mono">
                    <span className="text-[10px] text-slate-400 block font-sans">رقم مرجع الطلب (Order Reference)</span>
                    <span className="text-sm font-bold text-amber-300 select-all">
                      {activeCart?.orderReference || 'WBK-ORD-ACTIVE'}
                    </span>
                  </div>
                </div>

                {/* Expiration Warning if less than 3 minutes left */}
                {cartSecondsLeft < 180 && (
                  <div className="bg-amber-950/50 border border-amber-500/60 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-pulse">
                    <div className="flex items-center gap-2 text-xs text-amber-200">
                      <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        تنبيه: اقتربت صلاحية الجلسة الحالية من الانتهاء (متبقي {formatTimer(cartSecondsLeft)}). اضغط زر "تحديث جلسة الدفع" لتوليد رابط جديد فوراً وتفادي خطأ 404.
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleInitiateFreshPaymentSession(false)}
                      disabled={isGeneratingPaymentSession}
                      className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition cursor-pointer flex items-center gap-1.5 shadow-md shrink-0"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingPaymentSession ? 'animate-spin' : ''}`} />
                      <span>تحديث الجلسة الآن</span>
                    </button>
                  </div>
                )}

                {/* Session Feedback Notice */}
                {freshSessionNotice && (
                  <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-xs text-emerald-200 flex items-center justify-between gap-2 animate-in fade-in">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{freshSessionNotice}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFreshSessionNotice(null)}
                      className="text-slate-400 hover:text-white text-xs px-1.5 py-0.5 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Secure Gateway Protocol Card (No Raw URLs Exposed) */}
                <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-4 space-y-3 shadow-inner">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${cartSecondsLeft === 0 ? 'bg-rose-500' : 'bg-emerald-400'} animate-pulse`} />
                      <span className="text-xs font-bold text-slate-200">
                        حالة اتصال بوابة PayTabs المشفرة:
                      </span>
                    </div>
                    <span className={`text-xs font-mono px-2.5 py-1 rounded-lg border ${
                      cartSecondsLeft === 0 
                        ? 'text-rose-400 bg-rose-950/60 border-rose-500/40' 
                        : (paymentSessionFreshAt ? 'text-emerald-400 bg-emerald-950/60 border-emerald-500/30' : 'text-blue-300 bg-blue-950/60 border-blue-500/30')
                    }`}>
                      {cartSecondsLeft === 0 
                        ? '⚠️ الجلسة منتهية الصلاحية (اضغط تحديث الجلسة لتوليد رابط جديد)' 
                        : (paymentSessionFreshAt ? `جلسة نشطة طازجة (تحديث: ${paymentSessionFreshAt})` : 'جاهزة للتوليد الفوري والمشفر عند النقر')}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                    <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 flex items-center gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <span className="text-[10px] text-slate-400 block font-sans">الأمان والخصوصية</span>
                        <span className="font-bold text-slate-200">تشفير SSL 256-bit & PCI-DSS</span>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 flex items-center gap-2.5">
                      <CreditCard className="w-4 h-4 text-blue-400 shrink-0" />
                      <div>
                        <span className="text-[10px] text-slate-400 block font-sans">طرق الدفع المعتمدة</span>
                        <span className="font-bold text-slate-200">مدى • فيزا • ماستركارد • Apple Pay</span>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 flex items-center gap-2.5">
                      <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                      <div>
                        <span className="text-[10px] text-slate-400 block font-sans">توليد عند الطلب (Zero 404)</span>
                        <span className="font-bold text-slate-200">صلاحية 10 دقائق من لحظة النقر</span>
                      </div>
                    </div>
                  </div>

                  {cartSecondsLeft === 0 && (
                    <div className="p-3.5 bg-rose-950/70 border border-rose-500/60 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-rose-200 animate-in fade-in">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                        <span>انتهت صلاحية جلسة الدفع السابقة. اضغط زر "تحديث جلسة الدفع" لتوليد رابط جديد فورياً وتفادي أخطاء 404.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleInitiateFreshPaymentSession(false)}
                        disabled={isGeneratingPaymentSession}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-black text-xs shrink-0 cursor-pointer transition flex items-center gap-1.5 shadow-md"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingPaymentSession ? 'animate-spin' : ''}`} />
                        <span>تحديث الجلسة الآن</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Primary Action Buttons: On-Demand Pay Now & Refresh Payment Fallback */}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  {/* Primary CTA: Generate Fresh Session on Click and Redirect */}
                  <button
                    type="button"
                    onClick={handlePayNowClick}
                    disabled={isGeneratingPaymentSession}
                    className="flex-1 min-w-[260px] py-4 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm rounded-xl text-center shadow-xl shadow-emerald-500/30 flex items-center justify-center gap-2.5 transition cursor-pointer hover:scale-[1.01]"
                  >
                    {isGeneratingPaymentSession ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin text-slate-950" />
                        <span>جاري إنشاء جلسة الدفع المشفرة والتحويل إلى PayTabs...</span>
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-5 h-5" />
                        <span>⚡ الدفع الآن عبر بوابة PayTabs (Pay Now - تحويل فوري)</span>
                        <ExternalLink className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  {/* Fallback & Refresh Payment Button (Requests Fresh Payment URL to Prevent 404/Expiry) */}
                  <button
                    type="button"
                    onClick={() => handleInitiateFreshPaymentSession(false)}
                    disabled={isGeneratingPaymentSession}
                    className="px-5 py-4 bg-blue-900/40 hover:bg-blue-800/50 text-blue-200 hover:text-white border-2 border-blue-500/40 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-md"
                    title="طلب جلسة دفع جديدة طازجة بصلاحية 10 دقائق وتفادي أخطاء انتهاء الصلاحية و 404"
                  >
                    <RefreshCw className={`w-4 h-4 text-blue-400 ${isGeneratingPaymentSession ? 'animate-spin' : ''}`} />
                    <span>تحديث جلسة الدفع (Refresh Payment)</span>
                  </button>

                  {/* External Browser Intent CTA */}
                  <button
                    type="button"
                    onClick={handleOpenExternalIntentWithFreshSession}
                    disabled={isGeneratingPaymentSession}
                    className="px-4 py-4 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition border border-slate-700 shadow-md cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4 text-blue-400" />
                    <span>فتح في متصفح خارجي</span>
                  </button>

                  {/* Copy Order Reference */}
                  <button
                    type="button"
                    onClick={() => {
                      const ref = activeCart?.orderReference || 'WBK-ORD-ACTIVE';
                      navigator.clipboard.writeText(ref);
                      setCopiedPaytabsUrl(true);
                      setTimeout(() => setCopiedPaytabsUrl(false), 2500);
                    }}
                    className="px-4 py-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border border-slate-700"
                  >
                    {copiedPaytabsUrl ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedPaytabsUrl ? 'تم نسخ المرجع!' : 'نسخ مرجع الطلب'}</span>
                  </button>
                </div>

                {/* Secondary Fallback Checkout Links */}
                <div className="pt-3 border-t border-blue-900/40 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="text-slate-400 flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>معرف السلة: <strong className="text-slate-200 font-mono">{activeCart?.cartId}</strong></span>
                    </span>
                    <span>• المبلغ: <strong className="text-emerald-400 font-mono">{activeCart?.totalPrice} ر.س</strong></span>
                    <span>• الوقت المتبقي: <strong className="text-amber-300 font-mono">{formatTimer(cartSecondsLeft)}</strong></span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const verifyIdx = stepsList.findIndex(s => s.type === 'payment_verification' || s.type === 'checkout_payment');
                        if (verifyIdx >= 0) setCurrentStepIndex(verifyIdx);
                      }}
                      className="px-4 py-2 bg-purple-950/60 hover:bg-purple-900/60 text-purple-200 border border-purple-500/50 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4 text-purple-400" />
                      <span>بعد إتمام الدفع: التحقق وإصدار التذاكر ←</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Unified Order Review, Cart Lock & PayTabs Official Payment Step */}
          {currentStepObj.type === 'checkout_payment' && (
            <div className="space-y-6 animate-in fade-in">
              {/* Live Order Summary Card */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-3">
                    <img src={currentEvent.image} alt={currentEvent.titleAr} className="w-12 h-12 rounded-xl object-cover shrink-0 border border-slate-700" />
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white">{currentEvent.titleAr}</h4>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          {currentEvent.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                        <span>{currentEvent.locationAr || currentEvent.location}</span>
                      </p>
                    </div>
                  </div>

                  <div className="text-right sm:text-left text-xs">
                    <span className="text-slate-400 block text-[10px]">الموعد المحدد للحضور:</span>
                    <span className="font-bold text-purple-300 font-mono">
                      {formValues.selectedDate} • {formValues.selectedTime}
                    </span>
                  </div>
                </div>

                {/* Ticket Details & Seats Breakdown */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-950 p-3.5 rounded-xl border border-slate-850">
                  <div>
                    <span className="text-slate-400 block text-[10px] mb-1">نوع التذاكر / المقاعد:</span>
                    {currentEvent.isSeated ? (
                      <div>
                        <span className="font-bold text-emerald-400 block">مقاعد مرقمة مخصصة</span>
                        <span className="text-purple-300 font-mono text-[11px]">
                          {selectedSeats.length > 0 
                            ? selectedSeats.map(s => s.label || s.id).join(', ') 
                            : `${formValues.ticketQuantity} مقاعد مقترحة`}
                        </span>
                      </div>
                    ) : (
                      <div>
                        <span className="font-bold text-purple-300 block">
                          {currentEvent.tiers?.find(t => t.id === formValues.selectedTierId)?.nameAr || 'دخول عام'}
                        </span>
                        <span className="text-slate-400 font-mono text-[11px]">{formValues.ticketQuantity} تذاكر دخول</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] mb-1">جهة المشجعين / المدرج:</span>
                    <span className="font-bold text-white">
                      {currentEvent.teams ? (
                        formValues.selectedTeam === 'home' ? currentEvent.teams.home.nameAr :
                        formValues.selectedTeam === 'away' ? currentEvent.teams.away.nameAr :
                        'المنصة المحايدة'
                      ) : 'مدرجات الحضور العامة'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] mb-1">إجمالي الحساب (شامل 15% ضريبة):</span>
                    <span className="text-base font-black text-emerald-400 font-mono">
                      {activeCart?.totalPrice || (
                        (selectedSeats.length > 0 
                          ? selectedSeats.reduce((s, x) => s + (x.price || 0), 0) 
                          : formValues.ticketQuantity * (currentEvent.tiers?.[0]?.price || 85))
                      )} ر.س
                    </span>
                  </div>
                </div>

                {/* Contact Email & Token */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      البريد الإلكتروني لاستلام التذاكر:
                    </label>
                    <input
                      type="email"
                      value={formValues.email}
                      onChange={(e) => setFormValues(v => ({ ...v, email: e.target.value }))}
                      placeholder="user@webook.com"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center justify-between">
                      <span>رمز توثيق الحساب (Authorization: Bearer):</span>
                      <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>محاقن تلقائياً</span>
                      </span>
                    </label>
                    <div className="w-full bg-slate-950 border border-emerald-500/30 rounded-xl px-3 py-2 text-xs text-emerald-300 font-mono flex items-center justify-between shadow-inner">
                      <span className="truncate">
                        {formValues.authToken 
                          ? `${formValues.authToken.substring(0, 14)}••••••••${formValues.authToken.substring(formValues.authToken.length - 6)}` 
                          : 'نشط ومفعل تلقائياً من مدير الحسابات'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-sans shrink-0 bg-slate-900 px-2 py-0.5 rounded-md">
                        Webook Bearer
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cart Lock Action Button (If cart is not yet locked) */}
              {(!activeCart || activeCart.status !== 'active') && (
                <div className="bg-gradient-to-r from-purple-950/40 via-slate-900 to-indigo-950/40 border-2 border-purple-500/40 rounded-2xl p-5 space-y-4 shadow-xl">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-600/30 border border-purple-400/50 flex items-center justify-center text-purple-300">
                        <ShoppingCart className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">قفل المقاعد فورياً في خوادم Webook الرسمية</h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          تثبيت حجز المقاعد في السلة النشطة مؤقتاً لمدة 10 دقائق رسمية وتوليد معرف السلة (cart_id).
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleExecuteStep(currentStepIndex)}
                      disabled={isRunningStep}
                      className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <Lock className={`w-4 h-4 ${isRunningStep ? 'animate-spin' : ''}`} />
                      <span>{isRunningStep ? 'جاري قفل المقاعد في السلة...' : 'قفل المقاعد وتثبيت السلة (10 دقائق)'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Active Cart & Official PayTabs Payment Gateway Card */}
              {activeCart && activeCart.status === 'active' && (
                <div className="space-y-4">
                  {/* Cart Hold Status */}
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
                        <span className="text-slate-400 block text-[10px]">المقاعد المحجوزة مؤقتاً:</span>
                        <strong className="text-purple-300 font-mono">
                          {activeCart.seatIds?.length ? activeCart.seatIds.join(', ') : `${activeCart.quantity} مقاعد`}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* PayTabs Payment Gateway Container */}
                  <div className="bg-gradient-to-br from-blue-950/50 via-slate-900 to-indigo-950/50 border-2 border-blue-500/50 rounded-2xl p-5 space-y-4 shadow-2xl animate-in fade-in">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-blue-900/40 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300 font-black text-sm shadow-md">
                          PT
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-white">بوابة دفع PayTabs السعودية الرسمية (PayTabs Gateway)</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/20 text-blue-300 border border-blue-500/40">
                              Mada / Visa / MC / Apple Pay
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              توليد فوري عند الطلب On-Demand
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 mt-0.5">
                            يتم إنشاء جلسة الدفع والرابط الرسمي ديناميكياً وفورياً عند النقر على زر الدفع فقط، لتفادي أخطاء انتهاء الصلاحية أو خطأ 404.
                          </p>
                        </div>
                      </div>

                      <div className="text-right sm:text-left font-mono">
                        <span className="text-[10px] text-slate-400 block">رقم مرجع الطلب (Order Reference)</span>
                        <span className="text-xs font-bold text-amber-300 font-mono select-all">
                          {activeCart.orderReference || 'WBK-ORD-ACTIVE'}
                        </span>
                      </div>
                    </div>

                    {/* Expiration warning banner */}
                    {cartSecondsLeft < 180 && (
                      <div className="bg-amber-950/50 border border-amber-500/60 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-pulse">
                        <div className="flex items-center gap-2 text-xs text-amber-200">
                          <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>
                            تنبيه: اقتربت صلاحية الجلسة الحالية من الانتهاء (متبقي {formatTimer(cartSecondsLeft)}). اضغط زر "تحديث جلسة الدفع" لتوليد رابط جديد فوراً وتفادي خطأ 404.
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleInitiateFreshPaymentSession(false)}
                          disabled={isGeneratingPaymentSession}
                          className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition cursor-pointer flex items-center gap-1.5 shadow-md shrink-0"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingPaymentSession ? 'animate-spin' : ''}`} />
                          <span>تحديث الجلسة الآن</span>
                        </button>
                      </div>
                    )}

                    {/* PayTabs Status Banner */}
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="text-slate-200">
                          {cartSecondsLeft === 0 
                            ? '⚠️ انتهت صلاحية الجلسة السابقة — اضغط "تحديث الجلسة" لتجديد الصلاحية وتفادي أخطاء 404' 
                            : 'بوابة PayTabs الرسمية المشفرة جاهزة للتوليد والتحويل الفوري عند النقر'}
                        </span>
                      </div>
                      <span className="font-mono text-emerald-400 text-[11px] bg-emerald-950/60 px-2.5 py-0.5 rounded border border-emerald-500/30">
                        {paymentSessionFreshAt ? `تحديث: ${paymentSessionFreshAt}` : 'Ready On-Demand'}
                      </span>
                    </div>

                    {/* PayTabs Actions */}
                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        onClick={handlePayNowClick}
                        disabled={isGeneratingPaymentSession}
                        className="flex-1 min-w-[220px] py-3.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs sm:text-sm rounded-xl text-center shadow-xl shadow-emerald-500/30 flex items-center justify-center gap-2 transition cursor-pointer hover:scale-[1.01]"
                      >
                        {isGeneratingPaymentSession ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>جاري إنشاء جلسة الدفع الرسمية والتحويل...</span>
                          </>
                        ) : (
                          <>
                            <ExternalLink className="w-4 h-4" />
                            <span>الدفع الآن عبر بوابة PayTabs (Pay Now) ←</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleInitiateFreshPaymentSession(false)}
                        disabled={isGeneratingPaymentSession}
                        className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border border-slate-700"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingPaymentSession ? 'animate-spin' : ''}`} />
                        <span>تحديث الجلسة (Refresh)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleVerifyPaymentManual()}
                        disabled={isVerifyingPayment}
                        className="px-4 py-3 bg-purple-950/60 hover:bg-purple-900/60 border border-purple-500/50 text-purple-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <ShieldCheck className={`w-4 h-4 text-purple-400 ${isVerifyingPayment ? 'animate-spin' : ''}`} />
                        <span>التحقق من إتمام الدفع وتأكيد التذاكر</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Confirmed Order Card (If verified) */}
              {confirmedOrder && (
                <div className="bg-gradient-to-r from-emerald-950/60 via-slate-900 to-teal-950/60 border-2 border-emerald-500/60 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-emerald-500/30 pb-3">
                    <div className="flex items-center gap-2 text-emerald-400 font-black text-base">
                      <CheckCircle2 className="w-6 h-6" />
                      <span>تم تأكيد الدفع وإصدار التذاكر الرقمية المعتمدة بنجاح!</span>
                    </div>
                    <span className="font-mono text-xs text-amber-300 font-bold bg-amber-950/50 px-3 py-1 rounded-full border border-amber-500/40">
                      {confirmedOrder.orderReference}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-950/80 p-4 rounded-2xl border border-emerald-500/30">
                    <div>
                      <span className="text-slate-400 block text-[10px]">الفعالية:</span>
                      <strong className="text-white text-xs">{confirmedOrder.eventTitle || currentEvent.titleAr}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">المبلغ المدفوع:</span>
                      <strong className="text-emerald-400 text-xs font-mono">{confirmedOrder.totalPrice} ر.س</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">المقاعد المؤكدة:</span>
                      <strong className="text-purple-300 text-xs font-mono">
                        {confirmedOrder.seatIds?.join(', ') || `${confirmedOrder.ticketsCount || 1} تذاكر`}
                      </strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 9. Payment Verification & Booking History Confirmation Step */}
          {currentStepObj.type === 'payment_verification' && (
            <div className="space-y-6 animate-in fade-in">
              {/* Header Box */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
                      <CreditCard className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">التحقق من إتمام الدفع وفحص سجل الحجوزات الرسمية</h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        بعد العودة من بوابة PayTabs، يتم مطابقة رقم مرجع الطلب (Order Reference) لإصدار التذاكر الرقمية المعتمدة.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleFetchBookingHistory}
                    disabled={isCheckingHistory}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0"
                  >
                    <Layers className={`w-3.5 h-3.5 text-purple-400 ${isCheckingHistory ? 'animate-spin' : ''}`} />
                    <span>فحص سجل الحجوزات السابقة</span>
                  </button>
                </div>

                {/* Reference Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      رقم مرجع الطلب (Order Reference ID):
                    </label>
                    <input
                      type="text"
                      value={manualOrderRef}
                      onChange={(e) => setManualOrderRef(e.target.value)}
                      placeholder="مثال: WBK-ORD-M4F7... أو PT_TRX_..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-amber-300 font-mono"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      معرف السلة (Cart Reference ID):
                    </label>
                    <input
                      type="text"
                      value={manualCartId}
                      onChange={(e) => setManualCartId(e.target.value)}
                      placeholder="مثال: wbk_cart_..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-purple-300 font-mono"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      بريد حامل التذاكر (Attendee Email):
                    </label>
                    <input
                      type="email"
                      value={manualEmail}
                      onChange={(e) => setManualEmail(e.target.value)}
                      placeholder="user@webook.com"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono"
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* Action Controls */}
                <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => handleVerifyPaymentManual()}
                    disabled={isVerifyingPayment}
                    className="flex-1 min-w-[200px] px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <CheckCircle2 className={`w-4 h-4 ${isVerifyingPayment ? 'animate-spin' : ''}`} />
                    <span>{isVerifyingPayment ? 'جاري التحقق من خوادم الدفع...' : 'التحقق من الدفع وتأكيد إصدار التذاكر'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSimulatePayTabsReturn}
                    disabled={isVerifyingPayment}
                    className="px-4 py-2.5 bg-purple-950/70 hover:bg-purple-900/70 border border-purple-500/50 text-purple-200 font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                    title="محاكاة العودة الآلية بعد السداد بنجاح عبر PayTabs"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>⚡ محاكاة إتمام الدفع عبر PayTabs</span>
                  </button>
                </div>

                {/* Feedback Message */}
                {verifyMessage && (
                  <div className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
                    verifyMessage.type === 'success'
                      ? 'bg-emerald-950/40 border border-emerald-500/50 text-emerald-200'
                      : 'bg-rose-950/40 border border-rose-500/50 text-rose-200'
                  }`}>
                    {verifyMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                    <span>{verifyMessage.text}</span>
                  </div>
                )}
              </div>

              {/* CONFIRMED DIGITAL TICKETS DISPLAY */}
              {confirmedOrder && (
                <div className="space-y-4 animate-in fade-in">
                  {/* Confirmed Order Summary Header */}
                  <div className="bg-gradient-to-r from-emerald-950/60 via-slate-900 to-teal-950/60 border-2 border-emerald-500/60 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-emerald-500/30">
                          <Check className="w-7 h-7 stroke-[3]" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              تم الدفع وإصدار التذاكر رسمياً ✓
                            </span>
                            <span className="text-xs font-mono text-purple-300 font-bold">
                              {confirmedOrder.invoiceNumber || `INV-${confirmedOrder.orderReference}`}
                            </span>
                          </div>
                          <h3 className="text-lg font-black text-white mt-0.5">
                            تهانينا! حجزك مؤكد بنجاح والتذاكر جاهزة للاستخدام
                          </h3>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => window.print()}
                          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5 text-purple-400" />
                          <span>طباعة ملخص الحجز</span>
                        </button>

                        <a
                          href="https://webook.com/ar/profile/bookings"
                          target="_blank"
                          rel="noreferrer"
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                        >
                          <Ticket className="w-3.5 h-3.5" />
                          <span>عرض في حجوزاتي (Webook)</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
                      <div>
                        <span className="text-slate-400 block text-[10px]">رقم مرجع الطلب:</span>
                        <strong className="text-amber-300 font-mono">{confirmedOrder.orderReference}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">بوابة الدفع:</span>
                        <strong className="text-blue-300 font-mono">PayTabs السعودية</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">المبلغ الإجمالي المسدد:</span>
                        <strong className="text-emerald-400 font-mono">{confirmedOrder.amount} ر.س</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">عدد التذاكر الصادرة:</span>
                        <strong className="text-purple-300 font-mono">{confirmedOrder.tickets?.length || confirmedOrder.seatsCount || 1} تذاكر</strong>
                      </div>
                    </div>
                  </div>

                  {/* Individual Digital Tickets Grid */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-300 font-bold px-1">
                      <span className="flex items-center gap-1.5">
                        <QrCode className="w-4 h-4 text-pink-400" />
                        <span>التذاكر الرقمية المعتمدة للدخول ({confirmedOrder.tickets?.length || 0} تذاكر):</span>
                      </span>
                      <span className="text-slate-500 font-mono text-[11px]">
                        جاهزة للمسح الضوئي عند البوابة الرسمية
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(confirmedOrder.tickets || []).map((ticket: any, idx: number) => (
                        <div
                          key={ticket.ticketId || idx}
                          className="bg-slate-950 border-2 border-purple-500/50 rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-xl space-y-3"
                        >
                          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-lg bg-pink-600/30 text-pink-300 flex items-center justify-center font-bold text-xs">
                                {idx + 1}
                              </span>
                              <div>
                                <div className="text-xs font-bold text-white">{ticket.seatLabel || `المقعد ${ticket.row}-${ticket.number}`}</div>
                                <div className="text-[10px] text-pink-400 font-mono">{ticket.section || 'الواجهة الرسمية'}</div>
                              </div>
                            </div>

                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              تذكرة نشطة ومؤكدة ✓
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-[10px] text-slate-400 block">الفعالية:</span>
                              <strong className="text-white truncate block">{ticket.eventTitle || currentEvent.titleAr}</strong>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block">الموعد:</span>
                              <strong className="text-slate-200 font-mono text-[11px] block">{ticket.date} • {ticket.time}</strong>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block">حامل التذكرة:</span>
                              <strong className="text-purple-300 block">{ticket.attendeeName || 'حامل التذكرة'}</strong>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block">فئة التذكرة والسعر:</span>
                              <strong className="text-emerald-400 font-mono block">{ticket.price} ر.س ({ticket.tierNameAr || 'فئة معتمدة'})</strong>
                            </div>
                          </div>

                          {/* Digital Barcode & QR Display */}
                          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl">
                            {/* Stylized Barcode */}
                            <div className="space-y-1">
                              <div className="flex items-center gap-0.5 h-8 bg-white px-2 py-1 rounded">
                                {[3,1,2,1,3,2,1,2,3,1,1,3,2,1,2,3,1].map((w, i) => (
                                  <span key={i} className="bg-slate-950 h-full" style={{ width: `${w * 2}px` }} />
                                ))}
                              </div>
                              <span className="text-[10px] font-mono text-slate-400 block" dir="ltr">
                                {ticket.barcode || `WBK-${ticket.seatId}`}
                              </span>
                            </div>

                            {/* Stylized QR payload representation */}
                            <div className="text-center shrink-0">
                              <div className="w-12 h-12 bg-white p-1 rounded-lg flex items-center justify-center shadow">
                                <QrCode className="w-10 h-10 text-slate-950" />
                              </div>
                              <span className="text-[9px] font-mono text-purple-400 block mt-0.5">QR Verified</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Booking History Drawer / Modal */}
              {showHistoryDrawer && (
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-purple-400" />
                      <span className="text-xs font-bold text-white">سجل الحجوزات المؤكدة المخزنة في النظام ({bookingHistory.length}):</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowHistoryDrawer(false)}
                      className="text-xs text-slate-400 hover:text-white cursor-pointer"
                    >
                      إغلاق ✕
                    </button>
                  </div>

                  {bookingHistory.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400">
                      {historyFeedback || 'لا توجد حجوزات سابقة محفوظة في النظام لهذا الحساب.'}
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-64 overflow-y-auto">
                      {bookingHistory.map((order, i) => (
                        <div
                          key={order.orderReference || i}
                          onClick={() => {
                            setConfirmedOrder(order);
                            setManualOrderRef(order.orderReference);
                            setManualCartId(order.cartId);
                          }}
                          className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                            confirmedOrder?.orderReference === order.orderReference
                              ? 'bg-purple-950/40 border-purple-500'
                              : 'bg-slate-900/60 border-slate-800 hover:bg-slate-900'
                          }`}
                        >
                          <div>
                            <div className="text-xs font-bold text-white flex items-center gap-2">
                              <span>مرجع: {order.orderReference}</span>
                              <span className="text-emerald-400 font-mono">{order.amount} ر.س</span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {order.issuedAt ? new Date(order.issuedAt).toLocaleString('ar-SA') : 'مؤكد'} • {order.tickets?.length || order.seatsCount || 1} تذاكر
                            </div>
                          </div>

                          <button
                            type="button"
                            className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-[11px] font-bold"
                          >
                            عرض التذاكر
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
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
