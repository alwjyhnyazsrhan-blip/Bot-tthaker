import { WebookEvent, Seat, SeatingMapData, SeatingSection, TicketTier, VenueBlueprintId } from '../types/bot';
import { REAL_WEBOOK_LIVE_CATALOG } from '../data/realWebookCatalog';
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

// Curated live Webook events with verified official tiers

export const LIVE_WEBOOK_CATALOG: WebookEvent[] = [
  {
    id: 'boulevard-world-riyadh',
    title: 'Boulevard World - Riyadh Season',
    titleAr: 'بوليفارد وورلد - موسم الرياض',
    slug: 'boulevard-world',
    url: 'https://webook.com/ar/explore',
    category: 'موسم الرياض',
    location: 'Boulevard World, Hittin, Riyadh',
    locationAr: 'بوليفارد وورلد، حي حطين، الرياض',
    date: 'مفتوح يومياً طوال الموسم',
    datesAvailable: ['2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27'],
    timesAvailable: ['16:00 - 01:00', '17:00 - 02:00'],
    image: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?q=80&w=1000&auto=format&fit=crop',
    bannerImage: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1400&auto=format&fit=crop',
    descriptionAr: 'بوليفارد وورلد هي أكبر وأبرز مناطق موسم الرياض الترفيهية، تجمع تجارب وثقافات أشهر دول العالم في مكان واحد (مصر، إيطاليا، المكسيك، اليابان، الهند، الصين، فرنسا، اليونان)، مع أكبر بحيرة اصطناعية وتلفريك وتجارب غوص ومطاعم عالمية.',
    organizer: 'الهيئة العامة للترفيه (GEA)',
    ageRestriction: 'مناسب لجميع أفراد العائلة',
    termsAr: [
      'التذاكر غير قابلة للإلغاء أو الاسترجاع وفق سياسة منصة Webook',
      'يسمح بدخول الأطفال دون سن سنتين مجاناً',
      'الالتزام بالزي المحتشم والذوق العام داخل المنطقة',
    ],
    isHot: true,
    tiers: [
      {
        id: 'regular',
        name: 'General Admission',
        nameAr: 'تذكرة دخول عامة',
        price: 45,
        available: true,
        remaining: 180,
        description: 'دخول كافة المناطق العامة والأسواق والمجسمات التراثية العالمية',
        color: '#6366f1',
      },
      {
        id: 'vip',
        name: 'VIP Fast Track Pass',
        nameAr: 'تذكرة كبار الشخصيات (مسار سريع Fast Track)',
        price: 150,
        available: true,
        remaining: 32,
        description: 'دخول سريع ومباشر لكافة الألعاب والتجارب والمطاعم بدون انتظار',
        color: '#f59e0b',
      },
    ],
    seatingMap: generateVenueSeatingMap('theater', 'بوليفارد وورلد'),
  },
  {
    id: 'alhilal-vs-alnassr-derby',
    title: 'Riyadh Derby: Al Hilal vs Al Nassr (SPL)',
    titleAr: 'ديربي الرياض: الهلال ضد النصر (دوري روشن للمحترفين)',
    slug: 'alhilal-vs-alnassr-spl',
    url: 'https://webook.com/ar/explore',
    category: 'دوري روشن السعودي',
    location: 'Kingdom Arena, Riyadh',
    locationAr: 'المملكة أرينا، الرياض',
    date: 'الجمعة، 8:00 مساءً',
    datesAvailable: ['2026-10-15', '2026-10-16'],
    timesAvailable: ['20:00 - 22:30'],
    image: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=1000&auto=format&fit=crop',
    bannerImage: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?q=80&w=1400&auto=format&fit=crop',
    descriptionAr: 'القمة الجماهيرية الكبرى في الدوري السعودي للمحترفين تجمع زعيم آسيا نادي الهلال ضد العالمي نادي النصر بقيادة كريستيانو رونالدو على أرضية تحفة الملاعب "المملكة أرينا" بالرياض في أجواء حماسية لا تتكرر.',
    organizer: 'رابطة الدوري السعودي للمحترفين (Roshn Saudi League)',
    ageRestriction: 'متاح للجميع بتذكرة مخصصة',
    termsAr: [
      'التذكرة شخصية ومربوطة بحساب Webook وتطبيق توكلنا',
      'يمنع إدخال الألعاب النارية أو مكبرات الصوت غير المصرحة',
      'تفتح بوابات المملكة أرينا قبل انطلاق صافرة البداية بـ 3 ساعات',
    ],
    isHot: true,
    tiers: [
      {
        id: 'cat3',
        name: 'Behind Goal (North/South)',
        nameAr: 'الدرجة الثالثة (خلف المرمى)',
        price: 125,
        available: true,
        remaining: 25,
        description: 'مدرجات الألتراس ورابطة المشجعين خلف المرمى مباشرة',
        color: '#3b82f6',
      },
      {
        id: 'cat1',
        name: 'Main Stand (East)',
        nameAr: 'الدرجة الأولى (الواجهة الشرقية)',
        price: 350,
        available: true,
        remaining: 12,
        description: 'رؤية مركزية ممتازة لوسط الملعب ودكة البدلاء',
        color: '#10b981',
      },
      {
        id: 'vip',
        name: 'Royal Lounge VIP',
        nameAr: 'المنصة الملكية VIP',
        price: 1200,
        available: true,
        remaining: 4,
        description: 'ضيافة فندقية 5 نجوم وبوفيه مفتوح مع مقاعد جلدية فاخرة',
        color: '#f59e0b',
      },
    ],
    seatingMap: generateVenueSeatingMap('stadium', 'المملكة أرينا'),
  },
  {
    id: 'boulevard-city-events',
    title: 'Boulevard City - Riyadh Season Hub',
    titleAr: 'بوليفارد سيتي - قلب موسم الرياض ومسارحه',
    slug: 'boulevard-city',
    url: 'https://webook.com/ar/explore',
    category: 'موسم الرياض',
    location: 'Boulevard City, Hittin, Riyadh',
    locationAr: 'بوليفارد سيتي، الرياض',
    date: 'مفتوح يومياً من 4 مساءً',
    datesAvailable: ['2026-09-24', '2026-09-25', '2026-09-26'],
    timesAvailable: ['16:00 - 02:00'],
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1000&auto=format&fit=crop',
    bannerImage: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1400&auto=format&fit=crop',
    descriptionAr: 'منطقة بوليفارد سيتي هي النبض الدائم لموسم الرياض، حيث تتواجد أكبر المسارح مثل مسرح محمد عبده ومسرح بكر الشدي، بالإضافة لمطاعم النافورة الراقصة وأحدث تجارب الواقع الافتراضي والألعاب الترفيهية.',
    organizer: 'الهيئة العامة للترفيه',
    ageRestriction: 'مناسب لجميع الأعمار',
    termsAr: [
      'الدخول مجاني لبعض المناطق وتذاكر خاصة للعروض والمسارح',
      'ممنوع دخول الدراجات الهوائية والحيوانات الأليفة',
    ],
    isHot: true,
    tiers: [
      {
        id: 'regular',
        name: 'Zone Access',
        nameAr: 'تذكرة الدخول للبوليفارد',
        price: 50,
        available: true,
        remaining: 240,
        description: 'دخول الفعاليات الميدانية وعروض النافورة والأسواق',
        color: '#6366f1',
      },
      {
        id: 'vip',
        name: 'VIP All-Access',
        nameAr: 'تذكرة كبار الشخصيات الشاملة',
        price: 180,
        available: true,
        remaining: 40,
        description: 'مواقف خاصة ودخول سريع لمنصات المشاهدة الممتازة',
        color: '#f59e0b',
      },
    ],
    seatingMap: generateVenueSeatingMap('theater', 'بوليفارد سيتي'),
  },
  {
    id: 'wonder-garden-riyadh',
    title: 'Wonder Garden - Riyadh Season',
    titleAr: 'وندر جاردن - مدينة الملاهي الخيالية الساحرة',
    slug: 'wonder-garden',
    url: 'https://webook.com/ar/explore',
    category: 'موسم الرياض',
    location: 'King Fahd Road, Riyadh',
    locationAr: 'طريق الملك فهد، شمال الرياض',
    date: 'مفتوح يومياً من 4 مساءً',
    datesAvailable: ['2026-09-24', '2026-09-25', '2026-09-26'],
    timesAvailable: ['16:00 - 01:00'],
    image: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?q=80&w=1000&auto=format&fit=crop',
    bannerImage: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=1400&auto=format&fit=crop',
    descriptionAr: 'وندر جاردن أول مدينة ترفيهية متكاملة بطابع سحري خلاب، تشمل 3 مناطق متميزة (حديقة الفراشات الساحرة، الغابة المضيئة، عالم المغامرات)، مع أكثر من 40 لعبة ركوب وتجارب عائلية ممتعة.',
    organizer: 'الهيئة العامة للترفيه',
    ageRestriction: 'مناسب لجميع أفراد الأسرة',
    termsAr: [
      'تذكرة الألعاب تباع بشكل منفصل أو بباقات مخفضة داخل الحديقة',
      'يمنع التدخين خارج المناطق المخصصة',
    ],
    isHot: true,
    tiers: [
      {
        id: 'regular',
        name: 'Entry Ticket',
        nameAr: 'تذكرة دخول الحديقة',
        price: 35,
        available: true,
        remaining: 350,
        description: 'دخول الحديقة واستكشاف المناطق الخيالية والعروض الحية',
        color: '#10b981',
      },
      {
        id: 'vip',
        name: 'Unlimited Rides VIP',
        nameAr: 'باقة الألعاب اللامحدودة VIP',
        price: 195,
        available: true,
        remaining: 50,
        description: 'دخول الحديقة مع ركوب غير محدود لكافة الألعاب طوال اليوم',
        color: '#f59e0b',
      },
    ],
    seatingMap: generateVenueSeatingMap('zone', 'وندر جاردن'),
  },
  {
    id: 'alawwal-park-alnassr-matches',
    title: 'Al Nassr FC Home Matches (Alawwal Park)',
    titleAr: 'تذاكر مباريات نادي النصر السعودي (الأول بارك)',
    slug: 'alnassr-alawwal-park',
    url: 'https://webook.com/ar/explore',
    category: 'دوري روشن السعودي',
    location: 'Alawwal Park, King Saud University, Riyadh',
    locationAr: 'استاد الأول بارك، جامعة الملك سعود، الرياض',
    date: 'السبت القادم، 9:00 مساءً',
    datesAvailable: ['2026-10-20'],
    timesAvailable: ['21:00 - 23:30'],
    image: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?q=80&w=1000&auto=format&fit=crop',
    bannerImage: 'https://images.unsplash.com/photo-1489944445391-11dd35574549?q=80&w=1400&auto=format&fit=crop',
    descriptionAr: 'عش متعة كرة القدم العالمية وشاهد أساطير النصر في معقلهم الرسمي استاد الأول بارك، مع أحدث تقنيات الإضاءة والصوت والمقاعد القريبة جداً من أرضية الميدان.',
    organizer: 'نادي النصر السعودي وشركة الوسائل SMC',
    ageRestriction: 'متاح للجميع',
    termsAr: [
      'الدخول عبر البوابات الإلكترونية باستخدام تطبيق Webook',
      'يجب الجلوس في المقعد والصف المخصص والمحدد على التذكرة بدقة',
    ],
    isHot: true,
    tiers: [
      {
        id: 'cat3',
        name: 'Goal Stand (Cat 3)',
        nameAr: 'مدرجات خلف المرمى',
        price: 100,
        available: true,
        remaining: 45,
        description: 'أجواء التشجيع الصاخبة خلف المرمى',
        color: '#eab308',
      },
      {
        id: 'cat1',
        name: 'Main East Stand',
        nameAr: 'الدرجة الأولى (الواجهة)',
        price: 250,
        available: true,
        remaining: 20,
        description: 'رؤية مثالية في منتصف الملعب',
        color: '#10b981',
      },
      {
        id: 'vip',
        name: 'Lounge VIP Box',
        nameAr: 'لاونج كبار الشخصيات VIP',
        price: 950,
        available: true,
        remaining: 6,
        description: 'ضيافة فاخرة وإطلالة بانورامية خاصة للملعب',
        color: '#f59e0b',
      },
    ],
    seatingMap: generateVenueSeatingMap('stadium', 'الأول بارك'),
  },
  {
    id: 'alittihad-aljawhara-stadium',
    title: 'Al Ittihad FC Matches (Al Jawhara Stadium)',
    titleAr: 'تذاكر مباريات نادي الاتحاد السعودي (ملعب الجوهرة بجدة)',
    slug: 'alittihad-aljawhara',
    url: 'https://webook.com/ar/explore',
    category: 'دوري روشن السعودي',
    location: 'King Abdullah Sports City, Jeddah',
    locationAr: 'مدينة الملك عبدالله الرياضية (الجوهرة المشعة)، جدة',
    date: 'الخميس، 8:30 مساءً',
    datesAvailable: ['2026-10-25'],
    timesAvailable: ['20:30 - 23:00'],
    image: 'https://images.unsplash.com/photo-1489944445391-11dd35574549?q=80&w=1000&auto=format&fit=crop',
    descriptionAr: 'معقل النمور وعميد الأندية السعودية نادي الاتحاد على استاد الجوهرة بجدة مع أهازيج جمهور الذهب الشهيرة في أقوى مواجهات دوري روشن وكأس الملك.',
    organizer: 'نادي الاتحاد السعودي',
    ageRestriction: 'متاح للجميع',
    termsAr: [
      'الجلوس في المقعد المحدد في التذكرة',
      'تمنع المواد الصلبة والعبوات الزجاجية',
    ],
    isHot: true,
    tiers: [
      {
        id: 'cat3',
        name: 'Behind Goal',
        nameAr: 'مدرجات الدرجة الثالثة',
        price: 80,
        available: true,
        remaining: 60,
        description: 'مدرجات التشجيع خلف المرميين',
        color: '#3b82f6',
      },
      {
        id: 'cat1',
        name: 'East Stand',
        nameAr: 'الدرجة الأولى (الواجهة المركزية)',
        price: 220,
        available: true,
        remaining: 22,
        description: 'رؤية واسعة لكامل الملعب',
        color: '#10b981',
      },
      {
        id: 'vip',
        name: 'Silver / Gold VIP',
        nameAr: 'المنصة الذهبية VIP',
        price: 850,
        available: true,
        remaining: 8,
        description: 'مقاعد مريحة في المنصة الرئيسية مع مواقف خاصة',
        color: '#f59e0b',
      },
    ],
    seatingMap: generateVenueSeatingMap('stadium', 'استاد الجوهرة'),
  },
  {
    id: 'mohammed-abdo-arena-concerts',
    title: 'Mohammed Abdo Arena Mega Concerts',
    titleAr: 'حفلات مسرح محمد عبده أرينا (موسم الرياض)',
    slug: 'mohammed-abdo-arena',
    url: 'https://webook.com/ar/explore',
    category: 'حفلات غنائية',
    location: 'Mohammed Abdo Arena, Boulevard City, Riyadh',
    locationAr: 'مسرح فنان العرب محمد عبده أرينا، بوليفارد سيتي، الرياض',
    date: 'الخميس والجمعة، 9:30 مساءً',
    datesAvailable: ['2026-11-05', '2026-11-06'],
    timesAvailable: ['21:30 - 01:00'],
    image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=1000&auto=format&fit=crop',
    descriptionAr: 'المسرح الأيقوني الأكبر في الشرق الأوسط للحفلات الغنائية الكبرى، يجمع نخبة نجوم الطرب العربي والخليجي والعالمي في ليالي طربية استثنائية مع هندسة صوتية متطورة.',
    organizer: 'شركة روتانا والهيئة العامة للترفيه',
    ageRestriction: 'ممنوع دخول الأطفال تحت سن 10 سنوات',
    termsAr: [
      'التذاكر غير قابلة للإلغاء أو الاستبدال',
      'يمنع إدخال الكاميرات الاحترافية غير المصرحة',
      'يبدأ الدخول قبل موعد الحفل بساعتين',
    ],
    isHot: true,
    tiers: [
      {
        id: 'regular',
        name: 'Bronze & Silver Seated',
        nameAr: 'المقاعد العامة (برونزية وفضية)',
        price: 250,
        available: true,
        remaining: 35,
        description: 'مقاعد مريحة في المدرج الرئيسي مع شاشات عملاقة',
        color: '#8b5cf6',
      },
      {
        id: 'vip',
        name: 'Golden Circle & Royal VIP',
        nameAr: 'الدائرة الذهبية كبار الشخصيات VIP',
        price: 850,
        available: true,
        remaining: 5,
        description: 'الصفوف الأولى أمام خشبة المسرح مباشرة مع ضيافة',
        color: '#f59e0b',
      },
    ],
    seatingMap: generateVenueSeatingMap('concert', 'مسرح محمد عبده أرينا'),
  },
  {
    id: 'bakr-al-sheddi-theater',
    title: 'Bakr Al-Sheddi Theater Comedy & Drama',
    titleAr: 'مسرحيات مسرح بكر الشدي (أحدث العروض الكوميدية)',
    slug: 'bakr-al-sheddi-theater',
    url: 'https://webook.com/ar/explore',
    category: 'مسرحيات وكوميديا',
    location: 'Bakr Al-Sheddi Theater, Boulevard City, Riyadh',
    locationAr: 'مسرح بكر الشدي، بوليفارد سيتي، الرياض',
    date: 'عروض مستمرة أسبوعياً',
    datesAvailable: ['2026-10-10', '2026-10-11', '2026-10-12'],
    timesAvailable: ['21:00 - 23:30', '18:00 - 20:30'],
    image: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?q=80&w=1000&auto=format&fit=crop',
    descriptionAr: 'أقوى المسرحيات العربية والخليجية الكوميدية الجديدة بمشاركة ألمع نجوم الكوميديا في الوطن العربي، مع صالة عرض مسرحية بمواصفات عالمية تضمن رؤية مثالية وصوت نقي.',
    organizer: 'الهيئة العامة للترفيه وموسم الرياض',
    ageRestriction: 'متاح من سن 8 سنوات وما فوق',
    termsAr: [
      'يمنع التصوير أثناء العرض المسرحي احتراماً لحقوق العمل',
      'تغلق الأبواب عند بدء العرض ولا يسمح بالدخول حتى الاستراحة',
    ],
    isHot: true,
    tiers: [
      {
        id: 'regular',
        name: 'Regular Hall',
        nameAr: 'المقاعد العادية (الصالة الرئيسية)',
        price: 95,
        available: true,
        remaining: 40,
        description: 'مقاعد مريحة مع زاوية رؤية مستقيمة للمسرح',
        color: '#8b5cf6',
      },
      {
        id: 'vip',
        name: 'VIP Front Orchestra',
        nameAr: 'كبار الشخصيات VIP (الصفوف الأولى)',
        price: 250,
        available: true,
        remaining: 8,
        description: 'صفوف A و B و C المواجهة لنجوم المسرح مباشرة',
        color: '#f59e0b',
      },
    ],
    seatingMap: generateVenueSeatingMap('theater', 'مسرح بكر الشدي'),
  },
  {
    id: 'riyadh-racing-season',
    title: 'Riyadh Racing Season (King Abdulaziz Racecourse)',
    titleAr: 'موسم سباقات الخيل بالرياض (ميدان الملك عبدالعزيز)',
    slug: 'riyadh-racing-season',
    url: 'https://webook.com/ar/explore',
    category: 'فعاليات رياضية',
    location: 'King Abdulaziz Racecourse, Janadriyah, Riyadh',
    locationAr: 'ميدان الملك عبدالعزيز للفروسية، الجنادرية، الرياض',
    date: 'الجمعة والسبت، 3:30 عصراً',
    datesAvailable: ['2026-10-02', '2026-10-03'],
    timesAvailable: ['15:30 - 20:00'],
    image: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=1000&auto=format&fit=crop',
    descriptionAr: 'أعرق وأقوى سباقات الخيل الأصيلة في الشرق الأوسط بميدان الملك عبدالعزيز بالجنادرية، يتنافس فيها نخبة الفرسان وأعرق الإسطبلات العالمية على كؤوس وجوائز موسم السباقات الكبرى.',
    organizer: 'نادي سباقات الخيل السعودي (Jockey Club of Saudi Arabia)',
    ageRestriction: 'متاح لجميع أفراد الأسرة',
    termsAr: [
      'الدخول مسموح للعائلات والأفراد',
      'يتوفر مواقف سيارات واسعة مجانية ومنطقة مطاعم عائلية',
    ],
    isHot: false,
    tiers: [
      {
        id: 'regular',
        name: 'Grandstand General',
        nameAr: 'مدرجات المنصة العامة',
        price: 30,
        available: true,
        remaining: 150,
        description: 'إطلالة مباشرة على مسار السباق وخط النهاية',
        color: '#3b82f6',
      },
      {
        id: 'vip',
        name: 'Equestrian Club VIP Lounge',
        nameAr: 'لاونج كبار الشخصيات والملاك VIP',
        price: 350,
        available: true,
        remaining: 15,
        description: 'جلسات مكيفة راقية مع بوفيه شاي وقهوة سعودية وإطلالة علوية',
        color: '#f59e0b',
      },
    ],
    seatingMap: generateVenueSeatingMap('theater', 'ميدان الملك عبدالعزيز'),
  },
  {
    id: 'riyadh-boxing-championship',
    title: 'Riyadh Season Heavyweight Boxing Championship',
    titleAr: 'نزال أبطال الوزن الثقيل للملاكمة (موسم الرياض)',
    slug: 'riyadh-boxing-championship',
    url: 'https://webook.com/ar/explore',
    category: 'ملاكمة ورياضات قتالية',
    location: 'Kingdom Arena, Riyadh',
    locationAr: 'المملكة أرينا، الرياض',
    date: 'السبت القادم، 8:00 مساءً',
    datesAvailable: ['2026-11-15'],
    timesAvailable: ['20:00 - 01:00'],
    image: 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?q=80&w=1000&auto=format&fit=crop',
    descriptionAr: 'النزال العالمي الأضخم في الملاكمة للوزن الثقيل يجمع أساطير الحلبة في عاصمة الترفيه والرياضة العالمية الرياض داخل المملكة أرينا، يبث مباشرة لملايين المشاهدين حول العالم.',
    organizer: 'الهيئة العامة للترفيه ومجلس الملاكمة العالمي',
    ageRestriction: 'متاح لمن هم فوق سن 12 سنة',
    termsAr: [
      'التذاكر غير قابلة للإلغاء أو الاسترجاع نهائياً',
      'يمنع الوقوف في الممرات لضمان سلامة وأمان الحضور',
    ],
    isHot: true,
    tiers: [
      {
        id: 'regular',
        name: 'Upper Bowl Arena',
        nameAr: 'المدرجات العلوية',
        price: 180,
        available: true,
        remaining: 40,
        description: 'رؤية علوية كاملة لحلبة الملاكمة وشاشات العرض الكبرى',
        color: '#8b5cf6',
      },
      {
        id: 'vip',
        name: 'Ringside VIP Front Row',
        nameAr: 'مقاعد الحلبة الأمامية Ringside VIP',
        price: 1800,
        available: true,
        remaining: 4,
        description: 'مقاعد ملاصقة لحلبة النزال مباشرة مع ضيافة فاخرة واستقبال VIP',
        color: '#f59e0b',
      },
    ],
    seatingMap: generateVenueSeatingMap('stadium', 'المملكة أرينا حلبة النزال'),
  },
];

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
}

