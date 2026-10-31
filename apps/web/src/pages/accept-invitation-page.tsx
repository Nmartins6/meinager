import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  acceptInvitation,
  inspectInvitation,
  registerInvited,
} from '@/features/auth/invitations-api';
import { currentUserQueryKey, useSessionQuery } from '@/features/auth/use-current-user-query';

export function AcceptInvitationPage() {
  const { token = '' } = useParams();
  const queryClient = useQueryClient();
  const invite = useQuery({
    queryKey: ['public-invitation', token],
    queryFn: () => inspectInvitation(token),
    retry: false,
  });
  const auth = useSessionQuery();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState(false);

  async function register(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError('');
    try {
      const result = await registerInvited(token, { name, email, password });
      setPassword('');
      queryClient.setQueryData(currentUserQueryKey, result);
    } catch {
      setError(
        'Não foi possível criar sua conta para este convite. Confira os dados ou entre se já possui uma conta.',
      );
    } finally {
      setPending(false);
    }
  }

  async function accept() {
    if (pending) return;
    setPending(true);
    setError('');
    try {
      await acceptInvitation(token);
      setAccepted(true);
      await queryClient.invalidateQueries({ queryKey: currentUserQueryKey });
    } catch {
      setError(
        'Não foi possível aceitar o convite. Confira a conta, a validade e tente novamente.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl space-y-5 p-6">
      <h1 className="text-2xl font-semibold">Convite para organização</h1>
      {invite.isPending && <p role="status">Verificando convite...</p>}
      {invite.isError && <p role="alert">Convite inválido ou indisponível.</p>}
      {invite.data && (
        <>
          <p>
            Organização: {invite.data.organizationName}. Papel: {invite.data.role}. Destinatário:{' '}
            {invite.data.email}.
          </p>
          <p>
            Este link é secreto e vale até {new Date(invite.data.expiresAt).toLocaleString('pt-BR')}
            . O acesso só será concedido após sua confirmação.
          </p>
          {invite.data.status !== 'PENDING' && (
            <p role="alert">
              Convite {invite.data.status.toLowerCase()}. Peça um novo link ao proprietário.
            </p>
          )}
        </>
      )}
      {invite.data?.status === 'PENDING' && !accepted && (
        <>
          {auth.isPending && <p role="status">Verificando sua conta...</p>}
          {auth.isError && (
            <>
              <form onSubmit={(event) => void register(event)} className="space-y-3">
                <h2 className="font-semibold">Criar minha conta para este convite</h2>
                <div>
                  <Label htmlFor="member-name">Nome</Label>
                  <Input
                    id="member-name"
                    required
                    minLength={2}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="member-email">E-mail</Label>
                  <Input
                    id="member-email"
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="member-password">Senha</Label>
                  <Input
                    id="member-password"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </div>
                <Button type="submit" disabled={pending}>
                  {pending ? 'Criando conta...' : 'Criar conta'}
                </Button>
              </form>
              <Link to="/login" state={{ from: `/convites/${token}` }} className="underline">
                Já tenho conta; entrar
              </Link>
            </>
          )}
          {auth.data && (
            <>
              <p>Conta autenticada: {auth.data.user.email}.</p>
              {auth.data.user.email.toLowerCase() !== invite.data.email.toLowerCase() ? (
                <p role="alert">
                  Esta conta não corresponde ao e-mail convidado. Entre com a conta correta.
                </p>
              ) : (
                <Button type="button" disabled={pending} onClick={() => void accept()}>
                  {pending ? 'Aceitando...' : 'Aceitar convite'}
                </Button>
              )}
            </>
          )}
        </>
      )}
      {accepted && (
        <div role="status">
          <p>
            Convite aceito. Seu vínculo foi criado. Escolha explicitamente a organização para
            entrar.
          </p>
          <Link to="/selecionar-organizacao" className="underline">
            Selecionar organização
          </Link>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
