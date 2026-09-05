import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { DashboardPage } from '@/pages/dashboard-page';
import { HomePage } from '@/pages/home-page';
import { LoginPage } from '@/pages/login-page';
import { RegisterPage } from '@/pages/register-page';
import { ProtectedRoute } from '@/features/auth/protected-route';
import { AppLayout } from '@/components/layout/app-layout';
import { ClientsPage } from '@/pages/clients-page';
import { NewClientPage } from '@/pages/new-client-page';
import { EditClientPage } from '@/pages/edit-client-page';
import { FinancialPage } from '@/pages/financial-page';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/cadastro" element={<RegisterPage />} />
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="clientes" element={<ClientsPage />} />
          <Route path="clientes/novo" element={<NewClientPage />} />
          <Route path="clientes/:clientId" element={<EditClientPage />} />
          <Route path="financeiro" element={<FinancialPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
