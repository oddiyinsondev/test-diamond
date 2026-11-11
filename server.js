const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Ensure data folder and db.json exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getInitialData() {
  return {
    classes: ['5-A', '6-A', '7-A', '8-A', '9-A', '9-B', '10-A', '10-B', '11-A', '11-B'],
    subjects: ['Matematika', 'Fizika', 'Informatika', 'Ingliz tili', 'Biologiya', 'Kimyo', 'Tarix', 'Ona tili va Adabiyot'],
    users: [
      {
        id: 'u-admin-1',
        username: 'admin',
        password: '123',
        fullName: 'Bosh Administrator',
        role: 'admin',
        createdAt: new Date().toISOString()
      },
      {
        id: 'u-teacher-1',
        username: 'anvar_muallim',
        password: '123',
        fullName: 'Anvar Qosimov',
        role: 'teacher',
        subject: 'Matematika',
        createdAt: new Date().toISOString()
      },
      {
        id: 'u-teacher-2',
        username: 'dilnoza_ustoz',
        password: '123',
        fullName: 'Dilnoza Karimova',
        role: 'teacher',
        subject: 'Informatika',
        createdAt: new Date().toISOString()
      },
      {
        id: 'u-student-1',
        username: 'jasur_9a',
        password: '123',
        fullName: 'Jasur Aliyev',
        role: 'student',
        grade: '9-A',
        createdAt: new Date().toISOString()
      },
      {
        id: 'u-student-2',
        username: 'madina_9a',
        password: '123',
        fullName: 'Madina Rustamova',
        role: 'student',
        grade: '9-A',
        createdAt: new Date().toISOString()
      },
      {
        id: 'u-student-3',
        username: 'bobur_9a',
        password: '123',
        fullName: 'Bobur Saidov',
        role: 'student',
        grade: '9-A',
        createdAt: new Date().toISOString()
      },
      {
        id: 'u-student-4',
        username: 'aziza_10a',
        password: '123',
        fullName: 'Aziza Rahimova',
        role: 'student',
        grade: '10-A',
        createdAt: new Date().toISOString()
      }
    ],
    tests: [
      {
        id: 't-math-1',
        title: 'Kvadrat tenglamalar va funksiyalar',
        description: '9-A sinf o\'quvchilari uchun algebra fanidan oraliq nazorat testi',
        teacherId: 'u-teacher-1',
        teacherName: 'Anvar Qosimov',
        subject: 'Matematika',
        grade: '9-A',
        durationMinutes: 15,
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        questions: [
          {
            id: 'q1',
            question: 'x² - 5x + 6 = 0 tenglamaning ildizlarini toping.',
            options: ['x₁ = 2, x₂ = 3', 'x₁ = -2, x₂ = -3', 'x₁ = 1, x₂ = 6', 'x₁ = -1, x₂ = 6'],
            correctIndex: 0
          },
          {
            id: 'q2',
            question: 'Agar diskriminant D > 0 bo\'lsa, kvadrat tenglama nechta haqiqiy ildizga ega?',
            options: ['Ildizga ega emas', '1 ta ildizga ega', '2 ta turli ildizga ega', 'Cheksiz ko\'p'],
            correctIndex: 2
          },
          {
            id: 'q3',
            question: 'y = 2x + 4 chiziqli funksiya grafigining OY o\'qi bilan kesishish nuqtasi qaysi?',
            options: ['(0, 2)', '(0, 4)', '(4, 0)', '(-2, 0)'],
            correctIndex: 1
          },
          {
            id: 'q4',
            question: 'Viyet teoremasiga ko\'ra x² + px + q = 0 tenglamada ildizlar yig\'indisi nimaga teng?',
            options: ['q', '-p', 'p', '-q'],
            correctIndex: 1
          },
          {
            id: 'q5',
            question: '3x² = 27 tenglamaning yechimlarini toping.',
            options: ['x = ±3', 'x = 3', 'x = 9', 'x = ±9'],
            correctIndex: 0
          }
        ]
      },
      {
        id: 't-cs-1',
        title: 'Python dasturlash asoslari va algoritmlar',
        description: 'Informatika fanidan amaliy bilimlar testi',
        teacherId: 'u-teacher-2',
        teacherName: 'Dilnoza Karimova',
        subject: 'Informatika',
        grade: '9-A',
        durationMinutes: 10,
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        questions: [
          {
            id: 'cq1',
            question: 'Python tilida ekranga ma\'lumot chiqarish uchun qaysi funksiya ishlatiladi?',
            options: ['echo()', 'System.out.println()', 'print()', 'console.log()'],
            correctIndex: 2
          },
          {
            id: 'cq2',
            question: 'Quyidagilardan qaysi biri o\'zgarmas (immutable) ma\'lumot turi hisoblanadi?',
            options: ['list', 'tuple', 'dict', 'set'],
            correctIndex: 1
          },
          {
            id: 'cq3',
            question: 'len("Salom Dunyo") ifodasi qanday natija qaytaradi?',
            options: ['10', '11', '12', '9'],
            correctIndex: 1
          },
          {
            id: 'cq4',
            question: 'Python-da bir qatorda izoh (comment) qoldirish uchun qaysi belgi ishlatiladi?',
            options: ['//', '/*', '#', '<!--'],
            correctIndex: 2
          }
        ]
      }
    ],
    results: [
      {
        id: 'res-1',
        testId: 't-math-1',
        testTitle: 'Kvadrat tenglamalar va funksiyalar',
        studentId: 'u-student-1',
        studentName: 'Jasur Aliyev',
        grade: '9-A',
        teacherId: 'u-teacher-1',
        subject: 'Matematika',
        totalQuestions: 5,
        correctAnswers: 5,
        scorePercentage: 100,
        answers: [
          { questionId: 'q1', selectedIndex: 0, correctIndex: 0, isCorrect: true },
          { questionId: 'q2', selectedIndex: 2, correctIndex: 2, isCorrect: true },
          { questionId: 'q3', selectedIndex: 1, correctIndex: 1, isCorrect: true },
          { questionId: 'q4', selectedIndex: 1, correctIndex: 1, isCorrect: true },
          { questionId: 'q5', selectedIndex: 0, correctIndex: 0, isCorrect: true }
        ],
        timeSpentSeconds: 240,
        submittedAt: new Date(Date.now() - 86400000 * 1.5).toISOString()
      },
      {
        id: 'res-2',
        testId: 't-math-1',
        testTitle: 'Kvadrat tenglamalar va funksiyalar',
        studentId: 'u-student-2',
        studentName: 'Madina Rustamova',
        grade: '9-A',
        teacherId: 'u-teacher-1',
        subject: 'Matematika',
        totalQuestions: 5,
        correctAnswers: 4,
        scorePercentage: 80,
        answers: [
          { questionId: 'q1', selectedIndex: 0, correctIndex: 0, isCorrect: true },
          { questionId: 'q2', selectedIndex: 2, correctIndex: 2, isCorrect: true },
          { questionId: 'q3', selectedIndex: 1, correctIndex: 1, isCorrect: true },
          { questionId: 'q4', selectedIndex: 2, correctIndex: 1, isCorrect: false },
          { questionId: 'q5', selectedIndex: 0, correctIndex: 0, isCorrect: true }
        ],
        timeSpentSeconds: 310,
        submittedAt: new Date(Date.now() - 86400000 * 1.2).toISOString()
      },
      {
        id: 'res-3',
        testId: 't-math-1',
        testTitle: 'Kvadrat tenglamalar va funksiyalar',
        studentId: 'u-student-3',
        studentName: 'Bobur Saidov',
        grade: '9-A',
        teacherId: 'u-teacher-1',
        subject: 'Matematika',
        totalQuestions: 5,
        correctAnswers: 3,
        scorePercentage: 60,
        answers: [
          { questionId: 'q1', selectedIndex: 0, correctIndex: 0, isCorrect: true },
          { questionId: 'q2', selectedIndex: 1, correctIndex: 2, isCorrect: false },
          { questionId: 'q3', selectedIndex: 1, correctIndex: 1, isCorrect: true },
          { questionId: 'q4', selectedIndex: 0, correctIndex: 1, isCorrect: false },
          { questionId: 'q5', selectedIndex: 0, correctIndex: 0, isCorrect: true }
        ],
        timeSpentSeconds: 410,
        submittedAt: new Date(Date.now() - 86400000 * 1.1).toISOString()
      }
    ]
  };
}