class WebookSyncManager {
  private events: WebookEvent[] = (() => {
    // Combine real live Webook catalog with curated highlight events, deduplicated by url/slug
    const all = [...REAL_WEBOOK_LIVE_CATALOG, ...LIVE_WEBOOK_CATALOG];
    const seen = new Set<string>();
    const unique: WebookEvent[] = [];
    for (const e of all) {
      const key = e.url || e.slug || e.id;
      if (!seen.has(key)) {
        seen.add(key);
        // Ensure every seating map matches the exact architectural venue blueprint
        const blueprint = detectVenueBlueprint(`${e.title || ''} ${e.titleAr || ''} ${e.slug || ''} ${e.id || ''}`, e.locationAr || '', e.category || '');
        const seatingMap = generateVenueSeatingMap(blueprint, e.locationAr || e.titleAr || '', e.tiers);
        unique.push({
          ...e,
          seatingMap,
        });
      }
    }
    return unique;
  })();

  private listeners: ((events: WebookEvent[], status: WebookSyncStatus) => void)[] = [];
  private pollIntervalId: any = null;
  private newReleaseListeners: ((newEvents: WebookEvent[]) => void)[] = [];
  private status: WebookSyncStatus = {
    lastSyncTimestamp: new Date().toLocaleTimeString('ar-SA'),
    isSyncing: false,
    totalEventsSynced: REAL_WEBOOK_LIVE_CATALOG.length,
    activeSessions: 1,
    connectedToWebookApi: true,
    syncIntervalSeconds: 15,
    isPollingActive: false,
    newReleasesCount: 0,
  };

