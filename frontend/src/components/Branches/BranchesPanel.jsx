import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../lib/api';
import Button from '../ui/Button';
import { Field, Input, TextArea } from '../ui/Field';
import Panel from '../ui/Panel';

const emptyForm = {
  id: null,
  name: '',
  address: '',
  phone: '',
  active: true
};

export default function BranchesPanel({ token, onActivity }) {
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const selectedBranch = branches.find((branch) => branch.id === form.id) || null;
  const activeBranches = useMemo(
    () => branches.filter((branch) => Number(branch.active) === 1).length,
    [branches]
  );

  async function loadBranches() {
    const result = await apiRequest('/api/branches', { token });
    setBranches(result);
  }

  useEffect(() => {
    loadBranches();
  }, [token]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      if (form.id) {
        await apiRequest(`/api/branches/${form.id}`, {
          method: 'PUT',
          body: form,
          token
        });
        setMessage('Sucursal actualizada.');
      } else {
        await apiRequest('/api/branches', {
          method: 'POST',
          body: form,
          token
        });
        setMessage('Sucursal creada.');
      }

      setForm(emptyForm);
      await loadBranches();
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
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Sucursales</div>
            <h2 className="mt-2 text-3xl font-bold text-ink">Gestion de sucursales</h2>
            <p className="mt-3 text-sm text-slate-600">
              Define las sedes operativas del negocio y mantienelas ordenadas dentro del centro de configuracion.
            </p>
          </div>
          <div className="grid w-full gap-3 sm:grid-cols-3 xl:w-auto xl:min-w-[520px]">
            <div className="rounded-[24px] bg-white/78 px-5 py-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Sucursales</div>
              <div className="mt-2 text-2xl font-bold text-ink">{branches.length}</div>
            </div>
            <div className="rounded-[24px] bg-white/78 px-5 py-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Activas</div>
              <div className="mt-2 text-2xl font-bold text-emerald-700">{activeBranches}</div>
            </div>
            <div className="rounded-[24px] bg-white/78 px-5 py-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Seleccionada</div>
              <div className="mt-2 truncate text-lg font-bold text-ink">{selectedBranch?.name || 'Ninguna'}</div>
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[minmax(320px,0.96fr),minmax(0,1.04fr)]">
        <Panel className="overflow-hidden">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Directorio</div>
            <h3 className="mt-2 text-2xl font-bold text-ink">Listado de sucursales</h3>
          </div>
          <div className="soft-scrollbar mt-6 max-h-[calc(100vh-25rem)] space-y-3 overflow-auto pr-1">
            {branches.length ? branches.map((branch) => (
              <button
                key={branch.id}
                type="button"
                onClick={() => setForm({ ...branch, active: Boolean(branch.active) })}
                className={`w-full rounded-[24px] p-4 text-left transition ${
                  selectedBranch?.id === branch.id ? 'bg-ink text-white shadow-soft' : 'bg-white/78 hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{branch.name}</div>
                    <div className={`mt-1 text-xs ${selectedBranch?.id === branch.id ? 'text-white/75' : 'text-slate-500'}`}>
                      {branch.phone || 'Sin telefono'} | {branch.address || 'Sin direccion'}
                    </div>
                  </div>
                  <div className={`text-xs font-semibold uppercase ${selectedBranch?.id === branch.id ? 'text-white/75' : branch.active ? 'text-emerald-700' : 'text-slate-400'}`}>
                    {branch.active ? 'Activa' : 'Inactiva'}
                  </div>
                </div>
              </button>
            )) : (
              <div className="rounded-[24px] bg-white/78 px-4 py-5 text-sm text-slate-500">
                Todavia no hay sucursales registradas.
              </div>
            )}
          </div>
        </Panel>

        <Panel>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-slate-500">
                {form.id ? 'Editar sucursal' : 'Nueva sucursal'}
              </div>
              <h3 className="mt-2 text-2xl font-bold text-ink">
                {selectedBranch ? selectedBranch.name : 'Registrar sucursal'}
              </h3>
            </div>
            <div className="rounded-[24px] bg-white/78 px-5 py-4 text-right">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Estado</div>
              <div className={`mt-2 text-lg font-bold ${form.active ? 'text-emerald-700' : 'text-slate-500'}`}>
                {form.active ? 'Activa' : 'Inactiva'}
              </div>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
            <Field label="Nombre">
              <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            </Field>
            <Field label="Telefono">
              <Input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
            </Field>
            <Field label="Direccion">
              <TextArea rows={4} value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} />
            </Field>
            <label className="flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-4 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} />
              Sucursal activa
            </label>

            {message ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {message}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? 'Guardando...' : form.id ? 'Actualizar sucursal' : 'Crear sucursal'}
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
