import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { formatCurrency, formatDateTime } from '../../lib/format';
import Button from '../ui/Button';
import { Field, Input, Select, TextArea } from '../ui/Field';
import Panel from '../ui/Panel';
import TicketPreview from '../ui/TicketPreview';

export default function ReturnsPanel({ token, onActivity }) {
  const [search, setSearch] = useState('');
  const [sales, setSales] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedSale, setSelectedSale] = useState(null);
  const [returns, setReturns] = useState([]);
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

  return (
    <div className="space-y-6">
      <Panel>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Devoluciones</div>
            <h2 className="mt-2 text-3xl font-bold text-ink">Procesar devoluciones</h2>
            <p className="mt-3 text-sm text-slate-600">
              Busca una venta, selecciona los items a devolver y genera la nota sin perder el historial reciente.
            </p>
          </div>
          <div className="grid w-full gap-3 sm:grid-cols-3 xl:w-auto xl:min-w-[520px]">
            <div className="rounded-[24px] bg-white/78 px-5 py-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Ventas encontradas</div>
              <div className="mt-2 text-2xl font-bold text-ink">{sales.length}</div>
            </div>
            <div className="rounded-[24px] bg-white/78 px-5 py-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Historial</div>
              <div className="mt-2 text-2xl font-bold text-ink">{returns.length}</div>
            </div>
            <div className="rounded-[24px] bg-white/78 px-5 py-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Factura actual</div>
              <div className="mt-2 truncate text-lg font-bold text-ink">{selectedSale?.invoice_number || 'Sin seleccionar'}</div>
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[minmax(320px,0.92fr),minmax(0,1.08fr)]">
        <Panel className="overflow-hidden">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Buscar venta</div>
              <h3 className="mt-2 text-2xl font-bold text-ink">Facturas elegibles</h3>
            </div>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  loadSales(event.currentTarget.value);
                }
              }}
              placeholder="Factura o cliente"
            />
          </div>

          <div className="soft-scrollbar mt-6 max-h-[calc(100vh-21rem)] space-y-3 overflow-auto pr-1">
            {sales.length ? sales.map((sale) => (
              <button
                key={sale.id}
                type="button"
                onClick={() => setSelectedId(sale.id)}
                className={`w-full rounded-[24px] p-4 text-left transition ${selectedId === sale.id ? 'bg-ink text-white shadow-soft' : 'bg-white/78 hover:bg-white'}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{sale.customer_name || 'Consumidor final'}</div>
                    <div className={`mt-1 text-xs ${selectedId === sale.id ? 'text-white/75' : 'text-slate-500'}`}>
                      Factura #{sale.invoice_number}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatCurrency(sale.total)}</div>
                    <div className={`mt-1 text-xs ${selectedId === sale.id ? 'text-white/75' : 'text-slate-500'}`}>
                      {formatDateTime(sale.created_at)}
                    </div>
                  </div>
                </div>
              </button>
            )) : (
              <div className="rounded-[24px] bg-white/78 px-4 py-5 text-sm text-slate-500">
                No se encontraron ventas para devolver.
              </div>
            )}
          </div>
        </Panel>

        <div className="space-y-6">
          {selectedSale ? (
            <>
              <Panel className="overflow-hidden">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Detalle de venta</div>
                    <h3 className="mt-2 text-2xl font-bold text-ink">Factura #{selectedSale.invoice_number}</h3>
                    <div className="mt-2 text-sm text-slate-500">
                      {selectedSale.customer_name || 'Consumidor final'} | {formatDateTime(selectedSale.created_at)}
                    </div>
                  </div>
                  <div className="rounded-[24px] bg-white/78 px-5 py-4 text-right">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Total original</div>
                    <div className="mt-2 text-2xl font-bold text-ink">{formatCurrency(selectedSale.total)}</div>
                  </div>
                </div>

                <div className="soft-scrollbar mt-6 max-h-[420px] space-y-4 overflow-auto pr-1">
                  {selectedSale.items.map((item) => (
                    <div key={item.id} className="rounded-[24px] bg-white/78 p-4">
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
                        <label className="flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-4 text-sm font-semibold text-slate-700">
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
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr),240px]">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Metodo de reembolso">
                      <Select value={refundMethod} onChange={(event) => setRefundMethod(event.target.value)}>
                        <option value="cash">Efectivo</option>
                        <option value="credit_note">Nota de credito</option>
                        <option value="exchange">Cambio de producto</option>
                      </Select>
                    </Field>
                    <Field label="Motivo">
                      <TextArea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
                    </Field>
                  </div>

                  <div className="rounded-[24px] bg-white/78 p-5">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Accion principal</div>
                    <div className="mt-3 text-sm text-slate-500">
                      Guarda la devolucion y genera la nota para impresion o reimpresion posterior.
                    </div>
                    <div className="mt-5">
                      <Button disabled={submitting} onClick={registerReturn}>
                        {submitting ? 'Registrando...' : 'Guardar devolucion'}
                      </Button>
                    </div>
                  </div>
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

      <Panel className="overflow-hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Historial reciente</div>
          <div className="rounded-full bg-white/75 px-3 py-2 text-xs text-slate-500">{returns.length} nota(s)</div>
        </div>
        <div className="soft-scrollbar mt-5 max-h-[320px] grid gap-3 overflow-auto pr-1 md:grid-cols-2 xl:grid-cols-3">
          {returns.length ? returns.map((entry) => (
            <div key={entry.id} className="rounded-[24px] bg-white/78 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold text-slate-800">{entry.customer_name || 'Consumidor final'}</div>
                <Button variant="ghost" onClick={() => reprintReturn(entry.id)}>
                  Reimprimir
                </Button>
              </div>
              <div className="mt-1 text-xs text-slate-500">Factura #{entry.invoice_number}</div>
              <div className="mt-3 text-sm font-semibold text-ink">{formatCurrency(entry.total)}</div>
              <div className="mt-1 text-xs text-slate-500">{formatDateTime(entry.created_at)}</div>
            </div>
          )) : (
            <div className="rounded-[24px] bg-white/78 px-4 py-5 text-sm text-slate-500">
              Todavia no hay devoluciones registradas.
            </div>
          )}
        </div>
      </Panel>

      <TicketPreview title="Nota de devolucion" content={notePreview} />
    </div>
  );
}
