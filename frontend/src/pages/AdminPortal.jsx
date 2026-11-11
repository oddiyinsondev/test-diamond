import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../api/endpoints';
import ConfirmModal from '../components/ConfirmModal';
import AdminTestBuilder from '../components/AdminTestBuilder';
import MathRenderer from '../components/MathRenderer';
import {
  localizeSubject,
  localizeGrade,
  localizeUserFullName,
  ADMIN_STUDENT_COIN_PRESETS_BY_LANG,
  ADMIN_CLASS_COIN_PRESETS_BY_LANG,
  getPolicyMessageLocalized,
} from '../i18n/portalUtils';
import {
  ScoreTierDonutChart,
  VerticalBarDiagram,
  MultiSegmentDonutChart,
  ValueBarDiagram,
  TrendAreaLineChart,
} from '../components/StatsCharts';
import {
  ShieldCheck,
  Users,
  GraduationCap,
  Presentation as ChalkboardTeacher,
  School,
  FileCheck2,
  TrendingUp,
  Coins,
  Gem,
  Plus,
  Search,
  Trash2,
  Edit,
  Mail,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Lock,
  User,
  Phone,
  BookOpen,
  Award,
  Eye,
  EyeOff,
  Clock,
  HelpCircle,
  Trophy,
  Sparkles,
  BarChart2,
  Flame,
  Crown,
  ArrowLeft,
  Camera,
  Save,
  Zap,
  Unlock,
  Calendar,
  RefreshCw,
} from 'lucide-react';

const ADMIN_VALID_TABS = ['teachers', 'students', 'tests', 'coins', 'classes', 'showcase'];