function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    const initial = getInitialData();
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('DB parse error:', e);
    const initial = getInitialData();
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// ---------------- API ROUTES ----------------

// Metadata
app.get('/api/meta', (req, res) => {
  const db = readDB();
  res.json({
    classes: db.classes || [],
    subjects: db.subjects || []
  });
});

// Auth
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Login va parol kiritilishi shart!' });
  }

  const db = readDB();
  const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase().trim() && u.password === password.trim());

  if (!user) {
    return res.status(401).json({ error: 'Login yoki parol noto\'g\'ri!' });
  }

  const { password: _, ...safeUser } = user;
  res.json({ success: true, user: safeUser });
});

// ================= ADMIN APIS =================

// Users list
app.get('/api/admin/users', (req, res) => {
  const db = readDB();
  const safeUsers = db.users.map(({ password, ...u }) => u);
  res.json(safeUsers);
});

// Create User (Teacher or Student)
app.post('/api/admin/users', (req, res) => {
  const { username, password, fullName, role, grade, subject } = req.body;
  if (!username || !password || !fullName || !role) {
    return res.status(400).json({ error: 'Barcha maydonlarni to\'ldiring!' });
  }

  if (role !== 'teacher' && role !== 'student' && role !== 'admin') {
    return res.status(400).json({ error: 'Noto\'g\'ri rol tanlandi!' });
  }

  const db = readDB();
  const existing = db.users.find(u => u.username.toLowerCase() === username.toLowerCase().trim());
  if (existing) {
    return res.status(400).json({ error: 'Bu login bilan foydalanuvchi allaqachon mavjud!' });
  }

  const newUser = {
    id: 'u-' + Date.now(),
    username: username.trim(),
    password: password.trim(),
    fullName: fullName.trim(),
    role,
    grade: role === 'student' ? (grade || '9-A') : undefined,
    subject: role === 'teacher' ? (subject || 'Matematika') : undefined,
    createdAt: new Date().toISOString()
  };

  db.users.push(newUser);
  writeDB(db);

  const { password: _, ...safeUser } = newUser;
  res.json({ success: true, user: safeUser });
});

