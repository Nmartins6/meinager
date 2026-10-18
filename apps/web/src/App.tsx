import { lazy, Suspense, type ReactNode } from 'react';
import {
  createBrowserRouter,
  createRoutesFromElements,
  Navigate,
  Route,
  RouterProvider,
} from 'react-router-dom';

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

const ProductPage = lazy(async () => {
  const module = await import('@/pages/product-page');
  return { default: module.ProductPage };
});

const ProductPricingPage = lazy(async () => {
  const module = await import('@/pages/product-pricing-page');
  return { default: module.ProductPricingPage };
});

const PricingFoundationPage = lazy(async () => {
  const module = await import('@/pages/pricing-foundation-page');
  return { default: module.PricingFoundationPage };
});

const PricingConfigurationPage = lazy(async () => {
  const module = await import('@/pages/pricing-configuration-page');
  return { default: module.PricingConfigurationPage };
});

const QuotesPage = lazy(async () => {
  const module = await import('@/pages/quotes-page');
  return { default: module.QuotesPage };
});

const NewQuotePage = lazy(async () => {
  const module = await import('@/pages/new-quote-page');
  return { default: module.NewQuotePage };
});

const QuotePage = lazy(async () => {
  const module = await import('@/pages/quote-page');
  return { default: module.QuotePage };
});

const EditQuotePage = lazy(async () => {
  const module = await import('@/pages/edit-quote-page');
  return { default: module.EditQuotePage };
});

const OrdersPage = lazy(async () => {
  const module = await import('@/pages/orders-page');
  return { default: module.OrdersPage };
});

const OrderPage = lazy(async () => {
  const module = await import('@/pages/order-page');
  return { default: module.OrderPage };
});

const OrderWorkflowsPage = lazy(async () => {
  const module = await import('@/pages/order-workflows-page');
  return { default: module.OrderWorkflowsPage };
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

const router = createBrowserRouter(
  createRoutesFromElements(
    <>
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

        <Route
          path="produtos/:productId"
          element={
            <LazyRoute>
              <ProductPage />
            </LazyRoute>
          }
        />

        <Route
          path="produtos/:productId/precificacao"
          element={
            <LazyRoute>
              <ProductPricingPage />
            </LazyRoute>
          }
        />

        <Route
          path="produtos/precificacao/configuracao"
          element={
            <LazyRoute>
              <PricingConfigurationPage />
            </LazyRoute>
          }
        />

        <Route
          path="produtos/precificacao/perfis"
          element={
            <LazyRoute>
              <PricingFoundationPage title="Perfis de venda" />
            </LazyRoute>
          }
        />

        <Route
          path="produtos/precificacao/perfis/:profileId"
          element={
            <LazyRoute>
              <PricingFoundationPage title="Perfil de venda" />
            </LazyRoute>
          }
        />

        <Route
          path="financeiro/orcamentos"
          element={
            <LazyRoute>
              <QuotesPage />
            </LazyRoute>
          }
        />

        <Route
          path="financeiro/orcamentos/novo"
          element={
            <LazyRoute>
              <NewQuotePage />
            </LazyRoute>
          }
        />

        <Route
          path="financeiro/orcamentos/:quoteId"
          element={
            <LazyRoute>
              <QuotePage />
            </LazyRoute>
          }
        />

        <Route
          path="financeiro/orcamentos/:quoteId/editar"
          element={
            <LazyRoute>
              <EditQuotePage />
            </LazyRoute>
          }
        />

        <Route
          path="financeiro/pedidos"
          element={
            <LazyRoute>
              <OrdersPage />
            </LazyRoute>
          }
        />

        <Route
          path="financeiro/pedidos/fluxos"
          element={
            <LazyRoute>
              <OrderWorkflowsPage />
            </LazyRoute>
          }
        />

        <Route
          path="financeiro/pedidos/:orderId"
          element={
            <LazyRoute>
              <OrderPage />
            </LazyRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </>,
  ),
);

export function App() {
  return <RouterProvider router={router} />;
}
