import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import LogPage from './pages/LogPage/LogPage';
import EntriesPage from './pages/EntriesPage/EntriesPage';
import EntryDetailPage from './pages/EntryDetailPage/EntryDetailPage';
import EntryEditPage from './pages/EntryEditPage/EntryEditPage';
import LibraryPage from './pages/LibraryPage/LibraryPage';
import DocumentDetailPage from './pages/DocumentDetailPage/DocumentDetailPage';
import DocumentEditPage from './pages/DocumentEditPage/DocumentEditPage';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<LogPage />} />
        <Route path="/entries" element={<EntriesPage />} />
        <Route path="/entries/:id" element={<EntryDetailPage />} />
        <Route path="/entries/:id/edit" element={<EntryEditPage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/library/new" element={<DocumentEditPage mode="new" />} />
        <Route path="/library/:id" element={<DocumentDetailPage />} />
        <Route path="/library/:id/edit" element={<DocumentEditPage mode="edit" />} />
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
        <Route path="/open" element={<Navigate to="/entries?tab=open" replace />} />
        <Route path="/review" element={<Navigate to="/entries?tab=review" replace />} />
      </Routes>
    </Layout>
  );
}
