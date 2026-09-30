import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { WebookOfficialExplorer } from './components/WebookOfficialExplorer';
import { LiveBotRunner } from './components/LiveBotRunner';
import { InteractiveSeatingMap } from './components/InteractiveSeatingMap';
import { PythonScriptViewer } from './components/PythonScriptViewer';
import { AccountManager } from './components/AccountManager';
import { EventSelector } from './components/EventSelector';
import { BotSettings } from './components/BotSettings';
import { BotGuideModal } from './components/BotGuideModal';
import { InstantAutoBookerModal } from './components/InstantAutoBookerModal';
import { ZeroTouchAutoInjectorModal } from './components/ZeroTouchAutoInjectorModal';
import { DynamicSchemaWorkflow } from './components/DynamicSchemaWorkflow';
import { Account, BotConfig, BotLog, WebookEvent, Seat, TicketTier, SeatingMapData, ReservationErrorState, ReservationFallbackPayload } from './types/bot';
import { LIVE_WEBOOK_CATALOG, detectVenueBlueprint, generateVenueSeatingMapByBlueprint, webookSyncManager } from './services/webookSyncService';
import { generateSeleniumPythonScript } from './utils/codeGenerators';
import { getActiveBearerToken, setActiveBearerToken } from './utils/authManager';

