import { Search, Users, Plus } from 'lucide-react';
import { type FormEvent, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useClientsQuery } from '@/features/clients/use-clients-query';
import { useNavigate } from 'react-router-dom';

type ClientStatusFilter = 'active' | 'inactive' | 'all';

function formatDocument(document: string | null): string {
  if (!document) {
    return 'Não informado';
  }

  if (document.length === 11) {
    return document.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  if (document.length === 14) {
    return document.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }

  return document;
}

export function ClientsPage() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ClientStatusFilter>('active');

  const clientsQuery = useClientsQuery({
    search: search || undefined,
    isActive: status === 'all' ? undefined : status === 'active',
    page,
    pageSize: 10,
  });

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  const response = clientsQuery.data;

  return (
    <section className="mx-auto max-w-7xl px-6 py-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Clientes</h1>
        <p className="mt-2 text-muted-foreground">
          Consulte e organize as pessoas e empresas atendidas.
        </p>
        <Button className="mt-5" onClick={() => navigate('/app/clientes/novo')}>
          <Plus data-icon="inline-start" />
          Novo cliente
        </Button>
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Cadastro de clientes</CardTitle>
          <CardDescription>
            {response
              ? `${response.pagination.total} cliente(s) encontrado(s).`
              : 'Carregando seus clientes.'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={handleSearch}>
            <div className="flex-1 space-y-2">
              <Label htmlFor="client-search">Buscar clientes</Label>
              <Input
                id="client-search"
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Nome, e-mail, CPF/CNPJ ou telefone"
              />
              <div className="space-y-2 sm:w-44">
                <Label htmlFor="client-status">Status</Label>
                <select
                  id="client-status"
                  value={status}
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  onChange={(event) => {
                    setStatus(event.target.value as ClientStatusFilter);
                    setPage(1);
                  }}
                >
                  <option value="active">Ativos</option>
                  <option value="inactive">Inativos</option>
                  <option value="all">Todos</option>
                </select>
              </div>
            </div>

            <Button type="submit" disabled={clientsQuery.isFetching}>
              <Search data-icon="inline-start" />
              Buscar
            </Button>
          </form>

          {clientsQuery.isPending && (
            <p role="status" className="py-12 text-center text-muted-foreground">
              Carregando clientes...
            </p>
          )}

          {clientsQuery.isError && (
            <p
              role="alert"
              className="mt-6 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {clientsQuery.error.message}
            </p>
          )}

          {response && response.data.length === 0 && (
            <div className="grid place-items-center py-14 text-center">
              <div className="grid size-12 place-items-center rounded-2xl bg-primary/10">
                <Users className="size-6 text-primary" />
              </div>
              <p className="mt-4 font-medium">Nenhum cliente encontrado</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Cadastre seu primeiro cliente ou altere a busca.
              </p>
            </div>
          )}

          {response && response.data.length > 0 && (
            <>
              <div className="mt-6 overflow-x-auto rounded-lg border">
                <table className="w-full min-w-3xl text-left text-sm">
                  <thead className="bg-muted/60 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Nome</th>
                      <th className="px-4 py-3 font-medium">Tipo</th>
                      <th className="px-4 py-3 font-medium">CPF/CNPJ</th>
                      <th className="px-4 py-3 font-medium">Contato</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {response.data.map((client) => (
                      <tr key={client.id} className="border-t bg-background">
                        <td className="px-4 py-3 font-medium">
                          <button
                            type="button"
                            className="text-left text-primary hover:underline"
                            onClick={() => navigate(`/app/clientes/${client.id}`)}
                          >
                            {client.name}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {client.type === 'INDIVIDUAL' ? 'Pessoa física' : 'Pessoa jurídica'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDocument(client.document)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {client.email ?? client.phone ?? 'Não informado'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={
                              client.isActive
                                ? 'rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800'
                                : 'rounded-full bg-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-700'
                            }
                          >
                            {client.isActive ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 flex flex-col items-center justify-between gap-3 sm:flex-row">
                <p className="text-sm text-muted-foreground">
                  Página {response.pagination.page} de {Math.max(response.pagination.totalPages, 1)}
                </p>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setPage((current) => Math.max(current - 1, 1))}
                    disabled={page <= 1 || clientsQuery.isFetching}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setPage((current) => current + 1)}
                    disabled={page >= response.pagination.totalPages || clientsQuery.isFetching}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
