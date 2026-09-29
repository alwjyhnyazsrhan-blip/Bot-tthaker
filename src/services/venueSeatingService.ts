import { Seat, SeatingMapData, SeatingSection, TicketTier, VenueBlueprintId } from '../types/bot';

/**
 * Helper to get price and name from actual event tiers
 */
export function resolveTierInfo(
  eventTiers?: TicketTier[],
  preferredTierKey: string = 'regular',
  defaultFallbackPrice: number = 85,
  defaultNameAr: string = 'المقاعد العادية'
): { price: number; nameAr: string } {
  if (!eventTiers || eventTiers.length === 0) {
    return { price: defaultFallbackPrice, nameAr: defaultNameAr };
  }

  // Exact match
  const exact = eventTiers.find(
    (t) => t.id.toLowerCase() === preferredTierKey.toLowerCase()
  );
  if (exact) {
    return { price: exact.price, nameAr: exact.nameAr || exact.name };
  }

  // Fuzzy match
  const fuzzy = eventTiers.find(
    (t) =>
      t.id.toLowerCase().includes(preferredTierKey.toLowerCase()) ||
      t.nameAr.toLowerCase().includes(preferredTierKey.toLowerCase()) ||
      t.name.toLowerCase().includes(preferredTierKey.toLowerCase())
  );
  if (fuzzy) {
    return { price: fuzzy.price, nameAr: fuzzy.nameAr || fuzzy.name };
  }

  // Fallback to closest tier or first tier
  const first = eventTiers[0];
  return { price: first.price, nameAr: first.nameAr || first.name };
}

/**
 * Automatically detects the appropriate architectural venue blueprint
 * based on the event title, slug, venue location, or category.
 */
export function detectVenueBlueprint(
  nameOrSlug: string = '',
  locationAr: string = '',
  category: string = ''
): VenueBlueprintId {
  const combined = `${nameOrSlug} ${locationAr} ${category}`.toLowerCase();

  // 1. Boxing & Combat
  if (/boxing|ملاكمة|ufc|fight|نزال|ringside|heavyweight|حلبة/i.test(combined)) {
    return 'boxing_ring';
  }

  // 2. Equestrian & Horse Racing
  if (/racing|فروسية|خيل|ميدان الملك عبدالعزيز|equestrian|showjumping|tuwaiq-elite/i.test(combined)) {
    return 'equestrian';
  }

  // 3. Kingdom Arena
  if (/kingdom arena|المملكة أرينا|الهلال|hilal|riyadh derby/i.test(combined)) {
    return 'kingdom_arena';
  }

  // 4. Al Awwal Park
  if (/alawwal|al-awwal|الأول بارك|النصر|alnassr|nassr/i.test(combined)) {
    return 'alawwal_park';
  }

  // 5. Al Jawhara Stadium (Jeddah)
  if (/jawhara|al-jawhara|الجوهرة|الاتحاد|ittihad|ahli|الأهلي|جدة|king abdullah sports/i.test(combined)) {
    return 'aljawhara';
  }

  // 6. Mohammed Abdo Arena (Music & Concerts)
  if (/mohammed abdo|محمد عبده|concert|حفل|طرب|غناء|jalsat|جلسات|أنغام|رابح|ماجد المهندس/i.test(combined)) {
    return 'mohammed_abdo_arena';
  }

  // 7. Bakr Al-Sheddi / Abu Bakr Salem (Theaters & Plays)
  if (/sheddi|الشدي|abu bakr|أبو بكر سالم|theater|مسرح|مسرحية|comedy|كوميديا/i.test(combined)) {
    return 'bakr_sheddi';
  }

  // 8. Boulevard World / Zones
  if (/boulevard world|بوليفارد وورلد|wonder garden|وندر جاردن|zone|موسم الرياض/i.test(combined)) {
    return 'boulevard_world';
  }

  // Generic fallbacks
  if (/sport|match|دوري|مباراة|stadium|كأس/i.test(combined)) {
    return 'general_stadium';
  }

  if (/music|concert|orchestra|أوركسترا/i.test(combined)) {
    return 'mohammed_abdo_arena';
  }

  return 'general_theater';
}

