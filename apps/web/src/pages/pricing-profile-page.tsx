import { Dialog } from '@base-ui/react/dialog';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Button, buttonVariants } from '@/components/ui/button';
import { useCurrentUserQuery } from '@/features/auth/use-current-user-query';
import { getPricingPermissions } from '@/features/pricing/pricing-permissions';
import { PricingProfileForm } from '@/features/pricing/pricing-profile-form';
import type { PricingProfileDetail } from '@/features/pricing/pricing-profiles-contracts';
import { useDeactivatePricingProfileMutation } from '@/features/pricing/use-pricing-profile-mutations';
import { usePricingProfileQuery } from '@/features/pricing/use-pricing-profiles-query';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';

function DeactivateProfileDialog({ profile }: { profile: PricingProfileDetail }) {
  const [open, setOpen] = useState(false);
  const [conflict, setConflict] = useState(false);
  const mutation = useDeactivatePricingProfileMutation(profile.id);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger render={<Button variant="destructive" />}>Desativar perfil</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/45" />
        <Dialog.Viewport className="fixed inset-0 z-50 grid place-items-center p-4">
          <Dialog.Popup className="w-full max-w-md rounded-xl bg-background p-6 shadow-xl outline-none">
            <Dialog.Title className="text-lg font-semibold">
              Desativar perfil de venda?
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-muted-foreground">
              O perfil deixará de ser usado em novos cálculos. Suas revisões e o histórico serão
              preservados.
            </Dialog.Description>
            {mutation.isError && (
              <p
                role="alert"
                className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
              >
                {conflict
                  ? 'O perfil mudou. Feche este diálogo, recarregue o detalhe e tente novamente.'
                  : mutation.error.message}
              </p>
            )}
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Dialog.Close render={<Button type="button" variant="outline" />}>
                Cancelar
              </Dialog.Close>
              <Button
                type="button"
                variant="destructive"
                disabled={mutation.isPending}
                onClick={() => {
                  setConflict(false);
                  mutation.mutate(
                    { expectedRevision: profile.currentRevision.revision },
                    {
                      onSuccess: () => setOpen(false),
                      onError: (error) => {
                        if (
                          error instanceof ApiError &&
                          (error.code === 'PRICING_REVISION_CONFLICT' ||
                            error.code === 'PRICING_CONCURRENT_MODIFICATION')
                        )
                          setConflict(true);
                      },
                    },
                  );
                }}
              >
                {mutation.isPending ? 'Desativando...' : 'Confirmar desativação'}
              </Button>
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function PricingProfilePage() {
  const { profileId = '' } = useParams();
  const currentUserQuery = useCurrentUserQuery();
  const permissions = getPricingPermissions(currentUserQuery.data?.organization.role);
  const profileQuery = usePricingProfileQuery(
    profileId,
    permissions.viewProfiles && profileId !== '',
  );

  if (currentUserQuery.isPending) {
    return (
      <p role="status" className="p-10 text-center">
        Carregando permissões...
      </p>
    );
  }
  if (!permissions.viewProfiles) {
    return (
      <section className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-3xl font-semibold">Perfil de venda</h1>
        <p role="alert" className="mt-5 rounded-lg bg-muted p-4 text-sm">
          Os dados internos deste perfil não estão disponíveis para seu papel.
        </p>
      </section>
    );
  }
  if (profileQuery.isPending) {
    return (
      <p role="status" className="p-10 text-center">
        Carregando perfil...
      </p>
    );
  }
  if (!profileQuery.data) {
    return (
      <section className="mx-auto max-w-5xl space-y-4 px-6 py-10">
        <h1 className="text-3xl font-semibold">Perfil de venda</h1>
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {profileQuery.error?.message ?? 'Não foi possível carregar o perfil.'}
        </p>
        <Button
          variant="outline"
          onClick={() => void profileQuery.refetch()}
          disabled={profileQuery.isFetching}
        >
          Tentar novamente
        </Button>
      </section>
    );
  }

  const profile = profileQuery.data;
  const canEdit = permissions.editProfiles && profile.isActive;
  return (
    <section className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">{profile.currentRevision.name}</h1>
          <p className="mt-2 text-muted-foreground">
            Revisão {profile.currentRevision.revision} ·{' '}
            {profile.isActive ? 'Perfil ativo' : 'Perfil inativo'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className={cn(buttonVariants({ variant: 'outline' }))}
            to="/app/produtos/precificacao/perfis"
          >
            Voltar aos perfis
          </Link>
          {permissions.editProfiles && profile.isActive && (
            <DeactivateProfileDialog profile={profile} />
          )}
        </div>
      </div>

      {!profile.isActive && (
        <p className="mt-6 rounded-lg bg-muted p-4 text-sm">
          Este perfil está inativo. Seus dados permanecem disponíveis somente para consulta.
        </p>
      )}

      <div className="mt-8">
        <PricingProfileForm
          profile={profile}
          canEdit={canEdit}
          onCancel={() => profileQuery.refetch()}
          onSaved={() => undefined}
          onReload={async () => {
            const result = await profileQuery.refetch();
            if (result.isSuccess && result.data && !result.error) {
              return { success: true, profile: result.data };
            }
            return {
              success: false,
              error: result.error?.message ?? 'Não foi possível recarregar o perfil.',
            };
          }}
        />
      </div>
    </section>
  );
}
