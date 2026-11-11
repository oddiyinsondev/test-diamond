// SmartTest Frontend Application Logic
const app = {
  currentUser: null,
  meta: { classes: [], subjects: [] },
  adminUsersList: [],
  
  // Test Taking State
  currentTakingTest: null,
  takingAnswers: {},
  timerInterval: null,
  remainingSeconds: 0,
  totalTestSeconds: 0,

  async init() {
    await this.fetchMeta();
    this.populateMetaSelects();

    // Check localStorage for saved session
    const savedUser = localStorage.getItem('smarttest_user');
    if (savedUser) {
      try {
        this.currentUser = JSON.parse(savedUser);
        this.setupUserUI();
        this.navigateRoleDashboard();
      } catch (e) {
        localStorage.removeItem('smarttest_user');
        this.showView('login-view');
      }
    } else {
      this.showView('login-view');
    }
  },

  async fetchMeta() {
    try {
      const res = await fetch('/api/meta');
      this.meta = await res.json();
    } catch (e) {
      console.error('Meta fetch error:', e);
      this.meta = {
        classes: ['5-A', '6-A', '7-A', '8-A', '9-A', '9-B', '10-A', '10-B', '11-A', '11-B'],
        subjects: ['Matematika', 'Fizika', 'Informatika', 'Ingliz tili', 'Biologiya', 'Kimyo', 'Tarix', 'Ona tili va Adabiyot']
      };
    }
  },

  populateMetaSelects() {
    // Populate grade & subject dropdowns
    const modalGrade = document.getElementById('modal-user-grade');
    const modalSubject = document.getElementById('modal-user-subject');
    const newTestGrade = document.getElementById('new-test-grade');

    if (modalGrade) {
      modalGrade.innerHTML = this.meta.classes.map(c => `<option value="${c}">${c}</option>`).join('');
    }
    if (modalSubject) {
      modalSubject.innerHTML = this.meta.subjects.map(s => `<option value="${s}">${s}</option>`).join('');
    }
    if (newTestGrade) {
      newTestGrade.innerHTML = `<option value="Barchasi">Barcha sinflar uchun</option>` +
        this.meta.classes.map(c => `<option value="${c}">${c}</option>`).join('');
    }
  },

  // Navigation & Views
  showView(viewId) {
    const views = ['login-view', 'admin-view', 'teacher-view', 'student-view', 'test-runner-view', 'test-result-view'];
    views.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = (id === viewId) ? 'block' : 'none';
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  setupUserUI() {
    const badge = document.getElementById('user-badge');
    const avatar = document.getElementById('nav-avatar');
    const username = document.getElementById('nav-username');
    const roleTag = document.getElementById('nav-role');

    if (!this.currentUser) {
      badge.style.display = 'none';
      return;
    }

    badge.style.display = 'flex';
    avatar.textContent = (this.currentUser.fullName || this.currentUser.username).charAt(0).toUpperCase();
    username.textContent = this.currentUser.fullName;

    let roleName = '';
    let roleClass = '';
    if (this.currentUser.role === 'admin') {
      roleName = 'Admin';
      roleClass = 'role-admin';
    } else if (this.currentUser.role === 'teacher') {
      roleName = `O'qituvchi (${this.currentUser.subject || 'Fan'})`;
      roleClass = 'role-teacher';
    } else {
      roleName = `O'quvchi (${this.currentUser.grade || 'Sinf'})`;
      roleClass = 'role-student';
    }

    roleTag.textContent = roleName;
    roleTag.className = 'user-role-tag ' + roleClass;
  },

  navigateHome() {
    if (!this.currentUser) {
      this.showView('login-view');
      return;
    }
    this.navigateRoleDashboard();
  },

  navigateRoleDashboard() {
    if (!this.currentUser) return;
    if (this.currentUser.role === 'admin') {
      this.showView('admin-view');
      this.loadAdminData();
    } else if (this.currentUser.role === 'teacher') {
      this.showView('teacher-view');
      document.getElementById('teacher-greeting').textContent = `👨‍🏫 ${this.currentUser.fullName}`;
      this.loadTeacherDashboard();
    } else if (this.currentUser.role === 'student') {
      this.showView('student-view');
      document.getElementById('student-greeting').textContent = `🎓 Xush kelibsiz, ${this.currentUser.fullName}!`;
      document.getElementById('student-grade-badge').textContent = this.currentUser.grade || '9-A';
      document.getElementById('leaderboard-title').textContent = `${this.currentUser.grade || '9-A'} Sinf Reyting Jadvali`;
      this.loadStudentDashboard();
    }
  },

  // Auth
  async handleLogin(event) {
    event.preventDefault();
    const errorEl = document.getElementById('login-error');
    errorEl.style.display = 'none';

    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (!res.ok) {
        errorEl.textContent = data.error || 'Kirishda xatolik!';
        errorEl.style.display = 'block';
        return;
      }

      this.currentUser = data.user;
      localStorage.setItem('smarttest_user', JSON.stringify(data.user));
      this.setupUserUI();
      this.navigateRoleDashboard();
    } catch (e) {
      console.error(e);
      errorEl.textContent = 'Server bilan bog\'lanishda xatolik yuz berdi!';
      errorEl.style.display = 'block';
    }
  },

  quickLogin(username, password) {
    document.getElementById('login-username').value = username;
    document.getElementById('login-password').value = password;
    document.getElementById('login-form').dispatchEvent(new Event('submit'));
  },

  logout() {
    this.currentUser = null;
    localStorage.removeItem('smarttest_user');
    this.setupUserUI();
    this.showView('login-view');
  },

  // ================= ADMIN FUNCTIONS =================
  async loadAdminData() {
    await Promise.all([this.loadAdminUsers(), this.loadAdminStats()]);
  },

  async loadAdminUsers() {
    try {
      const res = await fetch('/api/admin/users');
      this.adminUsersList = await res.json();
      this.renderAdminUsers();
    } catch (e) {
      console.error(e);
    }
  },

  renderAdminUsers() {
    const tbody = document.getElementById('admin-users-table-body');
    const filter = document.getElementById('admin-user-filter').value;

    let users = this.adminUsersList;
    if (filter !== 'all') {
      users = users.filter(u => u.role === filter);
    }

    if (!users.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color: var(--text-muted);">Foydalanuvchilar topilmadi.</td></tr>`;
      return;
    }

    tbody.innerHTML = users.map(u => {
      let roleBadge = '';
      let detail = '-';
      if (u.role === 'admin') {
        roleBadge = '<span class="badge badge-warning">Admin</span>';
      } else if (u.role === 'teacher') {
        roleBadge = '<span class="badge badge-primary">O\'qituvchi</span>';
        detail = `<i class="fa-solid fa-book" style="color:var(--primary); margin-right:4px;"></i> ${u.subject || 'Fan biriktirilmagan'}`;
      } else {
        roleBadge = '<span class="badge badge-success">O\'quvchi</span>';
        detail = `<i class="fa-solid fa-graduation-cap" style="color:var(--success); margin-right:4px;"></i> ${u.grade || 'Sinf biriktirilmagan'}`;
      }

      const dateStr = u.createdAt ? new Date(u.createdAt).toLocaleDateString('uz-UZ') : '-';

      return `
        <tr>
          <td><strong>${u.fullName}</strong></td>
          <td><code style="background:var(--gray-100); padding: 2px 6px; border-radius: 4px;">${u.username}</code></td>
          <td>${roleBadge}</td>
          <td>${detail}</td>
          <td>${dateStr}</td>
          <td style="text-align: right;">
            ${u.username !== 'admin' ? `
              <button class="btn btn-danger btn-sm" onclick="app.deleteUser('${u.id}', '${u.fullName}')" title="O'chirish">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            ` : '<span style="color:var(--text-muted); font-size:0.8rem;">Bosh Admin</span>'}
          </td>
        </tr>
      `;
    }).join('');
  },

  async loadAdminStats() {
    try {
      const res = await fetch('/api/admin/stats');
      const data = await res.json();

      document.getElementById('adm-students-count').textContent = data.totalStudents;
      document.getElementById('adm-teachers-count').textContent = data.totalTeachers;
      document.getElementById('adm-tests-count').textContent = data.totalTests;
      document.getElementById('adm-avg-score').textContent = `${data.avgScore}%`;

      // Render Teachers Performance Stats
      const tBody = document.getElementById('admin-teachers-stats-table-body');
      if (data.teacherStats && data.teacherStats.length) {
        tBody.innerHTML = data.teacherStats.map(t => {
          let badge = '';
          if (t.avgScore >= 80) badge = '<span class="badge badge-success">A\'lo darajada</span>';
          else if (t.avgScore >= 60) badge = '<span class="badge badge-primary">Yaxshi</span>';
          else if (t.totalSubmissions === 0) badge = '<span class="badge badge-gray">Hali test topshirilmagan</span>';
          else badge = '<span class="badge badge-warning">Qoniqarli</span>';

          return `
            <tr>
              <td><strong>${t.fullName}</strong></td>
              <td>${t.subject}</td>
              <td><span class="badge badge-gray">${t.totalTests} ta</span></td>
              <td>${t.totalSubmissions} nafar</td>
              <td>
                <div style="display:flex; align-items:center; gap: 8px;">
                  <div class="progress-bar-wrapper" style="width: 100px;">
                    <div class="progress-bar-fill" style="width: ${t.avgScore}%;"></div>
                  </div>
                  <strong>${t.avgScore}%</strong>
                </div>
              </td>
              <td>${badge}</td>
            </tr>
          `;
        }).join('');
      } else {
        tBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color: var(--text-muted);">O'qituvchilar ma'lumoti mavjud emas.</td></tr>`;
      }

      // Render Grade Stats
      const gBody = document.getElementById('admin-grades-table-body');
      if (data.gradeStats && data.gradeStats.length) {
        gBody.innerHTML = data.gradeStats.map(g => {
          return `
            <tr>
              <td><strong>${g.grade}</strong></td>
              <td>${g.studentCount} ta o'quvchi</td>
              <td>${g.totalTestsPassed} marta</td>
              <td>
                <div style="display:flex; align-items:center; gap: 8px;">
                  <div class="progress-bar-wrapper" style="width: 100px;">
                    <div class="progress-bar-fill" style="width: ${g.avgScore}%;"></div>
                  </div>
                  <strong>${g.avgScore}%</strong>
                </div>
              </td>
              <td>${g.avgScore >= 70 ? '<span class="badge badge-success">Ijobiy</span>' : '<span class="badge badge-warning">Rivojlanish talab</span>'}</td>
            </tr>
          `;
        }).join('');
      } else {
        gBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted);">Sinflar ma'lumoti yo'q.</td></tr>`;
      }

    } catch (e) {
      console.error(e);
    }
  },

  switchAdminTab(tabName, btn) {
    document.getElementById('admin-tab-users').style.display = (tabName === 'users') ? 'block' : 'none';
    document.getElementById('admin-tab-teachers-stats').style.display = (tabName === 'teachers-stats') ? 'block' : 'none';
    document.getElementById('admin-tab-grades-stats').style.display = (tabName === 'grades-stats') ? 'block' : 'none';

    if (btn) {
      btn.parentElement.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    }
  },

  openNewUserModal() {
    document.getElementById('user-modal-form').reset();
    document.getElementById('edit-user-id').value = '';
    document.getElementById('modal-user-error').style.display = 'none';
    this.handleRoleChangeInModal('student');
    document.getElementById('user-modal').style.display = 'flex';
  },

  closeUserModal() {
    document.getElementById('user-modal').style.display = 'none';
  },

  handleRoleChangeInModal(role) {
    const gradeGroup = document.getElementById('group-modal-grade');
    const subjectGroup = document.getElementById('group-modal-subject');

    if (role === 'student') {
      gradeGroup.style.display = 'block';
      subjectGroup.style.display = 'none';
    } else {
      gradeGroup.style.display = 'none';
      subjectGroup.style.display = 'block';
    }
  },

  async handleSaveUser(e) {
    e.preventDefault();
    const errorEl = document.getElementById('modal-user-error');
    errorEl.style.display = 'none';

    const fullName = document.getElementById('modal-user-fullname').value;
    const username = document.getElementById('modal-user-username').value;
    const password = document.getElementById('modal-user-password').value;
    const role = document.getElementById('modal-user-role').value;
    const grade = document.getElementById('modal-user-grade').value;
    const subject = document.getElementById('modal-user-subject').value;

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, username, password, role, grade, subject })
      });
      const data = await res.json();
      if (!res.ok) {
        errorEl.textContent = data.error || 'Saqlashda xatolik yuz berdi!';
        errorEl.style.display = 'block';
        return;
      }

      this.closeUserModal();
      this.loadAdminData();
      alert('Yangi foydalanuvchi muvaffaqiyatli ro\'yxatdan o\'tkazildi!');
    } catch (err) {
      console.error(err);
      errorEl.textContent = 'Server bilan aloqa uzildi!';
      errorEl.style.display = 'block';
    }
  },

  async deleteUser(id, name) {
    if (!confirm(`Haqiqatan ham "${name}" nomli foydalanuvchini o'chirmoqchimisiz?`)) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      if (res.ok) {
        this.loadAdminData();
      } else {
        const data = await res.json();
        alert(data.error || 'O\'chirishda xatolik!');
      }
    } catch (e) {
      console.error(e);
    }
  },

  // ================= TEACHER FUNCTIONS =================
  async loadTeacherDashboard() {
    this.resetTeacherTestForm();
    await Promise.all([
      this.loadTeacherTests(),
      this.loadTeacherStats()
    ]);
  },

  switchTeacherTab(tabName, btn) {
    document.getElementById('teacher-tab-my-tests').style.display = (tabName === 'my-tests') ? 'block' : 'none';
    document.getElementById('teacher-tab-create').style.display = (tabName === 'create') ? 'block' : 'none';
    document.getElementById('teacher-tab-results').style.display = (tabName === 'results') ? 'block' : 'none';
    document.getElementById('teacher-tab-analytics').style.display = (tabName === 'analytics') ? 'block' : 'none';

    if (btn) {
      btn.parentElement.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    }
  },

  async loadTeacherTests() {
    try {
      const res = await fetch(`/api/teacher/tests?teacherId=${this.currentUser.id}`);
      const tests = await res.json();

      const tbody = document.getElementById('teacher-tests-table-body');
      if (!tests.length) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem; color: var(--text-muted);">Siz hali test yaratmadingiz. Yuqoridagi "Yangi Test Yaratish" tugmasini bosing.</td></tr>`;
        return;
      }

      tbody.innerHTML = tests.map(t => {
        const dateStr = t.createdAt ? new Date(t.createdAt).toLocaleDateString('uz-UZ') : '-';
        return `
          <tr>
            <td><strong>${t.title}</strong><div style="font-size:0.8rem; color:var(--text-muted);">${t.description || ''}</div></td>
            <td><span class="badge badge-primary">${t.grade}</span></td>
            <td>${t.subject}</td>
            <td>${t.questions ? t.questions.length : 0} ta</td>
            <td>${t.durationMinutes} daqiqa</td>
            <td>${dateStr}</td>
            <td style="text-align: right;">
              <button class="btn btn-danger btn-sm" onclick="app.deleteTeacherTest('${t.id}', '${t.title}')" title="O'chirish">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </td>
          </tr>
        `;
      }).join('');
    } catch (e) {
      console.error(e);
    }
  },

  async loadTeacherStats() {
    try {
      const res = await fetch(`/api/teacher/stats?teacherId=${this.currentUser.id}`);
      const data = await res.json();

      document.getElementById('tch-total-tests').textContent = data.totalTests;
      document.getElementById('tch-total-submissions').textContent = data.totalSubmissions;
      document.getElementById('tch-avg-score').textContent = `${data.avgScore}%`;
      document.getElementById('tch-pass-rate').textContent = `${data.passRate}%`;

      // Render Submissions Log
      const rBody = document.getElementById('teacher-results-table-body');
      if (data.recentResults && data.recentResults.length) {
        rBody.innerHTML = data.recentResults.map(r => {
          const dateStr = r.submittedAt ? new Date(r.submittedAt).toLocaleString('uz-UZ') : '-';
          const mins = Math.floor(r.timeSpentSeconds / 60);
          const secs = r.timeSpentSeconds % 60;
          return `
            <tr>
              <td><strong>${r.studentName}</strong></td>
              <td><span class="badge badge-primary">${r.grade}</span></td>
              <td>${r.testTitle}</td>
              <td><strong>${r.correctAnswers}</strong> / ${r.totalQuestions}</td>
              <td>
                <span class="badge ${r.scorePercentage >= 80 ? 'badge-success' : (r.scorePercentage >= 60 ? 'badge-primary' : 'badge-warning')}">
                  ${r.scorePercentage}%
                </span>
              </td>
              <td>${mins}m ${secs}s</td>
              <td>${dateStr}</td>
            </tr>
          `;
        }).join('');
      } else {
        rBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem; color: var(--text-muted);">Hozircha o'quvchilar ushbu testlarni topshirmagan.</td></tr>`;
      }

      // Render Analytics by Test
      const aBody = document.getElementById('teacher-analytics-table-body');
      if (data.testBreakdown && data.testBreakdown.length) {
        aBody.innerHTML = data.testBreakdown.map(tb => {
          return `
            <tr>
              <td><strong>${tb.title}</strong></td>
              <td><span class="badge badge-primary">${tb.grade}</span></td>
              <td>${tb.submissions} nafar o'quvchi</td>
              <td><strong>${tb.avgScore}%</strong></td>
              <td>
                <div style="display:flex; align-items:center; gap: 8px;">
                  <div class="progress-bar-wrapper" style="width: 140px;">
                    <div class="progress-bar-fill" style="width: ${tb.avgScore}%;"></div>
                  </div>
                  <span>${tb.avgScore >= 60 ? '✅ Yaxshi' : '⚠️ Past'}</span>
                </div>
              </td>
            </tr>
          `;
        }).join('');
      } else {
        aBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted);">Tahlil qilish uchun testlar yetarli emas.</td></tr>`;
      }

    } catch (e) {
      console.error(e);
    }
  },

  async deleteTeacherTest(id, title) {
    if (!confirm(`"${title}" testini o'chirmoqchimisiz?`)) return;
    try {
      await fetch(`/api/teacher/tests/${id}`, { method: 'DELETE' });
      this.loadTeacherTests();
      this.loadTeacherStats();
    } catch (e) {
      console.error(e);
    }
  },

  resetTeacherTestForm() {
    document.getElementById('create-test-form').reset();
    const container = document.getElementById('form-questions-list');
    container.innerHTML = '';
    // Add 2 questions by default
    this.addQuestionToForm();
    this.addQuestionToForm();
  },

  addQuestionToForm() {
    const container = document.getElementById('form-questions-list');
    const index = container.children.length + 1;
    const qDiv = document.createElement('div');
    qDiv.className = 'panel';
    qDiv.style.background = '#f8fafc';
    qDiv.style.border = '1px solid var(--gray-200)';
    qDiv.style.padding = '1.25rem';
    qDiv.dataset.questionIndex = index;

    qDiv.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
        <span style="font-weight: 700; color: var(--primary);">#${index} - Savol</span>
        <button type="button" class="btn btn-danger btn-sm" onclick="this.closest('.panel').remove(); app.reindexTestQuestions();">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
      <div class="form-group">
        <input type="text" class="form-input q-text" placeholder="Savol matnini kiriting..." required>
      </div>
      <div style="font-size: 0.82rem; font-weight: 700; color: var(--gray-600); margin-bottom: 6px;">
        4 ta variant (To'g'ri javobni dumaloq belgi bilan tanlang):
      </div>
      <div style="display: grid; grid-template-columns: 1fr; gap: 8px;">
        ${[0, 1, 2, 3].map(optIdx => `
          <div style="display: flex; align-items: center; gap: 10px;">
            <input type="radio" name="correct-radio-${index}" value="${optIdx}" ${optIdx === 0 ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--primary);">
            <input type="text" class="form-input q-opt-${optIdx}" placeholder="${String.fromCharCode(65 + optIdx)} varianti..." required style="padding: 8px 12px;">
          </div>
        `).join('')}
      </div>
    `;
    container.appendChild(qDiv);
  },

  reindexTestQuestions() {
    const items = document.querySelectorAll('#form-questions-list > div');
    items.forEach((item, idx) => {
      const num = idx + 1;
      const titleSpan = item.querySelector('span');
      if (titleSpan) titleSpan.textContent = `#${num} - Savol`;
      const radios = item.querySelectorAll('input[type="radio"]');
      radios.forEach(r => r.name = `correct-radio-${num}`);
    });
  },

  async handleCreateTest(e) {
    e.preventDefault();
    const title = document.getElementById('new-test-title').value;
    const grade = document.getElementById('new-test-grade').value;
    const durationMinutes = Number(document.getElementById('new-test-duration').value) || 15;
    const description = document.getElementById('new-test-desc').value;

    const qBlocks = document.querySelectorAll('#form-questions-list > div');
    if (!qBlocks.length) {
      alert('Kamida bitta savol qo\'shing!');
      return;
    }

    const questions = [];
    for (let block of qBlocks) {
      const qText = block.querySelector('.q-text').value;
      const opt0 = block.querySelector('.q-opt-0').value;
      const opt1 = block.querySelector('.q-opt-1').value;
      const opt2 = block.querySelector('.q-opt-2').value;
      const opt3 = block.querySelector('.q-opt-3').value;
      const checkedRadio = block.querySelector('input[type="radio"]:checked');
      const correctIndex = checkedRadio ? Number(checkedRadio.value) : 0;

      questions.push({
        question: qText,
        options: [opt0, opt1, opt2, opt3],
        correctIndex
      });
    }

    try {
      const res = await fetch('/api/teacher/tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          teacherId: this.currentUser.id,
          teacherName: this.currentUser.fullName,
          subject: this.currentUser.subject || 'Umumiy Fan',
          grade,
          durationMinutes,
          questions
        })
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Test saqlashda xatolik!');
        return;
      }

      alert('Yangi test muvaffaqiyatli chop etildi!');
      this.resetTeacherTestForm();
      this.switchTeacherTab('my-tests');
      this.loadTeacherTests();
      this.loadTeacherStats();
    } catch (err) {
      console.error(err);
      alert('Server bilan xatolik yuz berdi!');
    }
  },

  // ================= STUDENT FUNCTIONS =================
  async loadStudentDashboard() {
    await Promise.all([
      this.loadStudentTests(),
      this.loadStudentLeaderboard(),
      this.loadStudentResults()
    ]);
  },

  switchStudentTab(tabName, btn) {
    document.getElementById('student-tab-tests').style.display = (tabName === 'tests') ? 'block' : 'none';
    document.getElementById('student-tab-leaderboard').style.display = (tabName === 'leaderboard') ? 'block' : 'none';
    document.getElementById('student-tab-my-results').style.display = (tabName === 'my-results') ? 'block' : 'none';

    if (btn) {
      btn.parentElement.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    }
  },

  async loadStudentTests() {
    try {
      const res = await fetch(`/api/student/tests?grade=${encodeURIComponent(this.currentUser.grade || '9-A')}&studentId=${this.currentUser.id}`);
      const tests = await res.json();

      const grid = document.getElementById('student-tests-grid');
      if (!tests.length) {
        grid.innerHTML = `<div class="panel" style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 3rem;">Sizning sinfingiz uchun hozircha testlar mavjud emas.</div>`;
        return;
      }

      grid.innerHTML = tests.map(t => {
        const isCompleted = t.completed;
        return `
          <div class="test-card">
            <div class="test-card-top">
              <div class="test-badges">
                <span class="badge badge-primary"><i class="fa-solid fa-book" style="margin-right: 4px;"></i>${t.subject}</span>
                <span class="badge badge-gray"><i class="fa-solid fa-users" style="margin-right: 4px;"></i>${t.grade}</span>
                ${isCompleted ? `<span class="badge badge-success"><i class="fa-solid fa-check" style="margin-right: 4px;"></i>Topshirilgan: ${t.userScore}%</span>` : ''}
              </div>
              <h3 class="test-card-title">${t.title}</h3>
              <p class="test-card-desc">${t.description || 'Test haqida batafsil ma\'lumot berilmagan.'}</p>
              <div class="test-meta">
                <span><i class="fa-solid fa-user-tie"></i> ${t.teacherName}</span>
                <span><i class="fa-solid fa-circle-question"></i> ${t.questionCount} ta savol</span>
                <span><i class="fa-regular fa-clock"></i> ${t.durationMinutes} daq</span>
              </div>
            </div>
            <div class="test-card-footer">
              ${isCompleted ? `
                <div style="font-size: 0.85rem; color: var(--success); font-weight: 700;">
                  <i class="fa-solid fa-circle-check"></i> Ball: ${t.userCorrect}/${t.questionCount} (${t.userScore}%)
                </div>
                <button class="btn btn-outline btn-sm" onclick="app.startTest('${t.id}')">
                  <i class="fa-solid fa-rotate-right"></i> Qayta topshirish
                </button>
              ` : `
                <span style="font-size: 0.85rem; color: var(--text-muted);">Topshirilmagan</span>
                <button class="btn btn-primary btn-sm" onclick="app.startTest('${t.id}')">
                  <i class="fa-solid fa-play"></i> Testni Boshlash
                </button>
              `}
            </div>
          </div>
        `;
      }).join('');
    } catch (e) {
      console.error(e);
    }
  },

  async loadStudentLeaderboard() {
    try {
      const grade = this.currentUser.grade || '9-A';
      const res = await fetch(`/api/student/leaderboard?grade=${encodeURIComponent(grade)}`);
      const data = await res.json();

      const tbody = document.getElementById('student-leaderboard-table-body');
      if (!data.leaderboard || !data.leaderboard.length) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color: var(--text-muted);">Sinf o'quvchilari topilmadi.</td></tr>`;
        return;
      }

      tbody.innerHTML = data.leaderboard.map(item => {
        const isMe = item.studentId === this.currentUser.id;
        let rankBadge = '';
        if (item.rank === 1) rankBadge = '<span class="rank-badge rank-1" title="1-o\'rin (Oltin)">🥇 1</span>';
        else if (item.rank === 2) rankBadge = '<span class="rank-badge rank-2" title="2-o\'rin (Kumush)">🥈 2</span>';
        else if (item.rank === 3) rankBadge = '<span class="rank-badge rank-3" title="3-o\'rin (Bronza)">🥉 3</span>';
        else rankBadge = `<span class="rank-badge rank-other">${item.rank}</span>`;

        return `
          <tr class="${isMe ? 'highlight-row' : ''}">
            <td>${rankBadge}</td>
            <td>
              <strong>${item.fullName}</strong>
              ${isMe ? ' <span class="badge badge-primary" style="font-size:0.75rem;">Siz</span>' : ''}
              <div style="font-size:0.75rem; color:var(--text-muted);">@${item.username}</div>
            </td>
            <td>${item.testsCompleted} ta test</td>
            <td><strong>${item.totalCorrect}</strong> ta to'g'ri</td>
            <td>${item.avgScore}%</td>
            <td><strong style="color:var(--primary); font-size: 1.05rem;">${item.totalScore} ball</strong></td>
          </tr>
        `;
      }).join('');
    } catch (e) {
      console.error(e);
    }
  },

  async loadStudentResults() {
    try {
      const res = await fetch(`/api/student/results?studentId=${this.currentUser.id}`);
      const results = await res.json();

      const tbody = document.getElementById('student-results-table-body');
      if (!results.length) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color: var(--text-muted);">Siz hali birorta ham test topshirmadingiz.</td></tr>`;
        return;
      }

      tbody.innerHTML = results.map(r => {
        const dateStr = r.submittedAt ? new Date(r.submittedAt).toLocaleString('uz-UZ') : '-';
        const mins = Math.floor(r.timeSpentSeconds / 60);
        const secs = r.timeSpentSeconds % 60;
        return `
          <tr>
            <td><strong>${r.testTitle}</strong></td>
            <td><span class="badge badge-primary">${r.subject}</span></td>
            <td><strong>${r.correctAnswers}</strong> / ${r.totalQuestions} ta to'g'ri</td>
            <td>
              <span class="badge ${r.scorePercentage >= 80 ? 'badge-success' : (r.scorePercentage >= 60 ? 'badge-primary' : 'badge-warning')}">
                ${r.scorePercentage}%
              </span>
            </td>
            <td>${mins}m ${secs}s</td>
            <td>${dateStr}</td>
          </tr>
        `;
      }).join('');
    } catch (e) {
      console.error(e);
    }
  },

  // ================= TEST RUNNER (INTERACTIVE) =================
  async startTest(testId) {
    try {
      const res = await fetch(`/api/student/tests/${testId}`);
      if (!res.ok) {
        alert('Testni yuklashda xatolik yuz berdi!');
        return;
      }

      const test = await res.json();
      this.currentTakingTest = test;
      this.takingAnswers = {};

      document.getElementById('runner-test-title').textContent = test.title;
      document.getElementById('runner-test-meta').textContent = `${test.subject} • ${test.questions.length} ta savol • O'qituvchi: ${test.teacherName}`;

      // Setup Timer
      const totalMinutes = test.durationMinutes || 15;
      this.remainingSeconds = totalMinutes * 60;
      this.totalTestSeconds = this.remainingSeconds;
      this.updateTimerDisplay();

      if (this.timerInterval) clearInterval(this.timerInterval);
      this.timerInterval = setInterval(() => {
        this.remainingSeconds--;
        this.updateTimerDisplay();

        if (this.remainingSeconds <= 0) {
          clearInterval(this.timerInterval);
          alert('Vaqt tugadi! Javoblaringiz avtomatik qabul qilinmoqda.');
          this.submitTestTaking();
        }
      }, 1000);

      // Render Questions
      const container = document.getElementById('runner-questions-container');
      container.innerHTML = test.questions.map((q, idx) => {
        return `
          <div class="question-box" id="q-box-${q.id}">
            <div class="question-number">Savol #${idx + 1} / ${test.questions.length}</div>
            <div class="question-text">${q.question}</div>
            <div class="options-list">
              ${q.options.map((opt, optIdx) => `
                <label class="option-item" id="opt-label-${q.id}-${optIdx}" onclick="app.selectOption('${q.id}', ${optIdx})">
                  <input type="radio" name="opt-radio-${q.id}" class="option-radio" value="${optIdx}">
                  <span><strong>${String.fromCharCode(65 + optIdx)})</strong> ${opt}</span>
                </label>
              `).join('')}
            </div>
          </div>
        `;
      }).join('');

      this.showView('test-runner-view');
    } catch (e) {
      console.error(e);
      alert('Testni boshlashda xatolik!');
    }
  },

  selectOption(questionId, optIndex) {
    this.takingAnswers[questionId] = optIndex;

    // Update UI selected style
    const container = document.getElementById(`q-box-${questionId}`);
    if (container) {
      container.querySelectorAll('.option-item').forEach(item => item.classList.remove('selected'));
      const activeLabel = document.getElementById(`opt-label-${questionId}-${optIndex}`);
      if (activeLabel) {
        activeLabel.classList.add('selected');
        const radio = activeLabel.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
      }
    }
  },

  updateTimerDisplay() {
    const mins = Math.floor(this.remainingSeconds / 60);
    const secs = this.remainingSeconds % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    const el = document.getElementById('runner-timer');
    if (el) el.textContent = formatted;

    const timerBox = document.getElementById('runner-timer-box');
    if (this.remainingSeconds <= 60 && timerBox) {
      timerBox.classList.add('timer-warning');
    } else if (timerBox) {
      timerBox.classList.remove('timer-warning');
    }
  },

  cancelTestTaking() {
    if (confirm('Testdan chiqmoqchimisiz? Kiritilgan javoblaringiz saqlanmaydi.')) {
      if (this.timerInterval) clearInterval(this.timerInterval);
      this.navigateHome();
    }
  },

  async submitTestTaking() {
    if (!confirm('Testni yakunlashga ishonchingiz komilmi?')) return;

    if (this.timerInterval) clearInterval(this.timerInterval);
    const timeSpentSeconds = this.totalTestSeconds - this.remainingSeconds;

    try {
      const res = await fetch(`/api/student/tests/${this.currentTakingTest.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: this.currentUser.id,
          answers: this.takingAnswers,
          timeSpentSeconds
        })
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Natijani saqlashda xatolik!');
        this.navigateHome();
        return;
      }

      this.renderTestResult(data.result);
    } catch (e) {
      console.error(e);
      alert('Natijani yuborishda server xatosi!');
      this.navigateHome();
    }
  },

  renderTestResult(result) {
    const icon = document.getElementById('result-icon-container');
    const headline = document.getElementById('result-headline');
    const subtext = document.getElementById('result-subtext');

    if (result.scorePercentage >= 80) {
      icon.textContent = '🌟';
      headline.textContent = 'A\'lo Natija!';
      subtext.textContent = `Tabriklaymiz, siz ushbu testdan ajoyib natija ko'rsatdingiz!`;
    } else if (result.scorePercentage >= 60) {
      icon.textContent = '👍';
      headline.textContent = 'Yaxshi Natija!';
      subtext.textContent = `Yaxshi natija, biroq xatolaringiz ustida ishlab ko'rsatkichingizni yanada yaxshilashingiz mumkin.`;
    } else {
      icon.textContent = '💡';
      headline.textContent = 'Qoniqarli';
      subtext.textContent = `Mavzuni yana bir bor takrorlab, qayta urinib ko'rishni tavsiya qilamiz.`;
    }

    document.getElementById('result-correct-ratio').textContent = `${result.correctAnswers} / ${result.totalQuestions}`;
    document.getElementById('result-score-percent').textContent = `${result.scorePercentage}%`;

    const mins = Math.floor(result.timeSpentSeconds / 60);
    const secs = result.timeSpentSeconds % 60;
    document.getElementById('result-time-spent').textContent = `${mins}m ${secs}s`;

    // Render Detailed Question Review
    const reviewContainer = document.getElementById('result-questions-breakdown');
    reviewContainer.innerHTML = result.answers.map((ans, idx) => {
      const isCorrect = ans.isCorrect;
      const selectedText = ans.selectedIndex >= 0 ? ans.options[ans.selectedIndex] : 'Belgilanmagan';
      const correctText = ans.options[ans.correctIndex];

      return `
        <div style="background: ${isCorrect ? '#f0fdf4' : '#fef2f2'}; border: 1.5px solid ${isCorrect ? '#bbf7d0' : '#fecaca'}; border-radius: var(--radius-md); padding: 1.25rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.5rem;">
            <strong style="color: ${isCorrect ? 'var(--success)' : 'var(--danger)'};">
              <i class="fa-solid ${isCorrect ? 'fa-circle-check' : 'fa-circle-xmark'}"></i> #${idx + 1} - Savol: ${isCorrect ? 'To\'g\'ri' : 'Noto\'g\'ri'}
            </strong>
          </div>
          <div style="font-weight: 600; margin-bottom: 0.75rem;">${ans.questionText}</div>
          <div style="font-size: 0.88rem; display: flex; flex-direction: column; gap: 4px;">
            <div>Sizning javobingiz: <strong style="color: ${isCorrect ? 'var(--success)' : 'var(--danger)'};">${selectedText}</strong></div>
            ${!isCorrect ? `<div>To'g'ri javob: <strong style="color: var(--success);">${correctText}</strong></div>` : ''}
          </div>
        </div>
      `;
    }).join('');

    this.showView('test-result-view');
  },

  viewClassLeaderboardFromResults() {
    this.navigateRoleDashboard();
    // Switch to leaderboard tab
    const tabs = document.querySelectorAll('#student-view .tab-btn');
    if (tabs[1]) {
      this.switchStudentTab('leaderboard', tabs[1]);
    }
  }
};

// Initialize app when DOM loads
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