// -------------------------------------------------------------
// 1. المملكة أرينا (Kingdom Arena) - الصالة الرياضية المغلقة الأفخم
// -------------------------------------------------------------
export function generateKingdomArenaSeatingMap(
  venueNameAr: string = 'المملكة أرينا (Kingdom Arena)',
  eventTiers?: TicketTier[]
): SeatingMapData {
  const tiers = eventTiers && eventTiers.length > 0 ? eventTiers : [
    { id: 'cat3', name: 'Cat 3', nameAr: 'الدرجة الثالثة (خلف المرمى)', price: 125, available: true },
    { id: 'cat1', name: 'Cat 1', nameAr: 'الدرجة الأولى (الواجهة الشرقية)', price: 350, available: true },
    { id: 'vip', name: 'VIP Gold', nameAr: 'المنصة الملكية VIP', price: 1200, available: true },
  ];

  const cat3Tier = resolveTierInfo(tiers, 'cat3', 125, 'الدرجة الثالثة (خلف المرمى)');
  const cat1Tier = resolveTierInfo(tiers, 'cat1', 350, 'الدرجة الأولى (الواجهة الشرقية)');
  const vipTier = resolveTierInfo(tiers, 'vip', 1200, 'المنصة الملكية وكبائن Skybox VIP');

  const seats: Seat[] = [];
  const sections: SeatingSection[] = [];

  // Skybox VIP West (كبائن المنصة الملكية V01 - V05)
  const vipRows = ['V01', 'V02', 'V03'];
  vipRows.forEach((row, rIdx) => {
    for (let num = 1; num <= 14; num++) {
      const isReserved = (rIdx === 0 && num % 2 === 0) || num === 7;
      seats.push({
        id: `ka-vip-${row}-${num}`,
        row,
        number: num,
        label: `${row}-${num}`,
        tierId: 'vip',
        tierNameAr: vipTier.nameAr,
        price: vipTier.price,
        status: isReserved ? 'reserved' : 'available',
        section: 'المملكة أرينا - كبائن المنصة الغربية VIP',
        x: num * 24,
        y: rIdx * 28,
      });
    }
  });

  sections.push({
    id: 'sec-ka-vip',
    nameAr: 'كبائن المنصة الذهبية والشرفية VIP (بلوكات V01 - V03)',
    nameEn: 'Kingdom Arena VIP Skyboxes (V01 - V03)',
    tierId: 'vip',
    color: '#f59e0b',
    capacity: vipRows.length * 14,
    availableCount: seats.filter((s) => s.tierId === 'vip' && s.status === 'available').length,
    price: vipTier.price,
    rows: vipRows,
  });

  // East Main Face (الواجهة الشرقية 101 - 104)
  const eastRows = ['E101', 'E102', 'E103', 'E104'];
  eastRows.forEach((row, rIdx) => {
    for (let num = 1; num <= 16; num++) {
      const isReserved = (num + rIdx) % 3 === 0;
      seats.push({
        id: `ka-east-${row}-${num}`,
        row,
        number: num,
        label: `${row}-${num}`,
        tierId: 'cat1',
        tierNameAr: cat1Tier.nameAr,
        price: cat1Tier.price,
        status: isReserved ? 'reserved' : 'available',
        section: 'المملكة أرينا - الواجهة المركزية المقابلة',
        x: num * 24,
        y: 100 + rIdx * 26,
      });
    }
  });

  sections.push({
    id: 'sec-ka-east',
    nameAr: 'الواجهة المركزية الأولى (بلوكات 101 - 104)',
    nameEn: 'East Central Main Stand (Blocks 101 - 104)',
    tierId: 'cat1',
    color: '#10b981',
    capacity: eastRows.length * 16,
    availableCount: seats.filter((s) => s.tierId === 'cat1' && s.status === 'available').length,
    price: cat1Tier.price,
    rows: eastRows,
  });

  // North Stand (مدرج القوة الزرقاء والألتراس خلف المرمى 115 - 118)
  const northRows = ['N115', 'N116', 'N117'];
  northRows.forEach((row, rIdx) => {
    for (let num = 1; num <= 14; num++) {
      const isReserved = num > 11 || (num + rIdx) % 4 === 0;
      seats.push({
        id: `ka-north-${row}-${num}`,
        row,
        number: num,
        label: `${row}-${num}`,
        tierId: 'cat3',
        tierNameAr: cat3Tier.nameAr,
        price: cat3Tier.price,
        status: isReserved ? 'reserved' : 'available',
        section: 'المملكة أرينا - مدرج الألتراس الشمالي',
        x: num * 24,
        y: 220 + rIdx * 26,
      });
    }
  });

  sections.push({
    id: 'sec-ka-north',
    nameAr: 'مدرج الألتراس الشمالي خلف المرمى (بلوكات 115 - 117)',
    nameEn: 'North Stand Ultras (Blocks 115 - 117)',
    tierId: 'cat3',
    color: '#06b6d4',
    capacity: northRows.length * 14,
    availableCount: seats.filter((s) => s.tierId === 'cat3' && s.status === 'available').length,
    price: cat3Tier.price,
    rows: northRows,
  });

  // South Stand (مدرج العائلات والجمهور 121 - 123)
  const southRows = ['S121', 'S122', 'S123'];
  southRows.forEach((row, rIdx) => {
    for (let num = 1; num <= 14; num++) {
      const isReserved = num === 4 || num === 9;
      seats.push({
        id: `ka-south-${row}-${num}`,
        row,
        number: num,
        label: `${row}-${num}`,
        tierId: 'cat3',
        tierNameAr: cat3Tier.nameAr,
        price: cat3Tier.price,
        status: isReserved ? 'reserved' : 'available',
        section: 'المملكة أرينا - مدرج العائلات الجنوبي',
        x: num * 24,
        y: 310 + rIdx * 26,
      });
    }
  });

  sections.push({
    id: 'sec-ka-south',
    nameAr: 'مدرج العائلات الجنوبي (بلوكات 121 - 123)',
    nameEn: 'South Stand Families (Blocks 121 - 123)',
    tierId: 'cat3',
    color: '#8b5cf6',
    capacity: southRows.length * 14,
    availableCount: seats.filter((s) => s.tierId === 'cat3' && s.status === 'available').length,
    price: cat3Tier.price,
    rows: southRows,
  });

  return {
    type: 'stadium',
    venueId: 'kingdom_arena',
    venueNameAr,
    stageLabelAr: '🏟️ أرضية المملكة أرينا المكيفة (KINGDOM ARENA PITCH)',
    totalSeats: seats.length,
    availableSeats: seats.filter((s) => s.status === 'available').length,
    sections,
    seats,
  };
}