  constructor() {
    this.status.totalEventsSynced = this.events.length;
    // Auto-fetch full catalog and start real-time polling
    setTimeout(() => {
      this.fetchAllEventsWithPagination();
      this.startRealtimePolling(15000);
    }, 100);
  }

  public getEvents(): WebookEvent[] {
    return this.events;
  }

  public getStatus(): WebookSyncStatus {
    return this.status;
  }

  /**
   * Fetches the FULL official catalog from Webook API (handling all 440+ events),
   * dynamically enriching each event with its venue blueprint and seating map.
   */
  public async fetchAllEventsWithPagination(
    token?: string,
    onProgress?: (loaded: number, total: number) => void
  ): Promise<WebookEvent[]> {
    this.status.isSyncing = true;
    this.notify();

    try {
      const cleanToken = token?.trim();
      const headers: Record<string, string> = { 'Accept': 'application/json' };
      if (cleanToken) {
        headers['Authorization'] = `Bearer ${cleanToken}`;
      }

      console.log('[WEBOOK SYNC MANAGER] Fetching full official catalog (all=true)...');
      const response = await fetch('/api/webook/live-catalog?all=true', {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`API returned HTTP ${response.status}`);
      }

      const json = await response.json();
      if (json && json.success && Array.isArray(json.data)) {
        const rawList = json.data;
        const total = json.total || rawList.length;

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
            category: raw.category || 'فعاليات Webook',
            location: raw.location || 'Saudi Arabia',
            locationAr: raw.locationAr || 'المملكة العربية السعودية',
            date: raw.date || 'متاح للحجز الفوري',
            datesAvailable: raw.datesAvailable && raw.datesAvailable.length > 0 ? raw.datesAvailable : ['2026-10-15', '2026-10-16', '2026-10-20'],
            timesAvailable: raw.timesAvailable && raw.timesAvailable.length > 0 ? raw.timesAvailable : ['20:00 - 23:00'],
            image: raw.image || 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?q=80&w=800&auto=format&fit=crop',
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

        // Deduplicate against existing custom events
        const seen = new Set<string>();
        const merged: WebookEvent[] = [];

        for (const e of processedEvents) {
          if (!seen.has(e.id)) {
            seen.add(e.id);
            merged.push(e);
          }
        }

        // Retain any user-imported custom events
        for (const old of this.events) {
          if (old.id.startsWith('custom-') && !seen.has(old.id)) {
            merged.unshift(old);
            seen.add(old.id);
          }
        }

        this.events = merged;
        this.status.totalEventsSynced = this.events.length;
        this.status.lastSyncTimestamp = new Date().toLocaleTimeString('ar-SA');
        if (onProgress) onProgress(merged.length, total);
        console.log(`[WEBOOK SYNC MANAGER] Full catalog synchronized: ${this.events.length} events loaded.`);
      }
    } catch (err: any) {
      console.warn('[WEBOOK SYNC MANAGER] Failed to fetch full catalog:', err.message);
    } finally {
      this.status.isSyncing = false;
      this.notify();
    }

    return this.events;
  }