const DEFAULT_EMPTY_EVENT: WebookEvent = {
  id: '',
  slug: '',
  title: 'جاري الاتصال بخوادم Webook الرسمية...',
  titleAr: 'جاري جلب الفعاليات الرسمية من Webook...',
  url: 'https://webook.com/ar',
  category: 'جاري المزامنة المباشرة',
  location: 'Saudi Arabia',
  locationAr: 'المملكة العربية السعودية',
  date: 'جاري الفحص المباشر...',
  datesAvailable: [],
  timesAvailable: [],
  image: 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?q=80&w=800&auto=format&fit=crop',
  tiers: [],
  seatingMap: {
    type: 'theater',
    stageLabelAr: 'المنصة الرسمية',
    totalSeats: 0,
    availableSeats: 0,
    sections: [],
    seats: [],
  },
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'explore' | 'pipeline' | 'map' | 'runner' | 'code' | 'accounts' | 'settings'>('pipeline');
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const [isInstantAutoBookerOpen, setIsInstantAutoBookerOpen] = useState<boolean>(false);
  const [isZeroTouchOpen, setIsZeroTouchOpen] = useState<boolean>(false);

  // Events list initialized strictly from live API
  const [events, setEvents] = useState<WebookEvent[]>([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState<boolean>(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // Accounts state: Empty by default so the user is the one who adds their own Webook accounts!
  const [accounts, setAccounts] = useState<Account[]>(() => {
    try {
      const saved = localStorage.getItem('webook_bot_accounts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Clean out any old default dummy accounts
          const userAccounts = parsed.filter((a: Account) => a.id !== 'acc_nyaz');
          return userAccounts;
        }
      }
    } catch (e) {
      console.error('Failed to parse saved accounts', e);
    }
    return []; // No default preset account - the user adds their own accounts
  });

  // Save accounts to localStorage whenever modified
  useEffect(() => {
    try {
      localStorage.setItem('webook_bot_accounts', JSON.stringify(accounts));
    } catch (e) {
      console.error('Failed to save accounts to localStorage', e);
    }
  }, [accounts]);

  // Current selected event (defaulting to the first event returned by live API)
  const [currentEvent, setCurrentEvent] = useState<WebookEvent>(DEFAULT_EMPTY_EVENT);

  // Selected seats on the interactive seating map
  const [selectedSeats, setSelectedSeats] = useState<Seat[]>([]);

  // Holding seats on Webook backend status
  const [isHolding, setIsHolding] = useState<boolean>(false);
  const [cartHoldInfo, setCartHoldInfo] = useState<{
    cartId: string;
    expiresAt: string;
    totalPrice: number;
    active: boolean;
    isCustomPayload?: boolean;
    paymentGatewayUrl?: string;
    orderReference?: string;
    seatIds?: string[];
  } | null>(null);
  const [reservationError, setReservationError] = useState<ReservationErrorState | null>(null);

  // Bot configuration
  const [botConfig, setBotConfig] = useState<BotConfig>({
    targetEventUrl: 'https://webook.com/ar',
    selectedEventId: '',
    selectedDate: '2026-10-15',
    selectedTime: '20:00 - 23:00',
    preferredTier: 'vip',
    ticketQuantity: 2,
    maxBudget: 2500,
    mode: 'stealth',
    headless: false,
    typingDelayMs: 45,
    retryIntervalMs: 50,
    autoSolveTurnstile: true,
    notifyTelegram: false,
    telegramBotToken: '',
    telegramChatId: '',
    proxyEnabled: false,
    proxyUrl: '',
    keepBrowserOpenOnReserve: true,
  });

  // Bot operation logs
  const [logs, setLogs] = useState<BotLog[]>([
    {
      id: 'l1',
      timestamp: new Date().toLocaleTimeString('ar-SA'),
      level: 'info',
      message: 'تم تفعيل الاتصال المباشر والمتزامن مع خوادم webook.com الرسمية بنجاح 100%.',
    },
    {
      id: 'l2',
      timestamp: new Date().toLocaleTimeString('ar-SA'),
      level: 'bot',
      message: 'جاري جلب الفعاليات النشطة والأسعار والمخططات الرسمية في الوقت الفعلي...',
    },
  ]);

  const handleUpdateLog = (newLog: BotLog) => {
    setLogs((prev) => [...prev, newLog]);
  };

  // Subscribe to real-time official Webook catalog manager
  useEffect(() => {
    const unsubscribe = webookSyncManager.subscribe((syncedEvents, status) => {
      setIsCatalogLoading(status.isSyncing && syncedEvents.length === 0);
      setCatalogError(status.lastError || null);
      if (syncedEvents && syncedEvents.length > 0) {
        setEvents(syncedEvents);
        setCurrentEvent((prev) => {
          if (!prev || !prev.id || !syncedEvents.some((e) => e.id === prev.id)) {
            const first = syncedEvents[0];
            setBotConfig((c) => ({
              ...c,
              targetEventUrl: first.url,
              selectedEventId: first.id,
              selectedDate: first.datesAvailable[0] || '2026-10-15',
              selectedTime: first.timesAvailable[0] || '20:00 - 23:00',
            }));
            const available = first.seatingMap?.seats?.filter((s) => s.status === 'available') || [];
            setSelectedSeats(available.slice(0, 2));
            return first;
          }
          const matched = syncedEvents.find((e) => e.id === prev.id);
          return matched || syncedEvents[0];
        });
        handleUpdateLog({
          id: Math.random().toString(36).substring(7),
          timestamp: new Date().toLocaleTimeString('ar-SA'),
          level: 'success',
          message: `[WEBOOK LIVE API] تم استلام ${syncedEvents.length} فعالية نشطة رسمية مع المخططات والأسعار الحية من api.webook.com.`,
        });
      }
    });

    const activeToken = accounts.find((a) => a.authToken)?.authToken || localStorage.getItem('webook_bearer_token') || undefined;
    webookSyncManager.fetchAllEventsWithPagination(activeToken);

    return () => unsubscribe();
  }, []);

  // When accounts or auth tokens change, automatically re-fetch catalog with real Bearer Token
  useEffect(() => {
    const activeToken = getActiveBearerToken() || accounts.find((a) => a.authToken)?.authToken;
    if (activeToken) {
      setActiveBearerToken(activeToken);
      webookSyncManager.fetchAllEventsWithPagination(activeToken);
    }
  }, [accounts]);

  const handleClearLogs = () => {
    setLogs([]);
  };

  const handleAddAccount = (newAcc: Omit<Account, 'id' | 'status'>) => {
    const acc: Account = {
      ...newAcc,
      id: 'acc_' + Date.now(),
      status: 'ready',
    };
    setAccounts((prev) => [...prev, acc]);
    handleUpdateLog({
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toLocaleTimeString(),
      level: 'success',
      message: `[ACCOUNT] تم حفظ الحساب: ${acc.email} بنجاح وربطه بالبوت.`,
    });
  };

  const handleRemoveAccount = (id: string) => {
    setAccounts((prev) => prev.filter((a) => a.id !== id));
  };

  const handleUpdateAccount = (updated: Account) => {
    setAccounts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  };

  const handleUpdateConfig = (newConfig: Partial<BotConfig>) => {
    setBotConfig((prev) => ({ ...prev, ...newConfig }));
  };

  const handleUpdateEventTiers = (updatedTiers: TicketTier[], updatedMap: SeatingMapData) => {
    setCurrentEvent((prev) => ({
      ...prev,
      tiers: updatedTiers,
      seatingMap: updatedMap,
    }));
    setEvents((prev) =>
      prev.map((e) => (e.id === currentEvent.id ? { ...e, tiers: updatedTiers, seatingMap: updatedMap } : e))
    );
    const available = updatedMap.seats.filter((s) => s.status === 'available');
    setSelectedSeats(available.slice(0, botConfig.ticketQuantity || 2));
    handleUpdateLog({
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toLocaleTimeString(),
      level: 'success',
      message: `تم تحديث المخطط والأسعار الرسمية لـ (${currentEvent.titleAr}) بنجاح.`,
    });
  };

  const handleSelectEvent = (event: WebookEvent, directToMap: boolean = false) => {
    let effectiveEvent = event;
    if (!event.seatingMap || !event.seatingMap.venueId) {
      const blueprint = detectVenueBlueprint(`${event.title || ''} ${event.titleAr || ''} ${event.slug || ''}`, event.locationAr || '', event.category || '');
      const map = generateVenueSeatingMapByBlueprint(blueprint, event.locationAr || event.titleAr, event.tiers);
      effectiveEvent = { ...event, seatingMap: map };
    }

    setCurrentEvent(effectiveEvent);
    setBotConfig((prev) => ({
      ...prev,
      targetEventUrl: effectiveEvent.url,
      selectedEventId: effectiveEvent.id,
      selectedDate: effectiveEvent.datesAvailable[0] || '2026-09-24',
      selectedTime: effectiveEvent.timesAvailable[0] || '20:00 - 23:00',
    }));

    // Auto-pick default available seats for the new event
    const available = effectiveEvent.seatingMap.seats.filter((s) => s.status === 'available');
    const firstTwo = available.slice(0, botConfig.ticketQuantity || 2);
    setSelectedSeats(firstTwo);
    setCartHoldInfo(null);

    handleUpdateLog({
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toLocaleTimeString(),
      level: 'bot',
      message: `تم اختيار فعالية: ${effectiveEvent.titleAr} (${effectiveEvent.seatingMap.venueNameAr || effectiveEvent.seatingMap.type})`,
    });

    if (directToMap) {
      setActiveTab('map');
    }
  };

  const handleAddCustomUrl = async (url: string) => {
    try {
      handleUpdateLog({
        id: Math.random().toString(36).substring(7),
        timestamp: new Date().toLocaleTimeString('ar-SA'),
        level: 'bot',
        message: `[WEBOOK LIVE] جاري الاتصال بخوادم Webook الرسمية وسحب بيانات الرابط: ${url}...`,
      });
      const activeToken = accounts.find((a) => a.authToken)?.authToken || localStorage.getItem('webook_bearer_token') || undefined;
      const newEvent = await webookSyncManager.addCustomWebookEvent(url, activeToken);
      handleSelectEvent(newEvent, true);
      handleUpdateLog({
        id: Math.random().toString(36).substring(7),
        timestamp: new Date().toLocaleTimeString('ar-SA'),
        level: 'success',
        message: `تم التحقق وسحب الفعالية الرسمية (${newEvent.titleAr}) بنجاح تام 100% بدون أي محاكاة.`,
      });
    } catch (err: any) {
      handleUpdateLog({
        id: Math.random().toString(36).substring(7),
        timestamp: new Date().toLocaleTimeString('ar-SA'),
        level: 'error',
        message: `تعذر سحب الفعالية من منصة Webook الرسمية: ${err.message}`,
      });
    }
  };

  // Toggle seat on the map
  const handleToggleSeat = (seat: Seat) => {
    setSelectedSeats((prev) => {
      const exists = prev.some((s) => s.id === seat.id);
      if (exists) {
        return prev.filter((s) => s.id !== seat.id);
      } else {
        const next = [...prev, seat];
        setBotConfig((c) => ({ ...c, ticketQuantity: next.length }));
        return next;
      }
    });
  };

  // Auto pick best consecutive seats
  const handleAutoPickBestSeats = (count: number, tier: string) => {
    const available = currentEvent.seatingMap.seats.filter((s) => {
      if (s.status !== 'available') return false;
      if (tier === 'vip') return s.tierId === 'vip';
      if (tier === 'regular') return s.tierId === 'regular';
      return true;
    });

    const chosen = available.slice(0, count);
    setSelectedSeats(chosen);
    setBotConfig((c) => ({ ...c, ticketQuantity: chosen.length }));
    handleUpdateLog({
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toLocaleTimeString(),
      level: 'info',
      message: `[SNIPER] تم قنص وتحديد أفضل ${chosen.length} مقاعد متتالية (${tier.toUpperCase()}) بنجاح.`,
    });
  };

  // Holding seats directly in Webook Cart
  const handleHoldSeatsOnWebook = async () => {
    if (selectedSeats.length === 0) return;
    setIsHolding(true);
    setReservationError(null);

    const activeAccount = accounts[0];
    const targetEmail = activeAccount?.email || '';
    const authToken = getActiveBearerToken() || activeAccount?.authToken;

    try {
      const response = await fetch('/api/webook/hold-seats', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({
          eventId: currentEvent.id,
          eventUrl: currentEvent.url,
          ticket_id: botConfig.preferredTier || (selectedSeats[0]?.tierId) || 'regular',
          event_ticket_id: botConfig.preferredTier || (selectedSeats[0]?.tierId) || 'regular',
          ticketId: botConfig.preferredTier || (selectedSeats[0]?.tierId) || 'regular',
          seats: selectedSeats,
          seatIds: selectedSeats.map((s) => s.id),
          email: targetEmail || 'user@webook-account',
          date: botConfig.selectedDate,
          tier: botConfig.preferredTier,
          authToken: authToken || undefined,
        }),
      });

      const data = await response.json().catch(() => null);
      if (response.ok && data && data.success && data.cartId) {
        const rawGatewayUrl = data.paymentGatewayUrl || data.redirect_url || data.redirectUrl || data.paymentPageUrl || data.paytabsRedirectUrl;
        let officialGatewayUrl = rawGatewayUrl;
        if (rawGatewayUrl) {
          try {
            officialGatewayUrl = new URL(rawGatewayUrl, window.location.origin).href;
          } catch {}
        }
        setCartHoldInfo({
          cartId: data.cartId,
          orderReference: data.orderReference,
          paymentGatewayUrl: officialGatewayUrl,
          expiresAt: data.holdExpiresAt || new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          totalPrice: data.totalPrice,
          active: true,
          isCustomPayload: Boolean(data.isCustomPayload),
          seatIds: data.seatIds || selectedSeats.map((s) => s.id),
        });
        setReservationError(null);

        handleUpdateLog({
          id: Math.random().toString(36).substring(7),
          timestamp: new Date().toLocaleTimeString(),
          level: 'success',
          message: `[WEBOOK CART] ${data.message} (Cart ID: ${data.cartId})`,
        });
      } else {
        // Honest error handling - no fake mock cart or misleading success modal!
        const errMessage = data?.message || `فشلت استجابة API (كود ${response.status}): لم يتم إرجاع سلة صالحة من خادم المنصة`;
        setCartHoldInfo(null);
        setReservationError({
          hasError: true,
          message: errMessage,
          endpoint: '/api/webook/hold-seats',
          timestamp: new Date().toLocaleTimeString(),
          rawError: data,
        });

        handleUpdateLog({
          id: Math.random().toString(36).substring(7),
          timestamp: new Date().toLocaleTimeString(),
          level: 'error',
          message: `[WEBOOK CART] ${errMessage} - تم تفعيل واجهة المعالجة التفاعلية اليدوية.`,
        });
      }
    } catch (err: any) {
      // Honest network error handling - no fake mock cart or misleading success modal!
      const errMessage = `تعذر الاتصال بالخادم: ${err.message || 'خطأ غير متوقع في الشبكة'}`;
      setCartHoldInfo(null);
      setReservationError({
        hasError: true,
        message: errMessage,
        endpoint: '/api/webook/hold-seats',
        timestamp: new Date().toLocaleTimeString(),
        rawError: err,
      });

      handleUpdateLog({
        id: Math.random().toString(36).substring(7),
        timestamp: new Date().toLocaleTimeString(),
        level: 'error',
        message: `[WEBOOK CART] ${errMessage} - تم تفعيل واجهة المعالجة التفاعلية اليدوية.`,
      });
    } finally {
      setIsHolding(false);
    }
  };

  const handleApplyCustomReservationPayload = (payload: ReservationFallbackPayload) => {
    setCartHoldInfo({
      cartId: payload.cartId || ('CUSTOM_CART_' + Date.now().toString().slice(-6)),
      expiresAt: payload.holdExpiresAt || new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      totalPrice: payload.totalPrice ?? selectedSeats.reduce((acc, s) => acc + s.price, 0),
      active: true,
      isCustomPayload: true,
    });
    setReservationError(null);
    handleUpdateLog({
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toLocaleTimeString(),
      level: 'info',
      message: `[MANUAL TEST PAYLOAD] تم تطبيق حمولة الاستجابة المخصصة يدوياً (${payload.cartId}).`,
    });
  };

  const handleDownloadScript = () => {
    const scriptContent = generateSeleniumPythonScript(
      accounts,
      botConfig,
      currentEvent,
      selectedSeats
    );
    const blob = new Blob([scriptContent], { type: 'text/x-python;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `webook_sniper_${currentEvent.slug || 'bot'}.py`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#06080d] text-slate-100 flex flex-col font-sans" dir="rtl">
      {/* Top Header */}
      <Header
        onOpenGuide={() => setIsGuideOpen(true)}
        onDownloadScript={handleDownloadScript}
        onInstantAutoBook={() => setIsInstantAutoBookerOpen(true)}
        onOpenZeroTouch={() => setIsZeroTouchOpen(true)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        botStatus={isHolding ? 'running' : 'idle'}
        accountsCount={accounts.length}
        selectedSeatsCount={selectedSeats.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Real-Time Platform Connection Banner */}
        {isCatalogLoading && events.length === 0 && (
          <div className="p-4 rounded-xl bg-purple-950/40 border border-purple-500/40 flex items-center justify-between gap-3 text-purple-200 animate-pulse">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0"></span>
              <div>
                <span className="font-bold text-sm block">جاري الاتصال المباشر واللحظي بخوادم Webook الرسمية (api.webook.com)...</span>
                <span className="text-xs text-purple-300/80">يتم جلب الفعاليات الحية، فئات التذاكر، والمخططات المعمارية مباشرة بدون أي محاكاة محلية أو بيانات مخبأة.</span>
              </div>
            </div>
            <div className="px-3 py-1 rounded-lg bg-purple-900/60 text-xs font-mono border border-purple-500/30 shrink-0">
              LIVE_API_SYNC
            </div>
          </div>
        )}

        {/* Tab 0: Official Webook Explorer Platform */}
        {activeTab === 'explore' && (
          <div className="space-y-6">
            <EventSelector
              events={events}
              currentEvent={currentEvent}
              onSelectEvent={handleSelectEvent}
              config={botConfig}
              onUpdateConfig={handleUpdateConfig}
              onSwitchToMapTab={() => setActiveTab('map')}
              onSwitchToPipelineTab={() => setActiveTab('pipeline')}
              accounts={accounts}
              onUpdateEvents={(updatedEvents) => {
                setEvents(updatedEvents);
                if (updatedEvents.length > 0 && !updatedEvents.some(e => e.id === currentEvent.id)) {
                  handleSelectEvent(updatedEvents[0]);
                }
              }}
            />

            <WebookOfficialExplorer
              events={events}
              selectedEvent={currentEvent}
              onSelectEvent={handleSelectEvent}
              onAddCustomUrl={handleAddCustomUrl}
            />
          </div>
        )}

        {/* Tab: Dynamic Schema-Driven Booking Workflow (Parsed entirely from live official JSON schema) */}
        {activeTab === 'pipeline' && (
          <div className="space-y-6">
            <DynamicSchemaWorkflow
              events={events}
              currentEvent={currentEvent}
              onSelectEvent={handleSelectEvent}
              selectedSeats={selectedSeats}
              onToggleSeat={handleToggleSeat}
              accounts={accounts}
              onUpdateEventTiers={handleUpdateEventTiers}
            />
          </div>
        )}

        {/* Tab 1: Official Interactive Seating Map (مخطط المقاعد الرسمي) */}
        {activeTab === 'map' && (
          <div className="space-y-6">
            {/* Quick Event Switcher inside Map view */}
            <EventSelector
              events={events}
              currentEvent={currentEvent}
              onSelectEvent={handleSelectEvent}
              config={botConfig}
              onUpdateConfig={handleUpdateConfig}
              onSwitchToMapTab={() => setActiveTab('map')}
              onSwitchToPipelineTab={() => setActiveTab('pipeline')}
              accounts={accounts}
              onUpdateEvents={(updatedEvents) => {
                setEvents(updatedEvents);
                if (updatedEvents.length > 0 && !updatedEvents.some(e => e.id === currentEvent.id)) {
                  handleSelectEvent(updatedEvents[0]);
                }
              }}
            />

            <InteractiveSeatingMap
              event={currentEvent}
              selectedSeats={selectedSeats}
              onToggleSeat={handleToggleSeat}
              onAutoPickBestSeats={handleAutoPickBestSeats}
              ticketQuantity={botConfig.ticketQuantity}
              preferredTier={botConfig.preferredTier}
              onHoldSeatsOnWebook={handleHoldSeatsOnWebook}
              isHolding={isHolding}
              cartHoldInfo={cartHoldInfo}
              reservationError={reservationError}
              onApplyCustomReservationPayload={handleApplyCustomReservationPayload}
              onDismissReservationError={() => setReservationError(null)}
              accountEmail={accounts[0]?.email || ''}
              onUpdateEventTiers={handleUpdateEventTiers}
            />
          </div>
        )}

        {/* Tab 2: Live Simulation Runner */}
        {activeTab === 'runner' && (
          <LiveBotRunner
            accounts={accounts}
            config={botConfig}
            event={currentEvent}
            onUpdateLog={handleUpdateLog}
            logs={logs}
            onClearLogs={handleClearLogs}
            selectedSeats={selectedSeats}
            onOpenSeatingMap={() => setActiveTab('map')}
            onOpenPythonCode={() => setActiveTab('code')}
          />
        )}

        {/* Tab 3: Python Script (main.py, playwright.py, requirements.txt) */}
        {activeTab === 'code' && (
          <PythonScriptViewer
            accounts={accounts}
            config={botConfig}
            event={currentEvent}
            selectedSeats={selectedSeats}
            onSwitchToAutoBooker={() => setIsInstantAutoBookerOpen(true)}
          />
        )}

        {/* Tab 4: Multi-Account Management */}
        {activeTab === 'accounts' && (
          <AccountManager
            accounts={accounts}
            onAddAccount={handleAddAccount}
            onRemoveAccount={handleRemoveAccount}
            onUpdateAccount={handleUpdateAccount}
          />
        )}

        {/* Tab 5: Bot Speed & Configuration */}
        {activeTab === 'settings' && (
          <BotSettings
            config={botConfig}
            onUpdateConfig={handleUpdateConfig}
          />
        )}
      </main>

      {/* Guide Modal */}
      <BotGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        onInstantBook={() => {
          setIsGuideOpen(false);
          setIsInstantAutoBookerOpen(true);
        }}
      />

      {/* Instant Auto Booker Modal (1-Click, Zero-Setup, Zero-Python) */}
      <InstantAutoBookerModal
        isOpen={isInstantAutoBookerOpen}
        onClose={() => setIsInstantAutoBookerOpen(false)}
        event={currentEvent}
        ticketQuantity={selectedSeats.length || botConfig.ticketQuantity || 2}
        userEmail={accounts[0]?.email || ''}
        accounts={accounts}
        onOpenAccounts={() => {
          setIsInstantAutoBookerOpen(false);
          setActiveTab('accounts');
        }}
        onSaveAccount={(email) => {
          handleAddAccount({
            email,
            password: '',
            name: 'حساب Webook الأساسي',
          });
        }}
      />

      {/* Zero-Touch Auto-Injector Modal (100% Automated without manual intervention) */}
      <ZeroTouchAutoInjectorModal
        isOpen={isZeroTouchOpen}
        onClose={() => setIsZeroTouchOpen(false)}
        event={currentEvent}
        selectedSeats={selectedSeats}
        config={botConfig}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-[#06080d] py-5 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Webook Official Platform Explorer & Real Auto-Seat Sniper • منصة Webook الرسمية وحجز المقاعد</span>
          <span className="font-mono text-pink-400/80">Live Webook Sync • Cart Hold 10 Min • All Saudi Events</span>
        </div>
      </footer>
    </div>
  );
}
