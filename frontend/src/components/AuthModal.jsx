import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';

export default function AuthModal() {
  const { authModalOpen, closeAuthModal, authInitialRole, login, tr } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [role, setRole] = useState(authInitialRole || 'student');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (authInitialRole) setRole(authInitialRole);
    setErrorMsg('');
    setUsername('');
    setPassword('');
  }, [authInitialRole, authModalOpen]);

  if (!authModalOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!username.trim() || !password.trim()) {
      setErrorMsg(tr('Login va parolni kiriting!', 'Введите логин и пароль!'));
      return;
    }

    setLoading(true);
    try {
      const loggedUser = await login(username.trim(), password.trim(), role);
      showToast(
        tr(
          `Xush kelibsiz, ${loggedUser.fullName || loggedUser.username}!`,
          `Добро пожаловать, ${loggedUser.fullName || loggedUser.username}!`
        ),
        'success'
      );

      if (loggedUser.role === 'admin') {
        navigate('/admin-panel');
      } else if (loggedUser.role === 'teacher') {
        navigate('/teacher');
      } else {
        navigate('/student');
      }
    } catch (err) {
      setErrorMsg(
        err.message ||
          tr("Login yoki parol noto'g'ri!", 'Неверный логин или пароль!')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={closeAuthModal}>
      <div className="modal-content" style={{ maxWidth: '460px', padding: '2.2rem' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #0873AA, #29B7E1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.2rem', boxShadow: '0 0 15px rgba(41, 183, 225, 0.4)' }}>
              <i className="fa-solid fa-gem"></i>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF' }}>
                {tr('Tizimga Kirish', 'Вход в систему')}
              </h3>
              <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>
                {tr('Diamond School Portali', 'Портал Diamond School')}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={closeAuthModal}
            style={{ borderRadius: '50%', width: '32px', height: '32px', padding: 0 }}
          >
            &times;
          </button>
        </div>

        {/* Role Switcher Tabs */}
        <div style={{ display: 'flex', gap: '6px', background: 'rgba(7, 19, 34, 0.8)', padding: '5px', borderRadius: '12px', border: '1px solid rgba(41, 183, 225, 0.2)', marginBottom: '1.25rem' }}>
          <button
            type="button"
            style={{
              flex: 1,
              padding: '8px 4px',
              borderRadius: '8px',
              border: 'none',
              background: role === 'student' ? 'linear-gradient(135deg, #0873AA, #29B7E1)' : 'transparent',
              color: role === 'student' ? '#FFFFFF' : '#94A3B8',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onClick={() => setRole('student')}
          >
            <i className="fa-solid fa-graduation-cap" style={{ marginRight: '5px' }}></i> {tr("O'quvchi", 'Ученик')}
          </button>
          <button
            type="button"
            style={{
              flex: 1,
              padding: '8px 4px',
              borderRadius: '8px',
              border: 'none',
              background: role === 'teacher' ? 'linear-gradient(135deg, #0873AA, #29B7E1)' : 'transparent',
              color: role === 'teacher' ? '#FFFFFF' : '#94A3B8',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onClick={() => setRole('teacher')}
          >
            <i className="fa-solid fa-chalkboard-user" style={{ marginRight: '5px' }}></i> {tr('Ustoz', 'Учитель')}
          </button>
          <button
            type="button"
            style={{
              flex: 1,
              padding: '8px 4px',
              borderRadius: '8px',
              border: 'none',
              background: role === 'admin' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'transparent',
              color: role === 'admin' ? '#000000' : '#94A3B8',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onClick={() => setRole('admin')}
          >
            <i className="fa-solid fa-shield-halved" style={{ marginRight: '5px' }}></i> {tr('Admin', 'Админ')}
          </button>
        </div>

        {errorMsg && (
          <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.35)', color: '#f87171', fontSize: '0.82rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-triangle-exclamation"></i>
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="clean-input-group" style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#CBD5E1', marginBottom: '6px' }}>
              {tr('Foydalanuvchi logini:', 'Логин пользователя:')}
            </label>
            <input
              type="text"
              className="clean-input"
              placeholder={role === 'admin' ? 'admin' : role === 'teacher' ? 'anvar_muallim' : 'jasur_9a'}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="clean-input-group" style={{ marginBottom: '1.4rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#CBD5E1', marginBottom: '6px' }}>
              {tr('Maxfiy parol:', 'Секретный пароль:')}
            </label>
            <input
              type="password"
              className="clean-input"
              placeholder={tr('Parolni kiriting', 'Введите пароль')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn-primary-diamond"
            style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
            disabled={loading}
          >
            {loading ? (
              <>
                <i className="fa-solid fa-spinner fa-spin"></i> {tr('Tekshirilmoqda...', 'Проверка...')}
              </>
            ) : (
              <>
                <i className="fa-solid fa-right-to-bracket"></i> {tr('Tizimga Kirish', 'Войти в систему')}
              </>
            )}
          </button>
        </form>

        <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', textAlign: 'center', fontSize: '0.78rem', color: '#94A3B8' }}>
          {tr('Test hisoblari paroli:', 'Пароль для тестовых аккаунтов:')}{' '}
          <strong style={{ color: '#29B7E1' }}>123</strong>
        </div>
      </div>
    </div>
  );
}
