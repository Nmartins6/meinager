import { zodResolver } from '@hookform/resolvers/zod';
import { ChartNoAxesCombined, CheckCircle2, LockKeyhole } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { useLoginMutation } from '@/features/auth/use-login-mutation';

const loginSchema = z.object({
  email: z.string().trim().email('Informe um e-mail válido.'),
  password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres.'),
});

type LoginFormData = z.infer<typeof loginSchema>;

const benefits = [
  'Visualize o que entra e sai do negócio.',
  'Organize clientes, produtos e pedidos.',
  'Tome decisões com preços e margens claras.',
];

export function LoginPage() {
  const navigate = useNavigate();
  const loginMutation = useLoginMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  function handleValidSubmit(data: LoginFormData) {
    loginMutation.mutate(data, {
      onSuccess: () => {
        navigate('/app', { replace: true });
      },
    });
  }

  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[1.05fr_0.95fr]">
      <aside className="relative hidden overflow-hidden bg-emerald-950 p-12 text-white lg:flex lg:flex-col">
        <div className="absolute -top-32 -right-32 size-96 rounded-full bg-emerald-500/15 blur-3xl" />

        <Link to="/" className="relative flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-emerald-400 font-bold text-emerald-950">
            M
          </span>
          <span className="text-lg font-semibold tracking-tight">meinager</span>
        </Link>

        <div className="relative my-auto max-w-lg">
          <div className="mb-8 grid size-12 place-items-center rounded-2xl bg-white/10">
            <ChartNoAxesCombined className="size-6 text-emerald-300" />
          </div>

          <h1 className="text-5xl leading-tight font-semibold tracking-[-0.04em]">
            Menos planilhas.
            <br />
            Mais clareza.
          </h1>

          <p className="mt-6 max-w-md text-lg leading-8 text-emerald-100/70">
            O essencial para administrar seu pequeno negócio sem complicação.
          </p>

          <ul className="mt-10 space-y-4">
            {benefits.map((benefit) => (
              <li key={benefit} className="flex items-center gap-3 text-emerald-50">
                <CheckCircle2 className="size-5 text-emerald-400" />
                {benefit}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-emerald-100/50">
          Gestão simples para quem faz o negócio acontecer.
        </p>
      </aside>

      <section className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="grid size-10 place-items-center rounded-xl bg-emerald-700 font-bold text-white">
              M
            </span>
            <span className="text-lg font-semibold tracking-tight">meinager</span>
          </Link>

          <Card className="shadow-xl shadow-black/5">
            <CardHeader>
              <div className="mb-3 grid size-10 place-items-center rounded-xl bg-primary/10">
                <LockKeyhole className="size-5 text-primary" />
              </div>
              <CardTitle className="text-2xl">Boas-vindas de volta</CardTitle>
              <CardDescription>Entre para acompanhar e organizar seu negócio.</CardDescription>
            </CardHeader>

            <CardContent>
              <form className="space-y-5" onSubmit={handleSubmit(handleValidSubmit)} noValidate>
                <div className="space-y-2">
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
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Senha</Label>
                    <span className="text-sm text-muted-foreground">Recuperação em breve</span>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    aria-invalid={Boolean(errors.password)}
                    {...register('password')}
                  />
                  {errors.password && (
                    <p className="text-sm text-destructive">{errors.password.message}</p>
                  )}
                </div>

                {loginMutation.isError && (
                  <p
                    role="alert"
                    className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
                  >
                    {loginMutation.error.message}
                  </p>
                )}

                <Button
                  type="submit"
                  size="lg"
                  className="h-11 w-full"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? 'Entrando...' : 'Entrar'}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                Ainda não tem uma conta?{' '}
                <Link to="/cadastro" className="font-medium text-primary hover:underline">
                  Comece gratuitamente
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
