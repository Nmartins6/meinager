import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AppLayout } from '@/components/layout/app-layout';
import { ProtectedRoute } from '@/features/auth/protected-route';
import { ClientsPage } from '@/pages/clients-page';
import { DashboardPage } from '@/pages/dashboard-page';
import { EditClientPage } from '@/pages/edit-client-page';
import { FinancialAccountsPage } from '@/pages/financial-accounts-page';
import { FinancialCategoriesPage } from '@/pages/financial-categories-page';
import { FinancialPage } from '@/pages/financial-page';
import { HomePage } from '@/pages/home-page';
import { LoginPage } from '@/pages/login-page';
import { NewClientPage } from '@/pages/new-client-page';
import { RegisterPage } from '@/pages/register-page';

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
          <Route path="financeiro/categorias" element={<FinancialCategoriesPage />} />
          <Route path="financeiro/contas" element={<FinancialAccountsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
