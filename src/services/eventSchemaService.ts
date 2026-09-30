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

  // Dynamically tailor the workflow steps according to the active event's schema data:
  const requiredSteps: DynamicPipelineStepConfig[] = [];
  let currentStepNum = 1;

  // 1. Teams & Fan Stand (Sports matches with opposing teams only)
  if (hasTeams && event.teams) {
    requiredSteps.push({
      id: 'step_team_selection',
      stepNumber: currentStepNum++,
      name: 'Select Match Teams & Fan Section',
      nameAr: 'اختيار الفريق ومدرج المشجعين',
      badgeAr: `مواجهة فرق: ${event.teams?.home.nameAr} ضد ${event.teams?.away.nameAr}`,
      descriptionAr: `الفعالية عبارة عن مباراة كرة قدم رسمية تتطلب تحديد جهة المشجعين (${event.teams?.home.nameAr} أو ${event.teams?.away.nameAr})`,
      isMandatory: true,
      isApplicable: true,
    });
  }

  // 2. Sub-events / Fixtures (Only if genuine multi-fixture / sub-events exist)
  if (hasSubEvents && subEvents.length > 1) {
    requiredSteps.push({
      id: 'step_fixture_selection',
      stepNumber: currentStepNum++,
      name: 'Select Tournament Sub-event / Fixture',
      nameAr: 'تحديد الجولة أو الجلسة الفرعية',
      badgeAr: `${subEvents.length} عروض وجولات فرعية`,
      descriptionAr: `تتضمن الفعالية ${subEvents.length} جولات فرعية تتطلب اختيار الجولة والوقت المناسب`,
      isMandatory: true,
      isApplicable: true,
    });
  }

  // 3. Date & Showtime Slot (Only if multiple dates or time slots exist)
  if (hasMultipleDates || hasTimeSlots) {
    requiredSteps.push({
      id: 'step_datetime_selection',
      stepNumber: currentStepNum++,
      name: 'Select Event Date & Time Slot',
      nameAr: 'تحديد موعد وتاريخ الفعالية الرسمي',
      badgeAr: 'المواعيد المتاحة',
      descriptionAr: 'تحديد يوم وتوقيت الفعالية من بين المواعيد المتاحة على المنصة',
      isMandatory: true,
      isApplicable: true,
    });
  }

  // 4. Seating Map OR Tier Selection
  if (isSeated && !bookingSeatsWithoutMap) {
    requiredSteps.push({
      id: 'step_seating_selection',
      stepNumber: currentStepNum++,
      name: 'Fetch Seating Map & Pick Exact Seats',
      nameAr: 'مخطط المقاعد وتحديد الصفوف والمقاعد الدقيقة',
      badgeAr: 'مخطط مقاعد رقمي تفاعلي (Seated Venue)',
      descriptionAr: 'القاعة تتطلب ترقيماً دقيقاً للمقاعد (is_seated: true). يتم جلب المخطط وتحديد المقاعد بالصف والعمود',
      isMandatory: true,
      isApplicable: true,
    });
  } else {
    requiredSteps.push({
      id: 'step_tier_selection',
      stepNumber: currentStepNum++,
      name: 'Fetch Pricing Tiers & Select Ticket Quantity',
      nameAr: 'فئات التذاكر وباقات الدخول العامة',
      badgeAr: 'دخول عام وتذاكر بدون مقاعد (General Admission)',
      descriptionAr: 'الفعالية دخول عام أو باقات بدون مخطط مقاعد (is_seated: false). يتم تحديد فئة التذكرة والكمية فوراً',
      isMandatory: true,
      isApplicable: true,
    });
  }

  // 5. Checkout & Official Payment
  requiredSteps.push({
    id: 'step_checkout_payment',
    stepNumber: currentStepNum++,
    name: 'Order Review & Official PayTabs Checkout',
    nameAr: 'مراجعة الطلب وبوابة PayTabs الرسمية',
    badgeAr: 'الدفع المباشر المعتمد (Zero 404)',
    descriptionAr: 'مراجعة تفاصيل التذاكر، قفل المقاعد فورياً في خوادم Webook الرسمية (10 دقائق)، والتحويل الفوري لبوابة PayTabs السعودية المعتمدة',
    isMandatory: true,
    isApplicable: true,
  });

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
