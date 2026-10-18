import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../lib/api';
import Button from '../ui/Button';
import { Field, Input, TextArea } from '../ui/Field';
import Panel from '../ui/Panel';

const emptyForm = {
  id: null,
  name: '',
  contact: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
  active: true
};

export default function SuppliersPanel({ token, onActivity }) {
  const [suppliers, setSuppliers] = useState([]);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const selectedSupplier = suppliers.find((supplier) => supplier.id === form.id) || null;
  const activeSuppliers = useMemo(
    () => suppliers.filter((supplier) => Number(supplier.active) === 1).length,
    [suppliers]
  );

  async function loadSuppliers(search = '') {
    const result = await apiRequest(`/api/suppliers?q=${encodeURIComponent(search)}`, { token });
    setSuppliers(result);
  }

  useEffect(() => {
    loadSuppliers();
  }, [token]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      if (form.id) {
        await apiRequest(`/api/suppliers/${form.id}`, {
          method: 'PUT',
          body: form,
          token
        });
        setMessage('Proveedor actualizado.');
      } else {
        await apiRequest('/api/suppliers', {
          method: 'POST',
          body: form,
          token
        });
        setMessage('Proveedor creado.');
      }

      setForm(emptyForm);
      await loadSuppliers(query);
      onActivity?.();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  function startNewSupplier() {
    setForm(emptyForm);
    setMessage('');
  }

  return (
    <div className="space-y-6">
      <Panel>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-3xl">
            <h2 className="text-4xl font-bold text-ink">Proveedores</h2>
            <p className="mt-3 text-sm text-slate-600">
              Gestiona tus suplidores de productos, carnes, embutidos, lácteos y más.
            </p>
          </div>
          <Button onClick={startNewSupplier}>＋ Nuevo proveedor</Button>
        </div>
      </Panel>

      <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[24px] border border-slate-200 bg-white/80 px-5 py-4">
              <div className="text-sm font-medium text-slate-600">Proveedores activos</div>
              <div className="mt-2 text-3xl font-bold text-ink">{activeSuppliers}</div>
              <div className="mt-1 text-xs text-emerald-600">disponibles para comprar</div>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-white/80 px-5 py-4">
              <div className="text-sm font-medium text-slate-600">Total de proveedores</div>
              <div className="mt-2 text-3xl font-bold text-ink">{suppliers.length}</div>
              <div className="mt-1 text-xs text-slate-500">en el directorio</div>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-white/80 px-5 py-4">
              <div className="text-sm font-medium text-slate-600">Proveedor seleccionado</div>
              <div className="mt-2 truncate text-xl font-bold text-ink">{selectedSupplier?.name || 'Ninguno'}</div>
              <div className="mt-1 text-xs text-slate-500">elige una fila para editar</div>
            </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(320px,0.96fr),minmax(0,1.04fr)]">
        <Panel className="overflow-hidden">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-2xl font-bold text-ink">Listado de proveedores</h3>
            </div>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  loadSuppliers(event.currentTarget.value);
                }
              }}
              placeholder="Buscar proveedores por nombre, contacto o teléfono..."
            />
          </div>

          <div className="mt-6 hidden grid-cols-[minmax(0,1.4fr),minmax(0,1fr),110px] gap-4 border-b border-slate-200 px-4 pb-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 md:grid">
            <span>Empresa</span><span>Contacto</span><span>Estado</span>
          </div>
          <div className="soft-scrollbar mt-2 max-h-[calc(100vh-23rem)] space-y-2 overflow-auto pr-1">
            {suppliers.length ? suppliers.map((supplier) => (
              <button
                key={supplier.id}
                type="button"
                onClick={() => setForm({ ...supplier, active: Boolean(supplier.active) })}
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  selectedSupplier?.id === supplier.id ? 'bg-ink text-white shadow-soft' : 'bg-white/78 hover:bg-white'
                }`}
              >
                <div className="grid items-center gap-3 md:grid-cols-[minmax(0,1.4fr),minmax(0,1fr),110px]">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{supplier.name}</div>
                    <div className={`mt-1 text-xs ${selectedSupplier?.id === supplier.id ? 'text-white/75' : 'text-slate-500'}`}>
                      Proveedor de productos
                    </div>
                  </div>
                  <div className={`text-sm ${selectedSupplier?.id === supplier.id ? 'text-white/85' : 'text-slate-700'}`}>
                    <div>{supplier.contact || 'Sin contacto'}</div>
                    <div className="mt-1 text-xs opacity-75">{supplier.phone || 'Sin teléfono'}</div>
                  </div>
                  <div className={`text-xs font-semibold uppercase ${selectedSupplier?.id === supplier.id ? 'text-white/75' : supplier.active ? 'text-emerald-700' : 'text-slate-400'}`}>
                    {supplier.active ? 'Activo' : 'Inactivo'}
                  </div>
                </div>
              </button>
            )) : (
              <div className="rounded-[24px] bg-white/78 px-4 py-5 text-sm text-slate-500">
                No se encontraron proveedores con ese criterio.
              </div>
            )}
          </div>
        </Panel>

        <Panel>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-slate-500">
                {form.id ? 'Editar proveedor' : 'Nuevo proveedor'}
              </div>
              <h3 className="mt-2 text-2xl font-bold text-ink">
                {selectedSupplier ? selectedSupplier.name : 'Registrar proveedor'}
              </h3>
            </div>
            <div className="rounded-[24px] bg-white/78 px-5 py-4 text-right">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Estado</div>
              <div className={`mt-2 text-lg font-bold ${form.active ? 'text-emerald-700' : 'text-slate-500'}`}>
                {form.active ? 'Activo' : 'Inactivo'}
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 grid gap-5">
            <Field label="Nombre">
              <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Contacto">
                <Input value={form.contact} onChange={(event) => setForm((current) => ({ ...current, contact: event.target.value }))} />
              </Field>
              <Field label="Telefono">
                <Input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
              </Field>
              <Field label="Email">
                <Input value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
              </Field>
              <label className="flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-4 text-sm font-semibold text-slate-700">
                <input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} />
                Proveedor activo
              </label>
            </div>
            <Field label="Direccion">
              <TextArea rows={3} value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} />
            </Field>
            <Field label="Notas">
              <TextArea rows={3} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
            </Field>

            {message ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {message}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? 'Guardando...' : form.id ? 'Actualizar proveedor' : 'Crear proveedor'}
              </Button>
              <Button variant="ghost" onClick={() => setForm(emptyForm)}>
                Limpiar
              </Button>
            </div>
          </form>
        </Panel>
      </div>
    </div>
  );
}
