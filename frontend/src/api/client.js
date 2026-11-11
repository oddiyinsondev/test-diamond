// API client with credentials, CSRF protection, language propagation, and error handling

function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

function getActiveLanguage() {
  try {
    const stored = localStorage.getItem('diamond_lang');
    return stored === 'ru' ? 'ru' : 'uz';
  } catch {
    return 'uz';
  }
}

export async function apiClient(url, options = {}) {
  const lang = getActiveLanguage();
  const defaults = {
    credentials: 'include',
    headers: {},
  };

  const isFormData = options.body instanceof FormData;

  const headers = {
    ...defaults.headers,
    'X-Language': lang,
    ...options.headers,
  };

  if (!isFormData && !headers['Content-Type'] && options.body) {
    headers['Content-Type'] = 'application/json';
  }

  // Attach CSRF Token for mutating requests
  const method = (options.method || 'GET').toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrftoken = getCookie('csrftoken');
    if (csrftoken && !headers['X-CSRFToken']) {
      headers['X-CSRFToken'] = csrftoken;
    }
  }

  const response = await fetch(url, {
    ...defaults,
    ...options,
    headers,
  });

  // Handle file downloads (e.g. blobs)
  if (options.responseType === 'blob') {
    if (!response.ok) {
      throw new Error(
        lang === 'ru'
          ? `Ошибка сервера: ${response.status}`
          : `Server xatosi: ${response.status}`
      );
    }
    return await response.blob();
  }

  // Parse JSON response
  let data;
  try {
    data = await response.json();
  } catch (err) {
    data = null;
  }

  if (!response.ok) {
    const errorMessage =
      data?.error ||
      data?.detail ||
      (lang === 'ru'
        ? `Ошибка: ${response.status} ${response.statusText}`
        : `Xatolik: ${response.status} ${response.statusText}`);
    const error = new Error(errorMessage);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}
