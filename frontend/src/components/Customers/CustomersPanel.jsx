import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../lib/api';
import Button from '../ui/Button';
import { Field, Input, TextArea } from '../ui/Field';
import Panel from '../ui/Panel';
import { formatCurrency } from '../../lib/format';

const emptyForm = {
  id: null,
  name: '',
  phone: '',
  rnc: '',
  email: '',
  address: '',
  credit_limit: '0'
};

export default function CustomersPanel({ token, onActivity }) {
  const [customers, setCustomers] = useState([]);
  const [query, setQuery] = useState('');
  const [visibleCustomerCount, setVisibleCustomerCount] = useState(40);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false);

  const selectedCustomer = customers.find((customer) => customer.id === form.id) || null;
  const customersWithBalance = useMemo(
    () => customers.filter((customer) => Number(customer.balance || 0) > 0).length,
    [customers]
  );
  const portfolioBalance = useMemo(
    () => customers.reduce((sum, customer) => sum + Number(customer.balance || 0), 0),
    [customers]
  );
  const visibleCustomers = useMemo(
    () => customers.slice(0, visibleCustomerCount),
    [customers, visibleCustomerCount]
  );

  async function loadCustomers(search = '', { forceFresh = false } = {}) {
    const normalizedSearch = search.trim().toLowerCase();
    const result = await apiRequest(`/api/customers?q=${encodeURIComponent(search)}`, {
      token,
      cacheMs: forceFresh ? 0 : 20000,
      cacheKey: `customers-list:${normalizedSearch}`,
      forceFresh
    });
    setCustomers(result);
    setVisibleCustomerCount(normalizedSearch ? 60 : 40);
  }

  useEffect(() => {
    loadCustomers();
  }, [token]);

  async function sendStatement() {
    if (!selectedCustomer) {
      setMessage('Selecciona un cliente para enviar su estado de cuenta.');
      return;
    }

    if (!selectedCustomer.phone) {
      setMessage('El cliente no tiene telefono registrado para WhatsApp.');
      return;
    }

    setSendingWhatsapp(true);
    setMessage('');

    try {
      const result = await apiRequest('/api/whatsapp/statement', {
        method: 'POST',
        body: {
          customerId: selectedCustomer.id
        },
        token
      });

      window.open(result.url, '_blank', 'noopener,noreferrer');
      setMessage(`Se preparo el estado de cuenta de ${selectedCustomer.name} para WhatsApp.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSendingWhatsapp(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const payload = {
        ...form,
        credit_limit: Number(form.credit_limit || 0)
      };

      if (form.id) {
        await apiRequest(`/api/customers/${form.id}`, {
          method: 'PUT',
          body: payload,
          token
        });
        setMessage('Cliente actualizado.');
      } else {
        await apiRequest('/api/customers', {
          method: 'POST',
          body: payload,
          token
        });
        setMessage('Cliente creado.');
      }

      setForm(emptyForm);
      await loadCustomers(query, { forceFresh: true });
      onActivity?.();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Panel>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Clientes</div>
            <h2 className="mt-2 text-3xl font-bold text-ink">Cartera de clientes y seguimiento</h2>
            <p className="mt-3 text-sm text-slate-600">
              Administra datos de contacto, limite de credito y acciones de cobro desde una sola vista mas clara.
            </p>
          </div>
          <div className="grid w-full gap-3 sm:grid-cols-3 xl:w-auto xl:min-w-[520px]">
            <div className="rounded-[24px] bg-white/78 px-5 py-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Clientes</div>
              <div className="mt-2 text-2xl font-bold text-ink">{customers.length}</div>
            </div>
            <div className="rounded-[24px] bg-white/78 px-5 py-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Con saldo pendiente</div>
              <div className="mt-2 text-2xl font-bold text-rosewood">{customersWithBalance}</div>
            </div>
            <div className="rounded-[24px] bg-white/78 px-5 py-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Saldo en cartera</div>
              <div className="mt-2 text-2xl font-bold text-ink">{formatCurrency(portfolioBalance)}</div>
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[minmax(320px,0.96fr),minmax(0,1.04fr)]">
        <Panel className="overflow-hidden">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Base de clientes</div>
              <h3 className="mt-2 text-2xl font-bold text-ink">Listado general</h3>
              <div className="mt-2 text-sm text-slate-500">
                Busca por nombre, telefono o RNC y selecciona un cliente para editarlo o enviar su estado.
              </div>
            </div>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  loadCustomers(event.currentTarget.value);
                }
              }}
              placeholder="Buscar por nombre, telefono o RNC"
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-3 text-xs text-slate-500">
            <span className="rounded-full bg-white/75 px-3 py-2">Seleccionado: {selectedCustomer?.name || 'ninguno'}</span>
            <span className="rounded-full bg-white/75 px-3 py-2">Resultados: {customers.length}</span>
          </div>

          <div className="soft-scrollbar mt-6 max-h-[calc(100vh-21rem)] space-y-3 overflow-auto pr-1">
            {visibleCustomers.length ? visibleCustomers.map((customer) => (
              <button
                key={customer.id}
                type="button"
                onClick={() => setForm({
                  ...customer,
                  credit_limit: String(customer.credit_limit || 0)
                })}
                className={`w-full rounded-[24px] p-4 text-left transition ${
                  selectedCustomer?.id === customer.id ? 'bg-ink text-white shadow-soft' : 'bg-white/78 hover:bg-white'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{customer.name}</div>
                    <div className={`mt-1 text-xs ${selectedCustomer?.id === customer.id ? 'text-white/75' : 'text-slate-500'}`}>
                      {customer.phone || 'Sin telefono'} | {customer.rnc || 'Sin RNC'}
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-semibold">Limite: {formatCurrency(customer.credit_limit)}</div>
                    <div className={selectedCustomer?.id === customer.id ? 'text-white/75' : Number(customer.balance) > 0 ? 'text-rosewood' : 'text-slate-500'}>
                      Saldo: {formatCurrency(customer.balance)}
                    </div>
                  </div>
                </div>
              </button>
            )) : (
              <div className="rounded-[24px] bg-white/78 px-4 py-5 text-sm text-slate-500">
                No se encontraron clientes con ese criterio.
              </div>
            )}
          </div>
          {customers.length > visibleCustomerCount ? (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-[22px] bg-white/72 px-4 py-3">
              <div className="text-sm text-slate-600">
                Mostrando {visibleCustomerCount} de {customers.length} cliente(s).
              </div>
              <Button variant="secondary" onClick={() => setVisibleCustomerCount((current) => current + 30)}>
                Mostrar mas
              </Button>
            </div>
          ) : null}
        </Panel>

        <div className="space-y-6">
          <Panel>
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500">
                  {form.id ? 'Editar cliente' : 'Nuevo cliente'}
                </div>
                <h3 className="mt-2 text-2xl font-bold text-ink">
                  {selectedCustomer ? selectedCustomer.name : 'Registrar nuevo cliente'}
                </h3>
                <div className="mt-2 text-sm text-slate-500">
                  Completa los datos principales y deja listo el contacto para credito, soporte o cobro.
                </div>
              </div>
              <div className="rounded-[24px] bg-white/78 px-5 py-4 text-right">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Estado de cartera</div>
                <div className={`mt-2 text-2xl font-bold ${Number(selectedCustomer?.balance || 0) > 0 ? 'text-rosewood' : 'text-emerald-700'}`}>
                  {selectedCustomer ? formatCurrency(selectedCustomer.balance) : formatCurrency(0)}
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[24px] bg-white/78 p-5">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Telefono</div>
                <div className="mt-2 text-lg font-bold text-ink">{selectedCustomer?.phone || 'Sin telefono'}</div>
              </div>
              <div className="rounded-[24px] bg-white/78 p-5">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">RNC</div>
                <div className="mt-2 text-lg font-bold text-ink">{selectedCustomer?.rnc || 'No registrado'}</div>
              </div>
              <div className="rounded-[24px] bg-white/78 p-5">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Limite de credito</div>
                <div className="mt-2 text-lg font-bold text-ink">
                  {selectedCustomer ? formatCurrency(selectedCustomer.credit_limit) : formatCurrency(form.credit_limit || 0)}
                </div>
              </div>
              <div className="rounded-[24px] bg-white/78 p-5">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">WhatsApp</div>
                <div className="mt-2 text-sm font-semibold text-slate-700">
                  {selectedCustomer?.phone ? 'Disponible para envio' : 'Requiere telefono'}
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 grid gap-5">
              <div className="grid gap-4 xl:grid-cols-2">
                <Field label="Nombre">
                  <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
                </Field>
                <Field label="Telefono">
                  <Input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
                </Field>
                <Field label="RNC">
                  <Input value={form.rnc} onChange={(event) => setForm((current) => ({ ...current, rnc: event.target.value }))} />
                </Field>
                <Field label="Email">
                  <Input value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
                </Field>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr),220px]">
                <Field label="Direccion">
                  <TextArea rows={5} value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} />
                </Field>
                <div className="rounded-[24px] bg-white/78 p-5">
                  <Field label="Limite de credito">
                    <Input
                      type="number"
                      step="0.01"
                      value={form.credit_limit}
                      onChange={(event) => setForm((current) => ({ ...current, credit_limit: event.target.value }))}
                    />
                  </Field>
                  <div className="mt-4 text-sm text-slate-500">
                    Ajusta aqui el tope permitido para ventas a credito del cliente.
                  </div>
                </div>
              </div>

              {message ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {message}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Guardando...' : form.id ? 'Actualizar cliente' : 'Crear cliente'}
                </Button>
                <Button variant="secondary" disabled={!selectedCustomer || sendingWhatsapp} onClick={sendStatement}>
                  {sendingWhatsapp ? 'Preparando WhatsApp...' : 'Enviar estado por WhatsApp'}
                </Button>
                <Button variant="ghost" onClick={() => setForm(emptyForm)}>
                  Limpiar
                </Button>
              </div>
            </form>
          </Panel>
        </div>
      </div>
    </div>
  );
}
