import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import {
  getOrganizationContext,
  getOrganizationContextVersion,
  setOrganizationContext,
} from './lib/api.ts';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

// A fresh document must obtain its context from the authenticated server session.
setOrganizationContext(null);

if (typeof BroadcastChannel !== 'undefined') {
  const organizationChannel = new BroadcastChannel('meinager-org-context');
  organizationChannel.onmessage = (
    event: MessageEvent<{ organizationId: string; contextVersion: number }>,
  ) => {
    if (
      getOrganizationContext() === event.data.organizationId &&
      getOrganizationContextVersion() === event.data.contextVersion
    )
      return;
    // beforeunload keeps an unsaved draft when the user declines navigation.
    // The old tab keeps its old context header, so writes cannot target the new organization.
    window.location.replace('/app');
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
