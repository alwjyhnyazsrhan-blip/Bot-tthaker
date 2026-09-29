import { WebookEvent, EventJsonSchema, DynamicPipelineStepConfig, PipelineStepNumber } from '../types/bot';

/**
 * Parses the event's raw or enriched JSON schema to dynamically determine
 * the exact sequence and configuration of checkout workflow steps.
 */
export function parseEventJsonSchema(event: WebookEvent): EventJsonSchema {
  const isSeated = Boolean(event.isSeated);
  const bookingSeatsWithoutMap = Boolean(event.bookingSeatsWithoutMap);
  const hasTeams = Boolean(event.teams && event.teams.home && event.teams.away);
  const subEvents = event.subEvents || [];
  const hasSubEvents = subEvents.length > 0;
  const timeSlots = event.timesAvailable || [];
  const dates = event.datesAvailable || [];
  const hasTimeSlots = timeSlots.length > 1;
  const hasMultipleDates = dates.length > 1;
  const tiers = event.tiers || [];

  // Dynamically tailor the 5 steps according to the JSON schema:
  const requiredSteps: DynamicPipelineStepConfig[] = [
    {
      id: 'step_catalog',
      stepNumber: 1,
      name: 'Fetch Catalog & Event Schema',
      nameAr: 'استرجاع دليل الفعاليات ومخطط الـ JSON',
      badgeAr: 'بيانات الفعالية الرسمية',
      descriptionAr: `التحقق من الفعالية (${event.slug}) وجلب خصائصها ومحددات الحجز عبر واجهة Webook الرسمية`,
      isMandatory: true,
      isApplicable: true,
    },
    {
      id: 'step_subevent_session',
      stepNumber: 2,
      name: hasTeams
        ? 'Select Match, Teams & Fan Section'
        : hasSubEvents
        ? 'Select Tournament Sub-event & Time Slot'
        : 'Select Event Date & Time Slot',
      nameAr: hasTeams
        ? 'تحديد المباراة، الفريق المفضل، ومدرج الجماهير'
        : hasSubEvents
        ? 'تحديد الجولة/العرض الفرعي وتوقيت الدخول'
        : 'تحديد موعد وتاريخ الفعالية الرسمي',
      badgeAr: hasTeams
        ? `مواجهة فرق: ${event.teams?.home.nameAr} ضد ${event.teams?.away.nameAr}`
        : hasSubEvents
        ? `${subEvents.length} عروض وجولات فرعية`
        : 'تاريخ وفترة الدخول',
      descriptionAr: hasTeams
        ? `الفعالية عبارة عن مباراة كرة قدم رسمية تتطلب تحديد جهة المشجعين (${event.teams?.home.nameAr} أو ${event.teams?.away.nameAr})`
        : hasSubEvents
        ? `تتضمن الفعالية ${subEvents.length} جولات فرعية تتطلب اختيار الجولة والوقت المناسب`
        : 'تحديد يوم وتوقيت الفعالية من بين المواعيد المتاحة على المنصة',
      isMandatory: true,
      isApplicable: true,
    },
    {
      id: 'step_seating_tiers',
      stepNumber: 3,
      name: isSeated && !bookingSeatsWithoutMap
        ? 'Fetch Seating Map & Pick Exact Seats'
        : 'Fetch Pricing Tiers & Select Ticket Quantity',
      nameAr: isSeated && !bookingSeatsWithoutMap
        ? 'جلب مخطط المقاعد واختيار مقاعد رقمية محددة'
        : 'جلب فئات الأسعار وتحديد كمية التذاكر وباقات الدخول',
      badgeAr: isSeated && !bookingSeatsWithoutMap
        ? 'مخطط مقاعد رقمي تفاعلي (Seated Venue)'
        : 'دخول عام وتذاكر بدون مقاعد (General Admission)',
      descriptionAr: isSeated && !bookingSeatsWithoutMap
        ? `القاعة تتطلب ترقيماً دقيقاً للمقاعد (is_seated: true). يتم جلب المخطط وتحديد المقاعد بالصف والعمود`
        : `الفعالية دخول عام أو باقات بدون مخطط مقاعد (is_seated: false). يتم تحديد فئة التذكرة والكمية فوراً`,
      isMandatory: true,
      isApplicable: true,
    },
    {
      id: 'step_cart_hold',
      stepNumber: 4,
      name: 'POST Add to Cart & Capture Session Cart ID',
      nameAr: 'إرسال طلب POST لحجز المقاعد واقتناص معرف السلة cart_id',
      badgeAr: 'طلب POST فعلي مع ترويسة التوثيق',
      descriptionAr: 'تنفيذ طلب POST حقيقي لنقطة نهاية السلة، والتقاط المعرف الرسمي cart_id ورمز الجلسة sessionToken',
      isMandatory: true,
      isApplicable: true,
    },
    {
      id: 'step_dynamic_checkout',
      stepNumber: 5,
      name: 'Generate Dynamic Checkout URL with Active cart_id',
      nameAr: 'توليد رابط الدفع الديناميكي الرسمي لمنع أخطاء 404',
      badgeAr: 'رابط دفع نشط وموثق 100%',
      descriptionAr: 'تكوين رابط الدفع المشفر الحامل لمعرف السلة النشط (cart_id) للانتقال المباشر وتفادي 404',
      isMandatory: true,
      isApplicable: true,
    },
  ];

  return {
    isSeated,
    bookingSeatsWithoutMap,
    hasTeams,
    hasSubEvents,
    hasTimeSlots,
    hasMultipleDates,
    teams: event.teams,
    timeSlotsCount: timeSlots.length,
    datesCount: dates.length,
    subEventsCount: subEvents.length,
    tiersCount: tiers.length,
    requiredSteps,
  };
}
