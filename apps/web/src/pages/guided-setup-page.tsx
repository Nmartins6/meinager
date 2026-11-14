import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import { PricingDraftNavigation } from '@/features/pricing/pricing-draft-navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrentUserQuery } from '@/features/auth/use-current-user-query';
import { ClientForm, type ClientFormData } from '@/features/clients/client-form';
import { useCreateClientMutation } from '@/features/clients/use-create-client-mutation';
import { GuidedCostEntry } from '@/features/finance/guided-cost-entry';
import { PricingConfigurationForm } from '@/features/pricing/pricing-configuration-form';
import { getPricingPermissions } from '@/features/pricing/pricing-permissions';
import { PricingProfileForm } from '@/features/pricing/pricing-profile-form';
import { ProductCommercialSummary } from '@/features/pricing/product-commercial-summary';
import { usePricingConfigurationQuery } from '@/features/pricing/use-pricing-configuration-query';
import { useAllActivePricingProfilesQuery } from '@/features/pricing/use-pricing-profiles-query';
import { ProductForm, type ProductFormData } from '@/features/products/product-form';
import { useCreateProductMutation } from '@/features/products/use-create-product-mutation';
import { ApiError } from '@/lib/api';

const PricingCompositionEditor = lazy(async () => {
  const module = await import('@/features/pricing/pricing-composition-editor');
  return { default: module.PricingCompositionEditor };
});

const sections = [
  { id: 'custos-fixos', label: 'Custos fixos' },
  { id: 'custos-variaveis', label: 'Custos variáveis' },
  { id: 'regras-preco', label: 'Regras do preço' },
  { id: 'insumos', label: 'Insumos' },
  { id: 'produto', label: 'Produto e preço' },
  { id: 'clientes', label: 'Clientes' },
];

