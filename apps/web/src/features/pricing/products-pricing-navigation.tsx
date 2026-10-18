import { Settings } from 'lucide-react';
import { NavLink } from 'react-router-dom';

import { buttonVariants } from '@/components/ui/button';
import { useCurrentUserQuery } from '@/features/auth/use-current-user-query';
import { cn } from '@/lib/utils';

import { getPricingPermissions } from './pricing-permissions';

export function ProductsPricingNavigation() {
  const currentUserQuery = useCurrentUserQuery();
  const permissions = getPricingPermissions(currentUserQuery.data?.organization.role);

  if (!permissions.viewConfiguration) {
    return null;
  }

  return (
    <nav aria-label="Navegação de precificação" className="mt-5 flex flex-wrap gap-2">
      <NavLink
        to="/app/produtos/precificacao/configuracao"
        className={({ isActive }) =>
          cn(buttonVariants({ variant: isActive ? 'secondary' : 'outline' }))
        }
      >
        <Settings data-icon="inline-start" />
        Configuração de precificação
      </NavLink>
    </nav>
  );
}
