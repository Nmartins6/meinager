import { NavLink } from 'react-router-dom';

import { cn } from '@/lib/utils';

const items = [
  {
    to: '/app/financeiro',
    label: 'Resumo',
    end: true,
  },
  {
    to: '/app/financeiro/categorias',
    label: 'Categorias',
    end: true,
  },
  {
    to: '/app/financeiro/contas',
    label: 'Contas',
    end: true,
  },
  {
    to: '/app/financeiro/lancamentos',
    label: 'Lançamentos',
    end: false,
  },
  {
    to: '/app/financeiro/orcamentos',
    label: 'Orçamentos',
    end: false,
  },
  {
    to: '/app/financeiro/pedidos',
    label: 'Pedidos',
    end: false,
  },
];

export function FinancialNavigation() {
  return (
    <nav aria-label="Navegação financeira" className="mt-8 flex gap-1 overflow-x-auto border-b">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            cn(
              'border-b-2 px-4 py-3 text-sm font-medium transition-colors',
              isActive
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
