import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { localizeSubject } from '../i18n/portalUtils';
import {
  resolvePortalMode,
  getMainHomeTarget,
  getMainSectionHref,
  getPortalLinkTarget,
} from '../utils/portalHost';
import {
  ShieldCheck,
  Presentation as ChalkboardTeacher,
  GraduationCap,
  Settings,
  LogOut,
} from 'lucide-react';

function PortalNavItem({ target, className, style, title, children }) {
  if (target.internal) {
    return (
      <Link to={target.to} className={className} style={style} title={title}>
        {children}
      </Link>
    );
  }
  return (
    <a href={target.href} className={className} style={style} title={title}>
      {children}
    </a>
  );
}

export default function Navbar() {
  const { user, logout, language, tr, switchLanguage, openProfileModal } = useAuth();
  const location = useLocation();
  const portalMode = resolvePortalMode();

  const homeTarget = getMainHomeTarget({ portalMode });
  const isMainHomeActive = portalMode === 'main' && location.pathname === '/';
  const isOnAdminPortal =
    portalMode === 'admin' || (portalMode === 'main' && location.pathname.startsWith('/admin-panel'));
  const adminHomeTarget = getPortalLinkTarget('admin', '', { portalMode });
  const adminTestsTarget = getPortalLinkTarget('admin', '?tab=tests', { portalMode });
  const teacherPortalTarget = getPortalLinkTarget('teacher', '', { portalMode });
  const studentPortalTarget = getPortalLinkTarget('student', '', { portalMode });

  return (
    <header className="navbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        <PortalNavItem target={homeTarget} className="diamond-brand-lockup">
          <img src="/static/img/diamond_icon.png" alt="Diamond School" className="diamond-brand-gem" />
          <div className="diamond-brand-names">
            <span className="brand-title">DIAMOND</span>
            <span className="brand-subtitle">SCHOOL</span>
          </div>
        </PortalNavItem>
      </div>

      {/* Center Nav Links */}
      <nav className="navbar-center-nav">
        <PortalNavItem
          target={homeTarget}
          className={`nav-link-item ${isMainHomeActive ? 'active-nav-section' : ''}`}
        >
          {tr('BOSH SAHIFA', 'ГЛАВНАЯ')}
        </PortalNavItem>
        <a href={getMainSectionHref('#teachers-section', { portalMode })} className="nav-link-item">
          {tr('USTOZLAR', 'УЧИТЕЛЯ')}
        </a>
        <a href={getMainSectionHref('#talented-section', { portalMode })} className="nav-link-item">
          {tr('IQTIDORLILAR', 'ТАЛАНТЫ')}
        </a>
        <a href={getMainSectionHref('#contact-section', { portalMode })} className="nav-link-item">
          {tr("BOG'LANISH", 'КОНТАКТЫ')}
        </a>

        {/* If Admin, show direct nav link to Admin Panel & Tests */}
        {user?.role === 'admin' && (
          <>
            <PortalNavItem
              target={adminHomeTarget}
              className={`nav-link-item ${isOnAdminPortal && !location.search.includes('tab=tests') ? 'active-nav-section' : ''}`}
              style={{ color: '#f59e0b', fontWeight: 800 }}
            >
              👑 {tr('ADMIN PANELI', 'АДМИН')}
            </PortalNavItem>
            <PortalNavItem
              target={adminTestsTarget}
              className={`nav-link-item ${isOnAdminPortal && location.search.includes('tab=tests') ? 'active-nav-section' : ''}`}
              style={{ color: '#38bdf8', fontWeight: 800 }}
            >
              📋 {tr('TESTLAR', 'ТЕСТЫ')}
            </PortalNavItem>
          </>
        )}
      </nav>

      {/* Right Action Items */}
      <div className="nav-actions">
        {/* User Status Chip if Logged In */}
        {user && (
          <div className="flex items-center gap-2">
            {user.role === 'admin' && (
              <PortalNavItem
                target={adminHomeTarget}
                className="navbar-user-chip"
                title={tr("Admin Paneliga o'tish", 'Перейти в панель администратора')}
              >
                <div className="navbar-user-avatar" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                  <ShieldCheck size={16} />
                </div>
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-xs font-bold text-white">{tr('Boshqaruv', 'Управление')}</span>
                  <span className="text-[10px] text-amber-400 font-bold">{tr('Admin', 'Админ')}</span>
                </div>
              </PortalNavItem>
            )}

            {user.role === 'teacher' && (
              <PortalNavItem
                target={teacherPortalTarget}
                className="navbar-user-chip"
                title={tr("O'qituvchi Portaliga o'tish", 'Перейти на портал учителя')}
              >
                <div className="navbar-user-avatar overflow-hidden" style={{ background: 'linear-gradient(135deg, #0ea5e9, #0284c7)' }}>
                  {user.hasCustomAvatar && user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ChalkboardTeacher size={16} />
                  )}
                </div>
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-xs font-bold text-white">{user.fullName || tr('Ustoz', 'Учитель')}</span>
                  <span className="text-[10px] text-cyan-400 font-bold">
                    {user.subject ? localizeSubject(user.subject, language) : tr("O'qituvchi", 'Учитель')}
                  </span>
                </div>
              </PortalNavItem>
            )}

            {user.role === 'student' && (
              <PortalNavItem
                target={studentPortalTarget}
                className="navbar-user-chip"
                title={tr("O'quvchi Kabinetiga o'tish", 'Перейти в кабинет ученика')}
              >
                <div className="navbar-user-avatar overflow-hidden" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                  {user.hasCustomAvatar && user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <GraduationCap size={16} />
                  )}
                </div>
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-xs font-bold text-white">{user.fullName || tr("O'quvchi", 'Ученик')}</span>
                  <span className="text-[10px] text-amber-300 font-bold">
                    💎 {user.coins || 0} {tr('Coins', 'коинов')}
                  </span>
                </div>
              </PortalNavItem>
            )}

            <button
              type="button"
              onClick={openProfileModal}
              className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-cyan-500/20 border border-slate-700 hover:border-cyan-400/60 text-slate-300 hover:text-cyan-300 flex items-center justify-center transition-all"
              title={tr("Profilni tahrirlash (Rasm, Ma'lumotlar, Parol)", 'Редактировать профиль (Фото, Данные, Пароль)')}
            >
              <Settings size={15} />
            </button>

            <button
              type="button"
              onClick={logout}
              className="navbar-logout-btn"
              title={tr('Tizimdan chiqish', 'Выйти из системы')}
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">{tr('Chiqish', 'Выйти')}</span>
            </button>
          </div>
        )}

        {/* Language Switcher */}
        <div className="diamond-lang-switcher" role="group" aria-label={tr('Tilni tanlash', 'Выбор языка')}>
          <button
            type="button"
            className={`diamond-lang-btn ${language === 'uz' ? 'active' : ''}`}
            onClick={() => switchLanguage('uz')}
            aria-pressed={language === 'uz'}
            title="O'zbek tili"
          >
            <svg className="diamond-lang-flag" viewBox="0 0 500 250" aria-hidden="true">
              <rect width="500" height="83" fill="#0099b5" />
              <rect y="83" width="500" height="84" fill="#ffffff" />
              <rect y="167" width="500" height="83" fill="#1eb53a" />
              <rect y="80" width="500" height="5" fill="#d6171f" />
              <rect y="165" width="500" height="5" fill="#d6171f" />
              <circle cx="50" cy="42" r="28" fill="#ffffff" />
              <circle cx="60" cy="42" r="28" fill="#0099b5" />
              <g fill="#ffffff">
                <circle cx="100" cy="20" r="4" /><circle cx="120" cy="20" r="4" /><circle cx="140" cy="20" r="4" />
                <circle cx="120" cy="40" r="4" /><circle cx="140" cy="40" r="4" /><circle cx="140" cy="60" r="4" />
              </g>
            </svg>
            <span className="diamond-lang-code">UZ</span>
          </button>
          <button
            type="button"
            className={`diamond-lang-btn ${language === 'ru' ? 'active' : ''}`}
            onClick={() => switchLanguage('ru')}
            aria-pressed={language === 'ru'}
            title="Русский язык"
          >
            <svg className="diamond-lang-flag" viewBox="0 0 500 250" aria-hidden="true">
              <rect width="500" height="83" fill="#ffffff" />
              <rect y="83" width="500" height="84" fill="#0039a6" />
              <rect y="167" width="500" height="83" fill="#d52b1e" />
            </svg>
            <span className="diamond-lang-code">RU</span>
          </button>
        </div>
      </div>
    </header>
  );
}
