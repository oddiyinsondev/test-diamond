import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { apiClient } from '../src/api/client.js';
import { api } from '../src/api/endpoints.js';

function createStorageMock(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

let calls = [];
let nextResponse = {
  ok: true,
  status: 200,
  statusText: 'OK',
  jsonData: { ok: true },
  blobData: null,
  jsonReject: false,
};

const origFetch = globalThis.fetch;
const origDocument = globalThis.document;
const origLocalStorage = globalThis.localStorage;

beforeEach(() => {
  calls = [];
  nextResponse = {
    ok: true,
    status: 200,
    statusText: 'OK',
    jsonData: { ok: true },
    blobData: null,
    jsonReject: false,
  };
  globalThis.localStorage = createStorageMock();
  globalThis.document = { cookie: '' };
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, init });
    return {
      ok: nextResponse.ok,
      status: nextResponse.status,
      statusText: nextResponse.statusText,
      json: async () => {
        if (nextResponse.jsonReject) throw new SyntaxError('Unexpected token');
        return nextResponse.jsonData;
      },
      blob: async () => nextResponse.blobData,
    };
  };
});

afterEach(() => {
  globalThis.fetch = origFetch;
  globalThis.document = origDocument;
  globalThis.localStorage = origLocalStorage;
});

test('apiClient sets X-Language from localStorage defaulting to uz', async () => {
  await apiClient('/api/meta/');
  assert.equal(calls[0].init.headers['X-Language'], 'uz');
  assert.equal(calls[0].init.credentials, 'include');

  globalThis.localStorage.setItem('diamond_lang', 'ru');
  await apiClient('/api/meta/');
  assert.equal(calls[1].init.headers['X-Language'], 'ru');
});

test('apiClient attaches X-CSRFToken only on mutating requests', async () => {
  globalThis.document.cookie = 'other=1; csrftoken=tok%2B123; session=abc';

  await apiClient('/api/meta/', { method: 'GET' });
  assert.equal(calls[0].init.headers['X-CSRFToken'], undefined);

  await apiClient('/api/admin/classes/', {
    method: 'POST',
    body: JSON.stringify({ name: '9-B' }),
  });
  assert.equal(calls[1].init.headers['X-CSRFToken'], 'tok+123');
  assert.equal(calls[1].init.headers['Content-Type'], 'application/json');
});

test('apiClient leaves Content-Type unset when sending FormData', async () => {
  const fd = new FormData();
  fd.append('username', 'student1');

  await apiClient('/api/admin/students/', {
    method: 'POST',
    body: fd,
  });

  assert.equal(calls[0].init.headers['Content-Type'], undefined);
  assert.equal(calls[0].init.body, fd);
});

test('apiClient handles error JSON and localized fallback errors', async () => {
  nextResponse = {
    ok: false,
    status: 403,
    statusText: 'Forbidden',
    jsonData: { error: 'Ruxsat berilmagan' },
    jsonReject: false,
  };

  await assert.rejects(
    () => apiClient('/api/student/tests/1/'),
    (err) => err.status === 403 && err.message === 'Ruxsat berilmagan' && err.data.error === 'Ruxsat berilmagan'
  );

  globalThis.localStorage.setItem('diamond_lang', 'ru');
  nextResponse = {
    ok: false,
    status: 502,
    statusText: 'Bad Gateway',
    jsonReject: true,
  };

  await assert.rejects(
    () => apiClient('/api/meta/'),
    (err) => err.status === 502 && err.message === 'Ошибка: 502 Bad Gateway'
  );
});

test('apiClient supports blob downloads', async () => {
  const fakeBlob = new Blob(['sample'], { type: 'application/octet-stream' });
  nextResponse = { ok: true, status: 200, statusText: 'OK', blobData: fakeBlob };

  const res = await apiClient('/api/teacher/download-template/', { responseType: 'blob' });
  assert.equal(res, fakeBlob);

  nextResponse = { ok: false, status: 404, statusText: 'Not Found' };
  await assert.rejects(
    () => apiClient('/api/teacher/download-template/', { responseType: 'blob' }),
    /Server xatosi: 404/
  );
});

test('endpoints map cleanly to backend routes and methods', async () => {
  await api.contact.submit({ name: 'Ali', phone: '+998901234567' });
  assert.equal(calls.at(-1).url, '/api/contact/submit/');
  assert.equal(calls.at(-1).init.method, 'POST');

  await api.diamond.submitContact({ fullName: 'Vali', phone: '+998901112233' });
  assert.equal(calls.at(-1).url, '/api/contact/submit/');
  assert.equal(calls.at(-1).init.method, 'POST');

  await api.admin.updateClass(12, { name: '10-A' });
  assert.equal(calls.at(-1).url, '/api/admin/classes/12/');
  assert.equal(calls.at(-1).init.method, 'PUT');

  await api.admin.markContactMessageRead(7);
  assert.equal(calls.at(-1).url, '/api/admin/contact-messages/?id=7');
  assert.equal(calls.at(-1).init.method, 'PUT');

  await api.admin.deleteContactMessage(7);
  assert.equal(calls.at(-1).url, '/api/admin/contact-messages/?id=7');
  assert.equal(calls.at(-1).init.method, 'DELETE');

  await api.teacher.awardCoins({ studentId: 3, amount: 2, reason: 'Darsda faol' });
  assert.equal(calls.at(-1).url, '/api/coins/award/');
  assert.deepEqual(JSON.parse(calls.at(-1).init.body), {
    studentId: 3,
    amount: 2,
    reason: 'Darsda faol',
    portal: 'teacher',
  });

  await api.student.getTests('9-RU');
  assert.equal(calls.at(-1).url, '/api/student/tests/?grade=9-RU');

  await api.student.getTests('all');
  assert.equal(calls.at(-1).url, '/api/student/tests/');
});
