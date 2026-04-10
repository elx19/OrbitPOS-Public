import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { formatCurrency, formatDateTime } from '../../lib/format';
import Button from '../ui/Button';
import { Field, Input, TextArea } from '../ui/Field';
import Panel from '../ui/Panel';
import PaymentSplitEditor from '../ui/PaymentSplitEditor';
import TicketPreview from '../ui/TicketPreview';

function createInitialSplits() {
  return [{ method: 'cash', amount: '', reference: '' }];
}

export default function CreditsPanel({ token, onActivity }) {
  const [credits, setCredits] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedCredit, setSelectedCredit] = useState(null);
  const [query, setQuery] = useState('');
  const [visibleCreditCount, setVisibleCreditCount] = useState(40);
  const [splits, setSplits] = useState(createInitialSplits());
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [receiptPreview, setReceiptPreview] = useState('');
  const [whatsappUrl, setWhatsappUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function loadCredits(search = '', { forceFresh = false } = {}) {
    const normalizedSearch = search.trim().toLowerCase();
    const result = await apiRequest(`/api/credits?q=${encodeURIComponent(search)}`, {
      token,
      cacheMs: forceFresh ? 0 : 15000,
      cacheKey: `credits-list:${normalizedSearch}`,
      forceFresh
    });
    setCredits(result);
    setVisibleCreditCount(normalizedSearch ? 60 : 40);
    if (!result.length) {
      setSelectedId(null);
      return;
    }

    if (!selectedId || !result.some((credit) => credit.id === selectedId)) {
      setSelectedId(result[0].id);
    }
  }

  useEffect(() => {
    loadCredits();
  }, [token]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedCredit(null);
      return;
    }

    apiRequest(`/api/credits/${selectedId}`, { token })
      .then(setSelectedCredit)
      .catch((error) => setMessage(error.message));
  }, [selectedId, token]);

  const paymentTotal = useMemo(
    () => splits.reduce((sum, split) => sum + Number(split.amount || 0), 0),
    [splits]
  );
  const totalPending = useMemo(
    () => credits.reduce((sum, credit) => sum + Number(credit.balance || 0), 0),
    [credits]
  );
  const visibleCredits = useMemo(
    () => credits.slice(0, visibleCreditCount),
    [credits, visibleCreditCount]
  );

  async function registerPayment() {
    if (!selectedCredit) {
      return;
    }

    setSubmitting(true);
    setMessage('');

    try {
      const result = await apiRequest('/api/payments', {
        method: 'POST',
        token,
        body: {
          saleId: selectedCredit.id,
          splits: splits.map((split) => ({ ...split, amount: Number(split.amount || 0) })),
          notes
        }
      });

      setReceiptPreview(result.receiptPreview);
      setWhatsappUrl(result.whatsappUrl);
      setMessage(
        result.printResult?.attempted
          ? `Abono registrado. Nuevo saldo: ${formatCurrency(result.newBalance)}. ${result.printResult.message}`
          : `Abono registrado. Nuevo saldo: ${formatCurrency(result.newBalance)}`
      );
      setSplits(createInitialSplits());
      setNotes('');
      await loadCredits(query, { forceFresh: true });
      const updated = await apiRequest(`/api/credits/${selectedCredit.id}`, { token });
      setSelectedCredit(updated);
      onActivity?.();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function reprintPayment(paymentId) {
    try {
      const result = await apiRequest(`/api/payments/${paymentId}/reprint`, { token });
      setReceiptPreview(result.receiptPreview);
      setMessage(result.printResult?.message || `Recibo ${result.receiptNumber} reimpreso.`);
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <div className="space-y-6">
      <Panel>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Ventas a credito</div>
            <h2 className="mt-2 text-3xl font-bold text-ink">Gestion de creditos y abonos</h2>
            <p className="mt-3 text-sm text-slate-600">
              Selecciona una factura pendiente, registra pagos parciales o completos y reimprime recibos sin salir
              de esta vista.
            </p>
          </div>
          <div className="grid w-full gap-3 sm:grid-cols-3 xl:w-auto xl:min-w-[520px]">
            <div className="rounded-[24px] bg-white/78 px-5 py-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Creditos abiertos</div>
              <div className="mt-2 text-2xl font-bold text-ink">{credits.length}</div>
            </div>
            <div className="rounded-[24px] bg-white/78 px-5 py-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Saldo pendiente</div>
              <div className="mt-2 text-2xl font-bold text-rosewood">{formatCurrency(totalPending)}</div>
            </div>
            <div className="rounded-[24px] bg-white/78 px-5 py-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Abono en edicion</div>
              <div className="mt-2 text-2xl font-bold text-emerald-700">{formatCurrency(paymentTotal)}</div>
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[minmax(320px,0.92fr),minmax(0,1.08fr)]">
        <Panel className="overflow-hidden">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Cartera activa</div>
              <h3 className="mt-2 text-2xl font-bold text-ink">Facturas pendientes</h3>
              <div className="mt-2 text-sm text-slate-500">
                {credits.length
                  ? 'Elige una venta a credito para ver su detalle y registrar el abono.'
                  : 'Todavia no hay ventas a credito pendientes.'}
              </div>
            </div>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  loadCredits(event.currentTarget.value);
                }
              }}
              placeholder="Buscar factura o cliente"
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-3 text-xs text-slate-500">
            <span className="rounded-full bg-white/75 px-3 py-2">
              Seleccionado: {selectedCredit ? `#${selectedCredit.invoice_number}` : 'ninguno'}
            </span>
            <span className="rounded-full bg-white/75 px-3 py-2">Resultados: {credits.length}</span>
          </div>

          <div className="soft-scrollbar mt-6 max-h-[calc(100vh-21rem)] space-y-3 overflow-auto pr-1">
            {visibleCredits.length ? visibleCredits.map((credit) => (
              <button
                key={credit.id}
                type="button"
                onClick={() => setSelectedId(credit.id)}
                className={`w-full rounded-[24px] p-4 text-left transition ${
                  selectedId === credit.id ? 'bg-ink text-white shadow-soft' : 'bg-white/78 hover:bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{credit.customer_name}</div>
                    <div className={`mt-1 text-xs ${selectedId === credit.id ? 'text-white/75' : 'text-slate-500'}`}>
                      Factura #{credit.invoice_number}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatCurrency(credit.balance)}</div>
                    <div className={`mt-1 text-xs ${selectedId === credit.id ? 'text-white/75' : 'text-slate-500'}`}>
                      {formatDateTime(credit.created_at)}
                    </div>
                  </div>
                </div>
              </button>
            )) : (
              <div className="rounded-[24px] bg-white/78 px-4 py-5 text-sm text-slate-500">
                No se encontraron creditos con ese criterio.
              </div>
            )}
          </div>
          {credits.length > visibleCreditCount ? (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-[22px] bg-white/72 px-4 py-3">
              <div className="text-sm text-slate-600">
                Mostrando {visibleCreditCount} de {credits.length} credito(s).
              </div>
              <Button variant="secondary" onClick={() => setVisibleCreditCount((current) => current + 30)}>
                Mostrar mas
              </Button>
            </div>
          ) : null}
        </Panel>

        <div className="space-y-6">
          {selectedCredit ? (
            <>
              <Panel className="overflow-hidden">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Detalle de credito</div>
                    <h3 className="mt-2 text-2xl font-bold text-ink">Factura #{selectedCredit.invoice_number}</h3>
                    <div className="mt-2 text-sm text-slate-500">
                      Emitida el {formatDateTime(selectedCredit.created_at)} para {selectedCredit.customer_name}.
                    </div>
                  </div>
                  <div className="rounded-[24px] bg-white/78 px-5 py-4 text-right">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Saldo actual</div>
                    <div className="mt-2 text-3xl font-bold text-rosewood">{formatCurrency(selectedCredit.balance)}</div>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-[24px] bg-white/78 p-5">
                    <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Cliente</div>
                    <div className="mt-2 text-lg font-bold text-ink">{selectedCredit.customer_name}</div>
                    <div className="mt-1 text-sm text-slate-500">{selectedCredit.customer_phone || 'Sin telefono'}</div>
                  </div>
                  <div className="rounded-[24px] bg-white/78 p-5">
                    <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Items facturados</div>
                    <div className="mt-2 text-2xl font-bold text-ink">{selectedCredit.items.length}</div>
                    <div className="mt-1 text-sm text-slate-500">Productos en la venta</div>
                  </div>
                  <div className="rounded-[24px] bg-white/78 p-5">
                    <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Abonos recibidos</div>
                    <div className="mt-2 text-2xl font-bold text-ink">{selectedCredit.payments.length}</div>
                    <div className="mt-1 text-sm text-slate-500">Movimientos registrados</div>
                  </div>
                  <div className="rounded-[24px] bg-white/78 p-5">
                    <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Abono actual</div>
                    <div className="mt-2 text-2xl font-bold text-emerald-700">{formatCurrency(paymentTotal)}</div>
                    <div className="mt-1 text-sm text-slate-500">Monto en preparacion</div>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Detalle de la venta</div>
                    <div className="text-sm text-slate-500">{selectedCredit.items.length} item(s)</div>
                  </div>
                  <div className="soft-scrollbar mt-4 max-h-[260px] space-y-3 overflow-auto pr-1">
                    {selectedCredit.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-[20px] bg-white/80 px-4 py-3 text-sm">
                        <span className="font-medium text-slate-700">{item.product_name}</span>
                        <span className="text-slate-500">
                          {item.quantity} x {formatCurrency(item.unit_price)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </Panel>

              <div className="grid gap-6 xl:grid-cols-[minmax(0,0.94fr),minmax(320px,0.86fr)]">
                <div className="space-y-6">
                  <PaymentSplitEditor
                    splits={splits}
                    onChange={setSplits}
                    title="Registrar abono"
                  />

                  <Panel>
                    <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Confirmacion de pago</div>
                    <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr),220px]">
                      <Field label="Notas">
                        <TextArea rows={5} value={notes} onChange={(event) => setNotes(event.target.value)} />
                      </Field>
                      <div className="rounded-[24px] bg-white/78 p-5">
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Total del abono</div>
                        <div className="mt-3 text-3xl font-bold text-emerald-700">{formatCurrency(paymentTotal)}</div>
                        <div className="mt-2 text-sm text-slate-500">
                          Guarda el movimiento y, si lo necesitas, comparte el recibo por WhatsApp.
                        </div>
                        <div className="mt-5 flex flex-col gap-3">
                          <Button disabled={submitting} onClick={registerPayment}>
                            {submitting ? 'Registrando...' : 'Guardar abono'}
                          </Button>
                          {whatsappUrl ? (
                            <Button
                              variant="secondary"
                              onClick={() => window.open(whatsappUrl, '_blank', 'noopener,noreferrer')}
                            >
                              Abrir WhatsApp
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </Panel>
                </div>

                <div className="space-y-6">
                  <Panel className="overflow-hidden">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Historial de abonos</div>
                        <div className="mt-2 text-xl font-bold text-ink">Movimientos registrados</div>
                      </div>
                      <div className="rounded-full bg-white/75 px-3 py-2 text-xs text-slate-500">
                        {selectedCredit.payments.length} recibo(s)
                      </div>
                    </div>
                    <div className="soft-scrollbar mt-5 max-h-[360px] space-y-3 overflow-auto pr-1">
                      {selectedCredit.payments.length ? selectedCredit.payments.map((payment) => (
                        <div key={payment.id} className="rounded-[20px] bg-white/80 px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-semibold text-slate-800">
                              {payment.receipt_number || payment.payment_method}
                            </span>
                            <div className="flex items-center gap-3">
                              <span className="font-semibold text-ink">{formatCurrency(payment.amount)}</span>
                              <Button variant="ghost" onClick={() => reprintPayment(payment.id)}>
                                Reimprimir
                              </Button>
                            </div>
                          </div>
                          <div className="mt-1 text-xs text-slate-500">{formatDateTime(payment.created_at)}</div>
                        </div>
                      )) : (
                        <div className="rounded-[20px] bg-white/80 px-4 py-3 text-sm text-slate-500">
                          Todavia no hay abonos registrados.
                        </div>
                      )}
                    </div>
                  </Panel>

                  <TicketPreview title="Recibo de abono" content={receiptPreview} />
                </div>
              </div>
            </>
          ) : (
            <Panel>
              <div className="text-sm text-slate-500">No hay creditos abiertos ahora mismo.</div>
            </Panel>
          )}
        </div>
      </div>

      {message ? (
        <Panel>
          <div className="text-sm font-semibold text-amber-800">{message}</div>
        </Panel>
      ) : null}
    </div>
  );
}
