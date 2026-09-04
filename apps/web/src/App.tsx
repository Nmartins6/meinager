import { useHealthQuery } from './features/system/use-health-query';

const modules = [
  {
    title: 'Financeiro',
    description: 'Contas a pagar, receber e fluxo de caixa.',
  },
  {
    title: 'Clientes',
    description: 'Relacionamentos e histórico em um só lugar.',
  },
  {
    title: 'Estoque',
    description: 'Produtos, insumos e movimentações rastreáveis.',
  },
  {
    title: 'Precificação',
    description: 'Custos, margem e preço recomendado.',
  },
];

export function App() {
  const healthQuery = useHealthQuery();

  const systemStatus = healthQuery.isPending
    ? 'Verificando sistema'
    : healthQuery.isError
      ? 'Sistema indisponível'
      : 'Sistema online';
  return (
    <main className="min-h-screen bg-[#f4f7f3] px-5 py-8 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-emerald-700 font-bold text-white">
              M
            </div>
            <span className="text-lg font-bold tracking-tight">meinager</span>
          </div>

          <span
            role="status"
            className={`rounded-full border px-3 py-1 text-sm font-medium ${
              healthQuery.isError
                ? 'border-red-200 bg-red-50 text-red-700'
                : healthQuery.isPending
                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-800'
            }`}
          >
            {systemStatus}
          </span>
        </header>

        <section className="mt-20 max-w-3xl">
          <p className="font-semibold text-emerald-700">Gestão feita para pequenos negócios</p>

          <h1 className="mt-4 text-5xl leading-[0.98] font-bold tracking-[-0.05em] text-slate-950 sm:text-7xl">
            Clareza para cuidar do seu negócio.
          </h1>

          <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-600">
            Organize suas finanças, clientes, produtos e pedidos sem transformar a gestão em mais um
            problema.
          </p>

          <button
            type="button"
            className="mt-8 rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          >
            Começar configuração
          </button>
        </section>

        <section
          className="mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          aria-label="Módulos do Meinager"
        >
          {modules.map((module) => (
            <article
              key={module.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <h2 className="font-semibold text-slate-950">{module.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{module.description}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
