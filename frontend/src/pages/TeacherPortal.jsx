import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../api/endpoints';
import MathRenderer from '../components/MathRenderer';
import { localizeSubject, localizeGrade, localizeUserFullName, getTeacherLessonPresets } from '../i18n/portalUtils';
import {
  ScoreTierDonutChart,
  VerticalBarDiagram,
  HorizontalAccuracyDiagram,
} from '../components/StatsCharts';
import {
  Presentation as ChalkboardTeacher,
  ShieldCheck,
  BookOpen,
  FileCheck2,
  Users,
  Coins,
  TrendingUp,
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  AlertCircle,
  HelpCircle,
  Loader2,
  Search,
  Eye,
  EyeOff,
  User,
  Lock,
  Sparkles,
  Trophy,
  Crown,
  Camera,
  Save,
  Trash2,
  Edit,
  Phone,
  BarChart2,
  AlertTriangle,
  Layers,
  Target,
} from 'lucide-react';

const TEACHER_VALID_TABS = ['tests', 'stats', 'results', 'coins', 'profile'];
const testMatchesClassFilter = (t, selectedClass, includeAllTests = true) => {
  if (!selectedClass || selectedClass === 'all') return true;
  const raw = (t?.grade || '').trim();
  if (!raw || raw.toLowerCase() === 'barchasi') return includeAllTests;
  const targets =
    Array.isArray(t?.targetClasses) && t.targetClasses.length
      ? t.targetClasses
      : raw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
  return targets.some((g) => g.toLowerCase() === selectedClass.toLowerCase());
};
const TEACHER_NON_LESSON_REASON_RE = /(?:\btest\w*|\bimti[hx]on\w*|\bolimpiad\w*|\bnazorat\s+ish\w*|\buy(?:ga|dagi)?\s*vazifa\w*|\byakuniy\b|\bchorak\w*\b|\bsinfdoshiga\s+yordam\b|\bтест\w*|\bэкзамен\w*|\bолимпиад\w*|\bдомашн\w*\s+задан\w*|\bконтрольн\w*\s+работ\w*)/i;
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

