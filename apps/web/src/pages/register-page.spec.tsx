import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import { RegisterPage } from './register-page';

describe('RegisterPage', () => {
  it('should display validation messages for required fields', async () => {
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
          <RegisterPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Criar minha conta' }));

    expect(await screen.findByText('Informe seu nome.')).toBeInTheDocument();
    expect(screen.getByText('Informe um e-mail válido.')).toBeInTheDocument();
    expect(screen.getByText('A senha deve ter pelo menos 8 caracteres.')).toBeInTheDocument();
    expect(screen.getByText('Informe o nome da empresa.')).toBeInTheDocument();
  });
});
