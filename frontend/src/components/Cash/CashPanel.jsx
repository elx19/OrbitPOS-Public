import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';
import Button from '../ui/Button';
import { Field, Input, TextArea } from '../ui/Field';
import Panel from '../ui/Panel';
import TicketPreview from '../ui/TicketPreview';
import { formatCurrency, formatDateTime } from '../../lib/format';

export default function CashPanel({ token, onActivity }) {
  const [current, setCurrent] = useState(null);
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [openingAmount, setOpeningAmount] = useState('2000');
  const [countedAmount, setCountedAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [ticketPreview, setTicketPreview] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadCashData() {
    const [currentData, historyData] = await Promise.all([
      apiRequest('/api/cash/current', { token }),
      apiRequest('/api/cash/history', { token })
    ]);
    setCurrent(currentData.register);
    setSummary(currentData.summary);
    setHistory(historyData);
  }

  useEffect(() => {
    loadCashData();
  }, [token]);

  async function openCash() {
    setSaving(true);
    setMessage('');
    try {
      const result = await apiRequest('/api/cash/open', {
        method: 'POST',
        body: {
          openingAmount: Number(openingAmount || 0),
          notes
        },
        token
      });
      setTicketPreview(result.ticketPreview || '');
      setMessage(
        result.printResult?.attempted
          ? `Caja abierta correctamente. ${result.printResult.message}`
          : 'Caja abierta correctamente.'
      );
      setNotes('');
      await loadCashData();
      onActivity?.();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function closeCash() {
    setSaving(true);
    setMessage('');
    try {
      const result = await apiRequest('/api/cash/close', {
        method: 'POST',
        body: {
          countedAmount: Number(countedAmount || 0),
          notes
        },
        token
      });
      setTicketPreview(result.ticketPreview || '');
      setMessage(
        result.printResult?.attempted
          ? `Caja cerrada correctamente. ${result.printResult.message}`
          : 'Caja cerrada correctamente.'
      );
      setCountedAmount('');
      setNotes('');
      await loadCashData();
      onActivity?.();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function reprintRegister(registerId) {
    try {
      const result = await apiRequest(`/api/cash/${registerId}/reprint`, { token });
      setTicketPreview(result.ticketPreview);
      setMessage(result.printResult?.message || 'Movimiento de caja reimpreso.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <div className="space-y-6">
      <Panel className="p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Operacion de caja</div>
            <h2 className="mt-2 text-3xl font-bold text-ink">
              {current ? 'Caja activa' : 'Preparar apertura'}
            </h2>
            <div className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
              Controla apertura, cierre, resumen de efectivo y el historial reciente de movimientos.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className={`rounded-full px-3 py-1.5 text-xs font-semibold ${current ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
              {current ? 'Caja abierta' : 'Caja cerrada'}
            </div>
            <div className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-600">
              Historial: {history.length} registro(s)
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr),minmax(380px,0.92fr)]">
        <div className="space-y-6">
          <Panel>
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Estado actual</div>
            <h3 className="mt-2 text-2xl font-bold text-ink">
              {current ? 'Caja abierta' : 'Apertura de caja'}
            </h3>

            {!current ? (
              <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr),320px]">
                <div className="space-y-4">
                  <Field label="Monto inicial">
                    <Input type="number" step="0.01" value={openingAmount} onChange={(event) => setOpeningAmount(event.target.value)} />
                  </Field>
                  <Field label="Notas">
                    <TextArea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} />
                  </Field>
                </div>

                <div className="rounded-[24px] bg-white/72 p-5">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Recomendacion</div>
                  <div className="mt-3 text-lg font-semibold text-ink">Verifica efectivo inicial y notas</div>
                  <div className="mt-3 text-sm leading-7 text-slate-600">
                    Antes de abrir, confirma el monto fisico disponible y cualquier observacion operativa del turno.
                  </div>
                  <div className="mt-5">
                    <Button disabled={saving} onClick={openCash}>
                      {saving ? 'Abriendo...' : 'Abrir caja'}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-6 space-y-5">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-[24px] bg-white/78 p-5">
                    <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Sucursal</div>
                    <div className="mt-2 text-lg font-semibold text-ink">{current.branch_name || 'Principal'}</div>
                  </div>
                  <div className="rounded-[24px] bg-white/78 p-5">
                    <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Abierta</div>
                    <div className="mt-2 text-sm font-semibold text-ink">{formatDateTime(current.opened_at)}</div>
                  </div>
                  <div className="rounded-[24px] bg-white/78 p-5">
                    <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Monto inicial</div>
                    <div className="mt-2 text-2xl font-bold text-ink">{formatCurrency(summary?.openingAmount)}</div>
                  </div>
                  <div className="rounded-[24px] bg-white/78 p-5">
                    <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Efectivo esperado</div>
                    <div className="mt-2 text-2xl font-bold text-emerald-700">{formatCurrency(summary?.expectedCash)}</div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-[24px] bg-white/78 p-5">
                    <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Ventas efectivo</div>
                    <div className="mt-2 text-xl font-semibold text-ink">{formatCurrency(summary?.cashSales)}</div>
                  </div>
                  <div className="rounded-[24px] bg-white/78 p-5">
                    <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Ventas tarjeta</div>
                    <div className="mt-2 text-xl font-semibold text-ink">{formatCurrency(summary?.cardSales)}</div>
                  </div>
                  <div className="rounded-[24px] bg-white/78 p-5">
                    <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Abonos efectivo</div>
                    <div className="mt-2 text-xl font-semibold text-ink">{formatCurrency(summary?.creditCash)}</div>
                  </div>
                  <div className="rounded-[24px] bg-white/78 p-5">
                    <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Movimiento total</div>
                    <div className="mt-2 text-xl font-semibold text-ink">{formatCurrency(summary?.totalTransactions)}</div>
                  </div>
                </div>

                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr),320px]">
                  <div className="space-y-4">
                    <Field label="Efectivo contado">
                      <Input type="number" step="0.01" value={countedAmount} onChange={(event) => setCountedAmount(event.target.value)} />
                    </Field>
                    <Field label="Notas de cierre">
                      <TextArea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} />
                    </Field>
                  </div>

                  <div className="rounded-[24px] bg-white/72 p-5">
                    <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Accion principal</div>
                    <div className="mt-3 text-lg font-semibold text-ink">Cerrar caja y emitir comprobante</div>
                    <div className="mt-3 text-sm leading-7 text-slate-600">
                      Registra el efectivo contado para comparar contra el total esperado y cerrar el turno.
                    </div>
                    <div className="mt-5">
                      <Button disabled={saving} onClick={closeCash}>
                        {saving ? 'Cerrando...' : 'Cerrar caja'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {message ? (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {message}
              </div>
            ) : null}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel className="overflow-hidden">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Historial</div>
                <h3 className="mt-2 text-2xl font-bold text-ink">Ultimos cierres</h3>
              </div>
              <div className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-600">
                {history.length} registro(s)
              </div>
            </div>

            <div className="soft-scrollbar mt-6 max-h-[480px] space-y-3 overflow-auto pr-1">
              {history.map((entry) => (
                <div key={entry.id} className="rounded-[24px] bg-white/78 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-slate-800">{entry.branch_name || 'Principal'}</div>
                    <div className="flex items-center gap-3">
                      <div className={`text-xs font-semibold uppercase ${entry.status === 'open' ? 'text-amber-700' : 'text-emerald-700'}`}>
                        {entry.status}
                      </div>
                      <Button variant="ghost" onClick={() => reprintRegister(entry.id)}>
                        Reimprimir
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-slate-600">{formatDateTime(entry.opened_at)}</div>
                  <div className="mt-2 text-sm text-slate-700">
                    Inicial: {formatCurrency(entry.opening_amount)} | Cierre: {entry.closing_amount ? formatCurrency(entry.closing_amount) : '--'}
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <TicketPreview title="Comprobante de caja" content={ticketPreview} />
        </div>
      </div>
    </div>
  );
}
