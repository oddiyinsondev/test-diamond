import React, { useState, useEffect } from 'react';
import { LayoutGrid, X, ChevronRight } from 'lucide-react';

export default function MobilePortalNav({
  title = "Bo'limlar",
  primaryItems = [],
  allItems = [],
  menuLabel = "Bo'limlar",
  accent = 'cyan', // 'cyan' | 'amber' | 'purple' | 'sky'
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen]);

  const showMenuButton = allItems.length > primaryItems.length;
  const isSecondaryActive =
    showMenuButton &&
    allItems.some((item) => item.active) &&
    !primaryItems.some((item) => item.active);

  const handleSelectItem = (item) => {
    if (typeof item.onClick === 'function') {
      item.onClick();
    }
    setDrawerOpen(false);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <>
      {/* Fixed Bottom Native-Style Navigation Bar (mobile & tablet <= 960px only) */}
      <nav
        className={`mobile-portal-bottom-nav accent-${accent}`}
        aria-label={title}
      >
        {primaryItems.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => handleSelectItem(item)}
            className={`mobile-bottom-tab ${item.active ? 'is-active' : ''} ${
              item.highlight === 'live' ? 'is-live' : ''
            } ${item.highlight === 'coin' ? 'is-coin' : ''}`}
          >
            <span className="mobile-bottom-tab-icon">
              {item.icon}
              {item.badge !== undefined && item.badge !== null && item.badge !== '' && (
                <span
                  className={`mobile-bottom-tab-badge ${
                    item.highlight === 'live' ? 'badge-live' : ''
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </span>
            <span className="mobile-bottom-tab-label">{item.shortLabel || item.label}</span>
          </button>
        ))}

        {showMenuButton && (
          <button
            type="button"
            onClick={() => setDrawerOpen((v) => !v)}
            className={`mobile-bottom-tab ${drawerOpen || isSecondaryActive ? 'is-active' : ''}`}
            aria-expanded={drawerOpen}
          >
            <span className="mobile-bottom-tab-icon">
              {drawerOpen ? <X size={19} /> : <LayoutGrid size={19} />}
              <span className="mobile-bottom-tab-badge">{allItems.length}</span>
            </span>
            <span className="mobile-bottom-tab-label">{menuLabel}</span>
          </button>
        )}
      </nav>

      {/* Slide-Up Full Sections Sheet */}
      {drawerOpen && (
        <div
          className="mobile-portal-drawer-backdrop"
          onClick={() => setDrawerOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <div
            className="mobile-portal-drawer-sheet animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mobile-portal-drawer-handle" />
            <div className="mobile-portal-drawer-header">
              <div className="flex items-center gap-2">
                <LayoutGrid size={17} className="text-cyan-400" />
                <span className="text-sm font-extrabold text-white">{title}</span>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-800/90 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mobile-portal-drawer-list">
              {allItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleSelectItem(item)}
                  className={`mobile-drawer-item ${item.active ? 'is-active' : ''} ${
                    item.highlight === 'coin' ? 'is-coin' : ''
                  }`}
                >
                  <div className="mobile-drawer-item-icon">{item.icon}</div>
                  <span className="mobile-drawer-item-label">{item.label}</span>
                  {item.badge !== undefined && item.badge !== null && item.badge !== '' && (
                    <span
                      className={`mobile-drawer-item-badge ${
                        item.highlight === 'live' ? 'badge-live' : ''
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                  <ChevronRight size={15} className="text-slate-500 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
