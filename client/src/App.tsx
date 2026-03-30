import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import LogPage from './pages/LogPage/LogPage';
import EntriesPage from './pages/EntriesPage/EntriesPage';
import EntryDetailPage from './pages/EntryDetailPage/EntryDetailPage';
import EntryEditPage from './pages/EntryEditPage/EntryEditPage';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<LogPage />} />
        <Route path="/entries" element={<EntriesPage />} />
        <Route path="/entries/:id" element={<EntryDetailPage />} />
        <Route path="/entries/:id/edit" element={<EntryEditPage />} />
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
        <Route path="/open" element={<Navigate to="/entries?tab=open" replace />} />
        <Route path="/review" element={<Navigate to="/entries?tab=review" replace />} />
      </Routes>
    </Layout>
  );
}
