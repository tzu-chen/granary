import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import LogPage from './pages/LogPage/LogPage';
import ReviewPage from './pages/ReviewPage/ReviewPage';
import DashboardPage from './pages/DashboardPage/DashboardPage';
import EntryDetailPage from './pages/EntryDetailPage/EntryDetailPage';
import EntryEditPage from './pages/EntryEditPage/EntryEditPage';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<LogPage />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/entries/:id" element={<EntryDetailPage />} />
        <Route path="/entries/:id/edit" element={<EntryEditPage />} />
      </Routes>
    </Layout>
  );
}
