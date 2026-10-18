import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { formatCurrency, formatDateTime } from '../../lib/format';
import Button from '../ui/Button';
import { Field, Input, Select } from '../ui/Field';
import Panel from '../ui/Panel';
import TicketPreview from '../ui/TicketPreview';

export default function ReturnsPanel({ token, onActivity }) {
  const [search, setSearch] = useState('');
  const [sales, setSales] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedSale, setSelectedSale] = useState(null);
  const [returns, setReturns] = useState([]);
  const [historySearch, setHistorySearch] = useState('');
  const [reason, setReason] = useState('');
  const [refundMethod, setRefundMethod] = useState('cash');
  const [lines, setLines] = useState({});
  const [message, setMessage] = useState('');
  const [notePreview, setNotePreview] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function loadReturns() {
    const result = await apiRequest('/api/returns', { token });
    setReturns(result);
  }

  async function loadSales(query = '') {
    const result = await apiRequest(`/api/returns/lookup?q=${encodeURIComponent(query)}`, { token });
    setSales(result);
    if (!result.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !result.some((sale) => sale.id === selectedId)) {
      setSelectedId(result[0].id);
    }
  }

  useEffect(() => {
    loadSales();
    loadReturns();
  }, [token]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedSale(null);
      setLines({});
      return;
    }

    apiRequest(`/api/returns/lookup/${selectedId}`, { token })
      .then((result) => {
        setSelectedSale(result);
        const nextLines = {};
        result.items.forEach((item) => {
          nextLines[item.product_id] = {
            quantity: '',
            restock: true
          };
        });
        setLines(nextLines);
      })
      .catch((error) => setMessage(error.message));
  }, [selectedId, token]);

  function updateLine(productId, patch) {
    setLines((current) => ({
      ...current,
      [productId]: {
        ...current[productId],
        ...patch
      }
    }));
  }

  async function registerReturn() {
    if (!selectedSale) {
      return;
    }

    setSubmitting(true);
    setMessage('');

    try {
      const items = selectedSale.items
        .map((item) => ({
          productId: item.product_id,
          quantity: Number(lines[item.product_id]?.quantity || 0),
          restock: Boolean(lines[item.product_id]?.restock)
        }))
        .filter((item) => item.quantity > 0);

      const result = await apiRequest('/api/returns', {
        method: 'POST',
        token,
        body: {
          saleId: selectedSale.id,
          reason,
          refundMethod,
          items
        }
      });

      setNotePreview(result.notePreview);
      setMessage(
        result.printResult?.attempted
          ? `Devolucion registrada. Nota ${result.returnNumber}. ${result.printResult.message}`
          : `Devolucion registrada. Nota ${result.returnNumber}`
      );
      setReason('');
      setRefundMethod('cash');
      await loadSales(search);
      await loadReturns();
      const refreshed = await apiRequest(`/api/returns/lookup/${selectedSale.id}`, { token });
      setSelectedSale(refreshed);
      const nextLines = {};
      refreshed.items.forEach((item) => {
        nextLines[item.product_id] = { quantity: '', restock: true };
      });
      setLines(nextLines);
      onActivity?.();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function reprintReturn(returnId) {
    try {
      const result = await apiRequest(`/api/returns/${returnId}/reprint`, { token });
      setNotePreview(result.notePreview);
      setMessage(result.printResult?.message || 'Nota de devolucion reimpresa.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  function startNewReturn() {
    setMessage('');
    setReason('');
    setRefundMethod('cash');
    setSearch('');
    loadSales('');
  }

  const todayKey = new Date().toISOString().slice(0, 10);
  const returnsToday = returns.filter((entry) => String(entry.created_at || '').slice(0, 10) === todayKey).length;
  const returnedTotal = returns.reduce((sum, entry) => sum + Number(entry.total || 0), 0);
  const pendingReturns = returns.filter((entry) => entry.status && entry.status !== 'completed').length;
  const visibleReturns = returns.filter((entry) => {
    const needle = historySearch.trim().toLowerCase();
    if (!needle) return true;
    return [entry.invoice_number, entry.customer_name, entry.product_names, entry.reason]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle));
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-3xl font-bold text-ink">Devoluciones</h2>
          <p className="mt-2 text-sm text-slate-600">Gestiona devoluciones de productos y reembolsos de tus clientes.</p>
        </div>
        <Button onClick={startNewReturn}>＋ Nueva devolución</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[24px] border border-emerald-100 bg-emerald-50/65 p-5">
          <div className="text-sm text-slate-600">Devoluciones de hoy</div>
          <div className="mt-2 text-3xl font-bold text-ink">{returnsToday}</div>
          <div className="mt-1 text-xs text-emerald-700">{returns.length} registradas en total</div>
        </div>
        <div className="rounded-[24px] border border-blue-100 bg-blue-50/65 p-5">
          <div className="text-sm text-slate-600">Monto devuelto</div>
          <div className="mt-2 text-3xl font-bold text-ink">{formatCurrency(returnedTotal)}</div>
          <div className="mt-1 text-xs text-blue-700">Reembolsos registrados</div>
        </div>
        <div className="rounded-[24px] border border-amber-100 bg-amber-50/70 p-5">
          <div className="text-sm text-slate-600">Pendientes</div>
          <div className="mt-2 text-3xl font-bold text-ink">{pendingReturns}</div>
          <div className="mt-1 text-xs text-amber-700">Por procesar</div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.18fr),minmax(340px,0.82fr)]">
        <Panel className="overflow-hidden">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <h3 className="text-2xl font-bold text-ink">Historial de devoluciones</h3>
            <Input value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} placeholder="Factura, cliente o producto..." />
          </div>
          <div className="mt-5 overflow-x-auto">
              <div className="min-w-[780px]">
              <div className="grid grid-cols-[0.95fr,1.1fr,1.4fr,0.9fr,0.8fr,0.8fr,0.7fr] gap-3 border-b border-slate-100 px-3 pb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <span>Factura</span><span>Cliente</span><span>Producto(s)</span><span>Motivo</span><span>Monto</span><span>Estado</span><span>Fecha</span>
              </div>
              <div className="divide-y divide-slate-100">
                {visibleReturns.length ? visibleReturns.map((entry) => (
                  <div key={entry.id} className="grid grid-cols-[0.95fr,1.1fr,1.4fr,0.9fr,0.8fr,0.8fr,0.7fr] items-center gap-3 px-3 py-4 text-sm">
                    <div className="font-semibold text-ink">#{entry.invoice_number || '—'}<div className="mt-1 text-xs text-slate-500">DEV-{String(entry.id).padStart(5, '0')}</div></div>
                    <div className="truncate text-slate-700">{entry.customer_name || 'Consumidor final'}</div>
                    <div className="truncate text-slate-700" title={entry.product_names || ''}>{entry.product_names || 'Producto devuelto'}</div>
                    <div className="truncate text-slate-500">{entry.reason || 'No indicado'}</div>
                    <div className="font-semibold text-ink">{formatCurrency(entry.total)}</div>
                    <div><span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${entry.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{entry.status === 'completed' ? 'Completada' : 'Pendiente'}</span></div>
                    <div className="text-xs text-slate-500">{formatDateTime(entry.created_at)}</div>
                    <div className="col-span-7 flex justify-end pt-1"><Button variant="ghost" onClick={() => reprintReturn(entry.id)}>Reimprimir nota</Button></div>
                  </div>
                )) : <div className="px-3 py-8 text-sm text-slate-500">Todavía no hay devoluciones registradas.</div>}
              </div>
            </div>
          </div>
          {visibleReturns.length ? <div className="mt-4 text-xs text-slate-500">Mostrando {visibleReturns.length} de {returns.length} devoluciones</div> : null}
        </Panel>

        <div className="space-y-6">
          <Panel className="overflow-hidden">
            <h3 className="text-2xl font-bold text-ink">Procesar devolución</h3>
            <div className="mt-5">
              <Field label="Factura de origen">
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') loadSales(event.currentTarget.value);
                  }}
                  placeholder="Buscar factura o cliente..."
                />
              </Field>
            </div>
            <div className="soft-scrollbar mt-3 max-h-36 space-y-2 overflow-auto pr-1">
              {sales.slice(0, 5).map((sale) => (
                <button key={sale.id} type="button" onClick={() => setSelectedId(sale.id)} className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs ${selectedId === sale.id ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-50 text-slate-700'}`}>
                  <span className="font-semibold">#{sale.invoice_number} · {sale.customer_name || 'Consumidor final'}</span>
                  <span>{formatCurrency(sale.total)}</span>
                </button>
              ))}
            </div>
            {selectedSale ? <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
              <div><span className="font-semibold">Cliente:</span> {selectedSale.customer_name || 'Consumidor final'}</div>
              <div className="mt-1"><span className="font-semibold">Fecha:</span> {formatDateTime(selectedSale.created_at)}</div>
              <div className="mt-1"><span className="font-semibold">Total factura:</span> {formatCurrency(selectedSale.total)}</div>
            </div> : <div className="mt-4 text-sm text-slate-500">Selecciona una factura para procesar la devolución.</div>}
          </Panel>

          {selectedSale ? (
            <>
              <Panel className="overflow-hidden">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-lg font-bold text-ink">Productos a devolver</h4>
                  <span className="text-xs text-slate-500">Factura #{selectedSale.invoice_number}</span>
                </div>
                <div className="soft-scrollbar mt-4 max-h-[360px] space-y-3 overflow-auto pr-1">
                  {selectedSale.items.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-slate-100 bg-white/80 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold text-slate-800">{item.product_name}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            Vendido: {item.quantity} | Disponible a devolver: {item.available_quantity}
                          </div>
                        </div>
                        <div className="text-sm font-semibold text-ink">{formatCurrency(item.unit_price)}</div>
                      </div>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <Field label="Cantidad a devolver">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={lines[item.product_id]?.quantity || ''}
                            onChange={(event) => updateLine(item.product_id, { quantity: event.target.value })}
                          />
                        </Field>
                        <label className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-700">
                          <input
                            type="checkbox"
                            checked={Boolean(lines[item.product_id]?.restock)}
                            onChange={(event) => updateLine(item.product_id, { restock: event.target.checked })}
                          />
                          Reintegrar al inventario
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel>
                <div className="space-y-4">
                  <Field label="Motivo de la devolución">
                    <Select value={reason} onChange={(event) => setReason(event.target.value)}>
                      <option value="">Selecciona un motivo</option>
                      <option value="Producto en mal estado">Producto en mal estado</option>
                      <option value="No era lo que esperaba">No era lo que esperaba</option>
                      <option value="Error en la compra">Error en la compra</option>
                      <option value="Cantidad incorrecta">Cantidad incorrecta</option>
                    </Select>
                  </Field>
                  <div>
                    <div className="mb-2 text-sm font-semibold text-slate-700">Método de reembolso</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {[['cash', 'Efectivo'], ['credit_note', 'Crédito en tienda'], ['exchange', 'Cambio de producto'], ['transfer', 'Transferencia / Otro']].map(([value, label]) => (
                        <label key={value} className="flex items-center gap-2 rounded-xl border border-slate-100 px-3 py-2 text-sm text-slate-700">
                          <input type="radio" name="refund-method" value={value} checked={refundMethod === value} onChange={(event) => setRefundMethod(event.target.value)} />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <Button disabled={submitting} onClick={registerReturn}>
                    {submitting ? 'Registrando...' : '✓ Confirmar devolución'}
                  </Button>
                </div>
              </Panel>
            </>
          ) : (
            <Panel>
              <div className="text-sm text-slate-500">Selecciona una venta para procesar la devolucion.</div>
            </Panel>
          )}

          {message ? (
            <Panel>
              <div className="text-sm font-semibold text-amber-800">{message}</div>
            </Panel>
          ) : null}
        </div>
      </div>

      <TicketPreview title="Nota de devolucion" content={notePreview} />
    </div>
  );
}
