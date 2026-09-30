import { WebookEvent, Seat, SeatingMapData, SeatingSection, TicketTier, VenueBlueprintId } from '../types/bot';
import { playReservationChime } from '../utils/audioAlert';

import {
  generateVenueSeatingMap,
  generateStadiumSeatingMap,
  generateConcertSeatingMap,
  generateZoneSeatingMap,
  detectVenueBlueprint,
  generateVenueSeatingMapByBlueprint,
} from './venueSeatingService';

export {
  generateVenueSeatingMap,
  generateStadiumSeatingMap,
  generateConcertSeatingMap,
  generateZoneSeatingMap,
  detectVenueBlueprint,
  generateVenueSeatingMapByBlueprint,
};

// 100% Strict Real-Time Catalog: Zero fallback mock data or cached static lists
export const LIVE_WEBOOK_CATALOG: WebookEvent[] = [];

export interface WebookSyncStatus {
  lastSyncTimestamp: string;
  isSyncing: boolean;
  totalEventsSynced: number;
  activeSessions: number;
  connectedToWebookApi: boolean;
  syncIntervalSeconds: number;
  isPollingActive: boolean;
  lastPolledTimestamp?: string;
  newReleasesCount?: number;
  lastError?: string | null;
}

class WebookSyncManager {
  private events: WebookEvent[] = [];
  private listeners: ((events: WebookEvent[], status: WebookSyncStatus) => void)[] = [];
  private pollIntervalId: any = null;
  private newReleaseListeners: ((newEvents: WebookEvent[]) => void)[] = [];
  private status: WebookSyncStatus = {
    lastSyncTimestamp: 'قيد الاتصال بالمنصة الرسمية...',
    isSyncing: true,
    totalEventsSynced: 0,
    activeSessions: 1,
    connectedToWebookApi: true,
    syncIntervalSeconds: 30,
    isPollingActive: false,
    newReleasesCount: 0,
    lastError: null,
  };

  constructor() {
    // Automatically trigger official live catalog fetch on instantiation
    setTimeout(() => {
      const savedToken = typeof window !== 'undefined' ? localStorage.getItem('webook_bearer_token') || undefined : undefined;
      this.fetchAllEventsWithPagination(savedToken);
    }, 50);
  }

  public getEvents(): WebookEvent[] {
    return this.events;
  }

  public getStatus(): WebookSyncStatus {
    return this.status;
  }

  public async addCustomWebookEvent(url: string, token?: string): Promise<WebookEvent> {
    const synced = await this.syncEventWithOfficialWebook(url, token);
    if (!synced) {
      throw new Error(`الفعالية (${url}) غير متاحة في خوادم Webook الرسمية.`);
    }
    return synced;
  }

  /**
   * Fetches the official live catalog directly from Webook's API proxy in real-time.
   * Zero static mock data or cached catalogs.
   */
  public async fetchAllEventsWithPagination(
    token?: string,
    onProgress?: (loaded: number, total: number) => void
  ): Promise<WebookEvent[]> {
    this.status.isSyncing = true;
    this.status.lastError = null;
    this.notify();

    try {
      const cleanToken = token?.trim() || (typeof window !== 'undefined' ? localStorage.getItem('webook_bearer_token')?.trim() : undefined);
      const headers: Record<string, string> = { 'Accept': 'application/json' };
      if (cleanToken) {
        headers['Authorization'] = `Bearer ${cleanToken}`;
      }

      console.log('[WEBOOK SYNC MANAGER] Fetching live official catalog from Webook API...');
      const response = await fetch('/api/webook/live-catalog?all=true', {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => null);
        throw new Error(errJson?.message || `Webook API HTTP ${response.status}`);
      }

      const json = await response.json();
      if (json && json.success && Array.isArray(json.data)) {
        const rawList = json.data;
        const total = json.count || rawList.length;

        const processedEvents: WebookEvent[] = rawList.map((raw: any) => {
          const bp = (raw.venueBlueprint as VenueBlueprintId) || 
            detectVenueBlueprint(`${raw.title || ''} ${raw.titleAr || ''} ${raw.slug || ''}`, raw.locationAr || raw.location || '', raw.category || '');
          const seatingMap = generateVenueSeatingMapByBlueprint(bp, raw.locationAr || raw.titleAr, raw.tiers || []);

          return {
            ...raw,
            id: raw.id || raw.slug,
            slug: raw.slug || raw.id,
            title: raw.title || raw.titleAr,
            titleAr: raw.titleAr || raw.title,
            url: raw.url || `https://webook.com/ar/events/${raw.slug || raw.id}`,
            category: raw.category || 'فعاليات Webook الرسمية',
            location: raw.location || 'Saudi Arabia',
            locationAr: raw.locationAr || 'المملكة العربية السعودية',
            date: raw.date || raw.start_date_time_str || 'متاح للحجز الفوري',
            datesAvailable: Array.isArray(raw.datesAvailable) ? raw.datesAvailable : [],
            timesAvailable: Array.isArray(raw.timesAvailable) ? raw.timesAvailable : [],
            image: raw.image || raw.poster || 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?q=80&w=800&auto=format&fit=crop',
            tiers: raw.tiers || [],
            seatingMap,
            isHot: Boolean(raw.isHot),
            newRelease: Boolean(raw.newRelease),
            venueType: raw.venueType,
            isSeated: Boolean(raw.isSeated),
            bookingSeatsWithoutMap: Boolean(raw.bookingSeatsWithoutMap),
            teams: raw.teams,
            subEvents: raw.subEvents,
          };
        });

        this.events = processedEvents;
        this.status.totalEventsSynced = this.events.length;
        this.status.lastSyncTimestamp = new Date().toLocaleTimeString('ar-SA');
        this.status.connectedToWebookApi = true;
        if (onProgress) onProgress(processedEvents.length, total);
        console.log(`[WEBOOK SYNC MANAGER] Live catalog synchronized: ${this.events.length} real events loaded.`);
      }
    } catch (err: any) {
      console.warn('[WEBOOK SYNC MANAGER] Failed to fetch live catalog:', err.message);
      this.status.connectedToWebookApi = false;
      this.status.lastError = err.message;
    } finally {
      this.status.isSyncing = false;
      this.notify();
    }

    return this.events;
  }