// Update User
app.put('/api/admin/users/:id', (req, res) => {
  const { id } = req.params;
  const { fullName, password, grade, subject } = req.body;
  const db = readDB();
  const userIndex = db.users.findIndex(u => u.id === id);

  if (userIndex === -1) {
    return res.status(404).json({ error: 'Foydalanuvchi topilmadi!' });
  }

  const target = db.users[userIndex];
  if (fullName) target.fullName = fullName.trim();
  if (password && password.trim()) target.password = password.trim();
  if (target.role === 'student' && grade) target.grade = grade;
  if (target.role === 'teacher' && subject) target.subject = subject;

  writeDB(db);
  const { password: _, ...safeUser } = target;
  res.json({ success: true, user: safeUser });
});

// Delete User
app.delete('/api/admin/users/:id', (req, res) => {
  const { id } = req.params;
  const db = readDB();
  const user = db.users.find(u => u.id === id);
  if (!user) {
    return res.status(404).json({ error: 'Foydalanuvchi topilmadi!' });
  }
  if (user.role === 'admin' && user.username === 'admin') {
    return res.status(400).json({ error: 'Bosh adminni o\'chirib bo\'lmaydi!' });
  }

  db.users = db.users.filter(u => u.id !== id);
  writeDB(db);
  res.json({ success: true });
});

// Admin global stats
app.get('/api/admin/stats', (req, res) => {
  const db = readDB();
  const students = db.users.filter(u => u.role === 'student');
  const teachers = db.users.filter(u => u.role === 'teacher');
  const tests = db.tests;
  const results = db.results;

  const totalResults = results.length;
  const avgScore = totalResults > 0
    ? Math.round(results.reduce((sum, r) => sum + r.scorePercentage, 0) / totalResults)
    : 0;

  // Teacher statistics for admin
  const teacherStats = teachers.map(t => {
    const teacherTests = tests.filter(test => test.teacherId === t.id);
    const teacherResults = results.filter(r => r.teacherId === t.id);
    const tAvg = teacherResults.length > 0
      ? Math.round(teacherResults.reduce((s, r) => s + r.scorePercentage, 0) / teacherResults.length)
      : 0;

    return {
      id: t.id,
      fullName: t.fullName,
      subject: t.subject || 'Noma\'lum',
      totalTests: teacherTests.length,
      totalSubmissions: teacherResults.length,
      avgScore: tAvg
    };
  });

  // Grade statistics
  const gradeMap = {};
  students.forEach(s => {
    const g = s.grade || 'Boshqa';
    if (!gradeMap[g]) gradeMap[g] = { grade: g, studentCount: 0, totalTestsPassed: 0, totalScore: 0 };
    gradeMap[g].studentCount++;
  });

  results.forEach(r => {
    const g = r.grade || 'Boshqa';
    if (gradeMap[g]) {
      gradeMap[g].totalTestsPassed++;
      gradeMap[g].totalScore += r.scorePercentage;
    }
  });

  const gradeStats = Object.values(gradeMap).map(g => ({
    grade: g.grade,
    studentCount: g.studentCount,
    totalTestsPassed: g.totalTestsPassed,
    avgScore: g.totalTestsPassed > 0 ? Math.round(g.totalScore / g.totalTestsPassed) : 0
  }));

  res.json({
    totalStudents: students.length,
    totalTeachers: teachers.length,
    totalTests: tests.length,
    totalResults,
    avgScore,
    teacherStats,
    gradeStats
  });
});

