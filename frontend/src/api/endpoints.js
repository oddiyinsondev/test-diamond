import { apiClient } from './client.js';

export const api = {
  // --- AUTH & COMMON ---
  auth: {
    login: (username, password, role) =>
      apiClient('/api/auth/login/', {
        method: 'POST',
        body: JSON.stringify({ username, password, role }),
      }),
    logout: () => apiClient('/api/auth/logout/', { method: 'POST' }),
    me: () => apiClient('/api/auth/me/'),
    meta: () => apiClient('/api/meta/'),
    updateProfile: (formData) =>
      apiClient('/api/profile/update/', {
        method: 'POST',
        body: formData,
      }),
  },

  // --- DIAMOND SHOWCASE & CONTACT ---
  diamond: {
    getShowcase: () => apiClient('/api/diamond/showcase/'),
    submitContact: (data) =>
      apiClient('/api/contact/submit/', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  contact: {
    submit: (data) =>
      apiClient('/api/contact/submit/', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  // --- ADMIN PORTAL ---
  admin: {
    getStats: () => apiClient('/api/admin/stats/'),
    getTeachers: () => apiClient('/api/admin/teachers/'),
    createTeacher: (data) =>
      apiClient('/api/admin/teachers/', {
        method: 'POST',
        body: data instanceof FormData ? data : JSON.stringify(data),
      }),
    getStudents: () => apiClient('/api/admin/students/'),
    createStudent: (data) =>
      apiClient('/api/admin/students/', {
        method: 'POST',
        body: data instanceof FormData ? data : JSON.stringify(data),
      }),
    manageUser: (userId, method, data = null) =>
      apiClient(`/api/admin/users/${userId}/`, {
        method: data instanceof FormData ? 'POST' : method,
        body: data ? (data instanceof FormData ? data : JSON.stringify(data)) : undefined,
      }),
    updateUser: (userId, data) =>
      apiClient(`/api/admin/users/${userId}/`, {
        method: data instanceof FormData ? 'POST' : 'PUT',
        body: data instanceof FormData ? data : JSON.stringify(data),
      }),
    deleteUser: (userId) =>
      apiClient(`/api/admin/users/${userId}/`, {
        method: 'DELETE',
      }),
    getClasses: () => apiClient('/api/admin/classes/'),
    createClass: (data) =>
      apiClient('/api/admin/classes/', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updateClass: (classId, data) =>
      apiClient(`/api/admin/classes/${classId}/`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    deleteClass: (classId) =>
      apiClient(`/api/admin/classes/${classId}/`, {
        method: 'DELETE',
      }),
    getContactMessages: () => apiClient('/api/admin/contact-messages/'),
    deleteContactMessage: (id) =>
      apiClient(`/api/admin/contact-messages/?id=${id}`, {
        method: 'DELETE',
      }),
    toggleContactMessage: (id) =>
      apiClient('/api/admin/contact-messages/', {
        method: 'POST',
        body: JSON.stringify({ id, action: 'toggle_contacted' }),
      }),
    markContactMessageRead: (id) =>
      apiClient(`/api/admin/contact-messages/?id=${id}`, {
        method: 'PUT',
      }),
    getSiteSettings: () => apiClient('/api/admin/site-settings/'),
    updateSiteSettings: (data) =>
      apiClient('/api/admin/site-settings/', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    saveTeacherShowcase: (formData) =>
      apiClient('/api/admin/showcase/teachers/', {
        method: 'POST',
        body: formData,
      }),
    saveTalentedStudent: (formData) =>
      apiClient('/api/admin/showcase/talented-students/', {
        method: 'POST',
        body: formData,
      }),
    deleteShowcaseItem: (type, id) =>
      apiClient('/api/admin/showcase/delete/', {
        method: 'POST',
        body: JSON.stringify({ type, id }),
      }),
    awardCoins: (data) =>
      apiClient('/api/coins/award/', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getCoinRankings: (grade = '') =>
      apiClient(`/api/coins/rankings/${grade ? `?grade=${encodeURIComponent(grade)}` : ''}`),
    getTestPermissionSettings: () => apiClient('/api/admin/tests/permission-settings/'),
    updateTestPermissionSettings: (data) =>
      apiClient('/api/admin/tests/permission-settings/', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    setTestPermission: (testId, data = {}) =>
      apiClient(`/api/admin/tests/${testId}/permission/`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  // --- TEACHER PORTAL ---
  teacher: {
    getStats: (teacherId = '') =>
      apiClient(`/api/teacher/stats/?portal=teacher${teacherId ? `&teacherId=${teacherId}` : ''}`),
    getTests: (teacherId = '', grade = '') => {
      const params = new URLSearchParams();
      if (teacherId) params.set('teacherId', teacherId);
      if (grade && grade !== 'all') params.set('grade', grade);
      const qs = params.toString();
      return apiClient(`/api/teacher/tests/${qs ? `?${qs}` : ''}`);
    },
    createTest: (data) =>
      apiClient('/api/teacher/tests/', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    manageTest: (testId, method, data = null) =>
      apiClient(`/api/teacher/tests/${testId}/`, {
        method,
        body: data ? JSON.stringify(data) : undefined,
      }),
    updateTest: (testId, data) =>
      apiClient(`/api/teacher/tests/${testId}/`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    deleteTest: (testId) =>
      apiClient(`/api/teacher/tests/${testId}/`, {
        method: 'DELETE',
      }),
    uploadQuestionImage: (formData) =>
      apiClient('/api/teacher/upload-image/', {
        method: 'POST',
        body: formData,
      }),
    importQuestions: (formData) =>
      apiClient('/api/teacher/import-questions/', {
        method: 'POST',
        body: formData,
      }),
    downloadTemplateUrl: (format = 'word') =>
      `/api/teacher/download-template/?format=${format}`,
    getTestParticipants: (testId, portal = 'teacher') =>
      apiClient(`/api/teacher/tests/${testId}/participants/${portal ? `?portal=${encodeURIComponent(portal)}` : ''}`),
    distributeCoins: (testId, data) =>
      apiClient(`/api/teacher/tests/${testId}/distribute-coins/`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getResultDetail: (resultId) =>
      apiClient(`/api/teacher/results/${resultId}/`),
    getClassStudents: (grade) =>
      apiClient(`/api/teacher/class-students/?grade=${encodeURIComponent(grade)}&portal=teacher`),
    awardCoins: (data) =>
      apiClient('/api/coins/award/', {
        method: 'POST',
        body: JSON.stringify({ ...data, portal: 'teacher' }),
      }),
    getCoinHistory: (teacherId = '', grade = '') =>
      apiClient(
        `/api/teacher/coins/history/?portal=teacher${teacherId ? `&teacherId=${teacherId}` : ''}${
          grade && grade !== 'all' ? `&grade=${encodeURIComponent(grade)}` : ''
        }`
      ),
    editCoinTx: (txId, data) =>
      apiClient(`/api/teacher/coins/${txId}/edit/`, {
        method: 'POST',
        body: JSON.stringify({ ...data, portal: 'teacher' }),
      }),
    deleteCoinTx: (txId) =>
      apiClient(`/api/teacher/coins/${txId}/delete/`, {
        method: 'POST',
      }),
  },

  // --- STUDENT PORTAL ---
  student: {
    getTests: (grade = '') =>
      apiClient(`/api/student/tests/${grade && grade !== 'all' ? `?grade=${encodeURIComponent(grade)}` : ''}`),
    getTestDetail: (testId) => apiClient(`/api/student/tests/${testId}/`),
    submitTest: (testId, answers, timeSpentSeconds = 0) =>
      apiClient(`/api/student/tests/${testId}/submit/`, {
        method: 'POST',
        body: JSON.stringify({ answers, timeSpentSeconds }),
      }),
    getMyResults: () => apiClient('/api/student/results/'),
    getLeaderboard: (grade = '') =>
      apiClient(`/api/student/leaderboard/${grade ? `?grade=${encodeURIComponent(grade)}` : ''}`),
    getAnalytics: () => apiClient('/api/student/analytics/'),
    getCoinHistory: () => apiClient('/api/coins/history/'),
  },
};

