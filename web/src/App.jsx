import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import LoginPage from './pages/LoginPage';
import MainLayout from './layouts/MainLayout';
import ProjectsPage from './pages/ProjectsPage';
import CodeLibraryPage from './pages/CodeLibraryPage';
import UploadPage from './pages/UploadPage';
import ResultsPage from './pages/ResultsPage';
import TaskListPage from './pages/TaskListPage';
import ClusterTestPage from './pages/ClusterTestPage';
import ClassificationDetailPage from './pages/ClassificationDetailPage';
import SystemPage from './pages/SystemPage';
import AntiCheatingPage from './pages/AntiCheatingPage';
import AntiCheatingResultPage from './pages/AntiCheatingResultPage';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          
          <Route path="/" element={
            <PrivateRoute>
              <MainLayout />
            </PrivateRoute>
          }>
            <Route index element={<Navigate to="/projects" replace />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="coding" element={<TaskListPage />} />
            <Route path="code-library" element={<CodeLibraryPage />} />
            <Route path="anti-cheating" element={<AntiCheatingPage />} />
            <Route path="anti-cheating/results/:taskId" element={<AntiCheatingResultPage />} />
            <Route path="system" element={<SystemPage />} />
            <Route path="coding/analysis/new" element={<UploadPage />} />
            <Route path="coding/analysis/results/:taskId" element={<ResultsPage />} />
            {/* Workshop Routes */}
            <Route path="workshop/cluster-test" element={<ClusterTestPage />} />
            <Route path="*" element={<Navigate to="/projects" replace />} />
          </Route>

          {/* Standalone Pages (no layout) */}
          <Route path="/classification-detail" element={<ClassificationDetailPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
