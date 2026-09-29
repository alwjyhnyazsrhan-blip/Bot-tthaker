import { DynamicEventWorkflowSchema, DynamicWorkflowStep } from '../types/schema';
import { WebookEvent } from '../types/bot';

export class SchemaWorkflowService {
  /**
   * Fetches the dynamic workflow schema from the official platform API proxy
   */
  async fetchEventWorkflowSchema(slug: string, fallbackEvent?: WebookEvent): Promise<DynamicEventWorkflowSchema> {
    try {
      const response = await fetch(`/api/webook/event-workflow-schema/${encodeURIComponent(slug)}`);
      if (response.ok) {
        const json = await response.json();
        if (json && json.success && json.data) {
          return json.data as DynamicEventWorkflowSchema;
        }
      }
    } catch (err) {
      console.warn('[SchemaWorkflowService] Server endpoint failed, falling back to local schema parser:', err);
    }

    if (fallbackEvent) {
      return this.parseEventToSchema(fallbackEvent);
    }

    throw new Error(`Failed to load schema for event: ${slug}`);
  }

  /**
   * Client-side parser that generates dynamic schema from any WebookEvent structure
   */
  parseEventToSchema(event: WebookEvent): DynamicEventWorkflowSchema {
    const isSeated = Boolean(event.isSeated ?? (event.seatingMap && event.seatingMap.seats && event.seatingMap.seats.length > 0));
    const hasTeams = Boolean(event.teams && event.teams.home && event.teams.away);
    const hasSubEvents = Boolean(event.subEvents && event.subEvents.length > 1);
    const dates = event.datesAvailable?.length ? event.datesAvailable : ['2026-10-15', '2026-10-16'];
    const times = event.timesAvailable?.length ? event.timesAvailable : ['18:00 - 20:30', '20:30 - 23:00'];
    const tiers = event.tiers?.length ? event.tiers : [
      { id: 'regular', name: 'Regular Entry', nameAr: 'تذكرة الدخول الأساسية', price: 65, available: true }
    ];

    const steps: DynamicWorkflowStep[] = [];
    let stepNumber = 1;

    // 1. Sync & Auth
    steps.push({
      id: 'step_catalog_sync',
      stepNumber: stepNumber++,
      type: 'catalog_sync',
      title: 'Platform Verification & Auth',
      titleAr: 'التحقق من الفعالية وحساب المنصة',
      badgeAr: 'التوثيق الرسمي',
      descriptionAr: 'مطابقة الفعالية مع خوادم Webook الرسمية والتحقق من رمز التوثيق (Bearer Token) أو جلسة الزائر.',
      iconName: 'ShieldCheck',
      endpoint: `/api/webook/real-event/${event.slug || event.id}`,
      method: 'GET',
      isRequired: true,
      fields: [
        {
          id: 'authToken',
          name: 'authToken',
          label: 'Authorization Token',
          labelAr: 'رمز توثيق الحساب (Bearer Token)',
          descriptionAr: 'يتم التقاطه تلقائياً من الحساب النشط أو تركه لجلسة حجز مباشر',
          type: 'token_input',
          required: false,
        },
        {
          id: 'eventSlug',
          name: 'eventSlug',
          label: 'Event Slug',
          labelAr: 'رمز الفعالية الموثق',
          type: 'text',
          required: true,
          defaultValue: event.slug || event.id,
        }
      ]
    });

    // 2. Teams Selection (Sports only)
    if (hasTeams && event.teams) {
      steps.push({
        id: 'step_team_selection',
        stepNumber: stepNumber++,
        type: 'team_stand_selection',
        title: 'Select Supported Team & Stand',
        titleAr: 'اختيار الفريق ومدرج المشجعين',
        badgeAr: 'مباراة رياضية',
        descriptionAr: 'بناءً على مخطط المباراة، يلزم تحديد جهة المشجعين (المضيف أو الضيف أو المنصة المحايدة).',
        iconName: 'Trophy',
        isRequired: true,
        fields: [
          {
            id: 'selectedTeam',
            name: 'selectedTeam',
            label: 'Supported Team',
            labelAr: 'الفريق المستهدف / جهة المدرج',
            descriptionAr: 'يحدد المدرج وبوابة الدخول الخاصة بالمشجعين',
            type: 'team_selector',
            required: true,
            defaultValue: 'home',
            options: [
              { value: 'home', label: event.teams.home.name, labelAr: event.teams.home.nameAr, color: event.teams.home.color || '#2563eb' },
              { value: 'away', label: event.teams.away.name, labelAr: event.teams.away.nameAr, color: event.teams.away.color || '#dc2626' },
              { value: 'neutral', label: 'Neutral / VIP Stand', labelAr: 'المنصة المحايدة / مقصورات VIP', color: '#9333ea' }
            ]
          }
        ]
      });
    }

    // 3. Fixtures / Sub-Events
    if (hasSubEvents && event.subEvents) {
      steps.push({
        id: 'step_fixture_selection',
        stepNumber: stepNumber++,
        type: 'fixture_selection',
        title: 'Select Match Fixture / Session',
        titleAr: 'تحديد الجولة أو الجلسة الفرعية',
        badgeAr: 'عروض وجولات متعددة',
        descriptionAr: 'الفعالية تتضمن جولات أو جلسات متعددة، اختر الجلسة المستهدفة للحجز.',
        iconName: 'Layers',
        isRequired: true,
        fields: [
          {
            id: 'selectedSubEventId',
            name: 'selectedSubEventId',
            label: 'Selected Sub-Event',
            labelAr: 'الجولة / الجلسة المحددة',
            type: 'fixture_selector',
            required: true,
            defaultValue: event.subEvents[0].id,
            options: event.subEvents.map(se => ({
              value: se.id,
              label: se.title,
              labelAr: se.titleAr,
              metadata: { date: se.date, time: se.time, venue: se.venueNameAr || se.venueName }
            }))
          }
        ]
      });
    }

    // 4. Date & Showtime
    steps.push({
      id: 'step_datetime_selection',
      stepNumber: stepNumber++,
      type: 'datetime_selection',
      title: 'Select Date & Showtime Slot',
      titleAr: 'تحديد تاريخ الحضور وفترة العرض',
      badgeAr: 'المواعيد المتاحة',
      descriptionAr: 'تحديد الموعد من قائمة الفترات الزمنية المصرحة من المنصة.',
      iconName: 'Calendar',
      isRequired: true,
      fields: [
        {
          id: 'selectedDate',
          name: 'selectedDate',
          label: 'Event Date',
          labelAr: 'تاريخ الفعالية',
          type: 'date_selector',
          required: true,
          defaultValue: dates[0],
          options: dates.map(d => ({ value: d, label: d, labelAr: d }))
        },
        {
          id: 'selectedTime',
          name: 'selectedTime',
          label: 'Time Slot',
          labelAr: 'فترة الحضور / وقت الانطلاق',
          type: 'time_selector',
          required: true,
          defaultValue: times[0],
          options: times.map(t => ({ value: t, label: t, labelAr: t }))
        }
      ]
    });

    // 5. Seating Map OR Tier Selection
    if (isSeated) {
      steps.push({
        id: 'step_seating_selection',
        stepNumber: stepNumber++,
        type: 'seating_map_selection',
        title: 'Interactive Seating Map & Row Selection',
        titleAr: 'مخطط المقاعد وتحديد الصفوف والمقاعد الدقيقة',
        badgeAr: 'فعالية بمقاعد مرقمة (Seated)',
        descriptionAr: 'الفعالية تعتمد نظام حجز المقاعد الدقيقة (is_seated=true). قم باختيار المقاعد أو تفعيل القنص التلقائي.',
        iconName: 'MapPin',
        isRequired: true,
        fields: [
          {
            id: 'preferredTierId',
            name: 'preferredTierId',
            label: 'Preferred Seating Category',
            labelAr: 'فئة المقاعد المستهدفة',
            type: 'tier_selector',
            required: true,
            defaultValue: tiers[0]?.id || 'regular',
            options: tiers.map(t => ({
              value: t.id,
              label: t.name,
              labelAr: t.nameAr,
              price: t.price,
              color: t.color,
              available: t.available,
              remaining: t.remaining,
              description: t.description,
            }))
          },
          {
            id: 'selectedSeats',
            name: 'selectedSeats',
            label: 'Exact Chosen Seats',
            labelAr: 'المقاعد المحددة على المخطط',
            type: 'seating_map',
            required: true,
            defaultValue: [],
            min: 1,
            max: 10,
          }
        ]
      });
    } else {
      steps.push({
        id: 'step_tier_selection',
        stepNumber: stepNumber++,
        type: 'tier_selection',
        title: 'Select Ticket Tiers & Admission Passes',
        titleAr: 'فئات التذاكر وباقات الدخول العامة',
        badgeAr: 'دخول عام (General Admission)',
        descriptionAr: 'الفعالية تعتمد تذاكر الدخول العام بدون مقاعد مرقمة (is_seated=false). حدد الفئة وعدد التذاكر.',
        iconName: 'Ticket',
        isRequired: true,
        fields: [
          {
            id: 'selectedTierId',
            name: 'selectedTierId',
            label: 'Ticket Tier',
            labelAr: 'فئة التذكرة / الباقة',
            type: 'tier_selector',
            required: true,
            defaultValue: tiers[0]?.id || 'regular',
            options: tiers.map(t => ({
              value: t.id,
              label: t.name,
              labelAr: t.nameAr,
              price: t.price,
              color: t.color,
              available: t.available,
              remaining: t.remaining,
              description: t.description,
            }))
          },
          {
            id: 'ticketQuantity',
            name: 'ticketQuantity',
            label: 'Ticket Quantity',
            labelAr: 'عدد التذاكر المطلوبة',
            type: 'quantity_counter',
            required: true,
            defaultValue: 2,
            min: 1,
            max: 10,
          }
        ]
      });
    }

    // 6. Cart Lock
    steps.push({
      id: 'step_cart_hold',
      stepNumber: stepNumber++,
      type: 'cart_execution',
      title: 'POST Add to Cart & Hold Seats',
      titleAr: 'إرسال طلب POST وقفل المقاعد بالسلة النشطة',
      badgeAr: 'حجز مؤقت 10 دقائق',
      descriptionAr: 'تنفيذ طلب POST الرسمي لحجز التذاكر واستخراج معرف السلة المعتمد (cart_id).',
      iconName: 'ShoppingCart',
      endpoint: '/api/webook/cart/add',
      method: 'POST',
      isRequired: true,
      fields: []
    });

    // 7. Dynamic Checkout
    steps.push({
      id: 'step_checkout_url',
      stepNumber: stepNumber++,
      type: 'dynamic_checkout',
      title: 'Dynamic Anti-404 Checkout URL',
      titleAr: 'رابط الدفع الديناميكي الموثق (بدون 404)',
      badgeAr: 'رابط رسمي مباشر',
      descriptionAr: 'توليد رابط الدفع المشفر الحاوي لمعرف السلة النشط (cart_id) للانتقال الفوري للدفع.',
      iconName: 'ShieldCheck',
      endpoint: '/api/webook/checkout-url',
      method: 'POST',
      isRequired: true,
      fields: []
    });

    const requiredPayloadKeys = [
      'parent_event_id',
      'type',
      'event_ticket_id',
      'quantity',
      'time_slot_date',
      'time_slot',
      'app_source',
      'lang'
    ];
    if (hasTeams) requiredPayloadKeys.push('metadata.team');
    if (isSeated) requiredPayloadKeys.push('metadata.selectedSeats');
    if (hasSubEvents) requiredPayloadKeys.push('metadata.subEvent');

    return {
      eventId: event.slug || event.id,
      eventSlug: event.slug || event.id,
      eventTitle: event.title,
      eventTitleAr: event.titleAr,
      category: event.category,
      venueName: event.locationAr || event.location,
      isSeated,
      hasTeams,
      hasSubEvents,
      hasMultipleDates: dates.length > 1,
      hasMultipleTimes: times.length > 1,
      totalSteps: steps.length,
      steps,
      requiredPayloadKeys,
      schemaGeneratedAt: new Date().toISOString(),
      payloadTemplate: {
        parent_event_id: event.slug || event.id,
        type: 'ticket',
        event_ticket_id: '{{event_ticket_id}}',
        quantity: '{{quantity}}',
        time_slot_date: '{{time_slot_date}}',
        time_slot: '{{time_slot}}',
        app_source: 'web',
        lang: 'ar',
        metadata: {
          team: hasTeams ? '{{team}}' : undefined,
          selectedSeats: isSeated ? '{{selectedSeatsJson}}' : undefined,
          subEvent: hasSubEvents ? '{{subEventTitle}}' : undefined,
        }
      },
      rawApiSchemaSnippet: {
        title: event.title,
        slug: event.slug || event.id,
        is_seated: isSeated,
        tickets_count: tiers.length,
        has_teams: hasTeams,
        sub_events_count: event.subEvents?.length || 0,
      }
    };
  }

