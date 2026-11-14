import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../api/endpoints';
import ConfirmModal from '../components/ConfirmModal';
import { localizeGrade, localizeUserFullName } from '../i18n/portalUtils';
import {
  UserCheck,
  Users,
  GraduationCap,
  School,
  Coins,
  TrendingUp,
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Lock,
  User,
  Phone,
  Camera,
  Save,
  Loader2,
  AlertCircle,
  Clock,
  Wallet,
  Calendar,
  RefreshCw,
  ShieldCheck,
  KeyRound,
  Copy,
  Check,
} from 'lucide-react';

const TUTOR_VALID_TABS = ['students', 'coins', 'profile'];

export default function TutorPortal() {
  const { user, login, updateProfile, refreshUser, language, tr } = useAuth();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const profileFileInputRef = useRef(null);

  // Auth gate state
  const [gateUsername, setGateUsername] = useState('');
  const [gatePassword, setGatePassword] = useState('');
  const [gateLoading, setGateLoading] = useState(false);
  const [gateError, setGateError] = useState('');
  const [showGatePassword, setShowGatePassword] = useState(false);

  const initialTabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(
    TUTOR_VALID_TABS.includes(initialTabParam) ? initialTabParam : 'students'
  );

  // Admin can inspect all or select a specific tutor
  const [adminTutorsList, setAdminTutorsList] = useState([]);
  const [selectedTutorFilterId, setSelectedTutorFilterId] = useState('');

  // Dashboard data
  const [loadingData, setLoadingData] = useState(false);
  const [tutorInfo, setTutorInfo] = useState(null);
  const [assignedClasses, setAssignedClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [coinHistory, setCoinHistory] = useState([]);
  const [summary, setSummary] = useState({
    assignedClassesCount: 0,
    studentsCount: 0,
    tutorCoins: 0,
    classBonusTotal: 0,
    studentCoinsTotal: 0,
    avgScore: 0,
  });

  // Filters
  const [studentSearch, setStudentSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [coinHistorySearch, setCoinHistorySearch] = useState('');
  const [coinHistoryClassFilter, setCoinHistoryClassFilter] = useState('all');

  // Add Student modal state
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [savingAddStudent, setSavingAddStudent] = useState(false);
  const [studentForm, setStudentForm] = useState({
    fullName: '',
    username: '',
    password: '123',
    grade: '',
    phone: '',
    bio: '',
  });
  const [studentAvatarFile, setStudentAvatarFile] = useState(null);
  const [studentAvatarPreview, setStudentAvatarPreview] = useState('');
  const [issuedStudentCreds, setIssuedStudentCreds] = useState(null);
  const [copiedStudentCreds, setCopiedStudentCreds] = useState(false);
  const [resetPwStudent, setResetPwStudent] = useState(null);
  const [quickStudentPw, setQuickStudentPw] = useState('');
  const [savingQuickPw, setSavingQuickPw] = useState(false);

  // Edit Student modal state
  const [editingStudent, setEditingStudent] = useState(null);
  const [savingEditStudent, setSavingEditStudent] = useState(false);
  const [showEditStudentPw, setShowEditStudentPw] = useState(false);
  const [editStudentForm, setEditStudentForm] = useState({
    fullName: '',
    username: '',
    password: '',
    grade: '',
    phone: '',
    bio: '',
    avatarFile: null,
    avatarPreview: '',
    clearAvatar: false,
    hasCustomAvatar: false,
  });

  // Confirm delete modal
  const [confirmModalState, setConfirmModalState] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Profile & password editor state
  const [profileForm, setProfileForm] = useState({
    fullName: '',
    username: '',
    phone: '',
    bio: '',
  });
  const [profileAvatarPreview, setProfileAvatarPreview] = useState('');
  const [profileAvatarFile, setProfileAvatarFile] = useState(null);
  const [profileClearAvatar, setProfileClearAvatar] = useState(false);
  const [savingProfileInfo, setSavingProfileInfo] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showProfilePasswords, setShowProfilePasswords] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const isTutor = user && (user.role === 'tutor' || user.role === 'admin');
  const isTutorSelfRestricted = user?.role === 'tutor';

  const loadTutorData = useCallback(async () => {
    if (!isTutor) return;
    setLoadingData(true);
    try {
      const requests = [
        api.tutor.getDashboard(user.role === 'admin' ? selectedTutorFilterId : ''),
      ];
      if (user.role === 'admin') {
        requests.push(api.admin.getTutors());
      }
      const [dashRes, tutorsRes] = await Promise.allSettled(requests);

      if (dashRes.status === 'fulfilled' && dashRes.value) {
        const d = dashRes.value;
        setTutorInfo(d.tutor || user);
        setAssignedClasses(Array.isArray(d.assignedClasses) ? d.assignedClasses : []);
        setStudents(Array.isArray(d.students) ? d.students : []);
        setCoinHistory(Array.isArray(d.coinHistory) ? d.coinHistory : []);
        setSummary(
          d.summary || {
            assignedClassesCount: 0,
            studentsCount: 0,
            tutorCoins: 0,
            classBonusTotal: 0,
            studentCoinsTotal: 0,
            avgScore: 0,
          }
        );
      } else if (dashRes.status === 'rejected') {
        showToast(
          dashRes.reason?.message ||
            tr("Tyuter ma'lumotlarini yuklashda xatolik!", 'Ошибка загрузки данных тьютора!'),
          'error'
        );
      }

      if (tutorsRes && tutorsRes.status === 'fulfilled') {
        const list = Array.isArray(tutorsRes.value) ? tutorsRes.value : [];
        setAdminTutorsList(list);
      }
    } finally {
      setLoadingData(false);
    }
  }, [isTutor, user, selectedTutorFilterId, showToast, tr]);

  useEffect(() => {
    if (isTutor) {
      loadTutorData();
    }
  }, [isTutor, language, selectedTutorFilterId, loadTutorData]);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && TUTOR_VALID_TABS.includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  // Keep profile form in sync with logged user
  useEffect(() => {
    if (user) {
      setProfileForm({
        fullName: user.fullName || '',
        username: user.username || '',
        phone: user.rawPhone !== undefined ? user.rawPhone : user.phone && user.phone !== '-' ? user.phone : '',
        bio: user.bio || '',
      });
      setProfileAvatarPreview(user.avatarUrl || '');
      setProfileAvatarFile(null);
      setProfileClearAvatar(false);
    }
  }, [user]);

  // Keep add student default grade synced with assigned classes
  useEffect(() => {
    if (assignedClasses.length > 0) {
      setStudentForm((prev) => {
        const exists = assignedClasses.some((c) => c.name === prev.grade);
        return exists ? prev : { ...prev, grade: assignedClasses[0].name };
      });
    } else {
      setStudentForm((prev) => ({ ...prev, grade: '' }));
    }
  }, [assignedClasses]);

  const handleGateLogin = async (e) => {
    e.preventDefault();
    setGateError('');
    setGateLoading(true);
    try {
      const loggedUser = await login(gateUsername.trim(), gatePassword, 'tutor');
      if (loggedUser.role !== 'tutor' && loggedUser.role !== 'admin') {
        setGateError(
          tr('Ushbu hisob tyuter huquqiga ega emas!', 'Этот аккаунт не имеет прав тьютора!')
        );
        return;
      }
      showToast(
        tr('Tyuter portaliga xush kelibsiz!', 'Добро пожаловать в портал тьютора!'),
        'success'
      );
    } catch (err) {
      setGateError(err.message || tr('Login yoki parol xato!', 'Неверный логин или пароль!'));
    } finally {
      setGateLoading(false);
    }
  };

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    return (Array.isArray(students) ? students : []).filter((s) => {
      const matchesGrade = gradeFilter === 'all' || s.grade === gradeFilter;
      if (!matchesGrade) return false;
      if (!q) return true;
      return (
        (s.fullName || '').toLowerCase().includes(q) ||
        (s.username || '').toLowerCase().includes(q) ||
        (s.grade || '').toLowerCase().includes(q) ||
        (s.phone || '').toLowerCase().includes(q)
      );
    });
  }, [students, studentSearch, gradeFilter]);

  const filteredCoinHistory = useMemo(() => {
    const q = coinHistorySearch.trim().toLowerCase();
    return (Array.isArray(coinHistory) ? coinHistory : []).filter((tx) => {
      const matchesCls =
        coinHistoryClassFilter === 'all' || tx.className === coinHistoryClassFilter;
      if (!matchesCls) return false;
      if (!q) return true;
      return (
        (tx.className || '').toLowerCase().includes(q) ||
        (tx.reason || '').toLowerCase().includes(q) ||
        (tx.givenBy || '').toLowerCase().includes(q) ||
        (tx.tutorName || '').toLowerCase().includes(q)
      );
    });
  }, [coinHistory, coinHistorySearch, coinHistoryClassFilter]);

  // Available classes for Add/Edit student modal
  const editableClassOptions = useMemo(() => {
    const list = assignedClasses.map((c) => c.name);
    if (gradeFilter !== 'all' && list.includes(gradeFilter)) return list;
    return list;
  }, [assignedClasses, gradeFilter]);

  const handleOpenAddStudent = () => {
    if (user?.role !== 'admin' && assignedClasses.length === 0) {
      showToast(
        tr(
          "Sizga hali birorta sinf biriktirilmagan. Administrator sinf biriktirgandan so'ng o'quvchi qo'sha olasiz.",
          'Вам ещё не назначен ни один класс. Вы сможете добавлять учеников после назначения класса администратором.'
        ),
        'warning'
      );
      return;
    }
    const defaultGrade =
      gradeFilter !== 'all' && assignedClasses.some((c) => c.name === gradeFilter)
        ? gradeFilter
        : assignedClasses[0]?.name || '';
    setStudentForm({
      fullName: '',
      username: '',
      password: '123',
      grade: defaultGrade,
      phone: '',
      bio: '',
    });
    setStudentAvatarFile(null);
    setStudentAvatarPreview('');
    setIsAddStudentOpen(true);
  };

  const handleCopyStudentCredentials = async (creds) => {
    if (!creds) return;
    const portalUrl = `${window.location.origin}/student/`;
    const lines = [
      `Diamond School — ${tr("O'quvchi kirish maʼlumotlari", 'Данные для входа ученика')}`,
      `${tr('F.I.Sh', 'Ф.И.О.')}: ${creds.fullName}`,
      `${tr('Sinf', 'Класс')}: ${creds.grade || '-'}`,
      `${tr('Portal', 'Портал')}: ${portalUrl}`,
      `${tr('Login', 'Логин')}: ${creds.username}`,
      creds.password
        ? `${tr('Parol', 'Пароль')}: ${creds.password}`
        : `${tr('Parol', 'Пароль')}: ${tr('(Avvalgi parol saqlangan)', '(Сохранён прежний пароль)')}`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(lines);
      setCopiedStudentCreds(true);
      showToast(tr("O'quvchi ma'lumotlari nusxalandi!", 'Данные ученика скопированы!'), 'success');
      setTimeout(() => setCopiedStudentCreds(false), 2200);
    } catch {
      showToast(tr('Nusxalash imkoni bo‘lmadi, qo‘lda belgilang.', 'Не удалось скопировать автоматически.'), 'warning');
    }
  };

  const handleCreateStudent = async (e) => {
    e.preventDefault();
    if (!studentForm.grade) {
      showToast(tr('Sinfni tanlang!', 'Выберите класс!'), 'warning');
      return;
    }
    setSavingAddStudent(true);
    try {
      const fd = new FormData();
      fd.append('fullName', studentForm.fullName.trim());
      fd.append('username', studentForm.username.trim());
      fd.append('password', studentForm.password.trim());
      fd.append('grade', studentForm.grade);
      fd.append('phone', studentForm.phone.trim());
      fd.append('bio', (studentForm.bio || '').trim());
      if (studentAvatarFile) {
        fd.append('avatar', studentAvatarFile);
      }
      await api.tutor.createStudent(fd);
      showToast(
        tr("Yangi o'quvchi muvaffaqiyatli qo'shildi!", 'Новый ученик успешно добавлен!'),
        'success'
      );
      setIssuedStudentCreds({
        fullName: studentForm.fullName.trim(),
        username: studentForm.username.trim(),
        password: studentForm.password.trim(),
        grade: studentForm.grade,
        mode: 'created',
      });
      setCopiedStudentCreds(false);
      setIsAddStudentOpen(false);
      setStudentAvatarFile(null);
      setStudentAvatarPreview('');
      await loadTutorData();
    } catch (err) {
      showToast(
        err.message || tr("O'quvchi qo'shishda xatolik!", 'Ошибка при добавлении ученика!'),
        'error'
      );
    } finally {
      setSavingAddStudent(false);
    }
  };

  const handleOpenEditStudent = (std) => {
    setEditingStudent(std);
    setEditStudentForm({
      fullName: std.fullName || '',
      username: std.username || '',
      password: '',
      grade: std.grade && std.grade !== '-' ? std.grade : assignedClasses[0]?.name || '',
      phone: std.rawPhone !== undefined ? std.rawPhone : std.phone && std.phone !== '-' ? std.phone : '',
      bio: std.bio || '',
      avatarFile: null,
      avatarPreview: std.avatarUrl || '',
      clearAvatar: false,
      hasCustomAvatar: Boolean(std.hasCustomAvatar),
    });
    setShowEditStudentPw(false);
  };

  const handleSaveEditStudent = async (e) => {
    e.preventDefault();
    if (!editingStudent) return;
    if (editStudentForm.password && editStudentForm.password.trim().length < 3) {
      showToast(
        tr(
          "Yangi parol kamida 3 ta belgidan iborat bo'lishi kerak!",
          'Новый пароль должен содержать минимум 3 символа!'
        ),
        'warning'
      );
      return;
    }
    setSavingEditStudent(true);
    try {
      const fd = new FormData();
      fd.append('fullName', editStudentForm.fullName.trim());
      fd.append('username', editStudentForm.username.trim());
      fd.append('grade', editStudentForm.grade);
      fd.append('phone', editStudentForm.phone.trim());
      fd.append('bio', (editStudentForm.bio || '').trim());
      if (editStudentForm.password.trim()) {
        fd.append('password', editStudentForm.password.trim());
      }
      if (editStudentForm.clearAvatar) {
        fd.append('clearAvatar', 'true');
      }
      if (editStudentForm.avatarFile) {
        fd.append('avatar', editStudentForm.avatarFile);
      }
      const res = await api.tutor.updateStudent(editingStudent.id, fd);
      showToast(
        res?.message ||
          tr("O'quvchi ma'lumotlari yangilandi!", 'Данные ученика обновлены!'),
        'success'
      );
      if (editStudentForm.password.trim()) {
        setIssuedStudentCreds({
          fullName: editStudentForm.fullName.trim(),
          username: editStudentForm.username.trim(),
          password: editStudentForm.password.trim(),
          grade: editStudentForm.grade,
          mode: 'updated',
        });
        setCopiedStudentCreds(false);
      }
      setEditingStudent(null);
      await loadTutorData();
    } catch (err) {
      showToast(
        err.message ||
          tr("O'quvchini yangilashda xatolik!", 'Ошибка при обновлении ученика!'),
        'error'
      );
    } finally {
      setSavingEditStudent(false);
    }
  };

  const handleSaveQuickStudentPw = async (e) => {
    e.preventDefault();
    if (!resetPwStudent) return;
    const cleanPw = quickStudentPw.trim();
    if (cleanPw.length < 3) {
      showToast(tr("Parol kamida 3 ta belgidan iborat bo'lishi kerak!", 'Пароль должен содержать минимум 3 символа!'), 'warning');
      return;
    }
    setSavingQuickPw(true);
    try {
      const fd = new FormData();
      fd.append('password', cleanPw);
      await api.tutor.updateStudent(resetPwStudent.id, fd);
      showToast(tr("O'quvchi paroli muvaffaqiyatli yangilandi!", 'Пароль ученика успешно обновлен!'), 'success');
      setIssuedStudentCreds({
        fullName: resetPwStudent.fullName,
        username: resetPwStudent.username,
        password: cleanPw,
        grade: resetPwStudent.grade,
        mode: 'updated',
      });
      setCopiedStudentCreds(false);
      setResetPwStudent(null);
      setQuickStudentPw('');
      await loadTutorData();
    } catch (err) {
      showToast(err.message || tr("Parolni yangilashda xatolik!", 'Ошибка при обновлении пароля!'), 'error');
    } finally {
      setSavingQuickPw(false);
    }
  };

  const handleDeleteStudent = (std) => {
    setConfirmModalState({
      isOpen: true,
      title: tr(`${std.fullName || std.username} ni o'chirish`, `Удалить ${std.fullName || std.username}`),
      message: tr(
        `Haqiqatan ham "${std.fullName || std.username}" (${localizeGrade(std.grade, language)}) o'quvchi hisobini o'chirmoqchimisiz?`,
        `Вы уверены, что хотите удалить аккаунт ученика «${std.fullName || std.username}» (${localizeGrade(std.grade, language)})?`
      ),
      danger: true,
      onConfirm: async () => {
        try {
          const res = await api.tutor.deleteStudent(std.id);
          showToast(
            res?.message || tr("O'quvchi o'chirildi!", 'Ученик удалён!'),
            'info'
          );
          setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
          await loadTutorData();
        } catch (err) {
          showToast(
            err.message || tr("O'chirishda xatolik!", 'Ошибка при удалении!'),
            'error'
          );
          setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // Profile image pick / save
  const handleProfileAvatarSelect = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast(
        tr('Rasm hajmi 5MB dan oshmasligi kerak!', 'Размер фото не должен превышать 5 МБ!'),
        'warning'
      );
      return;
    }
    setProfileAvatarFile(file);
    setProfileClearAvatar(false);
    const reader = new FileReader();
    reader.onload = (ev) => setProfileAvatarPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleProfileAvatarClear = () => {
    const seed = (profileForm.fullName || user?.username || 'T').slice(0, 2).toUpperCase();
    setProfileAvatarFile(null);
    setProfileClearAvatar(true);
    setProfileAvatarPreview(
      `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed)}&backgroundColor=7c3aed`
    );
  };

  const handleSaveProfileInfo = async (e) => {
    e.preventDefault();
    if (!profileForm.fullName.trim() || (!isTutorSelfRestricted && !profileForm.username.trim())) {
      showToast(
        tr(
          isTutorSelfRestricted ? 'Ism-familiya majburiy!' : 'Ism-familiya va login majburiy!',
          isTutorSelfRestricted ? 'ФИО обязательно!' : 'ФИО и логин обязательны!'
        ),
        'warning'
      );
      return;
    }
    setSavingProfileInfo(true);
    try {
      const fd = new FormData();
      fd.append('fullName', profileForm.fullName.trim());
      if (!isTutorSelfRestricted && profileForm.username.trim()) {
        fd.append('username', profileForm.username.trim());
      }
      fd.append('phone', profileForm.phone.trim());
      fd.append('bio', profileForm.bio.trim());
      if (profileClearAvatar) fd.append('clearAvatar', 'true');
      if (profileAvatarFile) fd.append('avatar', profileAvatarFile);
      await updateProfile(fd);
      await refreshUser?.();
      showToast(
        tr("Profil ma'lumotlari saqlandi!", 'Данные профиля сохранены!'),
        'success'
      );
      loadTutorData();
    } catch (err) {
      showToast(
        err.message || tr('Profilni saqlashda xatolik!', 'Ошибка сохранения профиля!'),
        'error'
      );
    } finally {
      setSavingProfileInfo(false);
    }
  };

  const handleUpdateProfilePassword = async (e) => {
    e.preventDefault();
    if (isTutorSelfRestricted) {
      showToast(
        tr(
          "Tyuter paroli faqat administrator tomonidan beriladi va o'zgartiriladi!",
          'Пароль тьютора выдаётся и изменяется только администратором!'
        ),
        'warning'
      );
      return;
    }
    if (passwordForm.newPassword.trim().length < 3) {
      showToast(
        tr(
          "Yangi parol kamida 3 ta belgidan iborat bo'lishi kerak!",
          'Новый пароль должен содержать минимум 3 символа!'
        ),
        'warning'
      );
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showToast(
        tr('Yangi parollar mos kelmadi!', 'Новые пароли не совпадают!'),
        'warning'
      );
      return;
    }
    setSavingPassword(true);
    try {
      const fd = new FormData();
      if (user?.role !== 'admin') {
        fd.append('oldPassword', passwordForm.oldPassword);
      }
      fd.append('newPassword', passwordForm.newPassword.trim());
      await updateProfile(fd);
      setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
      showToast(tr('Parol muvaffaqiyatli yangilandi!', 'Пароль успешно обновлён!'), 'success');
    } catch (err) {
      showToast(
        err.message || tr("Parolni yangilashda xatolik!", 'Ошибка обновления пароля!'),
        'error'
      );
    } finally {
      setSavingPassword(false);
    }
  };

  // Auth Gate
  if (!isTutor) {
    return (
      <div className="portal-gate-container">
        <div className="login-card" style={{ borderColor: 'rgba(168, 85, 247, 0.35)' }}>
          <div className="text-center" style={{ marginBottom: '1.75rem' }}>
            <div
              className="gate-emblem-wrap"
              style={{
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.25), rgba(6, 182, 212, 0.2))',
                borderColor: 'rgba(168, 85, 247, 0.45)',
                color: '#c084fc',
              }}
            >
              <UserCheck size={36} />
            </div>
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider mb-2.5"
              style={{
                background: 'rgba(168, 85, 247, 0.15)',
                border: '1px solid rgba(168, 85, 247, 0.35)',
                color: '#c084fc',
              }}
            >
              <School size={12} /> {tr('Tyuter Kabineti', 'Кабинет тьютора')}
            </div>
            <h2
              className="text-2xl font-black text-white"
              style={{ fontFamily: 'Cinzel, serif', letterSpacing: '0.5px' }}
            >
              {tr('Tyuter Kirishi', 'Вход для тьютора')}
            </h2>
            <p className="text-xs text-slate-400" style={{ marginTop: '0.35rem' }}>
              {tr(
                "Biriktirilgan sinf o'quvchilarini boshqarish va sinf coinlarini kuzatish uchun tyuter hisobingizga kiring.",
                'Войдите в аккаунт тьютора для управления учениками классов и отслеживания койнов.'
              )}
            </p>
          </div>

          {user && user.role !== 'tutor' && user.role !== 'admin' && (
            <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/35 text-amber-200 text-xs flex items-center gap-2 mb-4">
              <AlertCircle size={16} className="flex-shrink-0" />
              <span>
                {tr(
                  `Hozir siz "${user.username}" (${user.role}) sifatida kirgansiz. Tyuter hisobiga o'tish uchun quyida login va parolingizni kiriting.`,
                  `Вы сейчас вошли как «${user.username}» (${user.role}). Введите логин и пароль тьютора ниже.`
                )}
              </span>
            </div>
          )}

          {gateError && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 mb-4">
              <AlertCircle size={16} className="flex-shrink-0" /> <span>{gateError}</span>
            </div>
          )}

          <form onSubmit={handleGateLogin} className="space-y-4">
            <div>
              <label className="input-label">{tr('Tyuter logini', 'Логин тьютора')}</label>
              <div className="input-with-icon">
                <User size={16} className="input-icon" />
                <input
                  type="text"
                  className="clean-input"
                  value={gateUsername}
                  onChange={(e) => setGateUsername(e.target.value)}
                  placeholder={tr('Loginni kiriting', 'Введите логин')}
                  required
                />
              </div>
            </div>

            <div>
              <label className="input-label">{tr('Parol', 'Пароль')}</label>
              <div className="input-with-icon">
                <Lock size={16} className="input-icon" />
                <input
                  type={showGatePassword ? 'text' : 'password'}
                  className="clean-input"
                  value={gatePassword}
                  onChange={(e) => setGatePassword(e.target.value)}
                  placeholder={tr('Parolni kiriting', 'Введите пароль')}
                  required
                />
                <button
                  type="button"
                  className="input-eye-btn"
                  onClick={() => setShowGatePassword((v) => !v)}
                  aria-label={tr("Parolni ko'rsatish", 'Показать пароль')}
                >
                  {showGatePassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={gateLoading}
              className="btn w-full py-3.5 font-bold flex items-center justify-center gap-2 shadow-lg text-white"
              style={{
                marginTop: '1.25rem',
                background: 'linear-gradient(135deg, #9333ea, #6366f1)',
                borderColor: 'rgba(168, 85, 247, 0.5)',
              }}
            >
              {gateLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> {tr('Tekshirilmoqda...', 'Проверка...')}
                </>
              ) : (
                <>
                  <UserCheck size={18} /> {tr('Tyuter Portaliga Kirish', 'Войти в портал тьютора')}
                </>
              )}
            </button>

            <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/25 text-slate-300 text-[11px] flex items-start gap-2 mt-3">
              <ShieldCheck size={15} className="text-purple-400 flex-shrink-0 mt-0.5" />
              <span>
                {tr(
                  'Tyuter uchun login va parol faqat maktab Administratori tomonidan beriladi hamda nazorat qilinadi.',
                  'Логин и пароль для тьютора выдаются и контролируются исключительно администратором школы.'
                )}
              </span>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-portal-wrapper space-y-6 pb-12">
      {/* Header */}
      <div className="dashboard-header flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2.5">
            <UserCheck className="text-purple-400" size={28} />
            {tr('Tyuter Boshqaruv Portali', 'Портал управления тьютора')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            {tr(
              "Biriktirilgan sinf o'quvchilarini qo'shish, tahrirlash, o'chirish va admin sinf coinlarini kuzatish markazi",
              'Центр добавления, редактирования и удаления учеников классов, а также отслеживания классных койнов'
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {user?.role === 'admin' && adminTutorsList.length > 0 && (
            <select
              aria-label={tr('Tyuter tanlash', 'Выбор тьютора')}
              className="clean-select text-xs font-bold w-auto min-w-[200px]"
              value={selectedTutorFilterId}
              onChange={(e) => setSelectedTutorFilterId(e.target.value)}
            >
              <option value="">{tr('Barcha tyuterlar va sinflar', 'Все тьюторы и классы')}</option>
              {adminTutorsList.map((tut) => (
                <option key={tut.id} value={String(tut.id)}>
                  🎓 {tut.fullName} ({tut.coins || 0} 💎)
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            className="btn btn-secondary btn-sm flex items-center gap-1.5"
            onClick={loadTutorData}
          >
            {loadingData ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            <span>{tr('Yangilash', 'Обновить')}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="admin-kpi-grid">
        <div className="admin-kpi-card">
          <div className="admin-kpi-icon kpi-blue">
            <School size={24} />
          </div>
          <div>
            <div className="admin-kpi-val">{summary.assignedClassesCount ?? assignedClasses.length}</div>
            <div className="admin-kpi-label">{tr('Biriktirilgan Sinflar', 'Назначенные классы')}</div>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-icon kpi-green">
            <GraduationCap size={24} />
          </div>
          <div>
            <div className="admin-kpi-val">{summary.studentsCount ?? students.length}</div>
            <div className="admin-kpi-label">{tr("Sinflardagi O'quvchilar", 'Ученики классов')}</div>
          </div>
        </div>

        <div
          className="admin-kpi-card cursor-pointer hover:border-amber-400/60 transition-all"
          onClick={() => setActiveTab('coins')}
          title={tr("Sinflarga berilgan coinlar va hamyonni ko'rish", 'Открыть койны классов и кошелёк')}
        >
          <div className="admin-kpi-icon kpi-amber">
            <Coins size={24} />
          </div>
          <div>
            <div className="admin-kpi-val text-amber-400">{summary.classBonusTotal ?? 0} 💎</div>
            <div className="admin-kpi-label">{tr('Sinflarga Berilgan Coinlar', 'Койны классам')}</div>
            <div className="text-[10px] text-purple-300 font-bold mt-0.5">
              {tr('Tyuter hamyoni:', 'Кошелёк тьютора:')} {summary.tutorCoins ?? 0} 💎 • {coinHistory.length}{' '}
              {tr('ta yozuv', 'зап.')}
            </div>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-icon kpi-blue">
            <TrendingUp size={24} />
          </div>
          <div>
            <div className="admin-kpi-val">{summary.avgScore ?? 0}%</div>
            <div className="admin-kpi-label">{tr("O'rtacha Test Natijasi", 'Средний результат')}</div>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="portal-app-layout">
        {/* Sidebar */}
        <aside className="portal-sidebar">
          <div
            className="portal-sidebar-userbox cursor-pointer hover:border-purple-400/50 transition-all"
            onClick={() => setActiveTab('profile')}
            title={tr('Profil va parolni sozlash', 'Настройки профиля и пароля')}
          >
            <img
              src={
                (tutorInfo?.avatarUrl || user?.avatarUrl) ||
                `https://api.dicebear.com/7.x/initials/svg?seed=${user?.username}&backgroundColor=7c3aed`
              }
              alt="Avatar"
              className="portal-sidebar-avatar"
              style={{ borderColor: '#a855f7' }}
            />
            <div className="portal-sidebar-info flex-1 min-w-0">
              <div className="portal-sidebar-name truncate">
                {localizeUserFullName(tutorInfo?.fullName || user?.fullName, language) || user?.username}
              </div>
              <div className="portal-sidebar-role truncate" style={{ color: '#c084fc' }}>
                <UserCheck size={12} style={{ display: 'inline', marginRight: '4px' }} />
                {user?.role === 'admin' && !selectedTutorFilterId
                  ? tr('Administrator (Nazorat)', 'Администратор (Обзор)')
                  : tr('Tyuter', 'Тьютор')}
              </div>
              <div className="text-[11px] font-black text-amber-300 mt-1 flex items-center gap-1">
                <span>💎</span>
                <span>{summary.tutorCoins ?? 0} {tr('Coins', 'Койн.')}</span>
              </div>
            </div>
            <Edit size={14} className="text-slate-400 flex-shrink-0" />
          </div>

          <div className="portal-sidebar-nav-title">{tr('TYUTER MENYUSI', 'МЕНЮ ТЬЮТОРА')}</div>
          <nav className="portal-sidebar-nav">
            <button
              type="button"
              className={`portal-nav-btn ${activeTab === 'students' ? 'active' : ''}`}
              onClick={() => setActiveTab('students')}
            >
              <div className="portal-nav-icon">
                <Users size={18} />
              </div>
              <span className="portal-nav-label">{tr("O'quvchilar Boshqaruvi", 'Управление учениками')}</span>
              <span className="portal-nav-badge">{students.length}</span>
            </button>

            <button
              type="button"
              className={`portal-nav-btn nav-coin ${activeTab === 'coins' ? 'active' : ''}`}
              onClick={() => setActiveTab('coins')}
            >
              <div className="portal-nav-icon">
                <Wallet size={18} />
              </div>
              <span className="portal-nav-label">{tr('Sinf Coinlari & Hamyon', 'Койны и кошелёк')}</span>
              <span className="portal-nav-badge">{summary.tutorCoins ?? 0} 💎</span>
            </button>

            <button
              type="button"
              className={`portal-nav-btn ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              <div className="portal-nav-icon">
                <User size={18} />
              </div>
              <span className="portal-nav-label">{tr('Mening Profilim', 'Мой профиль')}</span>
            </button>
          </nav>

          {/* Assigned classes quick card in sidebar */}
          {assignedClasses.length > 0 && (
            <div className="mt-4 p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                {tr('Biriktirilgan Sinflar:', 'Назначенные классы:')}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {assignedClasses.map((cls) => (
                  <button
                    key={cls.id}
                    type="button"
                    onClick={() => {
                      setActiveTab('students');
                      setGradeFilter((prev) => (prev === cls.name ? 'all' : cls.name));
                    }}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                      gradeFilter === cls.name
                        ? 'bg-purple-500/25 border-purple-400 text-purple-200'
                        : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-purple-500/40'
                    }`}
                  >
                    {localizeGrade(cls.name, language)} ({cls.studentsCount})
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Main Content */}
        <main className="portal-main-area">
          {/* TAB 1: STUDENTS CRUD */}
          {activeTab === 'students' && (
            <div className="space-y-4 animate-fade-in">
              {user?.role !== 'admin' && assignedClasses.length === 0 && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/35 text-amber-200 text-xs flex items-start gap-3">
                  <AlertCircle size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-bold text-sm text-amber-300">
                      {tr('Hali sinf biriktirilmagan', 'Классы ещё не назначены')}
                    </div>
                    <p className="text-slate-300">
                      {tr(
                        "Administrator sizga birorta sinf biriktirgandan so'ng o'sha sinf o'quvchilarini qo'shishingiz, tahrirlashingiz va o'chirishingiz mumkin bo'ladi.",
                        'После того как администратор назначит вам класс, вы сможете добавлять, редактировать и удалять учеников этого класса.'
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* Live Class Coins Strip (Visible immediately on Tutor main tab) */}
              {(assignedClasses.length > 0 || coinHistory.length > 0) && (
                <div
                  data-testid="tutor-class-coins-strip"
                  className="p-4 rounded-2xl bg-slate-900/75 border border-amber-500/30 space-y-3 shadow-lg"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs sm:text-sm font-black text-white">
                      <Coins size={17} className="text-amber-400" />
                      <span>{tr('Sinflarga Berilgan Coinlar (Admin Hisobidan)', 'Койны, начисленные классам администратором')}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-slate-300">
                        {tr('Sinflar fondi:', 'Фонд классов:')}{' '}
                        <strong className="text-amber-300 font-mono">{summary.classBonusTotal ?? 0} 💎</strong>
                      </span>
                      <span className="text-slate-300">
                        {tr('Hamyon:', 'Кошелёк:')}{' '}
                        <strong className="text-purple-300 font-mono">{summary.tutorCoins ?? 0} 💎</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveTab('coins')}
                        className="text-[11px] font-bold text-cyan-300 hover:text-cyan-200 underline underline-offset-2"
                      >
                        {tr('Barcha tarix →', 'Вся история →')}
                      </button>
                    </div>
                  </div>

                  {assignedClasses.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {assignedClasses.map((cls) => (
                        <div
                          key={cls.id}
                          className="p-3 rounded-xl bg-slate-950/75 border border-slate-800 hover:border-amber-500/40 transition-all flex flex-col justify-between gap-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-black text-xs text-white px-2 py-0.5 rounded-md bg-purple-500/20 border border-purple-500/40">
                              {localizeGrade(cls.name, language)}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-black font-mono">
                              💎 {cls.bonusCoins ?? 0}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <span>
                              {tr("O'quvchilar coini:", 'Койны учеников:')}{' '}
                              <strong className="text-cyan-300">{cls.studentCoins ?? 0} 💎</strong>
                            </span>
                            <span>
                              {tr('Jami:', 'Итого:')}{' '}
                              <strong className="text-white">{cls.totalCoins ?? 0} 💎</strong>
                            </span>
                          </div>
                          {cls.lastAward ? (
                            <div className="text-[10px] text-emerald-300/90 bg-emerald-500/10 border border-emerald-500/25 rounded-lg px-2 py-1 truncate">
                              +{cls.lastAward.amount} 💎 • {cls.lastAward.reason} ({cls.lastAward.date})
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-500 italic">
                              {tr("Hali sinfga alohida coin yozilmagan", "Классу ещё не начислялись койны")}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {coinHistory.length > 0 && (
                    <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="text-slate-400 font-bold">{tr("So'nggi o'tkazmalar:", 'Последние начисления:')}</span>
                      {coinHistory.slice(0, 3).map((tx) => (
                        <span
                          key={tx.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200"
                        >
                          <strong className="text-purple-300">{localizeGrade(tx.className, language)}</strong>
                          <span className="text-amber-300 font-black">+{tx.amount} 💎</span>
                          <span className="text-slate-400 truncate max-w-[160px]">({tx.reason})</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Search & Action Strip */}
              <div className="admin-search-strip flex-col sm:flex-row">
                <div className="flex flex-wrap items-center gap-2.5 flex-1 w-full">
                  <div className="input-with-icon flex-1 min-w-[200px] max-w-sm">
                    <Search size={16} className="input-icon" />
                    <input
                      type="text"
                      className="clean-input text-xs"
                      placeholder={tr("O'quvchi ismi, logini yoki telefoni...", 'Имя, логин или телефон ученика...')}
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                    />
                  </div>

                  <select
                    aria-label={tr('Sinf filtri', 'Фильтр класса')}
                    className="clean-select text-xs w-auto min-w-[160px]"
                    value={gradeFilter}
                    onChange={(e) => setGradeFilter(e.target.value)}
                  >
                    <option value="all">{tr('Barcha biriktirilgan sinflar', 'Все назначенные классы')} ({students.length})</option>
                    {assignedClasses.map((cls) => (
                      <option key={cls.id} value={cls.name}>
                        {localizeGrade(cls.name, language)} ({cls.studentsCount} {tr('nafar', 'уч.')})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  data-testid="tutor-add-student-btn"
                  onClick={handleOpenAddStudent}
                  className="btn btn-diamond-cyan btn-sm flex items-center gap-1.5 font-bold shadow-md flex-shrink-0"
                >
                  <Plus size={16} /> {tr("Yangi O'quvchi Qo'shish", 'Добавить ученика')}
                </button>
              </div>

              {/* Class Quick Filter Pills */}
              {assignedClasses.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 px-1">
                  <button
                    type="button"
                    onClick={() => setGradeFilter('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      gradeFilter === 'all'
                        ? 'bg-purple-500 text-white border-purple-400 shadow-md'
                        : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:border-purple-500/40'
                    }`}
                  >
                    {tr('Barchasi', 'Все')} ({students.length})
                  </button>
                  {assignedClasses.map((cls) => (
                    <button
                      key={cls.id}
                      type="button"
                      onClick={() => setGradeFilter(cls.name)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                        gradeFilter === cls.name
                          ? 'bg-purple-500 text-white border-purple-400 shadow-md'
                          : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:border-purple-500/40'
                      }`}
                    >
                      <span>{localizeGrade(cls.name, language)}</span>
                      <span className="text-[10px] opacity-80">• {cls.studentsCount}</span>
                      {cls.bonusCoins > 0 && (
                        <span className="text-[10px] text-amber-300">💎{cls.bonusCoins}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Copyable Issued Student Credentials Banner */}
              {issuedStudentCreds && (
                <div
                  data-testid="tutor-issued-student-credentials-card"
                  className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/40 space-y-3 shadow-lg"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-purple-300 font-extrabold text-sm">
                      <KeyRound size={17} />
                      <span>
                        {issuedStudentCreds.mode === 'created'
                          ? tr("O'quvchi qo'shildi — kirish maʼlumotlarini o'quvchiga topshiring", 'Ученик создан — передайте данные для входа')
                          : tr("O'quvchi kirish maʼlumotlari yangilandi", 'Данные входа ученика обновлены')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyStudentCredentials(issuedStudentCreds)}
                        className="btn btn-xs bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/50 text-purple-200 font-bold flex items-center gap-1.5"
                      >
                        {copiedStudentCreds ? <Check size={13} /> : <Copy size={13} />}
                        <span>{copiedStudentCreds ? tr('Nusxalandi', 'Скопировано') : tr('Nusxa olish', 'Копировать')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIssuedStudentCreds(null)}
                        className="text-xs text-slate-400 hover:text-white px-2 py-1"
                        title={tr('Yopish', 'Закрыть')}
                      >
                        &times;
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase font-bold">{tr("O'quvchi", 'Ученик')}</div>
                      <div className="font-bold text-white truncate">{issuedStudentCreds.fullName}</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase font-bold">{tr('Sinf', 'Класс')}</div>
                      <div className="font-bold text-purple-300">{issuedStudentCreds.grade || '-'}</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase font-bold">{tr('Login', 'Логин')}</div>
                      <div className="font-mono font-bold text-cyan-300">{issuedStudentCreds.username}</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase font-bold">{tr('Parol', 'Пароль')}</div>
                      <div className="font-mono font-bold text-amber-300">
                        {issuedStudentCreds.password || tr('(O‘zgarmadi)', '(Без изменений)')}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase font-bold">{tr('Portal', 'Портал')}</div>
                      <div className="font-mono font-bold text-emerald-300">/student/</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Students Table */}
              <div className="table-responsive bg-slate-900/70 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                <table className="diamond-table w-full text-left">
                  <thead>
                    <tr>
                      <th>{tr("O'quvchi", 'Ученик')}</th>
                      <th>{tr('Sinfi', 'Класс')}</th>
                      <th>{tr('Login', 'Логин')}</th>
                      <th>{tr('Telefon', 'Телефон')}</th>
                      <th>{tr('Diamond Coins', 'Diamond-койны')}</th>
                      <th>{tr("O'zlashtirish", 'Успеваемость')}</th>
                      <th className="text-right">{tr('Amallar', 'Действия')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((std) => (
                      <tr key={std.id}>
                        <td>
                          <div className="flex items-center gap-2.5">
                            <img
                              src={
                                std.avatarUrl ||
                                `https://api.dicebear.com/7.x/initials/svg?seed=${std.username}&backgroundColor=0284c7`
                              }
                              alt=""
                              className="w-9 h-9 rounded-lg object-cover border border-purple-500/40 flex-shrink-0"
                            />
                            <div>
                              <div className="font-bold text-white text-xs">{std.fullName}</div>
                              <div className="text-[10px] text-slate-400">
                                {tr("Qo'shilgan:", 'Добавлен:')} {std.dateJoined || '-'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-info text-[11px] font-semibold">
                            {localizeGrade(std.grade, language)}
                          </span>
                        </td>
                        <td className="font-mono text-xs text-slate-300">{std.username}</td>
                        <td className="text-xs text-slate-400">{std.phone || '-'}</td>
                        <td>
                          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold">
                            <Coins size={12} />
                            <span>{std.coins || 0}</span>
                          </div>
                        </td>
                        <td>
                          <div className="text-xs">
                            <span className="font-bold text-emerald-400">{std.avgScore || 0}%</span>
                            <span className="text-slate-400 text-[11px] ml-1.5">
                              ({std.testsPassed || 0} {tr('ta test', 'тест.')})
                            </span>
                          </div>
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              className="btn-icon text-amber-400 hover:bg-amber-500/20 p-1.5 rounded-lg transition-colors"
                              onClick={() => {
                                setResetPwStudent(std);
                                setQuickStudentPw('1234');
                              }}
                              title={tr("Parolni o'zgartirish", 'Изменить пароль')}
                            >
                              <KeyRound size={15} />
                            </button>
                            <button
                              type="button"
                              className="btn-icon text-cyan-400 hover:bg-cyan-500/20 p-1.5 rounded-lg transition-colors"
                              onClick={() => handleOpenEditStudent(std)}
                              title={tr("O'quvchini tahrirlash", 'Редактировать ученика')}
                            >
                              <Edit size={15} />
                            </button>
                            <button
                              type="button"
                              className="btn-icon text-rose-400 hover:bg-rose-500/20 p-1.5 rounded-lg transition-colors"
                              onClick={() => handleDeleteStudent(std)}
                              title={tr("O'quvchini o'chirish", 'Удалить ученика')}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {filteredStudents.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-10 text-slate-400 text-xs">
                          {tr(
                            "O'quvchilar topilmadi. Yuqoridagi tugma orqali yangi o'quvchi qo'shing.",
                            'Ученики не найдены. Нажмите кнопку выше, чтобы добавить ученика.'
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: TUTOR COINS & CLASS REWARD HISTORY */}
          {activeTab === 'coins' && (
            <div className="space-y-6 animate-fade-in">
              {/* Wallet Banner */}
              <div
                className="p-5 rounded-2xl border shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(168, 85, 247, 0.16), rgba(245, 158, 11, 0.12))',
                  borderColor: 'rgba(168, 85, 247, 0.35)',
                }}
              >
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-200 text-[11px] font-extrabold">
                    <Wallet size={12} /> {tr('Tyuter Coin Hamyoni', 'Кошелёк тьютора')}
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-white">
                    {tr('Admin sinflarga bergan coinlar hisobi', 'Учёт койнов, начисленных классам администратором')}
                  </h3>
                  <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                    {tr(
                      "Administrator sizga biriktirilgan sinflarga coin berganda, sinf fondi bilan birga sizning shaxsiy tyuter hamyoningizga ham shu miqdordagi coin avtomatik yoziladi.",
                      'Когда администратор начисляет койны закреплённым за вами классам, эта сумма автоматически зачисляется на ваш баланс тьютора.'
                    )}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 flex-shrink-0">
                  <div className="flex items-center gap-3 bg-slate-950/75 border border-cyan-500/35 px-4 py-3 rounded-2xl">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
                      <School size={21} />
                    </div>
                    <div>
                      <div className="text-xl sm:text-2xl font-black text-cyan-300 font-cinzel">
                        {summary.classBonusTotal ?? 0} 💎
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        {tr('Sinflarga Berilgan Fond', 'Фонд классов')}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 bg-slate-950/75 border border-amber-500/35 px-4 py-3 rounded-2xl">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
                      <Coins size={21} />
                    </div>
                    <div>
                      <div className="text-xl sm:text-2xl font-black text-amber-400 font-cinzel">
                        {summary.tutorCoins ?? 0} 💎
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        {tr('Jami Tyuter Balansi', 'Баланс тьютора')}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Assigned Classes Cards */}
              {assignedClasses.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                    <School size={17} className="text-purple-400" />
                    {tr('Biriktirilgan Sinflar Jamg\'armasi', 'Фонд закреплённых классов')}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {assignedClasses.map((cls) => (
                      <div key={cls.id} className="class-card-luxury">
                        <div>
                          <div className="class-card-top">
                            <span className="class-name-badge">{localizeGrade(cls.name, language)}</span>
                            <span className={`class-lang-chip ${cls.language === 'ru' ? 'ru' : 'uz'}`}>
                              {cls.language === 'ru' ? 'RU' : 'UZ'}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 mt-3 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                            <div className="class-stat-item">
                              <span className="class-stat-val text-cyan-400 text-sm font-extrabold">
                                {cls.studentsCount} {tr('nafar', 'уч.')}
                              </span>
                              <span className="class-stat-lbl text-[10px]">{tr("O'quvchilar", 'Ученики')}</span>
                            </div>
                            <div className="class-stat-item">
                              <span className="class-stat-val text-amber-400 text-sm font-extrabold font-mono">
                                {cls.bonusCoins} 💎
                              </span>
                              <span className="class-stat-lbl text-[10px]">{tr('Sinf fondi', 'Фонд класса')}</span>
                            </div>
                            <div className="class-stat-item">
                              <span className="class-stat-val text-emerald-400 text-sm font-extrabold">
                                {cls.avgScore}%
                              </span>
                              <span className="class-stat-lbl text-[10px]">{tr("O'rtacha", 'Средний')}</span>
                            </div>
                          </div>
                        </div>
                        <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                          <span>
                            {tr('Xona:', 'Кабинет:')} <strong className="text-white">{cls.room || '-'}</strong>
                          </span>
                          <button
                            type="button"
                            className="text-purple-300 hover:text-purple-200 font-bold"
                            onClick={() => {
                              setGradeFilter(cls.name);
                              setActiveTab('students');
                            }}
                          >
                            {tr("O'quvchilarni boshqarish →", 'Управлять учениками →')}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* History Table */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Clock size={17} className="text-amber-400" />
                    {tr('Sinflarga Berilgan Coinlar Tarixi', 'История начислений койнов классам')} ({filteredCoinHistory.length})
                  </h4>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className="clean-select text-xs w-auto"
                      value={coinHistoryClassFilter}
                      onChange={(e) => setCoinHistoryClassFilter(e.target.value)}
                    >
                      <option value="all">{tr('Barcha sinflar', 'Все классы')}</option>
                      {assignedClasses.map((cls) => (
                        <option key={cls.id} value={cls.name}>
                          {localizeGrade(cls.name, language)}
                        </option>
                      ))}
                    </select>
                    <div className="input-with-icon min-w-[210px]">
                      <Search size={14} className="input-icon" />
                      <input
                        type="text"
                        className="clean-input text-xs"
                        placeholder={tr('Sabab yoki sinf qidiruvi...', 'Поиск по причине или классу...')}
                        value={coinHistorySearch}
                        onChange={(e) => setCoinHistorySearch(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="table-responsive bg-slate-900/70 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                  <table className="diamond-table w-full text-left">
                    <thead>
                      <tr>
                        <th>{tr('Sinf', 'Класс')}</th>
                        <th>{tr('Coin Miqdori', 'Количество койнов')}</th>
                        <th>{tr('Sabab / Izoh', 'Причина / Комментарий')}</th>
                        <th>{tr('Kim berdi', 'Кем начислено')}</th>
                        <th>{tr('Tyuter', 'Тьютор')}</th>
                        <th>{tr('Sana va Vaqt', 'Дата и время')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCoinHistory.map((tx) => (
                        <tr key={tx.id}>
                          <td>
                            <span className="badge badge-info text-[11px] font-bold">
                              {localizeGrade(tx.className, language)}
                            </span>
                          </td>
                          <td>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/35 text-amber-300 text-xs font-black">
                              💎 +{tx.amount} {tr('Coin', 'Койн')}
                            </span>
                          </td>
                          <td className="text-xs text-slate-200">{tx.reason}</td>
                          <td className="text-xs text-cyan-300 font-semibold">{tx.givenBy}</td>
                          <td className="text-xs text-purple-300 font-semibold">{tx.tutorName || '-'}</td>
                          <td className="text-xs text-slate-400 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1">
                              <Calendar size={12} className="text-slate-500" />
                              {tx.date}
                            </span>
                          </td>
                        </tr>
                      ))}

                      {filteredCoinHistory.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center py-10 text-slate-400 text-xs">
                            {tr(
                              'Hozircha sinflaringizga coin yozilmagan.',
                              'Вашим классам ещё не начислялись койны.'
                            )}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PROFILE & PASSWORD */}
          {activeTab === 'profile' && (
            <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <form
                  onSubmit={handleSaveProfileInfo}
                  className="lg:col-span-7 test-builder-card space-y-5"
                >
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
                    <Camera size={18} className="text-purple-400" />
                    <h4 className="text-sm font-black text-white uppercase tracking-wider">
                      {tr("Profil Surati va Shaxsiy Ma'lumotlar", 'Фото профиля и личные данные')}
                    </h4>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-2xl bg-slate-950/60 border border-slate-800/90">
                    <div
                      onClick={() => profileFileInputRef.current?.click()}
                      className="relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-purple-400/70 shadow-lg cursor-pointer group flex-shrink-0"
                    >
                      {profileAvatarPreview ? (
                        <img
                          src={profileAvatarPreview}
                          alt={profileForm.fullName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-slate-800 flex items-center justify-center text-purple-300 text-3xl font-black">
                          {(profileForm.fullName || user?.username || 'T')[0]}
                        </div>
                      )}
                      <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <Camera size={22} />
                      </div>
                    </div>

                    <div className="flex-1 text-center sm:text-left space-y-2">
                      <div className="text-sm font-bold text-white">
                        {profileForm.fullName || user?.fullName}
                      </div>
                      <input
                        ref={profileFileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleProfileAvatarSelect}
                      />
                      <div className="flex items-center justify-center sm:justify-start gap-2 pt-1 flex-wrap">
                        <button
                          type="button"
                          onClick={() => profileFileInputRef.current?.click()}
                          className="btn btn-diamond-cyan btn-xs font-bold flex items-center gap-1.5"
                        >
                          <Camera size={14} />
                          <span>{tr('Rasm Yuklash / Almashtirish', 'Загрузить / Сменить фото')}</span>
                        </button>
                        {(user?.hasCustomAvatar || profileAvatarFile) && !profileClearAvatar && (
                          <button
                            type="button"
                            onClick={handleProfileAvatarClear}
                            className="btn btn-secondary btn-xs font-bold text-rose-300 border-rose-500/35 hover:bg-rose-500/15 flex items-center gap-1"
                          >
                            <Trash2 size={13} />
                            <span>{tr("Rasmni o'chirish", 'Удалить фото')}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="input-label">{tr("To'liq ism-familiya (F.I.Sh) *", 'ФИО полностью *')}</label>
                      <input
                        type="text"
                        className="clean-input text-xs"
                        value={profileForm.fullName}
                        onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className="input-label flex items-center justify-between gap-2">
                        <span>{tr('Login (username) *', 'Логин (username) *')}</span>
                        {isTutorSelfRestricted && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/20 border border-purple-500/40 text-purple-200 text-[10px] font-bold">
                            <Lock size={10} /> {tr('Admin belgilaydi', 'Назначает админ')}
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        className={`clean-input text-xs font-mono ${isTutorSelfRestricted ? 'opacity-65 cursor-not-allowed bg-slate-900/70' : ''}`}
                        value={profileForm.username}
                        onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })}
                        disabled={isTutorSelfRestricted}
                        readOnly={isTutorSelfRestricted}
                        required={!isTutorSelfRestricted}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="input-label flex items-center gap-1.5">
                        <Phone size={12} className="text-purple-400" />
                        <span>{tr('Telefon raqami', 'Номер телефона')}</span>
                      </label>
                      <input
                        type="text"
                        className="clean-input text-xs"
                        value={profileForm.phone}
                        onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                        placeholder="+998 90 123 45 67"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="input-label">{tr("Qisqacha ma'lumot / bio", 'Краткая информация / био')}</label>
                    <textarea
                      rows={3}
                      className="clean-input text-xs"
                      value={profileForm.bio}
                      onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                    />
                  </div>

                  <div className="flex justify-end pt-2 border-t border-slate-800">
                    <button
                      type="submit"
                      disabled={savingProfileInfo}
                      className="btn btn-diamond-cyan btn-sm font-bold flex items-center gap-2 px-5"
                    >
                      {savingProfileInfo ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                      <span>{tr("Ma'lumotlarni Saqlash", 'Сохранить данные')}</span>
                    </button>
                  </div>
                </form>

                {/* Password / Admin Security Card */}
                {isTutorSelfRestricted ? (
                  <div className="lg:col-span-5 test-builder-card space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={18} className="text-purple-400" />
                        <h4 className="text-sm font-black text-white uppercase tracking-wider">
                          {tr('Kirish va Xavfsizlik Nazorati', 'Доступ и контроль безопасности')}
                        </h4>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-[10px] font-extrabold">
                        {tr('Faol', 'Активен')}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">{tr('Berilgan login:', 'Выданный логин:')}</span>
                        <span className="font-mono font-bold text-purple-200">@{user?.username}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">{tr('Nazoratchi:', 'Контролирует:')}</span>
                        <span className="font-bold text-cyan-300">{tr('Maktab Administratori', 'Администратор школы')}</span>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-xs text-slate-200 space-y-1.5 leading-relaxed">
                      <div className="font-bold text-purple-200 flex items-center gap-1.5">
                        <Lock size={14} className="text-purple-400" />
                        <span>{tr("Login va parolni mustaqil o'zgartirish yopiq", 'Самостоятельная смена логина и пароля отключена')}</span>
                      </div>
                      <p className="text-[11px] text-slate-300 m-0">
                        {tr(
                          "Xavfsizlik siyosatiga ko'ra, tyuter hisobining logini va paroli faqat Administrator tomonidan beriladi, yangilanadi va nazorat qilinadi. Parolni almashtirish zarur bo'lsa administratorga murojaat qiling.",
                          'Согласно политике безопасности, логин и пароль тьютора выдаются, обновляются и контролируются исключительно администратором. При необходимости смены пароля обратитесь к администратору.'
                        )}
                      </p>
                    </div>
                  </div>
                ) : (
                  <form
                    onSubmit={handleUpdateProfilePassword}
                    className="lg:col-span-5 test-builder-card space-y-4"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <Lock size={18} className="text-amber-400" />
                        <h4 className="text-sm font-black text-white uppercase tracking-wider">
                          {tr("Parolni O'zgartirish", 'Смена пароля')}
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowProfilePasswords((v) => !v)}
                        className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                      >
                        {showProfilePasswords ? <EyeOff size={14} /> : <Eye size={14} />}
                        <span>{showProfilePasswords ? tr('Yashirish', 'Скрыть') : tr("Ko'rsatish", 'Показать')}</span>
                      </button>
                    </div>

                    {user?.role !== 'admin' && (
                      <div>
                        <label className="input-label">{tr('Hozirgi (eski) parol *', 'Текущий пароль *')}</label>
                        <input
                          type={showProfilePasswords ? 'text' : 'password'}
                          className="clean-input text-xs"
                          value={passwordForm.oldPassword}
                          onChange={(e) => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
                          required
                        />
                      </div>
                    )}

                    <div>
                      <label className="input-label">{tr('Yangi parol *', 'Новый пароль *')}</label>
                      <input
                        type={showProfilePasswords ? 'text' : 'password'}
                        className="clean-input text-xs"
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                        required
                      />
                    </div>

                    <div>
                      <label className="input-label">{tr('Yangi parolni tasdiqlang *', 'Подтвердите новый пароль *')}</label>
                      <input
                        type={showProfilePasswords ? 'text' : 'password'}
                        className="clean-input text-xs"
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                        required
                      />
                    </div>

                    <div className="pt-2 border-t border-slate-800">
                      <button
                        type="submit"
                        disabled={savingPassword}
                        className="btn btn-warning btn-sm w-full font-bold text-slate-950 flex items-center justify-center gap-2"
                      >
                        {savingPassword ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />}
                        <span>{tr('Parolni Yangilash', 'Обновить пароль')}</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MODAL: ADD STUDENT */}
      {isAddStudentOpen && (
        <div className="modal-backdrop" onClick={() => setIsAddStudentOpen(false)}>
          <div
            className="modal-content animate-scale-in max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 className="modal-title flex items-center gap-2">
                <GraduationCap className="text-purple-400" size={20} />{' '}
                {tr("Yangi O'quvchi Qo'shish", 'Добавить нового ученика')}
              </h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsAddStudentOpen(false)}
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateStudent} className="modal-body space-y-3.5 pt-3">
              {/* Optional Avatar */}
              <div className="flex items-center gap-4 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-800 border border-purple-400/50 flex items-center justify-center flex-shrink-0">
                  {studentAvatarPreview ? (
                    <img src={studentAvatarPreview} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Camera size={20} className="text-slate-400" />
                  )}
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-bold text-white">
                    {tr("O'quvchi surati (ixtiyoriy)", 'Фото ученика (необязательно)')}
                  </div>
                  <label className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/40 text-purple-200 text-[11px] font-bold cursor-pointer">
                    <Camera size={12} />
                    <span>{tr('Rasm yuklash', 'Загрузить фото')}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (!file) return;
                        if (file.size > 5 * 1024 * 1024) {
                          showToast(tr('Rasm hajmi 5MB dan oshmasligi kerak!', 'Максимум 5 МБ!'), 'warning');
                          return;
                        }
                        setStudentAvatarFile(file);
                        const reader = new FileReader();
                        reader.onload = (ev) => setStudentAvatarPreview(ev.target.result);
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="input-label">{tr("O'quvchi F.I.SH *", 'Ф.И.О. ученика *')}</label>
                <input
                  type="text"
                  className="clean-input"
                  placeholder={tr('Masalan: Jasur Rustamov', 'Например: Жасур Рустамов')}
                  value={studentForm.fullName}
                  onChange={(e) => setStudentForm({ ...studentForm, fullName: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">{tr('Login (username) *', 'Логин (username) *')}</label>
                  <input
                    type="text"
                    className="clean-input font-mono"
                    placeholder="jasur_9a"
                    value={studentForm.username}
                    onChange={(e) => setStudentForm({ ...studentForm, username: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="input-label">{tr('Parol *', 'Пароль *')}</label>
                  <input
                    type="text"
                    className="clean-input"
                    placeholder="123"
                    value={studentForm.password}
                    onChange={(e) => setStudentForm({ ...studentForm, password: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">{tr('Sinfi *', 'Класс *')}</label>
                  <select
                    className="clean-select"
                    value={studentForm.grade}
                    onChange={(e) => setStudentForm({ ...studentForm, grade: e.target.value })}
                    required
                  >
                    {editableClassOptions.map((g) => (
                      <option key={g} value={g}>
                        {localizeGrade(g, language)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="input-label">{tr('Telefon (ota-onasi)', 'Телефон (родителей)')}</label>
                  <input
                    type="text"
                    className="clean-input"
                    placeholder="+998 90 000 00 00"
                    value={studentForm.phone}
                    onChange={(e) => setStudentForm({ ...studentForm, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsAddStudentOpen(false)}
                >
                  {tr('Bekor qilish', 'Отмена')}
                </button>
                <button
                  type="submit"
                  disabled={savingAddStudent}
                  className="btn btn-diamond-cyan btn-sm font-bold flex items-center gap-1.5"
                >
                  {savingAddStudent && <Loader2 size={14} className="animate-spin" />}
                  <span>{tr("Qo'shish", 'Добавить')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT STUDENT */}
      {editingStudent && (
        <div className="modal-backdrop" onClick={() => setEditingStudent(null)}>
          <div
            className="modal-content animate-scale-in max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 className="modal-title flex items-center gap-2">
                <Edit className="text-cyan-400" size={20} />{' '}
                {tr("O'quvchini Tahrirlash", 'Редактировать ученика')}
              </h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setEditingStudent(null)}
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleSaveEditStudent} className="modal-body space-y-3.5 pt-3">
              {/* Photo */}
              <div className="flex items-center gap-4 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-800 border border-cyan-400/50 flex items-center justify-center flex-shrink-0">
                  {editStudentForm.avatarPreview ? (
                    <img src={editStudentForm.avatarPreview} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg font-black text-cyan-300">
                      {(editStudentForm.fullName || 'S')[0]}
                    </span>
                  )}
                </div>
                <div className="space-y-1.5 flex-1">
                  <div className="text-xs font-bold text-white truncate">
                    {editStudentForm.fullName || editingStudent.fullName}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 text-[11px] font-bold cursor-pointer">
                      <Camera size={12} />
                      <span>{tr("Rasm yuklash / o'zgartirish", 'Загрузить / сменить фото')}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          if (!file) return;
                          if (file.size > 5 * 1024 * 1024) {
                            showToast(tr('Rasm hajmi 5MB dan oshmasligi kerak!', 'Максимум 5 МБ!'), 'warning');
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = (ev) =>
                            setEditStudentForm((prev) => ({
                              ...prev,
                              avatarFile: file,
                              avatarPreview: ev.target.result,
                              clearAvatar: false,
                            }));
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                    {(editStudentForm.hasCustomAvatar || editStudentForm.avatarFile) &&
                      !editStudentForm.clearAvatar && (
                        <button
                          type="button"
                          onClick={() => {
                            const seed = (editStudentForm.fullName || editStudentForm.username || 'S')
                              .slice(0, 2)
                              .toUpperCase();
                            setEditStudentForm((prev) => ({
                              ...prev,
                              avatarFile: null,
                              clearAvatar: true,
                              avatarPreview: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                                seed
                              )}&backgroundColor=0284c7`,
                            }));
                          }}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/35 text-rose-300 text-[11px] font-bold"
                        >
                          {tr("O'chirish", 'Удалить')}
                        </button>
                      )}
                  </div>
                </div>
              </div>

              <div>
                <label className="input-label">{tr("O'quvchi F.I.SH *", 'Ф.И.О. ученика *')}</label>
                <input
                  type="text"
                  className="clean-input"
                  value={editStudentForm.fullName}
                  onChange={(e) =>
                    setEditStudentForm({ ...editStudentForm, fullName: e.target.value })
                  }
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">{tr('Login (username) *', 'Логин (username) *')}</label>
                  <input
                    type="text"
                    className="clean-input font-mono"
                    value={editStudentForm.username}
                    onChange={(e) =>
                      setEditStudentForm({ ...editStudentForm, username: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <label className="input-label flex items-center justify-between">
                    <span>{tr('Yangi parol', 'Новый пароль')}</span>
                    <button
                      type="button"
                      onClick={() => setShowEditStudentPw((v) => !v)}
                      className="text-[10px] text-cyan-400"
                    >
                      {showEditStudentPw ? tr('Yashirish', 'Скрыть') : tr("Ko'rsatish", 'Показать')}
                    </button>
                  </label>
                  <input
                    type={showEditStudentPw ? 'text' : 'password'}
                    className="clean-input"
                    placeholder={tr("O'zgartirmaslik uchun bo'sh", 'Оставьте пустым')}
                    value={editStudentForm.password}
                    onChange={(e) =>
                      setEditStudentForm({ ...editStudentForm, password: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">{tr('Sinfi *', 'Класс *')}</label>
                  <select
                    className="clean-select"
                    value={editStudentForm.grade}
                    onChange={(e) =>
                      setEditStudentForm({ ...editStudentForm, grade: e.target.value })
                    }
                    required
                  >
                    {(editableClassOptions.includes(editStudentForm.grade)
                      ? editableClassOptions
                      : [editStudentForm.grade, ...editableClassOptions].filter(Boolean)
                    ).map((g) => (
                      <option key={g} value={g}>
                        {localizeGrade(g, language)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="input-label">{tr('Telefon (ota-onasi)', 'Телефон (родителей)')}</label>
                  <input
                    type="text"
                    className="clean-input"
                    value={editStudentForm.phone}
                    onChange={(e) =>
                      setEditStudentForm({ ...editStudentForm, phone: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="modal-footer flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setEditingStudent(null)}
                >
                  {tr('Bekor qilish', 'Отмена')}
                </button>
                <button
                  type="submit"
                  disabled={savingEditStudent}
                  className="btn btn-diamond-cyan btn-sm font-bold flex items-center gap-1.5"
                >
                  {savingEditStudent ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Save size={14} />
                  )}
                  <span>{tr('Saqlash', 'Сохранить')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: QUICK RESET STUDENT PASSWORD */}
      {resetPwStudent && (
        <div className="modal-backdrop" onClick={() => setResetPwStudent(null)}>
          <div className="modal-content animate-scale-in" style={{ maxWidth: '420px', padding: '1.75rem' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-purple-400 font-extrabold text-base">
                <KeyRound size={18} />
                <span>{tr("O'quvchi Parolini Yangilash", 'Обновить пароль ученика')}</span>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setResetPwStudent(null)}
                style={{ borderRadius: '50%', width: '28px', height: '28px', padding: 0 }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveQuickStudentPw} className="space-y-4 pt-4">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
                <div className="font-bold text-white text-sm mb-1">{resetPwStudent.fullName}</div>
                <div className="flex items-center gap-3 font-mono text-[11px] text-slate-400">
                  <span>Login: <b className="text-cyan-300">{resetPwStudent.username}</b></span>
                  <span>Sinf: <b className="text-purple-300">{resetPwStudent.grade || '-'}</b></span>
                </div>
              </div>

              <div>
                <label className="input-label">{tr("Yangi maxfiy parol kiriting *", "Введите новый пароль *")}</label>
                <input
                  type="text"
                  className="clean-input font-mono"
                  value={quickStudentPw}
                  onChange={(e) => setQuickStudentPw(e.target.value)}
                  placeholder={tr("Kamida 3 ta belgi (masalan: 1234)", "Минимум 3 символа")}
                  required
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setResetPwStudent(null)}
                  disabled={savingQuickPw}
                >
                  {tr('Bekor qilish', 'Отмена')}
                </button>
                <button
                  type="submit"
                  className="btn btn-diamond-cyan btn-sm font-bold flex items-center gap-1.5"
                  disabled={savingQuickPw || !quickStudentPw.trim()}
                >
                  {savingQuickPw && <Loader2 size={14} className="animate-spin" />}
                  <span>{tr('Parolni Saqlash', 'Сохранить пароль')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      <ConfirmModal
        isOpen={confirmModalState.isOpen}
        title={confirmModalState.title}
        message={confirmModalState.message}
        danger={confirmModalState.danger}
        onConfirm={confirmModalState.onConfirm}
        onCancel={() => setConfirmModalState((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}