// -------------------------------------------------------------
// 2. استاد الأول بارك (Al-Awwal Park - جامعة الملك سعود)
// -------------------------------------------------------------
export function generateAlAwwalParkSeatingMap(
  venueNameAr: string = 'استاد الأول بارك (Al-Awwal Park)',
  eventTiers?: TicketTier[]
): SeatingMapData {
  const tiers = eventTiers && eventTiers.length > 0 ? eventTiers : [
    { id: 'cat3', name: 'Cat 3', nameAr: 'مدرجات خلف المرمى', price: 100, available: true },
    { id: 'cat1', name: 'Cat 1', nameAr: 'الدرجة الأولى (الواجهة)', price: 250, available: true },
    { id: 'vip', name: 'VIP Lounge', nameAr: 'لاونج كبار الشخصيات VIP', price: 950, available: true },
  ];

  const cat3Tier = resolveTierInfo(tiers, 'cat3', 100, 'مدرجات خلف المرمى (الأول بارك)');
  const cat1Tier = resolveTierInfo(tiers, 'cat1', 250, 'الدرجة الأولى - الواجهة الشرقية');
  const vipTier = resolveTierInfo(tiers, 'vip', 950, 'المنصة الغربية الشرفية VIP');

  const seats: Seat[] = [];
  const sections: SeatingSection[] = [];

  // West Stand (المقصورة والواجهة الغربية - Blocks A, B, C)
  const westRows = ['W-A', 'W-B', 'W-C'];
  westRows.forEach((row, rIdx) => {
    for (let num = 1; num <= 14; num++) {
      const isReserved = (rIdx === 0 && num % 2 === 0) || num === 5;
      seats.push({
        id: `ap-vip-${row}-${num}`,
        row,
        number: num,
        label: `${row}-${num}`,
        tierId: 'vip',
        tierNameAr: vipTier.nameAr,
        price: vipTier.price,
        status: isReserved ? 'reserved' : 'available',
        section: 'الأول بارك - المنصة والمقصورة الغربية',
        x: num * 24,
        y: rIdx * 28,
      });
    }
  });

  sections.push({
    id: 'sec-ap-vip',
    nameAr: 'المنصة الغربية وكبار الشخصيات VIP (بلوكات A, B, C)',
    nameEn: 'Al-Awwal Park West VIP Grandstand',
    tierId: 'vip',
    color: '#f59e0b',
    capacity: westRows.length * 14,
    availableCount: seats.filter((s) => s.tierId === 'vip' && s.status === 'available').length,
    price: vipTier.price,
    rows: westRows,
  });

  // East Stand (الواجهة الشرقية المركزية - Blocks E, F, G, H)
  const eastRows = ['E-BLK', 'F-BLK', 'G-BLK', 'H-BLK'];
  eastRows.forEach((row, rIdx) => {
    for (let num = 1; num <= 16; num++) {
      const isReserved = (num + rIdx) % 3 === 0;
      seats.push({
        id: `ap-east-${row}-${num}`,
        row,
        number: num,
        label: `${row}-${num}`,
        tierId: 'cat1',
        tierNameAr: cat1Tier.nameAr,
        price: cat1Tier.price,
        status: isReserved ? 'reserved' : 'available',
        section: 'الأول بارك - واجهة الملعب الشرقية',
        x: num * 24,
        y: 100 + rIdx * 26,
      });
    }
  });

  sections.push({
    id: 'sec-ap-east',
    nameAr: 'واجهة الملعب الشرقية (بلوكات E, F, G, H)',
    nameEn: 'East Main Stand (Blocks E - H)',
    tierId: 'cat1',
    color: '#eab308',
    capacity: eastRows.length * 16,
    availableCount: seats.filter((s) => s.tierId === 'cat1' && s.status === 'available').length,
    price: cat1Tier.price,
    rows: eastRows,
  });

  // North Stand (مدرج الشمس ورابطة النصر N1 - N3)
  const northRows = ['AP-N1', 'AP-N2', 'AP-N3'];
  northRows.forEach((row, rIdx) => {
    for (let num = 1; num <= 14; num++) {
      const isReserved = num > 9;
      seats.push({
        id: `ap-north-${row}-${num}`,
        row,
        number: num,
        label: `${row}-${num}`,
        tierId: 'cat3',
        tierNameAr: cat3Tier.nameAr,
        price: cat3Tier.price,
        status: isReserved ? 'reserved' : 'available',
        section: 'الأول بارك - مدرج الرابطة الشمالي',
        x: num * 24,
        y: 220 + rIdx * 26,
      });
    }
  });

  sections.push({
    id: 'sec-ap-north',
    nameAr: 'مدرج الرابطة الشمالي خلف المرمى (بلوكات N1 - N3)',
    nameEn: 'North Stand Ultras (Blocks N1 - N3)',
    tierId: 'cat3',
    color: '#3b82f6',
    capacity: northRows.length * 14,
    availableCount: seats.filter((s) => s.tierId === 'cat3' && s.status === 'available').length,
    price: cat3Tier.price,
    rows: northRows,
  });

  return {
    type: 'stadium',
    venueId: 'alawwal_park',
    venueNameAr,
    stageLabelAr: '⚽ أرضية استاد الأول بارك (AL-AWWAL PARK PITCH)',
    totalSeats: seats.length,
    availableSeats: seats.filter((s) => s.status === 'available').length,
    sections,
    seats,
  };
}

