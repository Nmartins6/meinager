import { zodResolver } from '@hookform/resolvers/zod';
import { UserPlus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRegisterMutation } from '@/features/auth/use-register-mutation';

const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Informe seu nome.')
      .max(120, 'O nome deve ter no máximo 120 caracteres.'),
    email: z.string().trim().email('Informe um e-mail válido.').max(254, 'O e-mail é muito longo.'),
    password: z
      .string()
      .min(8, 'A senha deve ter pelo menos 8 caracteres.')
      .max(128, 'A senha deve ter no máximo 128 caracteres.'),
    confirmPassword: z.string(),
    organizationName: z
      .string()
      .trim()
      .min(2, 'Informe o nome da empresa.')
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
    segment: z.string().trim().max(80, 'O segmento deve ter no máximo 80 caracteres.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem.',
    path: ['confirmPassword'],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const registerMutation = useRegisterMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      organizationName: '',
      document: '',
      segment: '',
    },
  });

  function handleValidSubmit(data: RegisterFormData) {
    const document = data.document.replace(/\D/g, '');

    registerMutation.mutate(
      {
        name: data.name,
        email: data.email,
        password: data.password,
        organizationName: data.organizationName,
        document: document || undefined,
        segment: data.segment || undefined,
      },
      {
        onSuccess: () => {
          navigate('/app', { replace: true });
        },
      },
    );
  }

  return (
    <main className="min-h-screen bg-muted px-6 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <Link to="/" className="mb-8 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-primary font-bold text-primary-foreground">
            M
          </span>
          <span className="text-lg font-semibold tracking-tight">meinager</span>
        </Link>

        <Card className="shadow-xl shadow-black/5">
          <CardHeader>
            <div className="mb-3 grid size-10 place-items-center rounded-xl bg-primary/10">
              <UserPlus className="size-5 text-primary" />
            </div>
            <CardTitle className="text-2xl">Crie sua conta</CardTitle>
            <CardDescription>
              Cadastre o proprietário e os dados iniciais da empresa.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form className="space-y-6" onSubmit={handleSubmit(handleValidSubmit)} noValidate>
              <fieldset className="space-y-4">
                <legend className="mb-4 font-medium">Seus dados</legend>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="name">Nome completo</Label>
                    <Input
                      id="name"
                      autoComplete="name"
                      aria-invalid={Boolean(errors.name)}
                      {...register('name')}
                    />
                    {errors.name && (
                      <p className="text-sm text-destructive">{errors.name.message}</p>
                    )}
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="voce@empresa.com.br"
                      aria-invalid={Boolean(errors.email)}
                      {...register('email')}
                    />
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="new-password"
                      aria-invalid={Boolean(errors.password)}
                      {...register('password')}
                    />
                    {errors.password && (
                      <p className="text-sm text-destructive">{errors.password.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirme a senha</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      aria-invalid={Boolean(errors.confirmPassword)}
                      {...register('confirmPassword')}
                    />
                    {errors.confirmPassword && (
                      <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
                    )}
                  </div>
                </div>
              </fieldset>

              <fieldset className="space-y-4 border-t pt-6">
                <legend className="font-medium">Dados da empresa</legend>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="organizationName">Nome da empresa</Label>
                    <Input
                      id="organizationName"
                      autoComplete="organization"
                      aria-invalid={Boolean(errors.organizationName)}
                      {...register('organizationName')}
                    />
                    {errors.organizationName && (
                      <p className="text-sm text-destructive">{errors.organizationName.message}</p>
                    )}
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
                    <Label htmlFor="segment">Segmento</Label>
                    <Input
                      id="segment"
                      placeholder="Ex.: Comércio, serviços"
                      aria-invalid={Boolean(errors.segment)}
                      {...register('segment')}
                    />
                    {errors.segment && (
                      <p className="text-sm text-destructive">{errors.segment.message}</p>
                    )}
                  </div>
                </div>
              </fieldset>

              {registerMutation.isError && (
                <p
                  role="alert"
                  className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
                >
                  {registerMutation.error.message}
                </p>
              )}

              <Button
                type="submit"
                size="lg"
                className="h-11 w-full"
                disabled={registerMutation.isPending}
              >
                {registerMutation.isPending ? 'Criando conta...' : 'Criar minha conta'}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Já possui uma conta?{' '}
              <Link to="/login" className="font-medium text-primary hover:underline">
                Entrar
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
