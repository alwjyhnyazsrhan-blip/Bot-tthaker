export type WorkflowStepType = 
  | 'catalog_sync'
  | 'team_stand_selection'
  | 'fixture_selection'
  | 'datetime_selection'
  | 'seating_map_selection'
  | 'tier_selection'
  | 'cart_execution'
  | 'dynamic_checkout'
  | 'payment_verification'
  | 'checkout_payment'
  | 'booking_confirmation';

export interface WorkflowFieldOption {
  value: string;
  label: string;
  labelAr: string;
  price?: number;
  color?: string;
  available?: boolean;
  remaining?: number;
  description?: string;
  metadata?: Record<string, any>;
}

export interface WorkflowFieldSchema {
  id: string;
  name: string;
  label: string;
  labelAr: string;
  descriptionAr?: string;
  type: 
    | 'team_selector'
    | 'fixture_selector'
    | 'date_selector'
    | 'time_selector'
    | 'seating_map'
    | 'tier_selector'
    | 'quantity_counter'
    | 'text'
    | 'token_input'
    | 'select';
  required: boolean;
  defaultValue?: any;
  options?: WorkflowFieldOption[];
  min?: number;
  max?: number;
  helpText?: string;
}

export interface DynamicWorkflowStep {
  id: string;
  stepNumber: number;
  type: WorkflowStepType;
  title: string;
  titleAr: string;
  badgeAr: string;
  descriptionAr: string;
  iconName: string;
  endpoint?: string;
  method?: 'GET' | 'POST';
  isRequired: boolean;
  fields: WorkflowFieldSchema[];
  status?: 'idle' | 'running' | 'success' | 'error' | 'skipped';
  log?: {
    timestamp?: string;
    requestHeaders?: Record<string, string>;
    requestPayload?: any;
    responsePayload?: any;
    statusCode?: number;
    message?: string;
    endpoint?: string;
    method?: string;
  };
}

export interface DynamicEventWorkflowSchema {
  eventId: string;
  eventSlug: string;
  eventTitle: string;
  eventTitleAr: string;
  category: string;
  venueName: string;
  isSeated: boolean;
  hasTeams: boolean;
  hasSubEvents: boolean;
  hasMultipleDates: boolean;
  hasMultipleTimes: boolean;
  seatsProvider?: string;
  seatsIoConfig?: any;
  schemaGeneratedAt: string;
  sourceEndpoint?: string;
  totalSteps: number;
  steps: DynamicWorkflowStep[];
  requiredPayloadKeys: string[];
  payloadTemplate: Record<string, any>;
  rawApiSchemaSnippet?: Record<string, any>;
}

export interface SchemaWorkflowState {
  currentStepIndex: number;
  values: {
    authToken: string;
    eventSlug: string;
    selectedTeam?: 'home' | 'away' | 'neutral' | string;
    selectedSubEventId?: string;
    selectedDate: string;
    selectedTime: string;
    preferredTierId: string;
    selectedTierId?: string;
    selectedSeats: any[];
    ticketQuantity: number;
    [key: string]: any;
  };
  cartSession: {
    cartId?: string;
    sessionToken?: string;
    expiresAt?: string;
    totalPrice?: number;
    dynamicCheckoutUrl?: string;
    directBookingUrl?: string;
    active: boolean;
    rawPayload?: any;
  } | null;
  stepLogs: Record<string, {
    status: 'idle' | 'running' | 'success' | 'error' | 'skipped';
    timestamp?: string;
    endpoint?: string;
    method?: string;
    requestPayload?: any;
    responsePayload?: any;
    statusCode?: number;
    message?: string;
  }>;
}