// -------------------------------------------------------------
// 3. مدينة الملك عبدالله الرياضية - الجوهرة المشعة (Al Jawhara)
// -------------------------------------------------------------
export function generateAlJawharaSeatingMap(
  venueNameAr: string = 'مدينة الملك عبدالله الرياضية - الجوهرة المشعة بجدة',
  eventTiers?: TicketTier[]
): SeatingMapData {
  const tiers = eventTiers && eventTiers.length > 0 ? eventTiers : [
    { id: 'cat3', name: 'Cat 3', nameAr: 'المدرج العلوي (الدور الثالث)', price: 40, available: true },
    { id: 'cat2', name: 'Cat 2', nameAr: 'المدرج الأوسط (الدور الثاني)', price: 80, available: true },
    { id: 'cat1', name: 'Cat 1', nameAr: 'المدرج السفلي (الدور الأول)', price: 150, available: true },
    { id: 'vip', name: 'VIP Gold', nameAr: 'المنصة الذهبية والفضية VIP', price: 600, available: true },
  ];

  const cat3Tier = resolveTierInfo(tiers, 'cat3', 40, 'الدور الثالث (المدرج العلوي)');
  const cat2Tier = resolveTierInfo(tiers, 'cat2', 80, 'الدور الثاني (المدرج الأوسط)');
  const cat1Tier = resolveTierInfo(tiers, 'cat1', 150, 'الدور الأول السفلي (ملاصق للملعب)');
  const vipTier = resolveTierInfo(tiers, 'vip', 600, 'المنصة الملكية VIP');

  const seats: Seat[] = [];
  const sections: SeatingSection[] = [];

  // الدور الأول السفلي (Tier 1 Lower Bowl 101 - 104)
  const lowerRows = ['L101', 'L102', 'L103'];
  lowerRows.forEach((row, rIdx) => {
    for (let num = 1; num <= 16; num++) {
      const isReserved = (num + rIdx) % 3 === 0;
      seats.push({
        id: `jaw-lower-${row}-${num}`,
        row,
        number: num,
        label: `${row}-${num}`,
        tierId: 'cat1',
        tierNameAr: cat1Tier.nameAr,
        price: cat1Tier.price,
        status: isReserved ? 'reserved' : 'available',
        section: 'الجوهرة - الدور الأول السفلي',
        x: num * 24,
        y: rIdx * 28,
      });
    }
  });

  sections.push({
    id: 'sec-jaw-lower',
    nameAr: 'الدور الأول السفلي الأقرب للمستطيل الأخضر (بلوكات 101 - 103)',
    nameEn: 'Al Jawhara Lower Tier (Blocks 101 - 103)',
    tierId: 'cat1',
    color: '#10b981',
    capacity: lowerRows.length * 16,
    availableCount: seats.filter((s) => s.tierId === 'cat1' && s.status === 'available').length,
    price: cat1Tier.price,
    rows: lowerRows,
  });

  // المنصة والمقصورة الذهبية (VIP Middle Tier 201 - 203)
  const vipRows = ['VIP-201', 'VIP-202'];
  vipRows.forEach((row, rIdx) => {
    for (let num = 1; num <= 12; num++) {
      const isReserved = rIdx === 0 && num % 2 === 0;
      seats.push({
        id: `jaw-vip-${row}-${num}`,
        row,
        number: num,
        label: `${row}-${num}`,
        tierId: 'vip',
        tierNameAr: vipTier.nameAr,
        price: vipTier.price,
        status: isReserved ? 'reserved' : 'available',
        section: 'الجوهرة - المنصة والضيافة VIP',
        x: num * 26,
        y: 100 + rIdx * 28,
      });
    }
  });

  sections.push({
    id: 'sec-jaw-vip',
    nameAr: 'المنصة الذهبية ومقصورة الضيافة VIP (بلوكات 201 - 202)',
    nameEn: 'VIP Gold Hospitality Tier (Blocks 201 - 202)',
    tierId: 'vip',
    color: '#f59e0b',
    capacity: vipRows.length * 12,
    availableCount: seats.filter((s) => s.tierId === 'vip' && s.status === 'available').length,
    price: vipTier.price,
    rows: vipRows,
  });

  // الدور الثاني الأوسط (Middle Tier 210 - 212)
  const midRows = ['M210', 'M211'];
  midRows.forEach((row, rIdx) => {
    for (let num = 1; num <= 14; num++) {
      const isReserved = (num + rIdx) % 4 === 0;
      seats.push({
        id: `jaw-mid-${row}-${num}`,
        row,
        number: num,
        label: `${row}-${num}`,
        tierId: 'cat2',
        tierNameAr: cat2Tier.nameAr,
        price: cat2Tier.price,
        status: isReserved ? 'reserved' : 'available',
        section: 'الجوهرة - الدور الثاني الأوسط',
        x: num * 24,
        y: 190 + rIdx * 26,
      });
    }
  });

  sections.push({
    id: 'sec-jaw-mid',
    nameAr: 'الدور الثاني الأوسط الممتاز (بلوكات 210 - 211)',
    nameEn: 'Middle Tier Prime (Blocks 210 - 211)',
    tierId: 'cat2',
    color: '#06b6d4',
    capacity: midRows.length * 14,
    availableCount: seats.filter((s) => s.tierId === 'cat2' && s.status === 'available').length,
    price: cat2Tier.price,
    rows: midRows,
  });

  // الدور الثالث العلوي البانورامي (Upper Tier 301 - 303)
  const upperRows = ['U301', 'U302', 'U303'];
  upperRows.forEach((row, rIdx) => {
    for (let num = 1; num <= 16; num++) {
      const isReserved = num > 11;
      seats.push({
        id: `jaw-upper-${row}-${num}`,
        row,
        number: num,
        label: `${row}-${num}`,
        tierId: 'cat3',
        tierNameAr: cat3Tier.nameAr,
        price: cat3Tier.price,
        status: isReserved ? 'reserved' : 'available',
        section: 'الجوهرة - الدور الثالث العلوي',
        x: num * 24,
        y: 280 + rIdx * 26,
      });
    }
  });

  sections.push({
    id: 'sec-jaw-upper',
    nameAr: 'الدور الثالث العلوي البانورامي (بلوكات 301 - 303)',
    nameEn: 'Upper Panoramic Bowl (Blocks 301 - 303)',
    tierId: 'cat3',
    color: '#8b5cf6',
    capacity: upperRows.length * 16,
    availableCount: seats.filter((s) => s.tierId === 'cat3' && s.status === 'available').length,
    price: cat3Tier.price,
    rows: upperRows,
  });

  return {
    type: 'stadium',
    venueId: 'aljawhara',
    venueNameAr,
    stageLabelAr: '🏟️ أرضية الجوهرة المشعة بجدة (KING ABDULLAH SPORTS CITY)',
    totalSeats: seats.length,
    availableSeats: seats.filter((s) => s.status === 'available').length,
    sections,
    seats,
  };
}

