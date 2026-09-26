import { ArrowLeft, Check, GitBranch, Plus, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrentUserQuery } from '@/features/auth/use-current-user-query';
import { FinancialNavigation } from '@/features/finance/financial-navigation';
import {
  OrderWorkflowForm,
  type OrderWorkflowFormData,
} from '@/features/order-workflows/order-workflow-form';
import { useCreateOrderWorkflowMutation } from '@/features/order-workflows/use-create-order-workflow-mutation';
import { useOrderWorkflowActionMutation } from '@/features/order-workflows/use-order-workflow-action-mutation';
import { useOrderWorkflowsQuery } from '@/features/order-workflows/use-order-workflows-query';
import { cn } from '@/lib/utils';

function getWorkflowDisplayName(name: string): string {
  return name === 'Fluxo migrado' ? 'Fluxo anterior' : name;
}

export function OrderWorkflowsPage() {
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);

  const currentUserQuery = useCurrentUserQuery();
  const role = currentUserQuery.data?.organization.role;
  const canManage = role === 'OWNER' || role === 'ADMIN';

  const workflowsQuery = useOrderWorkflowsQuery(!currentUserQuery.isPending && canManage);
  const createMutation = useCreateOrderWorkflowMutation();
  const actionMutation = useOrderWorkflowActionMutation();

  const workflows = workflowsQuery.data ?? [];
  const queryError = currentUserQuery.error ?? workflowsQuery.error;

  function handleCreate(data: OrderWorkflowFormData) {
    createMutation.mutate(data, {
      onSuccess: () => {
        setIsCreating(false);
      },
    });
  }

  function handleSetDefault(workflowId: string) {
    actionMutation.reset();
    actionMutation.mutate({
      workflowId,
      action: 'default',
    });
  }

  function handleDeactivate(workflowId: string, workflowName: string) {
    const confirmed = window.confirm(
      `Deseja desativar o fluxo "${getWorkflowDisplayName(workflowName)}"? Os pedidos existentes continuarão preservados.`,
    );

    if (!confirmed) {
      return;
    }

    actionMutation.reset();
    actionMutation.mutate({
      workflowId,
      action: 'deactivate',
    });
  }

  function isActionPending(workflowId: string, action: 'default' | 'deactivate'): boolean {
    return (
      actionMutation.isPending &&
      actionMutation.variables?.workflowId === workflowId &&
      actionMutation.variables.action === action
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-6 py-10">
      <Button type="button" variant="outline" onClick={() => navigate('/app/financeiro/pedidos')}>
        <ArrowLeft data-icon="inline-start" />
        Voltar aos pedidos
      </Button>

      <FinancialNavigation />

      <div className="mt-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Fluxos de pedidos</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Personalize as etapas utilizadas pelos novos pedidos da sua organização.
          </p>
        </div>

        {canManage && !isCreating && (
          <Button
            type="button"
            onClick={() => {
              createMutation.reset();
              setIsCreating(true);
            }}
          >
            <Plus data-icon="inline-start" />
            Novo fluxo
          </Button>
        )}
      </div>

      {currentUserQuery.isPending && (
        <p role="status" className="py-12 text-center text-muted-foreground">
          Verificando permissões...
        </p>
      )}

      {!currentUserQuery.isPending && !canManage && (
        <Card className="mt-8">
          <CardContent className="grid place-items-center py-14 text-center">
            <div className="grid size-12 place-items-center rounded-2xl bg-destructive/10">
              <ShieldAlert className="size-6 text-destructive" />
            </div>
            <p className="mt-4 font-medium">Você não possui permissão para configurar fluxos</p>
            <p className="mt-1 max-w-lg text-sm text-muted-foreground">
              Somente proprietários e administradores podem alterar as etapas utilizadas pelos
              pedidos.
            </p>
          </CardContent>
        </Card>
      )}

      {canManage && isCreating && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Novo fluxo</CardTitle>
            <CardDescription>Defina o nome e a sequência de etapas do fluxo.</CardDescription>
          </CardHeader>
          <CardContent>
            <OrderWorkflowForm
              isPending={createMutation.isPending}
              errorMessage={createMutation.error?.message}
              onSubmit={handleCreate}
              onCancel={() => {
                createMutation.reset();
                setIsCreating(false);
              }}
            />
          </CardContent>
        </Card>
      )}

      {canManage && queryError && (
        <div className="mt-8 space-y-3">
          <p
            role="alert"
            className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
          >
            {queryError.message}
          </p>

          {workflowsQuery.isError && (
            <Button
              type="button"
              variant="outline"
              onClick={() => void workflowsQuery.refetch()}
              disabled={workflowsQuery.isFetching}
            >
              Tentar novamente
            </Button>
          )}
        </div>
      )}

      {canManage && actionMutation.error && (
        <p
          role="alert"
          className="mt-8 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {actionMutation.error.message}
        </p>
      )}

      {canManage && workflowsQuery.isPending && (
        <p role="status" className="py-12 text-center text-muted-foreground">
          Carregando fluxos...
        </p>
      )}

      {canManage &&
        !workflowsQuery.isPending &&
        !workflowsQuery.isError &&
        workflows.length === 0 && (
          <Card className="mt-8">
            <CardContent className="grid place-items-center py-14 text-center">
              <div className="grid size-12 place-items-center rounded-2xl bg-primary/10">
                <GitBranch className="size-6 text-primary" />
              </div>
              <p className="mt-4 font-medium">Nenhum fluxo configurado</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Crie um fluxo para organizar as etapas dos pedidos.
              </p>
            </CardContent>
          </Card>
        )}

      {canManage && workflows.length > 0 && (
        <div className="mt-8 grid gap-5 lg:grid-cols-2" aria-busy={workflowsQuery.isFetching}>
          {workflows.map((workflow) => (
            <Card key={workflow.id} className={cn(!workflow.isActive && 'opacity-70')}>
              <CardHeader>
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <CardTitle>{getWorkflowDisplayName(workflow.name)}</CardTitle>
                    <CardDescription className="mt-1">
                      {workflow._count.orders}{' '}
                      {workflow._count.orders === 1 ? 'pedido utiliza' : 'pedidos utilizam'} este
                      fluxo.
                    </CardDescription>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {workflow.isDefault && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">
                        <Check className="size-3.5" />
                        Padrão
                      </span>
                    )}

                    {!workflow.isActive && (
                      <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                        Inativo
                      </span>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <ol className="space-y-3">
                  {workflow.stages.map((stage) => (
                    <li key={stage.id} className="flex items-center gap-3">
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {stage.position}
                      </span>
                      <span
                        className={cn(
                          'text-sm',
                          !stage.isActive && 'text-muted-foreground line-through',
                        )}
                      >
                        {stage.name}
                      </span>
                    </li>
                  ))}
                </ol>

                {workflow.isActive && !workflow.isDefault && (
                  <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleSetDefault(workflow.id)}
                      disabled={actionMutation.isPending}
                    >
                      {isActionPending(workflow.id, 'default')
                        ? 'Definindo...'
                        : 'Definir como padrão'}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleDeactivate(workflow.id, workflow.name)}
                      disabled={actionMutation.isPending}
                    >
                      {isActionPending(workflow.id, 'deactivate') ? 'Desativando...' : 'Desativar'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