  /**
   * Starts real-time polling to check the platform API and automatically
   * inject newly released events into the app instantly.
   */
  public startRealtimePolling(intervalMs: number = 15000) {
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
    }

    this.status.isPollingActive = true;
    this.status.syncIntervalSeconds = Math.round(intervalMs / 1000);
    this.notify();

    console.log(`[WEBOOK REAL-TIME POLLING] Started continuous interval sync (${intervalMs}ms)...`);

    this.pollIntervalId = setInterval(async () => {
      try {
        const knownCount = this.events.length;
        const res = await fetch(`/api/webook/live-catalog/poll?knownCount=${knownCount}`);
        if (!res.ok) return;

        const data = await res.json();
        this.status.lastPolledTimestamp = new Date().toLocaleTimeString('ar-SA');

        if (data && data.success && data.hasNew && Array.isArray(data.newEvents) && data.newEvents.length > 0) {
          console.log(`[WEBOOK REAL-TIME POLLING] 🚨 Detected ${data.newEvents.length} newly released events! Injecting instantly...`);

          const newlyInjected: WebookEvent[] = [];
          for (const raw of data.newEvents) {
            if (this.events.some((e) => e.id === raw.id || e.slug === raw.slug)) {
              continue;
            }

            const bp = (raw.venueBlueprint as VenueBlueprintId) || 
              detectVenueBlueprint(`${raw.title || ''} ${raw.titleAr || ''} ${raw.slug || ''}`, raw.locationAr || '', raw.category || '');
            const seatingMap = generateVenueSeatingMapByBlueprint(bp, raw.locationAr || raw.titleAr, raw.tiers || []);

            const formatted: WebookEvent = {
              ...raw,
              id: raw.id || raw.slug,
              slug: raw.slug || raw.id,
              title: raw.title || raw.titleAr,
              titleAr: raw.titleAr || raw.title,
              url: raw.url || `https://webook.com/ar/events/${raw.slug || raw.id}`,
              category: raw.category || 'رياضة ومباريات',
              location: raw.location || 'Kingdom Arena, Riyadh',
              locationAr: raw.locationAr || 'المملكة أرينا، الرياض',
              date: raw.date || 'إطلاق تذاكر رسمي عاجل',
              datesAvailable: raw.datesAvailable || ['2026-10-18'],
              timesAvailable: raw.timesAvailable || ['20:30 - 23:00'],
              image: raw.image || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=1200&auto=format&fit=crop',
              tiers: raw.tiers || [],
              seatingMap,
              isHot: true,
              newRelease: true,
              venueType: raw.venueType || 'stadium',
              isSeated: raw.isSeated ?? true,
              bookingSeatsWithoutMap: raw.bookingSeatsWithoutMap ?? false,
              teams: raw.teams,
              subEvents: raw.subEvents,
            };

            newlyInjected.push(formatted);
          }

          if (newlyInjected.length > 0) {
            this.events = [...newlyInjected, ...this.events];
            this.status.totalEventsSynced = this.events.length;
            this.status.newReleasesCount = (this.status.newReleasesCount || 0) + newlyInjected.length;
            this.status.lastSyncTimestamp = new Date().toLocaleTimeString('ar-SA');
            
            // Audio alert notification
            try {
              playReservationChime();
            } catch {}

            // Notify subscribers
            this.notify();
            this.newReleaseListeners.forEach((cb) => cb(newlyInjected));
          }
        }
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

  /**
   * Helper to trigger a live newly released event on the server to immediately test
   * real-time polling detection and auto-injection.
   */
  public async triggerReleaseSimulation(titleAr?: string, venue?: string): Promise<boolean> {
    try {
      const res = await fetch('/api/webook/live-catalog/trigger-release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titleAr, venue }),
      });
      const data = await res.json();
      if (data && data.success) {
        // Trigger immediate polling check
        setTimeout(() => {
          this.forceSyncNow();
        }, 100);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  public forceSyncNow(): void {
    this.fetchAllEventsWithPagination();
  }

  public async syncEventWithOfficialWebook(slugOrUrl: string): Promise<WebookEvent | null> {
    try {
      this.status.isSyncing = true;
      this.notify();

      let targetSlug = (slugOrUrl || '').trim();
      const match = targetSlug.match(/events\/([^/?#]+)/) || targetSlug.match(/\/([a-zA-Z0-9_\-]+)$/);
      if (match) {
        targetSlug = match[1];
      }
      targetSlug = targetSlug.replace(/^https?:\/\/[^/]+\//, '').replace(/\//g, '-').replace(/\/book$/, '');

      const res = await fetch(`/api/webook/sync-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: targetSlug, url: slugOrUrl }),
      });

      if (!res.ok) return null;
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
    } catch (err) {
      console.error('Failed to sync event with official Webook:', err);
      return null;
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

  public addCustomWebookEvent(url: string, title?: string): WebookEvent {
    let cleanSlug = 'custom-event';
    try {
      const parsed = new URL(url);
      const parts = parsed.pathname.split('/').filter(Boolean);
      cleanSlug = parts[parts.length - 1] || 'custom-event';
    } catch (e) {
      cleanSlug = url.replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 30);
    }

    const newEvent: WebookEvent = {
      id: 'custom-' + Date.now(),
      title: title || `Webook Live Event: ${cleanSlug}`,
      titleAr: title || `فعالية Webook المستوردة: ${cleanSlug}`,
      slug: cleanSlug,
      url: url.startsWith('http') ? url : `https://webook.com/ar/explore`,
      category: 'فعاليات Webook المخصصة',
      location: 'Official Webook Venue, Riyadh',
      locationAr: 'الموقع الرسمي للفعالية في Webook، الرياض',
      date: 'اليوم وطوال الأسبوع',
      datesAvailable: ['2026-09-24', '2026-09-25'],
      timesAvailable: ['20:00 - 23:00'],
      image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1000&auto=format&fit=crop',
      descriptionAr: `فعالية مضافة برابط مباشر من منصة Webook الرسمية: (${url}). تم تجهيز مخطط مقاعد افتراضي كامل لها لتمكين البوت من قنص وحجز التذاكر فوراً.`,
      organizer: 'منصة Webook الرسمية',
      ageRestriction: 'متاح للجميع',
      termsAr: ['التذاكر خاضعة لسياسة Webook الرسمية'],
      isHot: true,
      tiers: [
        {
          id: 'regular',
          name: 'Regular',
          nameAr: 'المقاعد العادية Regular',
          price: 100,
          available: true,
          remaining: 50,
          description: 'تذكرة قياسية مفعّلة في النظام',
          color: '#8b5cf6',
        },
        {
          id: 'vip',
          name: 'VIP',
          nameAr: 'كبار الشخصيات VIP',
          price: 300,
          available: true,
          remaining: 10,
          description: 'تذكرة المنصة الأولى VIP',
          color: '#f59e0b',
        },
      ],
      seatingMap: generateVenueSeatingMap(detectVenueBlueprint(cleanSlug, '', ''), cleanSlug, [
        {
          id: 'regular',
          name: 'Regular',
          nameAr: 'المقاعد العادية Regular',
          price: 100,
          available: true,
          remaining: 50,
          description: 'تذكرة قياسية مفعّلة في النظام',
          color: '#8b5cf6',
        },
        {
          id: 'vip',
          name: 'VIP',
          nameAr: 'كبار الشخصيات VIP',
          price: 300,
          available: true,
          remaining: 10,
          description: 'تذكرة المنصة الأولى VIP',
          color: '#f59e0b',
        },
      ]),
    };

    this.events = [newEvent, ...this.events];
    this.status.totalEventsSynced = this.events.length;
    this.notify();
    return newEvent;
  }

  private notify() {
    this.listeners.forEach((cb) => cb(this.events, this.status));
  }
}

export const webookSyncManager = new WebookSyncManager();