// -------------------------------------------------------------
// 4. مسرح فنان العرب محمد عبده أرينا (Mohammed Abdo Arena)
// -------------------------------------------------------------
export function generateMohammedAbdoArenaSeatingMap(
  venueNameAr: string = 'مسرح محمد عبده أرينا - بوليفارد سيتي',
  eventTiers?: TicketTier[]
): SeatingMapData {
  const tiers = eventTiers && eventTiers.length > 0 ? eventTiers : [
    { id: 'bronze', name: 'Bronze', nameAr: 'المقاعد البرونزية (البلكون)', price: 150, available: true },
    { id: 'silver', name: 'Silver', nameAr: 'المقاعد الفضية (الأوركسترا)', price: 300, available: true },
    { id: 'gold', name: 'Gold', nameAr: 'الدائرة الذهبية (Golden Circle)', price: 650, available: true },
    { id: 'royal', name: 'Royal VIP', nameAr: 'المنصة الملكية VIP', price: 1500, available: true },
  ];

  const royalTier = resolveTierInfo(tiers, 'royal', 1500, 'المنصة الملكية VIP');
  const goldTier = resolveTierInfo(tiers, 'gold', 650, 'الدائرة الذهبية (Golden Circle)');
  const silverTier = resolveTierInfo(tiers, 'silver', 300, 'مقاعد الأوركسترا الفضية');
  const bronzeTier = resolveTierInfo(tiers, 'bronze', 150, 'المقاعد البرونزية');

  const seats: Seat[] = [];
  const sections: SeatingSection[] = [];

  // 1. Royal VIP Front Rows (R1, R2)
  const royalRows = ['ROYAL-1', 'ROYAL-2'];
  royalRows.forEach((row, rIdx) => {
    for (let num = 1; num <= 12; num++) {
      const isReserved = (rIdx === 0 && num % 2 === 0) || num === 6;
      seats.push({
        id: `abdo-royal-${row}-${num}`,
        row,
        number: num,
        label: `${row}-${num}`,
        tierId: 'royal',
        tierNameAr: royalTier.nameAr,
        price: royalTier.price,
        status: isReserved ? 'reserved' : 'available',
        section: 'محمد عبده أرينا - المنصة الملكية VIP',
        x: num * 26,
        y: rIdx * 28,
      });
    }
  });

  sections.push({
    id: 'sec-abdo-royal',
    nameAr: `المنصة الملكية VIP الصفوف الأولى (${royalTier.price} ر.س)`,
    nameEn: 'Royal VIP Front Stage',
    tierId: 'royal',
    color: '#f59e0b',
    capacity: royalRows.length * 12,
    availableCount: seats.filter((s) => s.tierId === 'royal' && s.status === 'available').length,
    price: royalTier.price,
    rows: royalRows,
  });

  // 2. Golden Circle (الدائرة الذهبية GC-1, GC-2)
  const gcRows = ['GC-1', 'GC-2'];
  gcRows.forEach((row, rIdx) => {
    for (let num = 1; num <= 14; num++) {
      const isReserved = (num + rIdx) % 3 === 0;
      seats.push({
        id: `abdo-gc-${row}-${num}`,
        row,
        number: num,
        label: `${row}-${num}`,
        tierId: 'gold',
        tierNameAr: goldTier.nameAr,
        price: goldTier.price,
        status: isReserved ? 'reserved' : 'available',
        section: 'محمد عبده أرينا - الدائرة الذهبية',
        x: num * 24,
        y: 80 + rIdx * 26,
      });
    }
  });

  sections.push({
    id: 'sec-abdo-gc',
    nameAr: `الدائرة الذهبية Golden Circle (${goldTier.price} ر.س)`,
    nameEn: 'Golden Circle Prime Fan Pit',
    tierId: 'gold',
    color: '#eab308',
    capacity: gcRows.length * 14,
    availableCount: seats.filter((s) => s.tierId === 'gold' && s.status === 'available').length,
    price: goldTier.price,
    rows: gcRows,
  });

  // 3. Orchestra Silver (الأوركسترا الفضية OR1 - OR3)
  const orRows = ['OR-1', 'OR-2', 'OR-3'];
  orRows.forEach((row, rIdx) => {
    for (let num = 1; num <= 16; num++) {
      const isReserved = (num + rIdx) % 4 === 0;
      seats.push({
        id: `abdo-or-${row}-${num}`,
        row,
        number: num,
        label: `${row}-${num}`,
        tierId: 'silver',
        tierNameAr: silverTier.nameAr,
        price: silverTier.price,
        status: isReserved ? 'reserved' : 'available',
        section: 'محمد عبده أرينا - صالة الأوركسترا الفضية',
        x: num * 24,
        y: 160 + rIdx * 26,
      });
    }
  });

  sections.push({
    id: 'sec-abdo-or',
    nameAr: `صالة الأوركسترا الفضية (${silverTier.price} ر.س)`,
    nameEn: 'Silver Orchestra Hall',
    tierId: 'silver',
    color: '#06b6d4',
    capacity: orRows.length * 16,
    availableCount: seats.filter((s) => s.tierId === 'silver' && s.status === 'available').length,
    price: silverTier.price,
    rows: orRows,
  });

  // 4. Balcony Bronze (المقاعد البرونزية البلكون B1 - B3)
  const bRows = ['BALC-1', 'BALC-2', 'BALC-3'];
  bRows.forEach((row, rIdx) => {
    for (let num = 1; num <= 16; num++) {
      const isReserved = num > 11;
      seats.push({
        id: `abdo-balc-${row}-${num}`,
        row,
        number: num,
        label: `${row}-${num}`,
        tierId: 'bronze',
        tierNameAr: bronzeTier.nameAr,
        price: bronzeTier.price,
        status: isReserved ? 'reserved' : 'available',
        section: 'محمد عبده أرينا - شرفات البلكون العلوية',
        x: num * 24,
        y: 260 + rIdx * 26,
      });
    }
  });

  sections.push({
    id: 'sec-abdo-balc',
    nameAr: `شرفات البلكون العلوية البرونزية (${bronzeTier.price} ر.س)`,
    nameEn: 'Upper Balcony Tier',
    tierId: 'bronze',
    color: '#8b5cf6',
    capacity: bRows.length * 16,
    availableCount: seats.filter((s) => s.tierId === 'bronze' && s.status === 'available').length,
    price: bronzeTier.price,
    rows: bRows,
  });

  return {
    type: 'concert',
    venueId: 'mohammed_abdo_arena',
    venueNameAr,
    stageLabelAr: '🎤 خشبة مسرح فنان العرب محمد عبده أرينا (MAIN CONCERT STAGE)',
    totalSeats: seats.length,
    availableSeats: seats.filter((s) => s.status === 'available').length,
    sections,
    seats,
  };
}

// -------------------------------------------------------------
// 5. مسرح بكر الشدي / مسرح أبو بكر سالم (Bakr Al-Sheddi Theater)
// -------------------------------------------------------------
export function generateBakrSheddiTheaterSeatingMap(
  venueNameAr: string = 'مسرح بكر الشدي - بوليفارد سيتي',
  eventTiers?: TicketTier[]
): SeatingMapData {
  const tiers = eventTiers && eventTiers.length > 0 ? eventTiers : [
    { id: 'regular', name: 'Regular', nameAr: 'المقاعد العادية (الصالة)', price: 95, available: true },
    { id: 'vip', name: 'VIP Orchestra', nameAr: 'كبار الشخصيات VIP (الصفوف الأولى)', price: 250, available: true },
  ];

  const regTier = resolveTierInfo(tiers, 'regular', 95, 'المقاعد العادية (الصالة)');
  const vipTier = resolveTierInfo(tiers, 'vip', 250, 'كبار الشخصيات VIP (الصفوف الأولى)');

  const seats: Seat[] = [];
  const sections: SeatingSection[] = [];

  // Front VIP Rows (A, B, C)
  const vipRows = ['ROW-A', 'ROW-B', 'ROW-C'];
  vipRows.forEach((row, rIdx) => {
    for (let num = 1; num <= 14; num++) {
      const isReserved = (rIdx === 0 && (num === 4 || num === 5)) || num === 9;
      seats.push({
        id: `sheddi-vip-${row}-${num}`,
        row,
        number: num,
        label: `${row.replace('ROW-', '')}-${num}`,
        tierId: 'vip',
        tierNameAr: vipTier.nameAr,
        price: vipTier.price,
        status: isReserved ? 'reserved' : 'available',
        section: 'مسرح بكر الشدي - صفوف كبار الشخصيات الأولى VIP',
        x: num * 26,
        y: rIdx * 28,
      });
    }
  });

  sections.push({
    id: 'sec-sheddi-vip',
    nameAr: `صفوف كبار الشخصيات الأولى VIP (${vipTier.price} ر.س)`,
    nameEn: 'VIP Front Stage Orchestra (Rows A - C)',
    tierId: 'vip',
    color: '#f59e0b',
    capacity: vipRows.length * 14,
    availableCount: seats.filter((s) => s.tierId === 'vip' && s.status === 'available').length,
    price: vipTier.price,
    rows: vipRows,
  });

  // Stalls Rows (D, E, F, G, H)
  const stallRows = ['ROW-D', 'ROW-E', 'ROW-F', 'ROW-G'];
  stallRows.forEach((row, rIdx) => {
    for (let num = 1; num <= 16; num++) {
      const isReserved = (num + rIdx) % 4 === 0;
      seats.push({
        id: `sheddi-stalls-${row}-${num}`,
        row,
        number: num,
        label: `${row.replace('ROW-', '')}-${num}`,
        tierId: 'regular',
        tierNameAr: regTier.nameAr,
        price: regTier.price,
        status: isReserved ? 'reserved' : 'available',
        section: 'مسرح بكر الشدي - الصالة الرئيسية',
        x: num * 24,
        y: 110 + rIdx * 26,
      });
    }
  });

  sections.push({
    id: 'sec-sheddi-stalls',
    nameAr: `مقاعد الصالة والمسرح الرئيسية (${regTier.price} ر.س)`,
    nameEn: 'Main Stalls Seating (Rows D - G)',
    tierId: 'regular',
    color: '#8b5cf6',
    capacity: stallRows.length * 16,
    availableCount: seats.filter((s) => s.tierId === 'regular' && s.status === 'available').length,
    price: regTier.price,
    rows: stallRows,
  });

  return {
    type: 'theater',
    venueId: 'bakr_sheddi',
    venueNameAr,
    stageLabelAr: '🎭 خشبة مسرح بكر الشدي للعروض والمسرحيات (THEATER STAGE)',
    totalSeats: seats.length,
    availableSeats: seats.filter((s) => s.status === 'available').length,
    sections,
    seats,
  };
}