export default function TeacherPortal() {
  const { user, login, updateProfile, language, tr } = useAuth();
  const { showToast } = useToast();
  const lessonPresets = useMemo(() => getTeacherLessonPresets(language), [language]);
  const profileFileInputRef = useRef(null);

  // Auth gate state
  const [gateUsername, setGateUsername] = useState('anvar_muallim');
  const [gatePassword, setGatePassword] = useState('123');
  const [gateLoading, setGateLoading] = useState(false);
  const [gateError, setGateError] = useState('');
  const [showGatePassword, setShowGatePassword] = useState(false);

  // Active tab: 'tests' | 'results' | 'coins'
  const [searchParams] = useSearchParams();
  const initialTabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(
    TEACHER_VALID_TABS.includes(initialTabParam) ? initialTabParam : 'tests'
  );

  // Teacher data
  const [tests, setTests] = useState([]);
  const [stats, setStats] = useState({
    testsCount: 0,
    submissionsCount: 0,
    avgScore: 0,
    activeTestsCount: 0,
  });
  const [classesList, setClassesList] = useState([]);
  const [classesMeta, setClassesMeta] = useState([]);
  const [subjectsList, setSubjectsList] = useState(DEFAULT_SUBJECTS);
  const [loadingData, setLoadingData] = useState(false);
  const hasManualGradePickRef = useRef(false);

  // Teacher Profile & Password Editor State
  const [profileForm, setProfileForm] = useState({
    fullName: '',
    username: '',
    subject: 'Matematika',
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

  // Daily teacher coin limit status (har bir sinf uchun kuniga max 5 coin)
  const [dailyCoinStatus, setDailyCoinStatus] = useState({
    isLimited: true,
    isPerClassLimit: true,
    maxClassesPerDay: null,
    maxCoinsPerDay: 5,
    awardedClassToday: null,
    awardedClassesToday: [],
    perClassStatus: {},
    totalCoinsUsedAllClassesToday: 0,
    coinsUsedToday: 0,
    coinsRemainingToday: 5,
    canAwardToday: true,
  });

  // Search & filter
  const [testSearch, setTestSearch] = useState('');
  const [testClassFilter, setTestClassFilter] = useState('all');
  const [testIncludeAllClasses, setTestIncludeAllClasses] = useState(true);

  // Statistics & Class drill-down state
  const [statsSelectedClass, setStatsSelectedClass] = useState('');
  const [statsClassLangFilter, setStatsClassLangFilter] = useState('all');
  const [statsShowEmptyClasses, setStatsShowEmptyClasses] = useState(false);
  const [statsSelectedTestId, setStatsSelectedTestId] = useState(null);
  const [statsOverviewChartMode, setStatsOverviewChartMode] = useState('classes');
  const [resultsChartMode, setResultsChartMode] = useState('auto');
  const [adminTeacherFilterId, setAdminTeacherFilterId] = useState('');
  const [adminTeachersList, setAdminTeachersList] = useState([]);

  // Results & Submissions state
  const [selectedTestForResults, setSelectedTestForResults] = useState(null);
  const [participantsList, setParticipantsList] = useState([]);
  const [resultsClassFilter, setResultsClassFilter] = useState('all');
  const [viewingSubmission, setViewingSubmission] = useState(null);
  const [loadingResults, setLoadingResults] = useState(false);
  const [testResultsMeta, setTestResultsMeta] = useState(null);
  const [submissionModalLoading, setSubmissionModalLoading] = useState(false);
  const [submissionDetail, setSubmissionDetail] = useState(null);

  // Computed metrics for active class & coins
  const [coinSelectedGrade, setCoinSelectedGrade] = useState('9-A');
  const [classStudents, setClassStudents] = useState([]);
  const [coinAmount, setCoinAmount] = useState(5);
  const [coinReason, setCoinReason] = useState(() =>
    (localStorage.getItem('diamond_lang') || 'uz') === 'ru'
      ? 'За образцовую активность на уроке'
      : 'Darsdagi namunali faollik uchun'
  );
  useEffect(() => {
    setCoinReason((prev) => {
      if (language === 'ru' && prev === 'Darsdagi namunali faollik uchun') {
        return 'За образцовую активность на уроке';
      }
      if (language !== 'ru' && prev === 'За образцовую активность на уроке') {
        return 'Darsdagi namunali faollik uchun';
      }
      return prev;
    });
  }, [language]);
  const [selectedStudentForCoin, setSelectedStudentForCoin] = useState('');
  const [coinHistory, setCoinHistory] = useState([]);
  const [coinHistorySearch, setCoinHistorySearch] = useState('');
  const [coinHistoryGradeFilter, setCoinHistoryGradeFilter] = useState('all');
  const [loadingCoins, setLoadingCoins] = useState(false);
  const [editingCoinTx, setEditingCoinTx] = useState(null);
  const [editCoinAmount, setEditCoinAmount] = useState(1);
  const [editCoinReason, setEditCoinReason] = useState('');
  const [savingEditCoin, setSavingEditCoin] = useState(false);

  const isTeacher = user && (user.role === 'teacher' || user.role === 'admin');
  // Teacher Portal har doim o'qituvchi qoidalari asosida ishlaydi (har bir sinf uchun kuniga max 5 coin, faqat dars faolligi)
  const isTeacherRestricted = true;
  const maxCoinsPerDay = Math.min(5, Math.max(1, Number(dailyCoinStatus?.maxCoinsPerDay ?? 5)));
  const perClassStatusMap = dailyCoinStatus?.perClassStatus || {};
  const awardedClassesToday = Array.isArray(dailyCoinStatus?.awardedClassesToday)
    ? dailyCoinStatus.awardedClassesToday
    : [];
  const totalCoinsUsedAllClassesToday = Math.max(
    0,
    Number(dailyCoinStatus?.totalCoinsUsedAllClassesToday ?? 0)
  );
  const selectedClassDailyInfo =
    coinSelectedGrade && perClassStatusMap[coinSelectedGrade]
      ? perClassStatusMap[coinSelectedGrade]
      : dailyCoinStatus?.isPerClassLimit
      ? {
          coinsUsedToday: 0,
          coinsRemainingToday: maxCoinsPerDay,
          canAwardToday: true,
        }
      : dailyCoinStatus?.selectedClass === coinSelectedGrade
      ? dailyCoinStatus
      : {
          coinsUsedToday: 0,
          coinsRemainingToday: maxCoinsPerDay,
          canAwardToday: true,
        };
  const coinsUsedToday = Math.max(0, Number(selectedClassDailyInfo?.coinsUsedToday ?? 0));
  const coinsRemainingToday = Math.max(
    0,
    Math.min(maxCoinsPerDay, Number(selectedClassDailyInfo?.coinsRemainingToday ?? (maxCoinsPerDay - coinsUsedToday)))
  );
  const canAwardToSelectedClass = coinsRemainingToday > 0;

  // Keep selected amounts within remaining teacher daily cap (never > 5)
  useEffect(() => {
    const cap = coinsRemainingToday > 0 ? Math.min(maxCoinsPerDay, coinsRemainingToday) : maxCoinsPerDay;
    if (Number(coinAmount) > cap) {
      setCoinAmount(cap);
    }
  }, [coinsRemainingToday, maxCoinsPerDay]);

  // Computed metrics for active class & coins
  const classStudentsList = useMemo(() => (Array.isArray(classStudents) ? classStudents : []), [classStudents]);
  const classTotalCoins = useMemo(() => classStudentsList.reduce((acc, s) => acc + (Number(s.coins) || 0), 0), [classStudentsList]);
  const classTopStudent = useMemo(() => {
    if (!classStudentsList.length) return null;
    return [...classStudentsList].sort((a, b) => (Number(b.coins) || 0) - (Number(a.coins) || 0))[0];
  }, [classStudentsList]);
  const classAvgCoins = useMemo(() => {
    return classStudentsList.length ? Math.round(classTotalCoins / classStudentsList.length) : 0;
  }, [classStudentsList, classTotalCoins]);

  // Populated vs empty classes from backend metadata
  const populatedClasses = useMemo(
    () => (Array.isArray(classesMeta) ? classesMeta.filter((c) => Number(c.studentsCount) > 0) : []),
    [classesMeta]
  );
  const emptyClasses = useMemo(
    () => (Array.isArray(classesMeta) ? classesMeta.filter((c) => Number(c.studentsCount) === 0) : []),
    [classesMeta]
  );

  // Filtered coin history
  const filteredCoinHistory = useMemo(() => {
    let list = Array.isArray(coinHistory) ? coinHistory : [];
    if (coinHistoryGradeFilter && coinHistoryGradeFilter !== 'all') {
      list = list.filter((tx) => (tx.grade || '') === coinHistoryGradeFilter);
    }
    if (!coinHistorySearch.trim()) return list;
    const q = coinHistorySearch.toLowerCase();
    return list.filter((tx) =>
      (tx.student_name || tx.studentName || '').toLowerCase().includes(q) ||
      (tx.reason || '').toLowerCase().includes(q) ||
      (tx.grade || '').toLowerCase().includes(q) ||
      (tx.category || '').toLowerCase().includes(q)
    );
  }, [coinHistory, coinHistoryGradeFilter, coinHistorySearch]);

  // Results participants filtered by class
  const participantClassOptions = useMemo(() => {
    const list = Array.isArray(participantsList) ? participantsList : [];
    const countMap = {};
    list.forEach((p) => {
      const g = (p.grade || '').trim();
      if (g && g !== '-') countMap[g] = (countMap[g] || 0) + 1;
    });
    return Object.entries(countMap).map(([name, count]) => ({ name, count }));
  }, [participantsList]);

  const filteredParticipants = useMemo(() => {
    const list = Array.isArray(participantsList) ? participantsList : [];
    if (!resultsClassFilter || resultsClassFilter === 'all') return list;
    return list.filter((p) => (p.grade || '').trim().toLowerCase() === resultsClassFilter.toLowerCase());
  }, [participantsList, resultsClassFilter]);

  // Computed metrics for active test results (recomputed cleanly for filtered class)
  const calculatedTestStats = useMemo(() => {
    const list = filteredParticipants;
    if (!list.length) {
      return { total: 0, uniqueCount: 0, avg: 0, max: 0, coins: 0, passedCount: 0, passRate: 0 };
    }
    const total = list.length;
    const uniqueCount = new Set(list.map((p) => p.studentId).filter(Boolean)).size || total;
    const sumScore = list.reduce((acc, p) => acc + (Number(p.score ?? p.score_percentage) || 0), 0);
    const avg = Math.round(sumScore / total);
    const max = Math.max(...list.map((p) => Number(p.score ?? p.score_percentage) || 0));
    const coins = list.reduce((acc, p) => acc + (Number(p.alreadyAwardedCoins) || 0), 0);
    const passedCount = list.filter((p) => (Number(p.score ?? p.score_percentage) || 0) >= 60).length;
    const passRate = Math.round((passedCount / total) * 100);
    return { total, uniqueCount, avg, max, coins, passedCount, passRate };
  }, [filteredParticipants]);

  const filteredDistribution = useMemo(() => {
    const dist = { excellent: 0, good: 0, fair: 0, poor: 0 };
    filteredParticipants.forEach((p) => {
      const s = Number(p.score ?? p.score_percentage) || 0;
      if (s >= 85) dist.excellent += 1;
      else if (s >= 70) dist.good += 1;
      else if (s >= 50) dist.fair += 1;
      else dist.poor += 1;
    });
    return dist;
  }, [filteredParticipants]);

  const resultsClassChartItems = useMemo(() => {
    if (Array.isArray(testResultsMeta?.classComparison) && testResultsMeta.classComparison.length) {
      return testResultsMeta.classComparison.map((c) => ({
        key: c.className,
        label: localizeGrade(c.className, language),
        sublabel: `${c.submissions} ${tr('natija', 'рез.')}`,
        value: c.avgScore,
        detail: `${localizeGrade(c.className, language)} ${tr('sinfi', 'класс')} • ${tr("O'rtacha", 'Средний')} ${c.avgScore}% • ${tr("O'tish", 'Проходной')} ${c.passRate}% • ${c.uniqueStudents} ${tr("o'quvchi", 'уч.')}`,
      }));
    }
    const grouped = {};
    (Array.isArray(participantsList) ? participantsList : []).forEach((p) => {
      const cls = (p.grade || 'Belgilanmagan').trim() || 'Belgilanmagan';
      if (!grouped[cls]) grouped[cls] = [];
      grouped[cls].push(Number(p.score ?? p.score_percentage) || 0);
    });
    return Object.entries(grouped).map(([cls, scores]) => {
      const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      return {
        key: cls,
        label: localizeGrade(cls, language),
        sublabel: `${scores.length} ${tr('natija', 'рез.')}`,
        value: avg,
        detail: `${localizeGrade(cls, language)} ${tr('sinfi', 'класс')} • ${tr("O'rtacha", 'Средний')} ${avg}% (${scores.length} ${tr('natija', 'рез.')})`,
      };
    });
  }, [testResultsMeta, participantsList, language, tr]);

  const resultsStudentChartItems = useMemo(() => {
    return filteredParticipants.map((p, idx) => {
      const fullName = (p.student_name || p.fullName || tr(`O'quvchi ${idx + 1}`, `Ученик ${idx + 1}`)).trim();
      const firstPart = fullName.split(/\s+/)[0] || fullName;
      const attemptBadge = Number(p.totalStudentAttempts) > 1 ? ` (${p.attemptNumber}-${tr('ur.', 'поп.')})` : '';
      const score = Number(p.score ?? p.score_percentage) || 0;
      return {
        key: String(p.resultId || `${p.studentId}-${idx}`),
        label: `${firstPart}${attemptBadge}`,
        sublabel: p.grade && p.grade !== '-' ? localizeGrade(p.grade, language) : '',
        value: score,
        detail: `${fullName} (${p.grade ? localizeGrade(p.grade, language) : '-'}${attemptBadge}) • ${score}% (${p.correctAnswers ?? p.correctCount ?? 0}/${p.totalQuestions ?? p.totalCount ?? 0}) • ${p.timeStr || p.time_spent_display || ''}`,
      };
    });
  }, [filteredParticipants, language, tr]);

  const activeResultsQuestionStats = useMemo(() => {
    if (
      resultsClassFilter &&
      resultsClassFilter !== 'all' &&
      testResultsMeta?.questionStatsByClass &&
      Array.isArray(testResultsMeta.questionStatsByClass[resultsClassFilter])
    ) {
      return testResultsMeta.questionStatsByClass[resultsClassFilter];
    }
    return Array.isArray(testResultsMeta?.questionStats) ? testResultsMeta.questionStats : [];
  }, [testResultsMeta, resultsClassFilter]);

  // Analytics & per-class statistics memos
  const classStatsList = useMemo(
    () => (Array.isArray(stats?.classStats) ? stats.classStats : []),
    [stats]
  );

  const testBreakdownList = useMemo(
    () => (Array.isArray(stats?.testBreakdown) ? stats.testBreakdown : []),
    [stats]
  );

  const weakQuestionsList = useMemo(
    () => (Array.isArray(stats?.weakQuestions) ? stats.weakQuestions : []),
    [stats]
  );

  useEffect(() => {
    if (!classStatsList.length) return;
    if (statsSelectedClass && classStatsList.some((c) => c.className === statsSelectedClass)) return;
    const preferred =
      classStatsList.find((c) => c.submissionsCount > 0) ||
      classStatsList.find((c) => c.studentsCount > 0) ||
      classStatsList[0];
    if (preferred) setStatsSelectedClass(preferred.className);
  }, [classStatsList, statsSelectedClass]);

  useEffect(() => {
    if (!testBreakdownList.length) return;
    if (statsSelectedTestId && testBreakdownList.some((t) => String(t.id) === String(statsSelectedTestId))) return;
    const preferred =
      testBreakdownList.find((t) => t.submissions > 0) ||
      testBreakdownList[0];
    if (preferred) setStatsSelectedTestId(preferred.id);
  }, [testBreakdownList, statsSelectedTestId]);

  const filteredClassStatsList = useMemo(() => {
    return classStatsList.filter((c) => {
      if (statsClassLangFilter !== 'all' && c.language !== statsClassLangFilter) return false;
      if (!statsShowEmptyClasses) {
        return c.studentsCount > 0 || c.submissionsCount > 0 || c.className === statsSelectedClass;
      }
      return true;
    });
  }, [classStatsList, statsClassLangFilter, statsShowEmptyClasses, statsSelectedClass]);

  const selectedClassStat = useMemo(
    () =>
      classStatsList.find((c) => c.className === statsSelectedClass) ||
      filteredClassStatsList[0] ||
      classStatsList[0] ||
      null,
    [classStatsList, filteredClassStatsList, statsSelectedClass]
  );

  const selectedTestStat = useMemo(
    () =>
      testBreakdownList.find((t) => String(t.id) === String(statsSelectedTestId)) ||
      testBreakdownList[0] ||
      null,
    [testBreakdownList, statsSelectedTestId]
  );

  // Load teacher tests and stats (read-only tests loaded from Admin)
  const loadTeacherData = async () => {
    if (!isTeacher) return;
    setLoadingData(true);
    try {
      const targetTeacherParam = user?.role === 'admin' ? adminTeacherFilterId : user?.id;
      const requests = [
        api.teacher.getTests(targetTeacherParam),
        api.teacher.getStats(targetTeacherParam),
        api.auth.meta(),
      ];
      if (user?.role === 'admin') {
        requests.push(api.admin.getTeachers());
      }
      const [testsRes, statsRes, metaRes, adminTchRes] = await Promise.allSettled(requests);

      if (testsRes.status === 'fulfilled') {
        const val = testsRes.value;
        const testList = Array.isArray(val) ? val : (val?.tests || []);
        setTests(testList);
        const viewResultsId = searchParams.get('view_results');
        if (viewResultsId) {
          const targetTest = testList.find((t) => String(t.id) === String(viewResultsId));
          if (targetTest) {
            handleViewResults(targetTest);
          }
        } else {
          const stillExists =
            selectedTestForResults && testList.some((t) => String(t.id) === String(selectedTestForResults.id));
          if (stillExists) {
            setSelectedTestForResults((prev) => testList.find((t) => String(t.id) === String(prev?.id)) || prev);
            api.teacher
              .getTestParticipants(selectedTestForResults.id)
              .then((pRes) => {
                setParticipantsList(pRes?.participants || pRes || []);
                setTestResultsMeta(pRes?.test || null);
                if (pRes?.dailyCoinStatus) setDailyCoinStatus(pRes.dailyCoinStatus);
              })
              .catch(() => {});
          } else {
            const testWithSubs =
              testList.find((t) => (t.submissionsCount || t.submissions_count || 0) > 0) || testList[0] || null;
            setSelectedTestForResults(testWithSubs);
            if (testWithSubs) {
              api.teacher
                .getTestParticipants(testWithSubs.id)
                .then((pRes) => {
                  setParticipantsList(pRes?.participants || pRes || []);
                  setTestResultsMeta(pRes?.test || null);
                  if (pRes?.dailyCoinStatus) setDailyCoinStatus(pRes.dailyCoinStatus);
                })
                .catch(() => {
                  setParticipantsList([]);
                  setTestResultsMeta(null);
                });
            } else {
              setParticipantsList([]);
              setTestResultsMeta(null);
            }
          }
        }
      }
      if (statsRes.status === 'fulfilled') {
        const sVal = statsRes.value || {};
        setStats(sVal);
        if (sVal?.dailyCoinStatus) setDailyCoinStatus(sVal.dailyCoinStatus);
      }
      if (metaRes.status === 'fulfilled') {
        const cls = metaRes.value?.classes || ['5-A', '6-A', '7-A', '8-A', '9-A', '10-A', '11-A'];
        setClassesList(cls);
        if (Array.isArray(metaRes.value?.classesMeta)) {
          setClassesMeta(metaRes.value.classesMeta);
        }
        if (Array.isArray(metaRes.value?.subjects) && metaRes.value.subjects.length) {
          setSubjectsList(metaRes.value.subjects);
        }
      }
      if (adminTchRes && adminTchRes.status === 'fulfilled') {
        const tv = adminTchRes.value;
        setAdminTeachersList(Array.isArray(tv) ? tv : (tv?.teachers || []));
      }
    } catch (err) {
      console.error('Error loading teacher data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (isTeacher) {
      loadTeacherData();
    }
  }, [isTeacher, user?.id, adminTeacherFilterId, language]);

  // Keep teacher profile form synchronized with logged-in user
  useEffect(() => {
    if (user) {
      setProfileForm({
        fullName: user.fullName || '',
        username: user.username || '',
        subject: user.subject || 'Matematika',
        phone: user.phone || '',
        bio: user.bio || '',
      });
      setProfileAvatarPreview(user.avatarUrl || '');
      setProfileAvatarFile(null);
      setProfileClearAvatar(false);
    }
  }, [user]);

  const handleProfileAvatarSelect = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast(tr('Faqat rasm fayllarini yuklash mumkin!', 'Разрешается загружать только изображения!'), 'warning');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast(tr('Rasm hajmi 5MB dan oshmasligi kerak!', 'Размер изображения не должен превышать 5 МБ!'), 'warning');
      return;
    }
    setProfileAvatarFile(file);
    setProfileClearAvatar(false);
    const reader = new FileReader();
    reader.onload = (ev) => setProfileAvatarPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleProfileAvatarClear = () => {
    setProfileAvatarFile(null);
    setProfileClearAvatar(true);
    const seed = (profileForm.fullName || user?.username || 'U').slice(0, 2).toUpperCase();
    setProfileAvatarPreview(
      `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed)}&backgroundColor=0284c7&textColor=ffffff`
    );
  };

  const handleSaveProfileInfo = async (e) => {
    e.preventDefault();
    if (!profileForm.fullName.trim() || !profileForm.username.trim()) {
      showToast(tr("Ism-familiya va login kiritilishi shart!", 'ФИО и логин обязательны для заполнения!'), 'warning');
      return;
    }
    setSavingProfileInfo(true);
    try {
      const fd = new FormData();
      fd.append('fullName', profileForm.fullName.trim());
      fd.append('username', profileForm.username.trim());
      fd.append('phone', profileForm.phone.trim());
      fd.append('bio', profileForm.bio.trim());
      if (user?.role === 'teacher' && profileForm.subject) {
        fd.append('subject', profileForm.subject);
      }
      if (profileClearAvatar) {
        fd.append('clearAvatar', 'true');
      }
      if (profileAvatarFile) {
        fd.append('avatar', profileAvatarFile);
      }
      await updateProfile(fd);
      showToast(tr("Profil ma'lumotlari va rasm muvaffaqiyatli saqlandi!", 'Данные профиля и фото успешно сохранены!'), 'success');
      setProfileAvatarFile(null);
      setProfileClearAvatar(false);
      loadTeacherData();
    } catch (err) {
      showToast(err.message || tr("Profilni saqlashda xatolik!", 'Ошибка при сохранении профиля!'), 'error');
    } finally {
      setSavingProfileInfo(false);
    }
  };

  const handleUpdateProfilePassword = async (e) => {
    e.preventDefault();
    const { oldPassword, newPassword, confirmPassword } = passwordForm;
    if (user?.role !== 'admin' && !oldPassword.trim()) {
      showToast(tr("Avvalgi (hozirgi) parolni kiriting!", 'Введите текущий пароль!'), 'warning');
      return;
    }
    if (!newPassword.trim() || newPassword.trim().length < 3) {
      showToast(tr("Yangi parol kamida 3 ta belgidan iborat bo'lishi kerak!", 'Новый пароль должен содержать минимум 3 символа!'), 'warning');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast(tr("Yangi parollar mos kelmadi!", 'Новые пароли не совпадают!'), 'error');
      return;
    }
    setSavingPassword(true);
    try {
      const fd = new FormData();
      if (oldPassword.trim()) fd.append('oldPassword', oldPassword.trim());
      fd.append('newPassword', newPassword.trim());
      await updateProfile(fd);
      showToast(tr("Parol muvaffaqiyatli yangilandi!", 'Пароль успешно обновлён!'), 'success');
      setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      showToast(err.message || tr("Parolni yangilashda xatolik!", 'Ошибка при обновлении пароля!'), 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  // Sync URL query parameters (block 'create', map to 'tests', support 'results'/'coins'/'view_results')
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    const viewResultsId = searchParams.get('view_results');
    if (viewResultsId) {
      const target = tests.find((t) => String(t.id) === String(viewResultsId));
      if (target) handleViewResults(target);
      else setActiveTab('results');
      return;
    }
    if (tabParam && TEACHER_VALID_TABS.includes(tabParam)) {
      setActiveTab(tabParam);
    } else if (tabParam === 'create') {
      setActiveTab('tests');
    }
  }, [searchParams]);

  const handleSelectCoinGrade = (grade, isManual = true) => {
    if (!grade) return;
    if (isManual) hasManualGradePickRef.current = true;
    setSelectedStudentForCoin('');
    setCoinSelectedGrade(grade);
  };

  // Auto-select populated class on initial visit if current selection has 0 students
  useEffect(() => {
    if (!isTeacher || activeTab !== 'coins' || hasManualGradePickRef.current) return;
    if (classesMeta.length > 0) {
      const currentMeta = classesMeta.find((c) => c.name === coinSelectedGrade);
      if (!currentMeta || Number(currentMeta.studentsCount) === 0) {
        const preferred =
          classesMeta.find((c) => c.name === '9-A' && Number(c.studentsCount) > 0) ||
          classesMeta.find((c) => Number(c.studentsCount) > 0);
        if (preferred && preferred.name !== coinSelectedGrade) {
          setCoinSelectedGrade(preferred.name);
        }
      }
    }
  }, [isTeacher, activeTab, classesMeta, coinSelectedGrade]);

  const refreshCoinTabData = async (grade = coinSelectedGrade) => {
    if (!grade) return;
    const [clsRes, historyRes] = await Promise.all([
      api.teacher.getClassStudents(grade),
      api.teacher.getCoinHistory(user?.id, grade),
    ]);
    setClassStudents(Array.isArray(clsRes?.students) ? clsRes.students : (Array.isArray(clsRes) ? clsRes : []));
    if (Array.isArray(clsRes?.classesMeta)) setClassesMeta(clsRes.classesMeta);
    if (clsRes?.dailyCoinStatus) setDailyCoinStatus(clsRes.dailyCoinStatus);
    setCoinHistory(Array.isArray(historyRes?.history) ? historyRes.history : (Array.isArray(historyRes) ? historyRes : []));
    if (historyRes?.dailyCoinStatus) setDailyCoinStatus(historyRes.dailyCoinStatus);
  };

  // Load students for coin distribution when grade changes
  useEffect(() => {
    if (isTeacher && activeTab === 'coins' && coinSelectedGrade) {
      async function loadClassStudents() {
        setLoadingCoins(true);
        try {
          await refreshCoinTabData(coinSelectedGrade);
        } catch (err) {
          console.error(err);
          setClassStudents([]);
          setCoinHistory([]);
        } finally {
          setLoadingCoins(false);
        }
      }
      loadClassStudents();
    }
  }, [isTeacher, activeTab, coinSelectedGrade, user, language]);

  // Handle gate login
  const handleGateLogin = async (e) => {
    e.preventDefault();
    setGateError('');
    setGateLoading(true);
    try {
      const loggedUser = await login(gateUsername, gatePassword, 'teacher');
      if (loggedUser.role !== 'teacher' && loggedUser.role !== 'admin') {
        setGateError(tr("Ushbu profil o'qituvchi huquqiga ega emas!", 'Этот профиль не имеет прав учителя!'));
        return;
      }
      showToast(tr("O'qituvchi portaliga xush kelibsiz!", 'Добро пожаловать на портал учителя!'), 'success');
    } catch (err) {
      setGateError(err.message || tr('Login yoki parol xato!', 'Неверный логин или пароль!'));
    } finally {
      setGateLoading(false);
    }
  };

  // View Test Results
  const handleViewResults = async (testItem, gradeFilter = 'all') => {
    setSelectedTestForResults(testItem);
    setResultsClassFilter(gradeFilter || 'all');
    setActiveTab('results');
    setLoadingResults(true);
    try {
      const res = await api.teacher.getTestParticipants(testItem.id);
      setParticipantsList(res?.participants || res || []);
      setTestResultsMeta(res?.test || null);
      if (res?.dailyCoinStatus) setDailyCoinStatus(res.dailyCoinStatus);
    } catch (err) {
      console.error(err);
      setParticipantsList([]);
      setTestResultsMeta(null);
    } finally {
      setLoadingResults(false);
    }
  };

  const checkTeacherLessonReason = (reasonText) => {
    if (!isTeacherRestricted) return true;
    const trimmed = (reasonText || '').trim();
    if (!trimmed) {
      showToast(tr("Darsdagi faollik sababi kiritilishi shart!", 'Укажите причину активности на уроке!'), 'warning');
      return false;
    }
    if (TEACHER_NON_LESSON_REASON_RE.test(trimmed)) {
      showToast(
        tr(
          "Cheklov: O'qituvchi faqat darsdagi faollik (qatnashish, doskaga chiqish, savol-javob) uchun coin berishi mumkin! Test yoki boshqa holatlar taqiqlangan.",
          'Ограничение: учитель может начислять койны только за активность на уроке (участие, выход к доске, опрос)! Начисление за тесты или домашние задания запрещено.'
        ),
        'warning'
      );
      return false;
    }
    return true;
  };

  // Validate per-class teacher daily limit locally before API call (backend enforces strictly too)
  const checkTeacherDailyCap = (targetGrade, amt) => {
    if (!isTeacherRestricted) return true;
    const numericAmt = Number(amt) || 0;
    const clsName = (targetGrade || coinSelectedGrade || '').trim();
    const clsRemaining =
      clsName && perClassStatusMap[clsName]
        ? Math.max(0, Number(perClassStatusMap[clsName].coinsRemainingToday ?? 0))
        : coinsRemainingToday;

    if (numericAmt <= 0 || numericAmt > maxCoinsPerDay) {
      showToast(
        tr(
          `O'qituvchi har bir sinf uchun kuniga ko'pi bilan ${maxCoinsPerDay} ta coin berishi mumkin!`,
          `Учитель может выдать не более ${maxCoinsPerDay} койнов в день для каждого класса!`
        ),
        'warning'
      );
      return false;
    }
    if (clsRemaining <= 0) {
      showToast(
        tr(
          `Bugun '${clsName}' sinfi uchun kunlik ${maxCoinsPerDay} coin limiti to'liq ishlatilgan. Boshqa sinfga berishingiz mumkin!`,
          `Сегодня дневной лимит (${maxCoinsPerDay} койнов) для класса '${clsName}' исчерпан. Вы можете выбрать другой класс!`
        ),
        'warning'
      );
      return false;
    }
    if (numericAmt > clsRemaining) {
      showToast(
        tr(
          `Bugun '${clsName}' sinfiga yana ko'pi bilan ${clsRemaining} coin berishingiz mumkin!`,
          `Сегодня классу '${clsName}' можно выдать ещё не более ${clsRemaining} койнов!`
        ),
        'warning'
      );
      return false;
    }
    return true;
  };

  // Open detailed submission modal
  const handleOpenSubmissionDetail = async (p) => {
    setViewingSubmission(p);
    setSubmissionDetail(null);
    setSubmissionModalLoading(true);
    try {
      const res = await api.teacher.getResultDetail(p.resultId);
      setSubmissionDetail(res?.result || null);
    } catch (err) {
      console.error(err);
      setSubmissionDetail({
        studentName: p.fullName || p.student_name,
        studentGrade: p.grade,
        score: p.score ?? p.score_percentage,
        timeSpentDisplay: p.timeStr || p.time_spent_display,
        submittedAt: p.date || p.submitted_at,
        coinsAwarded: p.alreadyAwardedCoins || 0,
        breakdown: [],
      });
    } finally {
      setSubmissionModalLoading(false);
    }
  };

  // Award Coins for classroom activity to student or whole class
  const handleAwardCoinToStudent = async (e) => {
    e.preventDefault();
    if (!selectedStudentForCoin) {
      showToast(tr("O'quvchini yoki butun sinfni tanlang!", 'Выберите ученика или весь класс!'), 'warning');
      return;
    }
    const amt = Number(coinAmount);
    if (!amt || amt <= 0) {
      showToast(tr("Coin miqdorini to'g'ri kiriting!", 'Введите корректное количество койнов!'), 'warning');
      return;
    }
    if (!checkTeacherLessonReason(coinReason)) return;
    if (!checkTeacherDailyCap(coinSelectedGrade, amt)) return;

    try {
      if (selectedStudentForCoin === '__ALL__') {
        const res = await api.teacher.awardCoins({
          className: coinSelectedGrade,
          amount: amt,
          reason: `${coinReason.trim()} (${coinSelectedGrade} ${tr('sinf', 'класс')})`,
          activityType: 'lesson_activity',
        });
        if (res?.dailyCoinStatus) setDailyCoinStatus(res.dailyCoinStatus);
        showToast(
          tr(
            `'${coinSelectedGrade}' sinfidagi barcha o'quvchilarga +${amt} coin berildi!`,
            `Всем ученикам класса '${coinSelectedGrade}' начислено +${amt} койнов!`
          ),
          'success'
        );
      } else {
        const res = await api.teacher.awardCoins({
          studentId: selectedStudentForCoin,
          amount: amt,
          reason: coinReason.trim(),
          activityType: 'lesson_activity',
        });
        if (res?.dailyCoinStatus) setDailyCoinStatus(res.dailyCoinStatus);
        showToast(tr(`+${amt} coin muvaffaqiyatli berildi!`, `+${amt} койнов успешно начислено!`), 'success');
      }
      setSelectedStudentForCoin('');
      await refreshCoinTabData(coinSelectedGrade);
    } catch (err) {
      showToast(err.message || tr('Coin berishda xatolik!', 'Ошибка при начислении койнов!'), 'error');
    }
  };

  // Quick 1-click Award for entire selected class (5 coins, lesson activity only)
  const handleQuickAwardWholeClass = async () => {
    const amt = Math.min(5, coinsRemainingToday || 5);
    const reasonStr = (coinReason || tr('Darsdagi faollik', 'Активность на уроке')).trim();
    if (!checkTeacherLessonReason(reasonStr)) return;
    if (!checkTeacherDailyCap(coinSelectedGrade, amt)) return;
    try {
      const res = await api.teacher.awardCoins({
        className: coinSelectedGrade,
        amount: amt,
        reason: `${reasonStr} (${coinSelectedGrade} ${tr('sinf', 'класс')})`,
        activityType: 'lesson_activity',
      });
      if (res?.dailyCoinStatus) setDailyCoinStatus(res.dailyCoinStatus);
      showToast(
        tr(
          `'${coinSelectedGrade}' sinfiga kunlik +${amt} coin muvaffaqiyatli berildi!`,
          `Классу '${coinSelectedGrade}' успешно начислено +${amt} койнов!`
        ),
        'success'
      );
      await refreshCoinTabData(coinSelectedGrade);
    } catch (err) {
      showToast(err.message || tr('Xatolik!', 'Ошибка!'), 'error');
    }
  };

  // Quick Award direct to student from class card (lesson activity only)
  const handleQuickAward = async (student, amt, reasonText) => {
    const targetGrade = student.grade || coinSelectedGrade;
    const effectiveReason = (reasonText || tr(`Darsdagi faollik uchun (+${amt} coin)`, `За активность на уроке (+${amt} койнов)`)).trim();
    if (!checkTeacherLessonReason(effectiveReason)) return;
    if (!checkTeacherDailyCap(targetGrade, amt)) return;
    try {
      const res = await api.teacher.awardCoins({
        studentId: student.id,
        amount: amt,
        reason: effectiveReason,
        activityType: 'lesson_activity',
      });
      if (res?.dailyCoinStatus) setDailyCoinStatus(res.dailyCoinStatus);
      showToast(
        tr(
          `${student.fullName || student.full_name} ga +${amt} coin berildi!`,
          `${student.fullName || student.full_name}: начислено +${amt} койнов!`
        ),
        'success'
      );
      await refreshCoinTabData(coinSelectedGrade);
    } catch (err) {
      showToast(err.message || tr('Xatolik!', 'Ошибка!'), 'error');
    }
  };

  // Open / Save Edit Coin Transaction Modal
  const handleOpenEditCoinTx = (tx) => {
    if (isTeacherRestricted && !tx.isClassroom) {
      showToast(
        tr(
          "O'qituvchi faqat darsdagi faollik uchun berilgan coinlarni tahrirlashi mumkin!",
          'Учитель может редактировать только койны, выданные за активность на уроке!'
        ),
        'warning'
      );
      return;
    }
    setEditingCoinTx(tx);
    setEditCoinAmount(Math.max(1, Number(tx.amount) || 1));
    setEditCoinReason(tx.reason || '');
  };

  const handleSaveEditCoinTx = async (e) => {
    e.preventDefault();
    if (!editingCoinTx) return;
    const amt = Number(editCoinAmount);
    const trimmedReason = editCoinReason.trim();
    if (!amt || amt <= 0) {
      showToast(tr("Coin miqdori musbat son bo'lishi shart!", 'Количество койнов должно быть положительным числом!'), 'warning');
      return;
    }
    if (amt > maxCoinsPerDay) {
      showToast(tr(`O'qituvchi ko'pi bilan ${maxCoinsPerDay} Coin belgilashi mumkin!`, `Учитель может указать не более ${maxCoinsPerDay} койнов!`), 'warning');
      return;
    }
    if (!checkTeacherLessonReason(trimmedReason)) return;
    setSavingEditCoin(true);
    try {
      const res = await api.teacher.editCoinTx(editingCoinTx.id, {
        amount: amt,
        reason: trimmedReason,
      });
      if (res?.dailyCoinStatus) setDailyCoinStatus(res.dailyCoinStatus);
      showToast(res?.message || tr("Coin tranzaksiyasi muvaffaqiyatli yangilandi!", 'Транзакция койнов успешно обновлена!'), 'success');
      setEditingCoinTx(null);
      await refreshCoinTabData(coinSelectedGrade);
    } catch (err) {
      showToast(err.message || tr("Tranzaksiyani tahrirlashda xatolik!", 'Ошибка при редактировании транзакции!'), 'error');
    } finally {
      setSavingEditCoin(false);
    }
  };

  // Ordered list of classes for test filter + counts per class
  const availableTestClasses = useMemo(() => {
    const ordered = [];
    const seen = new Set();
    const addCls = (name) => {
      const clean = (name || '').trim();
      if (!clean || clean.toLowerCase() === 'barchasi') return;
      if (!seen.has(clean.toLowerCase())) {
        seen.add(clean.toLowerCase());
        ordered.push(clean);
      }
    };
    (Array.isArray(classesMeta) ? classesMeta : []).forEach((c) => addCls(c.name));
    (Array.isArray(classesList) ? classesList : []).forEach(addCls);
    (Array.isArray(tests) ? tests : []).forEach((t) => {
      if (Array.isArray(t.targetClasses)) t.targetClasses.forEach(addCls);
      else if (t.grade) t.grade.split(',').forEach(addCls);
    });
    return ordered;
  }, [classesMeta, classesList, tests]);

  const testCountByClass = useMemo(() => {
    const counts = {};
    availableTestClasses.forEach((cls) => {
      counts[cls] = (Array.isArray(tests) ? tests : []).filter((t) =>
        testMatchesClassFilter(t, cls, testIncludeAllClasses)
      ).length;
    });
    return counts;
  }, [availableTestClasses, tests, testIncludeAllClasses]);

  // Filtered Tests (search + per-class visibility filter)
  const filteredTests = useMemo(() => {
    const list = Array.isArray(tests) ? tests : [];
    return list.filter((t) => {
      if (!testMatchesClassFilter(t, testClassFilter, testIncludeAllClasses)) return false;
      const q = testSearch.trim().toLowerCase();
      if (!q) return true;
      return (
        t.title?.toLowerCase().includes(q) ||
        t.subject?.toLowerCase().includes(q) ||
        t.grade?.toLowerCase().includes(q) ||
        (t.teacherName || '').toLowerCase().includes(q)
      );
    });
  }, [tests, testSearch, testClassFilter, testIncludeAllClasses]);

  // If not teacher, show Teacher Login Gate
  if (!isTeacher) {
    return (
      <div className="portal-gate-container">
        <div className="login-card teacher-theme">
          <div className="text-center" style={{ marginBottom: '1.75rem' }}>
            <div className="gate-emblem-wrap emblem-teacher">
              <ChalkboardTeacher size={36} />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider mb-2.5" style={{ background: 'rgba(6, 182, 212, 0.15)', border: '1px solid rgba(6, 182, 212, 0.35)', color: '#22d3ee' }}>
              <Lock size={12} /> {tr("O'qituvchi Kabineti", 'Кабинет учителя')}
            </div>
            <h2 className="text-2xl font-black text-white" style={{ fontFamily: 'Cinzel, serif', letterSpacing: '0.5px' }}>
              {tr("O'qituvchi Portali", 'Портал учителя')}
            </h2>
            <p className="text-xs text-slate-400" style={{ marginTop: '0.35rem' }}>
              {tr(
                "Test natijalarini tahlil qilish va o'quvchilarni coin bilan rag'batlantirish uchun hisobingizga kiring.",
                'Войдите в аккаунт для анализа результатов тестов и поощрения учеников койнами.'
              )}
            </p>
          </div>

          {/* Demo credentials helper chip */}
          <div className="demo-creds-box">
            <div className="demo-title">
              <ChalkboardTeacher size={13} style={{ color: '#22d3ee' }} /> {tr('Test uchun ustoz akkauntlari:', 'Демо-аккаунты учителей:')}
            </div>
            <div className="demo-chips-row">
              <button
                type="button"
                className="demo-chip-btn"
                onClick={() => {
                  setGateUsername('anvar_muallim');
                  setGatePassword('123');
                }}
              >
                <span>👨‍🏫 anvar_muallim / 123</span>
              </button>
              <button
                type="button"
                className="demo-chip-btn"
                onClick={() => {
                  setGateUsername('dilnoza_ustoz');
                  setGatePassword('123');
                }}
              >
                <span>👩‍🏫 dilnoza_ustoz / 123</span>
              </button>
            </div>
          </div>

          {gateError && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 mb-4">
              <AlertCircle size={16} /> <span>{gateError}</span>
            </div>
          )}

          <form onSubmit={handleGateLogin} className="space-y-4">
            <div>
              <label className="input-label">{tr("O'qituvchi logini", 'Логин учителя')}</label>
              <div className="input-with-icon">
                <User size={16} className="input-icon" />
                <input
                  type="text"
                  className="clean-input"
                  value={gateUsername}
                  onChange={(e) => setGateUsername(e.target.value)}
                  placeholder="anvar_muallim"
                  required
                />
              </div>
            </div>

            <div>
              <label className="input-label">{tr('Maxfiy parol', 'Пароль')}</label>
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
                  <ChalkboardTeacher size={18} /> {tr('Portalga Kirish', 'Войти в портал')}
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="teacher-portal-wrapper space-y-6 pb-12">
      {/* Header */}
      <div className="dashboard-header flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2.5">
            {user?.role === 'admin' ? (
              <>
                <ShieldCheck className="text-amber-400" size={28} />
                {tr('Testlar va Imtihonlar Nazorati', 'Контроль тестов и экзаменов')}
              </>
            ) : (
              <>
                <ChalkboardTeacher className="text-cyan-400" size={28} />
                {language === 'ru'
                  ? `Портал: ${user?.fullName || 'Учитель'}`
                  : `${user?.fullName || 'Ustoz'} Portali`}
              </>
            )}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            {user?.role === 'admin' ? (
              <span>{tr("Diamond School bo'yicha test natijalari va coinlar nazorati", 'Контроль результатов тестов и койнов в Diamond School')}</span>
            ) : (
              <span>
                {tr('Fan:', 'Предмет:')}{' '}
                <strong className="text-cyan-400">
                  {user?.subject ? localizeSubject(user.subject, language) : tr('Barcha fanlar', 'Все предметы')}
                </strong>{' '}
                • {tr('Test natijalari tahlili va dars faolligi coin jurnali', 'Анализ результатов тестов и журнал койнов за урок')}
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab('coins')}
            title={`${tr(`Har bir sinf uchun kuniga ko'pi bilan ${maxCoinsPerDay} Coin`, `Максимум ${maxCoinsPerDay} койнов в день для каждого класса`)}${awardedClassesToday.length ? ` • ${tr('Bugun', 'Сегодня')} ${awardedClassesToday.length} ${tr('ta sinf', 'кл.')} (${totalCoinsUsedAllClassesToday} ${tr('Coin', 'койнов')})` : ''}`}
            className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all ${
              coinsRemainingToday > 0
                ? 'bg-amber-500/10 border-amber-500/35 text-amber-300 hover:bg-amber-500/20'
                : 'bg-rose-500/10 border-rose-500/35 text-rose-300'
            }`}
          >
            <Coins size={15} />
            <span>
              {coinSelectedGrade}: {coinsUsedToday} / {maxCoinsPerDay} {tr('Coin', 'койнов')}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'profile'
                ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200'
                : 'bg-slate-900/75 border-slate-700 text-slate-300 hover:border-cyan-400/60 hover:text-cyan-300'
            }`}
          >
            <User size={15} />
            <span>{tr('Mening Profilim', 'Мой профиль')}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="admin-kpi-grid">
        <div className="admin-kpi-card">
          <div className="admin-kpi-icon kpi-blue">
            <FileCheck2 size={24} />
          </div>
          <div>
            <div className="admin-kpi-val">{stats.testsCount || tests.length}</div>
            <div className="admin-kpi-label">{tr('Fan Testlari', 'Тесты по предмету')}</div>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-icon kpi-green">
            <Users size={24} />
          </div>
          <div>
            <div className="admin-kpi-val">{stats.submissionsCount || 0}</div>
            <div className="admin-kpi-label">{tr('Jami Urinishlar', 'Всего попыток')}</div>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-icon kpi-amber">
            <TrendingUp size={24} />
          </div>
          <div>
            <div className="admin-kpi-val">{stats.avgScore || 0}%</div>
            <div className="admin-kpi-label">{tr("O'quvchilar O'rtachasi", 'Средний балл учеников')}</div>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-icon kpi-blue">
            <CheckCircle size={24} />
          </div>
          <div>
            <div className="admin-kpi-val">
              {stats.activeTestsCount ?? tests.filter((t) => (t.isActive ?? t.is_active) !== false).length}
            </div>
            <div className="admin-kpi-label">{tr('Faol Testlar', 'Активные тесты')}</div>
          </div>
        </div>
      </div>

      {/* Main Two-Column Portal Layout */}
      <div className="portal-app-layout">
        {/* Sidebar Nav */}
        <aside className="portal-sidebar">
          <div
            className="portal-sidebar-userbox cursor-pointer hover:border-cyan-400/50 transition-all"
            onClick={() => setActiveTab('profile')}
            title={tr('Profil va rasmni tahrirlash', 'Редактировать профиль и фото')}
          >
            {user?.role === 'admin' ? (
              <div
                className="portal-sidebar-avatar"
                style={{
                  background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#000',
                  fontSize: '1.2rem',
                  fontWeight: 900,
                  border: '2px solid #f59e0b',
                }}
              >
                <i className="fa-solid fa-shield-halved"></i>
              </div>
            ) : (
              <img
                src={user?.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${user?.username}&backgroundColor=0873aa`}
                alt="Avatar"
                className="portal-sidebar-avatar"
              />
            )}
            <div className="portal-sidebar-info flex-1 min-w-0">
              <div className="portal-sidebar-name truncate">{localizeUserFullName(user?.fullName, language) || user?.username}</div>
              <div className="portal-sidebar-role truncate" style={{ color: user?.role === 'admin' ? '#f59e0b' : '#38bdf8' }}>
                <i className={user?.role === 'admin' ? "fa-solid fa-key" : "fa-solid fa-chalkboard-user"} style={{ marginRight: '4px' }}></i>
                {user?.role === 'admin'
                  ? tr('Bosh Administrator', 'Главный администратор')
                  : (user?.subject ? localizeSubject(user.subject, language) : tr('Ustoz', 'Учитель'))}
              </div>
            </div>
            <Edit size={14} className="text-slate-400 flex-shrink-0" />
          </div>

          <div className="portal-sidebar-nav-title">
            {user?.role === 'admin' ? tr("BOSHQARUV MENYUSI", 'МЕНЮ УПРАВЛЕНИЯ') : tr("O'QITUVCHI MENYUSI", 'МЕНЮ УЧИТЕЛЯ')}
          </div>
          <nav className="portal-sidebar-nav">
            <button
              type="button"
              className={`portal-nav-btn ${activeTab === 'tests' ? 'active' : ''}`}
              onClick={() => setActiveTab('tests')}
            >
              <div className="portal-nav-icon">
                <FileCheck2 size={18} />
              </div>
              <span className="portal-nav-label">{tr('Fan Testlari', 'Тесты предмета')}</span>
              <span className="portal-nav-badge">{tests.length}</span>
            </button>

            <button
              type="button"
              className={`portal-nav-btn ${activeTab === 'stats' ? 'active' : ''}`}
              onClick={() => setActiveTab('stats')}
            >
              <div className="portal-nav-icon">
                <BarChart2 size={18} />
              </div>
              <span className="portal-nav-label">{tr('Statistika & Sinflar', 'Статистика и классы')}</span>
              <span className="portal-nav-badge">
                {stats.submissionsCount > 0 ? `${stats.avgScore || 0}%` : `${classStatsList.length} ${tr('sinf', 'кл.')}`}
              </span>
            </button>

            <button
              type="button"
              className={`portal-nav-btn ${activeTab === 'results' ? 'active' : ''}`}
              onClick={() => setActiveTab('results')}
            >
              <div className="portal-nav-icon">
                <Users size={18} />
              </div>
              <span className="portal-nav-label">{tr('Natijalar Jurnali', 'Журнал результатов')}</span>
            </button>

            <button
              type="button"
              className={`portal-nav-btn nav-coin ${activeTab === 'coins' ? 'active' : ''}`}
              onClick={() => setActiveTab('coins')}
            >
              <div className="portal-nav-icon">
                <Coins size={18} />
              </div>
              <span className="portal-nav-label">{tr('Dars Faolligi & Coinlar', 'Активность и койны')}</span>
              <span className="portal-nav-badge">
                {isTeacherRestricted ? `${coinsRemainingToday}/${maxCoinsPerDay}` : tr('💎 Coin', '💎 Койны')}
              </span>
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
        </aside>

        {/* Right Content */}
        <main className="portal-main-area">
          {/* TAB 1: TESTS LIST BY CLASS */}
          {activeTab === 'tests' && (
            <div className="space-y-4 animate-fade-in">
              <div className="admin-search-strip flex-col lg:flex-row">
                <div className="flex flex-wrap items-center gap-3 flex-1 w-full">
                  <div className="input-with-icon flex-1 min-w-[210px] max-w-md">
                    <Search size={17} className="input-icon" />
                    <input
                      type="text"
                      className="clean-input text-sm"
                      placeholder={tr("Test nomi, fan yoki sinf bo'yicha qidiruv...", 'Поиск по названию теста, предмету или классу...')}
                      value={testSearch}
                      onChange={(e) => setTestSearch(e.target.value)}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-semibold whitespace-nowrap">{tr("Sinf bo'yicha:", 'По классу:')}</span>
                    <select
                      aria-label={tr("Sinf bo'yicha testlar filtri", 'Фильтр тестов по классу')}
                      className="clean-select text-xs font-semibold w-auto min-w-[170px]"
                      value={testClassFilter}
                      onChange={(e) => setTestClassFilter(e.target.value)}
                    >
                      <option value="all">{tr('Barcha sinflar', 'Все классы')} ({tests.length})</option>
                      {availableTestClasses.map((cls) => (
                        <option key={cls} value={cls}>
                          {cls} {tr('sinf', 'класс')} ({testCountByClass[cls] || 0} {tr('ta test', 'тест.')})
                        </option>
                      ))}
                    </select>
                  </div>

                  {user?.role === 'admin' && adminTeachersList.length > 0 && (
                    <select
                      aria-label={tr("O'qituvchi bo'yicha ko'rish", 'Просмотр по учителю')}
                      className="clean-select text-xs font-semibold w-auto min-w-[170px]"
                      value={adminTeacherFilterId}
                      onChange={(e) => setAdminTeacherFilterId(e.target.value)}
                    >
                      <option value="">{tr('Barcha ustozlar testlari', 'Тесты всех учителей')}</option>
                      <option value="__admin_only__">{tr('Faqat Admin testlari', 'Только тесты админа')}</option>
                      {adminTeachersList.map((tch) => (
                        <option key={tch.id} value={String(tch.id)}>
                          👨‍🏫 {tch.fullName} ({tch.subject ? localizeSubject(tch.subject, language) : tr('Ustoz', 'Учитель')})
                        </option>
                      ))}
                    </select>
                  )}

                  {testClassFilter !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setTestIncludeAllClasses((v) => !v)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all ${
                        testIncludeAllClasses
                          ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                          : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                      }`}
                      title={tr("Barcha sinflar uchun umumiy testlarni ham ko'rsatish yoki yashirish", 'Показать или скрыть общие тесты для всех классов')}
                    >
                      {testIncludeAllClasses
                        ? tr("+ 'Barchasi' testlari ham", "+ общие тесты «Все классы»")
                        : tr(`Faqat ${testClassFilter} testlari`, `Только тесты ${testClassFilter}`)}
                    </button>
                  )}
                </div>

                <div className="text-xs text-slate-400 bg-slate-900/70 border border-slate-800 px-3 py-2 rounded-xl flex items-center gap-2 flex-shrink-0">
                  <ShieldCheck size={14} className="text-cyan-400 flex-shrink-0" />
                  <span>
                    {user?.role === 'teacher'
                      ? tr("Faqat sizga biriktirilgan testlar (faqat ko'rish rejimi)", 'Только назначенные вам тесты (только просмотр)')
                      : tr("Test va savollar administrator tomonidan joylanadi", 'Тесты и вопросы размещаются администратором')}
                  </span>
                </div>
              </div>

              {/* Quick Class Pills Strip */}
              {availableTestClasses.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 px-1">
                  <button
                    type="button"
                    onClick={() => setTestClassFilter('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      testClassFilter === 'all'
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md'
                        : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:border-cyan-500/40'
                    }`}
                  >
                    {tr('Barcha sinflar', 'Все классы')} ({tests.length})
                  </button>
                  {availableTestClasses
                    .filter((cls) => {
                      const hasStudents = classesMeta.some((m) => m.name === cls && Number(m.studentsCount) > 0);
                      const hasSpecificTest = tests.some((t) => !t.isAllClasses && (t.grade || '').toLowerCase().includes(cls.toLowerCase()));
                      return hasStudents || hasSpecificTest || cls === testClassFilter;
                    })
                    .map((cls) => (
                      <button
                        key={cls}
                        type="button"
                        onClick={() => setTestClassFilter(cls)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                          testClassFilter === cls
                            ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md'
                            : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:border-cyan-500/40'
                        }`}
                      >
                        {cls} ({testCountByClass[cls] || 0})
                      </button>
                    ))}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {filteredTests.map((t) => {
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

                  const isActive = Boolean(t.isActive ?? t.is_active);
                  const isStudentAllowed = Boolean(t.isStudentAllowed ?? t.is_student_allowed);
                  const isUpcoming = Boolean(t.isUpcoming);
                  const isExpired = Boolean(t.isExpired);
                  const statusLabel = isActive
                    ? tr('🔓 Ruxsat berilgan', '🔓 Разрешено')
                    : !isStudentAllowed
                    ? tr('🔒 Ruxsatsiz', '🔒 Закрыто')
                    : isUpcoming
                    ? tr('⏳ Kutilmoqda', '⏳ Ожидается')
                    : isExpired
                    ? tr('⏱ Muddati tugagan', '⏱ Срок истёк')
                    : tr('🔒 Yopiq', '🔒 Закрыто');
                  const qCount = t.questionsCount ?? t.questions_count ?? t.questions?.length ?? 0;
                  const sCount = t.submissionsCount ?? t.submissions_count ?? 0;
                  const isAllCls = Boolean(t.isAllClasses) || (t.grade || '').trim().toLowerCase() === 'barchasi';

                  return (
                    <div key={t.id} className="test-card-luxury">
                      <div>
                        {/* Header: Subject Badge + Status */}
                        <div className="test-card-header">
                          <span className={`subject-tag ${subjClass}`}>
                            <BookOpen size={12} /> {localizeSubject(t.subject, language)}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-lg font-extrabold border ${
                                isAllCls
                                  ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/35'
                                  : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/35'
                              }`}
                            >
                              {isAllCls ? tr('🌐 Umumiy', '🌐 Общий') : `🎯 ${localizeGrade(t.grade, language)}`}
                            </span>
                            <span className={isActive ? 'status-pill-active' : 'status-pill-inactive'}>
                              {statusLabel}
                            </span>
                          </div>
                        </div>

                        {/* Title */}
                        <h3 className="test-card-title">{t.title}</h3>

                        {/* Meta Chips Grid */}
                        <div className="test-meta-grid">
                          <div className="test-meta-chip">
                            <Clock size={15} style={{ color: '#38bdf8' }} />
                            <span>{t.duration_minutes || t.durationMinutes || 30} {tr('daqiqa', 'мин.')}</span>
                          </div>
                          <div className="test-meta-chip">
                            <HelpCircle size={15} style={{ color: '#2dd4bf' }} />
                            <span>{qCount} {tr('ta savol', 'вопр.')}</span>
                          </div>
                          <div className="test-meta-chip">
                            <Users size={15} style={{ color: '#a78bfa' }} />
                            <span>
                              {tr('Sinflar:', 'Классы:')}{' '}
                              {localizeGrade(t.grade || t.targetClasses?.join(', ') || 'Barchasi', language)}
                            </span>
                          </div>
                          <div className="test-meta-chip">
                            <TrendingUp size={15} style={{ color: '#fbbf24' }} />
                            <span>{sCount} {tr('ta topshirildi', 'сдач')}</span>
                          </div>
                        </div>
                      </div>

                      {/* Action Bar */}
                      <div className="test-card-actions">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleViewResults(t, testClassFilter !== 'all' ? testClassFilter : 'all')}
                          >
                            <Eye size={15} /> {tr('Natijalar', 'Результаты')} ({sCount})
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm border-cyan-500/30 text-cyan-300 hover:border-cyan-400"
                            onClick={() => {
                              setStatsSelectedTestId(t.id);
                              if (testClassFilter !== 'all') setStatsSelectedClass(testClassFilter);
                              setActiveTab('stats');
                            }}
                          >
                            <BarChart2 size={14} /> {tr('Statistika', 'Статистика')}
                          </button>
                        </div>

                        <span className="text-[11px] text-slate-400 px-2.5 py-1 rounded-lg bg-slate-900/70 border border-slate-800">
                          {t.teacherName || t.teacher_name || tr('Admin', 'Админ')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredTests.length === 0 && (
                <div className="text-center py-12 text-slate-400 text-xs bg-slate-900/40 rounded-2xl border border-slate-800">
                  {testClassFilter !== 'all'
                    ? tr(
                        `${testClassFilter} sinfi uchun tanlangan filtr bo'yicha test topilmadi.`,
                        `Для класса ${testClassFilter} по выбранному фильтру тесты не найдены.`
                      )
                    : tr(
                        "Hozircha fan bo'yicha testlar mavjud emas. Test va savollar administrator tomonidan qo'shiladi.",
                        'Пока тестов по предмету нет. Тесты и вопросы добавляются администратором.'
                      )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: COMPREHENSIVE STATISTICS & PER-CLASS ANALYTICS */}
          {activeTab === 'stats' && (
            <div className="space-y-6 animate-fade-in">
              {/* 1. Overall Test Analytics & Honest Score Distribution */}
              <div className="test-builder-card space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-md">
                      <BarChart2 size={20} />
                    </div>
                    <div>
                      <h3 className="test-builder-header-title text-base sm:text-lg">
                        {tr('Testlar Statistikasi va Sinflar Tahlili', 'Статистика тестов и анализ по классам')}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {tr(
                          "Barcha olingan testlar, sinflar ko'rsatkichlari va savollar bo'yicha kamchiliklar tahlili",
                          'Анализ всех проведённых тестов, показателей классов и проблемных вопросов'
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-xs px-3 py-1.5 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-300 font-semibold">
                    {tr("Qatnashgan o'quvchilar:", 'Участвовали ученики:')}{' '}
                    <strong className="text-cyan-300">{stats.uniqueStudentsTested || 0}</strong> / {stats.totalStudentsCount || 0} {tr('nafar', 'уч.')}
                  </div>
                </div>

                {/* Overall KPI Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="results-kpi-card">
                    <div className="results-kpi-icon bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                      <FileCheck2 size={20} />
                    </div>
                    <div>
                      <div className="text-lg font-black text-white">{stats.submissionsCount || 0} {tr('ta', 'сдач')}</div>
                      <div className="text-[11px] text-slate-400 font-medium">
                        {tr('Jami Topshiriqlar', 'Всего сдач')} ({stats.testsCount || tests.length} {tr('test', 'тест.')})
                      </div>
                    </div>
                  </div>

                  <div className="results-kpi-card">
                    <div className="results-kpi-icon bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      <TrendingUp size={20} />
                    </div>
                    <div>
                      <div className="text-lg font-black text-emerald-400">{stats.avgScore || 0}%</div>
                      <div className="text-[11px] text-slate-400 font-medium">
                        {tr("O'rtacha Ball", 'Средний балл')} ({stats.minScore || 0}% – {stats.maxScore || 0}%)
                      </div>
                    </div>
                  </div>

                  <div className="results-kpi-card">
                    <div className="results-kpi-icon bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      <CheckCircle size={20} />
                    </div>
                    <div>
                      <div className="text-lg font-black text-amber-400">{stats.passRate || 0}%</div>
                      <div className="text-[11px] text-slate-400 font-medium">{tr("O'tish Foizi (60%+)", 'Процент сдачи (60%+)')}</div>
                    </div>
                  </div>

                  <div className="results-kpi-card">
                    <div className="results-kpi-icon bg-rose-500/15 text-rose-400 border border-rose-500/30">
                      <AlertTriangle size={20} />
                    </div>
                    <div>
                      <div className="text-lg font-black text-rose-400">
                        {stats.weakSubmissionsCount || 0} / {weakQuestionsList.length}
                      </div>
                      <div className="text-[11px] text-slate-400 font-medium">{tr('Sust Natija / Qiyin Savol', 'Слабые результаты / Слож. вопр.')}</div>
                    </div>
                  </div>
                </div>

                {/* Visual Diagrams: Score Tiers Donut + Class/Test Comparison Bar Chart */}
                {(() => {
                  const classChartItems = classStatsList
                    .filter((c) => c.submissionsCount > 0 || c.studentsCount > 0)
                    .map((c) => ({
                      key: c.className,
                      label: c.className,
                      sublabel: c.submissionsCount > 0
                        ? `${c.submissionsCount} ${tr('natija', 'рез.')}`
                        : `${c.studentsCount} ${tr('nafar', 'уч.')}`,
                      value: c.avgScore || 0,
                      noData: c.submissionsCount === 0,
                      detail:
                        c.submissionsCount > 0
                          ? `${c.className} ${tr('sinfi', 'класс')} • ${tr("O'rtacha", 'Средний')} ${c.avgScore}% • ${tr('Qatnashish', 'Участие')} ${c.participationRate}% • ${c.submissionsCount} ${tr('urinish', 'поп.')}`
                          : `${c.className} ${tr('sinfi', 'класс')} (${c.studentsCount} ${tr('nafar', 'уч.')}) • ${tr('Hali natija topshirilmagan', 'Результатов пока нет')}`,
                    }));

                  const testChartItems = testBreakdownList.map((tb) => ({
                    key: String(tb.id),
                    label: tb.title,
                    sublabel: `${tb.submissions} ${tr('urinish', 'поп.')}`,
                    value: tb.avgScore || 0,
                    noData: tb.submissions === 0,
                    detail:
                      tb.submissions > 0
                        ? `${tb.title} (${localizeGrade(tb.grade, language)}) • ${tr("O'rtacha", 'Средний')} ${tb.avgScore}% • ${tr("O'tish", 'Сдали')} ${tb.passRate}% • ${tb.submissions} ${tr('ta', 'раз')}`
                        : `${tb.title} (${localizeGrade(tb.grade, language)}) • ${tr('Hali topshirilmagan', 'Пока никто не сдавал')}`,
                  }));

                  const isClassMode = statsOverviewChartMode === 'classes';
                  return (
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                      <div className="xl:col-span-6 min-w-0">
                        <ScoreTierDonutChart
                          distribution={stats.distribution || { excellent: 0, good: 0, fair: 0, poor: 0 }}
                          avgScore={stats.avgScore || 0}
                          title={tr('Natijalar Darajasi Taqsimoti', 'Распределение уровней результатов')}
                          subtitle={
                            stats.submissionsCount > 0
                              ? tr(`Jami ${stats.submissionsCount} ta topshirilgan natija asosida`, `На основе ${stats.submissionsCount} сданных работ`)
                              : tr('Hali natijalar topshirilmagan', 'Результатов пока нет')
                          }
                        />
                      </div>

                      <div className="xl:col-span-6 min-w-0">
                        <VerticalBarDiagram
                          items={isClassMode ? classChartItems : testChartItems}
                          title={
                            isClassMode
                              ? tr("Sinflar Bo'yicha O'rtacha Ko'rsatkich Diagrammasi", 'Диаграмма средних показателей по классам')
                              : tr("Testlar Bo'yicha O'rtacha Natija Diagrammasi", 'Диаграмма средних баллов по тестам')
                          }
                          subtitle={
                            isClassMode
                              ? tr("Ustuncha ustiga bossangiz — pastda o'sha sinf statistikasi ochiladi", 'Нажмите на столбец, чтобы открыть статистику класса ниже')
                              : tr("Ustuncha ustiga bossangiz — pastda o'sha testning savol tahlili ochiladi", 'Нажмите на столбец, чтобы открыть разбор вопросов теста ниже')
                          }
                          selectedKey={isClassMode ? selectedClassStat?.className : String(selectedTestStat?.id || '')}
                          onItemClick={(item) => {
                            if (isClassMode) setStatsSelectedClass(item.key);
                            else setStatsSelectedTestId(Number(item.key));
                          }}
                          emptyText={tr('Diagramma uchun sinflar yoki testlar topilmadi', 'Классы или тесты для диаграммы не найдены')}
                          headerRight={
                            <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
                              <button
                                type="button"
                                onClick={() => setStatsOverviewChartMode('classes')}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                                  isClassMode
                                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                                    : 'text-slate-400 hover:text-white'
                                }`}
                              >
                                {tr('Sinflar', 'Классы')}
                              </button>
                              <button
                                type="button"
                                onClick={() => setStatsOverviewChartMode('tests')}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                                  !isClassMode
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                    : 'text-slate-400 hover:text-white'
                                }`}
                              >
                                {tr('Testlar', 'Тесты')} ({testBreakdownList.length})
                              </button>
                            </div>
                          }
                        />
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* 2. ALL CLASSES OVERVIEW TABLE ("Sinflar Statistikasi") */}
              <div className="test-builder-card space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-2.5">
                    <Layers size={19} className="text-cyan-400" />
                    <div>
                      <h4 className="text-sm sm:text-base font-black text-white">
                        {tr("Sinflar Bo'yicha Umumiy Statistika", 'Общая статистика по классам')} ({filteredClassStatsList.length} {tr('ta sinf', 'кл.')})
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        {tr(
                          "Har bir sinf ustiga bosing — pastda o'sha sinfning batafsil statistikasi, o'quvchilari va kamchiliklari ochiladi",
                          'Нажмите на любой класс — ниже откроется детальная статистика, список учеников и слабые места'
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1 bg-slate-950/70 p-1 rounded-xl border border-slate-800">
                      {[
                        { id: 'all', label: tr('Barcha tillar', 'Все языки') },
                        { id: 'uz', label: tr("🇺🇿 O'zbek", '🇺🇿 Узб') },
                        { id: 'ru', label: tr('🇷🇺 Rus', '🇷🇺 Рус') },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setStatsClassLangFilter(opt.id)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                            statsClassLangFilter === opt.id
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => setStatsShowEmptyClasses((v) => !v)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-colors ${
                        statsShowEmptyClasses
                          ? 'bg-indigo-500/20 border-indigo-400/50 text-indigo-200'
                          : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:border-cyan-400'
                      }`}
                    >
                      {statsShowEmptyClasses
                        ? tr('Faqat faol sinflar', 'Только активные классы')
                        : tr(`Barcha sinflarni ko'rsatish (${classStatsList.length})`, `Показать все классы (${classStatsList.length})`)}
                    </button>
                  </div>
                </div>

                <div className="teacher-tx-table-wrap">
                  <table className="diamond-table diamond-table-compact w-full text-left">
                    <thead>
                      <tr>
                        <th>{tr('Sinf', 'Класс')}</th>
                        <th>{tr("O'quvchilar", 'Ученики')}</th>
                        <th>{tr('Testlar', 'Тесты')}</th>
                        <th>{tr('Topshiriqlar', 'Сдачи')}</th>
                        <th>{tr('Qatnashish %', 'Участие %')}</th>
                        <th>{tr("O'rtacha", 'Средний')}</th>
                        <th>{tr("O'tish (60%+)", 'Сдача (60%+)')}</th>
                        <th>{tr('Kamchiliklar', 'Проблемы')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredClassStatsList.map((cls) => {
                        const isSelected = selectedClassStat?.className === cls.className;
                        const weakAlerts =
                          (cls.lowAvgStudentsCount || 0) +
                          (cls.notTestedStudentsCount || 0) +
                          (cls.weakQuestions?.length || 0);
                        return (
                          <tr
                            key={cls.className}
                            onClick={() => setStatsSelectedClass(cls.className)}
                            className={`cursor-pointer transition-colors ${
                              isSelected ? 'bg-cyan-500/15' : 'hover:bg-slate-800/40'
                            }`}
                          >
                            <td>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-2.5 py-1 rounded-lg text-xs font-black border whitespace-nowrap flex-shrink-0 ${
                                    isSelected
                                      ? 'bg-cyan-500 text-slate-950 border-cyan-300'
                                      : 'bg-slate-900 text-cyan-300 border-slate-700'
                                  }`}
                                >
                                  {cls.className}
                                </span>
                                <span className="text-[10px] text-slate-400 uppercase font-bold">
                                  {cls.language === 'ru' ? 'RU' : 'UZ'}
                                </span>
                              </div>
                            </td>
                            <td className="text-xs font-bold text-white">{cls.studentsCount} {tr('nafar', 'уч.')}</td>
                            <td className="text-xs text-slate-300 font-semibold">{cls.assignedTestsCount} {tr('ta', 'шт.')}</td>
                            <td className="text-xs text-slate-300">
                              <strong className="text-white">{cls.submissionsCount}</strong> {tr('ta', 'раз')} ({cls.uniqueStudentsTested} {tr('nafar', 'уч.')})
                            </td>
                            <td>
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-cyan-400"
                                    style={{ width: `${Math.min(100, cls.participationRate || 0)}%` }}
                                  />
                                </div>
                                <span className="text-xs font-bold text-cyan-300">{cls.participationRate}%</span>
                              </div>
                            </td>
                            <td>
                              <span
                                className={`font-black text-xs ${
                                  cls.submissionsCount === 0
                                    ? 'text-slate-500'
                                    : cls.avgScore >= 75
                                    ? 'text-emerald-400'
                                    : cls.avgScore >= 60
                                    ? 'text-amber-400'
                                    : 'text-rose-400'
                                }`}
                              >
                                {cls.submissionsCount > 0 ? `${cls.avgScore}%` : '—'}
                              </span>
                            </td>
                            <td className="text-xs font-bold text-slate-300">
                              {cls.submissionsCount > 0 ? `${cls.passRate}%` : '—'}
                            </td>
                            <td>
                              {cls.studentsCount === 0 && cls.submissionsCount === 0 ? (
                                <span className="text-[11px] text-slate-500">{tr("O'quvchi yo'q", 'Нет учеников')}</span>
                              ) : weakAlerts > 0 ? (
                                <span className="text-[11px] px-2 py-0.5 rounded-lg bg-rose-500/15 text-rose-300 border border-rose-500/35 font-bold">
                                  {cls.lowAvgStudentsCount > 0 ? `${cls.lowAvgStudentsCount} ${tr('sust', 'слаб.')} ` : ''}
                                  {cls.notTestedStudentsCount > 0 ? `${cls.notTestedStudentsCount} ${tr('topshirmagan', 'не сдавали')}` : ''}
                                  {cls.lowAvgStudentsCount === 0 && cls.notTestedStudentsCount === 0 && cls.weakQuestions?.length > 0
                                    ? `${cls.weakQuestions.length} ${tr('qiyin savol', 'слож. вопр.')}`
                                    : ''}
                                </span>
                              ) : cls.submissionsCount > 0 ? (
                                <span className="text-[11px] px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/35 font-bold">
                                  {tr('✓ Barqaror', '✓ Стабильно')}
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-400">{tr('Hali topshirilmagan', 'Пока не сдавали')}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 3. SELECTED INDIVIDUAL CLASS DRILL-DOWN ("Har bir sinf statistikasi") */}
              {selectedClassStat && (
                <div className="test-builder-card space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center text-amber-300 font-black text-sm">
                        {selectedClassStat.className}
                      </div>
                      <div>
                        <h4 className="text-base font-black text-white">
                          {selectedClassStat.className} {tr('Sinf Statistikasi va Kamchiliklar', '— Статистика класса и слабые места')}
                        </h4>
                        <p className="text-xs text-slate-400">
                          {selectedClassStat.language === 'ru'
                            ? tr('Rus tili', 'Русский язык')
                            : tr("O'zbek tili", 'Узбекский язык')}{' '}
                          • {selectedClassStat.studentsCount} {tr("nafar o'quvchi", 'учеников')} • {selectedClassStat.assignedTestsCount} {tr('ta biriktirilgan test', 'назначенных тестов')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 min-w-0 max-w-full">
                      <span className="text-xs text-slate-400 font-semibold whitespace-nowrap">{tr('Sinfni tanlang:', 'Выберите класс:')}</span>
                      <select
                        aria-label={tr('Statistika uchun sinfni tanlang', 'Выберите класс для статистики')}
                        className="clean-select text-xs font-bold w-full sm:w-auto sm:min-w-[165px] max-w-full"
                        value={selectedClassStat.className}
                        onChange={(e) => setStatsSelectedClass(e.target.value)}
                      >
                        {classStatsList.map((c) => (
                          <option key={c.className} value={c.className}>
                            {c.className} ({c.studentsCount} {tr("o'quvchi", 'уч.')}, {c.submissionsCount} {tr('natija', 'рез.')})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Selected Class KPI cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                      <div className="text-[11px] text-slate-400 font-semibold">{tr("Sinf O'quvchilari", 'Ученики класса')}</div>
                      <div className="text-lg font-black text-white mt-0.5">{selectedClassStat.studentsCount} {tr('nafar', 'уч.')}</div>
                      <div className="text-[10px] text-cyan-400">{tr('Jami coin:', 'Всего койнов:')} {selectedClassStat.totalCoins} 💎</div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                      <div className="text-[11px] text-slate-400 font-semibold">{tr('Qatnashish Darajasi', 'Уровень участия')}</div>
                      <div className="text-lg font-black text-cyan-300 mt-0.5">{selectedClassStat.participationRate}%</div>
                      <div className="text-[10px] text-slate-400">
                        {selectedClassStat.uniqueStudentsTested} {tr('nafar', 'уч.')} / {selectedClassStat.submissionsCount} {tr('urinish', 'поп.')}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                      <div className="text-[11px] text-slate-400 font-semibold">{tr("Sinf O'rtachasi", 'Средний балл')}</div>
                      <div className="text-lg font-black text-emerald-400 mt-0.5">{selectedClassStat.avgScore}%</div>
                      <div className="text-[10px] text-slate-400">
                        {tr('Min', 'Мин')} {selectedClassStat.minScore}% / {tr('Max', 'Макс')} {selectedClassStat.maxScore}%
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                      <div className="text-[11px] text-slate-400 font-semibold">{tr("O'tish Foizi (60%+)", 'Сдача (60%+)')}</div>
                      <div className="text-lg font-black text-amber-400 mt-0.5">{selectedClassStat.passRate}%</div>
                      <div className="text-[10px] text-slate-400">
                        {tr('Sust natijalar:', 'Слабых:')} {selectedClassStat.weakResultsCount} {tr('ta', 'шт.')}
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                      <div className="text-[11px] text-slate-400 font-semibold">{tr('Topshirmagan / Sust', 'Не сдано / Слабо')}</div>
                      <div className="text-lg font-black text-rose-400 mt-0.5">
                        {selectedClassStat.missingAnyAssignedCount || 0} / {selectedClassStat.lowAvgStudentsCount || 0}
                      </div>
                      <div className="text-[10px] text-slate-400">{tr('Chala test / <60% ball', 'Несданные / <60%')}</div>
                    </div>
                  </div>

                  {/* Assigned Tests & Students Roster for Selected Class */}
                  <div className="space-y-5">
                    {/* Top: Tests for this class */}
                    <div className="space-y-3 min-w-0">
                      <div className="text-xs font-black text-cyan-300 uppercase tracking-wider flex items-center justify-between">
                        <span>{selectedClassStat.className} {tr('Sinfiga Tegishli Testlar', '— Тесты этого класса')}</span>
                        <span>{selectedClassStat.assignedTests?.length || 0} {tr('ta', 'шт.')}</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {(selectedClassStat.assignedTests || []).map((at) => (
                          <div
                            key={at.id}
                            className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/90 space-y-2 hover:border-cyan-500/40 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-white leading-snug">{at.title}</div>
                                <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                                  <span>{localizeSubject(at.subject, language)}</span>
                                  <span>•</span>
                                  <span className={at.isAssigned ? 'text-cyan-300 font-bold' : 'text-amber-300'}>
                                    {at.isAllClasses
                                      ? tr('🌐 Umumiy (Barchasi)', '🌐 Общий (Все классы)')
                                      : at.isAssigned
                                      ? `🎯 ${localizeGrade(at.grade, language)}`
                                      : `⚠️ ${tr('Avvalgi urinish', 'Прошлая попытка')} (${localizeGrade(at.grade, language)})`}
                                  </span>
                                </div>
                              </div>
                              <span
                                className={`text-xs font-black px-2 py-0.5 rounded-lg flex-shrink-0 ${
                                  at.submissionsInClass === 0
                                    ? 'bg-slate-800 text-slate-400'
                                    : at.avgScore >= 70
                                    ? 'bg-emerald-500/15 text-emerald-300'
                                    : at.avgScore >= 50
                                    ? 'bg-amber-500/15 text-amber-300'
                                    : 'bg-rose-500/15 text-rose-300'
                                }`}
                              >
                                {at.submissionsInClass > 0 ? `${at.avgScore}%` : tr('0 natija', '0 рез.')}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/70">
                              <span>
                                {tr('Qatnashdi:', 'Сдали:')} <strong className="text-white">{at.uniqueStudentsInClass}</strong> / {at.studentsInClass}
                                {at.notTestedCount > 0 && at.isAssigned ? (
                                  <span className="text-rose-400 ml-1.5">({at.notTestedCount} {tr('topshirmagan', 'не сдавали')})</span>
                                ) : null}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const match = tests.find((item) => item.id === at.id);
                                  if (match) handleViewResults(match, selectedClassStat.className);
                                }}
                                className="text-cyan-400 hover:text-cyan-300 font-bold"
                              >
                                {tr('Natijalar →', 'Результаты →')}
                              </button>
                            </div>
                          </div>
                        ))}

                        {(!selectedClassStat.assignedTests || selectedClassStat.assignedTests.length === 0) && (
                          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 text-center">
                            {tr(`${selectedClassStat.className} sinfiga hali test biriktirilmagan.`, `Классу ${selectedClassStat.className} тесты ещё не назначены.`)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Student Roster & Weaknesses in this class */}
                    <div className="space-y-3 min-w-0">
                      <div className="text-xs font-black text-amber-300 uppercase tracking-wider flex items-center justify-between">
                        <span>{selectedClassStat.className} {tr("Sinf O'quvchilari Holati", '— Успеваемость учеников')}</span>
                        <span>{selectedClassStat.students?.length || 0} {tr('nafar', 'уч.')}</span>
                      </div>

                      {selectedClassStat.students?.some((st) => st.attemptsCount > 0) && (
                        <VerticalBarDiagram
                          items={selectedClassStat.students.map((st) => ({
                            key: String(st.id),
                            label: (st.fullName || '').split(/\s+/)[0] || st.username,
                            sublabel: `${st.testsTakenCount}/${st.assignedTestsCount} ${tr('test', 'тест.')}`,
                            value: st.avgScore || 0,
                            noData: st.attemptsCount === 0,
                            detail:
                              st.attemptsCount > 0
                                ? `${st.fullName} • ${tr("O'rtacha", 'Средний')} ${st.avgScore}% • ${tr('Eng yuqori', 'Макс')} ${st.bestScore}% (${st.attemptsCount} ${tr('urinish', 'поп.')})`
                                : `${st.fullName} • ${tr('Hali test topshirmagan', 'Тест ещё не сдавал')}`,
                          }))}
                          title={tr(`${selectedClassStat.className} Sinfi O'quvchilari O'rtacha Ball Diagrammasi`, `Диаграмма средних баллов учеников (${selectedClassStat.className})`)}
                          subtitle={tr("O'quvchilarning test natijalarini taqqoslash va sust natijalilarni aniqlash", 'Сравнение результатов учеников и выявление отстающих')}
                          testId="class-students-bar-diagram"
                        />
                      )}

                      {selectedClassStat.students?.length > 0 ? (
                        <div className="teacher-tx-table-wrap">
                          <table className="diamond-table diamond-table-compact w-full text-left">
                            <thead>
                              <tr>
                                <th>{tr("O'quvchi", 'Ученик')}</th>
                                <th>{tr('Yechilgan Test', 'Пройдено тестов')}</th>
                                <th>{tr("O'rtacha", 'Средний')}</th>
                                <th>{tr('Eng Yuqori', 'Лучший')}</th>
                                <th>{tr('Holat / Kamchilik', 'Статус')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedClassStat.students.map((st) => (
                                <tr key={st.id}>
                                  <td>
                                    <div className="flex items-center gap-2">
                                      <img
                                        src={st.avatarUrl}
                                        alt=""
                                        className="w-7 h-7 rounded-lg object-cover border border-slate-700"
                                      />
                                      <div>
                                        <div className="text-xs font-bold text-white">{st.fullName}</div>
                                        <div className="text-[10px] text-amber-400 font-semibold">{st.coins} 💎</div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="text-xs text-slate-300">
                                    <strong className="text-white">{st.testsTakenCount}</strong> / {st.assignedTestsCount} {tr('ta', 'шт.')}
                                    <div className="text-[10px] text-slate-500">{st.attemptsCount} {tr('urinish', 'поп.')}</div>
                                  </td>
                                  <td>
                                    <span
                                      className={`text-xs font-black ${
                                        st.attemptsCount === 0
                                          ? 'text-slate-500'
                                          : st.avgScore >= 75
                                          ? 'text-emerald-400'
                                          : st.avgScore >= 60
                                          ? 'text-amber-400'
                                          : 'text-rose-400'
                                      }`}
                                    >
                                      {st.attemptsCount > 0 ? `${st.avgScore}%` : '—'}
                                    </span>
                                  </td>
                                  <td className="text-xs font-bold text-cyan-300">
                                    {st.attemptsCount > 0 ? `${st.bestScore}%` : '—'}
                                  </td>
                                  <td>
                                    {st.status === 'excellent' ? (
                                      <span className="text-[10px] px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/35 font-bold">
                                        {tr("A'lo", 'Отлично')}
                                      </span>
                                    ) : st.status === 'good' ? (
                                      <span className="text-[10px] px-2 py-0.5 rounded-lg bg-cyan-500/15 text-cyan-300 border border-cyan-500/35 font-bold">
                                        {tr('Yaxshi', 'Хорошо')}
                                      </span>
                                    ) : st.status === 'weak' ? (
                                      <span className="text-[10px] px-2 py-0.5 rounded-lg bg-rose-500/15 text-rose-300 border border-rose-500/35 font-bold">
                                        {tr('Sust (<60%)', 'Слабо (<60%)')}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/35 font-bold">
                                        {tr('Topshirmagan', 'Не сдавал')}
                                      </span>
                                    )}
                                    {st.missingAssignedTestsCount > 0 && st.attemptsCount > 0 && (
                                      <div className="text-[10px] text-amber-400 mt-0.5">
                                        +{st.missingAssignedTestsCount} {tr('chala test', 'несданных')}
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="p-6 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 text-center">
                          {tr(
                            `Ushbu ${selectedClassStat.className} sinfida hozircha ro'yxatga olingan o'quvchilar mavjud emas.`,
                            `В классе ${selectedClassStat.className} пока нет зарегистрированных учеников.`
                          )}
                        </div>
                      )}

                      {/* Class-specific Question Weaknesses if StudentAnswer records exist */}
                      {selectedClassStat.weakQuestions?.length > 0 && (
                        <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/25 space-y-2.5">
                          <div className="text-xs font-black text-rose-300 flex items-center gap-1.5">
                            <AlertTriangle size={14} />
                            <span>{selectedClassStat.className} {tr('Sinfida Xato Qilingan / Qiyin Savollar', '— Сложные вопросы в классе')}</span>
                          </div>
                          <div className="space-y-2">
                            {selectedClassStat.weakQuestions.slice(0, 5).map((wq) => (
                              <div
                                key={`${wq.testId}-${wq.questionId}`}
                                className="p-2.5 rounded-lg bg-slate-950/75 border border-slate-800/80 flex items-center justify-between gap-3 text-xs"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="text-[10px] text-slate-400 font-semibold">
                                    {wq.testTitle} • #{wq.order}-{tr('savol', 'вопрос')}
                                  </div>
                                  <div className="text-slate-200 truncate">
                                    <MathRenderer text={wq.text} />
                                  </div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <div className="font-black text-rose-400">{wq.accuracy}% {tr("to'g'ri", 'верно')}</div>
                                  <div className="text-[10px] text-slate-400">
                                    {wq.correctCount}/{wq.totalAnswers} {tr("to'g'ri", 'верно')}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 4. PER-TEST BREAKDOWN & QUESTION WEAKNESSES */}
              {selectedTestStat && (
                <div className="test-builder-card space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                    <div className="flex items-center gap-2.5">
                      <Target size={19} className="text-emerald-400" />
                      <div>
                        <h4 className="text-sm sm:text-base font-black text-white">
                          {tr("Har bir Test va Savollar Bo'yicha Kamchiliklar Tahlili", 'Разбор ошибок по каждому тесту и вопросу')}
                        </h4>
                        <p className="text-[11px] text-slate-400">
                          {tr("Test kesimida sinflar natijasi va har bir savolning to'g'ri yechilish foizi", 'Результаты классов и процент правильных ответов по каждому вопросу')}
                        </p>
                      </div>
                    </div>

                    <select
                      aria-label={tr("Test bo'yicha tahlil", 'Анализ по тесту')}
                      className="clean-select text-xs font-bold w-full sm:w-auto sm:min-w-[230px] max-w-full"
                      value={selectedTestStat.id}
                      onChange={(e) => setStatsSelectedTestId(Number(e.target.value))}
                    >
                      {testBreakdownList.map((tb) => (
                        <option key={tb.id} value={tb.id}>
                          {tb.title} ({tb.submissions} {tr('ta urinish', 'поп.')}, {tb.avgScore}%)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Test Summary Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                      <div className="text-[10px] text-slate-400">{tr('Urinishlar / Qamrov', 'Попытки / Охват')}</div>
                      <div className="text-sm font-black text-white mt-0.5">
                        {selectedTestStat.submissions} {tr('ta', 'шт.')} ({selectedTestStat.completionRate}%)
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                      <div className="text-[10px] text-slate-400">{tr("O'rtacha / Min–Max", 'Средний / Мин–Макс')}</div>
                      <div className="text-sm font-black text-emerald-400 mt-0.5">
                        {selectedTestStat.avgScore}% ({selectedTestStat.minScore}–{selectedTestStat.maxScore}%)
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                      <div className="text-[10px] text-slate-400">{tr("O'tish Foizi (60%+)", 'Проходной (60%+)')}</div>
                      <div className="text-sm font-black text-amber-400 mt-0.5">{selectedTestStat.passRate}%</div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                      <div className="text-[10px] text-slate-400">{tr("O'rtacha Vaqt", 'Среднее время')}</div>
                      <div className="text-sm font-black text-cyan-300 mt-0.5">
                        {Math.floor((selectedTestStat.avgTimeSeconds || 0) / 60)}{tr('m', 'м')} {(selectedTestStat.avgTimeSeconds || 0) % 60}{tr('s', 'с')}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                      <div className="text-[10px] text-slate-400">{tr('Sinflar Qamrovi', 'Классы')}</div>
                      <div className="text-sm font-black text-indigo-300 mt-0.5 truncate" title={localizeGrade(selectedTestStat.grade, language)}>
                        {localizeGrade(selectedTestStat.grade, language)}
                      </div>
                    </div>
                  </div>

                  {/* Test performance by Class + Visual Comparison */}
                  {selectedTestStat.byClass?.length > 0 && (
                    <div className="space-y-3">
                      <VerticalBarDiagram
                        items={selectedTestStat.byClass.map((bc) => ({
                          key: bc.className,
                          label: bc.className,
                          sublabel: `${bc.uniqueStudents}/${bc.studentsInClass} ${tr("o'q.", 'уч.')}`,
                          value: bc.avgScore || 0,
                          noData: bc.submissions === 0,
                          detail:
                            bc.submissions > 0
                              ? `${bc.className} ${tr('sinfi', 'класс')} • ${tr("O'rtacha", 'Средний')} ${bc.avgScore}% • ${tr("O'tish", 'Сдача')} ${bc.passRate}% • ${bc.submissions} ${tr('urinish', 'поп.')}`
                              : `${bc.className} ${tr('sinfi', 'класс')} • ${tr('Hali natija topshirilmagan', 'Результатов пока нет')}`,
                        }))}
                        title={tr('Test Natijalari Sinflar Kesimida Diagramma', 'Диаграмма результатов теста по классам')}
                        subtitle={tr('Ustiga bossangiz — yuqorida shu sinf tafsiloti ochiladi', 'Нажмите на столбец, чтобы открыть детали этого класса выше')}
                        selectedKey={selectedClassStat?.className}
                        onItemClick={(item) => setStatsSelectedClass(item.key)}
                        testId="stats-test-byclass-diagram"
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {selectedTestStat.byClass.map((bc) => (
                          <div
                            key={bc.className}
                            onClick={() => setStatsSelectedClass(bc.className)}
                            className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-cyan-500/40 cursor-pointer flex items-center justify-between gap-2"
                          >
                            <div>
                              <div className="text-xs font-black text-white flex items-center gap-1.5">
                                <span>{bc.className} {tr('sinf', 'класс')}</span>
                                {!bc.isTarget && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">
                                    {tr('Avvalgi urinish', 'Прошлая попытка')}
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {bc.uniqueStudents}/{bc.studentsInClass} {tr("o'quvchi", 'уч.')} • {bc.submissions} {tr('ta urinish', 'поп.')}
                              </div>
                            </div>
                            <div className="text-right">
                              <div
                                className={`text-sm font-black ${
                                  bc.submissions === 0
                                    ? 'text-slate-500'
                                    : bc.avgScore >= 70
                                    ? 'text-emerald-400'
                                    : bc.avgScore >= 50
                                    ? 'text-amber-400'
                                    : 'text-rose-400'
                                }`}
                              >
                                {bc.submissions > 0 ? `${bc.avgScore}%` : '0%'}
                              </div>
                              <div className="text-[10px] text-slate-400">{tr("O'tish:", 'Сдача:')} {bc.passRate}%</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Per-question accuracy & weakness analysis */}
                  <HorizontalAccuracyDiagram
                    questions={selectedTestStat.questionStats || []}
                    title={tr(
                      `Savollar bo'yicha tahlil (${selectedTestStat.questionStats?.length || 0} ta savol)`,
                      `Анализ по вопросам (${selectedTestStat.questionStats?.length || 0} вопр.)`
                    )}
                    subtitle={tr("Past foizli savollar — o'quvchilarning asosiy kamchiliklari", 'Вопросы с низким процентом — основные пробелы учеников')}
                    emptyText={tr('Ushbu testda savollar mavjud emas', 'В этом тесте нет вопросов')}
                  />
                </div>
              )}
            </div>
          )}

          {/* TAB 3: RESULTS / SUBMISSIONS */}
          {activeTab === 'results' && (
            <div className="space-y-6 animate-fade-in">
              {/* 1. Header Banner & Test Selector */}
              <div className="test-builder-card space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-md">
                      <Trophy size={20} />
                    </div>
                    <div>
                      <h3 className="test-builder-header-title text-base sm:text-lg">
                        {selectedTestForResults
                          ? tr(`"${selectedTestForResults.title}" natijalari`, `Результаты: "${selectedTestForResults.title}"`)
                          : tr("O'quvchilar Topshiriqlari Jurnali", 'Журнал сдач учеников')}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {tr("Test natijalari va o'quvchilarning savollar bo'yicha javoblari tahlili", 'Результаты теста и анализ ответов учеников по вопросам')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="text-xs text-slate-400 font-semibold whitespace-nowrap hidden sm:inline">
                      {tr('Testni tanlang:', 'Выберите тест:')}
                    </label>
                    <select
                      className="clean-select text-xs font-semibold w-full sm:w-auto sm:min-w-[220px] max-w-full"
                      value={selectedTestForResults?.id || ''}
                      onChange={(e) => {
                        const t = tests.find((item) => String(item.id) === e.target.value);
                        if (t) handleViewResults(t);
                      }}
                    >
                      <option value="">{tr('-- Testni tanlang --', '-- Выберите тест --')}</option>
                      {tests.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title} ({t.submissionsCount ?? t.submissions_count ?? 0} {tr('ta natija', 'рез.')})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Class Filter Strip for Results Journal */}
                {participantsList.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-slate-400 font-bold mr-1">{tr("Sinf bo'yicha filtr:", 'Фильтр по классу:')}</span>
                    <button
                      type="button"
                      onClick={() => setResultsClassFilter('all')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                        resultsClassFilter === 'all'
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                          : 'bg-slate-900/70 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {tr('Barcha sinflar', 'Все классы')} ({participantsList.length})
                    </button>
                    {participantClassOptions.map((opt) => (
                      <button
                        key={opt.name}
                        type="button"
                        onClick={() => setResultsClassFilter(opt.name)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                          resultsClassFilter === opt.name
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-slate-900/70 text-slate-400 border-slate-800 hover:text-white'
                        }`}
                      >
                        {localizeGrade(opt.name, language)} ({opt.count})
                      </button>
                    ))}
                  </div>
                )}

                {/* 2. KPI Summary Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="results-kpi-card">
                    <div className="results-kpi-icon bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                      <Users size={20} />
                    </div>
                    <div>
                      <div className="text-lg font-black text-white">
                        {calculatedTestStats.uniqueCount} {tr('nafar', 'уч.')}
                      </div>
                      <div className="text-[11px] text-slate-400 font-medium">
                        {calculatedTestStats.total !== calculatedTestStats.uniqueCount
                          ? tr(`Topshirgan (${calculatedTestStats.total} urinish)`, `Сдали (${calculatedTestStats.total} поп.)`)
                          : tr('Jami Topshirganlar', 'Всего сдавших')}
                      </div>
                    </div>
                  </div>

                  <div className="results-kpi-card">
                    <div className="results-kpi-icon bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      <TrendingUp size={20} />
                    </div>
                    <div>
                      <div className="text-lg font-black text-emerald-400">{calculatedTestStats.avg}%</div>
                      <div className="text-[11px] text-slate-400 font-medium">
                        {tr("O'rtacha", 'Средний')} ({tr("O'tish", 'Проходной')}: {calculatedTestStats.passRate || 0}%)
                      </div>
                    </div>
                  </div>

                  <div className="results-kpi-card">
                    <div className="results-kpi-icon bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      <Crown size={20} />
                    </div>
                    <div>
                      <div className="text-lg font-black text-amber-400">{calculatedTestStats.max}%</div>
                      <div className="text-[11px] text-slate-400 font-medium">{tr('Eng Yuqori Natija', 'Лучший результат')}</div>
                    </div>
                  </div>

                  <div className="results-kpi-card">
                    <div className="results-kpi-icon bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                      <Coins size={20} />
                    </div>
                    <div>
                      <div className="text-lg font-black text-indigo-300">
                        {resultsClassFilter !== 'all'
                          ? calculatedTestStats.coins
                          : (testResultsMeta?.totalCoinsAwarded ?? calculatedTestStats.coins)} 💎
                      </div>
                      <div className="text-[11px] text-slate-400 font-medium">{tr('Berilgan Coinlar', 'Выдано койнов')}</div>
                    </div>
                  </div>
                </div>

                {/* 2.5 Visual Charts for Selected Test Results (Natijalar Diagrammalari) */}
                {!loadingResults && selectedTestForResults && (
                  <div className="space-y-4">
                    {(() => {
                      const canShowClassBar = resultsClassFilter === 'all' && resultsClassChartItems.length > 1;
                      const effectiveMode = !canShowClassBar
                        ? 'students'
                        : resultsChartMode === 'auto'
                        ? 'classes'
                        : resultsChartMode;
                      const isClassesMode = effectiveMode === 'classes';

                      return (
                        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                          <div className="xl:col-span-6 min-w-0">
                            <ScoreTierDonutChart
                              distribution={filteredDistribution}
                              avgScore={calculatedTestStats.avg}
                              title={tr('Natijalar Sifat Diagrammasi', 'Диаграмма качества результатов')}
                              subtitle={
                                resultsClassFilter !== 'all'
                                  ? tr(`${resultsClassFilter} sinfi kesimida`, `По классу ${localizeGrade(resultsClassFilter, language)}`)
                                  : tr("Topshiriqlarning darajalar bo'yicha ulushi", 'Распределение сдач по уровням')
                              }
                            />
                          </div>

                          <div className="xl:col-span-6 min-w-0">
                            <VerticalBarDiagram
                              items={isClassesMode ? resultsClassChartItems : resultsStudentChartItems}
                              title={
                                isClassesMode
                                  ? tr("Sinflar Kesimida O'rtacha Natijalar", 'Средние результаты по классам')
                                  : resultsClassFilter !== 'all'
                                  ? tr(`${resultsClassFilter} O'quvchilari Ballari Diagrammasi`, `Баллы учеников ${localizeGrade(resultsClassFilter, language)}`)
                                  : tr("O'quvchilar Natijalari Diagrammasi", 'Диаграмма результатов учеников')
                              }
                              subtitle={
                                isClassesMode
                                  ? tr('Sinf ustiga bossangiz — jadval va diagrammalar shu sinfga filtrlanadi', 'Нажмите на класс — таблица и графики отфильтруются по этому классу')
                                  : tr("Har bir urinishning foiz ko'rsatkichi (60% o'tish chegarasi)", 'Процент каждой попытки (проходной порог 60%)')
                              }
                              selectedKey={isClassesMode ? resultsClassFilter : null}
                              onItemClick={
                                isClassesMode
                                  ? (item) =>
                                      setResultsClassFilter((prev) =>
                                        prev === item.key ? 'all' : item.key
                                      )
                                  : null
                              }
                              emptyText={tr('Tanlangan testda hali natijalar topshirilmagan', 'По выбранному тесту ещё нет результатов')}
                              testId="results-bar-diagram"
                              headerRight={
                                canShowClassBar ? (
                                  <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
                                    <button
                                      type="button"
                                      onClick={() => setResultsChartMode('classes')}
                                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                                        isClassesMode
                                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                                          : 'text-slate-400 hover:text-white'
                                      }`}
                                    >
                                      {tr('Sinflar', 'Классы')} ({resultsClassChartItems.length})
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setResultsChartMode('students')}
                                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                                        !isClassesMode
                                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                          : 'text-slate-400 hover:text-white'
                                      }`}
                                    >
                                      {tr("O'quvchilar", 'Ученики')} ({resultsStudentChartItems.length})
                                    </button>
                                  </div>
                                ) : null
                              }
                            />
                          </div>
                        </div>
                      );
                    })()}

                    {activeResultsQuestionStats.length > 0 && (
                      <HorizontalAccuracyDiagram
                        questions={activeResultsQuestionStats}
                        title={
                          resultsClassFilter !== 'all'
                            ? tr(`${resultsClassFilter} Sinfida Savollar Bo'yicha Tahlil`, `Анализ по вопросам в классе ${localizeGrade(resultsClassFilter, language)}`)
                            : tr("Savollar Bo'yicha O'zlashtirish va Kamchiliklar Diagrammasi", 'Диаграмма успеваемости и пробелов по вопросам')
                        }
                        subtitle={tr("O'quvchilar qaysi savollarda ko'proq xato qilgani va to'g'ri yechish ko'rsatkichi", 'Вопросы с наибольшим числом ошибок и процент правильных ответов')}
                      />
                    )}
                  </div>
                )}

                {/* 3. Classroom-only Coin Rule Notice for Teachers (Test Coin Distribution removed from Teacher Portal) */}
                {isTeacherRestricted && (
                  <div className="results-coin-bar flex-col lg:flex-row">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-cyan-500/15 text-cyan-400 border border-cyan-500/35 flex items-center justify-center flex-shrink-0">
                        <ShieldCheck size={16} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-2 flex-wrap">
                          <span>{tr('Coin Berish Qoidasi', 'Правило начисления койнов')}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-black">
                            {tr(
                              `Faqat darsdagi faollik • Kunlik limit: 1 sinf / ${maxCoinsPerDay} Coin`,
                              `Только активность на уроке • Дневной лимит: 1 класс / ${maxCoinsPerDay} койнов`
                            )}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {tr(
                            'O\'qituvchi test natijalari yoki boshqa holatlar uchun coin bera olmaydi. Faqat darsdagi faollik uchun "Dars Faolligi & Coinlar" bo\'limida coin berishingiz mumkin.',
                            'Учитель не может начислять койны за результаты тестов. Начисление за активность на уроке доступно в разделе «Активность и койны».'
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveTab('coins')}
                      className="btn btn-diamond-cyan btn-xs font-bold whitespace-nowrap flex-shrink-0"
                    >
                      {tr('Dars Faolligi & Coinlar →', 'Активность и койны →')}
                    </button>
                  </div>
                )}
              </div>

              {/* 4. Table of Participants */}
              {loadingResults ? (
                <div className="text-center py-16 text-slate-400 text-xs flex items-center justify-center gap-2">
                  <Loader2 size={20} className="animate-spin text-cyan-400" /> {tr("Natijalar va Coin ma'lumotlari yuklanmoqda...", 'Загрузка результатов и данных о койнах...')}
                </div>
              ) : (
                <div className="teacher-tx-table-wrap">
                  <table className="diamond-table diamond-table-compact w-full text-left">
                    <thead>
                      <tr>
                        <th className="w-14">{tr("O'rin", 'Место')}</th>
                        <th>{tr("O'quvchi", 'Ученик')}</th>
                        <th>{tr('Sinfi', 'Класс')}</th>
                        <th>{tr('Ball / Natija', 'Балл / Результат')}</th>
                        <th>{tr('Sarflangan Vaqt', 'Затрачено времени')}</th>
                        <th>{tr('Berilgan Coin', 'Начислено койнов')}</th>
                        <th className="text-right">{tr('Tahlil', 'Разбор')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredParticipants.map((p, idx) => {
                        const rank = resultsClassFilter === 'all' ? (p.rank || idx + 1) : idx + 1;
                        const score = Number(p.score ?? p.score_percentage) || 0;
                        const coinsAwarded = Number(p.alreadyAwardedCoins) || 0;

                        return (
                          <tr key={p.resultId || p.id || idx}>
                            {/* Rank badge */}
                            <td>
                              {rank === 1 ? (
                                <span className="rank-badge-1">🥇 1</span>
                              ) : rank === 2 ? (
                                <span className="rank-badge-2">🥈 2</span>
                              ) : rank === 3 ? (
                                <span className="rank-badge-3">🥉 3</span>
                              ) : (
                                <span className="rank-badge-default">#{rank}</span>
                              )}
                            </td>

                            {/* Student name & avatar */}
                            <td>
                              <div className="flex items-center gap-2.5">
                                <img
                                  src={
                                    p.avatarUrl ||
                                    `https://api.dicebear.com/7.x/initials/svg?seed=${p.username || p.student_name}&backgroundColor=0284c7`
                                  }
                                  alt=""
                                  className="w-8 h-8 rounded-lg object-cover border border-slate-700 shadow-sm"
                                />
                                <div>
                                  <div className="font-bold text-white text-xs flex items-center gap-1.5 flex-wrap">
                                    <span>{p.student_name || p.fullName}</span>
                                    {Number(p.totalStudentAttempts) > 1 && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-bold">
                                        {p.attemptNumber}{tr('-urinish', '-я попытка')}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-400 flex items-center gap-1">
                                    <span>{tr('Hozirda:', 'Баланс:')}</span>
                                    <strong className="text-amber-400">{p.currentCoins || 0} 💎</strong>
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Class badge */}
                            <td>
                              <span className="tx-class-badge">{localizeGrade(p.grade, language)}</span>
                            </td>

                            {/* Score & Progress */}
                            <td>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`font-black text-xs ${
                                      score >= 70
                                        ? 'text-emerald-400'
                                        : score >= 50
                                        ? 'text-amber-400'
                                        : 'text-rose-400'
                                    }`}
                                  >
                                    {score}%
                                  </span>
                                  <span className="text-[11px] text-slate-400">
                                    ({p.correctAnswers ?? p.correctCount ?? 0} / {p.totalQuestions ?? p.totalCount ?? 10} {tr('ta', '')})
                                  </span>
                                </div>
                                <div className="w-24 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${
                                      score >= 70
                                        ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                                        : score >= 50
                                        ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                                        : 'bg-gradient-to-r from-rose-500 to-pink-500'
                                    }`}
                                    style={{ width: `${Math.min(100, Math.max(5, score))}%` }}
                                  />
                                </div>
                              </div>
                            </td>

                            {/* Time & Date */}
                            <td>
                              <div className="text-xs text-slate-300 font-medium">
                                {p.timeStr || p.time_spent_display || tr('12 daq', '12 мин')}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {p.date || p.submitted_at || tr('Bugun', 'Сегодня')}
                              </div>
                            </td>

                            {/* Coin Award Status */}
                            <td>
                              {coinsAwarded > 0 ? (
                                <span className="tx-amount-badge">
                                  <span>💎</span>
                                  <span>+{coinsAwarded} {tr('Coin', 'Койнов')}</span>
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-500 italic">
                                  {tr('Hali berilmagan', 'Не начислено')}
                                </span>
                              )}
                            </td>

                            {/* Details modal trigger */}
                            <td className="text-right">
                              <button
                                type="button"
                                className="btn btn-secondary btn-xs text-[11px] border-slate-700 hover:border-cyan-400"
                                onClick={() => handleOpenSubmissionDetail(p)}
                              >
                                {tr('Batafsil', 'Подробнее')}
                              </button>
                            </td>
                          </tr>
                        );
                      })}

                      {filteredParticipants.length === 0 && (
                        <tr>
                          <td colSpan={7} className="text-center py-12 text-slate-400 text-xs">
                            <div className="space-y-3 py-4 max-w-sm mx-auto">
                              <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-500 mx-auto">
                                <Users size={22} />
                              </div>
                              <p className="text-slate-300 font-semibold">
                                {resultsClassFilter !== 'all'
                                  ? tr(
                                      `Ushbu testda ${resultsClassFilter} sinfidan natija topilmadi.`,
                                      `В этом тесте нет результатов для класса ${localizeGrade(resultsClassFilter, language)}.`
                                    )
                                  : tr(
                                      "Ushbu test bo'yicha hali o'quvchilar natijalari mavjud emas.",
                                      'По этому тесту ещё нет результатов учеников.'
                                    )}
                              </p>
                              {resultsClassFilter !== 'all' ? (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-xs font-bold"
                                  onClick={() => setResultsClassFilter('all')}
                                >
                                  {tr("Barcha sinflarni ko'rsatish", 'Показать все классы')}
                                </button>
                              ) : (
                                tests.some((t) => (t.submissionsCount ?? t.submissions_count ?? 0) > 0 && t.id !== selectedTestForResults?.id) && (
                                  <button
                                    type="button"
                                    className="btn btn-diamond-cyan btn-xs font-bold"
                                    onClick={() => {
                                      const withSubs = tests.find((t) => (t.submissionsCount ?? t.submissions_count ?? 0) > 0);
                                      if (withSubs) handleViewResults(withSubs);
                                    }}
                                  >
                                    {tr("Natijalari bor testga o'tish →", 'Перейти к тесту с результатами →')}
                                  </button>
                                )
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: COIN DISTRIBUTION */}
          {activeTab === 'coins' && (
            <div className="space-y-6 animate-fade-in">
              {/* 1. Header Banner + Class Selector & Populated Class Chips */}
              <div className="teacher-coins-banner">
                <div className="teacher-coins-banner-top">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="teacher-coins-title-icon">
                      <Coins size={24} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base sm:text-lg font-black text-white" style={{ fontFamily: 'Cinzel, serif', letterSpacing: '0.5px' }}>
                        {tr("Dars Faolligi va Rag'batlantirish Coinlari", 'Койны за активность на уроке и поощрение')}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        {isTeacherRestricted
                          ? tr(
                              "O'quvchilarga faqat darsdagi faol ishtiroki, doskadagi yechimlari va savol-javobdagi faolligi uchun tezkor Diamond Coinlar bering (boshqa holatlarda yopiq)",
                              'Начисляйте ученикам быстрые Diamond-койны только за активность на уроке, ответы у доски и участие в опросах (прочие случаи закрыты)'
                            )
                          : tr(
                              "O'quvchilarga darsdagi faol ishtiroki, namunali javoblari va izlanishlari uchun tezkor Diamond Coinlar bering",
                              'Начисляйте ученикам Diamond-койны за активность на уроке, образцовые ответы и старания'
                            )}
                      </p>
                    </div>
                  </div>

                  <div className="teacher-class-selector-pill">
                    <span className="text-xs text-slate-400 font-bold whitespace-nowrap">{tr('Sinfni tanlang:', 'Выберите класс:')}</span>
                    <select
                      value={coinSelectedGrade}
                      onChange={(e) => handleSelectCoinGrade(e.target.value, true)}
                    >
                      {classesMeta.length > 0 ? (
                        <>
                          {populatedClasses.length > 0 && (
                            <optgroup label={tr("O'quvchilari bor sinflar", 'Классы с учениками')}>
                              {populatedClasses.map((c) => {
                                const clsUsed = perClassStatusMap[c.name]?.coinsUsedToday || 0;
                                return (
                                  <option key={c.name} value={c.name}>
                                    {localizeGrade(c.name, language)} {tr('sinf', 'класс')} ({c.studentsCount} {tr("o'quvchi", 'уч.')}){clsUsed > 0 ? ` • ${clsUsed}/${maxCoinsPerDay} ★` : ''}
                                  </option>
                                );
                              })}
                            </optgroup>
                          )}
                          {emptyClasses.length > 0 && (
                            <optgroup label={tr("Bo'sh sinflar (0 o'quvchi)", 'Пустые классы (0 уч.)')}>
                              {emptyClasses.map((c) => (
                                <option key={c.name} value={c.name}>
                                  {localizeGrade(c.name, language)} {tr('sinf', 'класс')} (0 {tr("o'quvchi", 'уч.')})
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </>
                      ) : (
                        classesList.map((cls) => (
                          <option key={cls} value={cls}>
                            {localizeGrade(cls, language)} {tr('sinf', 'класс')}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </div>

                {populatedClasses.length > 0 && (
                  <div className="teacher-class-chips-bar">
                    <span className="text-[11px] font-bold text-slate-400 mr-1">{tr('Faol sinflar:', 'Активные классы:')}</span>
                    {populatedClasses.map((c) => {
                      const isSelected = coinSelectedGrade === c.name;
                      const clsUsed = perClassStatusMap[c.name]?.coinsUsedToday || 0;
                      const isToday = clsUsed > 0;
                      const isFull = clsUsed >= maxCoinsPerDay;
                      return (
                        <button
                          key={c.name}
                          type="button"
                          onClick={() => handleSelectCoinGrade(c.name, true)}
                          className={`teacher-class-chip ${isSelected ? 'is-selected' : ''} ${isToday ? 'is-today' : ''}`}
                        >
                          <span>{localizeGrade(c.name, language)}</span>
                          <span className="text-[10px] opacity-80">({c.studentsCount})</span>
                          {isToday && (
                            <span className={`text-[10px] font-black ${isFull ? 'text-rose-300' : 'text-amber-300'}`}>
                              {clsUsed}/{maxCoinsPerDay}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 1.5 Teacher Daily Coin Limit Banner (Har bir sinf uchun kuniga max 5 coin) */}
              {isTeacherRestricted && (
                <div
                  className={`teacher-daily-limit-banner ${
                    coinsRemainingToday <= 0
                      ? 'is-exhausted'
                      : ''
                  }`}
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${
                        coinsRemainingToday <= 0
                          ? 'bg-rose-500/15 border-rose-500/35 text-rose-400'
                          : 'bg-cyan-500/15 border-cyan-500/35 text-cyan-400'
                      }`}
                    >
                      {coinsRemainingToday <= 0 ? <Lock size={19} /> : <ShieldCheck size={19} />}
                    </div>
                    <div className="space-y-1 min-w-0">
                      <div className="text-xs sm:text-sm font-black text-white flex items-center gap-2 flex-wrap">
                        <span>{tr(`O'qituvchi Kunlik Coin Limiti (${coinSelectedGrade})`, `Дневной лимит учителя (${localizeGrade(coinSelectedGrade, language)})`)}</span>
                        <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/35 text-amber-300 font-bold">
                          {tr(
                            `Faqat darsdagi faollik • Har bir sinf uchun kuniga max ${maxCoinsPerDay} Coin`,
                            `Только активность на уроке • Макс. ${maxCoinsPerDay} койнов в день на класс`
                          )}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {coinsRemainingToday <= 0 ? (
                          language === 'ru' ? (
                            <>
                              Сегодня для класса <strong className="text-rose-300">{localizeGrade(coinSelectedGrade, language)}</strong> дневной лимит исчерпан (выдано{' '}
                              {coinsUsedToday} / {maxCoinsPerDay} койнов). Вы можете выдать другим классам ещё до{' '}
                              <strong className="text-emerald-300">{maxCoinsPerDay} койнов</strong> сегодня!
                            </>
                          ) : (
                            <>
                              Bugun <strong className="text-rose-300">{coinSelectedGrade} sinfi</strong> uchun kunlik limit tugadi (
                              {coinsUsedToday} / {maxCoinsPerDay} Coin berildi). Boshqa sinflarga bugun yana{' '}
                              <strong className="text-emerald-300">{maxCoinsPerDay} Coin</strong> gacha berishingiz mumkin!
                            </>
                          )
                        ) : coinsUsedToday > 0 ? (
                          language === 'ru' ? (
                            <>
                              Сегодня классу <strong className="text-cyan-300">{localizeGrade(coinSelectedGrade, language)}</strong> уже выдано {coinsUsedToday} койнов. Этому классу осталось{' '}
                              <strong className="text-emerald-300">{coinsRemainingToday} койнов</strong>, а другим классам — до{' '}
                              <strong className="text-cyan-300">{maxCoinsPerDay} койнов</strong>.
                            </>
                          ) : (
                            <>
                              Bugun <strong className="text-cyan-300">{coinSelectedGrade} sinfiga</strong> {coinsUsedToday} Coin berilgan. Ushbu sinfga yana{' '}
                              <strong className="text-emerald-300">{coinsRemainingToday} Coin</strong>, boshqa har bir sinfga esa{' '}
                              <strong className="text-cyan-300">{maxCoinsPerDay} Coin</strong> gacha berishingiz mumkin.
                            </>
                          )
                        ) : language === 'ru' ? (
                          <>
                            Для класса <strong className="text-cyan-300">{localizeGrade(coinSelectedGrade, language)}</strong> дневной лимит полностью открыт. Каждому классу можно начислить до{' '}
                            <strong className="text-emerald-300">{maxCoinsPerDay} койнов</strong> в день.
                          </>
                        ) : (
                          <>
                            <strong className="text-cyan-300">{coinSelectedGrade} sinfi</strong> uchun bugungi kunlik limit to'liq ochiq. Har bir sinfga kuniga ko'pi bilan{' '}
                            <strong className="text-emerald-300">{maxCoinsPerDay} Coin</strong> gacha rag'batlantirishingiz mumkin.
                          </>
                        )}
                      </p>
                      {awardedClassesToday.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px]">
                          <span className="text-slate-400 font-bold">{tr('Bugun coin berilgan sinflar:', 'Классы с начислениями сегодня:')}</span>
                          {awardedClassesToday.map((cls) => {
                            const used = perClassStatusMap[cls]?.coinsUsedToday || 0;
                            const full = used >= maxCoinsPerDay;
                            return (
                              <button
                                key={cls}
                                type="button"
                                onClick={() => handleSelectCoinGrade(cls, true)}
                                className={`px-2 py-0.5 rounded-md font-bold border transition-colors ${
                                  full
                                    ? 'bg-rose-500/15 border-rose-500/35 text-rose-300'
                                    : 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
                                }`}
                              >
                                {localizeGrade(cls, language)}: {used}/{maxCoinsPerDay}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col md:items-end gap-2 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-white whitespace-nowrap">
                        {localizeGrade(coinSelectedGrade, language)}: {coinsUsedToday} / {maxCoinsPerDay} {tr('Coin ishlatildi', 'использовано')}
                      </span>
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap ${
                          coinsRemainingToday > 0
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}
                      >
                        {tr('Qoldi:', 'Осталось:')} {coinsRemainingToday}
                      </span>
                    </div>
                    <div className="w-full md:w-52 h-2 rounded-full bg-slate-800 overflow-hidden border border-slate-700/80">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          coinsRemainingToday <= 0
                            ? 'bg-gradient-to-r from-rose-500 to-orange-500'
                            : 'bg-gradient-to-r from-cyan-400 to-emerald-400'
                        }`}
                        style={{
                          width: `${Math.min(100, Math.round((coinsUsedToday / Math.max(1, maxCoinsPerDay)) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 2. Mini KPI Stats Grid */}
              <div className="teacher-coins-kpi-row">
                <div className="teacher-kpi-box">
                  <div className="kpi-ico gold">
                    <Coins size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="kpi-val text-amber-400">
                      {classTotalCoins} <span className="text-xs font-semibold text-amber-400/80">{tr('Coin', 'Койн')}</span>
                    </div>
                    <div className="kpi-lbl">{tr(`${coinSelectedGrade} Sinf Jamg'armasi`, `Фонд класса ${localizeGrade(coinSelectedGrade, language)}`)}</div>
                  </div>
                </div>

                <div className="teacher-kpi-box">
                  <div className="kpi-ico cyan">
                    <Users size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="kpi-val text-sky-400">
                      {classStudentsList.length} <span className="text-xs font-semibold text-sky-400/80">{tr('nafar', 'уч.')}</span>
                    </div>
                    <div className="kpi-lbl">{tr("Sinf O'quvchilari", 'Ученики класса')}</div>
                  </div>
                </div>

                <div className="teacher-kpi-box">
                  <div className="kpi-ico green">
                    <Crown size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="kpi-val text-emerald-400 truncate">
                      {classTopStudent ? (classTopStudent.fullName || classTopStudent.full_name) : tr("Hali yo'q", 'Пока нет')}
                    </div>
                    <div className="kpi-lbl">
                      {classTopStudent ? `Top 1 • ${classTopStudent.coins || 0} ${tr('Coin', 'Койн')}` : tr("Yetakchi o'quvchi", 'Лидер класса')}
                    </div>
                  </div>
                </div>

                <div className="teacher-kpi-box">
                  <div className="kpi-ico purple">
                    <Sparkles size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="kpi-val text-purple-400">
                      ~{classAvgCoins} <span className="text-xs font-semibold text-purple-400/80">{tr('Coin', 'Койн')}</span>
                    </div>
                    <div className="kpi-lbl">{tr("O'rtacha Ko'rsatkich", 'Средний показатель')}</div>
                  </div>
                </div>
              </div>

              {/* 3. Luxury Award Card */}
              <div className="teacher-award-card space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/90">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Sparkles className="text-amber-400" size={18} />
                    <h4 className="text-sm font-black text-white uppercase tracking-wider">
                      {tr("Yangi Coin Rag'bati Taqdim Etish", 'Начислить новые койны за активность')}
                    </h4>
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/35 text-cyan-300 font-bold">
                      📚 {tr(`Faqat darsdagi faollik • Maks. ${maxCoinsPerDay} Coin`, `Только активность на уроке • Макс. ${maxCoinsPerDay} койнов`)}
                    </span>
                  </div>

                  {/* Quick amounts chips (strictly 1..5 for Teacher Portal) */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-slate-400 font-semibold mr-1 hidden sm:inline">{tr('Miqdor:', 'Кол-во:')}</span>
                    {[1, 2, 3, 5].map((amt) => {
                      const chipDisabled =
                        !canAwardToSelectedClass ||
                        classStudentsList.length === 0 ||
                        amt > coinsRemainingToday;
                      return (
                        <button
                          key={amt}
                          type="button"
                          disabled={chipDisabled}
                          className={`teacher-coin-amount-chip ${Number(coinAmount) === amt ? 'active' : ''} ${
                            chipDisabled ? 'opacity-40 cursor-not-allowed' : ''
                          }`}
                          onClick={() => setCoinAmount(amt)}
                        >
                          +{amt}
                        </button>
                      );
                    })}
                    {canAwardToSelectedClass && coinsRemainingToday > 0 && classStudentsList.length > 0 && (
                      <button
                        type="button"
                        onClick={handleQuickAwardWholeClass}
                        className="ml-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/35 transition-colors"
                        title={tr(
                          `Butun ${coinSelectedGrade} sinfiga +${Math.min(maxCoinsPerDay, coinsRemainingToday)} Coin berish`,
                          `Начислить всему классу ${localizeGrade(coinSelectedGrade, language)} +${Math.min(maxCoinsPerDay, coinsRemainingToday)} койнов`
                        )}
                      >
                        ✨ {tr(`Butun ${coinSelectedGrade}`, `Весь ${localizeGrade(coinSelectedGrade, language)}`)} (+{Math.min(maxCoinsPerDay, coinsRemainingToday)})
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline guidance notice when selected class limit is exhausted or class is empty */}
                {(coinsRemainingToday <= 0 || classStudentsList.length === 0) && (
                  <div
                    className={`px-3.5 py-2.5 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-2 ${
                      coinsRemainingToday <= 0
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                        : 'bg-sky-500/10 border-sky-500/25 text-sky-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {coinsRemainingToday <= 0 ? <Lock size={14} className="flex-shrink-0" /> : <Users size={14} className="flex-shrink-0" />}
                      <span>
                        {coinsRemainingToday <= 0
                          ? tr(
                              `Bugun ${coinSelectedGrade} sinfi uchun kunlik ${maxCoinsPerDay} Coin limiti to'liq ishlatilgan. Boshqa sinfni tanlab coin berishingiz mumkin!`,
                              `Сегодня для класса ${localizeGrade(coinSelectedGrade, language)} дневной лимит (${maxCoinsPerDay} койнов) полностью исчерпан. Вы можете выбрать другой класс!`
                            )
                          : tr(
                              `${coinSelectedGrade} sinfida ro'yxatdan o'tgan o'quvchi yo'q. Sinf ro'yxatidan o'quvchilari bor sinfni tanlang.`,
                              `В классе ${localizeGrade(coinSelectedGrade, language)} нет зарегистрированных учеников. Выберите класс с учениками.`
                            )}
                      </span>
                    </div>
                  </div>
                )}

                <form onSubmit={handleAwardCoinToStudent} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                    {/* Class select inside award form (3 cols) */}
                    <div className="md:col-span-3">
                      <label className="input-label text-xs font-bold text-slate-300">{tr('Sinfni tanlang *', 'Выберите класс *')}</label>
                      <select
                        className="clean-select text-xs font-bold"
                        value={coinSelectedGrade}
                        onChange={(e) => handleSelectCoinGrade(e.target.value, true)}
                      >
                        {classesMeta.length > 0 ? (
                          <>
                            {populatedClasses.length > 0 && (
                              <optgroup label={tr('Faol sinflar', 'Активные классы')}>
                                {populatedClasses.map((c) => {
                                  const clsUsed = perClassStatusMap[c.name]?.coinsUsedToday || 0;
                                  return (
                                    <option key={c.name} value={c.name}>
                                      {localizeGrade(c.name, language)} {tr('sinf', 'класс')} ({c.studentsCount} {tr('nafar', 'уч.')}){clsUsed > 0 ? ` • ${clsUsed}/${maxCoinsPerDay} ★` : ''}
                                    </option>
                                  );
                                })}
                              </optgroup>
                            )}
                            {emptyClasses.length > 0 && (
                              <optgroup label={tr("Bo'sh sinflar", 'Пустые классы')}>
                                {emptyClasses.map((c) => (
                                  <option key={c.name} value={c.name}>
                                    {localizeGrade(c.name, language)} {tr('sinf', 'класс')} (0 {tr('nafar', 'уч.')})
                                  </option>
                                ))}
                              </optgroup>
                            )}
                          </>
                        ) : (
                          classesList.map((cls) => (
                            <option key={cls} value={cls}>
                              {localizeGrade(cls, language)} {tr('sinf', 'класс')}
                            </option>
                          ))
                        )}
                      </select>
                    </div>

                    {/* Student select filtered by selected class (4 cols) */}
                    <div className="md:col-span-4">
                      <label className="input-label text-xs font-bold text-slate-300">
                        {tr('Kimga beriladi?', 'Кому начислить?')} ({localizeGrade(coinSelectedGrade, language)}) *
                      </label>
                      <select
                        className="clean-select text-xs"
                        value={selectedStudentForCoin}
                        onChange={(e) => setSelectedStudentForCoin(e.target.value)}
                        disabled={!canAwardToSelectedClass || classStudentsList.length === 0}
                        required
                      >
                        {classStudentsList.length === 0 ? (
                          <option value="">{tr(`-- ${coinSelectedGrade} sinfida o'quvchi yo'q --`, `-- В классе ${localizeGrade(coinSelectedGrade, language)} нет учеников --`)}</option>
                        ) : (
                          <>
                            <option value="">{tr(`-- ${coinSelectedGrade} o'quvchisini tanlang --`, `-- Выберите ученика (${localizeGrade(coinSelectedGrade, language)}) --`)}</option>
                            <option value="__ALL__">
                              {tr(
                                `✨ ${coinSelectedGrade} barcha ${classStudentsList.length} nafar o'quvchiga (har biriga max ${Math.min(maxCoinsPerDay, coinsRemainingToday || maxCoinsPerDay)} coin)`,
                                `✨ Всем ${classStudentsList.length} уч. класса ${localizeGrade(coinSelectedGrade, language)} (макс. ${Math.min(maxCoinsPerDay, coinsRemainingToday || maxCoinsPerDay)} койн.)`
                              )}
                            </option>
                            {classStudentsList.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.fullName || s.full_name} ({s.coins || 0} {tr('coin mavjud', 'койнов')})
                              </option>
                            ))}
                          </>
                        )}
                      </select>
                    </div>

                    {/* Amount input strictly capped at 5 (2 cols) */}
                    <div className="md:col-span-2">
                      <label className="input-label text-xs font-bold text-slate-300">
                        {tr('Coin', 'Койны')} ({tr('maks.', 'макс.')} {coinsRemainingToday > 0 ? Math.min(maxCoinsPerDay, coinsRemainingToday) : maxCoinsPerDay}) *
                      </label>
                      <div className={`coin-amount-flex-box ${!canAwardToSelectedClass || classStudentsList.length === 0 ? 'is-disabled' : ''}`}>
                        <span className="text-sm select-none">💎</span>
                        <input
                          type="number"
                          min={1}
                          max={Math.max(1, Math.min(maxCoinsPerDay, coinsRemainingToday || maxCoinsPerDay))}
                          disabled={!canAwardToSelectedClass || classStudentsList.length === 0}
                          className="coin-amount-native-input"
                          value={coinAmount}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (raw === '') {
                              setCoinAmount('');
                              return;
                            }
                            const n = Math.floor(Number(raw));
                            if (Number.isNaN(n)) return;
                            const allowedCap = Math.max(1, Math.min(maxCoinsPerDay, coinsRemainingToday || maxCoinsPerDay));
                            if (n > allowedCap) {
                              setCoinAmount(allowedCap);
                              showToast(
                                coinsRemainingToday > 0 && coinsRemainingToday < maxCoinsPerDay
                                  ? tr(
                                      `Bugun yana ko'pi bilan ${coinsRemainingToday} Coin berishingiz mumkin!`,
                                      `Сегодня вы можете выдать ещё не более ${coinsRemainingToday} койнов!`
                                    )
                                  : tr(
                                      `O'qituvchi har bir sinfdagi bolalarga ${maxCoinsPerDay} coindan ortiq bera olmaydi!`,
                                      `Учитель не может выдать ученикам одного класса более ${maxCoinsPerDay} койнов!`
                                    ),
                                'warning'
                              );
                              return;
                            }
                            setCoinAmount(Math.max(1, n));
                          }}
                          required
                        />
                        <span className="text-[11px] font-bold text-slate-400 select-none">{tr('Coin', 'Койн')}</span>
                      </div>
                    </div>

                    {/* Submit button (3 cols) */}
                    <div className="md:col-span-3">
                      {(() => {
                        const submitDisabled =
                          coinsRemainingToday <= 0 ||
                          classStudentsList.length === 0 ||
                          Number(coinAmount) > maxCoinsPerDay ||
                          Number(coinAmount) > coinsRemainingToday;
                        const btnLabel =
                          coinsRemainingToday <= 0
                            ? tr(`${coinSelectedGrade} Limiti Tugadi`, `Лимит ${localizeGrade(coinSelectedGrade, language)} исчерпан`)
                            : classStudentsList.length === 0
                            ? tr("Sinfda O'quvchi Yo'q", 'В классе нет учеников')
                            : tr('Coin Taqdim Etish', 'Начислить койны');
                        return (
                          <button
                            type="submit"
                            disabled={submitDisabled}
                            className={`teacher-award-submit-btn w-full ${
                              submitDisabled ? 'is-locked opacity-75 cursor-not-allowed' : ''
                            }`}
                          >
                            {coinsRemainingToday <= 0 ? <Lock size={15} /> : <Sparkles size={16} />}
                            <span>{btnLabel}</span>
                          </button>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Reason row */}
                  <div>
                    <label className="input-label text-xs font-bold text-slate-300">{tr('Darsdagi faollik sababi *', 'Причина активности на уроке *')}</label>
                    <input
                      type="text"
                      className="clean-input text-xs"
                      value={coinReason}
                      onChange={(e) => setCoinReason(e.target.value)}
                      placeholder={tr('Masalan: Darsda faol qatnashdi, doskada misol yechdi', 'Например: Активно участвовал на уроке, решил задачу у доски')}
                      required
                    />
                  </div>

                  {/* Quick preset reason tags (lesson activity only) */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-[11px] text-slate-400 font-bold">{tr('Tezkor izohlar:', 'Быстрые шаблоны:')}</span>
                    {lessonPresets.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className={`teacher-quick-reason-pill ${coinReason === preset ? 'active' : ''}`}
                        onClick={() => setCoinReason(preset)}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </form>
              </div>

              {/* 4. Classroom Students Grid */}
              <div className="space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Users size={18} className="text-cyan-400" />
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                      {tr(`${coinSelectedGrade} Sinf O'quvchilari (${classStudentsList.length} nafar)`, `Ученики класса ${localizeGrade(coinSelectedGrade, language)} (${classStudentsList.length})`)}
                    </h4>
                  </div>
                  <span className="text-xs text-slate-400 flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    {tr("Dars jarayonida 1 bosishda tezkor rag'batlantirish", 'Быстрое поощрение в 1 клик во время урока')}
                  </span>
                </div>

                {loadingCoins ? (
                  <div className="text-center py-12 text-slate-400 text-xs bg-slate-900/50 rounded-2xl border border-slate-800">
                    <Loader2 size={24} className="animate-spin text-cyan-400 mx-auto mb-2" />
                    {tr("O'quvchilar ro'yxati yuklanmoqda...", 'Загрузка списка учеников...')}
                  </div>
                ) : classStudentsList.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {classStudentsList.map((st) => {
                      const isLead =
                        classTopStudent &&
                        st.id === classTopStudent.id &&
                        (Number(st.coins) || 0) > 0;
                      return (
                        <div
                          key={st.id}
                          className={`teacher-student-coin-card ${isLead ? 'rank-lead' : ''}`}
                        >
                          <div className="flex items-center gap-3">
                            {st.avatarUrl ? (
                              <img src={st.avatarUrl} alt="" className="student-card-avatar" />
                            ) : (
                              <div className="student-card-fallback-avatar">
                                {(st.fullName || st.full_name || 'O')[0]}
                              </div>
                            )}

                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                                <span className="truncate">{st.fullName || st.full_name}</span>
                                {isLead && <Crown size={13} className="text-amber-400 flex-shrink-0" />}
                              </div>
                              <div className="text-[11px] text-slate-400 truncate mt-0.5">
                                @{st.username || 'talaba'}
                              </div>
                              <div className="mt-1.5">
                                <span className="student-card-coins-badge">
                                  <span>💎</span> {st.coins || 0} {tr('coin', 'койнов')}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Fast 1-click reward buttons */}
                          <div className="pt-2.5 border-t border-slate-800/80">
                            <div className="text-[10px] text-slate-400 font-bold mb-2 flex items-center justify-between">
                              <span>{tr("Tezkor rag'bat:", 'Быстрое поощрение:')}</span>
                              <span className="text-amber-400/85 font-mono">
                                {isTeacherRestricted ? `${tr('qoldi:', 'осталось:')} ${coinsRemainingToday}` : tr('1 bosishda', 'в 1 клик')}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {(isTeacherRestricted
                                ? [
                                    { amt: 1, label: tr('Faollik', 'Актив.'), cls: 'btn-5', reason: tr('Darsdagi faollik uchun', 'За активность на уроке') },
                                    { amt: 2, label: tr("A'lo", 'Отлично'), cls: 'btn-10', reason: tr("A'lo javob va faollik uchun", 'За отличный ответ и активность') },
                                    { amt: 5, label: tr('Maksimal', 'Максимум'), cls: 'btn-20', reason: tr('Namunali faollik uchun', 'За образцовую активность') },
                                  ]
                                : [
                                    { amt: 5, label: tr('Faollik', 'Актив.'), cls: 'btn-5', reason: tr('Darsdagi faollik uchun', 'За активность на уроке') },
                                    { amt: 10, label: tr("A'lo", 'Отлично'), cls: 'btn-10', reason: tr("A'lo javob va faollik uchun", 'За отличный ответ и активность') },
                                    { amt: 20, label: tr('Yuksak', 'Высший'), cls: 'btn-20', reason: tr('Namunali faollik uchun', 'За образцовую активность') },
                                  ]
                              ).map((btn) => {
                                const cardBtnDisabled =
                                  !canAwardToSelectedClass || (isTeacherRestricted && btn.amt > coinsRemainingToday);
                                const tooltipText =
                                  isTeacherRestricted && coinsRemainingToday <= 0
                                    ? tr(
                                        `Bugun '${coinSelectedGrade}' sinfi uchun kunlik ${maxCoinsPerDay} coin limiti tugadi`,
                                        `Сегодня для класса '${localizeGrade(coinSelectedGrade, language)}' дневной лимит (${maxCoinsPerDay} койнов) исчерпан`
                                      )
                                    : isTeacherRestricted && btn.amt > coinsRemainingToday
                                    ? tr(
                                        `Bugun '${coinSelectedGrade}' sinfiga yana ko'pi bilan ${coinsRemainingToday} coin berish mumkin`,
                                        `Сегодня классу '${localizeGrade(coinSelectedGrade, language)}' можно выдать ещё макс. ${coinsRemainingToday} койнов`
                                      )
                                    : `${btn.reason} +${btn.amt} ${tr('coin', 'койнов')}`;
                                return (
                                  <button
                                    key={btn.amt}
                                    type="button"
                                    disabled={cardBtnDisabled}
                                    className={`student-card-btn-pill ${btn.cls} ${
                                      cardBtnDisabled ? 'opacity-40 cursor-not-allowed' : ''
                                    }`}
                                    onClick={() => handleQuickAward(st, btn.amt, btn.reason)}
                                    title={tooltipText}
                                  >
                                    <span>+{btn.amt}</span>
                                    <span className="text-[9px] opacity-80">{btn.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="teacher-empty-class-card">
                    <div className="w-12 h-12 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
                      <Users size={22} />
                    </div>
                    <div className="space-y-1 max-w-md">
                      <h5 className="text-sm font-bold text-white">
                        {tr(`${coinSelectedGrade} sinfida hozircha o'quvchilar yo'q`, `В классе ${localizeGrade(coinSelectedGrade, language)} пока нет учеников`)}
                      </h5>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {tr(
                          "Quyidagi o'quvchilari bor sinflardan birini tanlab tezkor coin berishni davom ettirishingiz mumkin:",
                          'Выберите один из классов с учениками ниже, чтобы продолжить быстрое начисление койнов:'
                        )}
                      </p>
                    </div>
                    {populatedClasses.length > 0 && (
                      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                        {populatedClasses.map((c) => {
                          const clsUsed = perClassStatusMap[c.name]?.coinsUsedToday || 0;
                          return (
                            <button
                              key={c.name}
                              type="button"
                              onClick={() => handleSelectCoinGrade(c.name, true)}
                              className={`teacher-class-chip ${clsUsed > 0 ? 'is-today' : ''}`}
                            >
                              <span>{localizeGrade(c.name, language)} {tr('sinf', 'класс')}</span>
                              <span className="text-[10px] text-sky-300">• {c.studentsCount} {tr('nafar', 'уч.')}</span>
                              {clsUsed > 0 && (
                                <span className={`text-[10px] font-black ${clsUsed >= maxCoinsPerDay ? 'text-rose-300' : 'text-amber-300'}`}>
                                  {clsUsed}/{maxCoinsPerDay}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 5. Luxury Transaction History Table */}
              <div className="space-y-3.5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Clock size={18} className="text-amber-400" />
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                      {tr(`Oxirgi Berilgan Coinlar Tarixi (${filteredCoinHistory.length} ta)`, `История начисления койнов (${filteredCoinHistory.length})`)}
                    </h4>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
                      <button
                        type="button"
                        onClick={() => setCoinHistoryGradeFilter('all')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                          coinHistoryGradeFilter === 'all'
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {tr('Barcha sinflar', 'Все классы')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCoinHistoryGradeFilter(coinSelectedGrade)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                          coinHistoryGradeFilter === coinSelectedGrade
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {tr('Faqat', 'Только')} {localizeGrade(coinSelectedGrade, language)}
                      </button>
                    </div>

                    {/* History Search input */}
                    <div className="teacher-history-search-box min-w-[260px] flex-1 sm:w-80">
                      <Search size={15} className="text-slate-400 flex-shrink-0" />
                      <input
                        type="text"
                        placeholder={tr("Ism, sinf yoki sabab bo'yicha qidiruv...", 'Поиск по имени, классу или причине...')}
                        value={coinHistorySearch}
                        onChange={(e) => setCoinHistorySearch(e.target.value)}
                      />
                      {coinHistorySearch && (
                        <button
                          type="button"
                          onClick={() => setCoinHistorySearch('')}
                          className="text-slate-400 hover:text-white text-xs px-1"
                          title={tr('Tozalash', 'Очистить')}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="teacher-tx-table-wrap">
                  <table className="diamond-table diamond-table-compact w-full text-left">
                    <thead>
                      <tr>
                        <th>{tr("O'quvchi", 'Ученик')}</th>
                        <th>{tr('Sinf', 'Класс')}</th>
                        <th>{tr('Miqdor', 'Сумма')}</th>
                        <th>{tr("Sabab va Yo'nalish", 'Причина и категория')}</th>
                        <th>{tr('Sana va Vaqt', 'Дата и время')}</th>
                        <th className="text-right">{tr('Tahrir', 'Изм.')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCoinHistory.slice(0, 20).map((tx, idx) => (
                        <tr key={tx.id || idx}>
                          <td>
                            <div className="flex items-center gap-2.5">
                              {tx.avatarUrl ? (
                                <img src={tx.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover border border-slate-700" />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-white text-[11px]">
                                  {(tx.student_name || tx.studentName || 'O')[0]}
                                </div>
                              )}
                              <span className="font-bold text-white text-xs whitespace-nowrap">
                                {tx.student_name || tx.studentName}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className="tx-class-badge whitespace-nowrap">
                              {tx.grade && tx.grade !== '-'
                                ? `${localizeGrade(tx.grade, language)} ${tr('sinf', 'класс')}`
                                : tr('Sinf belgilanmagan', 'Класс не указан')}
                            </span>
                          </td>
                          <td>
                            <span className="tx-amount-badge">
                              <span>💎</span>
                              <span>+{tx.amount} {tr('Coin', 'Койн')}</span>
                            </span>
                          </td>
                          <td>
                            <div className="flex items-start gap-2.5">
                              <span className="tx-category-badge flex-shrink-0">
                                {tx.categoryBadge || (tx.isClassroom
                                  ? tr('📚 Dars faolligi', '📚 Активность на уроке')
                                  : tr('📝 Test', '📝 Тест'))}
                              </span>
                              <span className="text-xs text-slate-300 leading-relaxed">
                                {tx.reason}
                              </span>
                            </div>
                          </td>
                          <td className="text-xs text-slate-400 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <Calendar size={12} className="text-slate-500" />
                              <span>{tx.date || tx.created_at || tr('Yaqinda', 'Недавно')}</span>
                            </div>
                          </td>
                          <td className="text-right">
                            {tx.canEdit !== false && (!isTeacherRestricted || tx.isClassroom) && (
                              <button
                                type="button"
                                onClick={() => handleOpenEditCoinTx(tx)}
                                className="btn-icon-blue"
                                title={tr('Miqdor yoki sababni tahrirlash', 'Редактировать сумму или причину')}
                              >
                                <Edit size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}

                      {filteredCoinHistory.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center py-10 text-slate-400 text-xs">
                            {coinHistorySearch || coinHistoryGradeFilter !== 'all'
                              ? tr("Tanlangan filtr bo'yicha coin yozuvi topilmadi.", 'По выбранному фильтру записей не найдено.')
                              : tr('Hali coinlar berilmagan.', 'Койны ещё не начислялись.')}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: TEACHER PROFILE & PASSWORD SETTINGS */}
          {activeTab === 'profile' && (
            <div className="space-y-6 animate-fade-in">
              {/* Top Profile Banner */}
              <div className="teacher-coins-banner">
                <div className="teacher-coins-banner-top">
                  <div className="flex items-center gap-3">
                    <div className="teacher-coins-title-icon">
                      <User size={24} />
                    </div>
                    <div>
                      <h3
                        className="text-lg font-black text-white flex items-center gap-2"
                        style={{ fontFamily: 'Cinzel, serif', letterSpacing: '0.5px' }}
                      >
                        {tr("Mening Profilim va Shaxsiy Ma'lumotlar", 'Мой профиль и личные данные')}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {tr(
                          "Shaxsiy suratingizni yuklang, ism-familiya, telefon, fan ma'lumotlari va parolingizni yangilang",
                          'Загрузите фото, обновите ФИО, телефон, предмет и пароль'
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="text-xs text-slate-300 bg-slate-950/60 px-3.5 py-2 rounded-xl border border-slate-800 font-mono self-start md:self-auto">
                    @{user?.username}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Card: Photo + Personal Info (7 cols) */}
                <form
                  onSubmit={handleSaveProfileInfo}
                  className="lg:col-span-7 test-builder-card space-y-5"
                >
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
                    <Camera size={18} className="text-cyan-400" />
                    <h4 className="text-sm font-black text-white uppercase tracking-wider">
                      {tr("Profil Surati va Shaxsiy Ma'lumotlar", 'Фото профиля и личные данные')}
                    </h4>
                  </div>

                  {/* Avatar Upload Section */}
                  <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-2xl bg-slate-950/60 border border-slate-800/90">
                    <div
                      onClick={() => profileFileInputRef.current?.click()}
                      className="relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-cyan-400/70 shadow-lg cursor-pointer group flex-shrink-0"
                      title={tr('Yangi rasm tanlash', 'Выбрать новое фото')}
                    >
                      {profileAvatarPreview ? (
                        <img
                          src={profileAvatarPreview}
                          alt={profileForm.fullName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-slate-800 flex items-center justify-center text-cyan-300 text-3xl font-black">
                          {(profileForm.fullName || user?.username || 'U')[0]}
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
                      <p className="text-[11px] text-slate-400">
                        {tr('Tavsiya etiladi: kvadrat rasm (.jpg, .png, .webp • maksimal 5 MB)', 'Рекомендуется: квадратное фото (.jpg, .png, .webp • макс. 5 МБ)')}
                      </p>
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
                          <span>{profileAvatarFile ? tr('Boshqa rasm tanlash', 'Выбрать другое фото') : tr('Rasm Yuklash / Almashtirish', 'Загрузить / Сменить фото')}</span>
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

                  {/* Personal Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="input-label">{tr("To'liq ism-familiya (F.I.Sh) *", 'ФИО полностью *')}</label>
                      <input
                        type="text"
                        className="clean-input text-xs"
                        value={profileForm.fullName}
                        onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                        placeholder={tr('Masalan: Anvar Qosimov', 'Например: Анвар Касимов')}
                        required
                      />
                    </div>

                    <div>
                      <label className="input-label">{tr('Login (username) *', 'Логин (username) *')}</label>
                      <input
                        type="text"
                        className="clean-input text-xs font-mono"
                        value={profileForm.username}
                        onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })}
                        placeholder="anvar_muallim"
                        required
                      />
                    </div>

                    {user?.role === 'teacher' && (
                      <div>
                        <label className="input-label">{tr("O'qitadigan faningiz *", 'Преподаваемый предмет *')}</label>
                        <select
                          className="clean-select text-xs"
                          value={profileForm.subject}
                          onChange={(e) => setProfileForm({ ...profileForm, subject: e.target.value })}
                        >
                          {(subjectsList.includes(profileForm.subject)
                            ? subjectsList
                            : [profileForm.subject, ...subjectsList].filter(Boolean)
                          ).map((subj) => (
                            <option key={subj} value={subj}>
                              {localizeSubject(subj, language)}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className={user?.role === 'teacher' ? '' : 'sm:col-span-2'}>
                      <label className="input-label">
                        <span className="inline-flex items-center gap-1.5">
                          <Phone size={12} className="text-cyan-400" />
                          <span>{tr('Telefon raqami', 'Номер телефона')}</span>
                        </span>
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
                    <label className="input-label">{tr("Pedagogik ma'lumot / Qisqacha bio", 'Педагогическая информация / Биография')}</label>
                    <textarea
                      rows={3}
                      className="clean-input text-xs"
                      value={profileForm.bio}
                      onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                      placeholder={tr("Tajribangiz, yutuqlaringiz yoki pedagogik shioringiz haqida yozing...", 'Напишите о вашем опыте, достижениях или методике...')}
                    />
                  </div>

                  <div className="flex justify-end pt-2 border-t border-slate-800">
                    <button
                      type="submit"
                      disabled={savingProfileInfo}
                      className="btn btn-diamond-cyan btn-sm font-bold flex items-center gap-2 px-5"
                    >
                      {savingProfileInfo ? (
                        <>
                          <Loader2 size={15} className="animate-spin" />
                          <span>{tr('Saqlanmoqda...', 'Сохранение...')}</span>
                        </>
                      ) : (
                        <>
                          <Save size={15} />
                          <span>{tr("Ma'lumotlar va Rasmni Saqlash", 'Сохранить данные и фото')}</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {/* Right Card: Security / Password Update (5 cols) */}
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
                      onClick={() => setShowProfilePasswords(!showProfilePasswords)}
                      className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                    >
                      {showProfilePasswords ? <EyeOff size={14} /> : <Eye size={14} />}
                      <span>{showProfilePasswords ? tr('Yashirish', 'Скрыть') : tr("Ko'rsatish", 'Показать')}</span>
                    </button>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200 leading-relaxed">
                    🔐 {tr("Xavfsizlik uchun murakkab parol tanlang. Parol kamida 3 ta belgidan iborat bo'lishi kerak.", 'Для безопасности выберите надёжный пароль (не менее 3 символов).')}
                  </div>

                  {user?.role !== 'admin' && (
                    <div>
                      <label className="input-label">{tr('Hozirgi (eski) parol *', 'Текущий пароль *')}</label>
                      <input
                        type={showProfilePasswords ? 'text' : 'password'}
                        className="clean-input text-xs"
                        value={passwordForm.oldPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
                        placeholder={tr('Amaldagi parolingiz', 'Ваш текущий пароль')}
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
                      placeholder={tr('Yangi parolni kiriting', 'Введите новый пароль')}
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
                      placeholder={tr('Yangi parolni qayta tering', 'Повторите новый пароль')}
                      required
                    />
                  </div>

                  <div className="pt-2 border-t border-slate-800">
                    <button
                      type="submit"
                      disabled={savingPassword}
                      className="btn btn-warning btn-sm w-full font-bold text-slate-950 flex items-center justify-center gap-2"
                    >
                      {savingPassword ? (
                        <>
                          <Loader2 size={15} className="animate-spin" />
                          <span>{tr('Yangilanmoqda...', 'Обновление...')}</span>
                        </>
                      ) : (
                        <>
                          <Lock size={15} />
                          <span>{tr('Parolni Yangilash', 'Обновить пароль')}</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* DETAILED SUBMISSION BREAKDOWN & COIN MODAL */}
      {viewingSubmission && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-base">
                  {(viewingSubmission.student_name || viewingSubmission.fullName || 'O')[0]}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>{viewingSubmission.student_name || viewingSubmission.fullName}</span>
                    <span className="badge badge-info text-[11px]">{localizeGrade(viewingSubmission.grade, language)}</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    {tr(
                      `"${selectedTestForResults?.title || 'Test'}" topshirig'i tahlili`,
                      `Разбор сдачи теста «${selectedTestForResults?.title || 'Тест'}»`
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="text-slate-400 hover:text-white p-1 rounded-lg"
                onClick={() => setViewingSubmission(null)}
              >
                <XCircle size={20} />
              </button>
            </div>

            {/* Modal Stats Bar */}
            <div className="p-4 bg-slate-950/40 border-b border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
              <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="text-base font-black text-emerald-400">
                  {viewingSubmission.score ?? viewingSubmission.score_percentage ?? 0}%
                </div>
                <div className="text-[10px] text-slate-400">{tr('Umumiy Natija', 'Общий результат')}</div>
              </div>
              <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="text-base font-black text-cyan-400">
                  {viewingSubmission.correctAnswers ?? viewingSubmission.correctCount ?? 0} / {viewingSubmission.totalQuestions ?? viewingSubmission.totalCount ?? 10}
                </div>
                <div className="text-[10px] text-slate-400">{tr("To'g'ri Javoblar", 'Правильных ответов')}</div>
              </div>
              <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="text-base font-black text-sky-400">
                  {submissionDetail?.timeSpentDisplay || viewingSubmission.timeStr || viewingSubmission.time_spent_display || tr('12 daq', '12 мин')}
                </div>
                <div className="text-[10px] text-slate-400">{tr('Sarflangan Vaqt', 'Затрачено времени')}</div>
              </div>
              <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="text-base font-black text-amber-400">
                  {submissionDetail?.coinsAwarded ?? viewingSubmission.alreadyAwardedCoins ?? 0} 💎
                </div>
                <div className="text-[10px] text-slate-400">{tr('Berilgan Coinlar', 'Начислено койнов')}</div>
              </div>
            </div>

            {/* Questions Breakdown List */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 flex-1">
              {submissionModalLoading ? (
                <div className="text-center py-10 text-slate-400 text-xs flex items-center justify-center gap-2">
                  <Loader2 size={18} className="animate-spin text-cyan-400" /> {tr('Savollar yuklanmoqda...', 'Загрузка вопросов...')}
                </div>
              ) : submissionDetail?.breakdown && submissionDetail.breakdown.length > 0 ? (
                submissionDetail.breakdown.map((item, qIdx) => (
                  <div
                    key={qIdx}
                    className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                      item.isCorrect
                        ? 'bg-emerald-950/20 border-emerald-500/30'
                        : 'bg-rose-950/20 border-rose-500/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{tr('Savol', 'Вопрос')} #{qIdx + 1}</span>
                      {item.isCorrect ? (
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle size={11} /> {tr("To'g'ri", 'Верно')}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-rose-400 bg-rose-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <XCircle size={11} /> {tr("Noto'g'ri", 'Неверно')}
                        </span>
                      )}
                    </div>

                    <div className="text-slate-200 font-medium">
                      <MathRenderer text={item.questionText} />
                    </div>

                    {item.imageUrl && (
                      <img
                        src={item.imageUrl}
                        alt=""
                        className="max-h-36 rounded-lg border border-slate-700"
                      />
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
                      <div className={`p-2 rounded-lg border ${item.isCorrect ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300' : 'bg-rose-500/10 border-rose-500/40 text-rose-300'}`}>
                        <span className="block font-bold text-[10px] opacity-75">{tr("O'quvchi javobi:", 'Ответ ученика:')}</span>
                        <span>{item.selectedText || tr('Tanlanmagan', 'Не выбрано')}</span>
                      </div>
                      {!item.isCorrect && (
                        <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/40 text-emerald-300">
                          <span className="block font-bold text-[10px] opacity-75">{tr("To'g'ri javob:", 'Правильный ответ:')}</span>
                          <span>{item.correctText}</span>
                        </div>
                      )}
                    </div>

                    {item.explanation && (
                      <div className="text-[11px] text-slate-400 bg-slate-950/40 p-2 rounded-lg border border-slate-800">
                        <strong className="text-cyan-400">{tr('Izoh:', 'Пояснение:')} </strong> {item.explanation}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-400 text-xs">
                  {tr("Savollar bo'yicha batafsil yozuvlar topilmadi.", 'Подробные записи по вопросам не найдены.')}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end">
              <button
                type="button"
                className="btn btn-secondary btn-sm text-xs"
                onClick={() => setViewingSubmission(null)}
              >
                {tr('Yopish', 'Закрыть')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT COIN TRANSACTION MODAL */}
      {editingCoinTx && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-amber-500/35 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center text-amber-400">
                  <Edit size={17} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">{tr('Coin Tranzaksiyasini Tahrirlash', 'Редактировать транзакцию')}</h3>
                  <p className="text-[11px] text-slate-400">
                    {editingCoinTx.student_name || editingCoinTx.studentName} •{' '}
                    {editingCoinTx.grade && editingCoinTx.grade !== '-'
                      ? `${localizeGrade(editingCoinTx.grade, language)} ${tr('sinf', 'класс')}`
                      : tr('Sinf belgilanmagan', 'Класс не указан')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="text-slate-400 hover:text-white p-1 rounded-lg"
                onClick={() => setEditingCoinTx(null)}
              >
                <XCircle size={19} />
              </button>
            </div>

            <form onSubmit={handleSaveEditCoinTx} className="p-4 sm:p-5 space-y-4">
              {isTeacherRestricted && (
                <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/25 text-[11px] text-cyan-200 leading-relaxed">
                  {tr(
                    `O'qituvchi sifatida faqat darsdagi faollik coinlari miqdorini (1 dan ${maxCoinsPerDay} Coin oralig'ida) va sababini tahrirlashingiz mumkin (o'chirish taqiqlangan).`,
                    `В роли учителя можно изменять только количество койнов за активность на уроке (от 1 до ${maxCoinsPerDay}) и причину (удаление запрещено).`
                  )}
                </div>
              )}

              <div>
                <label className="input-label text-xs font-bold text-slate-300">{tr('Coin Miqdori *', 'Количество койнов *')}</label>
                <div className="coin-amount-flex-box">
                  <span className="text-sm select-none">💎</span>
                  <input
                    type="number"
                    min={1}
                    max={maxCoinsPerDay}
                    className="coin-amount-native-input"
                    value={editCoinAmount}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '') {
                        setEditCoinAmount('');
                        return;
                      }
                      const n = Math.floor(Number(raw));
                      if (Number.isNaN(n)) return;
                      if (n > maxCoinsPerDay) {
                        setEditCoinAmount(maxCoinsPerDay);
                        showToast(
                          tr(
                            `O'qituvchi ko'pi bilan ${maxCoinsPerDay} Coin belgilashi mumkin!`,
                            `Учитель может указать не более ${maxCoinsPerDay} койнов!`
                          ),
                          'warning'
                        );
                        return;
                      }
                      setEditCoinAmount(Math.max(1, n));
                    }}
                    required
                  />
                  <span className="text-[11px] font-bold text-slate-400 select-none">{tr('Coin', 'Койн')}</span>
                </div>
              </div>

              <div>
                <label className="input-label text-xs font-bold text-slate-300">
                  {isTeacherRestricted ? tr('Darsdagi faollik sababi *', 'Причина активности на уроке *') : tr('Izoh / Sabab *', 'Причина / Комментарий *')}
                </label>
                <input
                  type="text"
                  className="clean-input text-xs"
                  value={editCoinReason}
                  onChange={(e) => setEditCoinReason(e.target.value)}
                  placeholder={isTeacherRestricted ? tr('Darsdagi faollik sababini kiriting...', 'Укажите причину активности на уроке...') : tr('Sababni kiriting...', 'Введите причину...')}
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingCoinTx(null)}
                  className="btn btn-secondary btn-xs font-bold px-4"
                >
                  {tr('Bekor qilish', 'Отмена')}
                </button>
                <button
                  type="submit"
                  disabled={savingEditCoin}
                  className="btn btn-warning btn-xs font-bold text-slate-950 px-4 flex items-center gap-1.5"
                >
                  {savingEditCoin ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>{tr('Saqlash', 'Сохранить')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
