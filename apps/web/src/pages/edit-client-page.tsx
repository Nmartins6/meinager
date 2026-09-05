import { ArrowLeft, UserRoundPen } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ClientForm, type ClientFormData } from '@/features/clients/client-form';
import { useClientQuery } from '@/features/clients/use-client-query';
import { useUpdateClientMutation } from '@/features/clients/use-update-client-mutation';

export function EditClientPage() {
  const navigate = useNavigate();
  const { clientId = '' } = useParams();
  const clientQuery = useClientQuery(clientId);
  const updateClientMutation = useUpdateClientMutation();
  const client = clientQuery.data;

  function handleSubmit(data: ClientFormData) {
    const document = data.document.replace(/\D/g, '');
    const phone = data.phone.replace(/\D/g, '');

    updateClientMutation.mutate(
      {
        clientId,
        input: {
          type: data.type,
          name: data.name,
          document: document || null,
          phone: phone || null,
          email: data.email || null,
          notes: data.notes || null,
        },
      },
      {
        onSuccess: () => {
          navigate('/app/clientes', { replace: true });
        },
      },
    );
  }

  function handleStatusChange() {
    if (!client) {
      return;
    }

    updateClientMutation.mutate({
      clientId,
      input: {
        isActive: !client.isActive,
      },
    });
  }

  if (clientQuery.isPending) {
    return (
      <section className="mx-auto max-w-3xl px-6 py-10">
        <p role="status" className="text-muted-foreground">
          Carregando cliente...
        </p>
      </section>
    );
  }

  if (clientQuery.isError || !client) {
    return (
      <section className="mx-auto max-w-3xl px-6 py-10">
        <p
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {clientQuery.error?.message ?? 'Não foi possível carregar o cliente.'}
        </p>

        <Link
          to="/app/clientes"
          className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="size-4" />
          Voltar para clientes
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl px-6 py-10">
      <Link
        to="/app/clientes"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Voltar para clientes
      </Link>

      <Card className="mt-6">
        <CardHeader>
          <div className="mb-3 grid size-10 place-items-center rounded-xl bg-primary/10">
            <UserRoundPen className="size-5 text-primary" />
          </div>
          <CardTitle className="text-2xl">Editar cliente</CardTitle>
          <CardDescription>Atualize os dados de {client.name}.</CardDescription>
        </CardHeader>

        <CardContent>
          <ClientForm
            initialValues={{
              type: client.type,
              name: client.name,
              document: client.document ?? '',
              phone: client.phone ?? '',
              email: client.email ?? '',
              notes: client.notes ?? '',
            }}
            submitLabel="Salvar alterações"
            pendingLabel="Salvando..."
            isPending={updateClientMutation.isPending}
            errorMessage={updateClientMutation.error?.message}
            onSubmit={handleSubmit}
            onCancel={() => navigate('/app/clientes')}
          />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Status do cliente</CardTitle>
          <CardDescription>
            Clientes inativos permanecem no histórico, mas não aparecem na listagem padrão.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="font-medium">{client.isActive ? 'Cliente ativo' : 'Cliente inativo'}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {client.isActive
                ? 'O cliente pode ser usado em novos registros.'
                : 'Reative para voltar a utilizar este cliente.'}
            </p>
          </div>

          <Button
            variant={client.isActive ? 'destructive' : 'default'}
            onClick={handleStatusChange}
            disabled={updateClientMutation.isPending}
          >
            {client.isActive ? 'Inativar cliente' : 'Reativar cliente'}
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