  /**
   * Constructs the live dynamic request payload according to the event schema
   */
  buildDynamicPayload(schema: DynamicEventWorkflowSchema, values: Record<string, any>): Record<string, any> {
    const slug = schema.eventSlug || values.eventSlug;
    const effectiveTicketId = values.preferredTierId || values.selectedTierId || 'regular';
    const effectiveSeats = Array.isArray(values.selectedSeats) ? values.selectedSeats : [];
    const effectiveQty = schema.isSeated
      ? (effectiveSeats.length > 0 ? effectiveSeats.length : Number(values.ticketQuantity) || 2)
      : (Number(values.ticketQuantity) || 1);

    const payload: Record<string, any> = {
      parent_event_id: slug,
      type: 'ticket',
      event_ticket_id: effectiveTicketId,
      quantity: effectiveQty,
      time_slot_date: values.selectedDate || '2026-10-15',
      time_slot: values.selectedTime || '20:00 - 23:00',
      app_source: 'web',
      lang: 'ar',
      metadata: {}
    };

    if (schema.hasTeams && values.selectedTeam) {
      payload.metadata.team = values.selectedTeam;
    }

    if (schema.isSeated && effectiveSeats.length > 0) {
      payload.metadata.selectedSeats = JSON.stringify(effectiveSeats);
      payload.seats = effectiveSeats;
    }

    if (schema.hasSubEvents && values.selectedSubEventId) {
      payload.metadata.subEventId = values.selectedSubEventId;
    }

    // Clean up empty metadata
    if (Object.keys(payload.metadata).length === 0) {
      delete payload.metadata;
    }

    // Top-level helpers for API compatibility
    payload.eventId = slug;
    payload.slug = slug;
    payload.selectedDate = payload.time_slot_date;
    payload.selectedTime = payload.time_slot;
    if (values.selectedTeam) payload.selectedTeam = values.selectedTeam;
    if (values.email) payload.email = values.email;
    if (values.authToken) payload.authToken = values.authToken;

    return payload;
  }
}

export const schemaWorkflowService = new SchemaWorkflowService();
