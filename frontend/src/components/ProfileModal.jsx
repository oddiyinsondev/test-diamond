import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../api/endpoints';
import { localizeSubject } from '../i18n/portalUtils';
import { Eye, EyeOff, Camera, Trash2, Lock, ShieldCheck } from 'lucide-react';

const DEFAULT_SUBJECTS = [
  'Matematika',
  'Fizika',
  'Informatika',
  'Ingliz tili',
  'Biologiya',
  'Kimyo',
  'Tarix',
  'Ona tili va Adabiyot',
];

export default function ProfileModal() {
  const { user, profileModalOpen, closeProfileModal, updateProfile, language, tr } = useAuth();
  const { showToast } = useToast();
  const fileInputRef = useRef(null);

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [subject, setSubject] = useState('Matematika');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [clearAvatar, setClearAvatar] = useState(false);
  const [subjectsList, setSubjectsList] = useState(DEFAULT_SUBJECTS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profileModalOpen && user?.role === 'teacher') {
      api.auth.meta()
        .then((m) => {
          if (Array.isArray(m?.subjects) && m.subjects.length) {
            setSubjectsList(m.subjects);
          }
        })
        .catch(() => {});
    }
  }, [profileModalOpen, user?.role]);

  useEffect(() => {
    if (user && profileModalOpen) {
      setFullName(user.fullName || '');
      setUsername(user.username || '');
      setSubject(user.subject || 'Matematika');
      setPhone(user.phone || '');
      setBio(user.bio || '');
      setAvatarPreview(user.avatarUrl || '');
      setAvatarFile(null);
      setClearAvatar(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswords(false);
    }
  }, [user, profileModalOpen]);

  if (!profileModalOpen || !user) return null;

  const isTutorRestricted = user.role === 'tutor';

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast(
        tr('Faqat rasm fayllarini yuklash mumkin!', 'Можно загружать только изображения!'),
        'warning'
      );
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast(
        tr('Rasm hajmi 5MB dan oshmasligi kerak!', 'Размер изображения не должен превышать 5 МБ!'),
        'warning'
      );
      return;
    }
    setAvatarFile(file);
    setClearAvatar(false);
    const reader = new FileReader();
    reader.onload = (event) => setAvatarPreview(event.target.result);
    reader.readAsDataURL(file);
  };

  const handleClearAvatar = () => {
    setAvatarFile(null);
    setClearAvatar(true);
    const seed = user.fullName || user.username || 'U';
    setAvatarPreview(
      `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed.slice(0, 2).toUpperCase())}&backgroundColor=0284c7&textColor=ffffff`
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isTutorRestricted && (newPassword || confirmPassword || oldPassword)) {
      if (newPassword && newPassword.trim().length < 3) {
        showToast(
          tr(
            "Yangi parol kamida 3 ta belgidan iborat bo'lishi kerak!",
            'Новый пароль должен содержать не менее 3 символов!'
          ),
          'warning'
        );
        return;
      }
      if (!newPassword) {
        showToast(tr('Yangi parolni ham kiriting!', 'Введите также новый пароль!'), 'warning');
        return;
      }
      if (user.role !== 'admin' && !oldPassword) {
        showToast(
          tr(
            "Parolni o'zgartirish uchun avvalgi parolni kiriting!",
            'Для смены пароля введите текущий пароль!'
          ),
          'error'
        );
        return;
      }
      if (newPassword !== confirmPassword) {
        showToast(tr('Yangi parollar mos kelmadi!', 'Новые пароли не совпадают!'), 'error');
        return;
      }
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('fullName', fullName.trim());
      if (!isTutorRestricted && username.trim()) formData.append('username', username.trim());
      formData.append('phone', phone.trim());
      formData.append('bio', bio.trim());
      if (user.role === 'teacher' && subject) {
        formData.append('subject', subject);
      }
      if (clearAvatar) {
        formData.append('clearAvatar', 'true');
      }
      if (avatarFile) {
        formData.append('avatar', avatarFile);
      }
      if (!isTutorRestricted && newPassword) {
        if (oldPassword) formData.append('oldPassword', oldPassword);
        formData.append('newPassword', newPassword.trim());
      }

      await updateProfile(formData);
      showToast(tr('Profil muvaffaqiyatli saqlandi!', 'Профиль успешно сохранён!'), 'success');
      closeProfileModal();
    } catch (err) {
      showToast(
        err.message || tr('Saqlashda xatolik yuz berdi', 'Произошла ошибка при сохранении'),
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  const subjectOptions = subjectsList.includes(subject)
    ? subjectsList
    : subject
    ? [subject, ...subjectsList]
    : subjectsList;

  return (
    <div className="modal-backdrop" onClick={closeProfileModal}>
      <div
        className="modal-content"
        style={{ maxWidth: '540px', maxHeight: '92vh', overflowY: 'auto', padding: '1.75rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px', color: '#FFFFFF' }}>
            <i className="fa-solid fa-id-card" style={{ color: '#29B7E1' }}></i>{' '}
            {tr('Profilni Tahrirlash', 'Редактирование профиля')}
          </h3>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={closeProfileModal}
            style={{ borderRadius: '50%', width: '32px', height: '32px', padding: 0 }}
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Avatar Upload & Preview */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
            <div
              style={{
                width: '96px',
                height: '96px',
                borderRadius: '50%',
                overflow: 'hidden',
                border: '3px solid #29B7E1',
                boxShadow: '0 0 18px rgba(41, 183, 225, 0.4)',
                cursor: 'pointer',
                position: 'relative',
              }}
              onClick={() => fileInputRef.current?.click()}
              title={tr('Rasm tanlash', 'Выбрать фото')}
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', background: '#0873aa', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '2rem', fontWeight: 900 }}>
                  {fullName?.charAt(0) || 'U'}
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              id="profile-avatar-input-ref"
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleAvatarChange}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn btn-secondary btn-xs text-xs flex items-center gap-1.5 text-cyan-300 border-cyan-500/40"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera size={13} /> {tr('Rasm yuklash', 'Загрузить фото')}
              </button>
              {(user.hasCustomAvatar || avatarFile) && !clearAvatar && (
                <button
                  type="button"
                  className="btn btn-secondary btn-xs text-xs flex items-center gap-1 text-rose-300 border-rose-500/35"
                  onClick={handleClearAvatar}
                  title={tr("Shaxsiy rasmni o'chirish", 'Удалить личное фото')}
                >
                  <Trash2 size={13} /> {tr("O'chirish", 'Удалить')}
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="input-label">{tr("To'liq ism-familiya *", 'Полное ФИО *')}</label>
              <input
                type="text"
                className="clean-input text-xs"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="input-label flex items-center justify-between gap-2">
                <span>{tr('Login (username) *', 'Логин (username) *')}</span>
                {isTutorRestricted && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/20 border border-purple-500/40 text-purple-200 text-[10px] font-bold">
                    <Lock size={10} /> {tr('Admin belgilaydi', 'Назначает админ')}
                  </span>
                )}
              </label>
              <input
                type="text"
                className={`clean-input text-xs ${isTutorRestricted ? 'opacity-65 cursor-not-allowed bg-slate-900/70' : ''}`}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isTutorRestricted}
                readOnly={isTutorRestricted}
                required={!isTutorRestricted}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {user.role === 'teacher' && (
              <div>
                <label className="input-label">{tr("O'qitadigan fani", 'Преподаваемый предмет')}</label>
                <select
                  className="clean-select text-xs"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                >
                  {subjectOptions.map((s) => (
                    <option key={s} value={s}>{localizeSubject(s, language)}</option>
                  ))}
                </select>
              </div>
            )}
            <div className={user.role === 'teacher' ? '' : 'sm:col-span-2'}>
              <label className="input-label">{tr('Telefon raqam', 'Номер телефона')}</label>
              <input
                type="text"
                className="clean-input text-xs"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+998 (90) 123-45-67"
              />
            </div>
          </div>

          <div>
            <label className="input-label">{tr('Qisqacha bio / Shior', 'Краткое био / Девиз')}</label>
            <textarea
              className="clean-input text-xs"
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder={tr(
                'Pedagogik tajribangiz yoki shioringiz haqida...',
                'О вашем опыте или жизненном девизе...'
              )}
            />
          </div>

          {/* Password update section */}
          {isTutorRestricted ? (
            <div
              className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/30 space-y-1.5"
              style={{ marginTop: '0.75rem' }}
            >
              <div className="flex items-center gap-2 text-xs font-extrabold text-purple-200">
                <ShieldCheck size={15} className="text-purple-400 flex-shrink-0" />
                <span>{tr('Login va parol Administrator nazoratida', 'Логин и пароль под контролем администратора')}</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed m-0">
                {tr(
                  "Tyuter hisobi uchun login va parol faqat Administrator tomonidan beriladi va o'zgartiriladi. Kirish ma'lumotlarini yangilash uchun maktab administratoriga murojaat qiling.",
                  'Логин и пароль для аккаунта тьютора выдаются и изменяются только администратором. Для смены данных входа обратитесь к администратору.'
                )}
              </p>
            </div>
          ) : (
            <div style={{ marginTop: '0.75rem', paddingTop: '0.85rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div className="flex items-center justify-between mb-2">
                <span style={{ fontSize: '0.78rem', color: '#f59e0b', fontWeight: 700 }}>
                  <i className="fa-solid fa-lock"></i> {tr('Parolni yangilash (ixtiyoriy)', 'Смена пароля (необязательно)')}
                </span>
                <button
                  type="button"
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
                >
                  {showPasswords ? <EyeOff size={13} /> : <Eye size={13} />}
                  <span>{showPasswords ? tr('Yashirish', 'Скрыть') : tr("Ko'rsatish", 'Показать')}</span>
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type={showPasswords ? 'text' : 'password'}
                  className="clean-input text-xs"
                  style={{ padding: '8px 10px' }}
                  placeholder={tr('Eski parol', 'Старый пароль')}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                />
                <input
                  type={showPasswords ? 'text' : 'password'}
                  className="clean-input text-xs"
                  style={{ padding: '8px 10px' }}
                  placeholder={tr('Yangi parol', 'Новый пароль')}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <input
                  type={showPasswords ? 'text' : 'password'}
                  className="clean-input text-xs"
                  style={{ padding: '8px 10px' }}
                  placeholder={tr('Takrorlang', 'Повторите')}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={closeProfileModal}>
              {tr('Bekor qilish', 'Отмена')}
            </button>
            <button type="submit" className="btn-primary-diamond" style={{ padding: '8px 18px', fontSize: '0.85rem' }} disabled={saving}>
              {saving ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-floppy-disk"></i>}{' '}
              {tr('Saqlash', 'Сохранить')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