export default function AdminPortal() {
  const { user, login, language, tr } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Gate state
  const [gateUsername, setGateUsername] = useState('admin');
  const [gatePassword, setGatePassword] = useState('');
  const [gateLoading, setGateLoading] = useState(false);
  const [gateError, setGateError] = useState('');
  const [showGatePassword, setShowGatePassword] = useState(false);

  const initialTabParam = searchParams.get('tab');
  const resolvedInitialTab =
    initialTabParam === 'create'
      ? 'tests'
      : ADMIN_VALID_TABS.includes(initialTabParam)
      ? initialTabParam
      : 'teachers';

  // Active Tab: 'teachers' | 'students' | 'tests' | 'coins' | 'classes' | 'showcase'
  const [activeTab, setActiveTab] = useState(resolvedInitialTab);

  // Tests management & native builder / results state
  const [adminTests, setAdminTests] = useState([]);
  const [adminTestSearch, setAdminTestSearch] = useState('');
  const [adminSubjectFilter, setAdminSubjectFilter] = useState('all');
  const [adminClassFilter, setAdminClassFilter] = useState('all');
  const [testViewMode, setTestViewMode] = useState(
    initialTabParam === 'create' ? 'builder' : 'list'
  ); // 'list' | 'builder' | 'results'
  const [editingAdminTest, setEditingAdminTest] = useState(null);
  const [selectedAdminTestForResults, setSelectedAdminTestForResults] = useState(null);
  const [adminParticipantsList, setAdminParticipantsList] = useState([]);
  const [adminTestResultsMeta, setAdminTestResultsMeta] = useState(null);
  const [loadingAdminResults, setLoadingAdminResults] = useState(false);
  const [adminDistributingCoins, setAdminDistributingCoins] = useState(false);
  const [viewingAdminSubmission, setViewingAdminSubmission] = useState(null);
  const [adminSubmissionModalLoading, setAdminSubmissionModalLoading] = useState(false);
  const [adminSubmissionDetail, setAdminSubmissionDetail] = useState(null);
  const [adminModalCoinAmount, setAdminModalCoinAmount] = useState(20);
  const [adminModalCoinReason, setAdminModalCoinReason] = useState(() =>
    (localStorage.getItem('diamond_lang') || 'uz') === 'ru'
      ? 'За отличный результат в тесте 💎'
      : 'Testdagi namunali natija uchun 💎'
  );
  const [adminTopNCount, setAdminTopNCount] = useState(3);
  const [adminTopNAmount, setAdminTopNAmount] = useState(20);
  const [studentTestsPolicy, setStudentTestsPolicy] = useState({
    enabled: true,
    portalOpen: true,
    isUpcoming: false,
    isExpired: false,
    startTime: null,
    endTime: null,
    startTimeIso: '',
    endTimeIso: '',
    reason: null,
    message: '',
  });
  const [studentTestsPolicyStats, setStudentTestsPolicyStats] = useState({
    totalTests: 0,
    allowedTests: 0,
    activeNowTests: 0,
    lockedTests: 0,
  });
  const [portalScheduleForm, setPortalScheduleForm] = useState({
    startTimeIso: '',
    endTimeIso: '',
  });
  const [savingGlobalPolicy, setSavingGlobalPolicy] = useState(false);
  const [savingTestPermissionId, setSavingTestPermissionId] = useState(null);
  const [permissionScheduleModal, setPermissionScheduleModal] = useState(null);
  const [savingPermissionModal, setSavingPermissionModal] = useState(false);

  // Data states
  const [stats, setStats] = useState({
    teachersCount: 0,
    studentsCount: 0,
    classesCount: 0,
    testsCount: 0,
    submissionsCount: 0,
    avgScore: 0,
    unreadMessages: 0,
  });
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [classesList, setClassesList] = useState([]);
  const [contactMessages, setContactMessages] = useState([]);
  const [coinRankings, setCoinRankings] = useState([]);
  const [loadingData, setLoadingData] = useState(false);

  // Enhanced Coin and Class management states
  const [coinStats, setCoinStats] = useState(null);
  const [recentCoinTxs, setRecentCoinTxs] = useState([]);
  const [coinSubTab, setCoinSubTab] = useState('rankings'); // 'rankings' | 'history'
  const [classFilter, setClassFilter] = useState('all'); // 'all' | 'uz' | 'ru'
  const [classCoinFilter, setClassCoinFilter] = useState('active'); // 'all' | 'active' | 'uz' | 'ru'
  const [languageCoinStats, setLanguageCoinStats] = useState(null);
  const [classesSummary, setClassesSummary] = useState(null); // 'all' | 'uz' | 'ru'
  const [contactFilter, setContactFilter] = useState('all'); // 'all' | 'pending' | 'contacted'
  const [viewingClassStudents, setViewingClassStudents] = useState(null);
  const [awardStudentGradeFilter, setAwardStudentGradeFilter] = useState('all');

  // Statistics, Schemes & Batch Award States
  const [classesCoinStats, setClassesCoinStats] = useState([]);
  const [studentCoinTiers, setStudentCoinTiers] = useState(null);
  const [coinSources, setCoinSources] = useState([]);
  const [coinTimeline, setCoinTimeline] = useState([]);
  const [coinsBarMetric, setCoinsBarMetric] = useState('total'); // 'total' | 'avg' | 'fund'
  const [classesBarMode, setClassesBarMode] = useState('coins'); // 'coins' | 'parallels' | 'students'
  const [classesScoreOnlyActive, setClassesScoreOnlyActive] = useState(true);
  const [coinSearchQuery, setCoinSearchQuery] = useState('');
  const [coinGradeFilter, setCoinGradeFilter] = useState('all');
  const [coinTierFilter, setCoinTierFilter] = useState('all'); // 'all' | 'diamond' | 'gold' | 'silver' | 'bronze' | 'zero'
  const [coinOnlyActiveFilter, setCoinOnlyActiveFilter] = useState(false);
  const [isBatchClassRewardOpen, setIsBatchClassRewardOpen] = useState(false);
  const [batchClassForm, setBatchClassForm] = useState({
    className: '9-A',
    awardScope: 'class_only', // 'class_only' | 'class_and_active' | 'both' | 'active_students' | 'all_students'
    amount: 20,
    reason:
      (localStorage.getItem('diamond_lang') || 'uz') === 'ru'
        ? 'За активный класс и образцовое командное участие'
        : 'Faol sinf va namunali jamoaviy ishtirok uchun',
  });

  // Search and filter states
  const [teacherSearch, setTeacherSearch] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState('all');

  // Modals state
  const [isAddTeacherOpen, setIsAddTeacherOpen] = useState(false);
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [isAddClassOpen, setIsAddClassOpen] = useState(false);
  const [isAwardCoinsOpen, setIsAwardCoinsOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  // Confirm delete modal state
  const [confirmModalState, setConfirmModalState] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Teacher Form State
  const [teacherForm, setTeacherForm] = useState({
    fullName: '',
    username: '',
    password: '123',
    subject: 'Matematika',
    phone: '',
    bio: '',
  });
  const [teacherAvatarFile, setTeacherAvatarFile] = useState(null);
  const [teacherAvatarPreview, setTeacherAvatarPreview] = useState('');

  // Edit Teacher Profile Modal State
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [editTeacherForm, setEditTeacherForm] = useState({
    fullName: '',
    username: '',
    password: '',
    subject: 'Matematika',
    phone: '',
    bio: '',
    avatarFile: null,
    avatarPreview: '',
    clearAvatar: false,
    hasCustomAvatar: false,
  });
  const [showEditTeacherPw, setShowEditTeacherPw] = useState(false);
  const [savingEditTeacher, setSavingEditTeacher] = useState(false);

  // Student Form State
  const [studentForm, setStudentForm] = useState({
    fullName: '',
    username: '',
    password: '123',
    grade: '9-A',
    phone: '',
  });

  // Class Form State
  const [classForm, setClassForm] = useState({
    name: '',
    gradeLevel: 9,
    language: 'uz',
  });

  // Award Coins Form State (Supports single & multi-select active students)
  const [awardCoinsForm, setAwardCoinsForm] = useState({
    studentId: '',
    amount: 15,
    reason:
      (localStorage.getItem('diamond_lang') || 'uz') === 'ru'
        ? 'За активное участие в тестах и на уроках ⚡'
        : 'Test va darslarda faol qatnashgani uchun ⚡',
  });
  const [selectedAwardStudentIds, setSelectedAwardStudentIds] = useState([]);
  const [awardStudentSearch, setAwardStudentSearch] = useState('');
  const [awardOnlyActive, setAwardOnlyActive] = useState(true);
  const [awardTopNCount, setAwardTopNCount] = useState(3);

  const subjectsList = [
    'Matematika',
    'Fizika',
    'Informatika',
    'Ingliz tili',
    'Biologiya',
    'Kimyo',
    'Tarix',
    'Ona tili va Adabiyot',
  ];

  const isAdmin = user && user.role === 'admin';

  // Load all admin data
  const loadAdminData = async () => {
    if (!isAdmin) return;
    setLoadingData(true);
    try {
      const [statsRes, teachersRes, studentsRes, classesRes, msgRes, coinsRes, testsRes, permRes] = await Promise.allSettled([
        api.admin.getStats(),
        api.admin.getTeachers(),
        api.admin.getStudents(),
        api.admin.getClasses(),
        api.admin.getContactMessages(),
        api.admin.getCoinRankings(),
        api.teacher.getTests(),
        api.admin.getTestPermissionSettings(),
      ]);

      if (statsRes.status === 'fulfilled') setStats(statsRes.value || {});
      if (teachersRes.status === 'fulfilled') {
        const val = teachersRes.value;
        setTeachers(Array.isArray(val) ? val : (val?.teachers || []));
      }
      if (studentsRes.status === 'fulfilled') {
        const val = studentsRes.value;
        setStudents(Array.isArray(val) ? val : (val?.students || []));
      }
      if (classesRes.status === 'fulfilled') {
        const val = classesRes.value;
        setClassesList(Array.isArray(val) ? val : (val?.classes || []));
        setClassesSummary(val?.summary || null);
      }
      if (msgRes.status === 'fulfilled') {
        const val = msgRes.value;
        setContactMessages(Array.isArray(val) ? val : (val?.messages || []));
      }
      if (coinsRes.status === 'fulfilled') {
        const val = coinsRes.value;
        setCoinRankings(Array.isArray(val) ? val : (val?.topStudents || val?.rankings || []));
        setRecentCoinTxs(Array.isArray(val?.recentTransactions) ? val.recentTransactions : []);
        setCoinStats(val?.summary || null);
        setClassesCoinStats(Array.isArray(val?.classesCoinStats) ? val.classesCoinStats : []);
        setStudentCoinTiers(val?.studentCoinTiers || null);
        setLanguageCoinStats(val?.languageCoinStats || null);
        setCoinSources(Array.isArray(val?.coinSources) ? val.coinSources : []);
        setCoinTimeline(Array.isArray(val?.coinTimeline) ? val.coinTimeline : []);
      }
      if (testsRes.status === 'fulfilled') {
        const val = testsRes.value;
        setAdminTests(Array.isArray(val) ? val : (val?.tests || []));
      }
      if (permRes.status === 'fulfilled' && permRes.value) {
        const p = permRes.value.policy || {};
        setStudentTestsPolicy((prev) => ({ ...prev, ...p }));
        if (permRes.value.stats) {
          setStudentTestsPolicyStats(permRes.value.stats);
        }
        setPortalScheduleForm({
          startTimeIso: p.startTimeIso || '',
          endTimeIso: p.endTimeIso || '',
        });
      }
    } catch (err) {
      console.error('Error loading admin data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    setAdminModalCoinReason((prev) => {
      if (language === 'ru' && prev === 'Testdagi namunali natija uchun 💎') {
        return 'За отличный результат в тесте 💎';
      }
      if (language !== 'ru' && prev === 'За отличный результат в тесте 💎') {
        return 'Testdagi namunali natija uchun 💎';
      }
      return prev;
    });
    setBatchClassForm((prev) => {
      if (language === 'ru' && prev.reason === 'Faol sinf va namunali jamoaviy ishtirok uchun') {
        return { ...prev, reason: 'За активный класс и образцовое командное участие' };
      }
      if (language !== 'ru' && prev.reason === 'За активный класс и образцовое командное участие') {
        return { ...prev, reason: 'Faol sinf va namunali jamoaviy ishtirok uchun' };
      }
      return prev;
    });
    setAwardCoinsForm((prev) => {
      if (language === 'ru' && prev.reason === 'Test va darslarda faol qatnashgani uchun ⚡') {
        return { ...prev, reason: 'За активное участие в тестах и на уроках ⚡' };
      }
      if (language !== 'ru' && prev.reason === 'За активное участие в тестах и на уроках ⚡') {
        return { ...prev, reason: 'Test va darslarda faol qatnashgani uchun ⚡' };
      }
      return prev;
    });
  }, [language]);

  useEffect(() => {
    if (isAdmin) {
      loadAdminData();
      if (testViewMode === 'results' && selectedAdminTestForResults?.id) {
        reloadAdminTestParticipants(selectedAdminTestForResults.id);
      }
    }
  }, [isAdmin, language]);

  // Sync URL query params (?tab=tests, ?tab=create, ?edit_test=..., ?view_results=...)
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    const editId = searchParams.get('edit_test');
    const resultsId = searchParams.get('view_results');

    if (editId) {
      const found = adminTests.find((t) => String(t.id) === String(editId));
      setActiveTab('tests');
      setEditingAdminTest(found || { id: Number(editId) });
      setTestViewMode('builder');
      return;
    }

    if (resultsId) {
      const found = adminTests.find((t) => String(t.id) === String(resultsId));
      handleAdminViewResults(found || { id: Number(resultsId), title: tr('Test natijalari', 'Результаты теста') });
      return;
    }

    if (tabParam === 'create') {
      setActiveTab('tests');
      setEditingAdminTest(null);
      setTestViewMode('builder');
    } else if (tabParam && ADMIN_VALID_TABS.includes(tabParam)) {
      setActiveTab(tabParam);
      if (tabParam === 'tests') {
        setTestViewMode('list');
        setEditingAdminTest(null);
      }
    } else if (!tabParam && searchParams.toString() === '') {
      // keep user on current tab unless explicitly navigated via /admin-panel/ link
    }
  }, [searchParams]);

  // Admin: Start creating new test
  const handleAdminNewTest = () => {
    setActiveTab('tests');
    setEditingAdminTest(null);
    setTestViewMode('builder');
  };

  // Admin: Edit existing test
  const handleAdminEditTest = (testObj) => {
    setActiveTab('tests');
    setEditingAdminTest(testObj);
    setTestViewMode('builder');
  };

  // Admin: View test results & distribute coins (unrestricted)
  const handleAdminViewResults = async (testItem) => {
    setActiveTab('tests');
    setSelectedAdminTestForResults(testItem);
    setTestViewMode('results');
    setLoadingAdminResults(true);
    try {
      const res = await api.teacher.getTestParticipants(testItem.id, 'admin');
      setAdminParticipantsList(res?.participants || (Array.isArray(res) ? res : []));
      setAdminTestResultsMeta(res?.test || null);
    } catch (err) {
      console.error(err);
      setAdminParticipantsList([]);
      setAdminTestResultsMeta(null);
    } finally {
      setLoadingAdminResults(false);
    }
  };

  const reloadAdminTestParticipants = async (testId) => {
    if (!testId) return;
    try {
      const res = await api.teacher.getTestParticipants(testId, 'admin');
      setAdminParticipantsList(res?.participants || (Array.isArray(res) ? res : []));
      setAdminTestResultsMeta(res?.test || null);
    } catch (err) {
      console.error(err);
    }
  };

  const adminCalculatedTestStats = useMemo(() => {
    const list = Array.isArray(adminParticipantsList) ? adminParticipantsList : [];
    if (!list.length) return { total: 0, avg: 0, max: 0, coins: 0 };
    const total = list.length;
    const sumScore = list.reduce((acc, p) => acc + (Number(p.score ?? p.score_percentage) || 0), 0);
    const avg = Math.round(sumScore / total);
    const max = Math.max(...list.map((p) => Number(p.score ?? p.score_percentage) || 0));
    const coins = list.reduce((acc, p) => acc + (Number(p.alreadyAwardedCoins) || 0), 0);
    return { total, avg, max, coins };
  }, [adminParticipantsList]);

  const handleAdminAwardTop3 = async () => {
    if (!selectedAdminTestForResults || !adminParticipantsList.length) {
      showToast(tr("Taqsimlash uchun o'quvchilar mavjud emas!", 'Нет учеников для награждения!'), 'warning');
      return;
    }
    setAdminDistributingCoins(true);
    try {
      const res = await api.teacher.distributeCoins(selectedAdminTestForResults.id, { mode: 'top3' });
      showToast(res.message || tr("Top 3 o'quvchiga coinlar muvaffaqiyatli berildi!", 'Койны успешно начислены Топ-3 ученикам!'), 'success');
      await reloadAdminTestParticipants(selectedAdminTestForResults.id);
      loadAdminData();
    } catch (err) {
      showToast(err.message || tr('Coin tarqatishda xatolik!', 'Ошибка при распределении койнов!'), 'error');
    } finally {
      setAdminDistributingCoins(false);
    }
  };

  const handleAdminAwardTopN = async () => {
    if (!selectedAdminTestForResults || !adminParticipantsList.length) {
      showToast(tr("Taqsimlash uchun o'quvchilar mavjud emas!", 'Нет учеников для награждения!'), 'warning');
      return;
    }
    const topN = Math.max(1, Number(adminTopNCount) || 3);
    const amount = Math.max(1, Number(adminTopNAmount) || 20);
    setAdminDistributingCoins(true);
    try {
      const res = await api.teacher.distributeCoins(selectedAdminTestForResults.id, {
        mode: 'top_n',
        topCount: topN,
        amount,
      });
      showToast(
        res.message || tr(`Top ${topN} faol ishtirokchiga +${amount} Diamond Coin berildi!`, `Топ-${topN} активным участникам начислено +${amount} Diamond-койнов!`),
        'success'
      );
      await reloadAdminTestParticipants(selectedAdminTestForResults.id);
      loadAdminData();
    } catch (err) {
      showToast(err.message || tr('Coin tarqatishda xatolik!', 'Ошибка при распределении койнов!'), 'error');
    } finally {
      setAdminDistributingCoins(false);
    }
  };

  const handleAdminAwardHighScorers = async (minScore = 70, amount = 20) => {
    if (!selectedAdminTestForResults || !adminParticipantsList.length) {
      showToast(tr("Taqsimlash uchun o'quvchilar mavjud emas!", 'Нет учеников для награждения!'), 'warning');
      return;
    }
    const eligible = adminParticipantsList.filter((p) => (Number(p.score ?? p.score_percentage) || 0) >= minScore);
    if (!eligible.length) {
      showToast(tr(`${minScore}% dan yuqori natija ko'rsatgan o'quvchilar yo'q!`, `Нет учеников с результатом от ${minScore}% и выше!`), 'info');
      return;
    }
    setAdminDistributingCoins(true);
    try {
      const res = await api.teacher.distributeCoins(selectedAdminTestForResults.id, { mode: 'high_scorers', minScore, amount });
      showToast(res.message || tr(`${eligible.length} nafar a'lochiga +${amount} coindan berildi!`, `${eligible.length} отличникам начислено по +${amount} койнов!`), 'success');
      await reloadAdminTestParticipants(selectedAdminTestForResults.id);
      loadAdminData();
    } catch (err) {
      showToast(err.message || tr('Coin tarqatishda xatolik!', 'Ошибка при распределении койнов!'), 'error');
    } finally {
      setAdminDistributingCoins(false);
    }
  };

  const handleAdminAwardAllParticipants = async (amount = 10) => {
    if (!selectedAdminTestForResults || !adminParticipantsList.length) {
      showToast(tr("Taqsimlash uchun o'quvchilar mavjud emas!", 'Нет учеников для награждения!'), 'warning');
      return;
    }
    setAdminDistributingCoins(true);
    try {
      const res = await api.teacher.distributeCoins(selectedAdminTestForResults.id, { mode: 'all', amount });
      showToast(res.message || tr(`Barcha qatnashchilarga +${amount} coindan berildi!`, `Всем участникам начислено по +${amount} койнов!`), 'success');
      await reloadAdminTestParticipants(selectedAdminTestForResults.id);
      loadAdminData();
    } catch (err) {
      showToast(err.message || tr('Coin tarqatishda xatolik!', 'Ошибка при распределении койнов!'), 'error');
    } finally {
      setAdminDistributingCoins(false);
    }
  };

  const handleAdminQuickRowCoin = async (p, amount) => {
    if (!selectedAdminTestForResults) return;
    try {
      await api.teacher.distributeCoins(selectedAdminTestForResults.id, {
        studentId: p.studentId,
        amount,
        reason: tr(
          `"${selectedAdminTestForResults.title}" testidagi a'lo natija (${p.score ?? p.score_percentage}%) uchun 💎`,
          `За отличный результат (${p.score ?? p.score_percentage}%) в тесте «${selectedAdminTestForResults.title}» 💎`
        ),
        resultId: p.resultId,
      });
      showToast(tr(`${p.fullName || p.student_name} ga +${amount} Diamond Coin berildi!`, `Ученику ${p.fullName || p.student_name} начислено +${amount} Diamond-койнов!`), 'success');
      await reloadAdminTestParticipants(selectedAdminTestForResults.id);
      loadAdminData();
    } catch (err) {
      showToast(err.message || tr('Coin berishda xatolik!', 'Ошибка при начислении койнов!'), 'error');
    }
  };

  const handleAdminOpenSubmissionDetail = async (p) => {
    setViewingAdminSubmission(p);
    setAdminSubmissionDetail(null);
    setAdminSubmissionModalLoading(true);
    try {
      const res = await api.teacher.getResultDetail(p.resultId);
      setAdminSubmissionDetail(res?.result || null);
    } catch (err) {
      console.error(err);
      setAdminSubmissionDetail({
        studentName: p.fullName || p.student_name,
        studentGrade: p.grade,
        score: p.score ?? p.score_percentage,
        timeSpentDisplay: p.timeStr || p.time_spent_display,
        submittedAt: p.date || p.submitted_at,
        coinsAwarded: p.alreadyAwardedCoins || 0,
        breakdown: [],
      });
    } finally {
      setAdminSubmissionModalLoading(false);
    }
  };

  const handleAdminAwardFromModal = async (e) => {
    e.preventDefault();
    if (!viewingAdminSubmission || !selectedAdminTestForResults) return;
    const amt = Number(adminModalCoinAmount);
    if (!amt || amt <= 0) {
      showToast(tr("Coin miqdorini to'g'ri kiriting!", 'Введите корректное количество койнов!'), 'warning');
      return;
    }
    try {
      await api.teacher.distributeCoins(selectedAdminTestForResults.id, {
        studentId: viewingAdminSubmission.studentId,
        amount: amt,
        reason: adminModalCoinReason || tr(`"${selectedAdminTestForResults.title}" testidagi faollik uchun 💎`, `За активность в тесте «${selectedAdminTestForResults.title}» 💎`),
        resultId: viewingAdminSubmission.resultId,
      });
      showToast(tr(`${viewingAdminSubmission.fullName || viewingAdminSubmission.student_name} ga +${amt} Diamond Coin berildi!`, `Ученику ${viewingAdminSubmission.fullName || viewingAdminSubmission.student_name} начислено +${amt} Diamond-койнов!`), 'success');
      await reloadAdminTestParticipants(selectedAdminTestForResults.id);
      loadAdminData();
      if (adminSubmissionDetail) {
        setAdminSubmissionDetail((prev) => ({
          ...prev,
          coinsAwarded: (prev?.coinsAwarded || 0) + amt,
        }));
      }
    } catch (err) {
      showToast(err.message || tr('Coin berishda xatolik!', 'Ошибка при начислении койнов!'), 'error');
    }
  };

  // Admin Delete Test Handler
  const handleDeleteTestAdmin = (testId, testTitle) => {
    setConfirmModalState({
      isOpen: true,
      title: tr("Testni o'chirish", 'Удалить тест'),
      message: tr(
        `"${testTitle || 'Ushbu test'}"ni butunlay o'chirib tashlamoqchimisiz? Barcha o'quvchilar natijalari ham o'chiriladi.`,
        `Вы уверены, что хотите полностью удалить тест «${testTitle || 'Этот тест'}»? Все результаты учеников также будут удалены.`
      ),
      danger: true,
      onConfirm: async () => {
        try {
          await api.teacher.deleteTest(testId);
          showToast(tr("Test muvaffaqiyatli o'chirildi!", 'Тест успешно удалён!'), 'success');
          setAdminTests((prev) => prev.filter((t) => t.id !== testId));
          setStats((prev) => ({ ...prev, testsCount: Math.max(0, (prev.testsCount || 1) - 1) }));
          setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
          loadAdminData();
        } catch (err) {
          showToast(err.message || tr("Testni o'chirishda xatolik!", 'Ошибка при удалении теста!'), 'error');
          setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  // Admin: 1-click toggle per-test student permission
  const handleToggleTestPermission = async (testObj) => {
    if (!testObj?.id) return;
    const currentlyAllowed = Boolean(testObj.isStudentAllowed ?? testObj.is_student_allowed);
    const nextAllowed = !currentlyAllowed;
    setSavingTestPermissionId(testObj.id);
    try {
      const res = await api.admin.setTestPermission(testObj.id, {
        isStudentAllowed: nextAllowed,
      });
      setAdminTests((prev) =>
        prev.map((item) =>
          item.id === testObj.id
            ? {
                ...item,
                isStudentAllowed: Boolean(res?.isStudentAllowed ?? nextAllowed),
                is_student_allowed: Boolean(res?.isStudentAllowed ?? nextAllowed),
                isActive: Boolean(res?.isActive ?? nextAllowed),
                is_active: Boolean(res?.isActive ?? nextAllowed),
                isUpcoming: Boolean(res?.isUpcoming),
                isExpired: Boolean(res?.isExpired),
                lockReason: res?.lockReason ?? null,
                lockMessage: res?.lockMessage ?? '',
              }
            : item
        )
      );
      showToast(
        res?.message ||
          (nextAllowed
            ? tr(`"${testObj.title}" testiga o'quvchilar uchun ruxsat berildi!`, `Доступ к тесту «${testObj.title}» для учеников открыт!`)
            : tr(`"${testObj.title}" testi o'quvchilar uchun yopildi!`, `Тест «${testObj.title}» закрыт для учеников!`)),
        nextAllowed ? 'success' : 'info'
      );
      loadAdminData();
    } catch (err) {
      showToast(err.message || tr("Test ruxsatini o'zgartirishda xatolik!", 'Ошибка изменения доступа к тесту!'), 'error');
    } finally {
      setSavingTestPermissionId(null);
    }
  };

  const handleOpenTestPermissionScheduleModal = (testObj) => {
    if (!testObj?.id) return;
    setPermissionScheduleModal({
      testId: testObj.id,
      title: testObj.title || tr('Test', 'Тест'),
      isStudentAllowed: Boolean(testObj.isStudentAllowed ?? testObj.is_student_allowed),
      startTimeIso: testObj.startTimeIso || '',
      endTimeIso: testObj.endTimeIso || '',
    });
  };

  const handleSaveTestPermissionSchedule = async (e, overrideClear = false) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!permissionScheduleModal?.testId) return;
    setSavingPermissionModal(true);
    try {
      const payload = overrideClear
        ? {
            isStudentAllowed: Boolean(permissionScheduleModal.isStudentAllowed),
            clearSchedule: true,
          }
        : {
            isStudentAllowed: Boolean(permissionScheduleModal.isStudentAllowed),
            startTime: permissionScheduleModal.startTimeIso || null,
            endTime: permissionScheduleModal.endTimeIso || null,
          };
      const res = await api.admin.setTestPermission(permissionScheduleModal.testId, payload);
      showToast(res?.message || tr('Test ruxsati va vaqti saqlandi!', 'Доступ и расписание теста сохранены!'), 'success');
      if (overrideClear) {
        setPermissionScheduleModal((prev) =>
          prev
            ? {
                ...prev,
                startTimeIso: '',
                endTimeIso: '',
              }
            : null
        );
      } else {
        setPermissionScheduleModal(null);
      }
      loadAdminData();
    } catch (err) {
      showToast(err.message || tr('Test vaqtini saqlashda xatolik!', 'Ошибка сохранения расписания теста!'), 'error');
    } finally {
      setSavingPermissionModal(false);
    }
  };

  // Admin: Global student tests portal toggle + schedule + bulk controls
  const handleToggleGlobalStudentTests = async () => {
    const nextEnabled = !studentTestsPolicy?.enabled;
    setSavingGlobalPolicy(true);
    try {
      const res = await api.admin.updateTestPermissionSettings({ enabled: nextEnabled });
      if (res?.policy) setStudentTestsPolicy(res.policy);
      if (res?.stats) setStudentTestsPolicyStats(res.stats);
      showToast(
        res?.message ||
          (nextEnabled
            ? tr("O'quvchilar testlar bo'limi ochildi!", 'Раздел тестов для учеников открыт!')
            : tr("O'quvchilar testlar bo'limi yopildi!", 'Раздел тестов для учеников закрыт!')),
        nextEnabled ? 'success' : 'warning'
      );
      loadAdminData();
    } catch (err) {
      showToast(err.message || tr("Portal ruxsatini o'zgartirishda xatolik!", 'Ошибка изменения доступа к порталу!'), 'error');
    } finally {
      setSavingGlobalPolicy(false);
    }
  };

  const handleSaveGlobalStudentTestsSchedule = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setSavingGlobalPolicy(true);
    try {
      const res = await api.admin.updateTestPermissionSettings({
        startTime: portalScheduleForm.startTimeIso || null,
        endTime: portalScheduleForm.endTimeIso || null,
      });
      if (res?.policy) {
        setStudentTestsPolicy(res.policy);
        setPortalScheduleForm({
          startTimeIso: res.policy.startTimeIso || '',
          endTimeIso: res.policy.endTimeIso || '',
        });
      }
      if (res?.stats) setStudentTestsPolicyStats(res.stats);
      showToast(res?.message || tr('Umumiy test oynasi vaqti saqlandi!', 'Общее окно времени тестов сохранено!'), 'success');
      loadAdminData();
    } catch (err) {
      showToast(err.message || tr('Umumiy vaqtni saqlashda xatolik!', 'Ошибка сохранения общего расписания!'), 'error');
    } finally {
      setSavingGlobalPolicy(false);
    }
  };

  const handleClearGlobalStudentTestsSchedule = async () => {
    setSavingGlobalPolicy(true);
    try {
      const res = await api.admin.updateTestPermissionSettings({ clearSchedule: true });
      if (res?.policy) setStudentTestsPolicy(res.policy);
      if (res?.stats) setStudentTestsPolicyStats(res.stats);
      setPortalScheduleForm({ startTimeIso: '', endTimeIso: '' });
      showToast(tr('Umumiy vaqt cheklovi olib tashlandi!', 'Общее ограничение по времени снято!'), 'info');
      loadAdminData();
    } catch (err) {
      showToast(err.message || tr('Vaqt cheklovini tozalashda xatolik!', 'Ошибка сброса ограничения по времени!'), 'error');
    } finally {
      setSavingGlobalPolicy(false);
    }
  };

  const handleBulkTestsPermission = async (allowFlag, onlyFiltered = false) => {
    const action = allowFlag
      ? onlyFiltered
        ? 'allow_filtered'
        : 'allow_all'
      : onlyFiltered
      ? 'lock_filtered'
      : 'lock_all';
    const payload = { action };
    if (onlyFiltered) {
      const ids = filteredAdminTests.map((t) => t.id).filter(Boolean);
      if (!ids.length) {
        showToast(tr('Amal bajarish uchun mos testlar topilmadi!', 'Подходящих тестов для действия не найдено!'), 'warning');
        return;
      }
      payload.testIds = ids;
    }
    setSavingGlobalPolicy(true);
    try {
      const res = await api.admin.updateTestPermissionSettings(payload);
      if (res?.policy) setStudentTestsPolicy(res.policy);
      if (res?.stats) setStudentTestsPolicyStats(res.stats);
      showToast(
        res?.message ||
          (allowFlag ? tr('Testlarga ruxsat berildi!', 'Доступ к тестам разрешён!') : tr('Testlar yopildi!', 'Тесты закрыты!')),
        allowFlag ? 'success' : 'info'
      );
      loadAdminData();
    } catch (err) {
      showToast(err.message || tr('Ommaviy ruxsatni saqlashda xatolik!', 'Ошибка массового обновления доступа!'), 'error');
    } finally {
      setSavingGlobalPolicy(false);
    }
  };

  const adminClassOptions = useMemo(() => {
    const set = new Set();
    (Array.isArray(classesList) ? classesList : []).forEach((c) => {
      const n = typeof c === 'string' ? c : c?.name || '';
      if (n) set.add(n);
    });
    (Array.isArray(adminTests) ? adminTests : []).forEach((t) => {
      if (Array.isArray(t.targetClasses)) {
        t.targetClasses.forEach((c) => {
          if (c && c.toLowerCase() !== 'barchasi') set.add(c);
        });
      } else if (t.grade && t.grade.toLowerCase() !== 'barchasi') {
        t.grade
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .forEach((c) => set.add(c));
      }
    });
    return Array.from(set);
  }, [classesList, adminTests]);

  // Filtered Admin Tests
  const filteredAdminTests = useMemo(() => {
    const list = Array.isArray(adminTests) ? adminTests : [];
    return list.filter((t) => {
      const q = adminTestSearch.toLowerCase();
      const tName = (t.teacherName || t.teacher_name || '').toLowerCase();
      const matchesSearch =
        (t.title && t.title.toLowerCase().includes(q)) ||
        (t.subject && t.subject.toLowerCase().includes(q)) ||
        tName.includes(q) ||
        (t.grade && t.grade.toLowerCase().includes(q));
      const matchesSubject =
        adminSubjectFilter === 'all' || t.subject === adminSubjectFilter;

      const rawGrade = (t.grade || '').trim();
      const isAllCls =
        Boolean(t.isAllClasses) ||
        !rawGrade ||
        rawGrade.toLowerCase() === 'barchasi' ||
        rawGrade.toLowerCase() === 'all';
      const targetList = Array.isArray(t.targetClasses)
        ? t.targetClasses
        : isAllCls
        ? []
        : rawGrade
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);

      let matchesClass = true;
      if (adminClassFilter === '__all_classes__') {
        matchesClass = isAllCls;
      } else if (adminClassFilter !== 'all') {
        matchesClass = isAllCls || targetList.includes(adminClassFilter);
      }

      return matchesSearch && matchesSubject && matchesClass;
    });
  }, [adminTests, adminTestSearch, adminSubjectFilter, adminClassFilter]);

  // Handle gate login
  const handleGateLogin = async (e) => {
    e.preventDefault();
    setGateError('');
    setGateLoading(true);
    try {
      const loggedUser = await login(gateUsername, gatePassword, 'admin');
      if (loggedUser.role !== 'admin') {
        setGateError(tr("Ushbu profil administrator huquqiga ega emas!", 'Этот профиль не имеет прав администратора!'));
        return;
      }
      showToast(tr("Administrator paneliga xush kelibsiz!", 'Добро пожаловать в панель администратора!'), 'success');
    } catch (err) {
      setGateError(err.message || tr('Login yoki parol xato!', 'Неверный логин или пароль!'));
    } finally {
      setGateLoading(false);
    }
  };

  // Add Teacher (supports optional avatar photo upload)
  const handleCreateTeacher = async (e) => {
    e.preventDefault();
    try {
      const fd = new FormData();
      fd.append('fullName', teacherForm.fullName.trim());
      fd.append('username', teacherForm.username.trim());
      fd.append('password', teacherForm.password.trim());
      fd.append('subject', teacherForm.subject);
      fd.append('phone', teacherForm.phone.trim());
      fd.append('bio', (teacherForm.bio || '').trim());
      if (teacherAvatarFile) {
        fd.append('avatar', teacherAvatarFile);
      }
      await api.admin.createTeacher(fd);
      showToast(tr("Yangi o'qituvchi muvaffaqiyatli qo'shildi!", 'Новый учитель успешно добавлен!'), 'success');
      setIsAddTeacherOpen(false);
      setTeacherForm({
        fullName: '',
        username: '',
        password: '123',
        subject: 'Matematika',
        phone: '',
        bio: '',
      });
      setTeacherAvatarFile(null);
      setTeacherAvatarPreview('');
      loadAdminData();
    } catch (err) {
      showToast(err.message || tr("O'qituvchi qo'shishda xatolik!", 'Ошибка при добавлении учителя!'), 'error');
    }
  };

  // Open Edit Teacher Profile Modal
  const handleOpenEditTeacher = (tch) => {
    setEditingTeacher(tch);
    setEditTeacherForm({
      fullName: tch.fullName || '',
      username: tch.username || '',
      password: '',
      subject: tch.subject && tch.subject !== 'Fan belgilanmagan' && tch.subject !== 'Предмет не указан' ? tch.subject : 'Matematika',
      phone: tch.rawPhone !== undefined ? tch.rawPhone : (tch.phone && tch.phone !== '-' ? tch.phone : ''),
      bio: tch.bio || '',
      avatarFile: null,
      avatarPreview: tch.avatarUrl || '',
      clearAvatar: false,
      hasCustomAvatar: Boolean(tch.hasCustomAvatar),
    });
    setShowEditTeacherPw(false);
  };

  const handleSaveEditTeacher = async (e) => {
    e.preventDefault();
    if (!editingTeacher) return;
    if (editTeacherForm.password && editTeacherForm.password.trim().length < 3) {
      showToast(tr("Yangi parol kamida 3 ta belgidan iborat bo'lishi kerak!", 'Новый пароль должен содержать минимум 3 символа!'), 'warning');
      return;
    }
    setSavingEditTeacher(true);
    try {
      const fd = new FormData();
      fd.append('fullName', editTeacherForm.fullName.trim());
      fd.append('username', editTeacherForm.username.trim());
      fd.append('subject', editTeacherForm.subject);
      fd.append('phone', editTeacherForm.phone.trim());
      fd.append('bio', editTeacherForm.bio.trim());
      if (editTeacherForm.password.trim()) {
        fd.append('password', editTeacherForm.password.trim());
      }
      if (editTeacherForm.clearAvatar) {
        fd.append('clearAvatar', 'true');
      }
      if (editTeacherForm.avatarFile) {
        fd.append('avatar', editTeacherForm.avatarFile);
      }
      await api.admin.updateUser(editingTeacher.id, fd);
      showToast(tr("O'qituvchi profili va ma'lumotlari yangilandi!", 'Профиль и данные учителя обновлены!'), 'success');
      setEditingTeacher(null);
      loadAdminData();
    } catch (err) {
      showToast(err.message || tr("O'qituvchini yangilashda xatolik!", 'Ошибка при обновлении учителя!'), 'error');
    } finally {
      setSavingEditTeacher(false);
    }
  };

  // Add Student
  const handleCreateStudent = async (e) => {
    e.preventDefault();
    try {
      await api.admin.createStudent(studentForm);
      showToast(tr("Yangi o'quvchi muvaffaqiyatli qo'shildi!", 'Новый ученик успешно добавлен!'), 'success');
      setIsAddStudentOpen(false);
      setStudentForm({
        fullName: '',
        username: '',
        password: '123',
        grade: '9-A',
        phone: '',
      });
      loadAdminData();
    } catch (err) {
      showToast(err.message || tr("O'quvchi qo'shishda xatolik!", 'Ошибка при добавлении ученика!'), 'error');
    }
  };

  // Add Class
  const handleCreateClass = async (e) => {
    e.preventDefault();
    try {
      await api.admin.createClass(classForm);
      showToast(tr("Yangi sinf muvaffaqiyatli qo'shildi!", 'Новый класс успешно добавлен!'), 'success');
      setIsAddClassOpen(false);
      setClassForm({ name: '', gradeLevel: 9, language: 'uz' });
      loadAdminData();
    } catch (err) {
      showToast(err.message || tr("Sinf qo'shishda xatolik!", 'Ошибка при добавлении класса!'), 'error');
    }
  };

  // Toggle Contact Message Status (Contacted / Pending)
  const handleToggleContactMessage = async (msgId) => {
    try {
      const res = await api.admin.toggleContactMessage(msgId);
      setContactMessages((prev) =>
        (Array.isArray(prev) ? prev : []).map((m) =>
          m.id === msgId ? { ...m, isContacted: res.isContacted, is_contacted: res.isContacted } : m
        )
      );
      showToast(
        res.isContacted
          ? tr("Murojaat 'Bog'lanildi' deb belgilandi!", "Заявка отмечена как «Связались»!")
          : tr("Murojaat 'Kutilmoqda' holatiga qaytarildi", "Заявка возвращена в статус «Ожидает»"),
        'info'
      );
    } catch (err) {
      showToast(err.message || tr("Holatni o'zgartirishda xatolik!", 'Ошибка изменения статуса!'), 'error');
    }
  };

  // Batch Class Award Handler (Supports active class treasury, active students, or both)
  const handleBatchClassAward = async (e) => {
    e.preventDefault();
    if (!batchClassForm.className) {
      showToast(tr('Sinfni tanlang!', 'Выберите класс!'), 'warning');
      return;
    }
    if (!Number(batchClassForm.amount)) {
      showToast(tr('Coin miqdorini kiriting!', 'Введите количество койнов!'), 'warning');
      return;
    }
    try {
      const res = await api.admin.awardCoins({
        className: batchClassForm.className,
        awardScope: batchClassForm.awardScope || 'class_only',
        amount: Number(batchClassForm.amount),
        reason: batchClassForm.reason,
      });
      showToast(
        res.message || tr(`${batchClassForm.className} sinfiga coinlar muvaffaqiyatli taqsimlandi!`, `Койны для класса ${localizeGrade(batchClassForm.className, language)} успешно начислены!`),
        'success'
      );
      setIsBatchClassRewardOpen(false);
      loadAdminData();
    } catch (err) {
      showToast(err.message || tr('Sinfga coin berishda xatolik!', 'Ошибка при начислении койнов классу!'), 'error');
    }
  };

  // Tier badge helper for student coins
  const getTierBadge = (coins) => {
    const val = Number(coins) || 0;
    if (val >= 100) return { cls: 'diamond', label: tr('💎 Diamond Liga', '💎 Лига Diamond') };
    if (val >= 50) return { cls: 'gold', label: tr('🥇 Gold Liga', '🥇 Лига Gold') };
    if (val >= 20) return { cls: 'silver', label: tr('🥈 Silver Liga', '🥈 Лига Silver') };
    return { cls: 'bronze', label: tr('🥉 Bronze Liga', '🥉 Лига Bronze') };
  };

  // Quick single student award
  const handleQuickStudentAward = async (studentId, amount, reason = tr('Dars va testlardagi faollik uchun', 'За активность на уроках и в тестах')) => {
    try {
      const res = await api.admin.awardCoins({
        studentId,
        student_id: studentId,
        amount: Number(amount),
        reason,
      });
      showToast(res.message || tr(`${amount > 0 ? '+' : ''}${amount} coin muvaffaqiyatli taqdim etildi!`, `${amount > 0 ? '+' : ''}${amount} койнов успешно начислено!`), 'success');
      loadAdminData();
    } catch (err) {
      showToast(err.message || tr('Xatolik yuz berdi!', 'Произошла ошибка!'), 'error');
    }
  };

  const handleOpenAwardCoinsModal = ({ grade = 'all', onlyActive = true, preselectIds = [] } = {}) => {
    setAwardStudentGradeFilter(grade);
    setAwardOnlyActive(onlyActive);
    setAwardStudentSearch('');
    setSelectedAwardStudentIds(preselectIds);
    setIsAwardCoinsOpen(true);
  };

  const awardCandidateStudents = useMemo(() => {
    const pool = (Array.isArray(coinRankings) && coinRankings.length ? coinRankings : students) || [];
    const sorted = [...pool].sort(
      (a, b) =>
        (Number(b.testsPassed) || 0) - (Number(a.testsPassed) || 0) ||
        (Number(b.coins) || 0) - (Number(a.coins) || 0)
    );
    const q = awardStudentSearch.trim().toLowerCase();
    return sorted.filter((s) => {
      if (awardOnlyActive && (Number(s.testsPassed) || 0) <= 0) return false;
      if (awardStudentGradeFilter !== 'all' && s.grade !== awardStudentGradeFilter) return false;
      if (q) {
        const hay = `${s.fullName || ''} ${s.username || ''} ${s.grade || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [coinRankings, students, awardStudentSearch, awardOnlyActive, awardStudentGradeFilter]);

  const handleToggleAwardStudent = (studentId) => {
    setSelectedAwardStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  const handleSelectTopActiveForAward = (n) => {
    const topIds = awardCandidateStudents.slice(0, Math.max(1, Number(n) || 3)).map((s) => s.id);
    if (!topIds.length) {
      showToast(tr("Filtrga mos faol o'quvchilar topilmadi!", 'Подходящие активные ученики не найдены!'), 'warning');
      return;
    }
    setSelectedAwardStudentIds(topIds);
  };

  // Award Coins (Supports single student OR multi-select batch studentIds[])
  const handleAwardCoins = async (e) => {
    e.preventDefault();
    const targetIds =
      selectedAwardStudentIds.length > 0
        ? selectedAwardStudentIds
        : awardCoinsForm.studentId
        ? [Number(awardCoinsForm.studentId)]
        : [];
    if (!targetIds.length) {
      showToast(tr("Kamida bitta o'quvchini belgilang!", 'Выберите хотя бы одного ученика!'), 'warning');
      return;
    }
    if (!Number(awardCoinsForm.amount)) {
      showToast(tr("Coin miqdorini to'g'ri kiriting!", 'Введите корректное количество койнов!'), 'warning');
      return;
    }
    try {
      const payload =
        targetIds.length === 1
          ? {
              studentId: targetIds[0],
              student_id: targetIds[0],
              amount: Number(awardCoinsForm.amount),
              reason: awardCoinsForm.reason,
            }
          : {
              studentIds: targetIds,
              amount: Number(awardCoinsForm.amount),
              reason: awardCoinsForm.reason,
            };
      const res = await api.admin.awardCoins(payload);
      showToast(res.message || tr('Coinlar muvaffaqiyatli berildi!', 'Койны успешно начислены!'), 'success');
      setIsAwardCoinsOpen(false);
      setSelectedAwardStudentIds([]);
      setAwardCoinsForm({
        studentId: '',
        amount: 15,
        reason: tr('Test va darslarda faol qatnashgani uchun ⚡', 'За активное участие в тестах и на уроках ⚡'),
      });
      loadAdminData();
    } catch (err) {
      showToast(err.message || tr('Coin berishda xatolik!', 'Ошибка при начислении койнов!'), 'error');
    }
  };

  // Delete User (Teacher or Student)
  const handleDeleteUser = (u) => {
    const roleLabel = u.role === 'teacher' ? tr("o'qituvchi", 'учитель') : tr("o'quvchi", 'ученик');
    setConfirmModalState({
      isOpen: true,
      title: tr(`${u.fullName || u.username} ni o'chirish`, `Удалить ${u.fullName || u.username}`),
      message: tr(
        `Haqiqatan ham ushbu hisobni (${roleLabel}) butunlay o'chirmoqchimisiz?`,
        `Вы уверены, что хотите полностью удалить этот аккаунт (${roleLabel})?`
      ),
      danger: true,
      onConfirm: async () => {
        try {
          await api.admin.deleteUser(u.id);
          showToast(tr("Foydalanuvchi o'chirildi!", 'Пользователь удалён!'), 'info');
          setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
          loadAdminData();
        } catch (err) {
          showToast(err.message || tr("O'chirishda xatolik!", 'Ошибка при удалении!'), 'error');
        }
      },
    });
  };

  // Delete Class
  const handleDeleteClass = (cls) => {
    setConfirmModalState({
      isOpen: true,
      title: tr(`${cls.name} sinfini o'chirish`, `Удалить класс ${localizeGrade(cls.name, language)}`),
      message: tr('Ushbu sinfni o\'chirishni tasdiqlaysizmi?', 'Вы подтверждаете удаление этого класса?'),
      danger: true,
      onConfirm: async () => {
        try {
          await api.admin.deleteClass(cls.id);
          showToast(tr("Sinf o'chirildi!", 'Класс удалён!'), 'info');
          setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
          loadAdminData();
        } catch (err) {
          showToast(err.message || tr("O'chirishda xatolik!", 'Ошибка при удалении!'), 'error');
        }
      },
    });
  };

  // Delete Contact Message
  const handleDeleteContactMessage = async (id) => {
    try {
      await api.admin.deleteContactMessage(id);
      showToast(tr("Murojaat o'chirildi", 'Заявка удалена'), 'info');
      setContactMessages((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      showToast(err.message || tr("O'chirishda xatolik!", 'Ошибка при удалении!'), 'error');
    }
  };

  // Filtered teachers
  const filteredTeachers = useMemo(() => {
    const list = Array.isArray(teachers) ? teachers : [];
    return list.filter((t) => {
      const q = teacherSearch.toLowerCase();
      return (
        t.fullName?.toLowerCase().includes(q) ||
        t.username?.toLowerCase().includes(q) ||
        t.subject?.toLowerCase().includes(q)
      );
    });
  }, [teachers, teacherSearch]);

  // Filtered students
  const filteredStudents = useMemo(() => {
    const list = Array.isArray(students) ? students : [];
    return list.filter((s) => {
      const q = studentSearch.toLowerCase();
      const matchesSearch =
        s.fullName?.toLowerCase().includes(q) ||
        s.username?.toLowerCase().includes(q) ||
        s.grade?.toLowerCase().includes(q);
      const matchesGrade =
        selectedGradeFilter === 'all' || s.grade === selectedGradeFilter;
      return matchesSearch && matchesGrade;
    });
  }, [students, studentSearch, selectedGradeFilter]);

  // Filtered Coin Leaderboard
  const filteredCoinRankings = useMemo(() => {
    return (Array.isArray(coinRankings) ? coinRankings : []).filter((item) => {
      const q = coinSearchQuery.toLowerCase();
      const nameMatch =
        (item.fullName && item.fullName.toLowerCase().includes(q)) ||
        (item.full_name && item.full_name.toLowerCase().includes(q)) ||
        (item.username && item.username.toLowerCase().includes(q));
      const gradeMatch =
        coinGradeFilter === 'all' || item.grade === coinGradeFilter;
      const activeMatch =
        !coinOnlyActiveFilter || (Number(item.testsPassed) || 0) > 0;
      const coins = item.coins || 0;
      let tierMatch = true;
      if (coinTierFilter === 'diamond') tierMatch = coins >= 100;
      else if (coinTierFilter === 'gold') tierMatch = coins >= 50 && coins < 100;
      else if (coinTierFilter === 'silver') tierMatch = coins >= 20 && coins < 50;
      else if (coinTierFilter === 'bronze') tierMatch = coins >= 1 && coins < 20;
      else if (coinTierFilter === 'zero') tierMatch = coins === 0;

      return nameMatch && gradeMatch && activeMatch && tierMatch;
    });
  }, [coinRankings, coinSearchQuery, coinGradeFilter, coinOnlyActiveFilter, coinTierFilter]);

  const liveViewingClassInfo = useMemo(() => {
    if (!viewingClassStudents) return null;
    const latest = (Array.isArray(classesList) ? classesList : []).find(
      (c) => c.id === viewingClassStudents.id || c.name === viewingClassStudents.name
    );
    return latest || viewingClassStudents;
  }, [viewingClassStudents, classesList]);

  const viewingClassRoster = useMemo(() => {
    if (!liveViewingClassInfo) return [];
    const pool = (Array.isArray(coinRankings) && coinRankings.length ? coinRankings : students) || [];
    return pool
      .filter((s) => s.grade === liveViewingClassInfo.name)
      .sort(
        (a, b) =>
          (Number(b.testsPassed) || 0) - (Number(a.testsPassed) || 0) ||
          (Number(b.coins) || 0) - (Number(a.coins) || 0)
      );
  }, [liveViewingClassInfo, coinRankings, students]);

  // Unique grades for filter
  const availableGrades = useMemo(() => {
    const list = Array.isArray(classesList) ? classesList : [];
    const stds = Array.isArray(students) ? students : [];
    const set = new Set();
    list.forEach((c) => {
      if (c && c.name) set.add(c.name);
    });
    stds.forEach((s) => {
      if (s && s.grade) set.add(s.grade);
    });
    return Array.from(set).sort();
  }, [classesList, students]);

  // If not admin, show Auth Gate
  if (!isAdmin) {
    return (
      <div className="portal-gate-container">
        <div className="login-card admin-theme">
          <div className="text-center" style={{ marginBottom: '1.75rem' }}>
            <div className="gate-emblem-wrap emblem-admin">
              <ShieldCheck size={36} />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider mb-2.5" style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.35)', color: '#f59e0b' }}>
              <Lock size={12} /> {tr('Xavfsiz Boshqaruv', 'Защищённое управление')}
            </div>
            <h2 className="text-2xl font-black text-white" style={{ fontFamily: 'Cinzel, serif', letterSpacing: '0.5px' }}>
              {tr('Administrator Kirishi', 'Вход для администратора')}
            </h2>
            <p className="text-xs text-slate-400" style={{ marginTop: '0.35rem' }}>
              {tr(
                "Diamond School tizimini to'liq boshqarish uchun admin hisobingizga kiring.",
                'Войдите в аккаунт администратора для полного управления системой Diamond School.'
              )}
            </p>
          </div>

          {/* Demo credentials helper chip */}
          <div className="demo-creds-box">
            <div className="demo-title">
              <ShieldCheck size={13} style={{ color: '#f59e0b' }} /> {tr('Test uchun tezkor kirish:', 'Быстрый вход для проверки:')}
            </div>
            <div className="demo-chips-row">
              <button
                type="button"
                className="demo-chip-btn"
                onClick={() => {
                  setGateUsername('admin');
                  setGatePassword('123');
                }}
              >
                <span>👑 admin / 123</span>
                <span style={{ fontSize: '10px', opacity: 0.6 }}>{tr('(bosish)', '(нажать)')}</span>
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
              <label className="input-label">{tr('Admin logini', 'Логин администратора')}</label>
              <div className="input-with-icon">
                <User size={16} className="input-icon" />
                <input
                  type="text"
                  className="clean-input"
                  value={gateUsername}
                  onChange={(e) => setGateUsername(e.target.value)}
                  placeholder="admin"
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
              className="btn btn-warning w-full py-3.5 font-bold flex items-center justify-center gap-2 shadow-lg"
              disabled={gateLoading}
              style={{ marginTop: '1.25rem' }}
            >
              {gateLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> {tr('Tekshirilmoqda...', 'Проверка...')}
                </>
              ) : (
                <>
                  <ShieldCheck size={18} /> {tr('Boshqaruv Paneliga Kirish', 'Войти в панель управления')}
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-portal-wrapper space-y-6 pb-12">
      {/* Header with Title and Quick KPI Cards */}
      <div className="dashboard-header flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2.5">
            <ShieldCheck className="text-amber-400" size={28} />
            {tr('Administrator Paneli', 'Панель администратора')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            {tr(
              "Maktab o'quv jarayoni, pedagoglar jamoasi va barcha sinflar to'liq nazorati",
              'Полный контроль учебного процесса школы, команды педагогов и всех классов'
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            className="btn btn-diamond-cyan btn-sm flex items-center gap-1.5 font-bold shadow-md"
            onClick={handleAdminNewTest}
          >
            <Plus size={15} /> {tr("Yangi Test & Savol Qo'shish", 'Добавить тест и вопросы')}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={loadAdminData}
            title={tr('Yangilash', 'Обновить')}
          >
            {loadingData ? <Loader2 size={15} className="animate-spin" /> : tr("Ma'lumotlarni Yangilash", 'Обновить данные')}
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="admin-kpi-grid">
        <div className="admin-kpi-card">
          <div className="admin-kpi-icon kpi-blue">
            <ChalkboardTeacher size={24} />
          </div>
          <div>
            <div className="admin-kpi-val">{stats.teachersCount || teachers.length}</div>
            <div className="admin-kpi-label">{tr("Jami O'qituvchilar", 'Всего учителей')}</div>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-icon kpi-green">
            <Users size={24} />
          </div>
          <div>
            <div className="admin-kpi-val">{stats.studentsCount || students.length}</div>
            <div className="admin-kpi-label">{tr("Jami O'quvchilar", 'Всего учеников')}</div>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-icon kpi-amber">
            <School size={24} />
          </div>
          <div>
            <div className="admin-kpi-val">{classesList.length}</div>
            <div className="admin-kpi-label">{tr('Faol Sinflar', 'Активных классов')}</div>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-icon kpi-blue">
            <FileCheck2 size={24} />
          </div>
          <div>
            <div className="admin-kpi-val">{adminTests.length || stats.totalTests || stats.testsCount || 0}</div>
            <div className="admin-kpi-label">{tr('Jami Testlar', 'Всего тестов')}</div>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-icon kpi-green">
            <TrendingUp size={24} />
          </div>
          <div>
            <div className="admin-kpi-val">{stats.avgScore || 0}%</div>
            <div className="admin-kpi-label">{tr("O'rtacha Natija", 'Средний балл')}</div>
          </div>
        </div>
      </div>

      {/* Two-Column App Layout: Left Sidebar + Right Content */}
      <div className="portal-app-layout">
        {/* Left Sidebar */}
        <aside className="portal-sidebar">
          <div className="portal-sidebar-userbox">
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
            <div className="portal-sidebar-info">
              <div className="portal-sidebar-name">{localizeUserFullName(user?.fullName, language) || tr('Administrator', 'Администратор')}</div>
              <div className="portal-sidebar-role" style={{ color: '#f59e0b' }}>
                <i className="fa-solid fa-key" style={{ marginRight: '4px' }}></i>
                {tr('Bosh Administrator', 'Главный администратор')}
              </div>
            </div>
          </div>

          <div className="portal-sidebar-nav-title">{tr("ASOSIY BO'LIMLAR", 'ОСНОВНЫЕ РАЗДЕЛЫ')}</div>
          <nav className="portal-sidebar-nav">
            <button
              type="button"
              className={`portal-nav-btn ${activeTab === 'teachers' ? 'active' : ''}`}
              onClick={() => setActiveTab('teachers')}
            >
              <div className="portal-nav-icon">
                <ChalkboardTeacher size={18} />
              </div>
              <span className="portal-nav-label">{tr("O'qituvchilar", 'Учителя')}</span>
              <span className="portal-nav-badge">{teachers.length}</span>
            </button>

            <button
              type="button"
              className={`portal-nav-btn ${activeTab === 'students' ? 'active' : ''}`}
              onClick={() => setActiveTab('students')}
            >
              <div className="portal-nav-icon">
                <GraduationCap size={18} />
              </div>
              <span className="portal-nav-label">{tr("O'quvchilar", 'Ученики')}</span>
              <span className="portal-nav-badge">{students.length}</span>
            </button>

            <button
              type="button"
              className={`portal-nav-btn ${activeTab === 'tests' && testViewMode !== 'builder' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('tests');
                setTestViewMode('list');
                setEditingAdminTest(null);
              }}
            >
              <div className="portal-nav-icon">
                <FileCheck2 size={18} />
              </div>
              <span className="portal-nav-label">{tr('Testlar Boshqaruvi', 'Управление тестами')}</span>
              <span className="portal-nav-badge">{adminTests.length}</span>
            </button>

            <button
              type="button"
              className={`portal-nav-btn ${activeTab === 'tests' && testViewMode === 'builder' && !editingAdminTest ? 'active' : ''}`}
              onClick={handleAdminNewTest}
            >
              <div className="portal-nav-icon">
                <Plus size={18} />
              </div>
              <span className="portal-nav-label">{tr("Test & Savol Qo'shish", 'Создать тест и вопросы')}</span>
            </button>

            <button
              type="button"
              className={`portal-nav-btn nav-coin ${activeTab === 'coins' ? 'active' : ''}`}
              onClick={() => setActiveTab('coins')}
            >
              <div className="portal-nav-icon">
                <Coins size={18} />
              </div>
              <span className="portal-nav-label">{tr('Coinlar & Reyting', 'Койны и рейтинг')}</span>
            </button>

            <button
              type="button"
              className={`portal-nav-btn ${activeTab === 'classes' ? 'active' : ''}`}
              onClick={() => setActiveTab('classes')}
            >
              <div className="portal-nav-icon">
                <School size={18} />
              </div>
              <span className="portal-nav-label">{tr('Sinflar Boshqaruvi', 'Управление классами')}</span>
            </button>

            <button
              type="button"
              className={`portal-nav-btn ${activeTab === 'showcase' ? 'active' : ''}`}
              onClick={() => setActiveTab('showcase')}
            >
              <div className="portal-nav-icon">
                <Mail size={18} />
              </div>
              <span className="portal-nav-label">{tr("Arizalar & Bog'lanish", 'Заявки и контакты')}</span>
              {(Array.isArray(contactMessages) ? contactMessages : []).filter((m) => !m.is_read).length > 0 && (
                <span className="portal-nav-badge bg-rose-500 text-white font-bold">
                  {(Array.isArray(contactMessages) ? contactMessages : []).filter((m) => !m.is_read).length}
                </span>
              )}
            </button>
          </nav>
        </aside>

        {/* Right Main Content Area */}
        <main className="portal-main-area">
          {/* TAB 0: ALL TESTS MANAGEMENT (LIST / BUILDER / RESULTS) */}
          {activeTab === 'tests' && testViewMode === 'builder' && (
            <AdminTestBuilder
              editingTestId={editingAdminTest?.id || null}
              initialTestSummary={editingAdminTest}
              classesList={classesList}
              teachersList={teachers}
              studentsList={coinRankings.length ? coinRankings : students}
              subjectsList={subjectsList}
              currentUser={user}
              onSaved={() => {
                setEditingAdminTest(null);
                setTestViewMode('list');
                loadAdminData();
              }}
              onCancel={() => {
                setEditingAdminTest(null);
                setTestViewMode('list');
              }}
            />
          )}

          {activeTab === 'tests' && testViewMode === 'results' && (
            <div className="space-y-6 animate-fade-in">
              <div className="test-builder-card space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="btn btn-secondary btn-xs flex items-center gap-1 border-slate-700 hover:border-cyan-400"
                      onClick={() => setTestViewMode('list')}
                    >
                      <ArrowLeft size={14} /> {tr('Orqaga', 'Назад')}
                    </button>
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-md">
                      <Trophy size={20} />
                    </div>
                    <div>
                      <h3 className="test-builder-header-title text-base sm:text-lg">
                        {(selectedAdminTestForResults?.title || adminTestResultsMeta?.title)
                          ? tr(
                              `"${selectedAdminTestForResults?.title || adminTestResultsMeta?.title}" natijalari`,
                              `Результаты: «${selectedAdminTestForResults?.title || adminTestResultsMeta?.title}»`
                            )
                          : tr('Test Natijalari Jurnali', 'Журнал результатов тестов')}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {tr(
                          'Admin nazorati: test natijalari tahlili va cheklovsiz Diamond Coinlar taqsimlash',
                          'Контроль администратора: анализ результатов и распределение Diamond-койнов без ограничений'
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-400 font-semibold whitespace-nowrap hidden sm:inline">
                      {tr('Test:', 'Тест:')}
                    </label>
                    <select
                      className="clean-select text-xs font-semibold min-w-[220px] w-auto"
                      value={selectedAdminTestForResults?.id || ''}
                      onChange={(e) => {
                        const t = adminTests.find((item) => String(item.id) === e.target.value);
                        if (t) handleAdminViewResults(t);
                      }}
                    >
                      <option value="">{tr('-- Testni tanlang --', '-- Выберите тест --')}</option>
                      {adminTests.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title} ({t.submissionsCount ?? t.submissions_count ?? 0} {tr('ta natija', 'рез.')})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* KPI Summary Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="results-kpi-card">
                    <div className="results-kpi-icon bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                      <Users size={20} />
                    </div>
                    <div>
                      <div className="text-lg font-black text-white">{adminCalculatedTestStats.total} {tr('nafar', 'уч.')}</div>
                      <div className="text-[11px] text-slate-400 font-medium">{tr('Jami Topshirganlar', 'Всего сдавших')}</div>
                    </div>
                  </div>

                  <div className="results-kpi-card">
                    <div className="results-kpi-icon bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      <TrendingUp size={20} />
                    </div>
                    <div>
                      <div className="text-lg font-black text-emerald-400">{adminCalculatedTestStats.avg}%</div>
                      <div className="text-[11px] text-slate-400 font-medium">{tr("O'rtacha Ko'rsatkich", 'Средний показатель')}</div>
                    </div>
                  </div>

                  <div className="results-kpi-card">
                    <div className="results-kpi-icon bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      <Crown size={20} />
                    </div>
                    <div>
                      <div className="text-lg font-black text-amber-400">{adminCalculatedTestStats.max}%</div>
                      <div className="text-[11px] text-slate-400 font-medium">{tr('Eng Yuqori Natija', 'Лучший результат')}</div>
                    </div>
                  </div>

                  <div className="results-kpi-card">
                    <div className="results-kpi-icon bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                      <Coins size={20} />
                    </div>
                    <div>
                      <div className="text-lg font-black text-indigo-300">
                        {adminTestResultsMeta?.totalCoinsAwarded || adminCalculatedTestStats.coins} 💎
                      </div>
                      <div className="text-[11px] text-slate-400 font-medium">{tr('Berilgan Coinlar', 'Выдано койнов')}</div>
                    </div>
                  </div>
                </div>

                {/* Admin Batch Coin Distribution Bar */}
                {adminParticipantsList.length > 0 && (
                  <div className="results-coin-bar flex-col items-stretch gap-3">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center flex-shrink-0">
                          <Sparkles size={16} />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white flex items-center gap-1.5 flex-wrap">
                            <span>{tr("Test Qatnashchilarini Rag'batlantirish", 'Поощрение участников теста')}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-black">
                              {tr('Admin Mukofotlari', 'Награды админа')}
                            </span>
                            {Number(adminTestResultsMeta?.rewardTopCount) > 0 && Number(adminTestResultsMeta?.rewardCoinsAmount) > 0 && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-bold">
                                ⚡ {tr(
                                  `Avto-bonus: Top ${adminTestResultsMeta.rewardTopCount} faolga +${adminTestResultsMeta.rewardCoinsAmount} 💎`,
                                  `Авто-бонус: Топ-${adminTestResultsMeta.rewardTopCount} активным +${adminTestResultsMeta.rewardCoinsAmount} 💎`
                                )} ({adminTestResultsMeta.rewardSlotsUsed || 0}/{adminTestResultsMeta.rewardTopCount})
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {tr(
                              "Yuqori ko'rsatkichli va faol qatnashgan o'quvchilarni 1 bosishda mukofotlang (takroriy urinishda ikki marta to'lanmaydi)",
                              'Награждайте лучших и активных участников в 1 клик (за повторные попытки двойная оплата не начисляется)'
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          className="btn-batch-award-gold"
                          onClick={handleAdminAwardTop3}
                          disabled={adminDistributingCoins}
                        >
                          <Crown size={14} />
                          <span>{tr("Top 3 O'quvchiga Coin (+50, +30, +20)", 'Койны Топ-3 (+50, +30, +20)')}</span>
                        </button>

                        <button
                          type="button"
                          className="btn-batch-award-cyan"
                          onClick={() => handleAdminAwardHighScorers(70, 20)}
                          disabled={adminDistributingCoins}
                        >
                          <Award size={14} />
                          <span>{tr("70%+ A'lochilarga (+20)", '70%+ Отличникам (+20)')}</span>
                        </button>

                        <button
                          type="button"
                          className="btn-batch-award-indigo"
                          onClick={() => handleAdminAwardAllParticipants(10)}
                          disabled={adminDistributingCoins}
                        >
                          <Coins size={14} />
                          <span>{tr('Barcha Ishtirokchilarga (+10)', 'Всем участникам (+10)')}</span>
                        </button>
                      </div>
                    </div>

                    {/* Custom Top-N active participants distribution */}
                    <div className="flex flex-wrap items-center gap-2 pt-2.5 border-t border-slate-800/80 text-xs">
                      <span className="text-slate-300 font-bold flex items-center gap-1">
                        <Zap size={13} className="text-amber-400" /> {tr('Top N faol qatnashchiga:', 'Топ-N активным участникам:')}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-400">{tr('Soni:', 'Кол-во:')}</span>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          className="clean-input text-xs w-16 h-8 min-h-0 font-bold text-center"
                          value={adminTopNCount}
                          onChange={(e) => setAdminTopNCount(Math.max(1, Number(e.target.value) || 1))}
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-400">{tr('Coin:', 'Койн:')}</span>
                        <input
                          type="number"
                          min={1}
                          max={500}
                          className="clean-input text-xs w-20 h-8 min-h-0 font-bold text-amber-300 text-center"
                          value={adminTopNAmount}
                          onChange={(e) => setAdminTopNAmount(Math.max(1, Number(e.target.value) || 1))}
                        />
                      </div>
                      <button
                        type="button"
                        className="btn btn-warning btn-xs font-bold text-slate-950 h-8 px-3 flex items-center gap-1"
                        onClick={handleAdminAwardTopN}
                        disabled={adminDistributingCoins}
                      >
                        <Coins size={13} />
                        <span>{tr(`Top ${adminTopNCount} faolga +${adminTopNAmount} Coin berish`, `Выдать Топ-${adminTopNCount} +${adminTopNAmount} койнов`)}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {loadingAdminResults ? (
                <div className="text-center py-16 text-slate-400 text-xs flex items-center justify-center gap-2">
                  <Loader2 size={20} className="animate-spin text-cyan-400" /> {tr('Natijalar yuklanmoqda...', 'Загрузка результатов...')}
                </div>
              ) : (
                <div className="teacher-tx-table-wrap">
                  <table className="diamond-table w-full text-left">
                    <thead>
                      <tr>
                        <th className="w-14">{tr("O'rin", 'Место')}</th>
                        <th>{tr("O'quvchi", 'Ученик')}</th>
                        <th>{tr('Sinfi', 'Класс')}</th>
                        <th>{tr('Ball / Natija', 'Балл / Результат')}</th>
                        <th>{tr('Sarflangan Vaqt', 'Затрачено времени')}</th>
                        <th>{tr('Berilgan Coin', 'Начислено койнов')}</th>
                        <th className="text-center">{tr('Tezkor Coin', 'Быстрые койны')}</th>
                        <th className="text-right">{tr('Tahlil', 'Разбор')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminParticipantsList.map((p, idx) => {
                        const rank = p.rank || idx + 1;
                        const score = Number(p.score ?? p.score_percentage) || 0;
                        const coinsAwarded = Number(p.alreadyAwardedCoins) || 0;
                        return (
                          <tr key={p.resultId || p.id || idx}>
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
                            <td>
                              <div className="flex items-center gap-2.5">
                                <img
                                  src={p.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${p.username || p.student_name}&backgroundColor=0284c7`}
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
                            <td>
                              <span className="tx-class-badge">{localizeGrade(p.grade, language)}</span>
                            </td>
                            <td>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className={`font-black text-xs ${score >= 70 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                                    {score}%
                                  </span>
                                  <span className="text-[11px] text-slate-400">
                                    ({p.correctAnswers ?? p.correctCount ?? 0} / {p.totalQuestions ?? p.totalCount ?? 10} {tr('ta', '')})
                                  </span>
                                </div>
                                <div className="w-24 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${score >= 70 ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : score >= 50 ? 'bg-gradient-to-r from-amber-500 to-yellow-400' : 'bg-gradient-to-r from-rose-500 to-pink-500'}`}
                                    style={{ width: `${Math.min(100, Math.max(5, score))}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="text-xs text-slate-300 font-medium">{p.timeStr || p.time_spent_display || tr('12 daq', '12 мин')}</div>
                              <div className="text-[10px] text-slate-500">{p.date || p.submitted_at || tr('Bugun', 'Сегодня')}</div>
                            </td>
                            <td>
                              {coinsAwarded > 0 ? (
                                <span className="tx-amount-badge">
                                  <span>💎</span>
                                  <span>+{coinsAwarded} {tr('Coin', 'Койн')}</span>
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-500 italic">{tr('Hali berilmagan', 'Не начислено')}</span>
                              )}
                            </td>
                            <td className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                {[10, 20, 50].map((amt) => (
                                  <button
                                    key={amt}
                                    type="button"
                                    className="row-quick-coin-btn"
                                    onClick={() => handleAdminQuickRowCoin(p, amt)}
                                  >
                                    +{amt}
                                  </button>
                                ))}
                              </div>
                            </td>
                            <td className="text-right">
                              <button
                                type="button"
                                className="btn btn-secondary btn-xs text-[11px] border-slate-700 hover:border-cyan-400"
                                onClick={() => handleAdminOpenSubmissionDetail(p)}
                              >
                                {tr('Batafsil', 'Подробнее')}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {adminParticipantsList.length === 0 && (
                        <tr>
                          <td colSpan={8} className="text-center py-12 text-slate-400 text-xs">
                            {tr("Ushbu test bo'yicha hali o'quvchilar natijalari mavjud emas.", 'По этому тесту ещё нет результатов учеников.')}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'tests' && testViewMode === 'list' && (
            <div className="space-y-4 animate-fade-in">
              {/* ADMIN: GLOBAL & BULK STUDENT TEST PERMISSION & SCHEDULE CONTROL PANEL */}
              <div
                data-testid="admin-test-permission-panel"
                className={`p-4 sm:p-5 rounded-2xl border transition-all space-y-4 ${
                  studentTestsPolicy.portalOpen
                    ? 'bg-slate-900/80 border-cyan-500/30 shadow-lg shadow-cyan-500/5'
                    : 'bg-rose-950/20 border-rose-500/40 shadow-lg shadow-rose-500/10'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${
                          studentTestsPolicy.portalOpen
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                            : studentTestsPolicy.isUpcoming
                            ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/35'
                            : 'bg-rose-500/15 text-rose-300 border-rose-500/35'
                        }`}
                      >
                        {studentTestsPolicy.portalOpen ? (
                          <Unlock size={12} />
                        ) : studentTestsPolicy.isUpcoming ? (
                          <Clock size={12} />
                        ) : (
                          <Lock size={12} />
                        )}
                        {studentTestsPolicy.portalOpen
                          ? tr("O'quvchilar Test Bo'limi: OCHIQ", 'Раздел тестов учеников: ОТКРЫТ')
                          : studentTestsPolicy.isUpcoming
                          ? tr('Portal Vaqti Kutilmoqda', 'Ожидание времени открытия')
                          : studentTestsPolicy.isExpired
                          ? tr('Portal Muddati Tugagan', 'Время доступа истекло')
                          : tr("O'quvchilar Test Bo'limi: YOPIQ", 'Раздел тестов учеников: ЗАКРЫТ')}
                      </span>
                      <span className="text-[11px] px-2.5 py-1 rounded-full bg-slate-950/70 border border-slate-800 text-slate-300 font-semibold">
                        {tr('Ruxsat berilgan:', 'Разрешено:')}{' '}
                        <strong className="text-emerald-300">
                          {studentTestsPolicyStats.allowedTests ??
                            adminTests.filter((x) => Boolean(x.isStudentAllowed ?? x.is_student_allowed)).length}
                        </strong>{' '}
                        / {studentTestsPolicyStats.totalTests || adminTests.length}
                      </span>
                      <span className="text-[11px] px-2.5 py-1 rounded-full bg-slate-950/70 border border-slate-800 text-slate-300 font-semibold">
                        {tr('Hozir ishlashga ochiq:', 'Открыто сейчас:')}{' '}
                        <strong className="text-cyan-300">
                          {studentTestsPolicyStats.activeNowTests ??
                            adminTests.filter((x) => Boolean(x.isActive ?? x.is_active)).length}
                        </strong>
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {getPolicyMessageLocalized(studentTestsPolicy, language) ||
                        tr(
                          "O'quvchilar bo'limidagi testlar faqat siz ruxsat bergan vaqt va holatdagina ishlaydi.",
                          'Тесты в разделе учеников работают только в то время и при том статусе, которые вы разрешили.'
                        )}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      data-testid="toggle-global-student-tests"
                      disabled={savingGlobalPolicy}
                      onClick={handleToggleGlobalStudentTests}
                      className={`btn btn-sm font-bold flex items-center gap-1.5 ${
                        studentTestsPolicy.enabled
                          ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40'
                          : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/40'
                      }`}
                    >
                      {savingGlobalPolicy ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : studentTestsPolicy.enabled ? (
                        <Lock size={14} />
                      ) : (
                        <Unlock size={14} />
                      )}
                      <span>
                        {studentTestsPolicy.enabled
                          ? tr('Portalni Vaqtincha Yopish', 'Временно закрыть портал')
                          : tr('Portalni Ochish', 'Открыть портал')}
                      </span>
                    </button>

                    <button
                      type="button"
                      data-testid="bulk-allow-all-tests"
                      disabled={savingGlobalPolicy}
                      onClick={() => handleBulkTestsPermission(true, false)}
                      className="btn btn-sm bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/35 font-bold flex items-center gap-1.5"
                    >
                      <Unlock size={13} /> {tr('Barchasiga Ruxsat', 'Разрешить все')}
                    </button>

                    <button
                      type="button"
                      data-testid="bulk-lock-all-tests"
                      disabled={savingGlobalPolicy}
                      onClick={() => handleBulkTestsPermission(false, false)}
                      className="btn btn-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold flex items-center gap-1.5"
                    >
                      <Lock size={13} /> {tr('Barchasini Yopish', 'Закрыть все')}
                    </button>

                    {filteredAdminTests.length !== adminTests.length && filteredAdminTests.length > 0 && (
                      <>
                        <button
                          type="button"
                          disabled={savingGlobalPolicy}
                          onClick={() => handleBulkTestsPermission(true, true)}
                          className="btn btn-xs bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/35 font-bold flex items-center gap-1"
                        >
                          <Unlock size={12} /> {tr('Filtrdagilarga Ruxsat', 'Разрешить по фильтру')} ({filteredAdminTests.length})
                        </button>
                        <button
                          type="button"
                          disabled={savingGlobalPolicy}
                          onClick={() => handleBulkTestsPermission(false, true)}
                          className="btn btn-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-bold flex items-center gap-1"
                        >
                          <Lock size={12} /> {tr('Filtrdagilarni Yopish', 'Закрыть по фильтру')}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Global Student Tests Time Window */}
                <form
                  onSubmit={handleSaveGlobalStudentTestsSchedule}
                  className="pt-3 border-t border-slate-800/80 flex flex-col lg:flex-row lg:items-end justify-between gap-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                    <div>
                      <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1 mb-1">
                        <Calendar size={12} className="text-cyan-400" /> {tr('Umumiy Ruxsat Boshlanishi (ixtiyoriy)', 'Начало общего доступа (необязательно)')}
                      </label>
                      <input
                        type="datetime-local"
                        data-testid="global-portal-start-input"
                        className="clean-input text-xs h-9"
                        value={portalScheduleForm.startTimeIso}
                        onChange={(e) =>
                          setPortalScheduleForm((prev) => ({ ...prev, startTimeIso: e.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1 mb-1">
                        <Clock size={12} className="text-amber-400" /> {tr('Umumiy Ruxsat Tugashi (ixtiyoriy)', 'Конец общего доступа (необязательно)')}
                      </label>
                      <input
                        type="datetime-local"
                        data-testid="global-portal-end-input"
                        className="clean-input text-xs h-9"
                        value={portalScheduleForm.endTimeIso}
                        onChange={(e) =>
                          setPortalScheduleForm((prev) => ({ ...prev, endTimeIso: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="submit"
                      data-testid="save-global-portal-schedule"
                      disabled={savingGlobalPolicy}
                      className="btn btn-diamond-cyan btn-xs h-9 px-3.5 font-bold flex items-center gap-1.5"
                    >
                      <Save size={13} /> {tr('Umumiy Vaqtni Saqlash', 'Сохранить время')}
                    </button>
                    {(studentTestsPolicy.startTimeIso ||
                      studentTestsPolicy.endTimeIso ||
                      portalScheduleForm.startTimeIso ||
                      portalScheduleForm.endTimeIso) && (
                      <button
                        type="button"
                        data-testid="clear-global-portal-schedule"
                        disabled={savingGlobalPolicy}
                        onClick={handleClearGlobalStudentTestsSchedule}
                        className="btn btn-secondary btn-xs h-9 px-3 font-bold flex items-center gap-1"
                      >
                        <RefreshCw size={12} /> {tr('Vaqtni Tozalash', 'Сбросить время')}
                      </button>
                    )}
                  </div>
                </form>
              </div>

              <div className="admin-search-strip">
                <div className="flex flex-wrap items-center gap-3 flex-1">
                  <div className="input-with-icon flex-1 min-w-[200px] max-w-md">
                    <Search size={16} className="input-icon" />
                    <input
                      type="text"
                      className="clean-input text-sm"
                      placeholder={tr("Test nomi, fan yoki o'qituvchi bo'yicha qidiruv...", 'Поиск по названию, предмету или учителю...')}
                      value={adminTestSearch}
                      onChange={(e) => setAdminTestSearch(e.target.value)}
                    />
                  </div>

                  <select
                    className="clean-select text-xs w-auto"
                    value={adminSubjectFilter}
                    onChange={(e) => setAdminSubjectFilter(e.target.value)}
                  >
                    <option value="all">{tr('Barcha fanlar', 'Все предметы')}</option>
                    {subjectsList.map((s) => (
                      <option key={s} value={s}>{localizeSubject(s, language)}</option>
                    ))}
                  </select>

                  <select
                    className="clean-select text-xs w-auto"
                    value={adminClassFilter}
                    onChange={(e) => setAdminClassFilter(e.target.value)}
                  >
                    <option value="all">{tr('Barcha sinflar', 'Все классы')}</option>
                    <option value="__all_classes__">🌐 {tr('Umumiy (Barchasi)', 'Общие (Все классы)')}</option>
                    {adminClassOptions.map((c) => (
                      <option key={c} value={c}>{localizeGrade(c, language)} {tr('sinfi', 'класс')}</option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleAdminNewTest}
                  className="btn btn-diamond-cyan btn-sm flex items-center gap-2 font-bold shadow-md"
                >
                  <Plus size={16} /> {tr("Yangi Test va Savol Qo'shish", 'Добавить тест и вопросы')}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {filteredAdminTests.map((t) => {
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

                  const isStudentAllowed = Boolean(t.isStudentAllowed ?? t.is_student_allowed);
                  const isActiveNow = Boolean(t.isActive ?? t.is_active);
                  const isUpcoming = Boolean(t.isUpcoming);
                  const isExpired = Boolean(t.isExpired);
                  const lockReason = t.lockReason || null;
                  const qCount = t.questionsCount ?? t.questions_count ?? t.questions?.length ?? 0;
                  const sCount = t.submissionsCount ?? t.submissions_count ?? 0;
                  const teacherName = t.teacherName || t.teacher_name || t.teacher || tr('Administrator', 'Администратор');
                  const isSavingPerm = savingTestPermissionId === t.id;

                  let statusLabel = tr('Ruxsatsiz', 'Без доступа');
                  let statusClass = 'status-pill-inactive';
                  if (isActiveNow) {
                    statusLabel = tr('Ruxsat berilgan', 'Доступ открыт');
                    statusClass = 'status-pill-active';
                  } else if (lockReason === 'portal_disabled') {
                    statusLabel = tr('Portal Yopiq', 'Портал закрыт');
                    statusClass = 'status-pill-inactive';
                  } else if (isUpcoming) {
                    statusLabel = tr('Vaqti kutilmoqda', 'Ожидается старт');
                    statusClass = 'status-pill-inactive';
                  } else if (isExpired) {
                    statusLabel = tr('Muddati tugagan', 'Срок истёк');
                    statusClass = 'status-pill-inactive';
                  }

                  return (
                    <div key={t.id} className="test-card-luxury" data-testid={`admin-test-card-${t.id}`}>
                      <div>
                        <div className="test-card-header">
                          <span className={`subject-tag ${subjClass}`}>
                            <BookOpen size={12} /> {localizeSubject(t.subject || 'Fan', language)}
                          </span>
                          <span
                            data-testid={`admin-test-status-${t.id}`}
                            className={statusClass}
                          >
                            {isActiveNow ? '🔓 ' : '🔒 '}
                            {statusLabel}
                          </span>
                        </div>

                        <h3 className="test-card-title">{t.title}</h3>

                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 mb-2">
                          <span>{tr("Mas'ul:", 'Ответственный:')}</span>
                          <span className="text-cyan-300 font-bold">{teacherName}</span>
                        </div>

                        <div className="test-meta-grid">
                          <div className="test-meta-chip">
                            <Clock size={15} style={{ color: '#38bdf8' }} />
                            <span>{t.duration_minutes || t.durationMinutes || 30} {tr('daqiqa', 'мин')}</span>
                          </div>
                          <div className="test-meta-chip">
                            <HelpCircle size={15} style={{ color: '#2dd4bf' }} />
                            <span>{qCount} {tr('ta savol', 'вопр.')}</span>
                          </div>
                          <div className="test-meta-chip">
                            <Users size={15} style={{ color: '#a78bfa' }} />
                            <span>
                              {t.isAllClasses || (t.grade || '').trim().toLowerCase() === 'barchasi'
                                ? tr('🌐 Barchasi (hamma sinflar)', '🌐 Все классы')
                                : `🎯 ${tr('Sinflar:', 'Классы:')} ${localizeGrade(t.grade || (Array.isArray(t.targetClasses) ? t.targetClasses.join(', ') : '-'), language)}`}
                            </span>
                          </div>
                          <div className="test-meta-chip">
                            <TrendingUp size={15} style={{ color: '#fbbf24' }} />
                            <span>{sCount} {tr('ta topshirildi', 'сдач')}</span>
                          </div>
                        </div>

                        {(t.startTime || t.endTime) && (
                          <div className="mt-2 px-2.5 py-1.5 rounded-lg bg-slate-950/60 border border-slate-800 text-[11px] text-slate-300 flex flex-wrap gap-x-3 gap-y-1">
                            {t.startTime && (
                              <span>
                                🕒 {tr('Boshlanish:', 'Начало:')} <strong className="text-cyan-300">{t.startTime}</strong>
                              </span>
                            )}
                            {t.endTime && (
                              <span>
                                ⏱ {tr('Tugash:', 'Окончание:')} <strong className="text-amber-300">{t.endTime}</strong>
                              </span>
                            )}
                          </div>
                        )}

                        {Number(t.rewardTopCount) > 0 && Number(t.rewardCoinsAmount) > 0 && (
                          <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 font-bold">
                            <Zap size={12} />
                            <span>
                              {tr(
                                `Top ${t.rewardTopCount} faolga +${t.rewardCoinsAmount} Coin`,
                                `Топ-${t.rewardTopCount} активным +${t.rewardCoinsAmount} койнов`
                              )} ({t.rewardSlotsUsed || 0}/{t.rewardTopCount})
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="test-card-actions flex-wrap">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleAdminViewResults(t)}
                            className="btn btn-secondary btn-sm"
                          >
                            <Eye size={15} /> {tr('Natijalar', 'Результаты')} ({sCount})
                          </button>

                          <button
                            type="button"
                            data-testid={`toggle-test-permission-${t.id}`}
                            disabled={isSavingPerm}
                            onClick={() => handleToggleTestPermission(t)}
                            className={`btn btn-sm font-bold flex items-center gap-1.5 ${
                              isStudentAllowed
                                ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 border border-rose-500/35'
                                : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/40'
                            }`}
                            title={
                              isStudentAllowed
                                ? tr("O'quvchilar uchun ushbu testni yopish", 'Закрыть этот тест для учеников')
                                : tr("O'quvchilarga ushbu testni ishlashga ruxsat berish", 'Открыть доступ ученикам к этому тесту')
                            }
                          >
                            {isSavingPerm ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : isStudentAllowed ? (
                              <Lock size={14} />
                            ) : (
                              <Unlock size={14} />
                            )}
                            <span>{isStudentAllowed ? tr('Yopish', 'Закрыть') : tr('Ruxsat berish', 'Разрешить')}</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            data-testid={`schedule-test-permission-${t.id}`}
                            onClick={() => handleOpenTestPermissionScheduleModal(t)}
                            className="btn-icon-blue"
                            title={tr('Test vaqti va ruxsatini sozlash', 'Настроить время и доступ к тесту')}
                          >
                            <Clock size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAdminEditTest(t)}
                            className="btn-icon-blue"
                            title={tr('Test va savollarni tahrirlash', 'Редактировать тест и вопросы')}
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            type="button"
                            className="btn-icon-red"
                            onClick={() => handleDeleteTestAdmin(t.id, t.title)}
                            title={tr("O'chirish", 'Удалить')}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredAdminTests.length === 0 && (
                <div className="text-center py-12 text-slate-400 text-xs bg-slate-900/40 rounded-2xl border border-slate-800">
                  {tr(
                    "Hozircha tizimda testlar mavjud emas. Yangi test va savollar qo'shish uchun yuqoridagi tugmani bosing!",
                    'В системе пока нет тестов. Нажмите кнопку выше, чтобы добавить новый тест и вопросы!'
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 1: TEACHERS */}
          {activeTab === 'teachers' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/70 p-4 rounded-xl border border-slate-800">
                <div className="input-with-icon flex-1 max-w-sm">
                  <Search size={16} className="input-icon" />
                  <input
                    type="text"
                    className="clean-input text-xs"
                    placeholder={tr("Ism, fan yoki login bo'yicha qidiruv...", 'Поиск по имени, предмету или логину...')}
                    value={teacherSearch}
                    onChange={(e) => setTeacherSearch(e.target.value)}
                  />
                </div>

                <button
                  type="button"
                  className="btn btn-diamond-cyan btn-sm flex items-center gap-1.5 font-bold"
                  onClick={() => setIsAddTeacherOpen(true)}
                >
                  <Plus size={16} /> {tr("Yangi O'qituvchi", 'Новый учитель')}
                </button>
              </div>

              {/* Teachers Table */}
              <div className="table-responsive bg-slate-900/60 rounded-xl border border-slate-800/80 overflow-hidden">
                <table className="diamond-table w-full text-left">
                  <thead>
                    <tr>
                      <th>{tr('Ustoz', 'Учитель')}</th>
                      <th>{tr('Fan', 'Предмет')}</th>
                      <th>{tr('Login', 'Логин')}</th>
                      <th>{tr('Telefon', 'Телефон')}</th>
                      <th>{tr('Testlar', 'Тесты')}</th>
                      <th>{tr("O'rtacha Ball", 'Средний балл')}</th>
                      <th className="text-right">{tr('Amallar', 'Действия')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTeachers.map((tch) => (
                      <tr key={tch.id}>
                        <td>
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-lg overflow-hidden bg-slate-800 border border-cyan-400/50 flex items-center justify-center font-bold text-cyan-300">
                              {tch.avatarUrl ? (
                                <img src={tch.avatarUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                tch.fullName?.charAt(0) || 'U'
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-white text-xs">{tch.fullName}</div>
                              <div className="text-[11px] text-slate-400">{tch.dateJoined || tr('Faol', 'Активен')}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-primary text-[11px] font-semibold">
                            {tch.subject === 'Fan belgilanmagan' ? tr('Fan belgilanmagan', 'Предмет не указан') : localizeSubject(tch.subject, language)}
                          </span>
                        </td>
                        <td className="font-mono text-xs text-slate-300">{tch.username}</td>
                        <td className="text-xs text-slate-400">{tch.phone || '-'}</td>
                        <td className="font-bold text-xs text-cyan-400">{tch.testsCount || 0} {tr('ta', 'шт.')}</td>
                        <td>
                          <span className="font-bold text-xs text-emerald-400">{tch.avgScore || 0}%</span>
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              className="btn-icon text-cyan-400 hover:bg-cyan-500/20 p-1.5 rounded-lg transition-colors"
                              onClick={() => handleOpenEditTeacher(tch)}
                              title={tr("Rasm, ma'lumot va parolni tahrirlash", 'Редактировать фото, данные и пароль')}
                            >
                              <Edit size={15} />
                            </button>
                            <button
                              type="button"
                              className="btn-icon text-rose-400 hover:bg-rose-500/20 p-1.5 rounded-lg transition-colors"
                              onClick={() => handleDeleteUser({ ...tch, role: 'teacher' })}
                              title={tr("O'chirish", 'Удалить')}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {filteredTeachers.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-slate-400 text-xs">
                          {tr("O'qituvchilar topilmadi.", 'Учителя не найдены.')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: STUDENTS */}
          {activeTab === 'students' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/70 p-4 rounded-xl border border-slate-800">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  <div className="input-with-icon flex-1 min-w-[200px] max-w-xs">
                    <Search size={16} className="input-icon" />
                    <input
                      type="text"
                      className="clean-input text-xs"
                      placeholder={tr("O'quvchi ismi yoki logini...", 'Имя или логин ученика...')}
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                    />
                  </div>

                  <select
                    className="clean-select text-xs w-auto"
                    value={selectedGradeFilter}
                    onChange={(e) => setSelectedGradeFilter(e.target.value)}
                  >
                    <option value="all">{tr('Barcha sinflar', 'Все классы')}</option>
                    {availableGrades.map((g) => (
                      <option key={g} value={g}>
                        {localizeGrade(g, language)} {tr('sinf', 'класс')}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-warning btn-sm flex items-center gap-1.5 font-bold"
                    onClick={() =>
                      handleOpenAwardCoinsModal({
                        grade: selectedGradeFilter === 'all' ? 'all' : selectedGradeFilter,
                        onlyActive: true,
                      })
                    }
                  >
                    <Coins size={15} /> {tr('Coin Berish', 'Начислить койны')}
                  </button>

                  <button
                    type="button"
                    className="btn btn-diamond-cyan btn-sm flex items-center gap-1.5 font-bold"
                    onClick={() => setIsAddStudentOpen(true)}
                  >
                    <Plus size={16} /> {tr("Yangi O'quvchi", 'Новый ученик')}
                  </button>
                </div>
              </div>

              {/* Students Table */}
              <div className="table-responsive bg-slate-900/60 rounded-xl border border-slate-800/80 overflow-hidden">
                <table className="diamond-table w-full text-left">
                  <thead>
                    <tr>
                      <th>{tr("O'quvchi", 'Ученик')}</th>
                      <th>{tr('Sinfi', 'Класс')}</th>
                      <th>{tr('Login', 'Логин')}</th>
                      <th>{tr('Telefon', 'Телефон')}</th>
                      <th>{tr('Diamond Coins', 'Diamond-койны')}</th>
                      <th className="text-right">{tr('Amallar', 'Действия')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((std) => (
                      <tr key={std.id}>
                        <td>
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-800 border border-sky-400/40 flex items-center justify-center font-bold text-sky-300 text-xs">
                              {std.fullName?.charAt(0) || 'S'}
                            </div>
                            <div>
                              <div className="font-bold text-white text-xs">{std.fullName}</div>
                              <div className="text-[10px] text-slate-400">
                                {std.testsPassed || 0} {tr('ta test', 'тест.')} • {std.avgScore || 0}%
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-info text-[11px] font-semibold">{localizeGrade(std.grade || '-', language)}</span>
                        </td>
                        <td className="font-mono text-xs text-slate-300">{std.username}</td>
                        <td className="text-xs text-slate-400">{std.phone || '-'}</td>
                        <td>
                          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold">
                            <Coins size={12} />
                            <span>{std.coins || 0}</span>
                          </div>
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              className="row-quick-coin-btn text-[10px]"
                              onClick={() => handleQuickStudentAward(std.id, 10, tr("Faol o'quvchini rag'batlantirish ⚡", 'Поощрение активного ученика ⚡'))}
                              title={tr('+10 Coin berish', 'Начислить +10 койнов')}
                            >
                              +10 💎
                            </button>
                            <button
                              type="button"
                              className="btn-icon text-rose-400 hover:bg-rose-500/20 p-1.5 rounded-lg transition-colors"
                              onClick={() => handleDeleteUser({ ...std, role: 'student' })}
                              title={tr("O'chirish", 'Удалить')}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {filteredStudents.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-slate-400 text-xs">
                          {tr("O'quvchilar topilmadi.", 'Ученики не найдены.')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: COINS & RANKINGS */}
          {activeTab === 'coins' && (
            <div className="space-y-6 animate-fade-in">
              {/* Header with Control Buttons */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 p-5 rounded-2xl border border-amber-500/30 shadow-xl">
                <div>
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <Coins className="text-amber-400" size={24} />
                    {tr('Diamond Coinlar Tizimi va Reytingi', 'Система Diamond-койнов и рейтинг')}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {tr(
                      "O'quvchilarning bilim, faollik va olimpiada natijalari bo'yicha umumiy reytingi hamda qiyosiy statistikasi",
                      'Общий рейтинг учеников по знаниям, активности и результатам олимпиад, а также сравнительная статистика'
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm flex items-center gap-1.5 font-bold"
                    onClick={() => {
                      const defCls =
                        classesList.find((c) => c.name === batchClassForm.className)?.name ||
                        classesList[0]?.name ||
                        batchClassForm.className;
                      setBatchClassForm((prev) => ({
                        ...prev,
                        className: defCls,
                        awardScope: 'class_only',
                      }));
                      setIsBatchClassRewardOpen(true);
                    }}
                  >
                    <School size={16} className="text-cyan-400" /> {tr('Sinfga / Sinf Fondiga Coin', 'Койны классу / фонду класса')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-warning btn-sm flex items-center gap-1.5 font-bold shadow-md shadow-amber-500/20"
                    onClick={() => handleOpenAwardCoinsModal({ onlyActive: true })}
                  >
                    <Plus size={16} /> {tr("Faol O'quvchilarga Coin", 'Койны активным ученикам')}
                  </button>
                </div>
              </div>

              {/* 4 Top KPI Metric Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5">
                <div className="coin-summary-card min-w-0">
                  <div className="coin-icon-box">
                    <Coins size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xl sm:text-2xl font-black text-amber-400 font-cinzel truncate">
                      {coinStats?.totalCoins ?? 0} 💎
                    </div>
                    <div className="text-[10px] sm:text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                      {tr('Jami Tarqatilgan', 'Всего начислено')}
                    </div>
                    {(coinStats?.classBonusCoinsTotal ?? 0) > 0 && (
                      <div className="text-[10px] text-cyan-300 font-semibold mt-0.5">
                        {tr("O'quvchilar:", 'Ученики:')} {coinStats?.studentsCoinsTotal ?? 0} • {tr('Sinf fondi:', 'Фонд класса:')} {coinStats?.classBonusCoinsTotal ?? 0}
                      </div>
                    )}
                  </div>
                </div>

                <div className="coin-summary-card min-w-0">
                  <div className="coin-icon-box" style={{ borderColor: 'rgba(56, 189, 248, 0.4)', color: '#38bdf8' }}>
                    <Users size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xl sm:text-2xl font-black text-white font-cinzel">
                      {coinStats?.activeStudentsCount ?? 0} / {coinStats?.totalStudents ?? students.length ?? 0}
                    </div>
                    <div className="text-[10px] sm:text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                      {tr("Faol / Jami O'quvchilar", 'Активных / Всего учеников')}
                    </div>
                  </div>
                </div>

                <div className="coin-summary-card min-w-0">
                  <div className="coin-icon-box" style={{ borderColor: 'rgba(16, 185, 129, 0.4)', color: '#34d399' }}>
                    <Trophy size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm sm:text-lg font-black text-emerald-400 line-clamp-1">
                      {coinStats?.topPerformer && coinStats.topPerformer !== '-' ? coinStats.topPerformer : '-'}
                    </div>
                    <div className="text-[10px] sm:text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                      {coinStats?.topPerformerCoins
                        ? tr(`${coinStats.topPerformerCoins} Coin (1-o'rin 👑)`, `${coinStats.topPerformerCoins} койн. (1-е место 👑)`)
                        : tr('Maktab Yetakchisi', 'Лидер школы')}
                    </div>
                  </div>
                </div>

                <div className="coin-summary-card min-w-0">
                  <div className="coin-icon-box" style={{ borderColor: 'rgba(168, 85, 247, 0.4)', color: '#c084fc' }}>
                    <TrendingUp size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xl sm:text-2xl font-black text-purple-400 font-cinzel">
                      ~{coinStats?.avgCoins ?? 0}
                    </div>
                    <div className="text-[10px] sm:text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                      {tr("O'rtacha Coin / O'quvchi", 'Среднее койнов / Ученик')}
                    </div>
                  </div>
                </div>
              </div>

              {/* ============================================================ */}
              {/* COINS INTERACTIVE CHARTS & DIAGRAMS SUITE                    */}
              {/* ============================================================ */}
              {(() => {
                const chartFilteredClasses = classesCoinStats.filter((cls) => {
                  if (classCoinFilter === 'active') {
                    return (cls.totalCoins || 0) > 0 || (cls.submissionsCount || 0) > 0 || (cls.classBonusCoins || 0) > 0;
                  }
                  if (classCoinFilter === 'uz') return cls.language === 'uz';
                  if (classCoinFilter === 'ru') return cls.language === 'ru';
                  return true;
                });

                const classBarItems = chartFilteredClasses.map((cls) => {
                  if (coinsBarMetric === 'avg') {
                    return {
                      key: cls.className,
                      label: localizeGrade(cls.className, language),
                      sublabel: `${cls.studentsCount || 0} ${tr('bola', 'уч.')}`,
                      value: cls.avgCoins || 0,
                      color: '#38bdf8',
                      detail: tr(
                        `${cls.className} sinfi — har o'quvchiga o'rtacha ~${cls.avgCoins || 0} Coin (${cls.studentsCount || 0} nafar o'quvchi)`,
                        `Класс ${localizeGrade(cls.className, language)} — в среднем ~${cls.avgCoins || 0} койнов на ученика (${cls.studentsCount || 0} уч.)`
                      ),
                    };
                  }
                  if (coinsBarMetric === 'fund') {
                    return {
                      key: cls.className,
                      label: localizeGrade(cls.className, language),
                      sublabel: cls.language === 'ru' ? 'RU' : 'UZ',
                      value: cls.classBonusCoins || 0,
                      color: '#a855f7',
                      detail: tr(
                        `${cls.className} sinf fondi — ${cls.classBonusCoins || 0} Coin (o'quvchilar coini: ${cls.studentCoins || 0})`,
                        `Фонд класса ${localizeGrade(cls.className, language)} — ${cls.classBonusCoins || 0} койнов (койны учеников: ${cls.studentCoins || 0})`
                      ),
                    };
                  }
                  return {
                    key: cls.className,
                    label: localizeGrade(cls.className, language),
                    sublabel: `${cls.activeStudentsCount ?? 0}/${cls.studentsCount || 0} ${tr('faol', 'акт.')}`,
                    primaryValue: cls.studentCoins || 0,
                    secondaryValue: cls.classBonusCoins || 0,
                    value: cls.totalCoins || 0,
                    detail: tr(
                      `${cls.className}: O'quvchilar ${cls.studentCoins || 0} + Sinf fondi ${cls.classBonusCoins || 0} = ${cls.totalCoins || 0} Coin`,
                      `${localizeGrade(cls.className, language)}: Ученики ${cls.studentCoins || 0} + Фонд класса ${cls.classBonusCoins || 0} = ${cls.totalCoins || 0} койнов`
                    ),
                  };
                });

                const tierCoinsMap = studentCoinTiers?.tierCoins || {};
                const tierSegments = [
                  {
                    key: 'diamond',
                    label: tr('💎 Diamond (100+ Coin)', '💎 Diamond (100+ койн.)'),
                    shortLabel: 'Diamond',
                    value: studentCoinTiers?.diamond ?? 0,
                    countText: `${studentCoinTiers?.diamond ?? 0} ${tr('nafar', 'уч.')}`,
                    secondaryText: `${tr('Jami:', 'Всего:')} ${tierCoinsMap.diamond ?? 0} ${tr('Coin', 'Койн')}`,
                    color: '#a855f7',
                  },
                  {
                    key: 'gold',
                    label: tr('🥇 Gold (50–99 Coin)', '🥇 Gold (50–99 койн.)'),
                    shortLabel: 'Gold',
                    value: studentCoinTiers?.gold ?? 0,
                    countText: `${studentCoinTiers?.gold ?? 0} ${tr('nafar', 'уч.')}`,
                    secondaryText: `${tr('Jami:', 'Всего:')} ${tierCoinsMap.gold ?? 0} ${tr('Coin', 'Койн')}`,
                    color: '#f59e0b',
                  },
                  {
                    key: 'silver',
                    label: tr('🥈 Silver (20–49 Coin)', '🥈 Silver (20–49 койн.)'),
                    shortLabel: 'Silver',
                    value: studentCoinTiers?.silver ?? 0,
                    countText: `${studentCoinTiers?.silver ?? 0} ${tr('nafar', 'уч.')}`,
                    secondaryText: `${tr('Jami:', 'Всего:')} ${tierCoinsMap.silver ?? 0} ${tr('Coin', 'Койн')}`,
                    color: '#94a3b8',
                  },
                  {
                    key: 'bronze',
                    label: tr('🥉 Bronze (1–19 Coin)', '🥉 Bronze (1–19 койн.)'),
                    shortLabel: 'Bronze',
                    value: studentCoinTiers?.bronze ?? 0,
                    countText: `${studentCoinTiers?.bronze ?? 0} ${tr('nafar', 'уч.')}`,
                    secondaryText: `${tr('Jami:', 'Всего:')} ${tierCoinsMap.bronze ?? 0} ${tr('Coin', 'Койн')}`,
                    color: '#ea580c',
                  },
                  ...((studentCoinTiers?.zero ?? 0) > 0
                    ? [
                        {
                          key: 'zero',
                          label: tr('⚪ Hali olmagan (0 Coin)', '⚪ Ещё не получали (0 койн.)'),
                          shortLabel: tr('0 Coin', '0 койн.'),
                          value: studentCoinTiers?.zero ?? 0,
                          countText: `${studentCoinTiers?.zero ?? 0} ${tr('nafar', 'уч.')}`,
                          secondaryText: tr('Test yoki dars faolligida hali coin olmagan', 'Пока нет койнов за тесты или уроки'),
                          color: '#475569',
                        },
                      ]
                    : []),
                ];

                const sourceSegments = (Array.isArray(coinSources) ? coinSources : []).map((src) => ({
                  key: src.key,
                  label: src.label,
                  shortLabel: src.shortLabel,
                  value: src.coins || 0,
                  countText: `${src.coins || 0} 💎`,
                  secondaryText: `${src.txCount || 0} ${tr('ta tranzaksiya', 'транзакций')}`,
                  color: src.color || '#38bdf8',
                }));
                const totalSourcesCoins = sourceSegments.reduce((s, x) => s + x.value, 0);
                const totalSourceOps = (Array.isArray(coinSources) ? coinSources : []).reduce((s, x) => s + (x.txCount || 0), 0);

                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      <ValueBarDiagram
                        testId="admin-coins-class-bar-diagram"
                        title={tr("Sinflar Bo'yicha Coinlar Diagrammasi", 'Диаграмма койнов по классам')}
                        subtitle={tr("Ustunni bossangiz shu sinf o'quvchilari reytingda ajratib ko'rsatiladi", 'Нажмите на столбец, чтобы отфильтровать рейтинг по этому классу')}
                        items={classBarItems}
                        unit="💎"
                        primaryColor="#f59e0b"
                        secondaryColor="#a855f7"
                        primaryLegend={coinsBarMetric === 'total' ? tr("O'quvchilar coini", 'Койны учеников') : ''}
                        secondaryLegend={coinsBarMetric === 'total' ? tr('Sinf fondi', 'Фонд класса') : ''}
                        selectedKey={coinGradeFilter !== 'all' ? coinGradeFilter : null}
                        onItemClick={(item) => {
                          setCoinGradeFilter((prev) => (prev === item.key ? 'all' : item.key));
                          setCoinSubTab('rankings');
                        }}
                        emptyText={tr("Tanlangan filtr bo'yicha sinflar topilmadi", 'Классы по выбранному фильтру не найдены')}
                        headerRight={
                          <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[10px] font-bold">
                            {[
                              { id: 'total', lbl: tr('Jami', 'Всего') },
                              { id: 'avg', lbl: tr("O'rtacha", 'Сред.') },
                              { id: 'fund', lbl: tr('Fond', 'Фонд') },
                            ].map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                className={`px-2 py-1 rounded-md transition-all ${
                                  coinsBarMetric === m.id
                                    ? 'bg-amber-500 text-slate-950 font-black'
                                    : 'text-slate-400 hover:text-white'
                                }`}
                                onClick={() => setCoinsBarMetric(m.id)}
                              >
                                {m.lbl}
                              </button>
                            ))}
                          </div>
                        }
                      />

                      <TrendAreaLineChart
                        testId="admin-coins-timeline-chart"
                        title={tr('Kunlik Coinlar va Faollik Dinamikasi Grafigi', 'Динамика дневных начислений и активности')}
                        subtitle={tr("So'nggi faol kunlarda o'quvchilarga va sinf fondiga berilgan coinlar oqimi", 'Поток койнов, начисленных ученикам и в фонды классов за последние активные дни')}
                        points={coinTimeline}
                        emptyText={tr('Kunlik coin tranzaksiyalari tarixi hali shakllanmagan', 'История дневных транзакций ещё не сформирована')}
                      />
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      <MultiSegmentDonutChart
                        testId="admin-coins-tiers-donut"
                        title={tr("Bolalar (O'quvchilar) Ligalari Diagrammasi", 'Диаграмма лиг учеников')}
                        subtitle={tr('Ligani bossangiz reyting jadvali avtomatik shu toifaga filtrlanadi', 'Нажмите на лигу, чтобы отфильтровать рейтинг по этой категории')}
                        segments={tierSegments}
                        centerValue={`${coinStats?.totalStudents ?? students.length ?? 0}`}
                        centerLabel={tr("O'quvchi", 'Учеников')}
                        badgeText={
                          coinTierFilter !== 'all'
                            ? `${tr('Filtr:', 'Фильтр:')} ${coinTierFilter.toUpperCase()} ×`
                            : `${coinStats?.totalStudents ?? students.length ?? 0} ${tr('nafar', 'уч.')}`
                        }
                        selectedKey={coinTierFilter !== 'all' ? coinTierFilter : null}
                        onSegmentClick={(seg) => {
                          setCoinTierFilter((prev) => (prev === seg.key ? 'all' : seg.key));
                          setCoinSubTab('rankings');
                        }}
                        emptyText={tr("O'quvchilar ligalari bo'yicha ma'lumot yo'q", 'Нет данных по лигам учеников')}
                      />

                      <MultiSegmentDonutChart
                        testId="admin-coins-sources-donut"
                        title={tr("Coin Manbalari Bo'yicha Taqsimot", 'Распределение по источникам койнов')}
                        subtitle={tr('Maktab bo\'yicha coinlar qaysi faollik va mukofot manbalaridan berilgan', 'Из каких видов активности и наград начислены койны по школе')}
                        segments={sourceSegments}
                        centerValue={`${totalSourcesCoins}`}
                        centerLabel={tr('Jurnal Coin', 'Койны журнала')}
                        badgeText={`${totalSourceOps} ${tr('operatsiya', 'операций')}`}
                        emptyText={tr('Hozircha tranzaksiya manbalari mavjud emas', 'Источники транзакций пока отсутствуют')}
                      />
                    </div>
                  </div>
                );
              })()}

              {/* ============================================================ */}
              {/* DUAL COMPARATIVE SCHEMES: SINFLAR VA BOLALAR O'RTASIDA       */}
              {/* ============================================================ */}
              <div className="coin-analytics-grid">
                {/* SXEMA 1: Sinflar O'rtasidagi Qiyosiy Statistika va Diagramma */}
                <div className="analytics-card-glass flex flex-col justify-between">
                  <div>
                    {/* Header */}
                    <div className="flex flex-wrap items-center justify-between mb-1.5 gap-2">
                      <div className="analytics-card-title text-base font-extrabold text-white flex items-center gap-2">
                        <BarChart2 className="text-cyan-400" size={20} />
                        {tr("Sinflar Bo'yicha Coinlar Taqsimoti", 'Распределение койнов по классам')}
                      </div>
                      <button
                        type="button"
                        className="text-xs font-bold text-cyan-300 hover:text-white flex items-center gap-1.5 bg-cyan-500/15 hover:bg-cyan-500/25 px-3 py-1.5 rounded-xl border border-cyan-500/30 transition-all shadow-sm flex-shrink-0"
                        onClick={() => {
                          const defCls =
                            classesList.find((c) => c.name === batchClassForm.className)?.name ||
                            classesList[0]?.name ||
                            batchClassForm.className;
                          setBatchClassForm((prev) => ({
                            ...prev,
                            className: defCls,
                            awardScope: 'class_only',
                          }));
                          setIsBatchClassRewardOpen(true);
                        }}
                      >
                        <Plus size={14} /> {tr('Sinfga Coin Berish', 'Койны классу')}
                      </button>
                    </div>
                    <div className="analytics-card-sub text-xs text-slate-400 mb-4">
                      {tr(
                        "Parallel sinflarning shaxsiy fond va o'quvchi coinlari jamg'armasi",
                        'Собственный фонд классов и накопления учеников по параллелям'
                      )}
                    </div>

                    {/* Til bo'yicha qiyoslash bloki (O'zbek va Rus) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                      <div className="lang-stat-box uz">
                        <div>
                          <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-300">
                            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                            {tr("O'zbek sinflari", 'Узбекские классы')} ({classesCoinStats.filter((c) => c.language === 'uz').length} {tr('ta', 'кл.')})
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {languageCoinStats?.uzbek?.studentsCount ?? 0} {tr("nafar o'quvchi", 'учеников')}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-black text-amber-300 font-mono">
                            {languageCoinStats?.uzbek?.totalCoins ?? 0} {tr('Coin', 'Койн')}
                          </div>
                          <div className="text-[11px] font-bold text-cyan-400">
                            {languageCoinStats?.uzbek?.pct ?? 0}% {tr('ulush', 'доля')}
                          </div>
                        </div>
                      </div>

                      <div className="lang-stat-box ru">
                        <div>
                          <div className="flex items-center gap-1.5 text-xs font-bold text-rose-300">
                            <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                            {tr('Rus sinflari', 'Русские классы')} ({classesCoinStats.filter((c) => c.language === 'ru').length} {tr('ta', 'кл.')})
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {languageCoinStats?.russian?.studentsCount ?? 0} {tr("nafar o'quvchi", 'учеников')}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-black text-amber-300 font-mono">
                            {languageCoinStats?.russian?.totalCoins ?? 0} {tr('Coin', 'Койн')}
                          </div>
                          <div className="text-[11px] font-bold text-rose-400">
                            {languageCoinStats?.russian?.pct ?? 0}% {tr('ulush', 'доля')}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Sinflarni filtrlash tugmalari (Segmented tabs) */}
                    <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1 text-xs">
                      <button
                        type="button"
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                          classCoinFilter === 'active'
                            ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                            : 'text-slate-400 hover:text-white bg-slate-900/80 border border-slate-800'
                        }`}
                        onClick={() => setClassCoinFilter('active')}
                      >
                        🏆 {tr('Faol Sinflar', 'Активные классы')} ({classesCoinStats.filter((c) => (c.totalCoins || 0) > 0 || (c.submissionsCount || 0) > 0 || (c.classBonusCoins || 0) > 0).length})
                      </button>
                      <button
                        type="button"
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                          classCoinFilter === 'all'
                            ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                            : 'text-slate-400 hover:text-white bg-slate-900/80 border border-slate-800'
                        }`}
                        onClick={() => setClassCoinFilter('all')}
                      >
                        {tr(`Barcha ${classesCoinStats.length || classesList.length} ta Sinf`, `Все ${classesCoinStats.length || classesList.length} классов`)}
                      </button>
                      <button
                        type="button"
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                          classCoinFilter === 'uz'
                            ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                            : 'text-slate-400 hover:text-white bg-slate-900/80 border border-slate-800'
                        }`}
                        onClick={() => setClassCoinFilter('uz')}
                      >
                        {tr("O'zbek guruhi", 'Узб. классы')}
                      </button>
                      <button
                        type="button"
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                          classCoinFilter === 'ru'
                            ? 'bg-rose-500 text-white shadow-md font-black'
                            : 'text-slate-400 hover:text-white bg-slate-900/80 border border-slate-800'
                        }`}
                        onClick={() => setClassCoinFilter('ru')}
                      >
                        {tr('Rus guruhi', 'Рус. классы')}
                      </button>
                    </div>

                    {/* Sinflar ro'yxati (Toza va chiroyli kartalar) */}
                    <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                      {classesCoinStats
                        .filter((cls) => {
                          if (classCoinFilter === 'active') {
                            return (cls.totalCoins || 0) > 0 || (cls.submissionsCount || 0) > 0 || (cls.classBonusCoins || 0) > 0;
                          }
                          if (classCoinFilter === 'uz') return cls.language === 'uz';
                          if (classCoinFilter === 'ru') return cls.language === 'ru';
                          return true;
                        })
                        .map((cls, idx) => {
                          const totalAll = coinStats?.totalCoins ?? 0;
                          const pct = totalAll > 0 ? Math.round(((cls.totalCoins || 0) / totalAll) * 100) : 0;
                          const maxCoins = Math.max(1, classesCoinStats[0]?.totalCoins || 0);
                          const barWidth = Math.max(
                            (cls.totalCoins || 0) > 0 ? 8 : 2,
                            Math.min(100, Math.round(((cls.totalCoins || 0) / maxCoins) * 100))
                          );
                          const isTop3 = cls.rank <= 3;
                          const rankPillClass =
                            cls.rank === 1 ? 'gold' : cls.rank === 2 ? 'silver' : cls.rank === 3 ? 'bronze' : 'default';

                          return (
                            <div
                              key={cls.className}
                              className={`class-scheme-card ${isTop3 ? 'rank-lead' : ''} cursor-pointer`}
                              onClick={() => {
                                setCoinGradeFilter(cls.className);
                                setCoinSubTab('rankings');
                              }}
                              title={tr(`${cls.className} sinf o'quvchilarini ko'rish`, `Посмотреть учеников класса ${localizeGrade(cls.className, language)}`)}
                            >
                              {/* Yuqori qator: O'rin, Sinf nomi, O'quvchilar soni | Coinlar, Foiz, Amal */}
                              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2.5">
                                  <div className={`rank-pill ${rankPillClass}`}>
                                    {cls.rank === 1 ? '🥇' : cls.rank === 2 ? '🥈' : cls.rank === 3 ? '🥉' : `#${cls.rank || idx + 1}`}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-black text-white text-sm">{localizeGrade(cls.className, language)}</span>
                                      <span
                                        className={`text-[10px] px-1.5 py-0.5 rounded font-extrabold uppercase ${
                                          cls.language === 'ru'
                                            ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                                            : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                                        }`}
                                      >
                                        {cls.language === 'ru' ? 'RU' : 'UZ'}
                                      </span>
                                      {(cls.classBonusCoins || 0) > 0 && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                                          🏫 {tr('Fond:', 'Фонд:')} +{cls.classBonusCoins}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-slate-400 mt-0.5">
                                      {cls.studentsCount || 0} {tr("nafar o'quvchi", 'учеников')} ({cls.activeStudentsCount ?? 0} {tr('faol', 'акт.')})
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <div className="text-right">
                                    <div className="text-sm font-black text-amber-300 font-mono">
                                      {cls.totalCoins || 0} {tr('Coin', 'Койн')}
                                    </div>
                                    <div className="text-[10px] text-slate-400">
                                      {pct}% {tr('ulush', 'доля')} {cls.avgCoins > 0 ? `• ~${cls.avgCoins}/${tr('bola', 'уч.')}` : ''}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    className="text-[11px] font-bold text-cyan-300 hover:text-white bg-cyan-500/15 hover:bg-cyan-500/30 px-2.5 py-1 rounded-lg border border-cyan-500/30 transition-all flex items-center gap-1 shadow-sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setBatchClassForm((prev) => ({
                                        ...prev,
                                        className: cls.className,
                                        awardScope: 'class_only',
                                      }));
                                      setIsBatchClassRewardOpen(true);
                                    }}
                                    title={tr("Faol sinf o'ziga yoki o'quvchilariga coin berish", 'Начислить койны классу или его ученикам')}
                                  >
                                    <Coins size={12} /> + {tr('Coin', 'Койн')}
                                  </button>
                                </div>
                              </div>

                              {/* Pastki qator: Chiroyli Progress tasma */}
                              <div className="h-1.5 bg-slate-900/90 rounded-full overflow-hidden border border-slate-800">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${barWidth}%`,
                                    background:
                                      (cls.totalCoins || 0) > 0
                                        ? 'linear-gradient(90deg, #0284c7, #38bdf8, #fbbf24)'
                                        : 'rgba(100, 116, 139, 0.25)',
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}

                      {classesCoinStats.length === 0 && (
                        <div className="text-center py-6 text-slate-400 text-xs">
                          {tr("Sinflar bo'yicha coin statistikasi hali shakllanmagan.", 'Статистика койнов по классам ещё не сформирована.')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* SXEMA 2: Tillar Ulushi Diagrammasi va Tezkor Liga Filtrlari */}
                <div className="analytics-card-glass flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                      <div className="analytics-card-title text-base font-extrabold text-white flex items-center gap-2">
                        <Flame className="text-amber-400" size={20} />
                        {tr('Tillar Ulushi va Tezkor Filtrlar', 'Доли по языкам и быстрые фильтры')}
                      </div>
                      {coinTierFilter !== 'all' && (
                        <button
                          type="button"
                          onClick={() => setCoinTierFilter('all')}
                          className="text-[11px] font-bold text-rose-300 bg-rose-500/15 px-2.5 py-1 rounded-lg border border-rose-500/30 hover:bg-rose-500/25"
                        >
                          {tr('Liga filtrini tozalash', 'Сбросить фильтр лиги')} ({coinTierFilter}) ×
                        </button>
                      )}
                    </div>
                    <div className="analytics-card-sub text-xs text-slate-400 mb-3">
                      {tr(
                        "O'zbek va Rus sinflari coin ulushi hamda o'quvchi ligalari bo'yicha tezkor tanlov",
                        'Соотношение койнов узбекских и русских классов, а также быстрый выбор по лигам'
                      )}
                    </div>

                    <MultiSegmentDonutChart
                      testId="admin-coins-lang-donut"
                      stackLegend
                      title={tr("O'zbek va Rus Sinflari Coin Jamg'armasi", 'Фонд койнов узбекских и русских классов')}
                      subtitle={tr("Sinflar kesimida jami to'plangan coinlar nisbati", 'Соотношение накопленных койнов в разрезе классов')}
                      segments={[
                        {
                          key: 'uz',
                          label: tr("O'zbek sinflari", 'Узбекские классы'),
                          shortLabel: tr("O'zbek", 'Узб.'),
                          value: languageCoinStats?.uzbek?.totalCoins ?? 0,
                          countText: `${languageCoinStats?.uzbek?.totalCoins ?? 0} 💎`,
                          secondaryText: `${languageCoinStats?.uzbek?.studentsCount ?? 0} ${tr("nafar o'quvchi", 'учеников')}`,
                          color: '#06b6d4',
                        },
                        {
                          key: 'ru',
                          label: tr('Rus sinflari', 'Русские классы'),
                          shortLabel: tr('Rus', 'Рус.'),
                          value: languageCoinStats?.russian?.totalCoins ?? 0,
                          countText: `${languageCoinStats?.russian?.totalCoins ?? 0} 💎`,
                          secondaryText: `${languageCoinStats?.russian?.studentsCount ?? 0} ${tr("nafar o'quvchi", 'учеников')}`,
                          color: '#f43f5e',
                        },
                      ]}
                      centerValue={`${coinStats?.totalCoins ?? 0}`}
                      centerLabel={tr('Maktab 💎', 'Школа 💎')}
                      selectedKey={classCoinFilter === 'uz' || classCoinFilter === 'ru' ? classCoinFilter : null}
                      onSegmentClick={(seg) =>
                        setClassCoinFilter((prev) => (prev === seg.key ? 'active' : seg.key))
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    {[
                      { id: 'diamond', cls: 'diamond', label: '💎 Diamond', count: studentCoinTiers?.diamond ?? 0 },
                      { id: 'gold', cls: 'gold', label: '🥇 Gold', count: studentCoinTiers?.gold ?? 0 },
                      { id: 'silver', cls: 'silver', label: '🥈 Silver', count: studentCoinTiers?.silver ?? 0 },
                      { id: 'bronze', cls: 'bronze', label: '🥉 Bronze', count: studentCoinTiers?.bronze ?? 0 },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setCoinTierFilter(coinTierFilter === t.id ? 'all' : t.id);
                          setCoinSubTab('rankings');
                        }}
                        className={`p-2 rounded-xl border text-left transition-all ${
                          coinTierFilter === t.id
                            ? 'bg-amber-500/20 border-amber-400 ring-1 ring-amber-400/50'
                            : 'bg-slate-950/60 border-slate-800 hover:border-slate-600'
                        }`}
                      >
                        <div className="text-[11px] font-bold text-white truncate">{t.label}</div>
                        <div className="text-xs font-black text-amber-300 mt-0.5">{t.count} {tr('nafar', 'уч.')}</div>
                      </button>
                    ))}
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 flex items-start gap-2 leading-relaxed">
                    <span className="text-amber-400">💡</span>
                    <span>
                      <strong>{tr('Tizim qoidasi:', 'Правило системы:')}</strong>{' '}
                      {tr(
                        "Coinlar test natijalari (50%–100% hamda Top-N bonusi), o'qituvchining darsdagi faollik bahosi va Admin / Sinf fondi mukofotlari orqali jamlanadi.",
                        'Койны накапливаются за результаты тестов (50%–100% и бонус Топ-N), оценку активности на уроках учителем и награды администратора / фонда класса.'
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* ============================================================ */}
              {/* MAKTAB YETAKCHILARI SHOHSUPASI (TOP 3 PODIUM)                */}
              {/* ============================================================ */}
              {coinRankings.length >= 3 && (
                <div>
                  <div className="text-center mb-2">
                    <span className="text-[11px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 px-3.5 py-1.5 rounded-full border border-amber-500/30 shadow-md">
                      🌟 {tr('Maktab Yetakchilari Shohsupasi (Top 3)', 'Пьедестал лидеров школы (Топ-3)')} 🌟
                    </span>
                  </div>
                  <div className="coin-podium-wrap">
                    {/* 2nd Place (Silver) */}
                    {coinRankings[1] && (
                      <div className="podium-card rank-2">
                        <span className="podium-crown-badge">🥈</span>
                        <div className="podium-avatar-halo" style={{ background: 'linear-gradient(135deg, #64748b, #475569)' }}>
                          {(coinRankings[1].fullName || coinRankings[1].username).charAt(0)}
                        </div>
                        <div className="podium-name">{coinRankings[1].fullName || coinRankings[1].username}</div>
                        <div className="text-xs text-cyan-300 font-semibold">{localizeGrade(coinRankings[1].grade, language)} {tr('sinf', 'класс')}</div>
                        <div className="text-[11px] text-slate-400 mt-1">{tr('Test natijasi:', 'Средний балл:')} <strong className="text-emerald-400">{coinRankings[1].avgScore || 0}%</strong></div>
                        <div className="podium-coins">
                          <Coins size={14} /> {coinRankings[1].coins} {tr('Coins', 'Койн.')}
                        </div>
                        <button
                          type="button"
                          className="mt-2 text-[10px] text-cyan-400 hover:text-cyan-300 font-bold bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/30"
                          onClick={() => handleQuickStudentAward(coinRankings[1].id, 10)}
                        >
                          +10 {tr('Coin Berish', 'Койн.')}
                        </button>
                      </div>
                    )}

                    {/* 1st Place (Gold) */}
                    {coinRankings[0] && (
                      <div className="podium-card rank-1">
                        <span className="podium-crown-badge">👑 🥇</span>
                        <div className="podium-avatar-halo" style={{ background: 'linear-gradient(135deg, #f59e0b, #b45309)' }}>
                          {(coinRankings[0].fullName || coinRankings[0].username).charAt(0)}
                        </div>
                        <div className="podium-name text-amber-200">{coinRankings[0].fullName || coinRankings[0].username}</div>
                        <div className="text-xs text-amber-300 font-bold">{localizeGrade(coinRankings[0].grade, language)} {tr('sinf • Mutlaq Yetakchi', 'класс • Абсолютный лидер')}</div>
                        <div className="text-[11px] text-slate-300 mt-1">{tr('Test natijasi:', 'Средний балл:')} <strong className="text-emerald-300">{coinRankings[0].avgScore || 0}%</strong></div>
                        <div className="podium-coins">
                          <Coins size={16} /> {coinRankings[0].coins} {tr('Coins', 'Койн.')}
                        </div>
                        <button
                          type="button"
                          className="mt-2 text-[10px] text-amber-300 hover:text-amber-200 font-bold bg-amber-500/20 px-2.5 py-0.5 rounded-md border border-amber-500/40"
                          onClick={() => handleQuickStudentAward(coinRankings[0].id, 15)}
                        >
                          +15 {tr('Coin Mukofoti', 'Премия')}
                        </button>
                      </div>
                    )}

                    {/* 3rd Place (Bronze) */}
                    {coinRankings[2] && (
                      <div className="podium-card rank-3">
                        <span className="podium-crown-badge">🥉</span>
                        <div className="podium-avatar-halo" style={{ background: 'linear-gradient(135deg, #b45309, #78350f)' }}>
                          {(coinRankings[2].fullName || coinRankings[2].username).charAt(0)}
                        </div>
                        <div className="podium-name">{coinRankings[2].fullName || coinRankings[2].username}</div>
                        <div className="text-xs text-cyan-300 font-semibold">{localizeGrade(coinRankings[2].grade, language)} {tr('sinf', 'класс')}</div>
                        <div className="text-[11px] text-slate-400 mt-1">{tr('Test natijasi:', 'Средний балл:')} <strong className="text-emerald-400">{coinRankings[2].avgScore || 0}%</strong></div>
                        <div className="podium-coins">
                          <Coins size={14} /> {coinRankings[2].coins} {tr('Coins', 'Койн.')}
                        </div>
                        <button
                          type="button"
                          className="mt-2 text-[10px] text-cyan-400 hover:text-cyan-300 font-bold bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/30"
                          onClick={() => handleQuickStudentAward(coinRankings[2].id, 10)}
                        >
                          +10 {tr('Coin Berish', 'Койн.')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ============================================================ */}
              {/* SUB-TABS NAVIGATION (LISTS, HISTORY, CLASSES)                */}
              {/* ============================================================ */}
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
                <button
                  type="button"
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    coinSubTab === 'rankings'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  onClick={() => setCoinSubTab('rankings')}
                >
                  <Trophy size={14} /> 🏆 {tr("O'quvchilar Reytingi", 'Рейтинг учеников')} ({coinRankings.length})
                </button>
                <button
                  type="button"
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    coinSubTab === 'history'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  onClick={() => setCoinSubTab('history')}
                >
                  <Clock size={14} /> 📜 {tr('Tranzaksiyalar Tarixi', 'История транзакций')} ({recentCoinTxs.length})
                </button>
                <button
                  type="button"
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    coinSubTab === 'classes'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  onClick={() => setCoinSubTab('classes')}
                >
                  <School size={14} /> 🏫 {tr("Sinflar To'liq Jadvali", 'Полная таблица классов')} ({classesCoinStats.length})
                </button>
              </div>

              {/* ============================================================ */}
              {/* VIEW 1: FULL LEADERBOARD                                     */}
              {/* ============================================================ */}
              {coinSubTab === 'rankings' && (
                <div className="space-y-4 animate-fade-in">
                  {/* Filter and Search Strip */}
                  <div className="admin-search-strip">
                    <div className="flex flex-wrap items-center gap-3 flex-1">
                      <div className="input-with-icon flex-1 min-w-[200px] max-w-sm">
                        <Search size={16} className="input-icon" />
                        <input
                          type="text"
                          className="clean-input text-xs"
                          placeholder={tr("O'quvchi ismi yoki logini bo'yicha qidiruv...", 'Поиск по имени или логину ученика...')}
                          value={coinSearchQuery}
                          onChange={(e) => setCoinSearchQuery(e.target.value)}
                        />
                      </div>

                      <select
                        className="clean-select text-xs w-auto"
                        value={coinGradeFilter}
                        onChange={(e) => setCoinGradeFilter(e.target.value)}
                      >
                        <option value="all">{tr('Barcha sinflar', 'Все классы')}</option>
                        {availableGrades.map((g) => (
                          <option key={g} value={g}>{localizeGrade(g, language)} {tr('sinf', 'класс')}</option>
                        ))}
                      </select>

                      <select
                        className="clean-select text-xs w-auto"
                        value={coinTierFilter}
                        onChange={(e) => setCoinTierFilter(e.target.value)}
                      >
                        <option value="all">{tr('Barcha ligalar', 'Все лиги')}</option>
                        <option value="diamond">{tr('💎 Diamond Liga (100+)', '💎 Лига Diamond (100+)')}</option>
                        <option value="gold">{tr('🥇 Gold Liga (50-99)', '🥇 Лига Gold (50-99)')}</option>
                        <option value="silver">{tr('🥈 Silver Liga (20-49)', '🥈 Лига Silver (20-49)')}</option>
                        <option value="bronze">{tr('🥉 Bronze Liga (1-19)', '🥉 Лига Bronze (1-19)')}</option>
                        <option value="zero">{tr('⚪ Hali olmagan (0 Coin)', '⚪ Ещё не получали (0 койн.)')}</option>
                      </select>

                      <button
                        type="button"
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all whitespace-nowrap flex items-center gap-1.5 ${
                          coinOnlyActiveFilter
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/45 shadow-sm'
                            : 'bg-slate-950/60 text-slate-300 border-slate-700 hover:border-cyan-400'
                        }`}
                        onClick={() => setCoinOnlyActiveFilter(!coinOnlyActiveFilter)}
                      >
                        <Zap size={13} />
                        <span>{tr('Faqat faol qatnashganlar', 'Только активные участники')}</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {(coinSearchQuery || coinGradeFilter !== 'all' || coinTierFilter !== 'all' || coinOnlyActiveFilter) && (
                        <button
                          type="button"
                          className="text-xs text-rose-400 hover:text-rose-300 font-bold px-3 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10"
                          onClick={() => {
                            setCoinSearchQuery('');
                            setCoinGradeFilter('all');
                            setCoinTierFilter('all');
                            setCoinOnlyActiveFilter(false);
                          }}
                        >
                          {tr('Filtrlarni Tozalash', 'Сбросить фильтры')}
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-warning btn-xs font-bold text-slate-950 px-3 py-1.5 flex items-center gap-1"
                        onClick={() =>
                          handleOpenAwardCoinsModal({
                            grade: coinGradeFilter !== 'all' ? coinGradeFilter : 'all',
                            onlyActive: true,
                          })
                        }
                      >
                        <Coins size={13} /> {tr('Faollarni Taqdirlash', 'Наградить активных')}
                      </button>
                    </div>
                  </div>

                  <div className="text-xs text-slate-400 flex items-center justify-between flex-wrap gap-2">
                    <span>
                      {tr('Topildi:', 'Найдено:')} <strong className="text-white">{filteredCoinRankings.length}</strong> {tr("nafar o'quvchi", 'учеников')}
                    </span>
                    {coinOnlyActiveFilter && (
                      <span className="text-[11px] text-emerald-300 font-semibold">
                        ✓ {tr("Kamida 1 ta test yechgan faol o'quvchilar ko'rsatilmoqda", 'Показаны активные ученики, прошедшие хотя бы 1 тест')}
                      </span>
                    )}
                  </div>

                  {/* Leaderboard Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredCoinRankings.map((item, idx) => {
                      const tier = getTierBadge(item.coins || 0);

                      return (
                        <div
                          key={item.id}
                          className="student-rank-card flex flex-wrap items-center justify-between p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-amber-500/40 transition-all shadow-md min-w-0"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center font-black text-xs text-amber-300 border border-slate-700/60 flex-shrink-0">
                              #{idx + 1}
                            </span>
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-600 to-slate-800 flex items-center justify-center text-white font-black text-sm border border-cyan-500/30 flex-shrink-0">
                              {(item.fullName || item.username).charAt(0)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-white text-sm">
                                  {item.fullName || item.full_name || item.username}
                                </span>
                                <span className={`tier-badge ${tier.cls}`}>
                                  {tier.label}
                                </span>
                                {(item.testsPassed || 0) > 0 && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
                                    ⚡ {tr('Faol', 'Активный')}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-400 flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-1">
                                <span className="text-cyan-400 font-semibold">{localizeGrade(item.grade, language)} {tr('sinf', 'класс')}</span>
                                <span>•</span>
                                <span>{tr('Testlar:', 'Тесты:')} {item.testsPassed || 0} {tr('ta', 'шт.')}</span>
                                <span>•</span>
                                <span className="text-emerald-400 font-bold">{item.avgScore || 0}% {tr("o'zlashtirish", 'успеваемость')}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/35 text-amber-300 font-black text-xs shadow-md">
                              <Coins size={13} /> {item.coins} {tr('Coins', 'Койн.')}
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 hover:bg-slate-700"
                                onClick={() => handleQuickStudentAward(item.id, 5)}
                                title={tr('+5 Coin berish', 'Начислить +5 койнов')}
                              >
                                +5
                              </button>
                              <button
                                type="button"
                                className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 hover:bg-slate-700"
                                onClick={() => handleQuickStudentAward(item.id, 10)}
                                title={tr('+10 Coin berish', 'Начислить +10 койнов')}
                              >
                                +10
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {filteredCoinRankings.length === 0 && (
                      <div className="col-span-2 text-center py-10 text-slate-400 text-xs bg-slate-900/40 rounded-2xl border border-slate-800">
                        {tr("Tanlangan mezonlar bo'yicha o'quvchilar topilmadi.", 'Ученики по выбранным критериям не найдены.')}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ============================================================ */}
              {/* VIEW 2: RECENT TRANSACTIONS LOG                              */}
              {/* ============================================================ */}
              {coinSubTab === 'history' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="table-responsive bg-slate-900/70 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                    <table className="diamond-table w-full text-left">
                      <thead>
                        <tr>
                          <th>{tr("O'quvchi / Sinf", 'Ученик / Класс')}</th>
                          <th>{tr('Sinfi', 'Класс')}</th>
                          <th>{tr('Coin Miqdori', 'Кол-во койнов')}</th>
                          <th>{tr('Sabab / Kategoriya', 'Причина / Категория')}</th>
                          <th>{tr('Kim tomonidan berildi', 'Кем начислено')}</th>
                          <th>{tr('Sana va Vaqt', 'Дата и время')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(Array.isArray(recentCoinTxs) ? recentCoinTxs : []).map((tx) => (
                          <tr key={tx.id}>
                            <td>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-white text-xs">{tx.studentName || tx.student_name}</span>
                                {tx.entryType === 'class' && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/35 font-bold">
                                    🏫 {tr('Sinf fondi', 'Фонд класса')}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>
                              <span className="badge badge-info text-[11px] font-semibold">{localizeGrade(tx.grade, language)}</span>
                            </td>
                            <td>
                              <span className={`font-black text-xs px-2 py-0.5 rounded-full ${
                                tx.amount > 0 ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                              }`}>
                                {tx.amount > 0 ? `+${tx.amount}` : tx.amount} {tr('Coin', 'Койн')}
                              </span>
                            </td>
                            <td className="text-xs text-slate-200">{tx.reason}</td>
                            <td>
                              <span className="text-xs text-cyan-300 font-semibold">{tx.givenBy || tr('Tizim (Avtomatik)', 'Система (Авто)')}</span>
                            </td>
                            <td className="text-xs text-slate-400">{tx.date || tr('Yaqinda', 'Недавно')}</td>
                          </tr>
                        ))}

                        {recentCoinTxs.length === 0 && (
                          <tr>
                            <td colSpan={6} className="text-center py-10 text-slate-400 text-xs">
                              {tr('Hozircha tranzaksiyalar tarixi mavjud emas.', 'История транзакций пока пуста.')}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ============================================================ */}
              {/* VIEW 3: FULL CLASSES BREAKDOWN TABLE                         */}
              {/* ============================================================ */}
              {coinSubTab === 'classes' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="table-responsive bg-slate-900/70 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                    <table className="diamond-table w-full text-left">
                      <thead>
                        <tr>
                          <th>{tr("O'rin", 'Место')}</th>
                          <th>{tr('Sinf Nomi', 'Класс')}</th>
                          <th>{tr("O'quvchilar", 'Ученики')}</th>
                          <th>{tr('Sinf Fondi + Jami Coin', 'Фонд класса + Всего койнов')}</th>
                          <th>{tr("O'rtacha / Bola", 'В среднем / Ученик')}</th>
                          <th>{tr('Maktab Fondidagi Ulushi', 'Доля в фонде школы')}</th>
                          <th className="text-right">{tr('Amal', 'Действие')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {classesCoinStats.map((cls, idx) => {
                          const totalAll = coinStats?.totalCoins ?? 0;
                          const sharePct = totalAll > 0 ? Math.round(((cls.totalCoins || 0) / totalAll) * 100) : 0;

                          return (
                            <tr key={cls.className}>
                              <td>
                                <span className="font-black text-amber-300 text-xs">
                                  {idx === 0 ? tr("🥇 1-o'rin", '🥇 1-е место') : idx === 1 ? tr("🥈 2-o'rin", '🥈 2-е место') : idx === 2 ? tr("🥉 3-o'rin", '🥉 3-е место') : `${idx + 1}-${tr("o'rin", 'е место')}`}
                                </span>
                              </td>
                              <td>
                                <span className="font-black text-white text-sm">{localizeGrade(cls.className, language)} {tr('sinf', 'класс')}</span>
                              </td>
                              <td className="text-xs text-slate-300">
                                {cls.studentsCount || 0} {tr('nafar', 'уч.')} ({cls.activeStudentsCount ?? 0} {tr('faol', 'акт.')})
                              </td>
                              <td>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-black text-amber-400 text-xs font-mono">{cls.totalCoins || 0} {tr('Coin', 'Койн')}</span>
                                  {(cls.classBonusCoins || 0) > 0 && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 font-bold">
                                      {tr('Fond:', 'Фонд:')} {cls.classBonusCoins}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="text-xs text-cyan-300 font-bold">~{cls.avgCoins || 0} {tr('coin/bola', 'койн./уч.')}</td>
                              <td>
                                <div className="flex items-center gap-2">
                                  <div className="w-20 h-2 bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${sharePct}%` }} />
                                  </div>
                                  <span className="text-xs text-slate-300 font-bold">{sharePct}%</span>
                                </div>
                              </td>
                              <td className="text-right">
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-xs font-bold text-cyan-300"
                                  onClick={() => {
                                    setBatchClassForm((prev) => ({
                                      ...prev,
                                      className: cls.className,
                                      awardScope: 'class_only',
                                    }));
                                    setIsBatchClassRewardOpen(true);
                                  }}
                                >
                                  {tr('Sinfga Coin Berish', 'Койны классу')}
                                </button>
                              </td>
                            </tr>
                          );
                        })}

                        {classesCoinStats.length === 0 && (
                          <tr>
                            <td colSpan={7} className="text-center py-8 text-slate-400 text-xs">
                              {tr("Sinflar ma'lumoti mavjud emas.", 'Данные о классах отсутствуют.')}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: CLASSES MANAGEMENT */}
          {activeTab === 'classes' && (
            <div className="space-y-5 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/80 p-4 rounded-2xl border border-cyan-500/30">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <School className="text-cyan-400" size={20} />
                    {tr('Maktab Sinflari va Guruhlarni Boshqarish', 'Управление классами и группами школы')}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {tr(
                      "O'zbek va rus tillaridagi barcha parallel sinflar tarkibi, o'zlashtirish va coinlar monitoringi",
                      'Состав параллельных классов с узбекским и русским языками обучения, мониторинг успеваемости и койнов'
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center bg-slate-950/60 p-1 rounded-xl border border-slate-800 text-xs">
                    <button
                      type="button"
                      className={`px-3 py-1 rounded-lg font-bold transition-all ${
                        classFilter === 'all' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                      }`}
                      onClick={() => setClassFilter('all')}
                    >
                      {tr('Barchasi', 'Все')} ({classesList.length})
                    </button>
                    <button
                      type="button"
                      className={`px-3 py-1 rounded-lg font-bold transition-all ${
                        classFilter === 'uz' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                      }`}
                      onClick={() => setClassFilter('uz')}
                    >
                      {tr("O'zbek", 'Узбекские')}
                    </button>
                    <button
                      type="button"
                      className={`px-3 py-1 rounded-lg font-bold transition-all ${
                        classFilter === 'ru' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                      }`}
                      onClick={() => setClassFilter('ru')}
                    >
                      {tr('Rus', 'Русские')}
                    </button>
                  </div>

                  <button
                    type="button"
                    className="btn btn-warning btn-sm flex items-center gap-1.5 font-bold shadow-md shadow-amber-500/20"
                    onClick={() => {
                      const defCls =
                        classesList.find((c) => c.name === batchClassForm.className)?.name ||
                        classesList[0]?.name ||
                        batchClassForm.className;
                      setBatchClassForm((prev) => ({
                        ...prev,
                        className: defCls,
                        awardScope: 'class_only',
                      }));
                      setIsBatchClassRewardOpen(true);
                    }}
                  >
                    <Coins size={16} /> {tr('Sinfga Coin Berish', 'Койны классу')}
                  </button>

                  <button
                    type="button"
                    className="btn btn-diamond-cyan btn-sm flex items-center gap-1.5 font-bold shadow-md"
                    onClick={() => setIsAddClassOpen(true)}
                  >
                    <Plus size={16} /> {tr('Yangi Sinf', 'Новый класс')}
                  </button>
                </div>
              </div>

              {/* Sinflar bo'yicha Coinlar va O'zlashtirish Statistikasi Banneri */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-900/80 border border-cyan-500/30 flex items-center gap-2.5 sm:gap-3 min-w-0">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 flex-shrink-0">
                    <School size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-lg sm:text-xl font-black text-white font-cinzel">
                      {classesList.length} {tr('ta', 'кл.')}
                    </div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      {tr('Jami Parallel Sinflar', 'Всего параллельных классов')}
                    </div>
                  </div>
                </div>

                <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-900/80 border border-amber-500/30 flex items-center gap-2.5 sm:gap-3 min-w-0">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0">
                    <Coins size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-lg sm:text-xl font-black text-amber-400 font-cinzel truncate">
                      {classesSummary?.totalCoins ?? coinStats?.totalCoins ?? 0} 💎
                    </div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      {tr('Sinflar Jami Coini', 'Общие койны классов')}
                    </div>
                    {(classesSummary?.classBonusCoinsTotal ?? 0) > 0 && (
                      <div className="text-[10px] text-purple-300 font-semibold mt-0.5">
                        🏫 {tr('Sinf fondlari:', 'Фонды классов:')} {classesSummary?.classBonusCoinsTotal ?? 0} 💎
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-900/80 border border-purple-500/30 flex items-center gap-2.5 sm:gap-3 min-w-0">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 flex-shrink-0">
                    <Trophy size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-base sm:text-lg font-black text-purple-300 line-clamp-1">
                      {classesSummary?.topClass && classesSummary.topClass !== '-'
                        ? `${localizeGrade(classesSummary.topClass, language)} ${tr('sinf', 'класс')}`
                        : '-'}
                    </div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      {classesSummary?.topClassCoins ?? 0} {tr("Coin (1-o'rin 👑)", 'Койн. (1-е место 👑)')}
                    </div>
                  </div>
                </div>

                <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-900/80 border border-emerald-500/30 flex items-center gap-2.5 sm:gap-3 min-w-0">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
                    <TrendingUp size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-black text-white">
                      {tr("O'zbek:", 'Узб.:')} <span className="text-cyan-400">{classesSummary?.uzCoins ?? 0}</span> 💎
                    </div>
                    <div className="text-xs font-black text-white">
                      {tr('Rus:', 'Рус.:')} <span className="text-rose-400">{classesSummary?.ruCoins ?? 0}</span> 💎
                    </div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                      {tr('Tillar Kesimida Coinlar', 'Койны по языкам')}
                    </div>
                  </div>
                </div>
              </div>

              {/* ============================================================ */}
              {/* SINFLAR STATISTIKASI: GRAFIKLAR VA DIAGRAMMALAR             */}
              {/* ============================================================ */}
              {(() => {
                const safeClasses = Array.isArray(classesList) ? classesList : [];
                const filteredTabClasses = safeClasses.filter(
                  (cls) => classFilter === 'all' || cls.language === classFilter
                );
                const chartClasses = classesScoreOnlyActive
                  ? filteredTabClasses.filter(
                      (c) => (c.submissionsCount || 0) > 0 || (c.studentsCount || 0) > 0 || (c.totalCoins || 0) > 0
                    )
                  : filteredTabClasses;

                const activeScoreDist =
                  classFilter === 'uz'
                    ? classesSummary?.uzScoreDistribution || { excellent: 0, good: 0, fair: 0, poor: 0 }
                    : classFilter === 'ru'
                    ? classesSummary?.ruScoreDistribution || { excellent: 0, good: 0, fair: 0, poor: 0 }
                    : classesSummary?.scoreDistribution || { excellent: 0, good: 0, fair: 0, poor: 0 };

                const activeAvgScore =
                  classFilter === 'uz'
                    ? classesSummary?.uzAvgScore ?? 0
                    : classFilter === 'ru'
                    ? classesSummary?.ruAvgScore ?? 0
                    : classesSummary?.overallAvgScore ?? 0;

                const scoreBarItems = chartClasses.map((cls) => ({
                  key: cls.name,
                  label: localizeGrade(cls.name, language),
                  sublabel: `${cls.submissionsCount || 0} ${tr('ta natija', 'рез.')}`,
                  value: cls.avgScore || 0,
                  noData: (cls.submissionsCount || 0) === 0,
                  detail:
                    (cls.submissionsCount || 0) > 0
                      ? `${localizeGrade(cls.name, language)} (${cls.language === 'ru' ? 'RU' : 'UZ'}) — ${tr("O'rtacha", 'Средний')} ${cls.avgScore}% • ${tr("O'tish darajasi", 'Проходимость')} ${cls.passRate ?? 0}% (${cls.submissionsCount} ${tr('ta test', 'тест.')})`
                      : `${localizeGrade(cls.name, language)} — ${tr('hali test natijasi mavjud emas', 'результатов тестов пока нет')}`,
                  rawClass: cls,
                }));

                const parallelStats = Array.isArray(classesSummary?.parallelStats)
                  ? classesSummary.parallelStats
                  : [];

                const comparisonBarItems =
                  classesBarMode === 'parallels'
                    ? parallelStats.map((p) => {
                        const pLabel = language === 'ru' ? `${p.gradeLevel}-кл.` : p.label;
                        const pTitle = language === 'ru' ? `${p.gradeLevel}-е классы` : p.label;
                        return {
                          key: String(p.gradeLevel),
                          label: pLabel,
                          sublabel: `${p.studentsCount} ${tr('bola', 'уч.')}`,
                          primaryValue: p.studentCoins || 0,
                          secondaryValue: p.classBonusCoins || 0,
                          value: p.totalCoins || 0,
                          detail: `${pTitle}: ${p.classesCount} ${tr('ta sinf', 'кл.')} • ${p.studentsCount} ${tr("o'quvchi", 'уч.')} (${p.activeStudentsCount} ${tr('faol', 'акт.')}) • ${tr("O'rtacha ball", 'Средний балл')} ${p.avgScore}%`,
                        };
                      })
                    : classesBarMode === 'students'
                    ? chartClasses.map((cls) => {
                        const activeCnt = cls.activeStudentsCount || 0;
                        const totalCnt = cls.studentsCount || 0;
                        const passiveCnt = Math.max(0, totalCnt - activeCnt);
                        return {
                          key: cls.name,
                          label: localizeGrade(cls.name, language),
                          sublabel: `${cls.avgScore || 0}% ${tr('ball', 'балл')}`,
                          primaryValue: activeCnt,
                          secondaryValue: passiveCnt,
                          value: totalCnt,
                          detail: `${localizeGrade(cls.name, language)}: ${activeCnt} ${tr('faol', 'акт.')} / ${totalCnt} ${tr("jami o'quvchi", 'всего уч.')} • ${cls.submissionsCount || 0} ${tr('ta topshiriq', 'попыток')}`,
                          rawClass: cls,
                        };
                      })
                    : chartClasses.map((cls) => ({
                        key: cls.name,
                        label: localizeGrade(cls.name, language),
                        sublabel: `${cls.avgCoins || 0}/${tr('bola', 'уч.')}`,
                        primaryValue: cls.studentCoins || 0,
                        secondaryValue: cls.classBonusCoins || 0,
                        value: cls.totalCoins || 0,
                        detail: `${localizeGrade(cls.name, language)}: ${tr("O'quvchilar", 'Ученики')} ${cls.studentCoins || 0} + ${tr('Sinf fondi', 'Фонд класса')} ${cls.classBonusCoins || 0} = ${cls.totalCoins || 0} ${tr('Coin', 'Койн')}`,
                        rawClass: cls,
                      }));

                const uzTotalCoins = classesSummary?.uzCoins ?? 0;
                const ruTotalCoins = classesSummary?.ruCoins ?? 0;
                const langComparisonSegments = [
                  {
                    key: 'uz',
                    label: `${tr("O'zbek sinflari", 'Узбекские классы')} (${classesSummary?.uzCount ?? 0} ${tr('ta', 'кл.')})`,
                    shortLabel: tr("O'zbek", 'Узб.'),
                    value: uzTotalCoins,
                    countText: `${uzTotalCoins} 💎`,
                    secondaryText: `${classesSummary?.uzStudentsCount ?? 0} ${tr("o'quvchi", 'учеников')} • ${tr("O'rtacha ball:", 'Средний балл:')} ${classesSummary?.uzAvgScore ?? 0}%`,
                    color: '#06b6d4',
                  },
                  {
                    key: 'ru',
                    label: `${tr('Rus sinflari', 'Русские классы')} (${classesSummary?.ruCount ?? 0} ${tr('ta', 'кл.')})`,
                    shortLabel: tr('Rus', 'Рус.'),
                    value: ruTotalCoins,
                    countText: `${ruTotalCoins} 💎`,
                    secondaryText: `${classesSummary?.ruStudentsCount ?? 0} ${tr("o'quvchi", 'учеников')} • ${tr("O'rtacha ball:", 'Средний балл:')} ${classesSummary?.ruAvgScore ?? 0}%`,
                    color: '#f43f5e',
                  },
                ];

                const filterLabel =
                  classFilter === 'uz'
                    ? tr("O'zbek", 'Узбекские')
                    : classFilter === 'ru'
                    ? tr('Rus', 'Русские')
                    : tr('Maktab', 'Школа');

                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      <ScoreTierDonutChart
                        distribution={activeScoreDist}
                        avgScore={activeAvgScore}
                        title={`${tr("Sinflar O'zlashtirish Darajasi", 'Уровень успеваемости классов')} (${filterLabel})`}
                        subtitle={tr(
                          "Test natijalarining sifat darajalari (A'lo, Yaxshi, O'rta, Sust) bo'yicha ulushi",
                          'Доля результатов тестов по уровням качества (Отлично, Хорошо, Средне, Слабо)'
                        )}
                      />

                      <VerticalBarDiagram
                        testId="admin-classes-score-bar"
                        title={tr("Sinflar Bo'yicha O'rtacha Natija Diagrammasi (%)", 'Диаграмма среднего балла по классам (%)')}
                        subtitle={tr(
                          "Ustunni bosish orqali sinf o'quvchilari va faolligini ko'rishingiz mumkin",
                          'Нажмите на столбец, чтобы посмотреть учеников и активность класса'
                        )}
                        items={scoreBarItems}
                        passThreshold={60}
                        onItemClick={(item) => item.rawClass && setViewingClassStudents(item.rawClass)}
                        emptyText={tr('Diagramma uchun sinflar topilmadi', 'Классы для диаграммы не найдены')}
                        headerRight={
                          <button
                            type="button"
                            className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
                              classesScoreOnlyActive
                                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                                : 'bg-slate-900 text-slate-300 border-slate-700'
                            }`}
                            onClick={() => setClassesScoreOnlyActive((v) => !v)}
                          >
                            {classesScoreOnlyActive ? tr('Faol sinflar', 'Активные классы') : tr('Barcha sinflar', 'Все классы')}
                          </button>
                        }
                      />
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      <ValueBarDiagram
                        testId="admin-classes-comparison-bar"
                        title={
                          classesBarMode === 'parallels'
                            ? tr('Parallellar (5–11-sinflar) Qiyosiy Diagrammasi', 'Сравнительная диаграмма параллелей (5–11 классы)')
                            : classesBarMode === 'students'
                            ? tr("Sinflar Bo'yicha O'quvchilar va Faollik", 'Ученики и активность по классам')
                            : tr("Sinflar Bo'yicha Coinlar va Fond Diagrammasi", 'Диаграмма койнов и фондов классов')
                        }
                        subtitle={
                          classesBarMode === 'parallels'
                            ? tr("Har bir parallel bo'g'indagi umumiy coin jamg'armasi", 'Общий фонд койнов по каждой параллели')
                            : classesBarMode === 'students'
                            ? tr('Faol test ishtirokchilari va umumiy tarkib nisbati', 'Соотношение активных участников тестов к общему составу')
                            : tr("O'quvchilar coini va sinf shaxsiy fondi qiyosiy grafigi", 'Сравнение койнов учеников и личного фонда класса')
                        }
                        items={comparisonBarItems}
                        unit={classesBarMode === 'students' ? tr('nafar', 'уч.') : '💎'}
                        primaryColor={classesBarMode === 'students' ? '#10b981' : '#f59e0b'}
                        secondaryColor={classesBarMode === 'students' ? '#475569' : '#a855f7'}
                        primaryLegend={
                          classesBarMode === 'students'
                            ? tr('Faol o‘quvchi', 'Активный ученик')
                            : tr("O'quvchilar coini", 'Койны учеников')
                        }
                        secondaryLegend={
                          classesBarMode === 'students'
                            ? tr('Hali test topshirmagan', 'Ещё не сдавали тесты')
                            : tr('Sinf fondi', 'Фонд класса')
                        }
                        onItemClick={(item) => item.rawClass && setViewingClassStudents(item.rawClass)}
                        headerRight={
                          <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[10px] font-bold">
                            {[
                              { id: 'coins', lbl: tr('Coinlar', 'Койны') },
                              { id: 'parallels', lbl: tr('Parallellar', 'Параллели') },
                              { id: 'students', lbl: tr("O'quvchi", 'Ученики') },
                            ].map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                className={`px-2 py-1 rounded-md transition-all ${
                                  classesBarMode === m.id
                                    ? 'bg-cyan-500 text-slate-950 font-black'
                                    : 'text-slate-400 hover:text-white'
                                }`}
                                onClick={() => setClassesBarMode(m.id)}
                              >
                                {m.lbl}
                              </button>
                            ))}
                          </div>
                        }
                      />

                      <MultiSegmentDonutChart
                        testId="admin-classes-lang-donut"
                        title={tr('Tillar Kesimida Qiyosiy Diagramma (UZ vs RU)', 'Сравнительная диаграмма по языкам (UZ vs RU)')}
                        subtitle={tr(
                          "O'zbek va Rus sinflarining maktab bo'yicha coin va o'zlashtirish ko'rsatkichlari",
                          'Показатели койнов и успеваемости узбекских и русских классов школы'
                        )}
                        segments={langComparisonSegments}
                        centerValue={`${classesSummary?.total ?? classesList.length}`}
                        centerLabel={tr('Sinflar', 'Классы')}
                        badgeText={`${tr("O'quvchilar:", 'Ученики:')} ${classesSummary?.totalActiveStudents ?? 0}/${classesSummary?.totalStudents ?? students.length}`}
                        selectedKey={classFilter !== 'all' ? classFilter : null}
                        onSegmentClick={(seg) =>
                          setClassFilter((prev) => (prev === seg.key ? 'all' : seg.key))
                        }
                      />
                    </div>
                  </div>
                );
              })()}

              {/* Sinflar Kartalari Gridi */}
              <div className="classes-luxury-grid">
                {(Array.isArray(classesList) ? classesList : [])
                  .filter((cls) => classFilter === 'all' || cls.language === classFilter)
                  .map((cls) => {
                    const stdCount = cls.studentsCount ?? cls.students_count ?? 0;
                    const activeStdCount = cls.activeStudentsCount ?? 0;
                    const avgSc = cls.avgScore ?? 0;
                    const totCoins = cls.totalCoins ?? 0;
                    const bonusCoins = cls.classBonusCoins ?? 0;
                    const avgCoins = cls.avgCoins ?? 0;
                    const coinRank = cls.coinRank;
                    const rawRoom = cls.room;
                    const roomDisplay =
                      !rawRoom || rawRoom === '-' || String(rawRoom).toLowerCase() === 'belgilanmagan'
                        ? tr('Belgilanmagan', 'Не указан')
                        : rawRoom;

                    return (
                      <div key={cls.id} className="class-card-luxury">
                        <div>
                          <div className="class-card-top">
                            <span className="class-name-badge">{localizeGrade(cls.name, language)}</span>
                            <span className={`class-lang-chip ${cls.language === 'ru' ? 'ru' : 'uz'}`}>
                              {cls.language === 'ru' ? tr('RU • Rus tili', 'RU • Русский') : tr("UZ • O'zbek", 'UZ • Узбекский')}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 mt-3 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                            <div className="class-stat-item">
                              <span className="class-stat-val text-cyan-400 text-sm font-extrabold">{stdCount} {tr('nafar', 'уч.')}</span>
                              <span className="class-stat-lbl text-[10px]">{activeStdCount} {tr('ta faol', 'акт.')}</span>
                            </div>
                            <div className="class-stat-item">
                              <span className="class-stat-val text-amber-400 text-sm font-extrabold flex items-center gap-1 font-mono">
                                <Coins size={12} /> {totCoins}
                              </span>
                              <span className="class-stat-lbl text-[10px]">
                                {bonusCoins > 0 ? `${tr('Fond:', 'Фонд:')} +${bonusCoins}` : tr('Jami Coin', 'Всего койн.')}
                              </span>
                            </div>
                            <div className="class-stat-item">
                              <span className="class-stat-val text-emerald-400 text-sm font-extrabold">{avgSc}%</span>
                              <span className="class-stat-lbl text-[10px]">{tr("O'rtacha Ball", 'Средний балл')}</span>
                            </div>
                          </div>

                          <div className="text-[11px] text-slate-400 mt-2 flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-amber-300 font-bold">
                              {coinRank
                                ? coinRank === 1
                                  ? tr("🥇 1-o'rin (Yetakchi)", '🥇 1-е место (Лидер)')
                                  : coinRank === 2
                                  ? tr("🥈 2-o'rin", '🥈 2-е место')
                                  : coinRank === 3
                                  ? tr("🥉 3-o'rin", '🥉 3-е место')
                                  : `${coinRank}-${tr("o'rin", 'е место')}`
                                : '-'}
                            </span>
                            <span>
                              {tr('Sinf fondi:', 'Фонд класса:')} <strong className="text-purple-300">{bonusCoins} 💎</strong> •{' '}
                              <strong className="text-cyan-300">~{avgCoins}</strong>/{tr('bola', 'уч.')}
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                            <span>{tr('Xona:', 'Кабинет:')} <strong className="text-white">{roomDisplay}</strong></span>
                            <span className="text-emerald-400 font-bold">{cls.rating || tr("Natija yo'q", 'Нет оценок')}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 gap-1.5 flex-wrap">
                          <button
                            type="button"
                            className="btn btn-secondary btn-xs text-[11px] flex items-center gap-1 font-semibold"
                            onClick={() => setViewingClassStudents(cls)}
                          >
                            <Users size={12} /> {tr("O'quvchilar", 'Ученики')} ({stdCount})
                          </button>
                          <button
                            type="button"
                            className="btn btn-warning btn-xs text-[11px] font-bold flex items-center gap-1 shadow-sm"
                            onClick={() => {
                              setBatchClassForm((prev) => ({
                                ...prev,
                                className: cls.name,
                                awardScope: 'class_only',
                              }));
                              setIsBatchClassRewardOpen(true);
                            }}
                            title={tr("Faol sinf o'ziga yoki o'quvchilariga coin berish", 'Начислить койны классу или его ученикам')}
                          >
                            <Coins size={12} /> + {tr('Coin', 'Койн')}
                          </button>
                          <button
                            type="button"
                            className="btn-icon-red p-1.5 ml-auto"
                            onClick={() => handleDeleteClass(cls)}
                            title={tr("Sinfni o'chirish", 'Удалить класс')}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* TAB 5: CONTACT MESSAGES & LEADS */}
          {activeTab === 'showcase' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/80 p-4 rounded-2xl border border-sky-500/30">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Mail className="text-sky-400" size={20} />
                    {tr('Saytdan Kelib Tushgan Murojaat va Qabul Arizalari', 'Обращения и заявки на приём с сайта')}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {tr(
                      'Ota-onalar va mehmonlar qoldirgan telefon raqamlari va savollari',
                      'Номера телефонов и вопросы, оставленные родителями и гостями'
                    )}
                  </p>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center bg-slate-950/60 p-1 rounded-xl border border-slate-800 text-xs">
                  <button
                    type="button"
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                      contactFilter === 'all' ? 'bg-sky-500 text-slate-950' : 'text-slate-400 hover:text-white'
                    }`}
                    onClick={() => setContactFilter('all')}
                  >
                    {tr('Barchasi', 'Все')} ({contactMessages.length})
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                      contactFilter === 'pending' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                    }`}
                    onClick={() => setContactFilter('pending')}
                  >
                    ⏳ {tr('Kutilmoqda', 'Ожидают')} ({(Array.isArray(contactMessages) ? contactMessages : []).filter((m) => !(m.isContacted || m.is_contacted)).length})
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                      contactFilter === 'contacted' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
                    }`}
                    onClick={() => setContactFilter('contacted')}
                  >
                    ✓ {tr("Bog'lanilgan", 'Связались')} ({(Array.isArray(contactMessages) ? contactMessages : []).filter((m) => (m.isContacted || m.is_contacted)).length})
                  </button>
                </div>
              </div>

              <div className="contact-inbox-grid">
                {(Array.isArray(contactMessages) ? contactMessages : [])
                  .filter((msg) => {
                    const isDone = msg.isContacted || msg.is_contacted;
                    if (contactFilter === 'pending') return !isDone;
                    if (contactFilter === 'contacted') return isDone;
                    return true;
                  })
                  .map((msg) => {
                    const isDone = msg.isContacted || msg.is_contacted;
                    const name = msg.fullName || msg.full_name || tr('Mehmon', 'Гость');
                    const initial = name.charAt(0).toUpperCase();

                    return (
                      <div key={msg.id} className={`contact-card ${isDone ? 'contacted' : ''}`}>
                        <div className="contact-card-header">
                          <div className="contact-caller-meta">
                            <div className={`contact-avatar ${isDone ? 'avatar-contacted' : ''}`}>
                              {initial}
                            </div>
                            <div>
                              <div className="contact-caller-name">{name}</div>
                              <a href={`tel:${msg.phone}`} className="contact-phone-link" title={tr("Qo'ng'iroq qilish", 'Позвонить')}>
                                <Phone size={13} />
                                <span>{msg.phone}</span>
                              </a>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {msg.gradeInterest && (
                              <span className="badge badge-info text-[11px] font-semibold">
                                {localizeGrade(msg.gradeInterest, language)}
                              </span>
                            )}
                            <span className={`contact-status-chip ${isDone ? 'contacted' : 'pending'}`}>
                              {isDone ? `✓ ${tr("Bog'lanilgan", 'Связались')}` : `⏳ ${tr("Bog'lanish kerak", 'Нужно связаться')}`}
                            </span>
                          </div>
                        </div>

                        {/* Message body */}
                        <div className="contact-msg-box">
                          {msg.message || tr("Xabar qoldirilmagan (Faqat qayta qo'ng'iroq so'rovi)", 'Сообщение не оставлено (только запрос на обратный звонок)')}
                        </div>

                        {/* Footer bar */}
                        <div className="contact-footer-bar">
                          <span className="contact-date-chip">
                            <Clock size={13} /> {msg.createdAt || msg.created_at || tr('Yaqinda', 'Недавно')}
                          </span>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className={`btn btn-xs font-bold flex items-center gap-1 ${
                                isDone ? 'btn-secondary text-slate-300' : 'btn-success'
                              }`}
                              onClick={() => handleToggleContactMessage(msg.id)}
                            >
                              <CheckCircle size={13} />
                              <span>{isDone ? tr('Kutilmoqdaga qaytarish', 'Вернуть в ожидание') : tr("Bog'lanildi deb belgilash", 'Отметить как обработанное')}</span>
                            </button>

                            <a
                              href={`tel:${msg.phone}`}
                              className="btn btn-secondary btn-xs flex items-center gap-1 text-cyan-400 font-bold"
                            >
                              <Phone size={13} /> {tr("Qo'ng'iroq", 'Звонок')}
                            </a>

                            <button
                              type="button"
                              className="btn-icon-red p-1.5"
                              onClick={() => handleDeleteContactMessage(msg.id)}
                              title={tr("O'chirish", 'Удалить')}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                {contactMessages.length === 0 && (
                  <div className="text-center py-12 text-slate-400 text-xs bg-slate-900/40 rounded-2xl border border-slate-800">
                    {tr('Hozircha saytdan yangi murojaatlar kelib tushmagan.', 'Новых обращений с сайта пока не поступало.')}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MODAL: ADD TEACHER */}
      {isAddTeacherOpen && (
        <div className="modal-backdrop" onClick={() => setIsAddTeacherOpen(false)}>
          <div className="modal-content animate-scale-in max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title flex items-center gap-2">
                <ChalkboardTeacher className="text-cyan-400" size={20} /> {tr("Yangi O'qituvchi Qo'shish", 'Добавить нового учителя')}
              </h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsAddTeacherOpen(false)}
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateTeacher} className="modal-body space-y-3.5 pt-3">
              {/* Optional Avatar Upload */}
              <div className="flex items-center gap-4 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-800 border border-cyan-400/50 flex items-center justify-center flex-shrink-0">
                  {teacherAvatarPreview ? (
                    <img src={teacherAvatarPreview} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Camera size={22} className="text-slate-400" />
                  )}
                </div>
                <div className="space-y-1.5">
                  <div className="text-xs font-bold text-white">{tr("O'qituvchi Surati (ixtiyoriy)", 'Фото учителя (необязательно)')}</div>
                  <label className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 text-[11px] font-bold cursor-pointer">
                    <Camera size={13} />
                    <span>{teacherAvatarFile ? tr('Rasmni almashtirish', 'Заменить фото') : tr('Rasm yuklash', 'Загрузить фото')}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (!file) return;
                        if (file.size > 5 * 1024 * 1024) {
                          showToast(tr('Rasm hajmi 5MB dan oshmasligi kerak!', 'Размер фото не должен превышать 5 МБ!'), 'warning');
                          return;
                        }
                        setTeacherAvatarFile(file);
                        const reader = new FileReader();
                        reader.onload = (ev) => setTeacherAvatarPreview(ev.target.result);
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="input-label">{tr("F.I.SH (To'liq ism) *", 'Ф.И.О. (Полное имя) *')}</label>
                <input
                  type="text"
                  className="clean-input"
                  placeholder={tr('Masalan: Dilnoza Karimova', 'Например: Дилноза Каримова')}
                  value={teacherForm.fullName}
                  onChange={(e) => setTeacherForm({ ...teacherForm, fullName: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">{tr('Login (username) *', 'Логин (username) *')}</label>
                  <input
                    type="text"
                    className="clean-input"
                    placeholder="dilnoza_ustoz"
                    value={teacherForm.username}
                    onChange={(e) => setTeacherForm({ ...teacherForm, username: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="input-label">{tr('Parol *', 'Пароль *')}</label>
                  <input
                    type="text"
                    className="clean-input"
                    placeholder="123"
                    value={teacherForm.password}
                    onChange={(e) => setTeacherForm({ ...teacherForm, password: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">{tr("O'qitadigan Fani *", 'Преподаваемый предмет *')}</label>
                  <select
                    className="clean-select"
                    value={teacherForm.subject}
                    onChange={(e) => setTeacherForm({ ...teacherForm, subject: e.target.value })}
                  >
                    {subjectsList.map((s) => (
                      <option key={s} value={s}>
                        {localizeSubject(s, language)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="input-label">{tr('Telefon raqam', 'Номер телефона')}</label>
                  <input
                    type="text"
                    className="clean-input"
                    placeholder="+998 90 123 45 67"
                    value={teacherForm.phone}
                    onChange={(e) => setTeacherForm({ ...teacherForm, phone: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="input-label">{tr("Qisqacha bio / ma'lumot", 'Краткая информация / био')}</label>
                <textarea
                  rows={2}
                  className="clean-input text-xs"
                  placeholder={tr("Tajribasi va yo'nalishi haqida...", 'Об опыте и специализации...')}
                  value={teacherForm.bio}
                  onChange={(e) => setTeacherForm({ ...teacherForm, bio: e.target.value })}
                />
              </div>

              <div className="modal-footer flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsAddTeacherOpen(false)}
                >
                  {tr('Bekor qilish', 'Отмена')}
                </button>
                <button type="submit" className="btn btn-diamond-cyan btn-sm font-bold">
                  {tr("Qo'shish", 'Добавить')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT TEACHER PROFILE (Photo, Info & Password) */}
      {editingTeacher && (
        <div className="modal-backdrop" onClick={() => setEditingTeacher(null)}>
          <div className="modal-content animate-scale-in max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title flex items-center gap-2">
                <ChalkboardTeacher className="text-cyan-400" size={20} /> {tr("O'qituvchi Profilini Tahrirlash", 'Редактировать профиль учителя')}
              </h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setEditingTeacher(null)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveEditTeacher} className="modal-body space-y-3.5 pt-3">
              {/* Photo Upload / Replace */}
              <div className="flex items-center gap-4 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-800 border-2 border-cyan-400/60 flex items-center justify-center flex-shrink-0">
                  {editTeacherForm.avatarPreview ? (
                    <img src={editTeacherForm.avatarPreview} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xl font-black text-cyan-300">
                      {(editTeacherForm.fullName || 'U')[0]}
                    </span>
                  )}
                </div>
                <div className="space-y-1.5 flex-1">
                  <div className="text-xs font-bold text-white truncate">
                    {editTeacherForm.fullName || editingTeacher.fullName}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 text-[11px] font-bold cursor-pointer">
                      <Camera size={13} />
                      <span>{tr("Rasm yuklash / o'zgartirish", 'Загрузить / изменить фото')}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          if (!file) return;
                          if (file.size > 5 * 1024 * 1024) {
                            showToast(tr('Rasm hajmi 5MB dan oshmasligi kerak!', 'Размер фото не должен превышать 5 МБ!'), 'warning');
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = (ev) =>
                            setEditTeacherForm((prev) => ({
                              ...prev,
                              avatarFile: file,
                              avatarPreview: ev.target.result,
                              clearAvatar: false,
                            }));
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                    {(editTeacherForm.hasCustomAvatar || editTeacherForm.avatarFile) && !editTeacherForm.clearAvatar && (
                      <button
                        type="button"
                        onClick={() => {
                          const seed = (editTeacherForm.fullName || editTeacherForm.username || 'U').slice(0, 2).toUpperCase();
                          setEditTeacherForm((prev) => ({
                            ...prev,
                            avatarFile: null,
                            clearAvatar: true,
                            avatarPreview: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed)}&backgroundColor=0284c7`,
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
                <label className="input-label">{tr("F.I.SH (To'liq ism) *", 'Ф.И.О. (Полное имя) *')}</label>
                <input
                  type="text"
                  className="clean-input"
                  value={editTeacherForm.fullName}
                  onChange={(e) => setEditTeacherForm({ ...editTeacherForm, fullName: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">{tr('Login (username) *', 'Логин (username) *')}</label>
                  <input
                    type="text"
                    className="clean-input font-mono"
                    value={editTeacherForm.username}
                    onChange={(e) => setEditTeacherForm({ ...editTeacherForm, username: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="input-label flex items-center justify-between">
                    <span>{tr('Yangi parol', 'Новый пароль')}</span>
                    <button
                      type="button"
                      onClick={() => setShowEditTeacherPw(!showEditTeacherPw)}
                      className="text-[10px] text-cyan-400"
                    >
                      {showEditTeacherPw ? tr('Yashirish', 'Скрыть') : tr("Ko'rsatish", 'Показать')}
                    </button>
                  </label>
                  <input
                    type={showEditTeacherPw ? 'text' : 'password'}
                    className="clean-input"
                    placeholder={tr("O'zgartirmaslik uchun bo'sh qoldiring", 'Оставьте пустым, чтобы не менять')}
                    value={editTeacherForm.password}
                    onChange={(e) => setEditTeacherForm({ ...editTeacherForm, password: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">{tr("O'qitadigan Fani *", 'Преподаваемый предмет *')}</label>
                  <select
                    className="clean-select"
                    value={editTeacherForm.subject}
                    onChange={(e) => setEditTeacherForm({ ...editTeacherForm, subject: e.target.value })}
                  >
                    {(subjectsList.includes(editTeacherForm.subject)
                      ? subjectsList
                      : [editTeacherForm.subject, ...subjectsList].filter(Boolean)
                    ).map((s) => (
                      <option key={s} value={s}>
                        {localizeSubject(s, language)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="input-label">{tr('Telefon raqam', 'Номер телефона')}</label>
                  <input
                    type="text"
                    className="clean-input"
                    placeholder="+998 90 123 45 67"
                    value={editTeacherForm.phone}
                    onChange={(e) => setEditTeacherForm({ ...editTeacherForm, phone: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="input-label">{tr("Qisqacha bio / ma'lumot", 'Краткая информация / био')}</label>
                <textarea
                  rows={2}
                  className="clean-input text-xs"
                  placeholder={tr("Tajribasi va yo'nalishi haqida...", 'Об опыте и специализации...')}
                  value={editTeacherForm.bio}
                  onChange={(e) => setEditTeacherForm({ ...editTeacherForm, bio: e.target.value })}
                />
              </div>

              <div className="modal-footer flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setEditingTeacher(null)}
                >
                  {tr('Bekor qilish', 'Отмена')}
                </button>
                <button
                  type="submit"
                  disabled={savingEditTeacher}
                  className="btn btn-diamond-cyan btn-sm font-bold flex items-center gap-1.5"
                >
                  {savingEditTeacher ? (
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

      {/* MODAL: ADD STUDENT */}
      {isAddStudentOpen && (
        <div className="modal-backdrop" onClick={() => setIsAddStudentOpen(false)}>
          <div className="modal-content animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title flex items-center gap-2">
                <GraduationCap className="text-sky-400" size={20} /> {tr("Yangi O'quvchi Qo'shish", 'Добавить нового ученика')}
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
              <div>
                <label className="input-label">{tr("O'quvchi F.I.SH *", 'Ф.И.О. ученика *')}</label>
                <input
                  type="text"
                  className="clean-input"
                  placeholder={tr('Jasur Rustamov', 'Жасур Рустамов')}
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
                    className="clean-input"
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
                  >
                    {availableGrades.map((g) => (
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
                <button type="submit" className="btn btn-diamond-cyan btn-sm font-bold">
                  {tr("Qo'shish", 'Добавить')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD CLASS */}
      {isAddClassOpen && (
        <div className="modal-backdrop" onClick={() => setIsAddClassOpen(false)}>
          <div className="modal-content animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title flex items-center gap-2">
                <School className="text-cyan-400" size={20} /> {tr('Yangi Sinf Ochish', 'Создать новый класс')}
              </h3>
              <button type="button" className="modal-close-btn" onClick={() => setIsAddClassOpen(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateClass} className="modal-body space-y-3.5 pt-3">
              <div>
                <label className="input-label">{tr('Sinf Nomi (Masalan: 9-C yoki 10-RU) *', 'Название класса (например: 9-C или 10-RU) *')}</label>
                <input
                  type="text"
                  className="clean-input"
                  placeholder="9-C"
                  value={classForm.name}
                  onChange={(e) => setClassForm({ ...classForm, name: e.target.value.toUpperCase() })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="input-label">{tr('Sinf Bosqichi (Parallel) *', 'Ступень (Параллель) *')}</label>
                  <input
                    type="number"
                    min={1}
                    max={11}
                    className="clean-input"
                    value={classForm.gradeLevel}
                    onChange={(e) => setClassForm({ ...classForm, gradeLevel: Number(e.target.value) })}
                    required
                  />
                </div>
                <div>
                  <label className="input-label">{tr("Ta'lim Tili *", 'Язык обучения *')}</label>
                  <select
                    className="clean-select"
                    value={classForm.language}
                    onChange={(e) => setClassForm({ ...classForm, language: e.target.value })}
                  >
                    <option value="uz">{tr("O'zbek tili", 'Узбекский язык')}</option>
                    <option value="ru">{tr('Rus tili', 'Русский язык')}</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsAddClassOpen(false)}
                >
                  {tr('Bekor qilish', 'Отмена')}
                </button>
                <button type="submit" className="btn btn-diamond-cyan btn-sm font-bold">
                  {tr('Sinfni Saqlash', 'Сохранить класс')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: BATCH CLASS REWARD */}
      {isBatchClassRewardOpen && (() => {
        const selectedCls = classesList.find((c) => c.name === batchClassForm.className) || classesList[0] || null;
        const activeCount = selectedCls?.activeStudentsCount ?? 0;
        const totalStCount = selectedCls?.studentsCount ?? selectedCls?.students_count ?? 0;
        const scopeVal = batchClassForm.awardScope || 'class_only';
        const scopeOptions = [
          {
            id: 'class_only',
            title: tr("🏫 Faqat faol sinfning o'ziga (Sinf fondiga)", '🏫 Только самому активному классу (в фонд класса)'),
            desc: tr("Sinf reytingi va fondiga qo'shiladi (o'quvchilar bo'lmasa ham ishlaydi)", 'Добавляется в рейтинг и фонд класса (работает даже без учеников)'),
          },
          {
            id: 'class_and_active',
            title: tr("⚡ Sinf fondi + Faol o'quvchilarga", '⚡ Фонд класса + активным ученикам'),
            desc: tr(
              `Sinf fondiga ham, test yechgan ${activeCount} nafar faol o'quvchiga ham`,
              `И в фонд класса, и ${activeCount} активным ученикам, решавшим тесты`
            ),
          },
          {
            id: 'both',
            title: tr("🎁 Sinf fondi + Barcha o'quvchilarga", '🎁 Фонд класса + всем ученикам'),
            desc: tr(
              `Sinf fondiga ham, sinfdagi barcha ${totalStCount} o'quvchiga ham`,
              `И в фонд класса, и всем ${totalStCount} ученикам класса`
            ),
          },
          {
            id: 'active_students',
            title: tr("🏆 Faqat sinfdagi faol o'quvchilarga", '🏆 Только активным ученикам класса'),
            desc: tr(
              `Kamida 1 ta test topshirgan ${activeCount} nafar o'quvchiga`,
              `${activeCount} ученикам, сдавшим хотя бы 1 тест`
            ),
          },
          {
            id: 'all_students',
            title: tr("👥 Sinfdagi barcha o'quvchilarga", '👥 Всем ученикам класса'),
            desc: tr(
              `Test yechgan-yechmagan barcha ${totalStCount} o'quvchiga`,
              `Всем ${totalStCount} ученикам класса (независимо от тестов)`
            ),
          },
        ];
        const classPresets = ADMIN_CLASS_COIN_PRESETS_BY_LANG[language === 'ru' ? 'ru' : 'uz'] || ADMIN_CLASS_COIN_PRESETS_BY_LANG.uz;

        return (
          <div className="modal-backdrop" onClick={() => setIsBatchClassRewardOpen(false)}>
            <div
              className="modal-content animate-scale-in"
              style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3 className="modal-title flex items-center gap-2 text-cyan-300">
                  <School className="text-cyan-400" size={22} /> {tr("Faol Sinf va O'quvchilariga Coin Berish", 'Начислить койны активному классу и ученикам')}
                </h3>
                <button
                  type="button"
                  className="modal-close-btn"
                  onClick={() => setIsBatchClassRewardOpen(false)}
                >
                  &times;
                </button>
              </div>
              <form onSubmit={handleBatchClassAward} className="modal-body space-y-4 pt-3">
                <div>
                  <label className="input-label">{tr('Taqdirlanadigan Sinfni Tanlang *', 'Выберите награждаемый класс *')}</label>
                  <select
                    className="clean-select"
                    value={batchClassForm.className}
                    onChange={(e) => setBatchClassForm({ ...batchClassForm, className: e.target.value })}
                    required
                  >
                    {classesList.length === 0 && (
                      <option value="">{tr('Sinflar topilmadi', 'Классы не найдены')}</option>
                    )}
                    {classesList.map((c) => (
                      <option key={c.name} value={c.name}>
                        {localizeGrade(c.name, language)} ({c.studentsCount || c.students_count || 0} {tr('nafar', 'уч.')} • {c.activeStudentsCount ?? 0} {tr('faol', 'акт.')} • {tr('Fond:', 'Фонд:')} {c.classBonusCoins ?? 0} 💎)
                      </option>
                    ))}
                  </select>

                  {selectedCls && (
                    <div className="grid grid-cols-4 gap-2 mt-2 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-center">
                      <div>
                        <div className="text-xs font-black text-cyan-300">{totalStCount} {tr('nafar', 'уч.')}</div>
                        <div className="text-[10px] text-slate-400">{tr("Jami o'quvchi", 'Всего уч.')}</div>
                      </div>
                      <div>
                        <div className="text-xs font-black text-emerald-400">{activeCount} {tr('nafar', 'уч.')}</div>
                        <div className="text-[10px] text-slate-400">{tr('Faol qatnashchi', 'Активных')}</div>
                      </div>
                      <div>
                        <div className="text-xs font-black text-purple-300">{selectedCls.classBonusCoins ?? 0} 💎</div>
                        <div className="text-[10px] text-slate-400">{tr('Sinf fondi', 'Фонд класса')}</div>
                      </div>
                      <div>
                        <div className="text-xs font-black text-amber-400">{selectedCls.studentCoins ?? 0} 💎</div>
                        <div className="text-[10px] text-slate-400">{tr("O'quvchilar coini", 'Койны уч.')}</div>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="input-label">{tr('Coin Qayerga Berilsin? *', 'Кому начислить койны? *')}</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {scopeOptions.map((opt) => {
                      const isSel = scopeVal === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setBatchClassForm({ ...batchClassForm, awardScope: opt.id })}
                          className={`text-left p-2.5 rounded-xl border transition-all ${
                            isSel
                              ? 'bg-cyan-500/15 border-cyan-400 text-white shadow-sm'
                              : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-600'
                          }`}
                        >
                          <div className="text-xs font-bold">{opt.title}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5 leading-snug">{opt.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="input-label">{tr('Beriladigan Coin Miqdori *', 'Количество койнов *')}</label>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {[10, 20, 30, 50, 100].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        className={`coin-pill-btn flex-1 text-center ${
                          Number(batchClassForm.amount) === amt ? 'active' : ''
                        }`}
                        onClick={() => setBatchClassForm({ ...batchClassForm, amount: amt })}
                      >
                        +{amt}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    className="clean-input"
                    value={batchClassForm.amount}
                    onChange={(e) => setBatchClassForm({ ...batchClassForm, amount: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="input-label">{tr("Rag'batlantirish Sababi / Maqsadi *", 'Причина / цель поощрения *')}</label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {classPresets.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className={`text-[10px] px-2 py-1 rounded-lg border transition-all ${
                          batchClassForm.reason === preset
                            ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-bold'
                            : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-600'
                        }`}
                        onClick={() => setBatchClassForm({ ...batchClassForm, reason: preset })}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    className="clean-input"
                    value={batchClassForm.reason}
                    onChange={(e) => setBatchClassForm({ ...batchClassForm, reason: e.target.value })}
                    placeholder={tr('Masalan: Faol sinf va namunali jamoaviy ishtirok uchun', 'Например: За активный класс и командное участие')}
                    required
                  />
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300 leading-relaxed">
                  {scopeVal === 'class_only' && (
                    <span>
                      ℹ️ <strong>{tr('Sinf fondiga:', 'В фонд класса:')}</strong>{' '}
                      {tr(
                        `${batchClassForm.className} sinfining o'z hisobiga (fondiga) +${batchClassForm.amount} coin qo'shiladi va sinflar reytingida aks etadi.`,
                        `На собственный счёт (фонд) класса ${localizeGrade(batchClassForm.className, language)} будет добавлено +${batchClassForm.amount} койн., что отразится в рейтинге классов.`
                      )}
                    </span>
                  )}
                  {scopeVal === 'class_and_active' && (
                    <span>
                      ℹ️ <strong>{tr("Sinf + Faol o'quvchilar:", 'Класс + активные ученики:')}</strong>{' '}
                      {tr(
                        `${batchClassForm.className} sinf fondiga +${batchClassForm.amount} coin hamda test yechgan ${activeCount} nafar faol o'quvchiga +${batchClassForm.amount} coindan beriladi.`,
                        `В фонд класса ${localizeGrade(batchClassForm.className, language)} и каждому из ${activeCount} активных учеников будет начислено по +${batchClassForm.amount} койн.`
                      )}
                    </span>
                  )}
                  {scopeVal === 'both' && (
                    <span>
                      ℹ️ <strong>{tr("Sinf + Barcha o'quvchilar:", 'Класс + все ученики:')}</strong>{' '}
                      {tr(
                        `${batchClassForm.className} sinf fondiga ham, barcha ${totalStCount} nafar o'quvchiga ham +${batchClassForm.amount} coindan qo'shiladi.`,
                        `И в фонд класса ${localizeGrade(batchClassForm.className, language)}, и всем ${totalStCount} ученикам будет начислено по +${batchClassForm.amount} койн.`
                      )}
                    </span>
                  )}
                  {scopeVal === 'active_students' && (
                    <span>
                      ℹ️ <strong>{tr("Faol o'quvchilar:", 'Активные ученики:')}</strong>{' '}
                      {tr(
                        `${batchClassForm.className} sinfidagi test yechgan ${activeCount} nafar faol o'quvchiga +${batchClassForm.amount} coindan beriladi.`,
                        `${activeCount} активным ученикам класса ${localizeGrade(batchClassForm.className, language)} будет начислено по +${batchClassForm.amount} койн.`
                      )}
                    </span>
                  )}
                  {scopeVal === 'all_students' && (
                    <span>
                      ℹ️ <strong>{tr("Barcha o'quvchilar:", 'Все ученики:')}</strong>{' '}
                      {tr(
                        `${batchClassForm.className} sinfidagi barcha ${totalStCount} nafar o'quvchiga +${batchClassForm.amount} coindan beriladi.`,
                        `Всем ${totalStCount} ученикам класса ${localizeGrade(batchClassForm.className, language)} будет начислено по +${batchClassForm.amount} койн.`
                      )}
                    </span>
                  )}
                  {scopeVal === 'active_students' && activeCount === 0 && (
                    <div className="text-amber-300 mt-1 font-semibold">
                      ⚠️ {tr(
                        'Bu sinfda hozircha test topshirgan faol o\'quvchi yo\'q — "Faqat faol sinfning o\'ziga" rejimini tanlashingiz mumkin.',
                        'В этом классе пока нет активных учеников, сдавших тесты — вы можете выбрать режим «Только самому активному классу».'
                      )}
                    </div>
                  )}
                </div>

                <div className="modal-footer flex justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setIsBatchClassRewardOpen(false)}
                  >
                    {tr('Bekor qilish', 'Отмена')}
                  </button>
                  <button type="submit" className="btn btn-diamond-cyan btn-sm font-bold flex items-center gap-1.5">
                    <Coins size={15} /> {tr('Coinlarni Taqsimlash', 'Распределить койны')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* MODAL: AWARD COINS (MULTI-SELECT ACTIVE STUDENTS) */}
      {isAwardCoinsOpen && (() => {
        const studentPresets = ADMIN_STUDENT_COIN_PRESETS_BY_LANG[language === 'ru' ? 'ru' : 'uz'] || ADMIN_STUDENT_COIN_PRESETS_BY_LANG.uz;
        return (
        <div className="modal-backdrop" onClick={() => setIsAwardCoinsOpen(false)}>
          <div
            className="modal-content animate-scale-in"
            style={{ maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 className="modal-title flex items-center gap-2">
                <Coins className="text-amber-400" size={20} /> {tr("Faol O'quvchilarga Diamond Coin Berish", 'Начислить Diamond Coin активным ученикам')}
              </h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsAwardCoinsOpen(false)}
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleAwardCoins} className="modal-body space-y-3.5 pt-3">
              {/* Filter bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="input-with-icon sm:col-span-2">
                  <Search size={15} className="input-icon" />
                  <input
                    type="text"
                    className="clean-input text-xs"
                    placeholder={tr("O'quvchi ismi, login yoki sinf...", 'Имя ученика, логин или класс...')}
                    value={awardStudentSearch}
                    onChange={(e) => setAwardStudentSearch(e.target.value)}
                  />
                </div>
                <select
                  className="clean-select text-xs"
                  value={awardStudentGradeFilter}
                  onChange={(e) => setAwardStudentGradeFilter(e.target.value)}
                >
                  <option value="all">{tr('Barcha sinflar', 'Все классы')}</option>
                  {availableGrades.map((g) => (
                    <option key={g} value={g}>{localizeGrade(g, language)} {tr('sinf', 'класс')}</option>
                  ))}
                </select>
              </div>

              {/* Active toggle & Quick Top N Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setAwardOnlyActive(!awardOnlyActive)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 ${
                    awardOnlyActive
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/45'
                      : 'bg-slate-900 text-slate-300 border-slate-700'
                  }`}
                >
                  <Zap size={12} /> {tr('Faqat faol qatnashganlar', 'Только активные участники')} ({awardOnlyActive ? tr('Yoqilgan', 'Вкл.') : tr("O'chirilgan", 'Выкл.')})
                </button>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    className="row-quick-coin-btn text-[11px]"
                    onClick={() => handleSelectTopActiveForAward(3)}
                  >
                    ⚡ {tr('Top 3', 'Топ 3')}
                  </button>
                  <button
                    type="button"
                    className="row-quick-coin-btn text-[11px]"
                    onClick={() => handleSelectTopActiveForAward(5)}
                  >
                    ⚡ {tr('Top 5', 'Топ 5')}
                  </button>
                  <div className="flex items-center gap-1 bg-slate-900 px-1.5 py-0.5 rounded-lg border border-slate-700">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      className="w-10 bg-transparent text-white text-xs font-bold text-center outline-none"
                      value={awardTopNCount}
                      onChange={(e) => setAwardTopNCount(Number(e.target.value))}
                    />
                    <button
                      type="button"
                      className="text-[10px] font-bold text-cyan-300 hover:text-cyan-200 px-1"
                      onClick={() => handleSelectTopActiveForAward(awardTopNCount)}
                    >
                      {tr('Top N', 'Топ N')}
                    </button>
                  </div>
                  <button
                    type="button"
                    className="text-[10px] px-2 py-1 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 font-bold"
                    onClick={() => setSelectedAwardStudentIds(awardCandidateStudents.map((s) => s.id))}
                  >
                    {tr('Hammasini', 'Выбрать всех')}
                  </button>
                  {selectedAwardStudentIds.length > 0 && (
                    <button
                      type="button"
                      className="text-[10px] px-2 py-1 rounded-lg bg-rose-500/15 text-rose-300 border border-rose-500/30 font-bold"
                      onClick={() => setSelectedAwardStudentIds([])}
                    >
                      {tr('Tozalash', 'Очистить')}
                    </button>
                  )}
                </div>
              </div>

              {/* Students Multi-select Checklist */}
              <div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                  <span>
                    {tr("Ro'yxatdagi nomzodlar:", 'Кандидаты в списке:')} <strong className="text-white">{awardCandidateStudents.length}</strong> {tr('nafar', 'уч.')}
                  </span>
                  <span>
                    {tr('Tanlangan:', 'Выбрано:')} <strong className="text-amber-300">{selectedAwardStudentIds.length}</strong> {tr('nafar', 'уч.')}
                  </span>
                </div>

                <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                  {awardCandidateStudents.map((s) => {
                    const checked = selectedAwardStudentIds.includes(s.id);
                    const isActiveSt = (Number(s.testsPassed) || 0) > 0;
                    return (
                      <div
                        key={s.id}
                        onClick={() => handleToggleAwardStudent(s.id)}
                        className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                          checked
                            ? 'bg-amber-500/15 border-amber-400/60'
                            : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {}}
                            className="w-4 h-4 accent-amber-400 cursor-pointer flex-shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold text-white truncate">
                                {s.fullName || s.username}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-bold">
                                {s.grade ? localizeGrade(s.grade, language) : '-'}
                              </span>
                              {isActiveSt && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
                                  ⚡ {tr('Faol', 'Активный')}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {s.testsPassed || 0} {tr('ta test', 'тест.')} • {tr("O'rtacha:", 'Средний:')} <strong className="text-emerald-400">{s.avgScore || 0}%</strong>
                            </div>
                          </div>
                        </div>

                        <div className="text-xs font-black text-amber-300 font-mono flex items-center gap-1 flex-shrink-0 pl-2">
                          <Coins size={12} /> {s.coins || 0}
                        </div>
                      </div>
                    );
                  })}

                  {awardCandidateStudents.length === 0 && (
                    <div className="text-center py-6 px-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 space-y-2">
                      <div>{tr("Filtr bo'yicha mos o'quvchilar topilmadi.", 'Подходящие ученики по фильтру не найдены.')}</div>
                      {awardOnlyActive && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-xs text-cyan-300"
                          onClick={() => setAwardOnlyActive(false)}
                        >
                          {tr("Barcha o'quvchilarni ko'rsatish", 'Показать всех учеников')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="input-label">{tr('Har biriga beriladigan Coin Miqdori *', 'Количество койнов для каждого *')}</label>
                <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                  {[5, 10, 15, 20, 50, 100].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      className={`coin-pill-btn flex-1 text-center ${
                        Number(awardCoinsForm.amount) === amt ? 'active' : ''
                      }`}
                      onClick={() => setAwardCoinsForm({ ...awardCoinsForm, amount: amt })}
                    >
                      +{amt}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min={1}
                  max={500}
                  className="clean-input"
                  value={awardCoinsForm.amount}
                  onChange={(e) => setAwardCoinsForm({ ...awardCoinsForm, amount: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="input-label">{tr('Sabab / Izoh *', 'Причина / Комментарий *')}</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {studentPresets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className={`text-[10px] px-2 py-1 rounded-lg border transition-all ${
                        awardCoinsForm.reason === preset
                          ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-bold'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-600'
                      }`}
                      onClick={() => setAwardCoinsForm({ ...awardCoinsForm, reason: preset })}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  className="clean-input"
                  value={awardCoinsForm.reason}
                  onChange={(e) => setAwardCoinsForm({ ...awardCoinsForm, reason: e.target.value })}
                  required
                />
              </div>

              <div className="modal-footer flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsAwardCoinsOpen(false)}
                >
                  {tr('Bekor qilish', 'Отмена')}
                </button>
                <button
                  type="submit"
                  disabled={selectedAwardStudentIds.length === 0 && !awardCoinsForm.studentId}
                  className="btn btn-warning btn-sm font-bold flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Coins size={14} />{' '}
                  {selectedAwardStudentIds.length > 0
                    ? tr(
                        `${selectedAwardStudentIds.length} nafariga +${awardCoinsForm.amount} Coin Berish`,
                        `Начислить +${awardCoinsForm.amount} койн. (${selectedAwardStudentIds.length} уч.)`
                      )
                    : tr("O'quvchilarni tanlang", 'Выберите учеников')}
                </button>
              </div>
            </form>
          </div>
        </div>
        );
      })()}

      {/* MODAL: VIEW CLASS STUDENTS & QUICK REWARDS */}
      {liveViewingClassInfo && (
        <div className="modal-backdrop" onClick={() => setViewingClassStudents(null)}>
          <div
            className="modal-content animate-scale-in"
            style={{ maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 className="modal-title flex items-center gap-2 text-cyan-300">
                <Users className="text-cyan-400" size={20} />{' '}
                {tr(
                  `${liveViewingClassInfo.name} Sinfi O'quvchilari va Faolligi`,
                  `Ученики и активность класса ${localizeGrade(liveViewingClassInfo.name, language)}`
                )}
              </h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setViewingClassStudents(null)}
              >
                &times;
              </button>
            </div>

            <div className="modal-body space-y-4 pt-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-center">
                <div>
                  <div className="text-sm font-black text-cyan-400">{viewingClassRoster.length} {tr('nafar', 'уч.')}</div>
                  <div className="text-[10px] text-slate-400">{tr("Jami o'quvchi", 'Всего учеников')}</div>
                </div>
                <div>
                  <div className="text-sm font-black text-emerald-400">
                    {liveViewingClassInfo.activeStudentsCount ??
                      viewingClassRoster.filter((s) => (Number(s.testsPassed) || 0) > 0).length}{' '}
                    {tr('nafar', 'уч.')}
                  </div>
                  <div className="text-[10px] text-slate-400">{tr('Faol qatnashchi', 'Активных')}</div>
                </div>
                <div>
                  <div className="text-sm font-black text-purple-300">
                    {liveViewingClassInfo.classBonusCoins ?? 0} 💎
                  </div>
                  <div className="text-[10px] text-slate-400">{tr('Sinf fondi', 'Фонд класса')}</div>
                </div>
                <div>
                  <div className="text-sm font-black text-amber-400">
                    {liveViewingClassInfo.totalCoins ?? 0} 💎
                  </div>
                  <div className="text-[10px] text-slate-400">{tr('Umumiy coin', 'Всего койнов')}</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="btn btn-diamond-cyan btn-xs font-bold flex items-center gap-1.5"
                  onClick={() => {
                    const clsName = liveViewingClassInfo.name;
                    setViewingClassStudents(null);
                    setBatchClassForm((prev) => ({
                      ...prev,
                      className: clsName,
                      awardScope: 'class_only',
                    }));
                    setIsBatchClassRewardOpen(true);
                  }}
                >
                  <School size={13} /> {tr('Sinf Fondiga / Sinfga Coin Berish', 'Начислить койны фонду / классу')}
                </button>
                <button
                  type="button"
                  className="btn btn-warning btn-xs font-bold text-slate-950 flex items-center gap-1.5"
                  onClick={() => {
                    const clsName = liveViewingClassInfo.name;
                    setViewingClassStudents(null);
                    handleOpenAwardCoinsModal({ grade: clsName, onlyActive: true });
                  }}
                >
                  <Zap size={13} /> {tr("Faol O'quvchilarni Tanlab Taqdirlash", 'Выбрать и наградить активных')}
                </button>
              </div>

              <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                {viewingClassRoster.map((st, idx) => (
                  <div
                    key={st.id}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-cyan-500/35"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-slate-800 text-amber-300 font-black text-[11px] flex items-center justify-center flex-shrink-0">
                        #{idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-white truncate">
                            {st.fullName || st.username}
                          </span>
                          {(Number(st.testsPassed) || 0) > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
                              ⚡ {tr('Faol', 'Активный')}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {st.testsPassed || 0} {tr('ta test', 'тест.')} • {tr("O'rtacha:", 'Средний:')} <strong className="text-emerald-400">{st.avgScore || 0}%</strong>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-xs font-black text-amber-300 font-mono mr-1">
                        {st.coins || 0} 💎
                      </span>
                      <button
                        type="button"
                        className="row-quick-coin-btn text-[10px]"
                        onClick={() =>
                          handleQuickStudentAward(
                            st.id,
                            5,
                            tr(`${liveViewingClassInfo.name} sinf faolligi uchun`, `За активность в классе ${localizeGrade(liveViewingClassInfo.name, language)}`)
                          )
                        }
                      >
                        +5
                      </button>
                      <button
                        type="button"
                        className="row-quick-coin-btn text-[10px]"
                        onClick={() =>
                          handleQuickStudentAward(
                            st.id,
                            10,
                            tr(`${liveViewingClassInfo.name} sinf faolligi uchun`, `За активность в классе ${localizeGrade(liveViewingClassInfo.name, language)}`)
                          )
                        }
                      >
                        +10
                      </button>
                    </div>
                  </div>
                ))}

                {viewingClassRoster.length === 0 && (
                  <div className="text-center py-8 text-xs text-slate-400 bg-slate-950/60 rounded-xl border border-slate-800">
                    {tr(
                      'Ushbu sinfda hozircha o\'quvchilar biriktirilmagan. Yuqoridagi "Sinf Fondiga / Sinfga Coin Berish" tugmasi orqali sinfning o\'ziga coin berishingiz mumkin.',
                      'В этом классе пока нет закреплённых учеников. Вы можете начислить койны самому классу через кнопку «Начислить койны фонду / классу» выше.'
                    )}
                  </div>
                )}
              </div>

              <div className="modal-footer flex justify-end pt-3 border-t border-slate-800">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setViewingClassStudents(null)}
                >
                  {tr('Yopish', 'Закрыть')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN DETAILED SUBMISSION BREAKDOWN & COIN MODAL */}
      {viewingAdminSubmission && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-base">
                  {(viewingAdminSubmission.student_name || viewingAdminSubmission.fullName || 'O')[0]}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>{viewingAdminSubmission.student_name || viewingAdminSubmission.fullName}</span>
                    <span className="badge badge-info text-[11px]">{localizeGrade(viewingAdminSubmission.grade, language)}</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    &ldquo;{selectedAdminTestForResults?.title || adminTestResultsMeta?.title || tr('Test', 'Тест')}&rdquo; {tr("topshirig'i tahlili", '— разбор попытки')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="text-slate-400 hover:text-white p-1 rounded-lg"
                onClick={() => setViewingAdminSubmission(null)}
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="p-4 bg-slate-950/40 border-b border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
              <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="text-base font-black text-emerald-400">
                  {viewingAdminSubmission.score ?? viewingAdminSubmission.score_percentage ?? 0}%
                </div>
                <div className="text-[10px] text-slate-400">{tr('Umumiy Natija', 'Общий результат')}</div>
              </div>
              <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="text-base font-black text-cyan-400">
                  {viewingAdminSubmission.correctAnswers ?? viewingAdminSubmission.correctCount ?? 0} / {viewingAdminSubmission.totalQuestions ?? viewingAdminSubmission.totalCount ?? 10}
                </div>
                <div className="text-[10px] text-slate-400">{tr("To'g'ri Javoblar", 'Правильные ответы')}</div>
              </div>
              <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="text-base font-black text-sky-400">
                  {adminSubmissionDetail?.timeSpentDisplay || viewingAdminSubmission.timeStr || viewingAdminSubmission.time_spent_display || tr('12 daq', '12 мин')}
                </div>
                <div className="text-[10px] text-slate-400">{tr('Sarflangan Vaqt', 'Затраченное время')}</div>
              </div>
              <div className="p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="text-base font-black text-amber-400">
                  {adminSubmissionDetail?.coinsAwarded ?? viewingAdminSubmission.alreadyAwardedCoins ?? 0} 💎
                </div>
                <div className="text-[10px] text-slate-400">{tr('Berilgan Coinlar', 'Начислено койнов')}</div>
              </div>
            </div>

            <form onSubmit={handleAdminAwardFromModal} className="p-3.5 bg-amber-500/5 border-b border-amber-500/20 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-amber-400 flex-shrink-0" />
                  <span className="text-xs font-bold text-amber-200">{tr("Ushbu o'quvchiga qo'shimcha Coin berish:", 'Начислить дополнительные койны этому ученику:')}</span>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                  <div className="flex items-center gap-1">
                    {[10, 20, 50].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        className={`row-quick-coin-btn ${adminModalCoinAmount === amt ? 'bg-amber-500/40 border-amber-400' : ''}`}
                        onClick={() => setAdminModalCoinAmount(amt)}
                      >
                        +{amt}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    className="clean-input text-xs w-20 h-8 min-h-0 font-bold text-amber-300"
                    value={adminModalCoinAmount}
                    onChange={(e) => setAdminModalCoinAmount(Number(e.target.value))}
                  />
                  <button
                    type="submit"
                    className="btn btn-warning btn-xs font-bold text-slate-950 flex items-center gap-1 h-8 px-3"
                  >
                    <Coins size={13} />
                    <span>{tr('Berish', 'Начислить')}</span>
                  </button>
                </div>
              </div>
              <input
                type="text"
                className="clean-input text-xs h-8 min-h-0"
                placeholder={tr('Mukofot sababi / izoh...', 'Причина награды / комментарий...')}
                value={adminModalCoinReason}
                onChange={(e) => setAdminModalCoinReason(e.target.value)}
              />
            </form>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 flex-1">
              {adminSubmissionModalLoading ? (
                <div className="text-center py-10 text-slate-400 text-xs flex items-center justify-center gap-2">
                  <Loader2 size={18} className="animate-spin text-cyan-400" /> {tr('Savollar yuklanmoqda...', 'Загрузка вопросов...')}
                </div>
              ) : adminSubmissionDetail?.breakdown && adminSubmissionDetail.breakdown.length > 0 ? (
                adminSubmissionDetail.breakdown.map((item, qIdx) => (
                  <div
                    key={qIdx}
                    className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                      item.isCorrect ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-rose-950/20 border-rose-500/30'
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
                      <img src={item.imageUrl} alt="" className="max-h-36 rounded-lg border border-slate-700" />
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
                      <div className={`p-2 rounded-lg border ${item.isCorrect ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300' : 'bg-rose-500/10 border-rose-500/40 text-rose-300'}`}>
                        <span className="block font-bold text-[10px] opacity-75">{tr("O'quvchi javobi:", 'Ответ ученика:')}</span>
                        <span>{item.selectedText && item.selectedText !== 'Tanlanmagan' ? item.selectedText : tr('Tanlanmagan', 'Не выбран')}</span>
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

            <div className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end">
              <button
                type="button"
                className="btn btn-secondary btn-sm text-xs"
                onClick={() => setViewingAdminSubmission(null)}
              >
                {tr('Yopish', 'Закрыть')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PER-TEST PERMISSION & SCHEDULE */}
      {permissionScheduleModal && (
        <div
          className="modal-backdrop"
          onClick={() => !savingPermissionModal && setPermissionScheduleModal(null)}
        >
          <div
            className="modal-content animate-scale-in"
            style={{ maxWidth: '520px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 className="modal-title flex items-center gap-2 text-cyan-300">
                <Clock className="text-cyan-400" size={19} />
                <span className="truncate">{tr('Test Ruxsati va Vaqtini Sozlash', 'Настройка доступа и времени теста')}</span>
              </h3>
              <button
                type="button"
                className="modal-close-btn"
                disabled={savingPermissionModal}
                onClick={() => setPermissionScheduleModal(null)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={(e) => handleSaveTestPermissionSchedule(e, false)} className="modal-body space-y-4 pt-3">
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <div className="text-[11px] text-slate-400">{tr('Tanlangan test:', 'Выбранный тест:')}</div>
                <div className="text-sm font-bold text-white mt-0.5">{permissionScheduleModal.title}</div>
              </div>

              <div
                className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  permissionScheduleModal.isStudentAllowed
                    ? 'bg-emerald-500/10 border-emerald-500/35'
                    : 'bg-rose-500/10 border-rose-500/35'
                }`}
              >
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    {permissionScheduleModal.isStudentAllowed ? (
                      <>
                        <Unlock size={14} className="text-emerald-400" />
                        <span>{tr("O'quvchilarga ruxsat berilgan", 'Ученикам разрешено')}</span>
                      </>
                    ) : (
                      <>
                        <Lock size={14} className="text-rose-400" />
                        <span>{tr("O'quvchilar uchun yopiq (ruxsatsiz)", 'Закрыто для учеников (без доступа)')}</span>
                      </>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    {tr(
                      "Faqat ruxsat yoqilganda va belgilangan vaqt oralig'ida o'quvchi testni ishlay oladi.",
                      'Ученик сможет пройти тест только при включённом доступе и в указанный интервал времени.'
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="modal-toggle-test-permission"
                  onClick={() =>
                    setPermissionScheduleModal((prev) =>
                      prev ? { ...prev, isStudentAllowed: !prev.isStudentAllowed } : prev
                    )
                  }
                  className={`btn btn-sm font-bold flex-shrink-0 ${
                    permissionScheduleModal.isStudentAllowed
                      ? 'bg-rose-500/20 text-rose-200 border border-rose-500/40'
                      : 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40'
                  }`}
                >
                  {permissionScheduleModal.isStudentAllowed ? tr('Yopish', 'Закрыть') : tr('Ruxsat berish', 'Разрешить')}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    {tr('Boshlanish vaqti (ixtiyoriy)', 'Время начала (необязательно)')}
                  </label>
                  <input
                    type="datetime-local"
                    data-testid="modal-test-start-input"
                    className="clean-input text-xs"
                    value={permissionScheduleModal.startTimeIso}
                    onChange={(e) =>
                      setPermissionScheduleModal((prev) =>
                        prev ? { ...prev, startTimeIso: e.target.value } : prev
                      )
                    }
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    {tr('Tugash vaqti (ixtiyoriy)', 'Время окончания (необязательно)')}
                  </label>
                  <input
                    type="datetime-local"
                    data-testid="modal-test-end-input"
                    className="clean-input text-xs"
                    value={permissionScheduleModal.endTimeIso}
                    onChange={(e) =>
                      setPermissionScheduleModal((prev) =>
                        prev ? { ...prev, endTimeIso: e.target.value } : prev
                      )
                    }
                  />
                </div>
              </div>

              <div className="modal-footer flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  disabled={savingPermissionModal}
                  onClick={(e) => handleSaveTestPermissionSchedule(e, true)}
                  className="btn btn-secondary btn-xs font-bold"
                >
                  <RefreshCw size={12} /> {tr('Vaqt Cheklovini Tozalash', 'Сбросить ограничение времени')}
                </button>
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    disabled={savingPermissionModal}
                    className="btn btn-secondary btn-sm"
                    onClick={() => setPermissionScheduleModal(null)}
                  >
                    {tr('Bekor qilish', 'Отмена')}
                  </button>
                  <button
                    type="submit"
                    data-testid="modal-save-test-permission"
                    disabled={savingPermissionModal}
                    className="btn btn-diamond-cyan btn-sm font-bold flex items-center gap-1.5"
                  >
                    {savingPermissionModal ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Save size={14} />
                    )}
                    <span>{tr('Saqlash', 'Сохранить')}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
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