// -------------------------------------------------------------
// 6. حلبة النزالات والملاكمة العالمية (Riyadh Boxing Ring)
// -------------------------------------------------------------
export function generateBoxingRingSeatingMap(
  venueNameAr: string = 'حلبة النزالات العالمية - موسم الرياض (Kingdom Arena Ring)',
  eventTiers?: TicketTier[]
): SeatingMapData {
  const tiers = eventTiers && eventTiers.length > 0 ? eventTiers : [
    { id: 'cat2', name: 'Arena Bowl', nameAr: 'المدرجات العلوية للصالة', price: 180, available: true },
    { id: 'cat1', name: 'Floor Seats', nameAr: 'المقاعد الأرضية الفاخرة (Floor)', price: 450, available: true },
    { id: 'vip', name: 'Ringside VIP', nameAr: 'مقاعد الحلبة الأمامية Ringside VIP', price: 1800, available: true },
  ];

  const bowlTier = resolveTierInfo(tiers, 'cat2', 180, 'المدرجات العلوية للصالة');
  const floorTier = resolveTierInfo(tiers, 'cat1', 450, 'المقاعد الأرضية الفاخرة (Floor)');
  const ringTier = resolveTierInfo(tiers, 'vip', 1800, 'مقاعد الحلبة الأمامية Ringside VIP');

  const seats: Seat[] = [];
  const sections: SeatingSection[] = [];

  // 1. Ringside Row 1 & 2 ملاصقة لحبال الحلبة
  const ringRows = ['RING-1', 'RING-2'];
  ringRows.forEach((row, rIdx) => {
    for (let num = 1; num <= 14; num++) {
      const isReserved = (rIdx === 0 && num % 2 === 0) || num === 7;
      seats.push({
        id: `box-ring-${row}-${num}`,
        row,
        number: num,
        label: `${row}-${num}`,
        tierId: 'vip',
        tierNameAr: ringTier.nameAr,
        price: ringTier.price,
        status: isReserved ? 'reserved' : 'available',
        section: 'حلبة الملاكمة - مقاعد الصف الأول Ringside VIP',
        x: num * 26,
        y: rIdx * 28,
      });
    }
  });

  sections.push({
    id: 'sec-box-ringside',
    nameAr: `مقاعد الحلبة الأمامية الملاصقة للحبال Ringside VIP (${ringTier.price} ر.س)`,
    nameEn: 'Ringside Front Row VIP',
    tierId: 'vip',
    color: '#f59e0b',
    capacity: ringRows.length * 14,
    availableCount: seats.filter((s) => s.tierId === 'vip' && s.status === 'available').length,
    price: ringTier.price,
    rows: ringRows,
  });

  // 2. Floor VIP Seats
  const floorRows = ['FL-1', 'FL-2', 'FL-3'];
  floorRows.forEach((row, rIdx) => {
    for (let num = 1; num <= 16; num++) {
      const isReserved = (num + rIdx) % 3 === 0;
      seats.push({
        id: `box-floor-${row}-${num}`,
        row,
        number: num,
        label: `${row}-${num}`,
        tierId: 'cat1',
        tierNameAr: floorTier.nameAr,
        price: floorTier.price,
        status: isReserved ? 'reserved' : 'available',
        section: 'حلبة الملاكمة - المقاعد الأرضية Floor',
        x: num * 24,
        y: 80 + rIdx * 26,
      });
    }
  });

  sections.push({
    id: 'sec-box-floor',
    nameAr: `المقاعد الأرضية المحيطة بالحلبة Floor (${floorTier.price} ر.س)`,
    nameEn: 'Floor Ringside Seats',
    tierId: 'cat1',
    color: '#10b981',
    capacity: floorRows.length * 16,
    availableCount: seats.filter((s) => s.tierId === 'cat1' && s.status === 'available').length,
    price: floorTier.price,
    rows: floorRows,
  });

  // 3. Bowl Upper Arena
  const bowlRows = ['BOWL-A', 'BOWL-B', 'BOWL-C'];
  bowlRows.forEach((row, rIdx) => {
    for (let num = 1; num <= 16; num++) {
      const isReserved = num > 12;
      seats.push({
        id: `box-bowl-${row}-${num}`,
        row,
        number: num,
        label: `${row}-${num}`,
        tierId: 'cat2',
        tierNameAr: bowlTier.nameAr,
        price: bowlTier.price,
        status: isReserved ? 'reserved' : 'available',
        section: 'حلبة الملاكمة - مدرجات الصالة العلوية',
        x: num * 24,
        y: 180 + rIdx * 26,
      });
    }
  });

  sections.push({
    id: 'sec-box-bowl',
    nameAr: `مدرجات الصالة المرتفعة Arena Bowl (${bowlTier.price} ر.س)`,
    nameEn: 'Arena Bowl Upper Stands',
    tierId: 'cat2',
    color: '#8b5cf6',
    capacity: bowlRows.length * 16,
    availableCount: seats.filter((s) => s.tierId === 'cat2' && s.status === 'available').length,
    price: bowlTier.price,
    rows: bowlRows,
  });

  return {
    type: 'stadium',
    venueId: 'boxing_ring',
    venueNameAr,
    stageLabelAr: '🥊 حلبة النزال المربعة المركزية (20x20 BOXING CANVAS)',
    totalSeats: seats.length,
    availableSeats: seats.filter((s) => s.status === 'available').length,
    sections,
    seats,
  };
}

