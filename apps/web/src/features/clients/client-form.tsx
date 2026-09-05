import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const clientFormSchema = z.object({
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

export type ClientFormData = z.infer<typeof clientFormSchema>;

interface ClientFormProps {
  initialValues?: ClientFormData;
  submitLabel: string;
  pendingLabel: string;
  isPending: boolean;
  errorMessage?: string;
  onSubmit: (data: ClientFormData) => void;
  onCancel: () => void;
}

const defaultValues: ClientFormData = {
  type: 'INDIVIDUAL',
  name: '',
  document: '',
  phone: '',
  email: '',
  notes: '',
};

export function ClientForm({
  initialValues = defaultValues,
  submitLabel,
  pendingLabel,
  isPending,
  errorMessage,
  onSubmit,
  onCancel,
}: ClientFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: initialValues,
  });

  return (
    <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
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
          {errors.document && <p className="text-sm text-destructive">{errors.document.message}</p>}
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

      {errorMessage && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {errorMessage}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? pendingLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}
