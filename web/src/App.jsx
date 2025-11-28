import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import ProjectsPage from './pages/ProjectsPage';
import CodingPage from './pages/CodingPage';
import CodeLibraryPage from './pages/CodeLibraryPage';
import UploadPage from './pages/UploadPage';
import ResultsPage from './pages/ResultsPage';
import TaskListPage from './pages/TaskListPage';
import ClusterTestPage from './pages/ClusterTestPage';
import ClassificationDetailPage from './pages/ClassificationDetailPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Navigate to="/projects" replace />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="coding" element={<CodingPage />} />
          <Route path="coding/tasks" element={<TaskListPage />} />
          <Route path="code-library" element={<CodeLibraryPage />} />
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
  );
}

export default App;