// ================= TEACHER APIS =================

// Get teacher tests
app.get('/api/teacher/tests', (req, res) => {
  const teacherId = req.query.teacherId;
  const db = readDB();
  const tests = teacherId ? db.tests.filter(t => t.teacherId === teacherId) : db.tests;
  res.json(tests);
});

// Create new test
app.post('/api/teacher/tests', (req, res) => {
  const { title, description, teacherId, teacherName, subject, grade, durationMinutes, questions } = req.body;
  if (!title || !teacherId || !questions || !questions.length) {
    return res.status(400).json({ error: 'Test nomi va savollar to\'liq kiritilishi kerak!' });
  }

  const db = readDB();
  const newTest = {
    id: 't-' + Date.now(),
    title: title.trim(),
    description: (description || '').trim(),
    teacherId,
    teacherName: teacherName || 'O\'qituvchi',
    subject: subject || 'Umumiy',
    grade: grade || 'Barchasi',
    durationMinutes: Number(durationMinutes) || 15,
    createdAt: new Date().toISOString(),
    questions: questions.map((q, idx) => ({
      id: 'q-' + Date.now() + '-' + idx,
      question: q.question.trim(),
      options: q.options.map(opt => opt.trim()),
      correctIndex: Number(q.correctIndex)
    }))
  };

  db.tests.unshift(newTest);
  writeDB(db);
  res.json({ success: true, test: newTest });
});

// Delete test
app.delete('/api/teacher/tests/:id', (req, res) => {
  const { id } = req.params;
  const db = readDB();
  db.tests = db.tests.filter(t => t.id !== id);
  // Also optionally keep or cleanup results
  writeDB(db);
  res.json({ success: true });
});

// Teacher submissions & performance stats
app.get('/api/teacher/stats', (req, res) => {
  const teacherId = req.query.teacherId;
  if (!teacherId) {
    return res.status(400).json({ error: 'teacherId kiritilmadi' });
  }

  const db = readDB();
  const tests = db.tests.filter(t => t.teacherId === teacherId);
  const results = db.results.filter(r => r.teacherId === teacherId);

  const totalTests = tests.length;
  const totalSubmissions = results.length;
  const avgScore = totalSubmissions > 0
    ? Math.round(results.reduce((s, r) => s + r.scorePercentage, 0) / totalSubmissions)
    : 0;

  // Pass rate (>= 60% score)
  const passedCount = results.filter(r => r.scorePercentage >= 60).length;
  const passRate = totalSubmissions > 0 ? Math.round((passedCount / totalSubmissions) * 100) : 0;

  // Breakdown by test
  const testBreakdown = tests.map(t => {
    const testResults = results.filter(r => r.testId === t.id);
    const tAvg = testResults.length > 0
      ? Math.round(testResults.reduce((s, r) => s + r.scorePercentage, 0) / testResults.length)
      : 0;
    return {
      testId: t.id,
      title: t.title,
      grade: t.grade,
      submissions: testResults.length,
      avgScore: tAvg,
      results: testResults
    };
  });

  res.json({
    totalTests,
    totalSubmissions,
    avgScore,
    passRate,
    testBreakdown,
    recentResults: results.slice(-10).reverse()
  });
});

// ================= STUDENT APIS =================

// Available tests for student's grade
app.get('/api/student/tests', (req, res) => {
  const { grade, studentId } = req.query;
  const db = readDB();

  let tests = db.tests;
  if (grade) {
    tests = tests.filter(t => t.grade === grade || t.grade === 'Barchasi');
  }

  // Add information if student already completed this test
  const studentResults = studentId ? db.results.filter(r => r.studentId === studentId) : [];

  const processed = tests.map(t => {
    const result = studentResults.find(r => r.testId === t.id);
    return {
      id: t.id,
      title: t.title,
      description: t.description,
      teacherName: t.teacherName,
      subject: t.subject,
      grade: t.grade,
      durationMinutes: t.durationMinutes,
      questionCount: t.questions ? t.questions.length : 0,
      createdAt: t.createdAt,
      completed: !!result,
      userScore: result ? result.scorePercentage : null,
      userCorrect: result ? result.correctAnswers : null
    };
  });

  res.json(processed);
});

