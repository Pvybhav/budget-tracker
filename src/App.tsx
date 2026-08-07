import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import ManageCardsPage from './pages/ManageCardsPage';
import ManageExpensesPage from './pages/ManageExpensesPage';
import ManagePaymentsPage from './pages/ManagePaymentsPage';
import ManageCategoriesPage from './pages/ManageCategoriesPage';
import VisualizePage from './pages/VisualizePage';
import ExportPage from './pages/ExportPage';
import AboutPage from './pages/AboutPage';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="cards" element={<ManageCardsPage />} />
          <Route path="categories" element={<ManageCategoriesPage />} />
          <Route path="expenses/monthly" element={<ManageExpensesPage mode="monthly" />} />
          <Route path="expenses/yearly" element={<ManageExpensesPage mode="yearly" />} />
          <Route path="payments" element={<ManagePaymentsPage />} />
          <Route path="visualize" element={<VisualizePage />} />
          <Route path="export" element={<ExportPage />} />
          <Route path="about" element={<AboutPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;
