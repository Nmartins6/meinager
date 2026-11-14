import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, Link, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { PricingDraftNavigation } from './pricing-draft-navigation';
import { usePricingDraftBlocker } from './use-pricing-draft-blocker';

function Draft({ name }: { name: string }) {
  const [dirty, setDirty] = useState(false);
  const blocker = usePricingDraftBlocker(dirty);
  return (
    <>
      <button onClick={() => setDirty(!dirty)}>{name}</button>
      {blocker.state === 'blocked' && <button onClick={blocker.reset}>Continuar {name}</button>}
      {blocker.state === 'blocked' && <button onClick={blocker.proceed}>Descartar</button>}
    </>
  );
}

describe('shared pricing draft navigation', () => {
  it('protects either draft, survives another draft saving and presents only one confirmation', async () => {
    const user = userEvent.setup();
    const router = createMemoryRouter([
      {
        path: '/',
        element: (
          <PricingDraftNavigation>
            <Draft name="Configuração" />
            <PricingDraftNavigation>
              <Draft name="Composição" />
            </PricingDraftNavigation>
            <Link to="/next">Sair</Link>
          </PricingDraftNavigation>
        ),
      },
      { path: '/next', element: <p>Destino</p> },
    ]);
    render(<RouterProvider router={router} />);
    await user.click(screen.getByText('Configuração'));
    await user.click(screen.getByText('Composição'));
    await user.click(screen.getByText('Sair'));
    expect(screen.getAllByText('Descartar')).toHaveLength(1);
    await user.click(screen.getByText('Continuar Configuração'));
    await user.click(screen.getByText('Configuração'));
    await user.click(screen.getByText('Sair'));
    expect(screen.getByText('Continuar Composição')).toBeInTheDocument();
    await user.click(screen.getByText('Descartar'));
    expect(screen.getByText('Destino')).toBeInTheDocument();
  });
});
