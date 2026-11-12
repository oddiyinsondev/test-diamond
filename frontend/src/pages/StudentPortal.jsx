import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../api/endpoints';
import {
  localizeSubject,
  localizeGrade,
  localizeRole,
  getLockMessageLocalized,
  getPolicyMessageLocalized,
} from '../i18n/portalUtils';
import MathRenderer from '../components/MathRenderer';
import ConfirmModal from '../components/ConfirmModal';
import confetti from 'canvas-confetti';
import {
  GraduationCap,
  Coins,
  Trophy,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRight,
  ArrowLeft,
  Award,
  BarChart2,
  ListCheck,
  User,
  Lock,
  Loader2,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  Eye,
  EyeOff,
  BookOpen,
  HelpCircle,
  Unlock,
  RefreshCw,
  Calendar,
} from 'lucide-react';

export default function StudentPortal() {
  const { user, login, refreshUser, language, tr } = useAuth();
  const { showToast } = useToast();

  // Gate state
  const [gateUsername, setGateUsername] = useState('');
  const [gatePassword, setGatePassword] = useState('');
  const [gateLoading, setGateLoading] = useState(false);
  const [gateError, setGateError] = useState('');
  const [showGatePassword, setShowGatePassword] = useState(false);

  // Active Tab: 'tests' | 'runner' | 'result' | 'leaderboard' | 'analytics'
  const [activeTab, setActiveTab] = useState('tests');

  // Student portal data
  const [availableTests, setAvailableTests] = useState([]);
  const [myResults, setMyResults] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [studentTestsPolicy, setStudentTestsPolicy] = useState(null);
  const [loadingData, setLoadingData] = useState(false);

  // Class preview selector (faqat admin/teacher student portalni ko'rayotganda)
  const canPreviewClasses = user?.role === 'admin' || user?.role === 'teacher';
  const [previewClasses, setPreviewClasses] = useState([]);
  const [previewGrade, setPreviewGrade] = useState('');

  // Active Test Runner State
  const [currentTest, setCurrentTest] = useState(null);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [userAnswers, setUserAnswers] = useState({}); // { [qId]: optionId }
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(0);
  const timerRef = useRef(null);
  const testStartedAtRef = useRef(null);
  const userAnswersRef = useRef({});
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    userAnswersRef.current = userAnswers;
  }, [userAnswers]);

  // Completed Test Result View
  const [testResultData, setTestResultData] = useState(null);

  // Confirm Modal State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const isStudent = user && (user.role === 'student' || user.role === 'teacher' || user.role === 'admin');

  // Load class list for admin/teacher preview
  useEffect(() => {
    if (!canPreviewClasses) {
      setPreviewClasses([]);
      setPreviewGrade('');
      return;
    }
    let cancelled = false;
    api.auth
      .meta()
      .then((res) => {
        if (!cancelled && Array.isArray(res?.classes)) {
          setPreviewClasses(res.classes);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [canPreviewClasses]);

  // Load student dashboard data
  const loadStudentData = async () => {
    if (!isStudent) return;
    setLoadingData(true);
    try {
      const targetGradeFilter = canPreviewClasses ? previewGrade : '';
      const leaderboardGrade = canPreviewClasses ? previewGrade || 'all' : user?.grade || '';

      const [testsRes, resultsRes, leadRes, metaRes] = await Promise.allSettled([
        api.student.getTests(targetGradeFilter),
        api.student.getMyResults(),
        api.student.getLeaderboard(leaderboardGrade),
        api.auth.meta(),
      ]);

      if (testsRes.status === 'fulfilled') {
        const val = testsRes.value;
        setAvailableTests(Array.isArray(val) ? val : val?.tests || []);
      }
      if (resultsRes.status === 'fulfilled') {
        const val = resultsRes.value;
        setMyResults(Array.isArray(val) ? val : val?.results || []);
      }
      if (leadRes.status === 'fulfilled') {
        const val = leadRes.value;
        setLeaderboard(Array.isArray(val) ? val : val?.leaderboard || []);
      }
      if (metaRes.status === 'fulfilled' && metaRes.value?.studentTestsPolicy) {
        setStudentTestsPolicy(metaRes.value.studentTestsPolicy);
      }
    } catch (err) {
      console.error('Error loading student data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (isStudent) {
      loadStudentData();
    }
  }, [isStudent, user?.id, user?.role, user?.grade, previewGrade, language]);

  // Handle gate login
  const handleGateLogin = async (e) => {
    e.preventDefault();
    setGateError('');
    setGateLoading(true);
    try {
      const loggedUser = await login(gateUsername, gatePassword, 'student');
      showToast(
        tr(
          `Xush kelibsiz, ${loggedUser.fullName || loggedUser.username}!`,
          `Добро пожаловать, ${loggedUser.fullName || loggedUser.username}!`
        ),
        'success'
      );
    } catch (err) {
      setGateError(
        err.message || tr('Login yoki parol xato!', 'Неверный логин или пароль!')
      );
    } finally {
      setGateLoading(false);
    }
  };

  // Start a test
  const handleStartTest = async (testItem) => {
    if (testItem?.canStart === false) {
      const localizedLock = getLockMessageLocalized(testItem, language);
      if (localizedLock) {
        showToast(localizedLock, 'warning');
      } else if (testItem.lockReason === 'portal_disabled') {
        showToast(
          tr(
            "Hozirda administrator tomonidan o'quvchilar testlariga ruxsat yopilgan!",
            'В настоящее время доступ учеников к тестам закрыт администратором!'
          ),
          'warning'
        );
      } else if (testItem.lockReason === 'admin_not_allowed' || !testItem.isStudentAllowed) {
        showToast(
          tr(
            'Ushbu testga hali administrator tomonidan ruxsat berilmagan!',
            'Этот тест ещё не открыт администратором!'
          ),
          'warning'
        );
      } else if (testItem.isExpired) {
        showToast(
          tr('Ushbu testni topshirish muddati yakunlangan!', 'Срок сдачи этого теста уже истёк!'),
          'warning'
        );
      } else if (testItem.isUpcoming) {
        showToast(
          tr('Ushbu test hali boshlanmagan!', 'Этот тест ещё не начался!'),
          'warning'
        );
      } else {
        showToast(
          tr(
            'Ushbu test uchun urinishlar soni tugagan!',
            'Попытки для этого теста исчерпаны!'
          ),
          'warning'
        );
      }
      return;
    }

    try {
      const detail = await api.student.getTestDetail(testItem.id);
      if (!detail || !detail.questions || detail.questions.length === 0) {
        showToast(
          tr("Ushbu testda hali savollar yo'q!", 'В этом тесте пока нет вопросов!'),
          'warning'
        );
        return;
      }

      setCurrentTest(detail);
      setCurrentQuestionIdx(0);
      setUserAnswers({});
      userAnswersRef.current = {};
      isSubmittingRef.current = false;
      testStartedAtRef.current = Date.now();

      // Set duration timer
      const duration = (detail.duration_minutes || detail.durationMinutes || 30) * 60;
      setTimeLeftSeconds(duration);
      setActiveTab('runner');

      showToast(
        tr(
          `"${detail.title}" testi boshlandi. Omad tilaymiz!`,
          `Тест «${detail.title}» начался. Желаем удачи!`
        ),
        'info'
      );
    } catch (err) {
      showToast(err.message || tr('Testni yuklashda xatolik!', 'Ошибка загрузки теста!'), 'error');
      loadStudentData();
    }
  };

  // Submit test answers (reads live userAnswersRef so timer auto-submit never submits stale state)
  const submitTestAnswers = async () => {
    if (!currentTest || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);

    const durationSecs = (currentTest.duration_minutes || currentTest.durationMinutes || 30) * 60;
    const elapsedSeconds = testStartedAtRef.current
      ? Math.max(1, Math.round((Date.now() - testStartedAtRef.current) / 1000))
      : Math.max(0, durationSecs - timeLeftSeconds);

    try {
      const res = await api.student.submitTest(currentTest.id, userAnswersRef.current, elapsedSeconds);

      setTestResultData(res);
      setActiveTab('result');
      testStartedAtRef.current = null;

      // Trigger Confetti if passed
      if ((res?.percentage ?? res?.score_percentage ?? 0) >= 60) {
        try {
          confetti({
            particleCount: 120,
            spread: 80,
            origin: { y: 0.6 },
          });
        } catch {}
      }

      showToast(tr('Test muvaffaqiyatli topshirildi!', 'Тест успешно сдан!'), 'success');
      loadStudentData();
      if (refreshUser) refreshUser();
    } catch (err) {
      isSubmittingRef.current = false;
      showToast(err.message || tr('Testni topshirishda xatolik!', 'Ошибка при отправке теста!'), 'error');
      loadStudentData();
    }
  };

  // Countdown timer effect during active test (pure updater, zero side-effects in setState)
  useEffect(() => {
    if (activeTab === 'runner' && currentTest) {
      timerRef.current = setInterval(() => {
        setTimeLeftSeconds((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [activeTab, currentTest?.id]);

  // Trigger auto-submit exactly once when countdown reaches 0
  useEffect(() => {
    if (activeTab === 'runner' && currentTest && timeLeftSeconds === 0 && !isSubmittingRef.current) {
      showToast(
        tr(
          'Vaqt tugadi! Test avtomatik topshirilmoqda...',
          'Время вышло! Тест автоматически отправляется...'
        ),
        'warning'
      );
      submitTestAnswers();
    }
  }, [activeTab, currentTest?.id, timeLeftSeconds]);

  // Confirm submit test button
  const handleConfirmSubmit = () => {
    const answeredCount = Object.keys(userAnswers).length;
    const totalCount = currentTest?.questions?.length || 0;

    setConfirmModal({
      isOpen: true,
      title: tr('Testni yakunlash', 'Завершение теста'),
      message:
        language === 'ru'
          ? `Вы ответили на ${answeredCount} из ${totalCount} вопросов. Подтверждаете отправку теста?`
          : `Siz ${totalCount} ta savoldan ${answeredCount} tasiga javob berdingiz. Testni topshirishni tasdiqlaysizmi?`,
      danger: false,
      onConfirm: () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        submitTestAnswers();
      },
    });
  };

  // Select an option
  const handleSelectOption = (questionId, optionId) => {
    setUserAnswers((prev) => ({
      ...prev,
      [questionId]: optionId,
    }));
  };

  // Format seconds to MM:SS
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Student stats summary
  const completedCount = Array.isArray(myResults) ? myResults.length : 0;
  const avgScore =
    completedCount > 0
      ? Math.round(
          (Array.isArray(myResults) ? myResults : []).reduce(
            (acc, curr) => acc + (curr.score_percentage ?? curr.percentage ?? curr.score ?? 0),
            0
          ) / completedCount
        )
      : 0;

  const studentRankDisplay = useMemo(() => {
    if (!Array.isArray(leaderboard) || leaderboard.length === 0) return '-';
    if (user?.role === 'student') {
      const idx = leaderboard.findIndex(
        (item) =>
          (item.studentId && item.studentId === user?.id) ||
          (item.id && item.id === user?.id) ||
          (item.username && item.username === user?.username)
      );
      if (idx !== -1) {
        const rankNum = leaderboard[idx].rank || idx + 1;
        return language === 'ru' ? `${rankNum}-е место` : `${rankNum}-o'rin`;
      }
      return '-';
    }
    return language === 'ru' ? `${leaderboard.length} уч.` : `${leaderboard.length} nafar`;
  }, [leaderboard, user?.id, user?.username, user?.role, language]);

  // If not student, show Student Login Gate
  if (!isStudent) {
    return (
      <div className="portal-gate-container">
        <div className="login-card student-theme">
          <div className="text-center" style={{ marginBottom: '1.75rem' }}>
            <div className="gate-emblem-wrap emblem-student">
              <GraduationCap size={36} />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider mb-2.5" style={{ background: 'rgba(14, 165, 233, 0.15)', border: '1px solid rgba(14, 165, 233, 0.35)', color: '#38bdf8' }}>
              <Lock size={12} /> {tr("O'quvchi Tizimi", 'Система ученика')}
            </div>
            <h2 className="text-2xl font-black text-white" style={{ fontFamily: 'Cinzel, serif', letterSpacing: '0.5px' }}>
              {tr("O'quvchi Kabineti", 'Кабинет ученика')}
            </h2>
            <p className="text-xs text-slate-400" style={{ marginTop: '0.35rem' }}>
              {tr(
                "Testlarni topshirish va Diamond Coinlar to'plash uchun hisobingizga kiring.",
                'Войдите в свой аккаунт, чтобы решать тесты и зарабатывать Diamond Коины.'
              )}
            </p>
          </div>

          {gateError && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 mb-4">
              <AlertTriangle size={16} /> <span>{gateError}</span>
            </div>
          )}

          <form onSubmit={handleGateLogin} className="space-y-4">
            <div>
              <label className="input-label">{tr("O'quvchi logini", 'Логин ученика')}</label>
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
              <label className="input-label">{tr('Maxfiy parol', 'Секретный пароль')}</label>
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
                  onClick={() => setShowGatePassword(!showGatePassword)}
                  aria-label={tr("Parolni ko'rsatish", 'Показать пароль')}
                >
                  {showGatePassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-diamond-cyan w-full py-3.5 font-bold flex items-center justify-center gap-2 shadow-lg"
              disabled={gateLoading}
              style={{ marginTop: '1.25rem' }}
            >
              {gateLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> {tr('Tekshirilmoqda...', 'Проверка...')}
                </>
              ) : (
                <>
                  <GraduationCap size={18} /> {tr('Kabinetga Kirish', 'Войти в кабинет')}
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="student-portal-wrapper space-y-6 pb-12">
      {/* Student Welcome Header & Badges */}
      <div className="dashboard-header flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2.5">
            <GraduationCap className="text-sky-400" size={28} />
            {tr('Xush kelibsiz,', 'Добро пожаловать,')} {user?.fullName || tr("O'quvchi", 'Ученик')}!
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            {tr(
              "Sinfingiz testlarini yeching, yangi bilimlarni egallang va maktab reytingida yetakchi bo'ling",
              'Решайте тесты своего класса, получайте знания и станьте лидером школьного рейтинга'
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/35 text-amber-300 font-extrabold text-sm shadow-md">
            <Coins size={16} />
            <span>{user?.coins || 0} {tr('Coins', 'коинов')}</span>
          </div>

          <div className="badge badge-primary px-3 py-1.5 text-xs font-bold">
            {canPreviewClasses
              ? `${tr("Ko'rinish:", 'Просмотр:')} ${previewGrade ? localizeGrade(previewGrade, language) : tr('Barcha sinflar', 'Все классы')}`
              : `${tr('Sinf:', 'Класс:')} ${localizeGrade(user?.grade, language)}`}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="admin-kpi-grid">
        <div className="admin-kpi-card">
          <div className="admin-kpi-icon kpi-amber">
            <Trophy size={24} />
          </div>
          <div>
            <div className="admin-kpi-val">{studentRankDisplay}</div>
            <div className="admin-kpi-label">
              {user?.role === 'student'
                ? tr("Sinfdagi O'rni", 'Место в классе')
                : tr("Reytingdagi O'quvchilar", 'Учеников в рейтинге')}
            </div>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-icon kpi-blue">
            <ListCheck size={24} />
          </div>
          <div>
            <div className="admin-kpi-val">
              {language === 'ru' ? `${completedCount}` : `${completedCount} ta`}
            </div>
            <div className="admin-kpi-label">{tr('Topshirilgan Testlar', 'Сданные тесты')}</div>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-icon kpi-green">
            <Award size={24} />
          </div>
          <div>
            <div className="admin-kpi-val">{avgScore}%</div>
            <div className="admin-kpi-label">{tr("O'rtacha Natija", 'Средний результат')}</div>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-icon kpi-blue">
            <Coins size={24} />
          </div>
          <div>
            <div className="admin-kpi-val">{user?.coins || 0}</div>
            <div className="admin-kpi-label">{tr('Diamond Coins', 'Diamond Коины')}</div>
          </div>
        </div>
      </div>

      {/* TEST RUNNER INTERFACE (When a test is active) */}
      {activeTab === 'runner' && currentTest && (
        <div className="active-test-runner space-y-6 animate-scale-in">
          {/* Top Bar with Timer and Progress */}
          <div className="sticky top-20 z-40 p-4 rounded-2xl bg-slate-900/95 border border-cyan-500/30 backdrop-blur-md shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                <span className="badge badge-primary text-[10px] uppercase font-bold">
                  {localizeSubject(currentTest.subject, language)}
                </span>
                {currentTest.grade && (
                  <span className="badge badge-info text-[10px] font-bold">
                    {localizeGrade(currentTest.grade, language)}
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white line-clamp-1">
                {currentTest.title}
              </h2>
            </div>

            <div className="flex items-center gap-4">
              {/* Countdown Timer */}
              <div
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-mono text-sm font-black border ${
                  timeLeftSeconds <= 300
                    ? 'bg-rose-500/20 border-rose-500 text-rose-300 animate-pulse'
                    : 'bg-slate-800 border-cyan-500/40 text-cyan-300'
                }`}
              >
                <Clock size={16} />
                <span>{formatTime(timeLeftSeconds)}</span>
              </div>

              <button
                type="button"
                className="btn btn-success btn-sm font-bold flex items-center gap-1.5 shadow-lg"
                onClick={handleConfirmSubmit}
              >
                <CheckCircle size={15} /> {tr('Yakunlash', 'Завершить')}
              </button>
            </div>
          </div>

          {/* Question Jumper Grid */}
          <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 flex flex-wrap gap-2 items-center">
            <span className="text-xs text-slate-400 font-semibold mr-1">
              {tr('Savollar:', 'Вопросы:')}
            </span>
            {currentTest.questions.map((q, idx) => {
              const isAnswered = userAnswers[q.id] !== undefined;
              const isCurrent = idx === currentQuestionIdx;
              return (
                <button
                  key={q.id || idx}
                  type="button"
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                    isCurrent
                      ? 'bg-cyan-500 text-slate-950 ring-2 ring-cyan-300 shadow-md'
                      : isAnswered
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                  }`}
                  onClick={() => setCurrentQuestionIdx(idx)}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          {/* Question Card */}
          {(() => {
            const currentQ = currentTest.questions[currentQuestionIdx];
            if (!currentQ) return null;

            return (
              <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <span className="text-xs font-black text-cyan-400 uppercase tracking-widest">
                    {tr('Savol', 'Вопрос')} {currentQuestionIdx + 1} / {currentTest.questions.length}
                  </span>
                  <span className="text-xs text-slate-400">
                    {language === 'ru'
                      ? `Отвечено: ${Object.keys(userAnswers).length}`
                      : `Javob berilgan: ${Object.keys(userAnswers).length} ta`}
                  </span>
                </div>

                {/* Question Text */}
                <div className="text-base sm:text-lg font-medium text-white leading-relaxed">
                  <MathRenderer text={currentQ.text || currentQ.question || ''} />
                </div>

                {/* Optional Image */}
                {currentQ.imageUrl && (
                  <div className="rounded-xl overflow-hidden max-h-72 border border-slate-700 inline-block">
                    <img src={currentQ.imageUrl} alt="" className="object-contain max-h-72" />
                  </div>
                )}

                {/* Options List */}
                <div className="space-y-3 pt-2">
                  {currentQ.options?.map((opt, optIdx) => {
                    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
                    const optVal = opt.id !== undefined ? opt.id : optIdx;
                    const isSelected = userAnswers[currentQ.id] === optVal;
                    return (
                      <div
                        key={opt.id || optIdx}
                        className={`p-4 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-cyan-500/15 border-cyan-400 text-white shadow-md'
                            : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-300'
                        }`}
                        onClick={() => handleSelectOption(currentQ.id, optVal)}
                      >
                        <div
                          className={`w-6 h-6 rounded-full border flex items-center justify-center font-bold text-xs ${
                            isSelected
                              ? 'bg-cyan-500 border-cyan-400 text-slate-950'
                              : 'border-slate-600 text-slate-400'
                          }`}
                        >
                          {letters[optIdx] || optIdx + 1}
                        </div>
                        <div className="text-sm font-medium flex-1">
                          <MathRenderer text={opt.text || ''} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Navigation Buttons */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm flex items-center gap-1.5"
                    disabled={currentQuestionIdx === 0}
                    onClick={() => setCurrentQuestionIdx((prev) => Math.max(0, prev - 1))}
                  >
                    <ArrowLeft size={15} /> {tr('Oldingi', 'Назад')}
                  </button>

                  {currentQuestionIdx < currentTest.questions.length - 1 ? (
                    <button
                      type="button"
                      className="btn btn-diamond-cyan btn-sm flex items-center gap-1.5 font-bold"
                      onClick={() => setCurrentQuestionIdx((prev) => prev + 1)}
                    >
                      {tr('Keyingi', 'Далее')} <ArrowRight size={15} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-success btn-sm flex items-center gap-1.5 font-bold shadow-lg"
                      onClick={handleConfirmSubmit}
                    >
                      <CheckCircle size={15} /> {tr('Testni Yakunlash', 'Завершить тест')}
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* RESULT VIEW (After finishing a test) */}
      {activeTab === 'result' && testResultData && (
        <div className="test-result-wrapper space-y-6 animate-scale-in">
          <div className="p-8 rounded-2xl bg-slate-900/90 border border-cyan-500/30 text-center space-y-4 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 to-emerald-400 flex items-center justify-center text-slate-950 mx-auto shadow-lg shadow-cyan-500/25">
              <Sparkles size={36} />
            </div>

            <h2 className="text-2xl font-black text-white">
              {tr('Test Muvaffaqiyatli Yakunlandi!', 'Тест успешно завершён!')}
            </h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {tr(
                'Sizning natijangiz avtomatik saqlandi va umumiy sinf reytingiga kiritildi.',
                'Ваш результат автоматически сохранён и добавлен в общий рейтинг класса.'
              )}
            </p>

            {/* Score circle cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-xl mx-auto pt-2">
              <div className="stat-card-glass p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="text-2xl font-black text-cyan-400">
                  {testResultData.correctAnswers ?? testResultData.score ?? 0} /{' '}
                  {testResultData.totalQuestions ?? testResultData.total ?? 0}
                </div>
                <div className="text-[11px] text-slate-400">
                  {tr("To'g'ri Javoblar", 'Правильные ответы')}
                </div>
              </div>

              <div className="stat-card-glass p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="text-2xl font-black text-emerald-400">
                  {testResultData.percentage ??
                    testResultData.score_percentage ??
                    testResultData.scorePercentage ??
                    0}
                  %
                </div>
                <div className="text-[11px] text-slate-400">
                  {tr("O'zlashtirish Foizi", 'Процент усвоения')}
                </div>
              </div>

              <div className="stat-card-glass p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="text-2xl font-black text-amber-400">
                  +{testResultData.earnedCoins ?? testResultData.coinsEarned ?? 0} 💎
                </div>
                <div className="text-[11px] text-slate-400">
                  {tr('Yutuq: Diamond Coinlar', 'Награда: Diamond Коины')}
                </div>
              </div>

              <div className="stat-card-glass p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="text-2xl font-black text-sky-400">
                  {testResultData.timeSpent ||
                    (testResultData.timeSpentSeconds !== undefined
                      ? formatTime(testResultData.timeSpentSeconds)
                      : '00:00')}
                </div>
                <div className="text-[11px] text-slate-400">
                  {tr('Sarflangan Vaqt', 'Затраченное время')}
                </div>
              </div>
            </div>

            {(testResultData.earnedCoins ?? testResultData.coinsEarned ?? 0) > 0 && (
              <div className="space-y-2 max-w-md mx-auto">
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold flex items-center justify-center gap-2">
                  <span>🎉</span>
                  <span>
                    {language === 'ru'
                      ? `За вашу активность в тесте на счёт зачислено +${testResultData.earnedCoins ?? testResultData.coinsEarned} Diamond Коинов!`
                      : `Testdagi faolligingiz uchun hisobingizga +${testResultData.earnedCoins ?? testResultData.coinsEarned} Diamond Coin qo'shildi!`}
                  </span>
                </div>
                {Number(testResultData.bonusCoinsEarned) > 0 && (
                  <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-xs font-bold flex items-center justify-center gap-2">
                    <span>⚡</span>
                    <span>
                      {language === 'ru'
                        ? `Бонус за активность (#${testResultData.bonusSlotRank || 1}-е место): +${testResultData.baseCoinsEarned ?? 0} основных + ${testResultData.bonusCoinsEarned} бонусных коинов!`
                        : `Faol ishtirokchi bonusi (#${testResultData.bonusSlotRank || 1}-o'rin): +${testResultData.baseCoinsEarned ?? 0} asosiy + ${testResultData.bonusCoinsEarned} bonus coin!`}
                    </span>
                  </div>
                )}
              </div>
            )}

            {Array.isArray(testResultData.breakdown) && testResultData.breakdown.length > 0 && (
              <div className="text-left max-w-2xl mx-auto pt-4 space-y-2.5">
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  {language === 'ru'
                    ? `Разбор вопросов (${testResultData.breakdown.length})`
                    : `Savollar Tahlili (${testResultData.breakdown.length} ta)`}
                </div>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {testResultData.breakdown.map((b, bIdx) => (
                    <div
                      key={bIdx}
                      className={`p-3 rounded-xl border text-xs ${
                        b.isCorrect
                          ? 'bg-emerald-500/10 border-emerald-500/30'
                          : 'bg-rose-500/10 border-rose-500/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 font-semibold text-white">
                        <span>
                          {bIdx + 1}. <MathRenderer text={b.questionText || ''} />
                        </span>
                        {b.isCorrect ? (
                          <CheckCircle size={15} className="text-emerald-400 flex-shrink-0" />
                        ) : (
                          <XCircle size={15} className="text-rose-400 flex-shrink-0" />
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-300">
                        <span>
                          {tr('Sizning javobingiz:', 'Ваш ответ:')}{' '}
                          <strong className={b.isCorrect ? 'text-emerald-300' : 'text-rose-300'}>
                            {b.selectedText ? <MathRenderer text={b.selectedText} /> : tr('Tanlanmagan', 'Не выбран')}
                          </strong>
                        </span>
                        {!b.isCorrect && b.correctText && (
                          <span>
                            {tr("To'g'ri javob:", 'Правильный ответ:')}{' '}
                            <strong className="text-emerald-300">
                              <MathRenderer text={b.correctText} />
                            </strong>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-3 flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                className="btn btn-diamond-cyan btn-sm px-6 font-bold"
                onClick={() => setActiveTab('tests')}
              >
                {tr("Mavjud Testlar Ro'yxatiga Qaytish", 'Вернуться к списку тестов')}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm px-5 font-bold"
                onClick={() => setActiveTab('analytics')}
              >
                {tr('Barcha Natijalarim', 'Все мои результаты')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STANDARD TABS (When not in runner or result) */}
      {activeTab !== 'runner' && activeTab !== 'result' && (
        <div className="portal-app-layout">
          {/* Sidebar */}
          <aside className="portal-sidebar">
            <div className="portal-sidebar-userbox">
              <img
                src={user?.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${user?.username}&backgroundColor=0284c7`}
                alt="Avatar"
                className="portal-sidebar-avatar"
              />
              <div className="portal-sidebar-info">
                <div className="portal-sidebar-name">{user?.fullName || user?.username}</div>
                <div className="portal-sidebar-role">
                  <i className="fa-solid fa-graduation-cap" style={{ color: '#29B7E1', marginRight: '4px' }}></i>
                  {user?.role === 'student'
                    ? localizeGrade(user?.grade, language)
                    : language === 'ru'
                    ? `Режим: ${localizeRole(user?.role, 'ru')}`
                    : `${user?.role?.toUpperCase()} ko'rinishi`}
                </div>
              </div>
            </div>

            <div className="portal-sidebar-nav-title">{tr("O'QUVCHI MENYUSI", 'МЕНЮ УЧЕНИКА')}</div>
            <nav className="portal-sidebar-nav">
              <button
                type="button"
                className={`portal-nav-btn ${activeTab === 'tests' ? 'active' : ''}`}
                onClick={() => setActiveTab('tests')}
              >
                <div className="portal-nav-icon">
                  <ListCheck size={18} />
                </div>
                <span className="portal-nav-label">{tr('Mavjud Testlar', 'Доступные тесты')}</span>
                <span className="portal-nav-badge">{availableTests.length}</span>
              </button>

              <button
                type="button"
                className={`portal-nav-btn nav-coin ${activeTab === 'leaderboard' ? 'active' : ''}`}
                onClick={() => setActiveTab('leaderboard')}
              >
                <div className="portal-nav-icon">
                  <Trophy size={18} />
                </div>
                <span className="portal-nav-label">{tr('Sinfim Reytingi', 'Рейтинг класса')}</span>
                <span className="portal-nav-badge">🏆 {tr('TOP', 'ТОП')}</span>
              </button>

              <button
                type="button"
                className={`portal-nav-btn ${activeTab === 'analytics' ? 'active' : ''}`}
                onClick={() => setActiveTab('analytics')}
              >
                <div className="portal-nav-icon">
                  <BarChart2 size={18} />
                </div>
                <span className="portal-nav-label">
                  {tr('Natijalarim & Tahlil', 'Мои результаты и анализ')}
                </span>
              </button>
            </nav>
          </aside>

          {/* Right Main Area */}
          <main className="portal-main-area">
            {/* TAB: AVAILABLE TESTS */}
            {activeTab === 'tests' && (
              <div className="space-y-4 animate-fade-in">
                <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <ListCheck className="text-cyan-400" size={18} />
                      {canPreviewClasses && !previewGrade
                        ? tr('Barcha Testlar', 'Все тесты')
                        : language === 'ru'
                        ? `Тесты для класса: ${localizeGrade(user?.role === 'student' ? user?.grade : previewGrade, language)}`
                        : `${localizeGrade(user?.role === 'student' ? user?.grade : previewGrade, language)} Sinfiga Biriktirilgan Testlar`}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {user?.role === 'student'
                        ? tr(
                            'Faqat sizning sinfingizga biriktirilgan va administrator ruxsat bergan testlar ishlaydi',
                            'Доступны только тесты для вашего класса, разрешённые администратором'
                          )
                        : tr(
                            "Admin/O'qituvchi ko'rinishi: har bir sinfga qaysi testlar ko'rinishi va ruxsat holatini tekshirishingiz mumkin",
                            'Просмотр Админ/Учитель: проверяйте, какие тесты видны каждому классу и их статус разрешения'
                          )}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {canPreviewClasses && (
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-400 font-semibold whitespace-nowrap">
                          {tr("Sinf ko'rinishi:", 'Фильтр класса:')}
                        </label>
                        <select
                          className="clean-select text-xs py-1.5"
                          value={previewGrade}
                          onChange={(e) => setPreviewGrade(e.target.value)}
                        >
                          <option value="">{tr('Barcha sinflar', 'Все классы')}</option>
                          {previewClasses.map((cls) => (
                            <option key={cls} value={cls}>
                              {language === 'ru' ? `${localizeGrade(cls, language)} класс` : `${cls} sinfi`}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <button
                      type="button"
                      data-testid="student-refresh-tests-btn"
                      onClick={loadStudentData}
                      disabled={loadingData}
                      className="btn btn-secondary btn-xs h-8 px-3 font-bold flex items-center gap-1.5"
                      title={tr('Testlar ruxsati va holatini yangilash', 'Обновить статус и разрешения тестов')}
                    >
                      <RefreshCw size={13} className={loadingData ? 'animate-spin' : ''} />
                      <span>{tr('Yangilash', 'Обновить')}</span>
                    </button>
                  </div>
                </div>

                {/* Global Admin Permission & Schedule Status Banner */}
                {studentTestsPolicy && (
                  <div
                    data-testid="student-portal-policy-banner"
                    className={`p-3.5 sm:p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs ${
                      !studentTestsPolicy.portalOpen
                        ? 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                        : 'bg-slate-900/60 border-cyan-500/25 text-slate-300'
                    }`}
                  >
                    <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                      {studentTestsPolicy.portalOpen ? (
                        <Unlock size={16} className="text-emerald-400 flex-shrink-0 mt-0.5 sm:mt-0" />
                      ) : studentTestsPolicy.isUpcoming ? (
                        <Clock size={16} className="text-cyan-400 flex-shrink-0 mt-0.5 sm:mt-0" />
                      ) : (
                        <Lock size={16} className="text-rose-400 flex-shrink-0 mt-0.5 sm:mt-0" />
                      )}
                      <div className="space-y-0.5 min-w-0">
                        <div className="font-bold text-white">
                          {studentTestsPolicy.portalOpen
                            ? tr(
                                'Admin ruxsati berilgan testlar hozir ishlashga ochiq',
                                'Тесты, разрешённые администратором, сейчас открыты для решения'
                              )
                            : studentTestsPolicy.isUpcoming
                            ? tr('Test oynasi hali ochilmagan', 'Окно тестирования ещё не открылось')
                            : studentTestsPolicy.isExpired
                            ? tr('Test oynasi vaqti yakunlangan', 'Время окна тестирования истекло')
                            : tr(
                                "O'quvchilar test bo'limi administrator tomonidan yopilgan",
                                'Раздел тестирования учеников закрыт администратором'
                              )}
                        </div>
                        <div className="text-[11px] opacity-90">
                          {getPolicyMessageLocalized(studentTestsPolicy, language)}
                        </div>
                      </div>
                    </div>

                    {(studentTestsPolicy.startTime || studentTestsPolicy.endTime) && (
                      <div className="flex flex-wrap items-center gap-2 text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-950/60 border border-slate-800 flex-shrink-0">
                        <Calendar size={13} className="text-cyan-400" />
                        {studentTestsPolicy.startTime && (
                          <span>
                            {tr('Boshlanish:', 'Начало:')}{' '}
                            <strong className="text-white">{studentTestsPolicy.startTime}</strong>
                          </span>
                        )}
                        {studentTestsPolicy.endTime && (
                          <span>
                            {tr('Tugash:', 'Окончание:')}{' '}
                            <strong className="text-amber-300">{studentTestsPolicy.endTime}</strong>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {loadingData && (
                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-cyan-300 text-xs flex items-center gap-2">
                    <Loader2 size={15} className="animate-spin" />
                    <span>
                      {tr('Sinfingiz testlari yuklanmoqda...', 'Загрузка тестов вашего класса...')}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {(Array.isArray(availableTests) ? availableTests : []).map((t) => {
                    const sLow = (t.subject || '').toLowerCase();
                    const subjClass = sLow.includes('matem')
                      ? 'subj-math'
                      : sLow.includes('fizik')
                      ? 'subj-fizika'
                      : sLow.includes('inform')
                      ? 'subj-it'
                      : sLow.includes('ingliz')
                      ? 'subj-english'
                      : sLow.includes('kimyo') || sLow.includes('bio')
                      ? 'subj-kimyo'
                      : 'subj-default';

                    const isAllClasses =
                      Boolean(t.isAllClasses) ||
                      (t.grade || '').trim().toLowerCase() === 'barchasi';
                    const canStart = t.canStart !== false;
                    const lockReason = t.lockReason || null;
                    const lockMessage = getLockMessageLocalized(t, language);
                    const isAllowed = Boolean(t.isStudentAllowed ?? t.is_student_allowed);
                    const rawTeacher = t.teacherName || t.teacher_name || '';
                    const teacherDisplay =
                      rawTeacher && rawTeacher !== 'Administrator'
                        ? rawTeacher
                        : tr('Administrator', 'Администратор');
                    const qCount = t.questionCount ?? t.questionsCount ?? 0;
                    const maxAtt = t.maxAttempts || 0;
                    const attCount = t.attemptsCount || 0;

                    let permBadgeText = tr('Ruxsat berilgan', 'Разрешено');
                    let permBadgeClass =
                      'px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/35 inline-flex items-center gap-1';
                    if (lockReason === 'max_attempts_reached') {
                      permBadgeText = tr('✓ Topshirilgan', '✓ Сдано');
                      permBadgeClass =
                        'px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/35 inline-flex items-center gap-1';
                    } else if (lockReason === 'portal_disabled') {
                      permBadgeText = tr('🔒 Portal yopiq', '🔒 Портал закрыт');
                      permBadgeClass =
                        'px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/35 inline-flex items-center gap-1';
                    } else if (lockReason === 'portal_upcoming' || t.isUpcoming) {
                      permBadgeText = tr('⏳ Vaqti kutilmoqda', '⏳ Ожидает времени');
                      permBadgeClass =
                        'px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/35 inline-flex items-center gap-1';
                    } else if (lockReason === 'portal_expired' || t.isExpired) {
                      permBadgeText = tr('⏱ Muddati tugagan', '⏱ Срок истёк');
                      permBadgeClass =
                        'px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/35 inline-flex items-center gap-1';
                    } else if (lockReason === 'admin_not_allowed' || !isAllowed) {
                      permBadgeText = tr('🔒 Admin ruxsati kutilmoqda', '🔒 Ждёт разрешения админа');
                      permBadgeClass =
                        'px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/35 inline-flex items-center gap-1';
                    }

                    let disabledButtonLabel =
                      language === 'ru'
                        ? `Сдано (${t.userScore ?? 0}%)`
                        : `Topshirilgan (${t.userScore ?? 0}%)`;
                    if (lockReason === 'portal_disabled') {
                      disabledButtonLabel = tr("Test bo'limi yopiq", 'Раздел тестов закрыт');
                    } else if (lockReason === 'admin_not_allowed' || !isAllowed) {
                      disabledButtonLabel = tr('Admin ruxsati kutilmoqda', 'Ждёт разрешения админа');
                    } else if (lockReason === 'portal_upcoming' || t.isUpcoming) {
                      disabledButtonLabel = tr('Hali boshlanmagan', 'Ещё не начался');
                    } else if (lockReason === 'portal_expired' || t.isExpired) {
                      disabledButtonLabel = tr('Muddati tugagan', 'Срок истёк');
                    }

                    return (
                      <div key={t.id} className="test-card-luxury" data-testid={`student-test-card-${t.id}`}>
                        <div>
                          <div className="test-card-header flex-wrap gap-2">
                            <span className={`subject-tag ${subjClass}`}>
                              <BookOpen size={12} /> {localizeSubject(t.subject, language)}
                            </span>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                data-testid={`student-test-permission-badge-${t.id}`}
                                className={permBadgeClass}
                              >
                                {canStart ? <Unlock size={11} /> : null}
                                {permBadgeText}
                              </span>
                              <span
                                className={
                                  isAllClasses
                                    ? 'px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/35'
                                    : 'status-pill-active'
                                }
                              >
                                {isAllClasses
                                  ? tr('🌐 Barchasi', '🌐 Все классы')
                                  : `🎯 ${localizeGrade(t.grade || user?.grade, language)}`}
                              </span>
                            </div>
                          </div>

                          <h3 className="test-card-title">{t.title}</h3>

                          <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 mb-2">
                            <span>{tr('Ustoz:', 'Учитель:')}</span>
                            <span className="text-cyan-300 font-bold">{teacherDisplay}</span>
                          </div>

                          <div className="test-meta-grid">
                            <div className="test-meta-chip">
                              <Clock size={15} style={{ color: '#38bdf8' }} />
                              <span>
                                {t.durationMinutes || t.duration_minutes || 30}{' '}
                                {tr('daqiqa', 'мин.')}
                              </span>
                            </div>
                            <div className="test-meta-chip">
                              <HelpCircle size={15} style={{ color: '#2dd4bf' }} />
                              <span>
                                {language === 'ru' ? `${qCount} вопр.` : `${qCount} ta savol`}
                              </span>
                            </div>
                            <div className="test-meta-chip">
                              <RotateCcw size={15} style={{ color: '#a78bfa' }} />
                              <span>
                                {maxAtt > 0
                                  ? `${attCount}/${maxAtt} ${tr('urinish', 'попыт.')}`
                                  : tr('Cheksiz urinish', 'Без ограничений')}
                              </span>
                            </div>
                            <div className="test-meta-chip">
                              {t.completed && t.userScore !== null && t.userScore !== undefined ? (
                                <>
                                  <CheckCircle size={15} style={{ color: '#34d399' }} />
                                  <span className="text-emerald-300 font-bold">
                                    {tr('Natija:', 'Результат:')} {t.userScore}%
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Coins size={15} style={{ color: '#fbbf24' }} />
                                  <span>+5..50 {tr('Coins', 'коинов')}</span>
                                </>
                              )}
                            </div>
                          </div>

                          {(t.startTime || t.endTime) && (
                            <div className="mt-2 text-[11px] text-slate-400 flex flex-wrap gap-x-3 gap-y-1">
                              {t.startTime && (
                                <span>
                                  {tr('Boshlanish:', 'Начало:')} {t.startTime}
                                </span>
                              )}
                              {t.endTime && (
                                <span>
                                  {tr('Tugash:', 'Окончание:')} {t.endTime}
                                </span>
                              )}
                            </div>
                          )}

                          {!canStart && lockMessage && (
                            <div
                              data-testid={`student-test-lock-msg-${t.id}`}
                              className="mt-2.5 px-2.5 py-2 rounded-lg bg-slate-950/70 border border-amber-500/30 text-[11px] text-amber-200 flex items-start gap-2 leading-snug"
                            >
                              <Lock size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
                              <span>{lockMessage}</span>
                            </div>
                          )}

                          {Number(t.rewardTopCount) > 0 && Number(t.rewardCoinsAmount) > 0 && (
                            <div className="mt-2.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 font-bold flex items-center justify-between gap-2 flex-wrap">
                              <span>
                                {language === 'ru'
                                  ? `⚡ Первым ${t.rewardTopCount} активным +${t.rewardCoinsAmount} коин.`
                                  : `⚡ Birinchi ${t.rewardTopCount} faolga +${t.rewardCoinsAmount} Coin`}
                                {Number(t.rewardMinScore) > 0 ? ` (${t.rewardMinScore}%+)` : ''}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-950/60 text-cyan-300 border border-cyan-500/30">
                                {language === 'ru'
                                  ? `осталось мест: ${t.rewardSlotsLeft ?? t.rewardTopCount}`
                                  : `${t.rewardSlotsLeft ?? t.rewardTopCount} joy qoldi`}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="test-card-actions">
                          <button
                            type="button"
                            data-testid={`student-start-test-${t.id}`}
                            disabled={!canStart}
                            className={`btn w-full py-2.5 font-bold flex items-center justify-center gap-2 text-xs shadow-md ${
                              canStart
                                ? 'btn-diamond-cyan'
                                : 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed'
                            }`}
                            onClick={() => handleStartTest(t)}
                          >
                            {!canStart ? (
                              <>
                                <Lock size={14} />
                                <span>{disabledButtonLabel}</span>
                              </>
                            ) : (
                              <>
                                <span>
                                  {attCount > 0
                                    ? tr('Qayta Topshirish', 'Пересдать тест')
                                    : tr('Testni Boshlash', 'Начать тест')}
                                </span>
                                <ArrowRight size={15} />
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {availableTests.length === 0 && !loadingData && (
                    <div className="col-span-2 text-center py-12 text-slate-400 text-xs bg-slate-900/40 rounded-2xl border border-slate-800">
                      {canPreviewClasses && previewGrade
                        ? language === 'ru'
                          ? `Тесты для класса «${localizeGrade(previewGrade, language)}» не найдены.`
                          : `"${localizeGrade(previewGrade, language)}" sinfiga biriktirilgan testlar topilmadi.`
                        : tr(
                            "Hozirda sinfingiz uchun topshirishga yangi testlar yo'q. Yangi test qo'shilganda bu yerda ko'rinadi!",
                            'Сейчас для вашего класса нет доступных тестов. Как только появится новый тест, он отобразится здесь!'
                          )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: LEADERBOARD */}
            {activeTab === 'leaderboard' && (
              <div className="space-y-4 animate-fade-in">
                <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Trophy className="text-amber-400" size={18} />
                      {tr("Sinf Reytingi (Top O'quvchilar)", 'Рейтинг класса (Топ учеников)')}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {tr(
                        "Eng ko'p Diamond Coin va yuqori test ballarini to'plagan tengdoshlaringiz",
                        'Одноклассники с наибольшим количеством Diamond Коинов и высокими баллами по тестам'
                      )}
                    </p>
                  </div>
                  <span className="badge badge-info text-xs font-bold">
                    {canPreviewClasses
                      ? previewGrade
                        ? localizeGrade(previewGrade, language)
                        : tr('Barcha sinflar', 'Все классы')
                      : localizeGrade(user?.grade, language)}
                  </span>
                </div>

                <div className="table-responsive bg-slate-900/60 rounded-xl border border-slate-800/80 overflow-hidden">
                  <table className="diamond-table w-full text-left">
                    <thead>
                      <tr>
                        <th>{tr("O'rin", 'Место')}</th>
                        <th>{tr("O'quvchi", 'Ученик')}</th>
                        <th>{tr('Sinfi', 'Класс')}</th>
                        <th>{tr('Testlar', 'Тесты')}</th>
                        <th>{tr("O'rtacha Ball", 'Средний балл')}</th>
                        <th>{tr('Diamond Coins', 'Diamond Коины')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(Array.isArray(leaderboard) ? leaderboard : []).map((item, idx) => {
                        const isMe =
                          user?.id &&
                          ((item.studentId && item.studentId === user.id) ||
                            (item.id && item.id === user.id));
                        return (
                          <tr
                            key={item.studentId || item.id || idx}
                            className={isMe ? 'bg-cyan-500/10' : ''}
                          >
                            <td>
                              <div className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs bg-slate-800 text-amber-300">
                                {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : item.rank || idx + 1}
                              </div>
                            </td>
                            <td className="font-bold text-white text-xs">
                              {item.fullName || item.full_name || item.username}
                              {isMe && (
                                <span className="ml-2 px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-bold">
                                  {tr('Siz', 'Вы')}
                                </span>
                              )}
                            </td>
                            <td>
                              <span className="badge badge-info text-[11px] font-semibold">
                                {localizeGrade(item.grade, language)}
                              </span>
                            </td>
                            <td className="text-xs text-slate-300">
                              {language === 'ru'
                                ? `${item.testsCompleted ?? 0}`
                                : `${item.testsCompleted ?? 0} ta`}
                            </td>
                            <td className="text-xs font-bold text-cyan-300">
                              {item.avgScore ?? 0}%
                            </td>
                            <td>
                              <div className="inline-flex items-center gap-1 font-extrabold text-xs text-amber-300">
                                <Coins size={13} /> {item.coins || 0} {tr('Coins', 'коин.')}
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                      {leaderboard.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center py-8 text-slate-400 text-xs">
                            {tr('Reyting hali shakllanmagan.', 'Рейтинг ещё не сформирован.')}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB: ANALYTICS & HISTORY */}
            {activeTab === 'analytics' && (
              <div className="space-y-5 animate-fade-in">
                <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-800">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <BarChart2 className="text-cyan-400" size={18} />
                    {tr('Mening Natijalarim & Topshiriqlar Tarixi', 'Мои результаты и история тестов')}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {language === 'ru'
                      ? `Статистика по всем сданным тестам (${completedCount} попыт.)`
                      : `Ilgari yechilgan barcha testlar statistikasi (${completedCount} ta urinish)`}
                  </p>
                </div>

                <div className="table-responsive bg-slate-900/60 rounded-xl border border-slate-800/80 overflow-hidden">
                  <table className="diamond-table w-full text-left">
                    <thead>
                      <tr>
                        <th>{tr('Test Nomi', 'Название теста')}</th>
                        <th>{tr('Fani', 'Предмет')}</th>
                        <th>{tr('Natija', 'Результат')}</th>
                        <th>{tr('Foiz', 'Процент')}</th>
                        <th>{tr('Topshirilgan Sana', 'Дата сдачи')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(Array.isArray(myResults) ? myResults : []).map((r, idx) => {
                        const pct = r.score_percentage ?? r.percentage ?? r.score ?? 0;
                        const corr = r.correctAnswers ?? r.correct ?? r.score ?? 0;
                        const tot = r.totalQuestions ?? r.total_questions ?? r.total ?? 0;
                        return (
                          <tr key={r.id || idx}>
                            <td className="font-bold text-white text-xs">
                              {r.testTitle || r.test_title || r.title}
                            </td>
                            <td>
                              <span className="badge badge-primary text-[11px] font-semibold">
                                {localizeSubject(r.subject || 'Fan', language)}
                              </span>
                            </td>
                            <td className="font-bold text-xs text-cyan-400">
                              {corr} / {tot}
                            </td>
                            <td>
                              <span
                                className={`font-bold text-xs ${
                                  pct >= 70
                                    ? 'text-emerald-400'
                                    : pct >= 50
                                    ? 'text-amber-400'
                                    : 'text-rose-400'
                                }`}
                              >
                                {pct}%
                              </span>
                            </td>
                            <td className="text-xs text-slate-400">
                              {r.submitted_at || r.date || '-'}
                            </td>
                          </tr>
                        );
                      })}

                      {myResults.length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-slate-400 text-xs">
                            {tr(
                              'Siz hali birorta test topshirmagansiz. "Mavjud Testlar" bo\'limidan boshlang!',
                              'Вы ещё не сдали ни одного теста. Начните в разделе «Доступные тесты»!'
                            )}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </main>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        danger={confirmModal.danger}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
