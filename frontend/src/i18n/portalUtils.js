// Bilingual (UZ / RU) display helpers for Admin, Teacher, and Student portals.
// Note: underlying database/filter values (like 'Matematika', 'Barchasi', 'all') stay untouched;
// only human-readable labels are formatted according to the active UI language.

const SUBJECT_RU_MAP = {
  matematika: 'Математика',
  fizika: 'Физика',
  informatika: 'Информатика',
  'ingliz tili': 'Английский язык',
  biologiya: 'Биология',
  kimyo: 'Химия',
  tarix: 'История',
  'ona tili va adabiyot': 'Родной язык и литература',
  'ona tili': 'Родной язык',
  'rus tili': 'Русский язык',
  'rus tili va adabiyot': 'Русский язык и литература',
  geografiya: 'География',
  adabiyot: 'Литература',
  huquq: 'Правоведение',
  iqtisod: 'Экономика',
  fan: 'Предмет',
  umumiy: 'Общий',
  "oliy matematika": 'Высшая математика',
  "informatika & it": 'Информатика и IT',
  "kimyo & biologiya": 'Химия и Биология',
  "fizika & robototexnika": 'Физика и Робототехника',
  "ingliz tili (ielts / sat)": 'Английский язык (IELTS / SAT)',
  "fan belgilanmagan": 'Предмет не указан',
  "barcha fanlar": 'Все предметы',
};

export function localizeSubject(subject, language = 'uz') {
  if (!subject) return language === 'ru' ? 'Предмет' : 'Fan';
  const raw = String(subject).trim();
  if (language !== 'ru') return raw;
  const key = raw.toLowerCase();
  if (SUBJECT_RU_MAP[key]) return SUBJECT_RU_MAP[key];
  return raw;
}

export function localizeGrade(grade, language = 'uz') {
  if (!grade) return language === 'ru' ? 'Не указан' : 'Biriktirilmagan';
  const raw = String(grade).trim();
  if (language !== 'ru') return raw;
  const low = raw.toLowerCase();
  if (low === 'barchasi' || low === 'barcha sinflar' || low === 'all') {
    return 'Все классы';
  }
  if (low === 'umumiy') {
    return 'Общий';
  }
  if (low === 'biriktirilmagan' || low === 'aniqlanmagan' || low === 'belgilanmagan') {
    return 'Не указан';
  }
  if (/^\d+(?:-[a-z]+)?\s+sinf$/i.test(raw)) {
    return raw.replace(/\bsinf$/i, 'класс');
  }
  return raw;
}

export function localizeUserFullName(fullName, language = 'uz') {
  if (!fullName) return '';
  const raw = String(fullName).trim();
  if (language === 'ru' && raw.toLowerCase() === 'bosh administrator') {
    return 'Главный администратор';
  }
  return raw;
}

export function localizeRole(role, language = 'uz') {
  const low = String(role || '').toLowerCase();
  if (language === 'ru') {
    if (low === 'admin' || low === 'administrator') return 'Администратор';
    if (low === 'teacher' || low === "o'qituvchi") return 'Учитель';
    if (low === 'tutor' || low === 'tyuter') return 'Тьютор';
    if (low === 'student' || low === "o'quvchi") return 'Ученик';
    return role || '';
  }
  if (low === 'admin' || low === 'administrator') return 'Administrator';
  if (low === 'teacher') return "O'qituvchi";
  if (low === 'tutor') return 'Tyuter';
  if (low === 'student') return "O'quvchi";
  return role || '';
}

export function localizeTitleText(text, language = 'uz') {
  if (!text) return '';
  if (language !== 'ru') return text;
  const raw = String(text).trim();
  const map = {
    'diamond school fan ustozi': 'Преподаватель Diamond School',
    "ko'p yillik tajriba": 'Многолетний опыт',
  };
  return map[raw.toLowerCase()] || raw;
}

export function localizeExperienceText(text, language = 'uz') {
  if (!text) return '';
  if (language !== 'ru') return text;
  const raw = String(text).trim();
  const m = raw.match(/^(\d+\+?)\s*yil\s+tajriba$/i);
  if (m) return `${m[1]} лет опыта`;
  return raw;
}

export const TEACHER_LESSON_ACTIVITY_PRESETS_BY_LANG = {
  uz: [
    'Darsdagi namunali faollik 📚',
    'Darsda faol qatnashgani uchun ⚡',
    'Doskada misolni yechdi ✍️',
    "Savol-javobda faol bo'ldi 💬",
    "Mavzuni to'liq tushuntirib berdi 💡",
  ],
  ru: [
    'Образцовая активность на уроке 📚',
    'За активное участие на уроке ⚡',
    'Решил(а) задачу у доски ✍️',
    'Активно участвовал(а) в опросе 💬',
    'Отлично объяснил(а) тему 💡',
  ],
};

