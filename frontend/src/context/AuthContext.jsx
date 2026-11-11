import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api/endpoints';
import { translations } from '../i18n/translations';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState(() => localStorage.getItem('diamond_lang') || 'uz');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [authInitialRole, setAuthInitialRole] = useState('student');

  useEffect(() => {
    document.documentElement.lang = language || 'uz';
  }, [language]);

  // Dictionary translation helper
  const t = useCallback(
    (key) => {
      const dict = translations[language] || translations.uz;
      return dict[key] || translations.uz[key] || key;
    },
    [language]
  );

  // Inline bilingual (UZ / RU) translation helper
  const tr = useCallback(
    (uzText, ruText) => {
      if (language === 'ru') {
        return ruText !== undefined && ruText !== null ? ruText : uzText;
      }
      return uzText;
    },
    [language]
  );

  const switchLanguage = (lang) => {
    const normalized = lang === 'ru' ? 'ru' : 'uz';
    setLanguage(normalized);
    localStorage.setItem('diamond_lang', normalized);
  };

  const fetchCurrentUser = useCallback(async () => {
    try {
      const res = await api.auth.me();
      if (res && res.authenticated && res.user) {
        setUser(res.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.warn('Auth check error:', err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  const login = async (username, password, role) => {
    const res = await api.auth.login(username, password, role);
    if (res && res.success && res.user) {
      setUser(res.user);
      setAuthModalOpen(false);
      return res.user;
    }
    throw new Error(
      res?.error ||
        (language === 'ru' ? 'Произошла ошибка при входе' : 'Kirishda xatolik yuz berdi')
    );
  };

  const logout = async () => {
    try {
      await api.auth.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
    }
  };

  const updateProfile = async (formData) => {
    const res = await api.auth.updateProfile(formData);
    if (res && res.success && res.user) {
      setUser(res.user);
      return res.user;
    }
    throw new Error(
      res?.error ||
        (language === 'ru'
          ? 'Произошла ошибка при обновлении профиля'
          : 'Profilni yangilashda xatolik yuz berdi')
    );
  };

  const openAuthModal = (role = 'student') => {
    setAuthInitialRole(role);
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => setAuthModalOpen(false);
  const openProfileModal = () => setProfileModalOpen(true);
  const closeProfileModal = () => setProfileModalOpen(false);

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        loading,
        language,
        switchLanguage,
        t,
        tr,
        login,
        logout,
        updateProfile,
        refreshUser: fetchCurrentUser,
        authModalOpen,
        openAuthModal,
        closeAuthModal,
        authInitialRole,
        profileModalOpen,
        openProfileModal,
        closeProfileModal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
