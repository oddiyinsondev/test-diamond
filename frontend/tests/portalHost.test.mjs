import test from 'node:test';
import assert from 'node:assert/strict';

import {
  readSpaConfig,
  resolvePortalMode,
  getMainSiteUrl,
  getPortalBaseUrl,
  getMainHomeTarget,
  getMainSectionHref,
  getPortalLinkTarget,
} from '../src/utils/portalHost.js';

test('resolvePortalMode prefers explicit spa_config and falls back to hostname', () => {
  assert.equal(resolvePortalMode({ config: { portalMode: 'admin' }, hostname: 'app.diamondschool.uz' }), 'admin');
  assert.equal(resolvePortalMode({ config: { portalMode: 'teacher' } }), 'teacher');
  assert.equal(resolvePortalMode({ config: { portalMode: 'student' } }), 'student');
  assert.equal(resolvePortalMode({ config: { portalMode: 'main' } }), 'main');

  assert.equal(resolvePortalMode({ config: null, hostname: 'admin.diamondschool.uz' }), 'admin');
  assert.equal(resolvePortalMode({ config: null, hostname: 'teacher.diamondschool.uz:8000' }), 'teacher');
  assert.equal(resolvePortalMode({ config: null, hostname: 'STUDENT.DIAMONDSCHOOL.UZ' }), 'student');
  assert.equal(resolvePortalMode({ config: null, hostname: 'admin.localhost' }), 'admin');
  assert.equal(resolvePortalMode({ config: null, hostname: 'app.diamondschool.uz' }), 'main');
  assert.equal(resolvePortalMode({ config: null, hostname: '127.0.0.1' }), 'main');
});

test('readSpaConfig parses diamond-spa-config script safely and handles invalid JSON', () => {
  const prevDoc = globalThis.document;
  try {
    globalThis.document = {
      getElementById: (id) =>
        id === 'diamond-spa-config'
          ? { textContent: '{"portalMode":"teacher","mainSiteUrl":"https://app.diamondschool.uz"}' }
          : null,
    };
    assert.deepEqual(readSpaConfig(), {
      portalMode: 'teacher',
      mainSiteUrl: 'https://app.diamondschool.uz',
    });

    globalThis.document = {
      getElementById: () => ({ textContent: '{invalid-json' }),
    };
    assert.equal(readSpaConfig(), null);
  } finally {
    globalThis.document = prevDoc;
  }
});

test('getMainSiteUrl and getPortalBaseUrl sanitize origins and reject unsafe schemes', () => {
  const validConfig = {
    mainSiteUrl: 'https://app.diamondschool.uz/some/path',
    portalUrls: {
      admin: 'https://admin.diamondschool.uz',
      teacher: 'http://teacher.diamondschool.uz',
      student: 'javascript:alert(1)',
    },
  };
  assert.equal(getMainSiteUrl({ config: validConfig }), 'https://app.diamondschool.uz');
  assert.equal(getPortalBaseUrl('admin', { config: validConfig }), 'https://admin.diamondschool.uz');
  assert.equal(getPortalBaseUrl('teacher', { config: validConfig }), 'http://teacher.diamondschool.uz');
  assert.equal(
    getPortalBaseUrl('student', { config: validConfig, protocol: 'https:' }),
    'https://student.diamondschool.uz'
  );
  assert.equal(
    getMainSiteUrl({ config: { mainSiteUrl: 'javascript:alert(1)' }, protocol: 'http:' }),
    'http://app.diamondschool.uz'
  );
});

test('getMainHomeTarget and getMainSectionHref adapt cleanly to main vs portal domains', () => {
  assert.deepEqual(getMainHomeTarget({ config: { portalMode: 'main' } }), { internal: true, to: '/' });
  assert.deepEqual(
    getMainHomeTarget({ config: { portalMode: 'admin', mainSiteUrl: 'https://app.diamondschool.uz' } }),
    { internal: false, href: 'https://app.diamondschool.uz/' }
  );

  assert.equal(
    getMainSectionHref('#teachers-section', { config: { portalMode: 'main' } }),
    '/#teachers-section'
  );
  assert.equal(
    getMainSectionHref('contact-section', {
      config: { portalMode: 'student', mainSiteUrl: 'http://app.diamondschool.uz' },
    }),
    'http://app.diamondschool.uz/#contact-section'
  );
});

test('getPortalLinkTarget keeps current portal on / and isolates cross-portal transitions', () => {
  const fullConfig = {
    portalMode: 'admin',
    mainSiteUrl: 'https://app.diamondschool.uz',
    portalUrls: {
      admin: 'https://admin.diamondschool.uz',
      teacher: 'https://teacher.diamondschool.uz',
      student: 'https://student.diamondschool.uz',
    },
  };

  assert.deepEqual(
    getPortalLinkTarget('admin', '', { config: fullConfig }),
    { internal: true, to: '/' }
  );
  assert.deepEqual(
    getPortalLinkTarget('admin', 'tab=tests', { config: fullConfig }),
    { internal: true, to: '/?tab=tests' }
  );
  assert.deepEqual(
    getPortalLinkTarget('teacher', '', { config: fullConfig }),
    { internal: false, href: 'https://teacher.diamondschool.uz/' }
  );

  assert.deepEqual(
    getPortalLinkTarget('admin', '?tab=tests', { config: { portalMode: 'main' } }),
    { internal: true, to: '/admin-panel/?tab=tests' }
  );
  assert.deepEqual(
    getPortalLinkTarget('teacher', '', { config: { portalMode: 'main' } }),
    { internal: true, to: '/teacher/' }
  );
  assert.deepEqual(
    getPortalLinkTarget('student', '', { config: { portalMode: 'main' } }),
    { internal: true, to: '/student/' }
  );
});