export function getTeacherLessonPresets(language = 'uz') {
  return TEACHER_LESSON_ACTIVITY_PRESETS_BY_LANG[language === 'ru' ? 'ru' : 'uz'];
}

export const TEACHER_DEDUCT_PRESETS_BY_LANG = {
  uz: [
    'Dars intizomini buzgani uchun ⚠️',
    'Darsga tayyorgarliksiz kelgani uchun 📉',
    "Darsda telefonda chalg'igani uchun 📵",
    'Dars jarayoniga xalaqit bergani uchun 🚫',
    'Tartib-qoidalarga amal qilmagani uchun 🔻',
  ],
  ru: [
    'За нарушение дисциплины на уроке ⚠️',
    'За неготовность к уроку 📉',
    'Отвлекался на телефон на уроке 📵',
    'Мешал проведению урока 🚫',
    'За несоблюдение правил на уроке 🔻',
  ],
};

export function getTeacherDeductPresets(language = 'uz') {
  return TEACHER_DEDUCT_PRESETS_BY_LANG[language === 'ru' ? 'ru' : 'uz'];
}

export const ADMIN_STUDENT_COIN_PRESETS_BY_LANG = {
  uz: [
    'Faol sinf ishtirokchisi ⚡',
    "Darsda zo'r qatnashgani uchun 📚",
    "Olimpiada & musobaqa g'olibi 🏆",
    "Namunali tartib-intizom ko'rsatdi 🌟",
    "Testlarda yuqori natija ko'rsatdi 💎",
  ],
  ru: [
    'Активный участник класса ⚡',
    'За отличную активность на уроке 📚',
    'Победитель олимпиад и конкурсов 🏆',
    'За образцовую дисциплину 🌟',
    'За высокие результаты на тестах 💎',
  ],
};

export const ADMIN_CLASS_COIN_PRESETS_BY_LANG = {
  uz: [
    'Faol sinf rag‘bati 🏫💎',
    'Haftaning eng faol sinfi 🏆',
    'Darslardagi intizom va hamjihatlik uchun ⭐',
    'Test va olimpiadalardagi umumiy yutuq 🎯',
  ],
  ru: [
    'Поощрение активного класса 🏫💎',
    'Самый активный класс недели 🏆',
    'За дисциплину и сплочённость на уроках ⭐',
    'Общее достижение в тестах и олимпиадах 🎯',
  ],
};

export function getLockMessageLocalized(testItem, language = 'uz') {
  if (!testItem) return '';
  if (language !== 'ru') return testItem.lockMessage || '';
  const reason = testItem.lockReason;
  if (reason === 'portal_disabled') {
    return 'В настоящее время доступ учеников к тестам закрыт администратором.';
  }
  if (reason === 'portal_upcoming') {
    return 'Время проведения тестирования ещё не наступило.';
  }
  if (reason === 'portal_expired') {
    return 'Срок проведения этого теста уже истёк.';
  }
  if (reason === 'admin_not_allowed') {
    return 'Этот тест ещё не открыт администратором для учеников. Подождите разрешения!';
  }
  if (reason === 'max_attempts_reached') {
    return 'Вы уже использовали все разрешённые попытки для этого теста.';
  }
  return testItem.lockMessage || '';
}

export function getPolicyMessageLocalized(policy, language = 'uz') {
  if (!policy) return '';
  if (language !== 'ru') return policy.message || '';
  if (policy.portalOpen) {
    if (policy.startTime && policy.endTime) {
      return `Тестирование открыто (с ${policy.startTime} по ${policy.endTime}) для тестов с разрешением администратора.`;
    }
    if (policy.endTime) {
      return `Тестирование открыто до ${policy.endTime} для тестов с разрешением администратора.`;
    }
    return 'Для разрешённых администратором тестов доступ для учеников открыт.';
  }
  if (!policy.enabled) {
    return 'Доступ учеников к разделу тестирования временно закрыт администратором.';
  }
  if (policy.isUpcoming) {
    return `Тестирование ещё не началось. Время открытия: ${policy.startTime || ''}`.trim();
  }
  if (policy.isExpired) {
    return `Время проведения тестирования завершилось (${policy.endTime || ''}).`;
  }
  return policy.message || '';
}
