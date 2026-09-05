import { ArrowLeft, UserPlus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ClientForm, type ClientFormData } from '@/features/clients/client-form';
import { useCreateClientMutation } from '@/features/clients/use-create-client-mutation';

export function NewClientPage() {
  const navigate = useNavigate();
  const createClientMutation = useCreateClientMutation();

  function handleSubmit(data: ClientFormData) {
    const document = data.document.replace(/\D/g, '');
    const phone = data.phone.replace(/\D/g, '');

    createClientMutation.mutate(
      {
        type: data.type,
        name: data.name,
        document: document || undefined,
        phone: phone || undefined,
        email: data.email || undefined,
        notes: data.notes || undefined,
      },
      {
        onSuccess: () => {
          navigate('/app/clientes', { replace: true });
        },
      },
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
            <UserPlus className="size-5 text-primary" />
          </div>
          <CardTitle className="text-2xl">Novo cliente</CardTitle>
          <CardDescription>
            Cadastre uma pessoa ou empresa atendida pelo seu negócio.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <ClientForm
            submitLabel="Salvar cliente"
            pendingLabel="Salvando..."
            isPending={createClientMutation.isPending}
            errorMessage={createClientMutation.error?.message}
            onSubmit={handleSubmit}
            onCancel={() => navigate('/app/clientes')}
          />
        </CardContent>
      </Card>
    </section>
  );
}
