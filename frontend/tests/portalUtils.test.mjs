import test from 'node:test';
import assert from 'node:assert/strict';

import {
  localizeSubject,
  localizeGrade,
  localizeUserFullName,
  localizeRole,
  localizeTitleText,
  localizeExperienceText,
  TEACHER_LESSON_ACTIVITY_PRESETS_BY_LANG,
  getTeacherLessonPresets,
  ADMIN_STUDENT_COIN_PRESETS_BY_LANG,
  ADMIN_CLASS_COIN_PRESETS_BY_LANG,
  getLockMessageLocalized,
  getPolicyMessageLocalized,
} from '../src/i18n/portalUtils.js';

test('localizeSubject translates Uzbek subjects to Russian and handles fallbacks', () => {
  assert.equal(localizeSubject('Matematika', 'uz'), 'Matematika');
  assert.equal(localizeSubject('Matematika', 'ru'), 'Математика');
  assert.equal(localizeSubject('  ingliz tili ', 'ru'), 'Английский язык');
  assert.equal(localizeSubject('Ona tili va Adabiyot', 'ru'), 'Родной язык и литература');
  assert.equal(localizeSubject('Informatika & IT', 'ru'), 'Информатика и IT');
  assert.equal(localizeSubject('', 'uz'), 'Fan');
  assert.equal(localizeSubject('', 'ru'), 'Предмет');
  assert.equal(localizeSubject(null, 'ru'), 'Предмет');
  assert.equal(localizeSubject('Astronomiya', 'ru'), 'Astronomiya');
});

test('localizeGrade handles all classes, numeric sinf, empty, and passthrough', () => {
  assert.equal(localizeGrade('Barchasi', 'uz'), 'Barchasi');
  assert.equal(localizeGrade('Barchasi', 'ru'), 'Все классы');
  assert.equal(localizeGrade('barcha sinflar', 'ru'), 'Все классы');
  assert.equal(localizeGrade('all', 'ru'), 'Все классы');
  assert.equal(localizeGrade('Umumiy', 'ru'), 'Общий');
  assert.equal(localizeGrade('Biriktirilmagan', 'ru'), 'Не указан');
  assert.equal(localizeGrade('', 'uz'), 'Biriktirilmagan');
  assert.equal(localizeGrade('', 'ru'), 'Не указан');
  assert.equal(localizeGrade('9 sinf', 'ru'), '9 класс');
  assert.equal(localizeGrade('9-A sinf', 'ru'), '9-A класс');
  assert.equal(localizeGrade('9-A', 'ru'), '9-A');
  assert.equal(localizeGrade('10-RU', 'uz'), '10-RU');
});

test('localizeUserFullName localizes system admin name in Russian only', () => {
  assert.equal(localizeUserFullName('', 'ru'), '');
  assert.equal(localizeUserFullName('Bosh Administrator', 'uz'), 'Bosh Administrator');
  assert.equal(localizeUserFullName('bosh administrator', 'ru'), 'Главный администратор');
  assert.equal(localizeUserFullName('Jasur Alimov', 'ru'), 'Jasur Alimov');
});

test('localizeRole formats admin, teacher, and student roles in UZ and RU', () => {
  assert.equal(localizeRole('admin', 'uz'), 'Administrator');
  assert.equal(localizeRole('administrator', 'ru'), 'Администратор');
  assert.equal(localizeRole('teacher', 'uz'), "O'qituvchi");
  assert.equal(localizeRole('teacher', 'ru'), 'Учитель');
  assert.equal(localizeRole("O'qituvchi", 'ru'), 'Учитель');
  assert.equal(localizeRole('student', 'uz'), "O'quvchi");
  assert.equal(localizeRole('student', 'ru'), 'Ученик');
  assert.equal(localizeRole('guest', 'ru'), 'guest');
  assert.equal(localizeRole('', 'uz'), '');
});

