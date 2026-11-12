const VALID_PORTALS = ['admin', 'teacher', 'tutor', 'student'];
const ALL_MODES = ['main', ...VALID_PORTALS];

const LEGACY_PORTAL_PATHS = {
  admin: '/admin-panel/',
  teacher: '/teacher/',
  tutor: '/tutor/',
  student: '/student/',
};

function normalizeProtocol(rawProtocol) {
  if (rawProtocol === 'http:' || rawProtocol === 'http') {
    return 'http:';
  }
  return 'https:';
}

function getDefaultOrigin(subdomain = 'app', rawProtocol) {
  const proto = normalizeProtocol(
    rawProtocol || (typeof window !== 'undefined' ? window.location?.protocol : 'https:')
  );
  return `${proto}//${subdomain}.diamondschool.uz`;
}

function sanitizeHttpOrigin(rawUrl, fallbackUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return fallbackUrl;
  }
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return fallbackUrl;
    }
    return parsed.origin;
  } catch {
    return fallbackUrl;
  }
}

export function readSpaConfig() {
  if (typeof document === 'undefined' || typeof document.getElementById !== 'function') {
    return null;
  }
  const el = document.getElementById('diamond-spa-config');
  if (!el || !el.textContent) {
    return null;
  }
  try {
    const parsed = JSON.parse(el.textContent);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function resolvePortalMode(options = {}) {
  const hasExplicitConfig = Object.prototype.hasOwnProperty.call(options, 'config');
  const config = hasExplicitConfig
    ? options.config
    : options.hostname !== undefined
    ? null
    : readSpaConfig();

  const configuredMode = config?.portalMode;
  if (ALL_MODES.includes(configuredMode)) {
    return configuredMode;
  }

  const rawHost =
    options.hostname !== undefined
      ? options.hostname
      : typeof window !== 'undefined'
      ? window.location?.hostname || ''
      : '';
  const host = String(rawHost).trim().toLowerCase().split(':')[0];

  if (host === 'admin.diamondschool.uz' || host === 'admin.localhost') {
    return 'admin';
  }
  if (host === 'teacher.diamondschool.uz' || host === 'teacher.localhost') {
    return 'teacher';
  }
  if (host === 'tutor.diamondschool.uz' || host === 'tutor.localhost') {
    return 'tutor';
  }
  if (host === 'student.diamondschool.uz' || host === 'student.localhost') {
    return 'student';
  }
  return 'main';
}

export function getMainSiteUrl(options = {}) {
  const hasExplicitConfig = Object.prototype.hasOwnProperty.call(options, 'config');
  const config = hasExplicitConfig ? options.config : readSpaConfig();
  const fallback = getDefaultOrigin('app', options.protocol);
  return sanitizeHttpOrigin(config?.mainSiteUrl, fallback);
}

export function getPortalBaseUrl(role, options = {}) {
  const normalizedRole = VALID_PORTALS.includes(role) ? role : 'student';
  const hasExplicitConfig = Object.prototype.hasOwnProperty.call(options, 'config');
  const config = hasExplicitConfig ? options.config : readSpaConfig();
  const fallback = getDefaultOrigin(normalizedRole, options.protocol);
  const raw = config?.portalUrls?.[normalizedRole];
  return sanitizeHttpOrigin(raw, fallback);
}

export function getMainHomeTarget(options = {}) {
  const mode = options.portalMode || resolvePortalMode(options);
  if (mode === 'main') {
    return { internal: true, to: '/' };
  }
  return { internal: false, href: `${getMainSiteUrl(options)}/` };
}

export function getMainSectionHref(hash = '#hero-section', options = {}) {
  const rawHash = String(hash || '').trim();
  const cleanHash = !rawHash ? '' : rawHash.startsWith('#') ? rawHash : `#${rawHash}`;
  const mode = options.portalMode || resolvePortalMode(options);
  if (mode === 'main') {
    return `/${cleanHash}`;
  }
  return `${getMainSiteUrl(options)}/${cleanHash}`;
}

export function getPortalLinkTarget(role, search = '', options = {}) {
  const normalizedRole = VALID_PORTALS.includes(role) ? role : 'student';
  const cleanSearch = search
    ? String(search).startsWith('?')
      ? String(search)
      : `?${search}`
    : '';
  const mode = options.portalMode || resolvePortalMode(options);

  if (mode === normalizedRole) {
    return { internal: true, to: `/${cleanSearch}` };
  }
  if (mode === 'main') {
    return { internal: true, to: `${LEGACY_PORTAL_PATHS[normalizedRole]}${cleanSearch}` };
  }
  return { internal: false, href: `${getPortalBaseUrl(normalizedRole, options)}/${cleanSearch}` };
}

