import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, UserPlus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateClientMutation } from '@/features/clients/use-create-client-mutation';

const clientSchema = z.object({
  type: z.enum(['INDIVIDUAL', 'COMPANY']),
  name: z
    .string()
    .trim()
    .min(2, 'Informe o nome do cliente.')
    .max(150, 'O nome deve ter no máximo 150 caracteres.'),
  document: z
    .string()
    .trim()
    .refine(
      (value) => {
        const digits = value.replace(/\D/g, '');

        return digits.length === 0 || digits.length === 11 || digits.length === 14;
      },
      {
        message: 'Informe um CPF ou CNPJ com 11 ou 14 dígitos.',
      },
    ),
  phone: z
    .string()
    .trim()
    .refine(
      (value) => {
        const digits = value.replace(/\D/g, '');

        return digits.length === 0 || (digits.length >= 10 && digits.length <= 13);
      },
      {
        message: 'Informe um telefone com 10 a 13 dígitos.',
      },
    ),
  email: z
    .string()
    .trim()
    .refine((value) => value === '' || z.string().email().safeParse(value).success, {
      message: 'Informe um e-mail válido.',
    }),
  notes: z.string().trim().max(2000, 'As observações devem ter no máximo 2000 caracteres.'),
});

type ClientFormData = z.infer<typeof clientSchema>;

export function NewClientPage() {
  const navigate = useNavigate();
  const createClientMutation = useCreateClientMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      type: 'INDIVIDUAL',
      name: '',
      document: '',
      phone: '',
      email: '',
      notes: '',
    },
  });

  function handleValidSubmit(data: ClientFormData) {
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
          <form className="space-y-5" onSubmit={handleSubmit(handleValidSubmit)} noValidate>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="type">Tipo de cliente</Label>
                <select
                  id="type"
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  {...register('type')}
                >
                  <option value="INDIVIDUAL">Pessoa física</option>
                  <option value="COMPANY">Pessoa jurídica</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  autoComplete="name"
                  aria-invalid={Boolean(errors.name)}
                  {...register('name')}
                />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="document">CPF ou CNPJ</Label>
                <Input
                  id="document"
                  inputMode="numeric"
                  placeholder="Opcional"
                  aria-invalid={Boolean(errors.document)}
                  {...register('document')}
                />
                {errors.document && (
                  <p className="text-sm text-destructive">{errors.document.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telefone ou WhatsApp</Label>
                <Input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="Opcional"
                  aria-invalid={Boolean(errors.phone)}
                  {...register('phone')}
                />
                {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="Opcional"
                  aria-invalid={Boolean(errors.email)}
                  {...register('email')}
                />
                {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="notes">Observações</Label>
                <textarea
                  id="notes"
                  rows={5}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  placeholder="Informações importantes sobre o cliente"
                  aria-invalid={Boolean(errors.notes)}
                  {...register('notes')}
                />
                {errors.notes && <p className="text-sm text-destructive">{errors.notes.message}</p>}
              </div>
            </div>

            {createClientMutation.isError && (
              <p
                role="alert"
                className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
              >
                {createClientMutation.error.message}
              </p>
            )}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/app/clientes')}
                disabled={createClientMutation.isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={createClientMutation.isPending}>
                {createClientMutation.isPending ? 'Salvando...' : 'Salvar cliente'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