test('localizeTitleText and localizeExperienceText translate showcase strings', () => {
  assert.equal(localizeTitleText('Diamond School fan ustozi', 'ru'), 'Преподаватель Diamond School');
  assert.equal(localizeTitleText("Ko'p yillik tajriba", 'ru'), 'Многолетний опыт');
  assert.equal(localizeTitleText('Custom Title', 'ru'), 'Custom Title');
  assert.equal(localizeTitleText('Diamond School fan ustozi', 'uz'), 'Diamond School fan ustozi');
  assert.equal(localizeTitleText('', 'ru'), '');

  assert.equal(localizeExperienceText('7 yil tajriba', 'ru'), '7 лет опыта');
  assert.equal(localizeExperienceText('12+ yil tajriba', 'ru'), '12+ лет опыта');
  assert.equal(localizeExperienceText('7 yil tajriba', 'uz'), '7 yil tajriba');
  assert.equal(localizeExperienceText('', 'ru'), '');
});

test('teacher and admin coin presets are non-empty and comply with teacher lesson restrictions', () => {
  const uzTeacher = getTeacherLessonPresets('uz');
  const ruTeacher = getTeacherLessonPresets('ru');
  assert.equal(uzTeacher, TEACHER_LESSON_ACTIVITY_PRESETS_BY_LANG.uz);
  assert.equal(ruTeacher, TEACHER_LESSON_ACTIVITY_PRESETS_BY_LANG.ru);
  assert.ok(uzTeacher.length >= 3);
  assert.ok(ruTeacher.length >= 3);

  const forbidden = /\b(test|imtihon|olimpiad|uy\s+vazifa|тест|экзамен|олимпиад|домашн)\w*/i;
  for (const preset of [...uzTeacher, ...ruTeacher]) {
    assert.equal(forbidden.test(preset), false, `Forbidden keyword in teacher preset: ${preset}`);
  }

  assert.ok(ADMIN_STUDENT_COIN_PRESETS_BY_LANG.uz.length >= 3);
  assert.ok(ADMIN_STUDENT_COIN_PRESETS_BY_LANG.ru.length >= 3);
  assert.ok(ADMIN_CLASS_COIN_PRESETS_BY_LANG.uz.length >= 3);
  assert.ok(ADMIN_CLASS_COIN_PRESETS_BY_LANG.ru.length >= 3);
});

test('getLockMessageLocalized translates lock reasons in Russian and preserves UZ messages', () => {
  assert.equal(getLockMessageLocalized(null, 'ru'), '');
  assert.equal(
    getLockMessageLocalized({ lockReason: 'portal_disabled', lockMessage: 'UZ lock' }, 'uz'),
    'UZ lock'
  );
  for (const reason of [
    'portal_disabled',
    'portal_upcoming',
    'portal_expired',
    'admin_not_allowed',
    'max_attempts_reached',
  ]) {
    const msg = getLockMessageLocalized({ lockReason: reason, lockMessage: 'fallback' }, 'ru');
    assert.ok(msg.length > 10 && msg !== 'fallback', `Missing RU translation for ${reason}`);
  }
  assert.equal(
    getLockMessageLocalized({ lockReason: 'unknown', lockMessage: 'Custom fallback' }, 'ru'),
    'Custom fallback'
  );
});

test('getPolicyMessageLocalized handles open/closed/upcoming/expired policies', () => {
  assert.equal(getPolicyMessageLocalized(null, 'ru'), '');
  assert.equal(getPolicyMessageLocalized({ message: 'UZ policy' }, 'uz'), 'UZ policy');

  const openBoth = getPolicyMessageLocalized(
    { portalOpen: true, startTime: '09:00', endTime: '18:00' },
    'ru'
  );
  assert.match(openBoth, /09:00.*18:00/);

  const openEndOnly = getPolicyMessageLocalized({ portalOpen: true, endTime: '18:00' }, 'ru');
  assert.match(openEndOnly, /18:00/);

  const openAlways = getPolicyMessageLocalized({ portalOpen: true }, 'ru');
  assert.match(openAlways, /открыт/);

  assert.match(getPolicyMessageLocalized({ portalOpen: false, enabled: false }, 'ru'), /закрыт/);
  assert.match(
    getPolicyMessageLocalized({ portalOpen: false, enabled: true, isUpcoming: true, startTime: '10:00' }, 'ru'),
    /10:00/
  );
  assert.match(
    getPolicyMessageLocalized({ portalOpen: false, enabled: true, isExpired: true, endTime: '12:00' }, 'ru'),
    /12:00/
  );
});