function SetupWorkspace() {
  const auth = useCurrentUserQuery().data!;
  const permissions = getPricingPermissions(auth.organization.role);
  const configurationQuery = usePricingConfigurationQuery(true);
  const profilesQuery = useAllActivePricingProfilesQuery(true);
  const createSupply = useCreateProductMutation();
  const createProduct = useCreateProductMutation();
  const createClient = useCreateClientMutation();
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [supplyFormKey, setSupplyFormKey] = useState(0);
  const [productFormKey, setProductFormKey] = useState(0);
  const [clientFormKey, setClientFormKey] = useState(0);
  const [createdSupplyName, setCreatedSupplyName] = useState('');
  const [supplyError, setSupplyError] = useState('');
  const [createdProduct, setCreatedProduct] = useState<{ id: string; name: string } | null>(null);
  const [createdClientName, setCreatedClientName] = useState('');
  const missingConfiguration =
    configurationQuery.error instanceof ApiError &&
    configurationQuery.error.code === 'PRICING_CONFIGURATION_NOT_FOUND';

  function saveSupply(data: ProductFormData) {
    if (!data.directCost.trim()) {
      setSupplyError('Informe o custo por unidade de consumo para usar este item como insumo.');
      return;
    }
    setSupplyError('');
    createSupply.mutate(
      {
        type: data.type,
        name: data.name.trim(),
        sku: data.sku.trim() || undefined,
        barcode: data.barcode.trim() || undefined,
        unit: data.unit.trim().toUpperCase(),
        directCost: data.directCost.trim() || undefined,
        trackInventory: data.type === 'PRODUCT' && data.trackInventory,
        minimumStock: data.trackInventory ? data.minimumStock.trim() || undefined : undefined,
        notes: data.notes.trim() || undefined,
      },
      {
        onSuccess: (created) => {
          setCreatedSupplyName(created.name);
          setSupplyFormKey((current) => current + 1);
        },
      },
    );
  }

  function saveProduct(data: ProductFormData) {
    createProduct.mutate(
      {
        type: data.type,
        name: data.name.trim(),
        sku: data.sku.trim() || undefined,
        barcode: data.barcode.trim() || undefined,
        unit: data.unit.trim().toUpperCase(),
        directCost: data.directCost.trim() || undefined,
        trackInventory: data.type === 'PRODUCT' && data.trackInventory,
        minimumStock: data.trackInventory ? data.minimumStock.trim() || undefined : undefined,
        notes: data.notes.trim() || undefined,
      },
      {
        onSuccess: (created) => {
          setCreatedProduct({ id: created.id, name: created.name });
          setProductFormKey((current) => current + 1);
        },
      },
    );
  }

  function saveClient(data: ClientFormData) {
    createClient.mutate(
      {
        type: data.type,
        name: data.name.trim(),
        document: data.document.trim() || undefined,
        phone: data.phone.trim() || undefined,
        email: data.email.trim() || undefined,
        notes: data.notes.trim() || undefined,
      },
      {
        onSuccess: (created) => {
          setCreatedClientName(created.name);
          setClientFormKey((current) => current + 1);
        },
      },
    );
  }

  return (
    <section className="mx-auto max-w-5xl space-y-8 px-6 py-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Cadastre e forme seu preço</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Siga as etapas nesta página. Cada botão salva o respectivo cadastro na organização atual.
          Ao voltar, consulte os dados salvos nas páginas de produtos, clientes e financeiro. Campos
          ainda não salvos não são recuperados ao recarregar a página.
        </p>
      </header>

      <nav aria-label="Etapas do cadastro" className="flex flex-wrap gap-2">
        {sections.map((section, index) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="rounded-full border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            {index + 1}. {section.label}
          </a>
        ))}
      </nav>

      <Card id="custos-fixos" className="scroll-mt-6">
        <CardHeader>
          <CardTitle>1. Custos fixos da empresa</CardTitle>
          <CardDescription>
            Registre despesas como aluguel e internet, com seus vencimentos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GuidedCostEntry type="FIXED_EXPENSE" />
        </CardContent>
      </Card>

      <Card id="custos-variaveis" className="scroll-mt-6">
        <CardHeader>
          <CardTitle>2. Custos variáveis da empresa</CardTitle>
          <CardDescription>
            Registre despesas variáveis gerais. Materiais consumidos por produto entram como insumos
            na etapa 4.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GuidedCostEntry type="VARIABLE_EXPENSE" />
        </CardContent>
      </Card>

      <Card id="regras-preco" className="scroll-mt-6">
        <CardHeader>
          <CardTitle>3. Como formar o preço</CardTitle>
          <CardDescription>
            Informe a participação dos custos fixos, a mão de obra e a margem. Os lançamentos acima
            servem para acompanhar o financeiro; confira o total antes de informá-lo aqui, pois não
            há importação automática para a fórmula.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {configurationQuery.isPending && <p role="status">Carregando regras de preço...</p>}
          {configurationQuery.isError && !missingConfiguration && (
            <div className="space-y-2">
              <p role="alert" className="text-sm text-destructive">
                Não foi possível carregar a configuração.
              </p>
              <Button
                variant="outline"
                onClick={() => void configurationQuery.refetch()}
                disabled={configurationQuery.isFetching}
              >
                Tentar novamente
              </Button>
            </div>
          )}
          {(configurationQuery.data || missingConfiguration) && (
            <PricingConfigurationForm
              configuration={configurationQuery.data ?? null}
              canEdit={permissions.editConfiguration}
              onReload={async () => {
                const result = await configurationQuery.refetch();
                return result.isSuccess && result.data
                  ? { success: true, configuration: result.data }
                  : { success: false, error: 'Não foi possível recarregar a configuração.' };
              }}
            />
          )}
          <div className="border-t pt-5">
            <h3 className="font-medium">Taxas e deduções do canal de venda</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Cadastre um perfil somente se houver taxas, impostos ou comissões sobre a venda.
            </p>
            {profilesQuery.isPending && <p role="status">Carregando perfis...</p>}
            {profilesQuery.isError && (
              <p role="alert" className="text-sm text-destructive">
                Não foi possível carregar os perfis.
              </p>
            )}
            {profilesQuery.data && (
              <p className="mt-2 text-sm">{profilesQuery.data.length} perfil(is) ativo(s).</p>
            )}
            {!showProfileForm && (
              <Button
                type="button"
                variant="outline"
                className="mt-3"
                onClick={() => setShowProfileForm(true)}
              >
                Cadastrar perfil de venda
              </Button>
            )}
            {showProfileForm && (
              <div className="mt-4">
                <PricingProfileForm
                  profile={null}
                  canEdit={permissions.editProfiles}
                  onCancel={() => setShowProfileForm(false)}
                  onSaved={() => setShowProfileForm(false)}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card id="insumos" className="scroll-mt-6">
        <CardHeader>
          <CardTitle>4. Insumos e serviços usados no produto</CardTitle>
          <CardDescription>
            Cadastre cada item com custo por unidade de consumo. Um insumo é um item do catálogo,
            que poderá ser escolhido na composição. Não há conversão automática de unidades.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {createdSupplyName && (
            <p role="status" className="mb-4 text-sm">
              “{createdSupplyName}” cadastrado. Você pode adicionar outro insumo.
            </p>
          )}
          <ProductForm
            key={supplyFormKey}
            showSalePrice={false}
            requireDirectCost
            simple
            submitLabel="Cadastrar insumo"
            pendingLabel="Salvando insumo..."
            isPending={createSupply.isPending}
            errorMessage={supplyError || createSupply.error?.message}
            onSubmit={saveSupply}
            onCancel={() => {
              setSupplyError('');
              setSupplyFormKey((current) => current + 1);
            }}
          />
        </CardContent>
      </Card>

      <Card id="produto" className="scroll-mt-6">
        <CardHeader>
          <CardTitle>5. Produto, composição e preço sugerido</CardTitle>
          <CardDescription>
            Cadastre o produto, escolha os insumos na composição e veja o mínimo e o sugerido.
            Depois, confirme a simulação no servidor. Adoção do preço e alteração manual são
            escolhas explícitas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {!createdProduct && (
            <ProductForm
              key={productFormKey}
              showSalePrice={false}
              showDirectCost={false}
              simple
              submitLabel="Cadastrar produto"
              pendingLabel="Salvando produto..."
              isPending={createProduct.isPending}
              errorMessage={createProduct.error?.message}
              onSubmit={saveProduct}
              onCancel={() => setProductFormKey((current) => current + 1)}
            />
          )}
          {createdProduct && (
            <div className="border-t pt-6">
              <p role="status" className="font-medium">
                Produto “{createdProduct.name}” cadastrado. Monte a composição abaixo.
              </p>
              <Suspense fallback={<p role="status">Preparando cálculo...</p>}>
                <PricingCompositionEditor
                  key={createdProduct.id}
                  productId={createdProduct.id}
                  canEdit={permissions.editComposition}
                  canSimulate={permissions.simulatePricing}
                  canAdopt={permissions.adoptPricing}
                  canAdoptBelowMinimum={permissions.adoptBelowMinimum}
                />
              </Suspense>
              <div className="mt-6">
                <p className="text-sm text-muted-foreground">
                  O preço sugerido não altera o preço do produto sozinho. Você pode adotar uma
                  versão calculada ou informar um preço manual no resumo comercial.
                </p>
                <ProductCommercialSummary
                  productId={createdProduct.id}
                  role={auth.organization.role}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card id="clientes" className="scroll-mt-6">
        <CardHeader>
          <CardTitle>6. Clientes e próximos passos</CardTitle>
          <CardDescription>Cadastre o cliente antes de preparar o orçamento.</CardDescription>
        </CardHeader>
        <CardContent>
          {createdClientName && (
            <p role="status" className="mb-4 text-sm">
              Cliente “{createdClientName}” cadastrado.
            </p>
          )}
          <ClientForm
            key={clientFormKey}
            submitLabel="Cadastrar cliente"
            pendingLabel="Salvando cliente..."
            isPending={createClient.isPending}
            errorMessage={createClient.error?.message}
            onSubmit={saveClient}
            onCancel={() => setClientFormKey((current) => current + 1)}
          />
          <Link
            to="/app/financeiro/orcamentos/novo"
            className="mt-5 inline-block text-sm font-medium text-primary underline"
          >
            Criar orçamento
          </Link>
        </CardContent>
      </Card>
    </section>
  );
}

export function GuidedSetupPage() {
  const authQuery = useCurrentUserQuery();
  if (authQuery.isPending)
    return (
      <p role="status" className="p-10">
        Verificando acesso...
      </p>
    );
  if (authQuery.isError)
    return (
      <p role="alert" className="p-10">
        Não foi possível verificar o acesso.
      </p>
    );
  const role = authQuery.data?.organization.role;
  if (role !== 'OWNER' && role !== 'ADMIN') {
    return (
      <p role="alert" className="mx-auto max-w-5xl p-10">
        Esta página de cadastro está disponível para administradores da organização.
      </p>
    );
  }
  return (
    <PricingDraftNavigation>
      <SetupWorkspace />
    </PricingDraftNavigation>
  );
}