// -------------------------------------------------------------
// 7. ميدان الملك عبدالعزيز للفروسية وسباق الخيل (Equestrian)
// -------------------------------------------------------------
export function generateEquestrianRacecourseSeatingMap(
  venueNameAr: string = 'ميدان الملك عبدالعزيز للفروسية - الجنادرية',
  eventTiers?: TicketTier[]
): SeatingMapData {
  const tiers = eventTiers && eventTiers.length > 0 ? eventTiers : [
    { id: 'regular', name: 'Grandstand', nameAr: 'مدرجات خط النهاية والمنصة العامة', price: 30, available: true },
    { id: 'vip', name: 'Owners VIP', nameAr: 'لاونج كبار الشخصيات والملاك VIP', price: 350, available: true },
  ];

  const regTier = resolveTierInfo(tiers, 'regular', 30, 'مدرجات خط النهاية والمنصة العامة');
  const vipTier = resolveTierInfo(tiers, 'vip', 350, 'لاونج كبار الشخصيات والملاك VIP');

  const seats: Seat[] = [];
  const sections: SeatingSection[] = [];

  // VIP Owners Lounge
  const vipRows = ['OWNER-1', 'OWNER-2'];
  vipRows.forEach((row, rIdx) => {
    for (let num = 1; num <= 12; num++) {
      const isReserved = rIdx === 0 && num % 2 === 0;
      seats.push({
        id: `eq-vip-${row}-${num}`,
        row,
        number: num,
        label: `${row}-${num}`,
        tierId: 'vip',
        tierNameAr: vipTier.nameAr,
        price: vipTier.price,
        status: isReserved ? 'reserved' : 'available',
        section: 'ميدان الخيل - منصة الملاك وكبار الشخصيات VIP',
        x: num * 26,
        y: rIdx * 28,
      });
    }
  });

  sections.push({
    id: 'sec-eq-vip',
    nameAr: `منصة الملاك وكبار الشخصيات VIP (${vipTier.price} ر.س)`,
    nameEn: 'Equestrian VIP Owners Lounge',
    tierId: 'vip',
    color: '#f59e0b',
    capacity: vipRows.length * 12,
    availableCount: seats.filter((s) => s.tierId === 'vip' && s.status === 'available').length,
    price: vipTier.price,
    rows: vipRows,
  });

  // Finish Line Grandstand
  const gRows = ['FINISH-1', 'FINISH-2', 'FINISH-3', 'FINISH-4'];
  gRows.forEach((row, rIdx) => {
    for (let num = 1; num <= 16; num++) {
      const isReserved = (num + rIdx) % 4 === 0;
      seats.push({
        id: `eq-finish-${row}-${num}`,
        row,
        number: num,
        label: `${row}-${num}`,
        tierId: 'regular',
        tierNameAr: regTier.nameAr,
        price: regTier.price,
        status: isReserved ? 'reserved' : 'available',
        section: 'ميدان الخيل - مدرجات خط النهاية العامة',
        x: num * 24,
        y: 80 + rIdx * 26,
      });
    }
  });

  sections.push({
    id: 'sec-eq-finish',
    nameAr: `مدرجات خط النهاية للسباق Grandstand (${regTier.price} ر.س)`,
    nameEn: 'Finish Line Public Grandstand',
    tierId: 'regular',
    color: '#10b981',
    capacity: gRows.length * 16,
    availableCount: seats.filter((s) => s.tierId === 'regular' && s.status === 'available').length,
    price: regTier.price,
    rows: gRows,
  });

  return {
    type: 'zone',
    venueId: 'equestrian',
    venueNameAr,
    stageLabelAr: '🏇 مضمار سباق الخيل المستقيم وخط النهاية (THE RACETRACK)',
    totalSeats: seats.length,
    availableSeats: seats.filter((s) => s.status === 'available').length,
    sections,
    seats,
  };
}

