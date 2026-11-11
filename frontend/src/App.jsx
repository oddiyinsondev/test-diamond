import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import AuthModal from './components/AuthModal';
import ProfileModal from './components/ProfileModal';

import LandingPage from './pages/LandingPage';
import AdminPortal from './pages/AdminPortal';
import TeacherPortal from './pages/TeacherPortal';
import StudentPortal from './pages/StudentPortal';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <div className="dark-theme app-wrapper" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* Top Luxury Diamond Navbar */}
            <Navbar />

            {/* Main Content Area */}
            <main className="container" style={{ flex: 1, paddingTop: '1.5rem' }}>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/admin-panel/*" element={<AdminPortal />} />
                <Route path="/teacher/*" element={<TeacherPortal />} />
                <Route path="/student/*" element={<StudentPortal />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
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
