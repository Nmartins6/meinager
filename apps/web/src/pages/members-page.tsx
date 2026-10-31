import { Dialog } from '@base-ui/react/dialog';
import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCurrentUserQuery } from '@/features/auth/use-current-user-query';
import {
  createInvitation,
  listInvitations,
  revokeInvitation,
} from '@/features/auth/invitations-api';

export function MembersPage() {
  const auth = useCurrentUserQuery();
  const owner = auth.data?.organization?.role === 'OWNER';
  const invitations = useQuery({
    queryKey: ['organization', 'invitations'],
    queryFn: listInvitations,
    enabled: owner,
    retry: false,
  });
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'FINANCE' | 'OPERATIONS' | 'VIEWER'>('ADMIN');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [link, setLink] = useState<{ id: string; url: string } | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);

  if (auth.isPending)
    return (
      <main role="status" className="p-6">
        Verificando permissão...
      </main>
    );
  if (!owner)
    return (
      <main className="p-6">
        <h1>Membros e convites</h1>
        <p role="alert">Apenas o proprietário pode administrar convites.</p>
      </main>
    );

  async function create(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError('');
    setLink(null);
    try {
      const result = await createInvitation(email, role);
      setLink({ id: result.id, url: `${window.location.origin}/convites/${result.token}` });
      setEmail('');
      await queryClient.invalidateQueries({ queryKey: ['organization', 'invitations'] });
    } catch {
      setError('Não foi possível criar o convite. Confira os dados e tente novamente.');
    } finally {
      setPending(false);
    }
  }

  async function revoke() {
    if (!revokeId || pending) return;
    setPending(true);
    setError('');
    try {
      await revokeInvitation(revokeId);
      if (link?.id === revokeId) setLink(null);
      setRevokeId(null);
      await queryClient.invalidateQueries({ queryKey: ['organization', 'invitations'] });
    } catch {
      setError('Não foi possível revogar o convite.');
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Membros e convites</h1>
      <p>
        Convide uma pessoa para {auth.data?.organization.name}. O link secreto vale por 48 horas e
        deve ser compartilhado manualmente com o destinatário. Ele poderá criar a própria conta; o
        convite só concede acesso após aceite explícito.
      </p>
      <form onSubmit={(event) => void create(event)} className="space-y-3">
        <div>
          <Label htmlFor="invite-email">E-mail do destinatário</Label>
          <Input
            id="invite-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="invite-role">Papel</Label>
          <select
            id="invite-role"
            className="w-full rounded-md border p-2"
            value={role}
            onChange={(event) => setRole(event.target.value as typeof role)}
          >
            <option value="ADMIN">ADMIN</option>
            <option value="OPERATIONS">OPERATIONS</option>
            <option value="FINANCE">FINANCE</option>
            <option value="VIEWER">VIEWER</option>
          </select>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? 'Aguarde...' : 'Criar convite'}
        </Button>
      </form>
      {link && (
        <div role="status" className="space-y-2 rounded-md border p-3">
          <p>
            Copie e compartilhe este link somente com o destinatário. Ele será exibido apenas agora;
            se perdido, revogue o convite e crie outro.
          </p>
          <Input
            aria-label="Link do convite"
            readOnly
            value={link.url}
            onFocus={(event) => event.target.select()}
          />
          <Button
            type="button"
            onClick={() =>
              void navigator.clipboard
                .writeText(link.url)
                .catch(() =>
                  setError('Não foi possível copiar. Selecione o link e copie manualmente.'),
                )
            }
          >
            Copiar link
          </Button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      <h2 className="text-xl font-semibold">Convites</h2>
      {invitations.isPending && <p role="status">Carregando convites...</p>}
      {invitations.isError && (
        <p role="alert">
          Não foi possível carregar os convites.{' '}
          <Button onClick={() => void invitations.refetch()}>Tentar novamente</Button>
        </p>
      )}
      {invitations.data?.length === 0 && <p>Nenhum convite criado.</p>}
      <ul className="space-y-3">
        {invitations.data?.map((item) => (
          <li key={item.id} className="rounded-md border p-3">
            <p>
              {item.email} — {item.role} — {item.status}
            </p>
            <p>Válido até {new Date(item.expiresAt).toLocaleString('pt-BR')}</p>
            {item.status === 'PENDING' && (
              <Button variant="outline" disabled={pending} onClick={() => setRevokeId(item.id)}>
                Revogar convite de {item.email}
              </Button>
            )}
          </li>
        ))}
      </ul>
      <Dialog.Root
        open={revokeId !== null}
        onOpenChange={(open) => {
          if (!open && !pending) setRevokeId(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/45" />
          <Dialog.Viewport className="fixed inset-0 z-50 grid place-items-center p-4">
            <Dialog.Popup className="w-full max-w-md rounded-xl bg-background p-6 shadow-xl outline-none">
              <Dialog.Title className="text-lg font-semibold">Revogar convite</Dialog.Title>
              <Dialog.Description className="mt-2">
                Revogar este convite? O link deixará de funcionar.
              </Dialog.Description>
              <div className="mt-5 flex flex-wrap justify-end gap-3">
                <Button type="button" disabled={pending} onClick={() => void revoke()}>
                  {pending ? 'Revogando...' : 'Confirmar revogação'}
                </Button>
                <Dialog.Close
                  render={<Button type="button" variant="outline" disabled={pending} />}
                >
                  Cancelar
                </Dialog.Close>
              </div>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
      <Link to="/app" className="underline">
        Voltar
      </Link>
    </main>
  );
}
