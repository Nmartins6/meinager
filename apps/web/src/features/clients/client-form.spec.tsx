import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ClientForm } from './client-form';

describe('ClientForm', () => {
  it('rejects nonempty document and phone without digits and focuses the first error', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <ClientForm
        submitLabel="Salvar"
        pendingLabel="Salvando"
        isPending={false}
        onSubmit={onSubmit}
        onCancel={() => {}}
      />,
    );
    await user.type(screen.getByLabelText('Nome'), 'Cliente fictício');
    await user.type(screen.getByLabelText('CPF ou CNPJ'), 'abc');
    await user.type(screen.getByLabelText('Telefone ou WhatsApp'), 'abc');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByLabelText('CPF ou CNPJ')).toHaveFocus();
    expect(screen.getByLabelText('CPF ou CNPJ')).toHaveAccessibleDescription(
      'Informe um CPF ou CNPJ com 11 ou 14 dígitos.',
    );
    expect(screen.getByLabelText('Telefone ou WhatsApp')).toHaveAccessibleDescription(
      'Informe um telefone com 10 a 13 dígitos.',
    );
  });
});
