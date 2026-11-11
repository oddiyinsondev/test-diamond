import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../api/endpoints';
import {
  localizeSubject,
  localizeGrade,
  localizeTitleText,
  localizeExperienceText,
} from '../i18n/portalUtils';

const I18N = {
  uz: {
    liveBadge: 'DIAMOND LIVE',
    tickerItems: [
      { num: '2026–2027', txt: "O'quv yili qabuli davom etmoqda", icon: 'fa-gem' },
      { num: '120+', txt: 'Xalqaro va Respublika olimpiada testlari', icon: 'fa-trophy' },
      { num: '1,500+', txt: "Iqtidorli yoshlar ta'lim olmoqda", icon: 'fa-graduation-cap' },
      { num: 'IT & Robototexnika', txt: "bo'yicha zamonaviy laboratoriyalar", icon: 'fa-laptop-code' },
      { num: 'IELTS & SAT', txt: 'maqsadli tayyorgarlik dasturlari', icon: 'fa-language' },
      { num: '100%', txt: 'Shaffof avtomatlashtirilgan baholash tizimi', icon: 'fa-shield-halved' },
      { num: '5,000+', txt: 'Nusxadan iborat boy kutubxona fondi', icon: 'fa-book-open' }
    ],
    heroSlides: [
      {
        badge: "2026–2027 O'QUV YILI • QABUL OCHIQ",
        title: <>Kelajak <span>bilimdan</span> boshlanadi.</>,
        desc: "Fundamental fanlarni chuqur o'rganish, mustaqil tahliliy fikrlash va har bir o'quvchining ichki qobiliyatini yuksak natijalarga olib chiqish maskani.",
        btn1: 'Qabulga yozilish',
        btn2: 'Maktab haqida'
      },
      {
        badge: 'KELAJAK KASBLARI VA IT',
        title: <>Amaliy dasturlash va <span>innovatsiyalar.</span></>,
        desc: "Robototexnika, axborot texnologiyalari va amaliy loyihalar orqali yosh dasturchilarni xalqaro darajadagi zamonaviy kasblarga puxta tayyorlaymiz.",
        btn1: 'IT Dasturlari',
        btn2: 'Mentorlarimiz'
      },
      {
        badge: 'XALQARO DARAJA VA OLIMPIADALAR',
        title: <>G'alabalar sari <span>dadil qadam.</span></>,
        desc: 'Cambridge standartlari, intensiv IELTS va SAT darslari hamda xalqaro olimpiada sovrinlari bilan nufuzli oliygohlarga grantlar imkoniyati.',
        btn1: 'Yutuqlarimiz',
        btn2: "Bog'lanish"
      }
    ],
    statStudents: "O'quvchilar",
    statTests: 'Olimpiada & Testlar',
    statCapacity: "O'quvchi Sig'imi",
    statFair: 'Shaffof Baholash',

    whyBadge: 'Nega Diamond School?',
    whyTitle: <>Bilim, Tajriba va <span>Imkoniyat</span></>,
    whyDesc: "Biz har bir o'quvchiga o'z maqsadiga ishonch bilan erishishi uchun mustahkam poydevor beramiz.",
    why1Title: 'Kuchli Ustozlar Jamoasi',
    why1Desc: "Xalqaro sertifikatlarga va ko'p yillik tajribaga ega bo'lgan nufuzli pedagog-mentorlar har bir o'quvchiga individual yondashadi.",
    why2Title: 'Zamonaviy IT & Xorijiy Tillar',
    why2Desc: 'Dasturlash, robototexnika va chuqurlashtirilgan chet tillari amaliy darslar orqali zamonaviy kasblarga poydevor bo\'ladi.',
    why3Title: 'Olimpiadalar va Yutuqlar',
    why3Desc: "O'quvchilar muntazam respublika va xalqaro olimpiadalarga tayyorlanadi, o'z bilimlarini sinovdan o'tkazib grantlar yutadi.",

    tchBadge: 'Pedagoglar',
    tchTitle: <>Bizning <span>Ustozlarimiz</span></>,
    tchSubtitle: "Har bir fanni yuksak mahorat bilan o'rgatuvchi yetakchi mutaxassislar.",
    tchMoreBtn: 'Barcha ustozlar bilan tanishish',

    talentedBadge: 'Maktab Faxrlari',
    talentedTitle: <>Iqtidorli <span>O'quvchilar</span></>,
    talentedSubtitle: "Olimpiada va tanlovlar g'oliblari — bizning faxrimiz.",

    contactBadge: 'Qabul 2026–2027',
    contactTitle: <>Farzandingiz kelajagi uchun <span style={{ color: '#29B7E1', fontStyle: 'italic' }}>ilk qadam.</span></>,
    contactSubtitle: "Diamond School ta'lim muhiti va qabul shartlari haqida batafsil ma'lumot olish uchun biz bilan bog'laning.",
    cntLblCallback: "Qayta qo'ng'iroq xizmati:",
    cntCallbackNotice: "Siz qo'ng'iroq qilmaysiz — biz o'zimiz telefon qilamiz",
    cntCallbackHint: "Arizangizni qoldiring, mutaxassisimiz 15 daqiqada siz bilan bog'lanadi",
    cntLblAddr: 'Maktab manzili:',
    cntAddrText: 'Toshkent shahri, Yunusobod tumani, Amir Temur shohi, 120',
    cntLandmark: "Mo'ljal: Shahriston metro bekati",
    cntLblHours: 'Ish vaqti:',
    cntHoursText: 'Dushanba — Shanba, 08:30 — 18:00',
    cntFormTitle: 'Qabulga Yozilish',
    cntFormSub: "Ma'lumotlaringizni qoldiring, mutaxassisimiz siz bilan 15 daqiqa ichida bog'lanadi.",
    cntLblName: 'Ism va Familiyangiz *',
    cntLblPhoneInput: 'Telefon Raqamingiz *',
    cntLblGrade: 'Sinfni tanlang',
    cntBtnSend: 'Ariza Yuborish',
    cntSending: 'Yuborilmoqda...',
    cntSuccess: "Arizangiz muvaffaqiyatli qabul qilindi! 15 daqiqa ichida bog'lanamiz."
  },
  ru: {
    liveBadge: 'DIAMOND LIVE',
    tickerItems: [
      { num: '2026–2027', txt: 'Идет прием документов на новый учебный год', icon: 'fa-gem' },
      { num: '120+', txt: 'Международных и республиканских тестов', icon: 'fa-trophy' },
      { num: '1,500+', txt: 'Талантливых учеников получают знания', icon: 'fa-graduation-cap' },
      { num: 'IT & Робототехника', txt: 'современные лабораторные классы', icon: 'fa-laptop-code' },
      { num: 'IELTS & SAT', txt: 'целевые программы подготовки', icon: 'fa-language' },
      { num: '100%', txt: 'Прозрачная система автоматизированной оценки', icon: 'fa-shield-halved' },
      { num: '5,000+', txt: 'Книг в современном библиотечном фонде', icon: 'fa-book-open' }
    ],
    heroSlides: [
      {
        badge: '2026–2027 УЧЕБНЫЙ ГОД • ПРИЁМ ОТКРЫТ',
        title: <>Будущее <span>начинается</span> со знаний.</>,
        desc: 'Глубокое изучение фундаментальных наук, критическое мышление и раскрытие талантов каждого ученика для достижения высоких результатов.',
        btn1: 'Запись на приём',
        btn2: 'О школе'
      },
      {
        badge: 'ПРОФЕССИИ БУДУЩЕГО И IT',
        title: <>Практическое программирование и <span>инновации.</span></>,
        desc: 'Робототехника, информационные технологии и прикладные проекты готовят молодых специалистов к востребованным профессиям.',
        btn1: 'IT Программы',
        btn2: 'Наши Менторы'
      },
      {
        badge: 'МЕЖДУНАРОДНЫЙ УРОВЕНЬ И ОЛИМПИАДЫ',
        title: <>Уверенный шаг к <span>победам.</span></>,
        desc: 'Стандарты Cambridge, интенсивная подготовка к IELTS и SAT, призовые места на олимпиадах и гранты в ведущие университеты.',
        btn1: 'Достижения',
        btn2: 'Контакты'
      }
    ],
    statStudents: 'Ученики',
    statTests: 'Олимпиады и Тесты',
    statCapacity: 'Вместимость',
    statFair: 'Честная Оценка',

    whyBadge: 'Почему Diamond School?',
    whyTitle: <>Знания, Опыт и <span>Возможности</span></>,
    whyDesc: 'Мы создаем прочный фундамент, чтобы каждый ученик уверенно достигал своих больших целей.',
    why1Title: 'Сильная Команда Учителей',
    why1Desc: 'Ведущие педагоги-наставники с международными сертификатами обеспечивают индивидуальный подход к каждому ребенку.',
    why2Title: 'Современный IT и Языки',
    why2Desc: 'Практическое программирование, робототехника и иностранные языки готовят к востребованным профессиям будущего.',
    why3Title: 'Олимпиады и Победы',
    why3Desc: 'Системная подготовка к республиканским и международным олимпиадам, победы и гранты.',

    tchBadge: 'Педагоги',
    tchTitle: <>Наши <span>Учителя</span></>,
    tchSubtitle: 'Ведущие специалисты, обучающие каждому предмету на высшем уровне.',
    tchMoreBtn: 'Познакомиться со всеми учителями',

    talentedBadge: 'Гордость Школы',
    talentedTitle: <>Талантливые <span>Ученики</span></>,
    talentedSubtitle: 'Победители олимпиад и конкурсов — наша главная гордость.',

    contactBadge: 'Приём 2026–2027',
    contactTitle: <>Первый шаг к будущему <span style={{ color: '#29B7E1', fontStyle: 'italic' }}>вашего ребенка.</span></>,
    contactSubtitle: 'Свяжитесь с нами, чтобы узнать подробнее об учебных программах и условиях поступления.',
    cntLblCallback: 'Служба обратного звонка:',
    cntCallbackNotice: 'Вам не нужно звонить — мы сами вам перезвоним',
    cntCallbackHint: 'Оставьте заявку, и наш специалист свяжется с вами в течение 15 минут',
    cntLblAddr: 'Адрес школы:',
    cntAddrText: 'г. Ташкент, Юнусабадский район, проспект Амира Темура, 120',
    cntLandmark: 'Ориентир: станция метро Шахристан',
    cntLblHours: 'Режим работы:',
    cntHoursText: 'Понедельник — Суббота, 08:30 — 18:00',
    cntFormTitle: 'Запись на Приём',
    cntFormSub: 'Оставьте данные, наш специалист свяжется с вами в течение 15 минут.',
    cntLblName: 'Ваше Имя и Фамилия *',
    cntLblPhoneInput: 'Номер Телефона *',
    cntLblGrade: 'Выберите класс',
    cntBtnSend: 'Отправить Заявку',
    cntSending: 'Отправка...',
    cntSuccess: 'Ваша заявка успешно принята! Мы свяжемся с вами в течение 15 минут.'
  }
};

