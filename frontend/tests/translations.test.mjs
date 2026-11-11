import test from 'node:test';
import assert from 'node:assert/strict';

import { translations } from '../src/i18n/translations.js';

test('translations defines both uz and ru dictionaries with identical keys', () => {
  assert.ok(translations.uz && typeof translations.uz === 'object');
  assert.ok(translations.ru && typeof translations.ru === 'object');

  const uzKeys = Object.keys(translations.uz).sort();
  const ruKeys = Object.keys(translations.ru).sort();
  assert.deepEqual(uzKeys, ruKeys);
});

test('every translation string is non-empty and properly localized between uz and ru', () => {
  const sharedIdentical = new Set(['brandName']);

  for (const key of Object.keys(translations.uz)) {
    const uzVal = translations.uz[key];
    const ruVal = translations.ru[key];
    assert.equal(typeof uzVal, 'string', `uz.${key} must be string`);
    assert.equal(typeof ruVal, 'string', `ru.${key} must be string`);
    assert.ok(uzVal.trim().length > 0, `uz.${key} must be non-empty`);
    assert.ok(ruVal.trim().length > 0, `ru.${key} must be non-empty`);

    if (!sharedIdentical.has(key)) {
      assert.notEqual(
        uzVal.trim(),
        ruVal.trim(),
        `Expected localized difference for key "${key}" between uz and ru`
      );
    }
  }
});
