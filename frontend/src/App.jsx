import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import AuthModal from './components/AuthModal';
import ProfileModal from './components/ProfileModal';
import { resolvePortalMode } from './utils/portalHost';

import LandingPage from './pages/LandingPage';
import AdminPortal from './pages/AdminPortal';
import TeacherPortal from './pages/TeacherPortal';
import StudentPortal from './pages/StudentPortal';
import TutorPortal from './pages/TutorPortal';

function SubdomainRootRedirect() {
  const location = useLocation();
  return <Navigate to={{ pathname: '/', search: location.search }} replace />;
}

export default function App() {
  const portalMode = resolvePortalMode();

  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <div className="dark-theme app-wrapper" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* Top Luxury Diamond Navbar */}
            <Navbar />

            {/* Main Content Area */}
            <main className="container" style={{ flex: 1, paddingTop: '1.5rem' }}>
              {portalMode === 'admin' ? (
                <Routes>
                  <Route path="/" element={<AdminPortal />} />
                  <Route path="*" element={<SubdomainRootRedirect />} />
                </Routes>
              ) : portalMode === 'teacher' ? (
                <Routes>
                  <Route path="/" element={<TeacherPortal />} />
                  <Route path="*" element={<SubdomainRootRedirect />} />
                </Routes>
              ) : portalMode === 'tutor' ? (
                <Routes>
                  <Route path="/" element={<TutorPortal />} />
                  <Route path="*" element={<SubdomainRootRedirect />} />
                </Routes>
              ) : portalMode === 'student' ? (
                <Routes>
                  <Route path="/" element={<StudentPortal />} />
                  <Route path="*" element={<SubdomainRootRedirect />} />
                </Routes>
              ) : (
                <Routes>
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/admin-panel/*" element={<AdminPortal />} />
                  <Route path="/teacher/*" element={<TeacherPortal />} />
                  <Route path="/tutor/*" element={<TutorPortal />} />
                  <Route path="/student/*" element={<StudentPortal />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              )}
            </main>

            {/* Clean Footer */}
            <Footer />

            {/* Universal Modals */}
            <AuthModal />
            <ProfileModal />
          </div>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
