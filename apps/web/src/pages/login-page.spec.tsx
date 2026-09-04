import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { LoginPage } from './login-page';

describe('LoginPage', () => {
  it('should display validation messages for an empty form', async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
        mutations: {
          retry: false,
        },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Informe um e-mail válido.')).toBeInTheDocument();

    expect(screen.getByText('A senha deve ter pelo menos 8 caracteres.')).toBeInTheDocument();
  });
});
