import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../lib/api';
import Button from '../ui/Button';
import { Field, Input, Select } from '../ui/Field';
import Panel from '../ui/Panel';

const emptyForm = {
  id: null,
  name: '',
  type: 'percentage',
  value: '',
  applies_to: 'all',
  target_id: '',
  start_date: '',
  end_date: '',
  active: true
};

export default function DiscountsPanel({ token, onActivity }) {
  const [discounts, setDiscounts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const selectedDiscount = discounts.find((discount) => discount.id === form.id) || null;
  const activeDiscounts = useMemo(
    () => discounts.filter((discount) => Number(discount.active) === 1).length,
    [discounts]
  );

  async function loadDiscounts() {
    const result = await apiRequest('/api/discounts', { token });
    setDiscounts(result);
  }

  useEffect(() => {
    loadDiscounts();
  }, [token]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const payload = {
        ...form,
        value: Number(form.value || 0)
      };

      if (form.id) {
        await apiRequest(`/api/discounts/${form.id}`, {
          method: 'PUT',
          body: payload,
          token
        });
        setMessage('Descuento actualizado.');
      } else {
        await apiRequest('/api/discounts', {
          method: 'POST',
          body: payload,
          token
        });
        setMessage('Descuento creado.');
      }

      setForm(emptyForm);
      await loadDiscounts();
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
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Promociones</div>
            <h2 className="mt-2 text-3xl font-bold text-ink">Descuentos automaticos</h2>
            <p className="mt-3 text-sm text-slate-600">
              Crea reglas comerciales limpias para porcentaje, monto fijo o promociones de tipo 2x1.
            </p>
          </div>
          <div className="grid w-full gap-3 sm:grid-cols-3 xl:w-auto xl:min-w-[520px]">
            <div className="rounded-[24px] bg-white/78 px-5 py-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Promociones</div>
              <div className="mt-2 text-2xl font-bold text-ink">{discounts.length}</div>
            </div>
            <div className="rounded-[24px] bg-white/78 px-5 py-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Activas</div>
              <div className="mt-2 text-2xl font-bold text-emerald-700">{activeDiscounts}</div>
            </div>
            <div className="rounded-[24px] bg-white/78 px-5 py-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Seleccionada</div>
              <div className="mt-2 truncate text-lg font-bold text-ink">{selectedDiscount?.name || 'Ninguna'}</div>
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[minmax(320px,0.96fr),minmax(0,1.04fr)]">
        <Panel className="overflow-hidden">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Listado</div>
            <h3 className="mt-2 text-2xl font-bold text-ink">Reglas de descuento</h3>
          </div>
          <div className="soft-scrollbar mt-6 max-h-[calc(100vh-23rem)] space-y-3 overflow-auto pr-1">
            {discounts.length ? discounts.map((discount) => (
              <button
                key={discount.id}
                type="button"
                onClick={() => setForm({
                  ...discount,
                  value: String(discount.value || 0),
                  active: Boolean(discount.active),
                  target_id: discount.target_id || '',
                  start_date: discount.start_date || '',
                  end_date: discount.end_date || ''
                })}
                className={`w-full rounded-[24px] p-4 text-left transition ${
                  selectedDiscount?.id === discount.id ? 'bg-ink text-white shadow-soft' : 'bg-white/78 hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{discount.name}</div>
                    <div className={`mt-1 text-xs ${selectedDiscount?.id === discount.id ? 'text-white/75' : 'text-slate-500'}`}>
                      {discount.type} | {discount.applies_to} | {discount.target_id || 'general'}
                    </div>
                  </div>
                  <div className={`text-xs font-semibold uppercase ${selectedDiscount?.id === discount.id ? 'text-white/75' : discount.active ? 'text-emerald-700' : 'text-slate-400'}`}>
                    {discount.active ? 'Activo' : 'Inactivo'}
                  </div>
                </div>
              </button>
            )) : (
              <div className="rounded-[24px] bg-white/78 px-4 py-5 text-sm text-slate-500">
                Todavia no hay descuentos configurados.
              </div>
            )}
          </div>
        </Panel>

        <Panel>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-slate-500">
                {form.id ? 'Editar descuento' : 'Nuevo descuento'}
              </div>
              <h3 className="mt-2 text-2xl font-bold text-ink">
                {selectedDiscount ? selectedDiscount.name : 'Crear regla comercial'}
              </h3>
            </div>
            <div className="rounded-[24px] bg-white/78 px-5 py-4 text-right">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Estado</div>
              <div className={`mt-2 text-lg font-bold ${form.active ? 'text-emerald-700' : 'text-slate-500'}`}>
                {form.active ? 'Activo' : 'Inactivo'}
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
            <Field label="Nombre">
              <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Tipo">
                <Select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}>
                  <option value="percentage">Porcentaje</option>
                  <option value="fixed">Monto fijo</option>
                  <option value="2x1">2x1</option>
                </Select>
              </Field>
              <Field label="Valor">
                <Input type="number" step="0.01" value={form.value} onChange={(event) => setForm((current) => ({ ...current, value: event.target.value }))} />
              </Field>
              <Field label="Aplica a">
                <Select value={form.applies_to} onChange={(event) => setForm((current) => ({ ...current, applies_to: event.target.value }))}>
                  <option value="all">Todos</option>
                  <option value="category">Categoria</option>
                  <option value="product">Producto</option>
                  <option value="customer">Cliente</option>
                </Select>
              </Field>
              <Field label="Target ID / categoria">
                <Input value={form.target_id} onChange={(event) => setForm((current) => ({ ...current, target_id: event.target.value }))} />
              </Field>
              <Field label="Inicio">
                <Input type="date" value={form.start_date} onChange={(event) => setForm((current) => ({ ...current, start_date: event.target.value }))} />
              </Field>
              <Field label="Fin">
                <Input type="date" value={form.end_date} onChange={(event) => setForm((current) => ({ ...current, end_date: event.target.value }))} />
              </Field>
            </div>

            <label className="flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-4 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} />
              Descuento activo
            </label>

            {message ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {message}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? 'Guardando...' : form.id ? 'Actualizar descuento' : 'Crear descuento'}
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