  /**
   * Starts real-time periodic synchronization with Webook API
   */
  public startRealtimePolling(intervalMs: number = 30000) {
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
    }

    this.status.isPollingActive = true;
    this.status.syncIntervalSeconds = Math.round(intervalMs / 1000);
    this.notify();

    console.log(`[WEBOOK REAL-TIME POLLING] Started continuous interval sync (${intervalMs}ms)...`);

    this.pollIntervalId = setInterval(async () => {
      try {
        const cleanToken = typeof window !== 'undefined' ? localStorage.getItem('webook_bearer_token')?.trim() : undefined;
        await this.fetchAllEventsWithPagination(cleanToken);
      } catch (err: any) {
        console.warn('[WEBOOK REAL-TIME POLLING] Poll error:', err.message);
      }
    }, intervalMs);
  }

  public stopRealtimePolling() {
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
    this.status.isPollingActive = false;
    this.notify();
    console.log('[WEBOOK REAL-TIME POLLING] Stopped.');
  }

  public isPollingActive(): boolean {
    return this.status.isPollingActive;
  }

  public onNewRelease(callback: (newEvents: WebookEvent[]) => void): () => void {
    this.newReleaseListeners.push(callback);
    return () => {
      this.newReleaseListeners = this.newReleaseListeners.filter((cb) => cb !== callback);
    };
  }

  public forceSyncNow(): void {
    const cleanToken = typeof window !== 'undefined' ? localStorage.getItem('webook_bearer_token')?.trim() : undefined;
    this.fetchAllEventsWithPagination(cleanToken);
  }

  /**
   * Syncs an official event directly from Webook API by slug or URL.
   * Zero mock fallbacks.
   */
  public async syncEventWithOfficialWebook(slugOrUrl: string, token?: string): Promise<WebookEvent | null> {
    try {
      this.status.isSyncing = true;
      this.notify();

      let targetSlug = (slugOrUrl || '').trim();
      const match = targetSlug.match(/events\/([^/?#]+)/) || targetSlug.match(/\/([a-zA-Z0-9_\-]+)$/);
      if (match) {
        targetSlug = match[1];
      }
      targetSlug = targetSlug.replace(/^https?:\/\/[^/]+\//, '').replace(/\//g, '-').replace(/\/book$/, '');

      const cleanToken = token?.trim() || (typeof window !== 'undefined' ? localStorage.getItem('webook_bearer_token')?.trim() : undefined);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (cleanToken) {
        headers['Authorization'] = `Bearer ${cleanToken}`;
      }

      const res = await fetch(`/api/webook/sync-event`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ slug: targetSlug, url: slugOrUrl }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.message || `HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data && data.success && data.event) {
        const raw = data.event;
        const blueprint = (raw.venueBlueprint as VenueBlueprintId) || detectVenueBlueprint(`${raw.title || ''} ${raw.slug || ''}`, raw.locationAr || '', raw.category || '');
        const seatingMap = generateVenueSeatingMapByBlueprint(blueprint, raw.locationAr || raw.titleAr, raw.tiers);

        const updatedEvent: WebookEvent = {
          ...raw,
          seatingMap,
          isHot: true,
        };

        const existingIdx = this.events.findIndex(e => e.slug === updatedEvent.slug || e.id === updatedEvent.id);
        if (existingIdx >= 0) {
          this.events[existingIdx] = updatedEvent;
        } else {
          this.events = [updatedEvent, ...this.events];
        }

        this.status.lastSyncTimestamp = new Date().toLocaleTimeString('ar-SA');
        this.status.totalEventsSynced = this.events.length;
        this.notify();
        return updatedEvent;
      }
      return null;
    } catch (err: any) {
      console.error('Failed to sync event with official Webook:', err);
      throw err;
    } finally {
      this.status.isSyncing = false;
      this.notify();
    }
  }

  public subscribe(callback: (events: WebookEvent[], status: WebookSyncStatus) => void): () => void {
    this.listeners.push(callback);
    callback(this.events, this.status);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  private notify() {
    this.listeners.forEach((cb) => cb(this.events, this.status));
  }
}

export const webookSyncManager = new WebookSyncManager();
