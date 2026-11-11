import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { localizeSubject, localizeUserFullName } from '../i18n/portalUtils';
import MathRenderer from './MathRenderer';
import {
  Edit,
  Download,
  Clock,
  Award,
  Upload,
  FileText,
  Plus,
  Copy,
  Trash2,
  Image as ImageIcon,
  CheckCircle,
  Sparkles,
  Users,
  Save,
  Loader2,
  ArrowLeft,
  Calendar,
  UserCheck,
  Coins,
  Zap,
  Search,
  Lock,
  Unlock,
} from 'lucide-react';

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

const createEmptyQuestion = (idOffset = 0) => ({
  id: Date.now() + idOffset,
  text: '',
  imageUrl: '',
  explanation: '',
  options: [
    { text: '', isCorrect: true },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
  ],
});

export default function AdminTestBuilder({
  editingTestId = null,
  initialTestSummary = null,
  classesList = [],
  teachersList = [],
  studentsList = [],
  subjectsList = [],
  currentUser = null,
  onSaved,
  onCancel,
}) {
  const { language, tr } = useAuth();
  const { showToast } = useToast();

  const normalizedClasses = useMemo(() => {
    const raw = Array.isArray(classesList) ? classesList : [];
    const names = raw
      .map((c) => (typeof c === 'string' ? c : c?.name || ''))
      .filter(Boolean);
    return names.length
      ? names
      : ['5-A', '6-A', '7-A', '8-A', '9-A', '10-A', '11-A'];
  }, [classesList]);

  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rewardSlotsUsed, setRewardSlotsUsed] = useState(0);

  const [immediateReward, setImmediateReward] = useState({
    enabled: false,
    mode: 'auto', // 'auto' | 'manual'
    topCount: 3,
    amount: 15,
    reason: '',
    studentIds: [],
    gradeFilter: 'target', // 'target' | 'all' | className
    onlyActive: true,
    search: '',
  });

  const [testForm, setTestForm] = useState({
    title: '',
    subject: subjectsList[0] || 'Matematika',
    language: 'uz',
    teacherId: currentUser?.id ? String(currentUser.id) : '',
    targetClasses: [normalizedClasses[0] || '9-A'],
    durationMinutes: 30,
    maxAttempts: 1,
    rewardTopCount: 0,
    rewardCoinsAmount: 20,
    rewardMinScore: 60,
    startTime: '',
    endTime: '',
    isStudentAllowed: false,
    questions: [createEmptyQuestion()],
  });

  // Load or reset test form when editingTestId changes
  useEffect(() => {
    let cancelled = false;

    if (!editingTestId) {
      setRewardSlotsUsed(0);
      setImmediateReward({
        enabled: false,
        mode: 'auto',
        topCount: 3,
        amount: 15,
        reason: '',
        studentIds: [],
        gradeFilter: 'target',
        onlyActive: true,
        search: '',
      });
      setTestForm({
        title: '',
        subject: subjectsList[0] || 'Matematika',
        language: 'uz',
        teacherId: currentUser?.id ? String(currentUser.id) : '',
        targetClasses: [normalizedClasses[0] || '9-A'],
        durationMinutes: 30,
        maxAttempts: 1,
        rewardTopCount: 0,
        rewardCoinsAmount: 20,
        rewardMinScore: 60,
        startTime: '',
        endTime: '',
        isStudentAllowed: false,
        questions: [createEmptyQuestion()],
      });
      setLoadingDetail(false);
      return;
    }

    // Populate quick metadata from summary card while fetching full detail
    if (initialTestSummary) {
      const parsedClasses =
        initialTestSummary.grade && initialTestSummary.grade.trim().toLowerCase() !== 'barchasi'
          ? initialTestSummary.grade
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : normalizedClasses;

      setRewardSlotsUsed(Number(initialTestSummary.rewardSlotsUsed || 0));
      setTestForm((prev) => ({
        ...prev,
        title: initialTestSummary.title || '',
        subject: initialTestSummary.subject || subjectsList[0] || 'Matematika',
        language: initialTestSummary.language || 'uz',
        teacherId: initialTestSummary.teacherId
          ? String(initialTestSummary.teacherId)
          : currentUser?.id
          ? String(currentUser.id)
          : '',
        targetClasses: parsedClasses.length ? parsedClasses : [normalizedClasses[0] || '9-A'],
        durationMinutes:
          initialTestSummary.durationMinutes ||
          initialTestSummary.duration_minutes ||
          30,
        maxAttempts: initialTestSummary.maxAttempts || 1,
        rewardTopCount: Number(initialTestSummary.rewardTopCount ?? 0),
        rewardCoinsAmount: Number(initialTestSummary.rewardCoinsAmount ?? 20) || 20,
        rewardMinScore: Number(initialTestSummary.rewardMinScore ?? 60),
        startTime: initialTestSummary.startTimeIso || '',
        endTime: initialTestSummary.endTimeIso || '',
        isStudentAllowed: Boolean(
          initialTestSummary.isStudentAllowed ?? initialTestSummary.is_student_allowed ?? false
        ),
      }));
    }

    async function loadDetail() {
      setLoadingDetail(true);
      try {
        const fullTest = await api.teacher.manageTest(editingTestId, 'GET');
        if (cancelled || !fullTest) return;

        const loadedQuestions = Array.isArray(fullTest.questions)
          ? fullTest.questions.map((q, idx) => ({
              id: q.id || idx + 1,
              text: q.question || q.text || '',
              imageUrl: q.imageUrl || q.image || '',
              explanation: q.explanation || '',
              options: (q.options || []).map((opt, oIdx) => ({
                text: typeof opt === 'object' ? opt.text || '' : String(opt),
                isCorrect:
                  typeof opt === 'object'
                    ? Boolean(opt.isCorrect || opt.is_correct)
                    : oIdx === (q.correctIndex || 0),
              })),
            }))
          : [];

        const parsedClasses =
          fullTest.isAllClasses || (fullTest.grade || '').trim().toLowerCase() === 'barchasi'
            ? normalizedClasses
            : fullTest.grade
            ? fullTest.grade
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : normalizedClasses;

        setRewardSlotsUsed(Number(fullTest.rewardSlotsUsed || 0));
        setTestForm({
          title: fullTest.title || '',
          subject: fullTest.subject || subjectsList[0] || 'Matematika',
          language: fullTest.language || 'uz',
          teacherId: fullTest.teacherId
            ? String(fullTest.teacherId)
            : currentUser?.id
            ? String(currentUser.id)
            : '',
          targetClasses: parsedClasses.length
            ? parsedClasses
            : [normalizedClasses[0] || '9-A'],
          durationMinutes: fullTest.durationMinutes || 30,
          maxAttempts: fullTest.maxAttempts || 1,
          rewardTopCount: Number(fullTest.rewardTopCount ?? 0),
          rewardCoinsAmount: Number(fullTest.rewardCoinsAmount ?? 20) || 20,
          rewardMinScore: Number(fullTest.rewardMinScore ?? 60),
          startTime: fullTest.startTimeIso || '',
          endTime: fullTest.endTimeIso || '',
          isStudentAllowed: Boolean(
            fullTest.isStudentAllowed ?? fullTest.is_student_allowed ?? false
          ),
          questions: loadedQuestions.length
            ? loadedQuestions
            : [createEmptyQuestion()],
        });
      } catch (err) {
        if (!cancelled) {
          showToast(
            err.message ||
              tr("Test tafsilotlarini yuklashda xatolik!", 'Ошибка при загрузке деталей теста!'),
            'error'
          );
        }
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    }

    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [editingTestId]);

  const handleAddQuestion = () => {
    setTestForm((prev) => ({
      ...prev,
      questions: [...prev.questions, createEmptyQuestion(prev.questions.length + 1)],
    }));
  };

  const handleRemoveQuestion = (idx) => {
    if (testForm.questions.length <= 1) {
      showToast(
        tr(
          "Testda kamida bitta savol bo'lishi kerak!",
          'В тесте должен быть хотя бы один вопрос!'
        ),
        'warning'
      );
      return;
    }
    setTestForm((prev) => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== idx),
    }));
  };

  const handleDuplicateQuestion = (idx) => {
    const target = testForm.questions[idx];
    if (!target) return;
    const copy = {
      id: Date.now(),
      text: target.text,
      imageUrl: target.imageUrl || '',
      explanation: target.explanation || '',
      options: target.options.map((o) => ({
        text: typeof o === 'object' ? o.text || '' : String(o),
        isCorrect: typeof o === 'object' ? Boolean(o.isCorrect) : false,
      })),
    };
    setTestForm((prev) => {
      const qs = [...prev.questions];
      qs.splice(idx + 1, 0, copy);
      return { ...prev, questions: qs };
    });
    showToast(tr("Savol nusxalandi!", 'Вопрос скопирован!'), 'info');
  };

  const handleInsertMath = (qIdx, symbol) => {
    setTestForm((prev) => {
      const updated = prev.questions.map((q, idx) =>
        idx === qIdx ? { ...q, text: q.text ? `${q.text} ${symbol}` : symbol } : q
      );
      return { ...prev, questions: updated };
    });
  };

  const handleQuestionTextChange = (idx, text) => {
    setTestForm((prev) => ({
      ...prev,
      questions: prev.questions.map((q, i) => (i === idx ? { ...q, text } : q)),
    }));
  };

  const handleQuestionExplanationChange = (idx, explanation) => {
    setTestForm((prev) => ({
      ...prev,
      questions: prev.questions.map((q, i) => (i === idx ? { ...q, explanation } : q)),
    }));
  };

  const handleOptionTextChange = (qIdx, optIdx, text) => {
    setTestForm((prev) => ({
      ...prev,
      questions: prev.questions.map((q, i) =>
        i === qIdx
          ? {
              ...q,
              options: q.options.map((opt, j) => (j === optIdx ? { ...opt, text } : opt)),
            }
          : q
      ),
    }));
  };

  const handleSetCorrectOption = (qIdx, optIdx) => {
    setTestForm((prev) => ({
      ...prev,
      questions: prev.questions.map((q, i) =>
        i === qIdx
          ? {
              ...q,
              options: q.options.map((opt, j) => ({ ...opt, isCorrect: j === optIdx })),
            }
          : q
      ),
    }));
  };

  const handleUploadQuestionImage = async (qIdx, file) => {
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await api.teacher.uploadQuestionImage(formData);
      if (res?.imageUrl) {
        setTestForm((prev) => ({
          ...prev,
          questions: prev.questions.map((q, i) =>
            i === qIdx ? { ...q, imageUrl: res.imageUrl } : q
          ),
        }));
        showToast(tr('Rasm muvaffaqiyatli yuklandi!', 'Изображение успешно загружено!'), 'success');
      }
    } catch (err) {
      showToast(err.message || tr('Rasm yuklashda xatolik!', 'Ошибка загрузки изображения!'), 'error');
    }
  };

  const handleImportFile = async (file) => {
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.teacher.importQuestions(formData);
      if (res?.questions && res.questions.length > 0) {
        const formattedQuestions = res.questions.map((q, idx) => ({
          id: Date.now() + idx,
          text: q.text || q.question || '',
          imageUrl: q.imageUrl || '',
          explanation: q.explanation || '',
          options: (q.options || []).map((opt, oIdx) => ({
            text: typeof opt === 'object' ? opt.text || '' : String(opt),
            isCorrect:
              typeof opt === 'object'
                ? Boolean(opt.isCorrect || opt.is_correct)
                : oIdx === (q.correctIndex || 0),
          })),
        }));
        setTestForm((prev) => ({
          ...prev,
          questions:
            prev.questions.length === 1 && !prev.questions[0].text.trim()
              ? formattedQuestions
              : [...prev.questions, ...formattedQuestions],
        }));
        showToast(
          tr(
            `${res.questions.length} ta savol muvaffaqiyatli import qilindi!`,
            `Успешно импортировано вопросов: ${res.questions.length}!`
          ),
          'success'
        );
      } else {
        showToast(
          tr(
            'Fayldan savollar topilmadi. Shablonga muvofiqligini tekshiring.',
            'Вопросы в файле не найдены. Проверьте соответствие шаблону.'
          ),
          'warning'
        );
      }
    } catch (err) {
      showToast(
        err.message || tr("Faylni o'qishda xatolik yuz berdi!", 'Ошибка при чтении файла!'),
        'error'
      );
    }
  };

  const normalizedStudents = useMemo(() => {
    const raw = Array.isArray(studentsList) ? studentsList : [];
    return [...raw].sort(
      (a, b) =>
        (Number(b.testsPassed) || 0) - (Number(a.testsPassed) || 0) ||
        (Number(b.coins) || 0) - (Number(a.coins) || 0) ||
        (Number(b.avgScore) || 0) - (Number(a.avgScore) || 0)
    );
  }, [studentsList]);

  const isTargetingAllClasses =
    Array.isArray(testForm.targetClasses) &&
    testForm.targetClasses.length === normalizedClasses.length &&
    normalizedClasses.length > 1;

  const filteredImmediateStudents = useMemo(() => {
    const q = (immediateReward.search || '').trim().toLowerCase();
    return normalizedStudents.filter((s) => {
      if (immediateReward.onlyActive && (Number(s.testsPassed) || 0) <= 0) {
        return false;
      }
      if (immediateReward.gradeFilter === 'target' && !isTargetingAllClasses) {
        if (!testForm.targetClasses.includes(s.grade)) return false;
      } else if (
        immediateReward.gradeFilter !== 'target' &&
        immediateReward.gradeFilter !== 'all'
      ) {
        if (s.grade !== immediateReward.gradeFilter) return false;
      }
      if (q) {
        const hay = `${s.fullName || ''} ${s.username || ''} ${s.grade || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    normalizedStudents,
    immediateReward.onlyActive,
    immediateReward.gradeFilter,
    immediateReward.search,
    testForm.targetClasses,
    isTargetingAllClasses,
  ]);

  const autoImmediateCandidates = useMemo(() => {
    const activeAll = normalizedStudents.filter((s) => (Number(s.testsPassed) || 0) > 0);
    const inTarget = isTargetingAllClasses
      ? activeAll
      : activeAll.filter((s) => testForm.targetClasses.includes(s.grade));
    const pool = inTarget.length > 0 ? inTarget : activeAll;
    return pool.slice(0, Math.max(1, Number(immediateReward.topCount) || 3));
  }, [normalizedStudents, testForm.targetClasses, isTargetingAllClasses, immediateReward.topCount]);

  const handleToggleImmediateStudent = (studentId) => {
    setImmediateReward((prev) => {
      const exists = prev.studentIds.includes(studentId);
      return {
        ...prev,
        studentIds: exists
          ? prev.studentIds.filter((id) => id !== studentId)
          : [...prev.studentIds, studentId],
      };
    });
  };

  const handleSelectTopActiveImmediate = (n) => {
    const topIds = filteredImmediateStudents.slice(0, n).map((s) => s.id);
    if (!topIds.length) {
      showToast(
        tr("Mos faol o'quvchilar topilmadi!", 'Подходящие активные ученики не найдены!'),
        'warning'
      );
      return;
    }
    setImmediateReward((prev) => ({
      ...prev,
      mode: 'manual',
      studentIds: topIds,
    }));
  };

  const handleToggleClass = (className) => {
    setTestForm((prev) => {
      const exists = prev.targetClasses.includes(className);
      if (exists) {
        if (prev.targetClasses.length === 1) return prev;
        return {
          ...prev,
          targetClasses: prev.targetClasses.filter((c) => c !== className),
        };
      }
      return { ...prev, targetClasses: [...prev.targetClasses, className] };
    });
  };

  const handleSaveTest = async (e) => {
    e.preventDefault();
    if (saving) return;

    if (!testForm.title.trim()) {
      showToast(tr('Iltimos, test nomini kiriting!', 'Пожалуйста, введите название теста!'), 'warning');
      return;
    }

    if (!testForm.questions || testForm.questions.length === 0) {
      showToast(
        tr("Kamida bitta savol qo'shilishi shart!", 'Необходимо добавить хотя бы один вопрос!'),
        'warning'
      );
      return;
    }

    if (testForm.questions.some((q) => !q.text || !q.text.trim())) {
      showToast(
        tr("Barcha savollar matnini to'ldiring!", 'Заполните текст всех вопросов!'),
        'warning'
      );
      return;
    }

    if (!editingTestId && immediateReward.enabled) {
      if ((Number(immediateReward.amount) || 0) <= 0) {
        showToast(
          tr(
            "Darhol mukofotlash coin miqdori 0 dan katta bo'lishi kerak!",
            'Количество коинов для мгновенного поощрения должно быть больше 0!'
          ),
          'warning'
        );
        return;
      }
      if (immediateReward.mode === 'manual' && immediateReward.studentIds.length === 0) {
        showToast(
          tr(
            "Ro'yxatdan kamida bitta faol o'quvchini tanlang yoki Avtomatik rejimni yoqing!",
            'Выберите хотя бы одного активного ученика или включите автоматический режим!'
          ),
          'warning'
        );
        return;
      }
    }

    const sanitizedQuestions = testForm.questions.map((q, idx) => {
      let opts = Array.isArray(q.options) ? [...q.options] : [];
      if (opts.length === 0) {
        opts = [
          { text: 'A', isCorrect: true },
          { text: 'B', isCorrect: false },
          { text: 'C', isCorrect: false },
          { text: 'D', isCorrect: false },
        ];
      }
      let correctIdx = opts.findIndex((o) =>
        typeof o === 'object' ? o.isCorrect : false
      );
      if (correctIdx === -1) {
        correctIdx = 0;
        opts[0] = { ...opts[0], isCorrect: true };
      }
      return {
        id: q.id || idx + 1,
        question: q.text.trim(),
        text: q.text.trim(),
        imageUrl: q.imageUrl || '',
        explanation: (q.explanation || '').trim(),
        correctIndex: correctIdx,
        options: opts.map((o) =>
          typeof o === 'object' ? (o.text || '').trim() : String(o).trim()
        ),
      };
    });

    const targetClassesStr =
      Array.isArray(testForm.targetClasses) && testForm.targetClasses.length > 0
        ? testForm.targetClasses.length === normalizedClasses.length &&
          normalizedClasses.length > 1
          ? 'Barchasi'
          : testForm.targetClasses.join(', ')
        : 'Barchasi';

    const payload = {
      title: testForm.title.trim(),
      subject: testForm.subject || 'Matematika',
      language: testForm.language || 'uz',
      grade: targetClassesStr,
      targetClasses: testForm.targetClasses,
      durationMinutes: Number(testForm.durationMinutes) || 30,
      maxAttempts: Number(testForm.maxAttempts) || 1,
      rewardTopCount: Math.max(0, Number(testForm.rewardTopCount) || 0),
      rewardCoinsAmount: Math.max(0, Number(testForm.rewardCoinsAmount) || 0),
      rewardMinScore: Math.min(100, Math.max(0, Number(testForm.rewardMinScore) || 0)),
      startTime: testForm.startTime || null,
      endTime: testForm.endTime || null,
      isStudentAllowed: Boolean(testForm.isStudentAllowed),
      teacherId: testForm.teacherId ? Number(testForm.teacherId) : currentUser?.id,
      questions: sanitizedQuestions,
    };

    if (!editingTestId && immediateReward.enabled) {
      payload.immediateReward = {
        enabled: true,
        studentIds: immediateReward.mode === 'manual' ? immediateReward.studentIds : [],
        topCount:
          immediateReward.mode === 'auto'
            ? Math.max(1, Number(immediateReward.topCount) || 3)
            : 0,
        amount: Math.max(1, Number(immediateReward.amount) || 10),
        reason: (immediateReward.reason || '').trim(),
      };
    }

    setSaving(true);
    try {
      if (editingTestId) {
        await api.teacher.updateTest(editingTestId, payload);
        showToast(
          tr('Test va savollar muvaffaqiyatli yangilandi!', 'Тест и вопросы успешно обновлены!'),
          'success'
        );
      } else {
        const res = await api.teacher.createTest(payload);
        showToast(
          res?.message ||
            tr(
              'Yangi test va savollar muvaffaqiyatli chop etildi!',
              'Новый тест и вопросы успешно опубликованы!'
            ),
          'success'
        );
      }
      if (onSaved) onSaved();
    } catch (err) {
      showToast(err.message || tr('Testni saqlashda xatolik!', 'Ошибка при сохранении теста!'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSaveTest} className="test-builder-container animate-fade-in">
      {/* TOP CARD: MAIN SETTINGS */}
      <div className="test-builder-card space-y-5">
        {/* Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            {onCancel && (
              <button
                type="button"
                className="btn btn-secondary btn-xs flex items-center gap-1 border-slate-700 hover:border-cyan-400"
                onClick={onCancel}
                title={tr("Testlar ro'yxatiga qaytish", 'Вернуться к списку тестов')}
              >
                <ArrowLeft size={14} /> {tr('Orqaga', 'Назад')}
              </button>
            )}
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-md">
              <Edit size={20} />
            </div>
            <div>
              <h3 className="test-builder-header-title">
                {editingTestId
                  ? tr('Test va Savollarni Tahrirlash', 'Редактирование теста и вопросов')
                  : tr("Admin: Yangi Test va Savol Qo'shish", 'Админ: Добавить новый тест и вопросы')}
              </h3>
              <p className="text-xs text-slate-400">
                {tr(
                  'Test parametrlari, sinflar taqsimoti va savollarni faqat administrator boshqaradi',
                  'Параметры теста, распределение по классам и вопросы контролируются только администратором'
                )}
              </p>
            </div>
          </div>

          {/* Template download pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={api.teacher.downloadTemplateUrl('word')}
              download
              className="btn btn-secondary btn-xs flex items-center gap-1.5 text-xs border-cyan-500/30 hover:border-cyan-400"
              title={tr('Word (.docx) formatidagi test shabloni', 'Шаблон теста в формате Word (.docx)')}
            >
              <Download size={13} className="text-cyan-400" /> {tr('Word Shablon', 'Шаблон Word')}
            </a>
            <a
              href={api.teacher.downloadTemplateUrl('excel')}
              download
              className="btn btn-secondary btn-xs flex items-center gap-1.5 text-xs border-emerald-500/30 hover:border-emerald-400"
              title={tr('Excel (.xlsx) formatidagi test shabloni', 'Шаблон теста в формате Excel (.xlsx)')}
            >
              <Download size={13} className="text-emerald-400" /> {tr('Excel Shablon', 'Шаблон Excel')}
            </a>
          </div>
        </div>

        {loadingDetail && (
          <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs flex items-center gap-2">
            <Loader2 size={15} className="animate-spin" />
            <span>{tr('Test savollari va parametrlari yuklanmoqda...', 'Загрузка вопросов и параметров теста...')}</span>
          </div>
        )}

        {/* Form Fields: Grid Layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Test Nomi - Full Width */}
          <div className="sm:col-span-2 lg:col-span-4">
            <label className="input-label text-cyan-200 font-bold flex items-center justify-between">
              <span>{tr('Test Nomi *', 'Название теста *')}</span>
              <span className="text-[11px] text-slate-400 font-normal">
                {tr('Mavzu yoki nazorat ishi nomi', 'Тема или название контрольной работы')}
              </span>
            </label>
            <input
              type="text"
              className="clean-input font-medium text-white placeholder-slate-400"
              placeholder={tr(
                'Masalan: 9-sinf Matematika: Kvadrat tenglamalar va funksiyalar nazorati',
                'Например: 9 класс Математика: Контроль по квадратным уравнениям и функциям'
              )}
              value={testForm.title}
              onChange={(e) => setTestForm({ ...testForm, title: e.target.value })}
              required
            />
          </div>

          {/* Fan */}
          <div>
            <label className="input-label text-slate-300 font-semibold">{tr('Fani *', 'Предмет *')}</label>
            <select
              className="clean-select font-medium"
              value={testForm.subject}
              onChange={(e) => setTestForm({ ...testForm, subject: e.target.value })}
            >
              {subjectsList.map((s) => (
                <option key={s} value={s}>
                  {localizeSubject(s, language)}
                </option>
              ))}
            </select>
          </div>

          {/* Ta'lim Tili */}
          <div>
            <label className="input-label text-slate-300 font-semibold">
              {tr("Ta'lim Tili *", 'Язык теста *')}
            </label>
            <select
              className="clean-select font-medium"
              value={testForm.language}
              onChange={(e) => setTestForm({ ...testForm, language: e.target.value })}
            >
              <option value="uz">🇺🇿 {tr("O'zbek tili", 'Узбекский язык')}</option>
              <option value="ru">🇷🇺 {tr('Rus tili', 'Русский язык')}</option>
            </select>
          </div>

          {/* Ajratilgan Vaqt */}
          <div>
            <label className="input-label text-slate-300 font-semibold flex items-center gap-1.5">
              <Clock size={13} className="text-cyan-400" />
              <span>{tr('Ajratilgan Vaqt (Daqiqa) *', 'Время на тест (минут) *')}</span>
            </label>
            <input
              type="number"
              min={5}
              max={180}
              className="clean-input font-medium"
              value={testForm.durationMinutes}
              onChange={(e) =>
                setTestForm({ ...testForm, durationMinutes: Number(e.target.value) })
              }
              required
            />
          </div>

          {/* Maksimal Urinishlar */}
          <div>
            <label className="input-label text-slate-300 font-semibold flex items-center gap-1.5">
              <Award size={13} className="text-amber-400" />
              <span>{tr('Maksimal Urinishlar *', 'Максимум попыток *')}</span>
            </label>
            <input
              type="number"
              min={1}
              max={10}
              className="clean-input font-medium"
              value={testForm.maxAttempts}
              onChange={(e) =>
                setTestForm({ ...testForm, maxAttempts: Number(e.target.value) })
              }
              required
            />
          </div>

          {/* Berilgan O'qituvchi */}
          <div className="sm:col-span-2">
            <label className="input-label text-slate-300 font-semibold flex items-center gap-1.5">
              <UserCheck size={13} className="text-emerald-400" />
              <span>
                {tr(
                  "Berilgan O'qituvchi (Test qaysi ustozga ko'rinishi)",
                  'Назначенный учитель (кому будет виден тест)'
                )}
              </span>
            </label>
            <select
              className="clean-select font-medium"
              value={testForm.teacherId}
              onChange={(e) => setTestForm({ ...testForm, teacherId: e.target.value })}
            >
              {currentUser?.id && (
                <option value={String(currentUser.id)}>
                  👑 {localizeUserFullName(currentUser.fullName, language) || tr('Bosh Administrator', 'Главный администратор')} (
                  {tr("Faqat Admin — o'qituvchilarga ko'rinmaydi", 'Только Админ — учителям не виден')})
                </option>
              )}
              {(Array.isArray(teachersList) ? teachersList : []).map((tch) => (
                <option key={tch.id} value={String(tch.id)}>
                  👨‍🏫 {tch.fullName} ({tch.subject ? localizeSubject(tch.subject, language) : tr("O'qituvchi", 'Учитель')})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              {tr(
                "O'qituvchi o'z kabinetida faqat unga biriktirilgan (berilgan) testlarni va natijalarini ko'ra oladi.",
                'Учитель в своём кабинете видит только закреплённые за ним тесты и их результаты.'
              )}
            </p>
          </div>

          {/* Boshlanish vaqti (ixtiyoriy) */}
          <div>
            <label className="input-label text-slate-300 font-semibold flex items-center gap-1.5">
              <Calendar size={13} className="text-sky-400" />
              <span>{tr('Boshlanish Vaqti (ixtiyoriy)', 'Время начала (необяз.)')}</span>
            </label>
            <input
              type="datetime-local"
              className="clean-input font-medium text-xs"
              value={testForm.startTime}
              onChange={(e) => setTestForm({ ...testForm, startTime: e.target.value })}
            />
          </div>

          {/* Tugash vaqti (ixtiyoriy) */}
          <div>
            <label className="input-label text-slate-300 font-semibold flex items-center gap-1.5">
              <Calendar size={13} className="text-rose-400" />
              <span>{tr('Tugash Vaqti (ixtiyoriy)', 'Время окончания (необяз.)')}</span>
            </label>
            <input
              type="datetime-local"
              className="clean-input font-medium text-xs"
              value={testForm.endTime}
              onChange={(e) => setTestForm({ ...testForm, endTime: e.target.value })}
            />
          </div>
        </div>

        {/* O'quvchilar uchun Test Ruxsati Nazorati */}
        <div
          className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            testForm.isStudentAllowed
              ? 'bg-emerald-500/10 border-emerald-500/35'
              : 'bg-amber-500/10 border-amber-500/30'
          }`}
        >
          <div className="flex items-start gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                testForm.isStudentAllowed
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-amber-500/20 border-amber-500/40 text-amber-300'
              }`}
            >
              {testForm.isStudentAllowed ? <Unlock size={17} /> : <Lock size={17} />}
            </div>
            <div>
              <div className="text-xs font-extrabold text-white">
                {tr("O'quvchilar Bo'limiga Ishlash Ruxsati", 'Разрешение ученикам на прохождение')}
              </div>
              <div className="text-[11px] text-slate-300 mt-0.5">
                {testForm.isStudentAllowed
                  ? tr(
                      "Testga ruxsat yoqilgan: agar boshlanish/tugash vaqti belgilangan bo'lsa, faqat o'sha vaqt oralig'ida o'quvchilar ishlay oladi.",
                      'Разрешение включено: если задано время начала/окончания, ученики смогут решать тест только в этот период.'
                    )
                  : tr(
                      "Test sukut bo'yicha yopiq saqlanadi — o'quvchilarga 'Admin ruxsati kutilmoqda' holatida ko'rinadi va boshlab bo'lmaydi.",
                      "По умолчанию тест закрыт — ученикам показывается статус 'Ожидает разрешения админа', и начать его нельзя."
                    )}
              </div>
            </div>
          </div>

          <button
            type="button"
            data-testid="builder-toggle-student-allowed"
            onClick={() =>
              setTestForm((prev) => ({
                ...prev,
                isStudentAllowed: !prev.isStudentAllowed,
              }))
            }
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold border flex items-center gap-1.5 whitespace-nowrap transition-all ${
              testForm.isStudentAllowed
                ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md'
                : 'bg-slate-900 text-amber-300 border-amber-500/40 hover:border-amber-400'
            }`}
          >
            {testForm.isStudentAllowed ? (
              <>
                <Unlock size={14} /> {tr('Ruxsat Berilgan (Ochiq)', 'Разрешено (Открыт)')}
              </>
            ) : (
              <>
                <Lock size={14} /> {tr('Hozircha Yopiq (Ruxsat berish)', 'Пока закрыт (Открыть доступ)')}
              </>
            )}
          </button>
        </div>

        {/* Target Classes Section */}
        <div className="pt-2 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <label className="input-label text-cyan-200 font-bold mb-0">
                {language === 'ru'
                  ? `Целевые классы (выбрано: ${testForm.targetClasses.length}):`
                  : `Mo'ljallangan Sinflar (${testForm.targetClasses.length} ta tanlangan):`}
              </label>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                  testForm.targetClasses.length === normalizedClasses.length &&
                  normalizedClasses.length > 1
                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/35'
                    : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                }`}
              >
                {testForm.targetClasses.length === normalizedClasses.length &&
                normalizedClasses.length > 1
                  ? tr('🌐 Barchasi (hamma sinflarga)', '🌐 Все классы')
                  : `${tr('🎯 Faqat:', '🎯 Только:')} ${testForm.targetClasses
                      .slice(0, 4)
                      .map((cls) => localizeGrade(cls, language))
                      .join(', ')}${
                      testForm.targetClasses.length > 4
                        ? ` +${testForm.targetClasses.length - 4}`
                        : ''
                    }`}
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                className="class-quick-filter-btn"
                onClick={() =>
                  setTestForm((prev) => ({
                    ...prev,
                    targetClasses: [...normalizedClasses],
                  }))
                }
              >
                ✓ {tr('Barchasini Tanlash', 'Выбрать все')}
              </button>
              <button
                type="button"
                className="class-quick-filter-btn"
                onClick={() => {
                  const uz = normalizedClasses.filter(
                    (c) => !c.toUpperCase().includes('RU')
                  );
                  if (uz.length) {
                    setTestForm((prev) => ({ ...prev, targetClasses: uz }));
                  }
                }}
              >
                🇺🇿 {tr("O'zbek sinflari", 'Узбекские классы')}
              </button>
              <button
                type="button"
                className="class-quick-filter-btn"
                onClick={() => {
                  const ru = normalizedClasses.filter((c) =>
                    c.toUpperCase().includes('RU')
                  );
                  if (ru.length) {
                    setTestForm((prev) => ({ ...prev, targetClasses: ru }));
                  }
                }}
              >
                🇷🇺 {tr('Rus sinflari', 'Русские классы')}
              </button>
              <button
                type="button"
                className="class-quick-filter-btn text-rose-400 hover:text-rose-300 hover:border-rose-400/40"
                onClick={() =>
                  setTestForm((prev) => ({
                    ...prev,
                    targetClasses: [normalizedClasses[0] || '9-A'],
                  }))
                }
              >
                {tr('Tozalash', 'Сбросить')}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {normalizedClasses.map((cls) => {
              const isSelected = testForm.targetClasses.includes(cls);
              return (
                <button
                  key={cls}
                  type="button"
                  className={`target-class-pill ${isSelected ? 'selected' : 'unselected'}`}
                  onClick={() => handleToggleClass(cls)}
                >
                  <span
                    className={
                      isSelected ? 'text-white font-black' : 'text-cyan-400 font-bold'
                    }
                  >
                    {isSelected ? '✓' : '+'}
                  </span>
                  <span>{localizeGrade(cls, language)}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Reward Panel A: Auto Bonus on Test Completion for First N Active Participants */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-slate-950/70 to-cyan-500/5 border border-amber-500/30 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 flex-shrink-0">
                <Zap size={18} />
              </div>
              <div>
                <div className="text-xs font-extrabold text-white flex items-center gap-2 flex-wrap">
                  <span>
                    {tr(
                      "Testda Faol Qatnashgan O'quvchilarga Avtomatik Coin Bonusi",
                      'Автоматический коин-бонус активным участникам теста'
                    )}
                  </span>
                  {Number(testForm.rewardTopCount) > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-black">
                      {language === 'ru'
                        ? `Топ-${testForm.rewardTopCount} активным +${testForm.rewardCoinsAmount} 💎`
                        : `Top ${testForm.rewardTopCount} faolga +${testForm.rewardCoinsAmount} 💎`}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400">
                  {tr(
                    "Testni birinchi bo'lib belgilangan natijadan yuqori topshirgan N nafar faol o'quvchiga avtomatik bonus coin beriladi",
                    'Первым N ученикам, успешно сдавшим тест выше минимального балла, автоматически начисляется бонус'
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {[0, 3, 5, 10].map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  className={`coin-pill-btn text-[11px] ${
                    Number(testForm.rewardTopCount) === cnt ? 'active' : ''
                  }`}
                  onClick={() =>
                    setTestForm((prev) => ({ ...prev, rewardTopCount: cnt }))
                  }
                >
                  {cnt === 0 ? tr('Bonussiz', 'Без бонуса') : `${tr('Top', 'Топ')} ${cnt}`}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="input-label text-[11px] text-amber-200 font-semibold">
                {tr("Nechta faol o'quvchiga bonus? (N)", 'Скольким активным ученикам? (N)')}
              </label>
              <input
                type="number"
                min={0}
                max={100}
                className="clean-input text-xs font-bold"
                value={testForm.rewardTopCount}
                onChange={(e) =>
                  setTestForm((prev) => ({
                    ...prev,
                    rewardTopCount: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
              />
            </div>

            <div>
              <label className="input-label text-[11px] text-amber-200 font-semibold">
                {tr("Har biriga qo'shimcha Coin (+M)", 'Бонусные коины каждому (+M)')}
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={500}
                  disabled={Number(testForm.rewardTopCount) <= 0}
                  className="clean-input text-xs font-bold text-amber-300"
                  value={testForm.rewardCoinsAmount}
                  onChange={(e) =>
                    setTestForm((prev) => ({
                      ...prev,
                      rewardCoinsAmount: Math.max(0, Number(e.target.value) || 0),
                    }))
                  }
                />
                {[10, 20, 50].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    disabled={Number(testForm.rewardTopCount) <= 0}
                    className={`row-quick-coin-btn text-[10px] ${
                      Number(testForm.rewardCoinsAmount) === amt
                        ? 'bg-amber-500/40 border-amber-400 text-amber-200'
                        : ''
                    }`}
                    onClick={() =>
                      setTestForm((prev) => ({ ...prev, rewardCoinsAmount: amt }))
                    }
                  >
                    +{amt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="input-label text-[11px] text-amber-200 font-semibold">
                {tr('Minimal ball talabi (%)', 'Минимальный балл (%)')}
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={100}
                  disabled={Number(testForm.rewardTopCount) <= 0}
                  className="clean-input text-xs font-bold"
                  value={testForm.rewardMinScore}
                  onChange={(e) =>
                    setTestForm((prev) => ({
                      ...prev,
                      rewardMinScore: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                    }))
                  }
                />
                {[0, 60, 80].map((ms) => (
                  <button
                    key={ms}
                    type="button"
                    disabled={Number(testForm.rewardTopCount) <= 0}
                    className={`row-quick-coin-btn text-[10px] ${
                      Number(testForm.rewardMinScore) === ms
                        ? 'bg-cyan-500/30 border-cyan-400 text-cyan-200'
                        : ''
                    }`}
                    onClick={() =>
                      setTestForm((prev) => ({ ...prev, rewardMinScore: ms }))
                    }
                  >
                    {ms === 0 ? tr('Barcha', 'Все') : `${ms}%+`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {Number(testForm.rewardTopCount) > 0 && (
            <div className="p-2.5 rounded-xl bg-slate-950/70 border border-amber-500/25 text-[11px] text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span>
                {language === 'ru' ? (
                  <>
                    ⚡ Первым <strong>{testForm.rewardTopCount}</strong> ученикам, сдавшим тест{' '}
                    {Number(testForm.rewardMinScore) > 0
                      ? `с результатом не менее ${testForm.rewardMinScore}%`
                      : 'успешно'}
                    , автоматически начислится{' '}
                    <strong className="text-amber-300">+{testForm.rewardCoinsAmount} Diamond Coin</strong>.
                  </>
                ) : (
                  <>
                    ⚡ Testni birinchi <strong>{testForm.rewardTopCount} nafar</strong> bo&apos;lib{' '}
                    {Number(testForm.rewardMinScore) > 0 ? (
                      <>kamida <strong>{testForm.rewardMinScore}%</strong> natija bilan </>
                    ) : (
                      'muvaffaqiyatli '
                    )}
                    topshirgan o&apos;quvchilar hisobiga avtomatik{' '}
                    <strong className="text-amber-300">+{testForm.rewardCoinsAmount} Diamond Coin</strong> qo&apos;shiladi.
                  </>
                )}
              </span>
              {editingTestId && (
                <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-cyan-300 font-bold whitespace-nowrap">
                  {tr('Ishlatildi:', 'Использовано:')} {rewardSlotsUsed} / {testForm.rewardTopCount}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Reward Panel B: Immediate Reward Upon Creating This Test */}
        {!editingTestId && (
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-cyan-500/30 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 flex-shrink-0">
                  <Coins size={18} />
                </div>
                <div>
                  <div className="text-xs font-extrabold text-white flex items-center gap-2 flex-wrap">
                    <span>
                      {tr(
                        "Test Qo'shishda Faol O'quvchilarni Darhol Taqdirlash",
                        'Мгновенное поощрение активных учеников при создании теста'
                      )}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-bold">
                      {tr('Ixtiyoriy', 'Необязательно')}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {tr(
                      "Yangi test yaratilishi bilan avvalgi dars va testlarda faol qatnashgan bir nechta o'quvchiga darhol coin bering",
                      'Сразу при создании теста начислите коины ученикам, активно проявившим себя на уроках и прошлых тестах'
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                  immediateReward.enabled
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                    : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-cyan-400'
                }`}
                onClick={() =>
                  setImmediateReward((prev) => ({ ...prev, enabled: !prev.enabled }))
                }
              >
                {immediateReward.enabled
                  ? tr('✓ Darhol Coin Berish Yoqilgan', '✓ Мгновенное начисление включено')
                  : tr("+ Faol O'quvchilarga Coin Berish", '+ Начислить коины активным')}
              </button>
            </div>

            {immediateReward.enabled && (
              <div className="pt-2 border-t border-slate-800/80 space-y-3">
                {/* Mode & Amount */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="input-label text-[11px] text-cyan-200 font-semibold">
                      {tr('Tanlash usuli:', 'Способ выбора:')}
                    </label>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                          immediateReward.mode === 'auto'
                            ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                            : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-amber-400'
                        }`}
                        onClick={() =>
                          setImmediateReward((prev) => ({ ...prev, mode: 'auto' }))
                        }
                      >
                        ⚡ {tr('Avtomatik Top-N faolga', 'Автоматически Топ-N активным')}
                      </button>
                      <button
                        type="button"
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                          immediateReward.mode === 'manual'
                            ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-black'
                            : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-cyan-400'
                        }`}
                        onClick={() =>
                          setImmediateReward((prev) => ({ ...prev, mode: 'manual' }))
                        }
                      >
                        ☑️{' '}
                        {language === 'ru'
                          ? `Выбрать учеников (${immediateReward.studentIds.length})`
                          : `O'quvchilarni belgilash (${immediateReward.studentIds.length} ta)`}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="input-label text-[11px] text-cyan-200 font-semibold">
                      {tr(
                        "Har bir tanlangan faol o'quvchiga Coin miqdori:",
                        'Количество коинов каждому выбранному ученику:'
                      )}
                    </label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[10, 15, 20, 30, 50].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          className={`coin-pill-btn text-xs ${
                            Number(immediateReward.amount) === amt ? 'active' : ''
                          }`}
                          onClick={() =>
                            setImmediateReward((prev) => ({ ...prev, amount: amt }))
                          }
                        >
                          +{amt}
                        </button>
                      ))}
                      <input
                        type="number"
                        min={1}
                        max={500}
                        className="clean-input text-xs w-20 font-bold text-amber-300"
                        value={immediateReward.amount}
                        onChange={(e) =>
                          setImmediateReward((prev) => ({
                            ...prev,
                            amount: Math.max(1, Number(e.target.value) || 1),
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Reason */}
                <div>
                  <label className="input-label text-[11px] text-slate-300 font-semibold">
                    {tr('Izoh / Sabab (ixtiyoriy):', 'Причина / Комментарий (необязательно):')}
                  </label>
                  <input
                    type="text"
                    className="clean-input text-xs"
                    placeholder={tr(
                      "Masalan: Yangi test qo'shilishi munosabati bilan faol ishtirok uchun",
                      'Например: За активное участие в честь публикации нового теста'
                    )}
                    value={immediateReward.reason}
                    onChange={(e) =>
                      setImmediateReward((prev) => ({ ...prev, reason: e.target.value }))
                    }
                  />
                </div>

                {/* Mode AUTO */}
                {immediateReward.mode === 'auto' && (
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-200">
                        {tr(
                          "Nechta eng faol o'quvchiga darhol coin berilsin?",
                          'Скольким самым активным ученикам сразу начислить коины?'
                        )}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {[1, 3, 5, 10].map((n) => (
                          <button
                            key={n}
                            type="button"
                            className={`coin-pill-btn text-xs ${
                              Number(immediateReward.topCount) === n ? 'active' : ''
                            }`}
                            onClick={() =>
                              setImmediateReward((prev) => ({ ...prev, topCount: n }))
                            }
                          >
                            {language === 'ru' ? `${n}` : `${n} ta`}
                          </button>
                        ))}
                        <input
                          type="number"
                          min={1}
                          max={50}
                          className="clean-input text-xs w-16 font-bold text-center"
                          value={immediateReward.topCount}
                          onChange={(e) =>
                            setImmediateReward((prev) => ({
                              ...prev,
                              topCount: Math.max(1, Number(e.target.value) || 1),
                            }))
                          }
                        />
                      </div>
                    </div>

                    {autoImmediateCandidates.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {autoImmediateCandidates.map((s) => (
                          <span
                            key={s.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200 font-semibold"
                          >
                            <span>{s.fullName || s.username}</span>
                            <span className="text-cyan-300">({localizeGrade(s.grade, language)})</span>
                            <span className="text-emerald-300">
                              {language === 'ru' ? `${s.testsPassed} тест.` : `${s.testsPassed} test`}
                            </span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[11px] text-amber-300">
                        {tr(
                          "Hozircha test yechgan faol o'quvchilar topilmadi — istasangiz \"O'quvchilarni belgilash\" orqali qo'lda tanlashingiz mumkin.",
                          'Пока не найдено активных учеников с решёнными тестами — вы можете выбрать их вручную через «Выбрать учеников».'
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Mode MANUAL */}
                {immediateReward.mode === 'manual' && (
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="input-with-icon flex-1 min-w-[160px]">
                        <Search size={14} className="input-icon" />
                        <input
                          type="text"
                          className="clean-input text-xs"
                          placeholder={tr("O'quvchi qidirish...", 'Поиск ученика...')}
                          value={immediateReward.search}
                          onChange={(e) =>
                            setImmediateReward((prev) => ({
                              ...prev,
                              search: e.target.value,
                            }))
                          }
                        />
                      </div>

                      <select
                        className="clean-select text-xs w-auto"
                        value={immediateReward.gradeFilter}
                        onChange={(e) =>
                          setImmediateReward((prev) => ({
                            ...prev,
                            gradeFilter: e.target.value,
                          }))
                        }
                      >
                        <option value="target">{tr('Tanlangan sinflar', 'Выбранные классы')}</option>
                        <option value="all">{tr('Barcha sinflar', 'Все классы')}</option>
                        {normalizedClasses.map((c) => (
                          <option key={c} value={c}>
                            {language === 'ru' ? `${localizeGrade(c, language)} класс` : `${c} sinf`}
                          </option>
                        ))}
                      </select>

                      <label className="inline-flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer px-2 py-1 rounded-lg bg-slate-950/60 border border-slate-800">
                        <input
                          type="checkbox"
                          checked={immediateReward.onlyActive}
                          onChange={(e) =>
                            setImmediateReward((prev) => ({
                              ...prev,
                              onlyActive: e.target.checked,
                            }))
                          }
                        />
                        <span>{tr('Faqat test yechganlar', 'Только решавшие тесты')}</span>
                      </label>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        className="class-quick-filter-btn"
                        onClick={() => handleSelectTopActiveImmediate(3)}
                      >
                        ⚡ {tr('Top 3 ni belgilash', 'Выбрать Топ-3')}
                      </button>
                      <button
                        type="button"
                        className="class-quick-filter-btn"
                        onClick={() => handleSelectTopActiveImmediate(5)}
                      >
                        ⚡ {tr('Top 5 ni belgilash', 'Выбрать Топ-5')}
                      </button>
                      <button
                        type="button"
                        className="class-quick-filter-btn text-rose-300"
                        onClick={() =>
                          setImmediateReward((prev) => ({ ...prev, studentIds: [] }))
                        }
                      >
                        {tr('Tozalash', 'Очистить')}
                      </button>
                      <span className="ml-auto text-[11px] text-amber-300 font-bold">
                        {language === 'ru'
                          ? `Выбрано: ${immediateReward.studentIds.length} уч. (итого +${immediateReward.studentIds.length * (Number(immediateReward.amount) || 0)} 💎)`
                          : `Tanlandi: ${immediateReward.studentIds.length} nafar (jami +${immediateReward.studentIds.length * (Number(immediateReward.amount) || 0)} 💎)`}
                      </span>
                    </div>

                    <div className="max-h-52 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5 pr-1">
                      {filteredImmediateStudents.map((s) => {
                        const checked = immediateReward.studentIds.includes(s.id);
                        return (
                          <label
                            key={s.id}
                            className={`flex items-center justify-between gap-2 p-2 rounded-xl border text-xs cursor-pointer transition-all ${
                              checked
                                ? 'bg-cyan-500/15 border-cyan-400/60 text-white'
                                : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => handleToggleImmediateStudent(s.id)}
                              />
                              <div className="truncate">
                                <div className="font-bold truncate">
                                  {s.fullName || s.username}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {localizeGrade(s.grade, language)} •{' '}
                                  {language === 'ru'
                                    ? `${s.testsPassed || 0} тест.`
                                    : `${s.testsPassed || 0} ta test`}{' '}
                                  • {s.avgScore || 0}%
                                </div>
                              </div>
                            </div>
                            <span className="text-[11px] font-black text-amber-300 flex-shrink-0">
                              {s.coins || 0} 💎
                            </span>
                          </label>
                        );
                      })}
                      {filteredImmediateStudents.length === 0 && (
                        <div className="sm:col-span-2 text-center py-4 text-xs text-slate-400">
                          {tr(
                            "Filtrga mos o'quvchilar topilmadi. \"Faqat test yechganlar\" belgisini olib tashlab ko'ring.",
                            'Подходящие ученики не найдены. Попробуйте снять галочку «Только решавшие тесты».'
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Import questions from Word / Excel Card */}
        <div className="builder-import-box">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 flex-shrink-0">
                <Upload size={18} />
              </div>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <span>{tr('Fayldan avtomatik import qilish', 'Автоматический импорт из файла')}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold">
                    .docx / .xlsx
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">
                  {tr(
                    'Word yoki Excel shablonidagi barcha savollarni bir zumda tizimga yuklang',
                    'Мгновенно загрузите все вопросы из шаблона Word или Excel'
                  )}
                </div>
              </div>
            </div>
            <label className="btn btn-secondary btn-sm text-xs cursor-pointer flex items-center justify-center gap-1.5 border-cyan-500/40 hover:border-cyan-400 text-white font-bold">
              <Upload size={14} className="text-cyan-400" />
              <span>{tr('Faylni Tanlash', 'Выбрать файл')}</span>
              <input
                type="file"
                accept=".docx,.xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) handleImportFile(file);
                }}
              />
            </label>
          </div>
        </div>
      </div>

      {/* QUESTIONS SECTION */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <FileText size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>{tr('Test Savollari', 'Вопросы теста')}</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-black">
                  {language === 'ru'
                    ? `${testForm.questions.length} вопр.`
                    : `${testForm.questions.length} ta`}
                </span>
              </h3>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-diamond-cyan btn-sm flex items-center gap-1.5 font-bold shadow-md"
            onClick={handleAddQuestion}
          >
            <Plus size={16} /> {tr("Savol Qo'shish", 'Добавить вопрос')}
          </button>
        </div>

        {/* Question Cards Loop */}
        {testForm.questions.map((q, qIdx) => (
          <div key={q.id || qIdx} className="question-builder-card space-y-4">
            {/* Question Card Top Bar */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <span className="question-builder-badge">
                  {tr('SAVOL', 'ВОПРОС')} #{qIdx + 1}
                </span>
                <span className="text-[11px] text-slate-400 font-medium">
                  ({qIdx + 1} / {testForm.questions.length})
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className="btn btn-secondary btn-xs flex items-center gap-1 text-[11px] text-slate-300 hover:text-cyan-400 hover:border-cyan-400"
                  onClick={() => handleDuplicateQuestion(qIdx)}
                  title={tr('Savoldan nusxa olish', 'Дублировать вопрос')}
                >
                  <Copy size={12} />
                  <span className="hidden sm:inline">{tr('Nusxa', 'Копия')}</span>
                </button>
                {testForm.questions.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-xs flex items-center gap-1 text-[11px] text-rose-400 hover:bg-rose-500/15 hover:border-rose-400/50"
                    onClick={() => handleRemoveQuestion(qIdx)}
                    title={tr("Savolni o'chirish", 'Удалить вопрос')}
                  >
                    <Trash2 size={12} />
                    <span className="hidden sm:inline">{tr("O'chirish", 'Удалить')}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Question Textarea + LaTeX Toolbar */}
            <div className="space-y-1.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <label className="input-label text-cyan-200 font-semibold mb-0">
                  {tr(
                    "Savol matni (LaTeX formulalar qo'llab-quvvatlanadi):",
                    'Текст вопроса (поддерживаются формулы LaTeX):'
                  )}
                </label>
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[10px] text-slate-400 mr-1 font-semibold">
                    {tr('Tezkor:', 'Быстро:')}
                  </span>
                  <button
                    type="button"
                    className="math-chip"
                    onClick={() => handleInsertMath(qIdx, '\\(x^2\\)')}
                    title={tr("Kvadrat qo'shish", 'Вставить квадрат')}
                  >
                    x²
                  </button>
                  <button
                    type="button"
                    className="math-chip"
                    onClick={() => handleInsertMath(qIdx, '\\(\\frac{a}{b}\\)')}
                    title={tr("Kasr qo'shish", 'Вставить дробь')}
                  >
                    a/b
                  </button>
                  <button
                    type="button"
                    className="math-chip"
                    onClick={() => handleInsertMath(qIdx, '\\(\\sqrt{x}\\)')}
                    title={tr("Ildiz qo'shish", 'Вставить корень')}
                  >
                    √x
                  </button>
                  <button
                    type="button"
                    className="math-chip"
                    onClick={() => handleInsertMath(qIdx, '\\(\\pm\\)')}
                    title={tr("Plyus-minus qo'shish", 'Вставить плюс-минус')}
                  >
                    ±
                  </button>
                  <button
                    type="button"
                    className="math-chip"
                    onClick={() => handleInsertMath(qIdx, '\\(\\le\\)')}
                    title={tr('Kichik yoki teng', 'Меньше или равно')}
                  >
                    ≤
                  </button>
                  <button
                    type="button"
                    className="math-chip"
                    onClick={() => handleInsertMath(qIdx, '\\(\\ge\\)')}
                    title={tr('Katta yoki teng', 'Больше или равно')}
                  >
                    ≥
                  </button>
                </div>
              </div>

              <textarea
                rows={3}
                className="clean-input text-xs sm:text-sm font-medium resize-y text-white placeholder-slate-400 leading-relaxed"
                placeholder={tr(
                  'Savol matnini kiriting. Masalan: Tenglamani yeching: \\(x^2 - 5x + 6 = 0\\)',
                  'Введите текст вопроса. Например: Решите уравнение: \\(x^2 - 5x + 6 = 0\\)'
                )}
                value={q.text}
                onChange={(e) => handleQuestionTextChange(qIdx, e.target.value)}
                required
              />

              {/* Formula Live Preview */}
              {q.text && (
                <div className="mt-1.5 p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-200 shadow-inner">
                  <span className="text-[10px] text-cyan-400 uppercase font-black tracking-wider block mb-1">
                    {tr("Formula ko'rinishi (Live Preview):", 'Предпросмотр формулы (Live Preview):')}
                  </span>
                  <div className="text-white text-sm font-medium">
                    <MathRenderer text={q.text} />
                  </div>
                </div>
              )}
            </div>

            {/* Image Attachment */}
            <div className="flex items-center gap-3 pt-1">
              <label className="btn btn-secondary btn-xs flex items-center gap-1.5 cursor-pointer text-xs border-slate-700 hover:border-cyan-400">
                <ImageIcon size={13} className="text-cyan-400" />
                <span>{tr('Savolga Rasm biriktirish', 'Прикрепить изображение к вопросу')}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) handleUploadQuestionImage(qIdx, file);
                  }}
                />
              </label>
              {q.imageUrl && (
                <div className="flex items-center gap-2 p-1.5 rounded-xl bg-slate-950/60 border border-slate-700">
                  <img
                    src={q.imageUrl}
                    alt=""
                    className="w-12 h-12 object-cover rounded-lg border border-slate-700 shadow-sm"
                  />
                  <button
                    type="button"
                    className="text-rose-400 text-xs hover:text-rose-300 font-bold px-2 py-1"
                    onClick={() =>
                      setTestForm((prev) => ({
                        ...prev,
                        questions: prev.questions.map((item, idx) =>
                          idx === qIdx ? { ...item, imageUrl: '' } : item
                        ),
                      }))
                    }
                  >
                    {tr("O'chirish", 'Удалить')}
                  </button>
                </div>
              )}
            </div>

            {/* Options (A, B, C, D) */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <label className="input-label text-cyan-200 font-semibold mb-0">
                  {tr(
                    "Variantlar (To'g'ri javobni tanlash uchun ustiga bosing):",
                    'Варианты ответов (нажмите, чтобы отметить верный):'
                  )}
                </label>
                <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle size={13} />
                  {tr('Tanlangan:', 'Выбрано:')}{' '}
                  {OPTION_LETTERS[
                    q.options.findIndex((o) =>
                      typeof o === 'object' ? o.isCorrect : false
                    )
                  ] || 'A'}
                  ) {tr("to'g'ri javob", 'верный ответ')}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {q.options.map((opt, optIdx) => {
                  const letter =
                    OPTION_LETTERS[optIdx] || String.fromCharCode(65 + optIdx);
                  const isCorrect =
                    typeof opt === 'object' ? Boolean(opt.isCorrect) : false;
                  const optText =
                    typeof opt === 'object' ? opt.text ?? '' : String(opt);
                  return (
                    <div
                      key={optIdx}
                      className={`builder-option-card ${isCorrect ? 'correct' : ''}`}
                      onClick={() => handleSetCorrectOption(qIdx, optIdx)}
                    >
                      <div className="builder-option-letter">
                        {isCorrect ? '✓' : letter}
                      </div>

                      <div className="flex-1 flex flex-col justify-center">
                        <input
                          type="text"
                          className="builder-option-input"
                          placeholder={
                            language === 'ru'
                              ? `Введите текст варианта ${letter}...`
                              : `Variant ${letter} matnini kiriting...`
                          }
                          value={optText}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleOptionTextChange(qIdx, optIdx, e.target.value);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          required
                        />
                        {optText && (optText.includes('\\(') || optText.includes('$$')) && (
                          <div className="text-[11px] text-cyan-300 pt-0.5 pointer-events-none">
                            <MathRenderer text={optText} />
                          </div>
                        )}
                      </div>

                      {isCorrect ? (
                        <span className="builder-option-badge-correct">
                          ✓ {tr("To'g'ri", 'Верно')}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500 opacity-60 hover:opacity-100 uppercase font-semibold">
                          {tr('Tanlash', 'Выбрать')}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Explanation */}
            <div className="pt-2">
              <label className="input-label text-slate-300 font-semibold flex items-center gap-1.5">
                <Sparkles size={13} className="text-amber-400" />
                <span>
                  {tr(
                    "To'g'ri javob izohi / Tushuntirish (ixtiyoriy):",
                    'Пояснение к правильному ответу (необязательно):'
                  )}
                </span>
              </label>
              <input
                type="text"
                className="clean-input text-xs sm:text-sm font-medium text-white placeholder-slate-400"
                placeholder={tr(
                  "Natija tahlilida o'quvchiga ko'rsatiladigan tushuntirish yoki yechim yo'li",
                  'Пояснение или ход решения, которое увидит ученик при разборе результатов'
                )}
                value={q.explanation || ''}
                onChange={(e) =>
                  handleQuestionExplanationChange(qIdx, e.target.value)
                }
              />
            </div>
          </div>
        ))}

        {/* Add New Question Button */}
        <button
          type="button"
          className="btn-add-question-dashed"
          onClick={handleAddQuestion}
        >
          <Plus size={18} />
          <span>{tr("Yangi Savol Qo'shish", 'Добавить новый вопрос')}</span>
        </button>
      </div>

      {/* BOTTOM DOCKED ACTION BAR */}
      <div className="builder-bottom-bar">
        <div className="flex items-center gap-3 text-xs text-slate-300 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
            <FileText size={14} className="text-cyan-400" />
            <span>
              {tr('Jami savollar:', 'Всего вопросов:')}{' '}
              <strong className="text-white">
                {language === 'ru'
                  ? `${testForm.questions.length}`
                  : `${testForm.questions.length} ta`}
              </strong>
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
            <Clock size={14} className="text-cyan-400" />
            <span>
              {tr('Vaqt:', 'Время:')}{' '}
              <strong className="text-white">
                {testForm.durationMinutes} {tr('daqiqa', 'мин.')}
              </strong>
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
            <Users size={14} className="text-cyan-400" />
            <span>
              {tr('Sinflar:', 'Классы:')}{' '}
              <strong className="text-white">
                {language === 'ru'
                  ? `${testForm.targetClasses.length} кл.`
                  : `${testForm.targetClasses.length} ta sinf`}
              </strong>
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          {onCancel && (
            <button
              type="button"
              className="btn btn-secondary btn-sm px-4"
              onClick={onCancel}
              disabled={saving}
            >
              {tr('Bekor Qilish', 'Отмена')}
            </button>
          )}
          <button
            type="submit"
            disabled={saving}
            className="btn btn-success btn-sm font-bold flex items-center gap-2 px-5 py-2 shadow-lg shadow-emerald-500/20"
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            <span>
              {saving
                ? tr('Saqlanmoqda...', 'Сохранение...')
                : editingTestId
                ? tr("O'zgarishlarni Saqlash", 'Сохранить изменения')
                : tr('Testni Saqlash va Chop Etish', 'Сохранить и опубликовать тест')}
            </span>
          </button>
        </div>
      </div>
    </form>
  );
}
