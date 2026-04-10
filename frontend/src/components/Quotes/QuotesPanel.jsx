import { useEffect, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { formatCurrency, formatDate, formatDateTime } from '../../lib/format';
import Button from '../ui/Button';
import { Field, Input, Select, TextArea } from '../ui/Field';
import Panel from '../ui/Panel';
import PaymentSplitEditor from '../ui/PaymentSplitEditor';
import TicketPreview from '../ui/TicketPreview';

function createLine() {
  return {
    productId: '',
    quantity: '1',
    discount: '0'
  };
}

function createInitialPayments() {
  return [{ method: 'cash', amount: '', reference: '' }];
}

export default function QuotesPanel({ token, onActivity }) {
  const [quotes, setQuotes] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [customerId, setCustomerId] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState('0');
  const [lines, setLines] = useState([createLine()]);
  const [saleType, setSaleType] = useState('cash');
  const [payments, setPayments] = useState(createInitialPayments());
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadData() {
    const [quotesResult, customersResult, productsResult] = await Promise.all([
      apiRequest('/api/quotes', { token }),
      apiRequest('/api/customers', { token }),
      apiRequest('/api/products', { token })
    ]);
    setQuotes(quotesResult);
    setCustomers(customersResult);
    setProducts(productsResult);
    if (!selectedId && quotesResult.length) {
      setSelectedId(quotesResult[0].id);
    }
  }

  useEffect(() => {
    loadData();
  }, [token]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedQuote(null);
      return;
    }

    apiRequest(`/api/quotes/${selectedId}`, { token })
      .then(setSelectedQuote)
      .catch((error) => setMessage(error.message));
  }, [selectedId, token]);

  function updateLine(index, patch) {
    setLines((current) => current.map((line, lineIndex) => (
      lineIndex === index ? { ...line, ...patch } : line
    )));
  }

  async function createQuote() {
    setSaving(true);
    setMessage('');

    try {
      const result = await apiRequest('/api/quotes', {
        method: 'POST',
        token,
        body: {
          customerId: customerId ? Number(customerId) : null,
          validUntil: validUntil || null,
          notes,
          discount: Number(discount || 0),
          items: lines.map((line) => ({
            productId: Number(line.productId),
            quantity: Number(line.quantity || 0),
            discount: Number(line.discount || 0)
          }))
        }
      });

      setMessage(
        result.printResult?.attempted
          ? `Cotizacion creada: ${result.quoteNumber}. ${result.printResult.message}`
          : `Cotizacion creada: ${result.quoteNumber}`
      );
      setPreview(result.preview);
      setCustomerId('');
      setValidUntil('');
      setNotes('');
      setDiscount('0');
      setLines([createLine()]);
      await loadData();
      setSelectedId(result.quoteId);
      onActivity?.();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function updateQuoteStatus(status) {
    if (!selectedQuote) {
      return;
    }

    await apiRequest(`/api/quotes/${selectedQuote.id}/status`, {
      method: 'PATCH',
      token,
      body: { status }
    });
    await loadData();
    const refreshed = await apiRequest(`/api/quotes/${selectedQuote.id}`, { token });
    setSelectedQuote(refreshed);
    onActivity?.();
  }

  async function convertQuote() {
    if (!selectedQuote) {
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      const result = await apiRequest(`/api/quotes/${selectedQuote.id}/convert`, {
        method: 'POST',
        token,
        body: {
          type: saleType,
          payments: payments.map((payment) => ({ ...payment, amount: Number(payment.amount || 0) })),
          notes: `Venta convertida desde ${selectedQuote.quote_number}`
        }
      });

      setMessage(
        result.printResult?.attempted
          ? `Cotizacion convertida a factura #${result.sale.invoice_number}. ${result.printResult.message}`
          : `Cotizacion convertida a factura #${result.sale.invoice_number}`
      );
      setPreview(result.ticketPreview);
      setPayments(createInitialPayments());
      setSaleType('cash');
      await loadData();
      const refreshed = await apiRequest(`/api/quotes/${selectedQuote.id}`, { token });
      setSelectedQuote(refreshed);
      onActivity?.();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function sendWhatsappQuote() {
    if (!selectedQuote) {
      return;
    }

    const result = await apiRequest('/api/whatsapp/quote', {
      method: 'POST',
      token,
      body: { quoteId: selectedQuote.id }
    });

    window.open(result.url, '_blank', 'noopener,noreferrer');
  }

  async function reprintQuote() {
    if (!selectedQuote) {
      return;
    }

    try {
      const result = await apiRequest(`/api/quotes/${selectedQuote.id}/reprint`, { token });
      setPreview(result.preview);
      setMessage(result.printResult?.message || 'Cotizacion reimpresa.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <div className="space-y-6">
      <Panel>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Cotizaciones</div>
            <h2 className="mt-2 text-3xl font-bold text-ink">Presupuestos y conversion a venta</h2>
            <p className="mt-3 text-sm text-slate-600">
              Crea cotizaciones, compártelas con el cliente y conviértelas en venta desde la misma pantalla.
            </p>
          </div>
          <div className="grid w-full gap-3 sm:grid-cols-3 xl:w-auto xl:min-w-[520px]">
            <div className="rounded-[24px] bg-white/78 px-5 py-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Cotizaciones</div>
              <div className="mt-2 text-2xl font-bold text-ink">{quotes.length}</div>
            </div>
            <div className="rounded-[24px] bg-white/78 px-5 py-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Lineas activas</div>
              <div className="mt-2 text-2xl font-bold text-ink">{lines.length}</div>
            </div>
            <div className="rounded-[24px] bg-white/78 px-5 py-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Seleccionada</div>
              <div className="mt-2 truncate text-lg font-bold text-ink">{selectedQuote?.quote_number || 'Ninguna'}</div>
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.02fr),minmax(320px,0.98fr)]">
        <Panel>
          <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Crear cotizacion</div>
          <h3 className="mt-2 text-2xl font-bold text-ink">Nueva propuesta</h3>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Field label="Cliente">
              <Select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
                <option value="">Seleccionar cliente</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>{customer.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Valida hasta">
              <Input type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} />
            </Field>
          </div>

          <div className="soft-scrollbar mt-5 max-h-[360px] space-y-4 overflow-auto pr-1">
            {lines.map((line, index) => (
              <div key={index} className="rounded-[24px] bg-white/78 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-ink">Linea #{index + 1}</div>
                  <Button variant="ghost" onClick={() => setLines((current) => current.length === 1 ? [createLine()] : current.filter((_, lineIndex) => lineIndex !== index))}>
                    Quitar linea
                  </Button>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <Field label="Producto">
                    <Select value={line.productId} onChange={(event) => updateLine(index, { productId: event.target.value })}>
                      <option value="">Seleccionar producto</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>{product.name}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Cantidad">
                    <Input type="number" min="0.01" step="0.01" value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} />
                  </Field>
                  <Field label="Descuento item">
                    <Input type="number" min="0" step="0.01" value={line.discount} onChange={(event) => updateLine(index, { discount: event.target.value })} />
                  </Field>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => setLines((current) => [...current, createLine()])}>
              Agregar producto
            </Button>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr),minmax(0,1fr)]">
            <Field label="Descuento global">
              <Input type="number" min="0" step="0.01" value={discount} onChange={(event) => setDiscount(event.target.value)} />
            </Field>
            <Field label="Notas">
              <TextArea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
            </Field>
          </div>

          <div className="mt-5">
            <Button disabled={saving} onClick={createQuote}>
              {saving ? 'Guardando...' : 'Crear cotizacion'}
            </Button>
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel className="overflow-hidden">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Recientes</div>
                <div className="mt-2 text-2xl font-bold text-ink">Historial de cotizaciones</div>
              </div>
              <div className="rounded-full bg-white/75 px-3 py-2 text-xs text-slate-500">{quotes.length} registro(s)</div>
            </div>
            <div className="soft-scrollbar mt-5 max-h-[260px] space-y-3 overflow-auto pr-1">
              {quotes.length ? quotes.map((quote) => (
                <button
                  key={quote.id}
                  type="button"
                  onClick={() => setSelectedId(quote.id)}
                  className={`w-full rounded-[24px] p-4 text-left transition ${selectedId === quote.id ? 'bg-ink text-white shadow-soft' : 'bg-white/78 hover:bg-white'}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{quote.quote_number}</div>
                      <div className={`mt-1 text-xs ${selectedId === quote.id ? 'text-white/75' : 'text-slate-500'}`}>
                        {quote.customer_name || 'Consumidor final'} | {formatDateTime(quote.created_at)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatCurrency(quote.total)}</div>
                      <div className={`mt-1 text-xs capitalize ${selectedId === quote.id ? 'text-white/75' : 'text-slate-500'}`}>
                        {quote.status}
                      </div>
                    </div>
                  </div>
                </button>
              )) : (
                <div className="rounded-[24px] bg-white/78 px-4 py-5 text-sm text-slate-500">
                  Todavia no hay cotizaciones registradas.
                </div>
              )}
            </div>
          </Panel>

          {selectedQuote ? (
            <Panel className="overflow-hidden">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[24px] bg-white/78 p-5">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Cliente</div>
                  <div className="mt-2 text-xl font-bold text-ink">{selectedQuote.customer_name || 'Consumidor final'}</div>
                  <div className="mt-1 text-sm text-slate-500">Valida hasta: {formatDate(selectedQuote.valid_until)}</div>
                </div>
                <div className="rounded-[24px] bg-white/78 p-5">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Total</div>
                  <div className="mt-2 text-xl font-bold text-ink">{formatCurrency(selectedQuote.total)}</div>
                  <div className="mt-1 text-sm capitalize text-slate-500">Estado: {selectedQuote.status}</div>
                </div>
              </div>

              <div className="soft-scrollbar mt-6 max-h-[220px] space-y-3 overflow-auto pr-1">
                {selectedQuote.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-[20px] bg-white/80 px-4 py-3 text-sm">
                    <span className="font-medium text-slate-700">{item.product_name}</span>
                    <span className="text-slate-500">
                      {item.quantity} x {formatCurrency(item.unit_price)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Button variant="secondary" onClick={() => updateQuoteStatus('approved')}>
                  Aprobar
                </Button>
                <Button variant="secondary" onClick={() => updateQuoteStatus('rejected')}>
                  Rechazar
                </Button>
                <Button variant="secondary" onClick={sendWhatsappQuote}>
                  Enviar por WhatsApp
                </Button>
                <Button variant="ghost" onClick={reprintQuote}>
                  Reimprimir
                </Button>
              </div>
            </Panel>
          ) : null}

          {selectedQuote ? (
            <Panel>
              <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Convertir en venta</div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label="Tipo de venta">
                  <Select value={saleType} onChange={(event) => setSaleType(event.target.value)}>
                    <option value="cash">Contado</option>
                    <option value="credit">Credito</option>
                  </Select>
                </Field>
              </div>
              <div className="mt-5">
                <PaymentSplitEditor splits={payments} onChange={setPayments} title="Pagos para convertir" />
              </div>
              <div className="mt-5">
                <Button disabled={saving || selectedQuote.status === 'converted'} onClick={convertQuote}>
                  {saving ? 'Convirtiendo...' : 'Convertir a venta'}
                </Button>
              </div>
            </Panel>
          ) : null}
        </div>
      </div>

      {message ? (
        <Panel>
          <div className="text-sm font-semibold text-amber-800">{message}</div>
        </Panel>
      ) : null}

      <TicketPreview title="Vista previa de cotizacion o ticket" content={preview} />
    </div>
  );
}