export default function LandingPage() {
  const { language } = useAuth();
  const { showToast } = useToast();
  const t = I18N[language] || I18N.uz;

  // 1. HERO SLIDER STATE
  const [currentHeroSlide, setCurrentHeroSlide] = useState(0);
  const heroTimerRef = useRef(null);
  const isHeroHoveredRef = useRef(false);
  const TOTAL_HERO_SLIDES = 3;

  useEffect(() => {
    function startHeroTimer() {
      if (heroTimerRef.current) clearInterval(heroTimerRef.current);
      heroTimerRef.current = setInterval(() => {
        if (!isHeroHoveredRef.current) {
          setCurrentHeroSlide((prev) => (prev + 1) % TOTAL_HERO_SLIDES);
        }
      }, 3500);
    }
    startHeroTimer();
    return () => {
      if (heroTimerRef.current) clearInterval(heroTimerRef.current);
    };
  }, []);

  const goToHeroSlide = (idx) => {
    setCurrentHeroSlide(idx);
  };
  const nextHeroSlide = () => {
    setCurrentHeroSlide((prev) => (prev + 1) % TOTAL_HERO_SLIDES);
  };
  const prevHeroSlide = () => {
    setCurrentHeroSlide((prev) => (prev - 1 + TOTAL_HERO_SLIDES) % TOTAL_HERO_SLIDES);
  };

  // 2. SHOWCASE DATA
  const [showcaseData, setShowcaseData] = useState({
    teachers: [],
    talentedStudents: [],
    siteSettings: {},
    stats: {},
  });

  useEffect(() => {
    async function loadData() {
      try {
        const data = await api.diamond.getShowcase();
        if (data) setShowcaseData(data);
      } catch (err) {
        console.warn('Could not load showcase:', err);
      }
    }
    loadData();
  }, [language]);

  // Default showcase teachers with complete profiles
  const isRu = language === 'ru';
  const defaultTeachers = [
    {
      id: 1,
      name: isRu ? 'Мастура Ешмуратова' : 'Mastura Yeshmuratova',
      subject: isRu ? 'Биология' : 'Biologiya',
      experience: isRu ? '15 лет опыта' : '15 yil tajriba',
      title: isRu ? 'Зав. кафедрой биологии' : 'Biologiya kafedrasi mudiri',
      image: '/static/img/teachers/mastura_clean.png',
      avgScore: '97%',
      studentsCount: '380+',
      quote: isRu
        ? 'Биология — это искусство открывать чудеса жизни и природы.'
        : "Biologiya - bu hayot va tabiat mo'jizalarini kashf qilish san'atidir.",
    },
    {
      id: 2,
      name: isRu ? 'Анвар Косимов' : 'Anvar Qosimov',
      subject: isRu ? 'Высшая математика' : 'Oliy Matematika',
      experience: isRu ? '12 лет опыта' : '12 yil tajriba',
      title: isRu ? 'Главный учитель математики' : "Bosh Matematika O'qituvchisi",
      image: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=600&q=80',
      avgScore: '98%',
      studentsCount: '450+',
      quote: isRu
        ? 'Математика — гимнастика ума и ключ к точным результатам.'
        : 'Matematika — tafakkur gimnastikasi va aniq natijalar kalitidir.',
    },
    {
      id: 3,
      name: isRu ? 'Дилноза Каримова' : 'Dilnoza Karimova',
      subject: isRu ? 'Информатика и IT' : 'Informatika & IT',
      experience: isRu ? '9 лет опыта' : '9 yil tajriba',
      title: isRu ? 'IT-ментор и лидер направления' : 'IT Mentor & Fan Yetakchisi',
      image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&q=80',
      avgScore: '96%',
      studentsCount: '420+',
      quote: isRu
        ? 'Профессии будущего закладываются на фундаменте сегодняшних практических знаний.'
        : 'Kelajak kasblari bugungi amaliy bilimlar poydevorida shakllanadi.',
    },
    {
      id: 4,
      name: isRu ? 'Жасурбек Мирзаев' : 'Jasurbek Mirzayev',
      subject: isRu ? 'Химия и Биология' : 'Kimyo & Biologiya',
      experience: isRu ? '11 лет опыта' : '11 yil tajriba',
      title: isRu ? 'Руководитель отдела естественных наук' : "Tabiiy Fanlar Bo'lim Boshlig'i",
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
      avgScore: '95%',
      studentsCount: '350+',
      quote: isRu
        ? 'Постигать тайны науки через практические опыты — самый верный путь.'
        : "Ilm-fan sirlarini amaliy tajribalar orqali kashf etish eng to'g'ri yo'ldir.",
    },
    {
      id: 5,
      name: isRu ? 'Жамшид Рахимов' : 'Jamshid Rahimov',
      subject: isRu ? 'Физика и Робототехника' : 'Fizika & Robototexnika',
      experience: isRu ? '10 лет опыта' : '10 yil tajriba',
      title: isRu ? 'Заведующий лабораторией' : 'Laboratoriya Mudiri',
      image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80',
      avgScore: '96%',
      studentsCount: '390+',
      quote: isRu
        ? 'Открывая законы природы, мы лучше познаём мир вокруг нас.'
        : 'Qonuniyatlarni kashf etish orqali olamni yaxshiroq anglaymiz.',
    },
    {
      id: 6,
      name: isRu ? 'Малика Саидова' : 'Malika Saidova',
      subject: isRu ? 'Английский язык (IELTS / SAT)' : 'Ingliz tili (IELTS / SAT)',
      experience: isRu ? '8 лет опыта' : '8 yil tajriba',
      title: isRu ? 'Координатор международных языков' : 'Xalqaro Til Koordinatori',
      image: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=600&q=80',
      avgScore: '99%',
      studentsCount: '510+',
      quote: isRu
        ? 'Свободное общение и совершенное знание языков открывают двери в мир.'
        : 'Erkin muloqot va mukammal til bilimi global eshiklarni ochadi.',
    },
  ];

  // Merge showcase teachers with defaults so carousel always has at least 6 cards to glide through
  const dbTeachers = showcaseData.teachers || [];
  const teachersList = dbTeachers.length >= 6
    ? dbTeachers
    : [
        ...dbTeachers,
        ...defaultTeachers.filter(
          (dt) => !dbTeachers.some((st) => (st.name || '').toLowerCase() === (dt.name || '').toLowerCase())
        ),
      ];

  // Talented Students for carousel
  const studentsList = showcaseData.talentedStudents?.length
    ? showcaseData.talentedStudents
    : [
        {
          id: 1,
          name: isRu ? 'Азизбек Алиев' : 'Azizbek Aliyev',
          grade: isRu ? '10-A класс' : '10-A sinf',
          achievement: isRu
            ? 'Серебряный призёр Международной олимпиады по математике (IMO)'
            : 'Xalqaro Matematika Olimpiadasi (IMO) kumush medali sohibi',
          image: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=600&q=80',
          quote: isRu
            ? 'Большие вершины — результат ежедневных усилий и терпения.'
            : 'Katta marralar har kungi kichik intilish va sabr natijasidir.',
        },
        {
          id: 2,
          name: isRu ? 'Мадина Шавкатова' : 'Madina Shavkatova',
          grade: isRu ? '9-B класс' : '9-B sinf',
          achievement: isRu
            ? '1-е место на Республиканском конкурсе по IT и программированию'
            : "Respublika IT & Dasturlash tanlovi 1-o'rin sohibasi",
          image: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80',
          quote: isRu
            ? 'Преграды на пути к мечте служат лишь ценным опытом.'
            : "Orzular sari intilishda to'siqlar faqat tajriba bo'lib xizmat qiladi.",
        },
        {
          id: 3,
          name: isRu ? 'Жасур Темиров' : 'Jasur Temirov',
          grade: isRu ? '11-A класс' : '11-A sinf',
          achievement: isRu
            ? 'IELTS 8.5 и SAT 1520, грант международного университета'
            : 'IELTS 8.5 va SAT 1520 balli, xalqaro universitet granti',
          image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
          quote: isRu
            ? 'Возможности есть каждый день — важно уметь ими правильно воспользоваться.'
            : "Imkoniyatlar har kuni bor, faqat ulardan to'g'ri foydalana bilish kerak.",
        },
        {
          id: 4,
          name: isRu ? 'Нилуфар Усмонова' : 'Nilufar Usmonova',
          grade: isRu ? '9-A класс' : '9-A sinf',
          achievement: isRu
            ? 'Победительница практических олимпиад по химии и научных проектов'
            : "Kimyo laboratoriya amaliy sinovlari va ilmiy loyihalar g'olibi",
          image: 'https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=600&q=80',
          quote: isRu
            ? 'Любознательность и упорство ведут к покорению любых вершин.'
            : 'Izlanish va intilish har qanday qiyin marrani zabt etishga yetaklaydi.',
        },
      ];

  // 3. RESPONSIVE CAROUSELS ENGINE
  const [teacherSlideIdx, setTeacherSlideIdx] = useState(0);
  const [studentSlideIdx, setStudentSlideIdx] = useState(0);
  const [teachersPerView, setTeachersPerView] = useState(3);
  const [studentsPerView, setStudentsPerView] = useState(3);
  const [teacherStep, setTeacherStep] = useState(380);
  const [studentStep, setStudentStep] = useState(380);

  const teachersTrackRef = useRef(null);
  const studentsTrackRef = useRef(null);
  const isTeacherHoveredRef = useRef(false);
  const isStudentHoveredRef = useRef(false);
  const teacherTouchStartX = useRef(0);
  const studentTouchStartX = useRef(0);

  // Dynamic dimension measurement
  const measureCarousels = () => {
    const w = window.innerWidth;
    const tPv = w <= 680 ? 1 : w <= 1024 ? 2 : 3;
    const sPv = w <= 680 ? 1 : w <= 1024 ? 2 : 3;
    setTeachersPerView(tPv);
    setStudentsPerView(sPv);

    if (teachersTrackRef.current) {
      const card = teachersTrackRef.current.querySelector('.teacher-slide-card');
      if (card && card.offsetWidth > 40) {
        const comp = window.getComputedStyle(teachersTrackRef.current);
        const gap = parseFloat(comp.gap) || (w <= 680 ? 16 : 24);
        setTeacherStep(card.offsetWidth + gap);
      }
    }

    if (studentsTrackRef.current) {
      const card = studentsTrackRef.current.querySelector('.student-slide-card');
      if (card && card.offsetWidth > 40) {
        const comp = window.getComputedStyle(studentsTrackRef.current);
        const gap = parseFloat(comp.gap) || (w <= 680 ? 16 : 24);
        setStudentStep(card.offsetWidth + gap);
      }
    }
  };

  useEffect(() => {
    measureCarousels();
    const t1 = setTimeout(measureCarousels, 100);
    const t2 = setTimeout(measureCarousels, 400);
    const t3 = setTimeout(measureCarousels, 1000);
    window.addEventListener('resize', measureCarousels);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener('resize', measureCarousels);
    };
  }, [teachersList.length, studentsList.length]);

  const maxTeacherIndex = Math.max(1, teachersList.length - teachersPerView);
  const maxStudentIndex = Math.max(1, studentsList.length - studentsPerView);

  // Bounds safety on resize
  useEffect(() => {
    if (teacherSlideIdx > maxTeacherIndex) {
      setTeacherSlideIdx(maxTeacherIndex);
    }
  }, [maxTeacherIndex, teacherSlideIdx]);

  useEffect(() => {
    if (studentSlideIdx > maxStudentIndex) {
      setStudentSlideIdx(maxStudentIndex);
    }
  }, [maxStudentIndex, studentSlideIdx]);

  // Auto-scroll Teachers (pauses smoothly on hover)
  useEffect(() => {
    const timer = setInterval(() => {
      if (!isTeacherHoveredRef.current) {
        setTeacherSlideIdx((prev) => (prev >= maxTeacherIndex ? 0 : prev + 1));
      }
    }, 3500);
    return () => clearInterval(timer);
  }, [maxTeacherIndex]);

  // Auto-scroll Students (pauses smoothly on hover)
  useEffect(() => {
    const timer = setInterval(() => {
      if (!isStudentHoveredRef.current) {
        setStudentSlideIdx((prev) => (prev >= maxStudentIndex ? 0 : prev + 1));
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [maxStudentIndex]);

  const moveTeacherSlide = (dir) => {
    setTeacherSlideIdx((prev) => {
      const next = prev + dir;
      if (next > maxTeacherIndex) return 0;
      if (next < 0) return maxTeacherIndex;
      return next;
    });
  };

  const moveStudentSlide = (dir) => {
    setStudentSlideIdx((prev) => {
      const next = prev + dir;
      if (next > maxStudentIndex) return 0;
      if (next < 0) return maxStudentIndex;
      return next;
    });
  };

  const handleTeacherTouchStart = (e) => {
    teacherTouchStartX.current = e.touches[0].clientX;
  };
  const handleTeacherTouchEnd = (e) => {
    const diff = teacherTouchStartX.current - e.changedTouches[0].clientX;
    if (diff > 45) moveTeacherSlide(1);
    else if (diff < -45) moveTeacherSlide(-1);
  };

  const handleStudentTouchStart = (e) => {
    studentTouchStartX.current = e.touches[0].clientX;
  };
  const handleStudentTouchEnd = (e) => {
    const diff = studentTouchStartX.current - e.changedTouches[0].clientX;
    if (diff > 45) moveStudentSlide(1);
    else if (diff < -45) moveStudentSlide(-1);
  };

  // Contact Form State with +998 prefill
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('+998 ');
  const [contactGrade, setContactGrade] = useState('5-sinf');
  const [submittingContact, setSubmittingContact] = useState(false);

  const handlePhoneChange = (e) => {
    const raw = e.target.value;
    let digits = raw.replace(/\D/g, '');
    if (digits.startsWith('998')) {
      digits = digits.slice(3);
    }
    digits = digits.slice(0, 9);

    let formatted = '+998';
    if (digits.length > 0) {
      formatted += ' (' + digits.slice(0, 2);
    }
    if (digits.length >= 2) {
      formatted += ') ' + digits.slice(2, 5);
    }
    if (digits.length >= 5) {
      formatted += '-' + digits.slice(5, 7);
    }
    if (digits.length >= 7) {
      formatted += '-' + digits.slice(7, 9);
    }
    if (digits.length === 0) {
      formatted = '+998 ';
    }
    setContactPhone(formatted);
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    if (!contactName.trim()) {
      showToast(language === 'ru' ? 'Введите ваше имя!' : "Ismingizni kiriting!", 'error');
      return;
    }
    const digits = contactPhone.replace(/\D/g, '');
    if (digits.length < 12) {
      showToast(
        language === 'ru'
          ? 'Пожалуйста, введите полный номер телефона: +998 (XX) XXX-XX-XX'
          : "Iltimos, telefon raqamingizni to'liq kiriting: +998 (XX) XXX-XX-XX",
        'error'
      );
      return;
    }

    setSubmittingContact(true);
    try {
      const gradeLabel = contactGrade === 'olimpiada'
        ? (isRu ? 'Олимпиада и Тесты' : 'Olimpiada & Testlar')
        : localizeGrade(contactGrade, language);
      const res = await api.contact.submit({
        name: contactName.trim(),
        phone: contactPhone.trim(),
        grade: contactGrade,
        message: isRu
          ? `Запись на приём по классу: ${gradeLabel} (обратный звонок)`
          : `${gradeLabel} bo'yicha qabulga yozilish (Qayta qo'ng'iroq)`,
      });
      if (res && (res.success || res.status === 'ok')) {
        showToast(res.message || t.cntSuccess, 'success');
        setContactName('');
        setContactPhone('+998 ');
      } else {
        showToast(
          res?.error ||
            (isRu
              ? 'Не удалось отправить заявку. Пожалуйста, попробуйте ещё раз.'
              : "Arizani yuborishda xatolik yuz berdi. Iltimos, qayta urinib ko'ring."),
          'error'
        );
      }
    } catch (err) {
      showToast(
        err?.message ||
          (isRu
            ? 'Ошибка соединения при отправке заявки. Попробуйте позже.'
            : "Ariza yuborishda server bilan bog'lanish xatosi yuz berdi."),
        'error'
      );
    } finally {
      setSubmittingContact(false);
    }
  };

  const statStudentsVal =
    showcaseData.stats?.studentsCount || showcaseData.siteSettings?.statStudents || '1,500+';
  const statTestsVal =
    showcaseData.stats?.testsCount || showcaseData.siteSettings?.statTests || '120+';
  const statCapacityVal = showcaseData.siteSettings?.statCapacity || '600+';
  const statFairVal = showcaseData.stats?.transparency || '100%';
  const displayAddress =
    (isRu ? showcaseData.siteSettings?.addressRu : showcaseData.siteSettings?.addressUz) ||
    t.cntAddrText;
  const rawLandmark = (showcaseData.siteSettings?.landmark || '').trim();
  const displayLandmark =
    !rawLandmark || (isRu && rawLandmark === 'Shahriston metro bekati')
      ? t.cntLandmark
      : rawLandmark.toLowerCase().startsWith("mo'ljal:") ||
        rawLandmark.toLowerCase().startsWith('ориентир:')
      ? rawLandmark
      : `${isRu ? 'Ориентир' : "Mo'ljal"}: ${rawLandmark}`;
  const displayHours =
    (isRu ? showcaseData.siteSettings?.workingHoursRu : showcaseData.siteSettings?.workingHoursUz) ||
    t.cntHoursText;

  return (
    <div className="page-home-clean">
      {/* 0. JONLI MAKTAB MA'LUMOTLARI LENTASI (INFINITE TICKER) */}
      <div className="live-info-ticker-wrap">
        <div className="ticker-title-badge">
          <i className="fa-solid fa-bolt"></i> {t.liveBadge}
        </div>
        <div className="ticker-track" id="live-info-track">
          {t.tickerItems.map((item, idx) => (
            <div key={idx} className="ticker-item">
              <i className={`fa-solid ${item.icon}`}></i> <strong>{item.num}</strong> {item.txt}
            </div>
          ))}
          {/* Duplicate for seamless infinite loop */}
          {t.tickerItems.map((item, idx) => (
            <div key={`dup-${idx}`} className="ticker-item">
              <i className={`fa-solid ${item.icon}`}></i> <strong>{item.num}</strong> {item.txt}
            </div>
          ))}
        </div>
      </div>

      {/* 1. DYNAMIC HERO SLIDER (OVER STUDENTS IMAGE) */}
      <section
        className="hero-showcase"
        id="hero-section"
        onMouseEnter={() => { isHeroHoveredRef.current = true; }}
        onMouseLeave={() => { isHeroHoveredRef.current = false; }}
      >
        <div className="hero-slider-wrap" id="hero-slider-container">
          {t.heroSlides.map((slide, idx) => (
            <div key={idx} className={`hero-slide ${currentHeroSlide === idx ? 'active-slide' : ''}`}>
              <div className="hero-badge-pill">
                <span className="pulse-gem"></span> <span className="h-badge-txt">{slide.badge}</span>
              </div>
              <h1 className="hero-main-title">{slide.title}</h1>
              <p className="hero-lead-text">{slide.desc}</p>
              <div className="hero-btn-row">
                <a href="#contact-section" className="btn-primary-diamond">
                  <i className="fa-solid fa-graduation-cap"></i> {slide.btn1}
                </a>
                <a href={idx === 1 ? '#teachers-section' : idx === 2 ? '#talented-section' : '#why-section'} className="btn-ghost-diamond">
                  <i className={`fa-solid ${idx === 1 ? 'fa-user-tie' : idx === 2 ? 'fa-trophy' : 'fa-compass'}`}></i> {slide.btn2}
                </a>
              </div>
            </div>
          ))}

          {/* Controls */}
          <div className="hero-carousel-controls">
            <button className="hero-arrow-btn" onClick={prevHeroSlide} aria-label="Oldingi">
              <i className="fa-solid fa-chevron-left"></i>
            </button>
            <div className="hero-nav-dots">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={`hero-progress-line ${currentHeroSlide === i ? 'active' : ''}`}
                  onClick={() => goToHeroSlide(i)}
                />
              ))}
            </div>
            <button className="hero-arrow-btn" onClick={nextHeroSlide} aria-label="Keyingi">
              <i className="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        </div>
      </section>

      {/* 2. ASOSIY 4 TA STATISTIKA STRIP */}
      <div className="quick-stats-strip">
        <div className="stat-item-box">
          <div className="stat-num">{statStudentsVal}</div>
          <div className="stat-lbl">{t.statStudents}</div>
        </div>
        <div className="stat-item-box">
          <div className="stat-num">{statTestsVal}</div>
          <div className="stat-lbl">{t.statTests}</div>
        </div>
        <div className="stat-item-box">
          <div className="stat-num">{statCapacityVal}</div>
          <div className="stat-lbl">{t.statCapacity}</div>
        </div>
        <div className="stat-item-box">
          <div className="stat-num">{statFairVal}</div>
          <div className="stat-lbl">{t.statFair}</div>
        </div>
      </div>

      {/* 3. NEGA DIAMOND SCHOOL? */}
      <section className="why-section-wrap" id="why-section">
        <div className="clean-head">
          <div className="clean-badge">
            <i className="fa-solid fa-gem"></i> {t.whyBadge}
          </div>
          <h2 className="clean-title">{t.whyTitle}</h2>
          <p className="clean-desc">{t.whyDesc}</p>
        </div>

        <div className="why-grid-3">
          <div className="why-card">
            <div className="why-icon-box">
              <i className="fa-solid fa-chalkboard-user"></i>
            </div>
            <h3 className="why-card-title">{t.why1Title}</h3>
            <p className="why-card-text">{t.why1Desc}</p>
          </div>

          <div className="why-card">
            <div className="why-icon-box">
              <i className="fa-solid fa-laptop-code"></i>
            </div>
            <h3 className="why-card-title">{t.why2Title}</h3>
            <p className="why-card-text">{t.why2Desc}</p>
          </div>

          <div className="why-card">
            <div className="why-icon-box">
              <i className="fa-solid fa-trophy"></i>
            </div>
            <h3 className="why-card-title">{t.why3Title}</h3>
            <p className="why-card-text">{t.why3Desc}</p>
          </div>
        </div>
      </section>

      {/* 4. BIZNING USTOZLAR (AUTO-CAROUSEL) */}
      <section className="teachers-section-wrap" id="teachers-section">
        <div className="clean-head">
          <div className="clean-badge">
            <i className="fa-solid fa-graduation-cap"></i> {t.tchBadge}
          </div>
          <h2 className="clean-title">{t.tchTitle}</h2>
          <p className="clean-desc">{t.tchSubtitle}</p>
        </div>

        <div
          className="carousel-outer"
          id="teachers-carousel-wrapper"
          onMouseEnter={() => { isTeacherHoveredRef.current = true; }}
          onMouseLeave={() => { isTeacherHoveredRef.current = false; }}
          onTouchStart={handleTeacherTouchStart}
          onTouchEnd={handleTeacherTouchEnd}
        >
          <button
            className="car-btn prev-arrow"
            onClick={() => moveTeacherSlide(-1)}
            aria-label={isRu ? 'Предыдущий' : 'Oldingi'}
          >
            <i className="fa-solid fa-chevron-left"></i>
          </button>

          <div className="carousel-track-viewport">
            <div
              ref={teachersTrackRef}
              className="teachers-slides-row"
              style={{
                transform: `translateX(-${teacherSlideIdx * (teacherStep || 380)}px)`,
                transition: 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)',
              }}
            >
              {teachersList.map((teacher, idx) => (
                <div key={teacher.id || idx} className="teacher-slide-card">
                  <div className="teacher-top-meta">
                    <span className="teacher-subj-badge">
                      <i className="fa-solid fa-gem"></i> {localizeSubject(teacher.subject, language)}
                    </span>
                    <span className="teacher-exp-chip">
                      <i className="fa-solid fa-award"></i> {localizeExperienceText(teacher.experience, language)}
                    </span>
                  </div>

                  <div className="teacher-portrait-box">
                    <img
                      src={teacher.image || teacher.imageUrl}
                      alt={teacher.name || teacher.fullName}
                      loading="lazy"
                      onError={(e) => {
                        e.target.src = 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&q=80';
                      }}
                    />
                    <div className="teacher-rating-pill">
                      <i className="fa-solid fa-star" style={{ color: '#f59e0b' }}></i> {teacher.avgScore || '96%'}
                    </div>
                  </div>

                  <div className="teacher-info-content">
                    <div className="teacher-name-txt">{teacher.name || teacher.fullName}</div>
                    <div className="teacher-role-txt">
                      {localizeTitleText(teacher.title || teacher.roleTitle || (isRu ? 'Педагог-ментор' : 'Pedagog-mentor'), language)}
                    </div>

                    <div className="teacher-stats-bar">
                      <span>
                        <i className="fa-solid fa-user-graduate"></i> <strong>{teacher.studentsCount || '300+'}</strong> {language === 'ru' ? 'учеников' : "o'quvchi"}
                      </span>
                      <span style={{ opacity: 0.35 }}>•</span>
                      <span>
                        <i className="fa-solid fa-circle-check" style={{ color: '#34d399' }}></i> {language === 'ru' ? 'Высшая категория' : 'Oliy toifa'}
                      </span>
                    </div>

                    {teacher.quote && (
                      <div className="teacher-quote-line">"{teacher.quote}"</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            className="car-btn next-arrow"
            onClick={() => moveTeacherSlide(1)}
            aria-label={isRu ? 'Следующий' : 'Keyingi'}
          >
            <i className="fa-solid fa-chevron-right"></i>
          </button>

          <div className="car-dots-row">
            {Array.from({ length: maxTeacherIndex + 1 }).map((_, i) => (
              <button
                key={i}
                className={`car-dot ${i === teacherSlideIdx ? 'active' : ''}`}
                onClick={() => setTeacherSlideIdx(i)}
                aria-label={isRu ? `Слайд учителя ${i + 1}` : `Ustoz slayd ${i + 1}`}
              />
            ))}
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <a href="#contact-section" className="btn-ghost-diamond" style={{ padding: '10px 22px', fontSize: '0.88rem' }}>
            {t.tchMoreBtn} <i className="fa-solid fa-arrow-right"></i>
          </a>
        </div>
      </section>

      {/* 5. IQTIDORLI O'QUVCHILAR (AUTO-CAROUSEL) */}
      <section className="talented-section-wrap" id="talented-section">
        <div className="clean-head">
          <div className="clean-badge">
            <i className="fa-solid fa-star"></i> {t.talentedBadge}
          </div>
          <h2 className="clean-title">{t.talentedTitle}</h2>
          <p className="clean-desc">{t.talentedSubtitle}</p>
        </div>

        <div
          className="carousel-outer"
          id="talented-carousel-wrapper"
          onMouseEnter={() => { isStudentHoveredRef.current = true; }}
          onMouseLeave={() => { isStudentHoveredRef.current = false; }}
          onTouchStart={handleStudentTouchStart}
          onTouchEnd={handleStudentTouchEnd}
        >
          <button
            className="car-btn prev-arrow"
            onClick={() => moveStudentSlide(-1)}
            aria-label={isRu ? 'Предыдущий' : 'Oldingi'}
          >
            <i className="fa-solid fa-chevron-left"></i>
          </button>

          <div className="carousel-track-viewport">
            <div
              ref={studentsTrackRef}
              className="carousel-slides-row"
              style={{
                transform: `translateX(-${studentSlideIdx * (studentStep || 380)}px)`,
                transition: 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)',
              }}
            >
              {studentsList.map((std, idx) => (
                <div key={std.id || idx} className="student-slide-card">
                  <div className="student-header-row">
                    <span className="student-grade-pill">
                      <i className="fa-solid fa-crown" style={{ color: '#f59e0b', marginRight: '4px' }}></i>
                      {localizeGrade(std.grade, language)}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: '#29B7E1', fontWeight: 800 }}>
                      <i className="fa-solid fa-coins"></i> {isRu ? '400+ Койнов' : '400+ Coins'}
                    </span>
                  </div>

                  <div className="student-avatar-round">
                    <img
                      src={std.image || std.photo || std.imageUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${std.name}&backgroundColor=0284c7`}
                      alt={std.name}
                    />
                  </div>

                  <div className="student-name-bold">{std.name || std.fullName}</div>

                  <div className="student-achieve-box">
                    <i className="fa-solid fa-medal" style={{ color: '#f59e0b', marginRight: '6px' }}></i>
                    {std.achievement}
                  </div>

                  {std.quote && (
                    <div className="student-quote-txt">"{std.quote}"</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button
            className="car-btn next-arrow"
            onClick={() => moveStudentSlide(1)}
            aria-label={isRu ? 'Следующий' : 'Keyingi'}
          >
            <i className="fa-solid fa-chevron-right"></i>
          </button>

          <div className="car-dots-row">
            {Array.from({ length: maxStudentIndex + 1 }).map((_, i) => (
              <button
                key={i}
                className={`car-dot ${i === studentSlideIdx ? 'active' : ''}`}
                onClick={() => setStudentSlideIdx(i)}
                aria-label={isRu ? `Слайд ученика ${i + 1}` : `O'quvchi slayd ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* 6. QABUL VA BOG'LANISH SECTION */}
      <section className="admission-clean-box" id="contact-section">
        {/* Chap: Aloqa ma'lumotlari */}
        <div className="adm-info-column">
          <div className="clean-badge">
            <i className="fa-solid fa-headset"></i> {t.contactBadge}
          </div>
          <h2 className="adm-info-title">{t.contactTitle}</h2>
          <p className="adm-info-desc">{t.contactSubtitle}</p>

          <div className="adm-detail-line">
            <div className="adm-detail-icon"><i className="fa-solid fa-phone-volume"></i></div>
            <div className="adm-detail-text">
              <div className="adm-detail-sub">{t.cntLblCallback}</div>
              <div style={{ fontWeight: 700, color: '#29B7E1', fontSize: '0.96rem' }}>
                {t.cntCallbackNotice}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#94A3B8', marginTop: '2px' }}>
                {t.cntCallbackHint}
              </div>
            </div>
          </div>

          <div className="adm-detail-line">
            <div className="adm-detail-icon"><i className="fa-solid fa-location-dot"></i></div>
            <div className="adm-detail-text">
              <div className="adm-detail-sub">{t.cntLblAddr}</div>
              <div style={{ fontWeight: 600, color: '#FFFFFF' }}>{displayAddress}</div>
              <div style={{ fontSize: '0.78rem', color: '#29B7E1' }}>{displayLandmark}</div>
            </div>
          </div>

          <div className="adm-detail-line">
            <div className="adm-detail-icon"><i className="fa-solid fa-clock"></i></div>
            <div className="adm-detail-text">
              <div className="adm-detail-sub">{t.cntLblHours}</div>
              <div style={{ fontWeight: 600, color: '#FFFFFF' }}>{displayHours}</div>
            </div>
          </div>
        </div>

        {/* O'ng: Qisqa va qulay ariza formasi */}
        <div className="adm-form-card">
          <h3>{t.cntFormTitle}</h3>
          <p>{t.cntFormSub}</p>

          <form onSubmit={handleContactSubmit}>
            <div className="clean-input-group">
              <label>{t.cntLblName}</label>
              <input
                type="text"
                className="clean-input"
                placeholder={language === 'ru' ? 'Введите ваше имя' : 'Ismingizni kiriting'}
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                required
              />
            </div>

            <div className="form-two-col">
              <div className="clean-input-group">
                <label>{t.cntLblPhoneInput}</label>
                <input
                  type="tel"
                  className="clean-input"
                  placeholder="+998 (90) 123-45-67"
                  value={contactPhone}
                  onChange={handlePhoneChange}
                  onFocus={() => {
                    if (!contactPhone || contactPhone.trim() === '+998') {
                      setContactPhone('+998 ');
                    }
                  }}
                  required
                />
              </div>
              <div className="clean-input-group">
                <label>{t.cntLblGrade}</label>
                <select
                  className="clean-select"
                  value={contactGrade}
                  onChange={(e) => setContactGrade(e.target.value)}
                >
                  {[5, 6, 7, 8, 9, 10, 11].map((g) => (
                    <option key={g} value={`${g}-sinf`}>
                      {isRu ? `${g}-класс` : `${g}-sinf`}
                    </option>
                  ))}
                  <option value="olimpiada">{isRu ? 'Олимпиада и Тесты' : 'Olimpiada & Testlar'}</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary-diamond"
              style={{ width: '100%', justifyContent: 'center', marginTop: '0.8rem' }}
              disabled={submittingContact}
            >
              <i className="fa-solid fa-paper-plane"></i> {submittingContact ? t.cntSending : t.cntBtnSend}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
