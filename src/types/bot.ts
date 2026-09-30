export interface Seat {
  id: string;
  row: string;
  number: number;
  label: string;
  tierId: 'vip' | 'regular' | 'cat1' | 'cat2' | 'cat3' | 'gold' | string;
  tierNameAr: string;
  price: number;
  status: 'available' | 'reserved' | 'selected' | 'held';
  section?: string;
  x?: number;
  y?: number;
}

export interface SeatingSection {
  id: string;
  nameAr: string;
  nameEn: string;
  tierId: string;
  color: string;
  capacity: number;
  availableCount: number;
  price: number;
  rows: string[];
}

export type VenueBlueprintId = 
  | 'kingdom_arena'
  | 'alawwal_park'
  | 'aljawhara'
  | 'mohammed_abdo_arena'
  | 'bakr_sheddi'
  | 'boxing_ring'
  | 'equestrian'
  | 'boulevard_world'
  | 'general_stadium'
  | 'general_theater';

export interface SeatingMapData {
  type: 'theater' | 'stadium' | 'concert' | 'zone' | string;
  venueId?: VenueBlueprintId;
  venueNameAr?: string;
  stageLabelAr: string;
  totalSeats: number;
  availableSeats: number;
  sections: SeatingSection[];
  seats: Seat[];
}

export interface Account {
  id: string;
  email: string;
  password: string;
  name?: string;
  status: 'idle' | 'ready' | 'logging_in' | 'active' | 'success' | 'error';
  lastLog?: string;
  ticketsReserved?: number;
  webookSessionToken?: string;
  authToken?: string;
  refreshToken?: string;
  isRealToken?: boolean;
  authError?: string;
  customAuthPayload?: string;
  webookCookies?: string;
}

export interface ReservationFallbackPayload {
  cartId?: string;
  holdExpiresAt?: string;
  totalPrice?: number;
  seats?: Array<{ id: string; label?: string; price?: number; row?: string; number?: number }>;
  directBookingUrl?: string;
  directCheckoutUrl?: string;
  isCustomPayload?: boolean;
  customRawJson?: string;
}

export interface ReservationErrorState {
  hasError: boolean;
  message: string;
  endpoint: string;
  requestPayload?: any;
  rawError?: any;
  timestamp?: string;
}

export interface TicketTier {
  id: string;
  name: string;
  nameAr: string;
  price: number;
  available: boolean;
  remaining?: number;
  description?: string;
  color?: string;
}

export interface TeamInfo {
  name: string;
  nameAr: string;
  logo?: string;
  color?: string;
}

export interface SubEvent {
  id: string;
  title: string;
  titleAr: string;
  date: string;
  time: string;
  teams?: {
    home: TeamInfo;
    away: TeamInfo;
  };
  venueName?: string;
  venueNameAr?: string;
}

export interface WebookEvent {
  id: string;
  title: string;
  titleAr: string;
  slug: string;
  url: string;
  category: string;
  location: string;
  locationAr: string;
  date: string;
  datesAvailable: string[];
  timesAvailable: string[];
  image: string;
  bannerImage?: string;
  descriptionAr?: string;
  descriptionEn?: string;
  organizer?: string;
  ageRestriction?: string;
  termsAr?: string[];
  tiers: TicketTier[];
  isHot?: boolean;
  newRelease?: boolean;
  venueType?: string;
  isSeated?: boolean;
  bookingSeatsWithoutMap?: boolean;
  seatingMap: SeatingMapData;
  subEvents?: SubEvent[];
  teams?: {
    home: TeamInfo;
    away: TeamInfo;
  };
  selectedTeam?: 'home' | 'away' | 'neutral';
}

export interface DynamicPipelineStepConfig {
  id: string;
  stepNumber: PipelineStepNumber;
  name: string;
  nameAr: string;
  badgeAr: string;
  descriptionAr: string;
  isMandatory: boolean;
  isApplicable: boolean;
}

export interface EventJsonSchema {
  isSeated: boolean;
  bookingSeatsWithoutMap: boolean;
  hasTeams: boolean;
  hasSubEvents: boolean;
  hasTimeSlots: boolean;
  hasMultipleDates: boolean;
  teams?: {
    home: TeamInfo;
    away: TeamInfo;
  };
  timeSlotsCount: number;
  datesCount: number;
  subEventsCount: number;
  tiersCount: number;
  requiredSteps: DynamicPipelineStepConfig[];
}

export type PipelineStepNumber = number;

export interface PipelineStepLog {
  step: PipelineStepNumber;
  status: 'idle' | 'running' | 'success' | 'error';
  title: string;
  titleAr: string;
  endpoint?: string;
  method?: 'GET' | 'POST';
  requestHeaders?: Record<string, string>;
  requestPayload?: any;
  responsePayload?: any;
  statusCode?: number;
  message?: string;
  timestamp: string;
}

export interface ActiveCartSession {
  cartId: string;
  holdToken?: string;
  sessionToken?: string;
  expiresAt: string;
  totalPrice: number;
  currency: string;
  seats: Seat[];
  tierName?: string;
  ticketQuantity: number;
  dynamicCheckoutUrl: string;
  directBookingUrl: string;
  selectedDate: string;
  selectedTime: string;
  selectedTeam?: string;
  selectedSubEvent?: SubEvent;
  isRealPlatformCart?: boolean;
  status: 'active' | 'expired' | 'released';
}

export interface BotConfig {
  targetEventUrl: string;
  selectedEventId: string;
  selectedDate: string;
  selectedTime: string;
  preferredTier: string;
  ticketQuantity: number;
  maxBudget: number;
  mode: 'sniper' | 'stealth' | 'normal';
  headless: boolean;
  typingDelayMs: number;
  retryIntervalMs: number;
  autoSolveTurnstile: boolean;
  notifyTelegram: boolean;
  telegramBotToken: string;
  telegramChatId: string;
  proxyEnabled: boolean;
  proxyUrl: string;
  keepBrowserOpenOnReserve: boolean;
}

export interface BotLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success' | 'bot';
  message: string;
  accountId?: string;
  step?: string;
}

export type BotState = 'idle' | 'running' | 'paused' | 'success' | 'failed';

export type BotStep = 
  | 'init_driver'
  | 'navigate_login'
  | 'fill_credentials'
  | 'verify_auth'
  | 'navigate_event'
  | 'select_date'
  | 'load_seating_map'
  | 'select_ticket_tier'
  | 'add_tickets'
  | 'pick_exact_seats'
  | 'click_reserve'
  | 'checkout_success'
  | 'hold_cart_success';
