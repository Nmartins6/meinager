import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AppLayout } from '@/components/layout/app-layout';
import { ProtectedRoute } from '@/features/auth/protected-route';

const HomePage = lazy(async () => {
  const module = await import('@/pages/home-page');
  return { default: module.HomePage };
});

const LoginPage = lazy(async () => {
  const module = await import('@/pages/login-page');
  return { default: module.LoginPage };
});

const RegisterPage = lazy(async () => {
  const module = await import('@/pages/register-page');
  return { default: module.RegisterPage };
});

const DashboardPage = lazy(async () => {
  const module = await import('@/pages/dashboard-page');
  return { default: module.DashboardPage };
});

const ClientsPage = lazy(async () => {
  const module = await import('@/pages/clients-page');
  return { default: module.ClientsPage };
});

const NewClientPage = lazy(async () => {
  const module = await import('@/pages/new-client-page');
  return { default: module.NewClientPage };
});

const EditClientPage = lazy(async () => {
  const module = await import('@/pages/edit-client-page');
  return { default: module.EditClientPage };
});

const FinancialPage = lazy(async () => {
  const module = await import('@/pages/financial-page');
  return { default: module.FinancialPage };
});

const FinancialCategoriesPage = lazy(async () => {
  const module = await import('@/pages/financial-categories-page');
  return { default: module.FinancialCategoriesPage };
});

const FinancialAccountsPage = lazy(async () => {
  const module = await import('@/pages/financial-accounts-page');
  return { default: module.FinancialAccountsPage };
});

const FinancialEntriesPage = lazy(async () => {
  const module = await import('@/pages/financial-entries-page');
  return { default: module.FinancialEntriesPage };
});

const NewFinancialEntryPage = lazy(async () => {
  const module = await import('@/pages/new-financial-entry-page');
  return { default: module.NewFinancialEntryPage };
});

const FinancialEntryPage = lazy(async () => {
  const module = await import('@/pages/financial-entry-page');
  return { default: module.FinancialEntryPage };
});

const ProductsPage = lazy(async () => {
  const module = await import('@/pages/products-page');
  return { default: module.ProductsPage };
});

const NewProductPage = lazy(async () => {
  const module = await import('@/pages/new-product-page');
  return { default: module.NewProductPage };
});

interface LazyRouteProps {
  children: ReactNode;
}

function LazyRoute({ children }: LazyRouteProps) {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-64 place-items-center px-6 py-10">
          <p role="status" className="text-sm text-muted-foreground">
            Carregando página...
          </p>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <LazyRoute>
              <HomePage />
            </LazyRoute>
          }
        />

        <Route
          path="/login"
          element={
            <LazyRoute>
              <LoginPage />
            </LazyRoute>
          }
        />

        <Route
          path="/cadastro"
          element={
            <LazyRoute>
              <RegisterPage />
            </LazyRoute>
          }
        />

        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route
            index
            element={
              <LazyRoute>
                <DashboardPage />
              </LazyRoute>
            }
          />

          <Route
            path="clientes"
            element={
              <LazyRoute>
                <ClientsPage />
              </LazyRoute>
            }
          />

          <Route
            path="clientes/novo"
            element={
              <LazyRoute>
                <NewClientPage />
              </LazyRoute>
            }
          />

          <Route
            path="clientes/:clientId"
            element={
              <LazyRoute>
                <EditClientPage />
              </LazyRoute>
            }
          />

          <Route
            path="produtos"
            element={
              <LazyRoute>
                <ProductsPage />
              </LazyRoute>
            }
          />

          <Route
            path="financeiro"
            element={
              <LazyRoute>
                <FinancialPage />
              </LazyRoute>
            }
          />

          <Route
            path="financeiro/categorias"
            element={
              <LazyRoute>
                <FinancialCategoriesPage />
              </LazyRoute>
            }
          />

          <Route
            path="financeiro/contas"
            element={
              <LazyRoute>
                <FinancialAccountsPage />
              </LazyRoute>
            }
          />

          <Route
            path="financeiro/lancamentos"
            element={
              <LazyRoute>
                <FinancialEntriesPage />
              </LazyRoute>
            }
          />

          <Route
            path="financeiro/lancamentos/novo"
            element={
              <LazyRoute>
                <NewFinancialEntryPage />
              </LazyRoute>
            }
          />

          <Route
            path="financeiro/lancamentos/:entryId"
            element={
              <LazyRoute>
                <FinancialEntryPage />
              </LazyRoute>
            }
          />

          <Route
            path="produtos/novo"
            element={
              <LazyRoute>
                <NewProductPage />
              </LazyRoute>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