// -------------------------------------------------------------
// 8. بوليفارد وورلد والمناطق المفتوحة (Boulevard World & Zones)
// -------------------------------------------------------------
export function generateBoulevardWorldSeatingMap(
  venueNameAr: string = 'بوليفارد وورلد - موسم الرياض',
  eventTiers?: TicketTier[]
): SeatingMapData {
  const tiers = eventTiers && eventTiers.length > 0 ? eventTiers : [
    { id: 'regular', name: 'General', nameAr: 'تذكرة دخول عامة للمنطقة', price: 45, available: true },
    { id: 'fast_track', name: 'Fast Track', nameAr: 'المسار السريع (Fast Track Pass)', price: 120, available: true },
    { id: 'vip', name: 'VIP Lounge', nameAr: 'لاونج كبار الشخصيات VIP', price: 350, available: true },
  ];

  const regTier = resolveTierInfo(tiers, 'regular', 45, 'تذكرة الدخول العامة');
  const fastTier = resolveTierInfo(tiers, 'fast_track', 120, 'المسار السريع Fast Track');
  const vipTier = resolveTierInfo(tiers, 'vip', 350, 'لاونج كبار الشخصيات VIP');

  const seats: Seat[] = [];
  const sections: SeatingSection[] = [];

  // VIP Zone Pavilions
  const vipRows = ['VIP-PAV1', 'VIP-PAV2'];
  vipRows.forEach((row, rIdx) => {
    for (let num = 1; num <= 10; num++) {
      const isReserved = num === 3 || num === 8;
      seats.push({
        id: `bw-vip-${row}-${num}`,
        row,
        number: num,
        label: `${row}-${num}`,
        tierId: 'vip',
        tierNameAr: vipTier.nameAr,
        price: vipTier.price,
        status: isReserved ? 'reserved' : 'available',
        section: 'بوليفارد وورلد - لاونج كبار الشخصيات VIP',
        x: num * 28,
        y: rIdx * 28,
      });
    }
  });

  sections.push({
    id: 'sec-bw-vip',
    nameAr: `لاونج كبار الشخصيات والمسار الملكي VIP (${vipTier.price} ر.س)`,
    nameEn: 'VIP Pavilion & Hospitality',
    tierId: 'vip',
    color: '#f59e0b',
    capacity: vipRows.length * 10,
    availableCount: seats.filter((s) => s.tierId === 'vip' && s.status === 'available').length,
    price: vipTier.price,
    rows: vipRows,
  });

  // Fast Track Rows
  const fastRows = ['FAST-1', 'FAST-2'];
  fastRows.forEach((row, rIdx) => {
    for (let num = 1; num <= 14; num++) {
      const isReserved = (num + rIdx) % 4 === 0;
      seats.push({
        id: `bw-fast-${row}-${num}`,
        row,
        number: num,
        label: `${row}-${num}`,
        tierId: 'fast_track',
        tierNameAr: fastTier.nameAr,
        price: fastTier.price,
        status: isReserved ? 'reserved' : 'available',
        section: 'بوليفارد وورلد - مسار Fast Track',
        x: num * 24,
        y: 80 + rIdx * 26,
      });
    }
  });

  sections.push({
    id: 'sec-bw-fast',
    nameAr: `المسار السريع Fast Track (${fastTier.price} ر.س)`,
    nameEn: 'Fast Track Admission',
    tierId: 'fast_track',
    color: '#06b6d4',
    capacity: fastRows.length * 14,
    availableCount: seats.filter((s) => s.tierId === 'fast_track' && s.status === 'available').length,
    price: fastTier.price,
    rows: fastRows,
  });

  // General Access
  const genRows = ['ZONE-1', 'ZONE-2'];
  genRows.forEach((row, rIdx) => {
    for (let num = 1; num <= 14; num++) {
      const isReserved = (num + rIdx) % 5 === 0;
      seats.push({
        id: `bw-gen-${row}-${num}`,
        row,
        number: num,
        label: `${row}-${num}`,
        tierId: 'regular',
        tierNameAr: regTier.nameAr,
        price: regTier.price,
        status: isReserved ? 'reserved' : 'available',
        section: 'بوليفارد وورلد - تذاكر الدخول العامة',
        x: num * 24,
        y: 150 + rIdx * 26,
      });
    }
  });

  sections.push({
    id: 'sec-bw-general',
    nameAr: `الدخول العام للمنطقة والبحيرة (${regTier.price} ر.س)`,
    nameEn: 'General Admission',
    tierId: 'regular',
    color: '#8b5cf6',
    capacity: genRows.length * 14,
    availableCount: seats.filter((s) => s.tierId === 'regular' && s.status === 'available').length,
    price: regTier.price,
    rows: genRows,
  });

  return {
    type: 'zone',
    venueId: 'boulevard_world',
    venueNameAr,
    stageLabelAr: '🎡 البوابة الرئيسية لبوليفارد وورلد والأجنحة العالمية (MAIN ZONE ACCESS)',
    totalSeats: seats.length,
    availableSeats: seats.filter((s) => s.status === 'available').length,
    sections,
    seats,
  };
}

// Standard fallback generators
export function generateStadiumSeatingMap(
  venueNameAr: string = 'ملعب المباراة الرسمي',
  eventTiers?: TicketTier[]
): SeatingMapData {
  return generateKingdomArenaSeatingMap(venueNameAr, eventTiers);
}

export function generateConcertSeatingMap(
  venueNameAr: string = 'المسرح / الصالة الموسيقية الرسمية',
  eventTiers?: TicketTier[]
): SeatingMapData {
  return generateMohammedAbdoArenaSeatingMap(venueNameAr, eventTiers);
}

export function generateZoneSeatingMap(
  venueNameAr: string = 'منطقة الفعالية الرسمية',
  eventTiers?: TicketTier[]
): SeatingMapData {
  return generateBoulevardWorldSeatingMap(venueNameAr, eventTiers);
}

/**
 * Universal Dispatcher by Blueprint ID
 */
export function generateVenueSeatingMapByBlueprint(
  blueprintId: VenueBlueprintId,
  venueNameAr?: string,
  eventTiers?: TicketTier[]
): SeatingMapData {
  switch (blueprintId) {
    case 'kingdom_arena':
      return generateKingdomArenaSeatingMap(venueNameAr || 'المملكة أرينا (Kingdom Arena)', eventTiers);
    case 'alawwal_park':
      return generateAlAwwalParkSeatingMap(venueNameAr || 'استاد الأول بارك (Al-Awwal Park)', eventTiers);
    case 'aljawhara':
      return generateAlJawharaSeatingMap(venueNameAr || 'مدينة الملك عبدالله الرياضية - الجوهرة المشعة', eventTiers);
    case 'mohammed_abdo_arena':
      return generateMohammedAbdoArenaSeatingMap(venueNameAr || 'مسرح محمد عبده أرينا', eventTiers);
    case 'bakr_sheddi':
      return generateBakrSheddiTheaterSeatingMap(venueNameAr || 'مسرح بكر الشدي', eventTiers);
    case 'boxing_ring':
      return generateBoxingRingSeatingMap(venueNameAr || 'حلبة النزالات والملاكمة العالمية', eventTiers);
    case 'equestrian':
      return generateEquestrianRacecourseSeatingMap(venueNameAr || 'ميدان الملك عبدالعزيز للفروسية', eventTiers);
    case 'boulevard_world':
      return generateBoulevardWorldSeatingMap(venueNameAr || 'بوليفارد وورلد', eventTiers);
    case 'general_stadium':
      return generateKingdomArenaSeatingMap(venueNameAr || 'الملعب الرياضي الرسمي', eventTiers);
    case 'general_theater':
    default:
      return generateBakrSheddiTheaterSeatingMap(venueNameAr || 'المسرح الرسمي', eventTiers);
  }
}

/**
 * Universal Venue Seating Map Dispatcher with Auto-Detection
 */
export function generateVenueSeatingMap(
  typeOrBlueprint: string = 'stadium',
  venueNameAr: string = 'الملعب / المسرح الرسمي',
  eventTiers?: TicketTier[]
): SeatingMapData {
  // If it is an explicit blueprint id
  const validBlueprints: VenueBlueprintId[] = [
    'kingdom_arena',
    'alawwal_park',
    'aljawhara',
    'mohammed_abdo_arena',
    'bakr_sheddi',
    'boxing_ring',
    'equestrian',
    'boulevard_world',
    'general_stadium',
    'general_theater',
  ];

  if (validBlueprints.includes(typeOrBlueprint as VenueBlueprintId)) {
    return generateVenueSeatingMapByBlueprint(typeOrBlueprint as VenueBlueprintId, venueNameAr, eventTiers);
  }

  // Detect blueprint from venue name or string
  const detected = detectVenueBlueprint(typeOrBlueprint, venueNameAr);
  return generateVenueSeatingMapByBlueprint(detected, venueNameAr, eventTiers);
}
