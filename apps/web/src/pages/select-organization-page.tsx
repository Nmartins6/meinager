import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useSessionQuery } from '@/features/auth/use-current-user-query';
import { selectOrganization } from '@/lib/api';

export function SelectOrganizationPage() {
  const current = useSessionQuery();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  if (current.isPending)
    return (
      <main role="status" className="p-8">
        Verificando organizações...
      </main>
    );
  if (current.isError) return <Navigate to="/login" replace />;

  const organizations =
    current.data.organizations ?? (current.data.organization ? [current.data.organization] : []);
  async function choose(id: string) {
    if (pending || queryClient.isMutating() > 0) {
      setError('Aguarde a operação em andamento antes de trocar de organização.');
      return;
    }
    setPending(true);
    setError('');
    try {
      const selected = await selectOrganization(id);
      await queryClient.cancelQueries();
      queryClient.clear();
      const channel = new BroadcastChannel('meinager-org-context');
      channel.postMessage({ organizationId: id, contextVersion: selected.contextVersion });
      channel.close();
      window.location.assign('/app');
    } catch {
      setError('Não foi possível entrar nesta organização. Tente novamente.');
      setPending(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Selecionar organização</h1>
      <p>Escolha explicitamente a organização que deseja acessar.</p>
      {organizations.length === 0 && (
        <p>
          Nenhuma organização ativa disponível. Se recebeu um convite, abra o link e aceite-o
          primeiro.
        </p>
      )}
      {organizations.map((organization) => (
        <Button
          key={organization.id}
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => void choose(organization.id)}
          className="block w-full text-left"
        >
          {organization.name} — {organization.role}
        </Button>
      ))}
      {pending && <p role="status">Trocando organização...</p>}
      {error && <p role="alert">{error}</p>}
      <Link to="/login" className="underline">
        Voltar ao login
      </Link>
    </main>
  );
}