// Get test details for taking the test (DO NOT send correctIndex to student!)
app.get('/api/student/tests/:id', (req, res) => {
  const { id } = req.params;
  const db = readDB();
  const test = db.tests.find(t => t.id === id);
  if (!test) {
    return res.status(404).json({ error: 'Test topilmadi!' });
  }

  // Strip correctIndex for security
  const safeQuestions = test.questions.map(q => ({
    id: q.id,
    question: q.question,
    options: q.options
  }));

  res.json({
    id: test.id,
    title: test.title,
    description: test.description,
    subject: test.subject,
    grade: test.grade,
    durationMinutes: test.durationMinutes,
    teacherName: test.teacherName,
    questions: safeQuestions
  });
});

// Submit test answers
app.post('/api/student/tests/:id/submit', (req, res) => {
  const { id } = req.params;
  const { studentId, answers, timeSpentSeconds } = req.body;

  if (!studentId || !answers) {
    return res.status(400).json({ error: 'studentId va javoblar majburiy!' });
  }

  const db = readDB();
  const test = db.tests.find(t => t.id === id);
  if (!test) {
    return res.status(404).json({ error: 'Test topilmadi!' });
  }

  const student = db.users.find(u => u.id === studentId);
  if (!student) {
    return res.status(404).json({ error: 'O\'quvchi topilmadi!' });
  }

  // Calculate score
  let correctCount = 0;
  const detailedAnswers = test.questions.map((q, idx) => {
    const selected = answers[q.id] !== undefined ? Number(answers[q.id]) : -1;
    const isCorrect = selected === q.correctIndex;
    if (isCorrect) correctCount++;
    return {
      questionId: q.id,
      questionText: q.question,
      options: q.options,
      selectedIndex: selected,
      correctIndex: q.correctIndex,
      isCorrect
    };
  });

  const totalQuestions = test.questions.length;
  const scorePercentage = Math.round((correctCount / totalQuestions) * 100);

  // Check if result already exists (replace or add new)
  const existingIdx = db.results.findIndex(r => r.testId === id && r.studentId === studentId);
  const resultRecord = {
    id: existingIdx >= 0 ? db.results[existingIdx].id : 'res-' + Date.now(),
    testId: test.id,
    testTitle: test.title,
    studentId: student.id,
    studentName: student.fullName,
    grade: student.grade || '9-A',
    teacherId: test.teacherId,
    subject: test.subject,
    totalQuestions,
    correctAnswers: correctCount,
    scorePercentage,
    answers: detailedAnswers,
    timeSpentSeconds: timeSpentSeconds || 0,
    submittedAt: new Date().toISOString()
  };

  if (existingIdx >= 0) {
    db.results[existingIdx] = resultRecord;
  } else {
    db.results.push(resultRecord);
  }

  writeDB(db);

  res.json({
    success: true,
    result: resultRecord
  });
});

// Student's completed test results
app.get('/api/student/results', (req, res) => {
  const { studentId } = req.query;
  if (!studentId) {
    return res.status(400).json({ error: 'studentId kiritilmadi' });
  }

  const db = readDB();
  const results = db.results.filter(r => r.studentId === studentId).reverse();
  res.json(results);
});

// Class Leaderboard (Sinf reytingi)
app.get('/api/student/leaderboard', (req, res) => {
  const { grade } = req.query;
  if (!grade) {
    return res.status(400).json({ error: 'Sinf belgilanmadi (grade parametr talab qilinadi)' });
  }

  const db = readDB();
  const classmates = db.users.filter(u => u.role === 'student' && u.grade === grade);

  const leaderboard = classmates.map(student => {
    const studentResults = db.results.filter(r => r.studentId === student.id);
    const testsCount = studentResults.length;
    const totalScore = studentResults.reduce((sum, r) => sum + r.scorePercentage, 0);
    const avgScore = testsCount > 0 ? Math.round(totalScore / testsCount) : 0;
    const totalCorrect = studentResults.reduce((sum, r) => sum + r.correctAnswers, 0);

    return {
      studentId: student.id,
      fullName: student.fullName,
      username: student.username,
      grade: student.grade,
      testsCompleted: testsCount,
      totalScore,
      avgScore,
      totalCorrect
    };
  });

  // Sort descending: by totalScore, then avgScore, then totalCorrect
  leaderboard.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (b.avgScore !== a.avgScore) return b.avgScore - a.avgScore;
    return b.totalCorrect - a.totalCorrect;
  });

  // Assign ranks
  const ranked = leaderboard.map((item, index) => ({
    rank: index + 1,
    ...item
  }));

  res.json({
    grade,
    leaderboard: ranked
  });
});

// Fallback to index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server muvaffaqiyatli ishga tushdi: http://localhost:${PORT}`);
});
