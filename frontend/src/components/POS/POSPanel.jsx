import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { getInitials, resolveAssetUrl } from '../../lib/assets';
import { formatCurrency } from '../../lib/format';
import Button from '../ui/Button';
import { Field, Input, Select, TextArea } from '../ui/Field';
import Panel from '../ui/Panel';
import PaymentSplitEditor from '../ui/PaymentSplitEditor';
import TicketPreview from '../ui/TicketPreview';

const PREVIEW_CACHE_TTL_MS = 15000;
const PREVIEW_CACHE_LIMIT = 24;
const getInitialPayments = () => [{ method: 'cash', amount: '', reference: '' }];

function ProductVisual({ product, className = 'h-16 w-16 rounded-[18px]' }) {
  const imageUrl = resolveAssetUrl(product?.image_path);
  if (imageUrl) {
    return <img src={imageUrl} alt={product?.name || 'Producto'} className={`${className} shrink-0 border border-white/70 object-cover shadow-sm`} />;
  }
  return <div className={`${className} flex shrink-0 items-center justify-center border border-white/70 bg-ink/10 text-sm font-bold text-ink shadow-sm`}>{getInitials(product?.name || 'Producto')}</div>;
}

export default function POSPanel({ token, taxRate = 18, businessName = 'Mi Negocio', onActivity }) {
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [register, setRegister] = useState(null);
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [saleType, setSaleType] = useState('cash');
  const [customerId, setCustomerId] = useState('');
  const [discount, setDiscount] = useState('0');
  const [notes, setNotes] = useState('');
  const [payments, setPayments] = useState(getInitialPayments());
  const [message, setMessage] = useState('');
  const [ticketPreview, setTicketPreview] = useState('');
  const [lastSaleId, setLastSaleId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [customerDisplayOpen, setCustomerDisplayOpen] = useState(false);
  const [visibleProductCount, setVisibleProductCount] = useState(24);
  const [openingAmount, setOpeningAmount] = useState('0');
  const [openingRegister, setOpeningRegister] = useState(false);
  const previewCacheRef = useRef(new Map());
  const deferredQuery = useDeferredValue(query);

  async function loadData({ forceFresh = false } = {}) {
    const [productsResult, customersResult, cashResult] = await Promise.all([
      apiRequest('/api/products', { token, cacheMs: 30000, cacheKey: 'products-catalog', forceFresh }),
      apiRequest('/api/customers', { token, cacheMs: 30000, cacheKey: 'customers-catalog', forceFresh }),
      apiRequest('/api/cash/current', { token, cacheMs: 6000, cacheKey: 'cash-current', forceFresh })
    ]);
    setProducts(productsResult);
    setCustomers(customersResult);
    setRegister(cashResult.register);
  }

  useEffect(() => { loadData(); }, [token]);

  const filteredProducts = useMemo(() => {
    if (!deferredQuery.trim()) return products;
    const search = deferredQuery.toLowerCase();
    return products.filter((product) =>
      product.name.toLowerCase().includes(search) ||
      (product.barcode || '').toLowerCase().includes(search) ||
      (product.category || '').toLowerCase().includes(search)
    );
  }, [deferredQuery, products]);

  const visibleProducts = useMemo(() => filteredProducts.slice(0, visibleProductCount), [filteredProducts, visibleProductCount]);
  useEffect(() => { setVisibleProductCount(deferredQuery.trim() ? 60 : 24); }, [deferredQuery]);

  const selectedCustomer = useMemo(() => customers.find((customer) => String(customer.id) === String(customerId)) || null, [customerId, customers]);
  const saleItems = useMemo(() => cart.map((item) => ({ productId: item.id, quantity: Number(item.quantity || 0), discount: Number(item.discount || 0) })), [cart]);
  const previewRequestKey = useMemo(() => JSON.stringify({ customerId: customerId ? Number(customerId) : null, items: saleItems, discount: Number(discount || 0) }), [customerId, discount, saleItems]);

  useEffect(() => {
    if (!saleItems.length) {
      setPreview(null); setPreviewError(''); setPreviewLoading(false); return;
    }
    const cachedEntry = previewCacheRef.current.get(previewRequestKey);
    if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
      setPreview(cachedEntry.value); setPreviewError(''); setPreviewLoading(false); return;
    }
    let ignore = false;
    setPreviewLoading(true);
    const timerId = window.setTimeout(async () => {
      try {
        const result = await apiRequest('/api/sales/preview', { method: 'POST', token, body: { customerId: customerId ? Number(customerId) : null, items: saleItems, discount: Number(discount || 0) } });
        if (!ignore) {
          previewCacheRef.current.set(previewRequestKey, { value: result, expiresAt: Date.now() + PREVIEW_CACHE_TTL_MS });
          if (previewCacheRef.current.size > PREVIEW_CACHE_LIMIT) {
            const oldestKey = previewCacheRef.current.keys().next().value;
            if (oldestKey) previewCacheRef.current.delete(oldestKey);
          }
          setPreview(result); setPreviewError('');
        }
      } catch (error) {
        if (!ignore) { setPreview(null); setPreviewError(error.message); }
      } finally {
        if (!ignore) setPreviewLoading(false);
      }
    }, 120);
    return () => { ignore = true; window.clearTimeout(timerId); };
  }, [customerId, discount, previewRequestKey, saleItems, token]);

  const paymentTotal = useMemo(() => payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0), [payments]);
  const fallbackTotals = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + (Number(item.sale_price) * Number(item.quantity || 0)), 0);
    const itemDiscount = cart.reduce((sum, item) => sum + Number(item.discount || 0), 0);
    const globalDiscount = Number(discount || 0);
    const taxable = Math.max(subtotal - itemDiscount - globalDiscount, 0);
    const tax = taxable * (taxRate / 100);
    return { subtotal, discount: itemDiscount + globalDiscount, tax, total: taxable + tax };
  }, [cart, discount, taxRate]);

  const totals = useMemo(() => {
    const baseTotals = preview ? {
      subtotal: Number(preview.subtotal || 0),
      discount: Number(preview.discount || 0),
      tax: Number(preview.tax || 0),
      total: Number(preview.total || 0)
    } : fallbackTotals;
    return { ...baseTotals, paid: paymentTotal, balance: Math.max(baseTotals.total - paymentTotal, 0), change: saleType === 'cash' ? Math.max(paymentTotal - baseTotals.total, 0) : 0 };
  }, [fallbackTotals, paymentTotal, preview, saleType]);

  const canSubmitSale = Boolean(register) && cart.length > 0 && !previewLoading && !previewError && !(saleType === 'credit' && !customerId);

  useEffect(() => {
    let ignore = false;
    if (!window.orbit?.customerDisplay?.getStatus) return undefined;
    window.orbit.customerDisplay.getStatus().then((status) => { if (!ignore) setCustomerDisplayOpen(Boolean(status?.open)); }).catch(() => { if (!ignore) setCustomerDisplayOpen(false); });
    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    if (!window.orbit?.customerDisplay?.update) return;
    window.orbit.customerDisplay.update({
      businessName,
      saleType,
      customerName: selectedCustomer?.name || 'Consumidor final',
      statusText: !register ? 'Caja cerrada' : previewError ? previewError : cart.length ? 'Listo para cobrar' : 'Esperando articulos',
      cart: cart.map((item) => ({ id: item.id, name: item.name, quantity: Number(item.quantity || 0), unitPrice: Number(item.sale_price || 0), discount: Number(item.discount || 0), subtotal: Number(((Number(item.sale_price || 0) * Number(item.quantity || 0)) - Number(item.discount || 0)).toFixed(2)) })),
      payments: payments.filter((payment) => Number(payment.amount || 0) > 0).map((payment) => ({ method: payment.method, amount: Number(payment.amount || 0) })),
      totals,
      updatedAt: new Date().toISOString()
    });
  }, [businessName, cart, payments, previewError, register, saleType, selectedCustomer, totals]);

  function addProduct(product) {
    if (Number(product.stock || 0) <= 0) { setMessage(`El producto ${product.name} no tiene stock disponible.`); return; }
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) {
        const nextQuantity = Number(existing.quantity || 0) + 1;
        if (nextQuantity > Number(product.stock || 0)) { setMessage(`No puedes exceder el stock disponible de ${product.name}.`); return current; }
        return current.map((item) => (item.id === product.id ? { ...item, quantity: nextQuantity } : item));
      }
      return [...current, { ...product, quantity: product.weighed ? 0.5 : 1, discount: 0 }];
    });
  }

  function updateCartItem(productId, patch) {
    setCart((current) => current.map((item) => {
      if (item.id !== productId) return item;
      const nextItem = { ...item, ...patch };
      const parsedQuantity = Number(nextItem.quantity || 0);
      const maxQuantity = Number(item.stock || 0);
      if (Number.isFinite(parsedQuantity) && parsedQuantity > maxQuantity) nextItem.quantity = String(maxQuantity);
      return nextItem;
    }));
  }

  const removeFromCart = (productId) => setCart((current) => current.filter((item) => item.id !== productId));
  async function openCustomerDisplay() { try { await window.orbit?.customerDisplay?.open?.(); setCustomerDisplayOpen(true); } catch { setMessage('No fue posible abrir la pantalla cliente.'); } }
  async function closeCustomerDisplay() { try { await window.orbit?.customerDisplay?.close?.(); setCustomerDisplayOpen(false); } catch { setMessage('No fue posible cerrar la pantalla cliente.'); } }

  async function handleQuickOpenRegister() {
    setOpeningRegister(true); setMessage('');
    try {
      await apiRequest('/api/cash/open', { method: 'POST', token, body: { openingAmount: Number(openingAmount || 0) } });
      setMessage('Caja abierta correctamente desde el POS. Ya puedes cobrar.');
      await loadData({ forceFresh: true });
      onActivity?.();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setOpeningRegister(false);
    }
  }

  async function submitSale() {
    if (!cart.length) { setMessage('Agrega productos al carrito.'); return; }
    setSubmitting(true); setMessage('');
    try {
      let normalizedPayments = payments.filter((payment) => payment.method && Number(payment.amount || 0) > 0).map((payment) => ({ ...payment, amount: Number(payment.amount || 0) }));
      if (saleType === 'cash' && !normalizedPayments.length) normalizedPayments = [{ method: 'cash', amount: Number(totals.total.toFixed(2)), reference: '' }];
      const result = await apiRequest('/api/sales', { method: 'POST', token, body: { customerId: customerId ? Number(customerId) : null, type: saleType, items: saleItems, payments: normalizedPayments, discount: Number(discount || 0), notes } });
      setTicketPreview(result.ticketPreview);
      setLastSaleId(result.sale.id);
      setMessage(result.printResult?.attempted ? `Venta registrada correctamente. Factura #${result.sale.invoice_number}. ${result.printResult.message}` : `Venta registrada correctamente. Factura #${result.sale.invoice_number}`);
      setCart([]); setPayments(getInitialPayments()); setDiscount('0'); setNotes(''); setCustomerId(''); previewCacheRef.current.clear();
      await loadData({ forceFresh: true }); onActivity?.();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function reprintLastSale() {
    if (!lastSaleId) return;
    try {
      const result = await apiRequest(`/api/sales/${lastSaleId}/reprint`, { token });
      setTicketPreview(result.ticketPreview);
      setMessage(result.printResult?.message || 'Ticket reimpreso correctamente.');
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-4">
        <div className="rounded-[24px] bg-white/76 px-5 py-4"><div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Caja</div><div className="mt-2 text-xl font-bold text-ink">{register ? 'Abierta' : 'Pendiente'}</div><div className="mt-1 text-sm text-slate-500">{register ? `Sucursal ${register.branch_name || 'Principal'}` : 'Abrir aqui mismo para vender'}</div></div>
        <div className="rounded-[24px] bg-white/76 px-5 py-4"><div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Venta actual</div><div className="mt-2 text-xl font-bold text-ink">{saleType === 'credit' ? 'Credito' : 'Contado'}</div><div className="mt-1 text-sm text-slate-500">{cart.length} producto(s) en carrito</div></div>
        <div className="rounded-[24px] bg-white/76 px-5 py-4"><div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Cliente</div><div className="mt-2 truncate text-xl font-bold text-ink">{selectedCustomer?.name || 'Consumidor final'}</div><div className="mt-1 text-sm text-slate-500">Total proyectado {formatCurrency(totals.total)}</div></div>
        <div className="rounded-[24px] bg-white/76 px-5 py-4"><div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Catalogo</div><div className="mt-2 text-xl font-bold text-ink">{filteredProducts.length} producto(s)</div><div className="mt-1 text-sm text-slate-500">Listo para vender sin cambiar de pantalla</div></div>
      </div>

      {message ? <Panel><div className="text-sm font-semibold text-amber-800">{message}</div></Panel> : null}

      <div className="grid gap-5 xl:h-[calc(100vh-16rem)] xl:grid-cols-[minmax(0,1.12fr),minmax(320px,0.82fr),minmax(360px,0.9fr)]">
        <Panel className="flex h-full min-h-[28rem] flex-col overflow-hidden">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div><div className="text-xs uppercase tracking-[0.24em] text-slate-500">Punto de venta</div><h2 className="mt-2 text-3xl font-bold text-ink">Productos</h2><div className="mt-2 text-sm text-slate-600">Haz clic en un producto para agregarlo al carrito.</div></div>
            <div className="w-full md:max-w-md"><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre, codigo o categoria" /></div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <div className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-600">Caja: {register ? 'Activa' : 'Por abrir'}</div>
            <div className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-600">Venta: {saleType === 'credit' ? 'Credito' : 'Contado'}</div>
            {selectedCustomer ? <div className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-600">Cliente: {selectedCustomer.name}</div> : null}
          </div>
          <div className="soft-scrollbar mt-5 min-h-0 flex-1 overflow-auto pr-1">
            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {visibleProducts.map((product) => {
                const isOutOfStock = Number(product.stock || 0) <= 0;
                return (
                  <button key={product.id} type="button" onClick={() => addProduct(product)} disabled={isOutOfStock} className={`rounded-[24px] p-4 text-left transition ${isOutOfStock ? 'cursor-not-allowed bg-slate-100/80 text-slate-400' : 'bg-white/78 hover:bg-white'}`}>
                    <div className="flex items-start gap-4">
                      <ProductVisual product={product} className="h-16 w-16 rounded-[18px]" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="truncate font-semibold text-slate-800">{product.name}</div><div className="mt-1 text-xs text-slate-500">{product.category || 'Sin categoria'} | {product.barcode || 'Sin codigo'}</div></div><div className="text-sm font-semibold text-ink">{formatCurrency(product.sale_price)}</div></div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isOutOfStock ? 'bg-slate-200 text-slate-500' : 'bg-white/80 text-slate-600'}`}>Stock {product.stock}</span>
                          {product.weighed ? <span className="rounded-full bg-lagoon/10 px-3 py-1 text-xs font-semibold text-lagoon">Por peso</span> : null}
                          {isOutOfStock ? <span className="rounded-full bg-rosewood/10 px-3 py-1 text-xs font-semibold text-rosewood">Sin stock</span> : null}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            {!filteredProducts.length ? <div className="mt-4 rounded-[24px] bg-white/78 p-5 text-sm text-slate-500">No se encontraron productos con esa busqueda.</div> : null}
          </div>
          {filteredProducts.length > visibleProductCount ? <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[22px] bg-white/72 px-4 py-3"><div className="text-sm text-slate-600">Mostrando {visibleProductCount} de {filteredProducts.length} producto(s).</div><Button variant="secondary" onClick={() => setVisibleProductCount((current) => current + 24)}>Mostrar mas</Button></div> : null}
        </Panel>

        <Panel className="flex h-full min-h-[28rem] flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-3"><div><div className="text-xs uppercase tracking-[0.24em] text-slate-500">Carrito</div><h3 className="mt-2 text-2xl font-bold text-ink">{cart.length} item(s)</h3></div><Button variant="ghost" onClick={() => setCart([])}>Vaciar</Button></div>
          <div className="soft-scrollbar mt-5 min-h-0 flex-1 space-y-3 overflow-auto pr-1">
            {cart.length ? cart.map((item) => (
              <div key={item.id} className="rounded-[24px] bg-white/78 p-4">
                <div className="flex items-start gap-4">
                  <ProductVisual product={item} className="h-14 w-14 rounded-[18px]" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="truncate font-semibold text-slate-800">{item.name}</div><div className="mt-1 text-xs text-slate-500">{formatCurrency(item.sale_price)} c/u | Disponible {item.stock}</div></div><Button variant="ghost" onClick={() => removeFromCart(item.id)}>Quitar</Button></div>
                    <div className="mt-4 grid gap-3">
                      <Field label="Cantidad"><Input type="number" step={item.weighed ? '0.01' : '1'} min="0.01" max={item.stock} value={item.quantity} onChange={(event) => updateCartItem(item.id, { quantity: event.target.value })} /></Field>
                      <Field label="Descuento item"><Input type="number" step="0.01" min="0" value={item.discount} onChange={(event) => updateCartItem(item.id, { discount: event.target.value })} /></Field>
                    </div>
                  </div>
                </div>
              </div>
            )) : <div className="rounded-[24px] bg-white/78 p-5 text-sm text-slate-500">Todavia no has agregado productos.</div>}
          </div>
          <div className="mt-4 rounded-[24px] bg-white/76 px-4 py-4"><div className="flex items-center justify-between gap-3 text-sm"><span className="font-semibold text-slate-600">Subtotal rapido</span><span className="font-bold text-ink">{formatCurrency(totals.subtotal)}</span></div><div className="mt-2 flex items-center justify-between gap-3 text-sm"><span className="font-semibold text-slate-600">Total proyectado</span><span className="font-bold text-ink">{formatCurrency(totals.total)}</span></div></div>
        </Panel>

        <Panel className="flex h-full min-h-[28rem] flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-3"><div><div className="text-xs uppercase tracking-[0.24em] text-slate-500">Cobro y cierre</div><h3 className="mt-2 text-2xl font-bold text-ink">Finalizar venta</h3></div><div className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-600">{cart.length} producto(s)</div></div>
          <div className="soft-scrollbar mt-5 min-h-0 flex-1 space-y-4 overflow-auto pr-1">
            {!register ? (
              <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-4">
                <div className="text-sm font-semibold text-amber-900">Apertura rapida de caja</div>
                <div className="mt-2 text-sm text-amber-800">Abre tu caja aqui mismo para no salir del POS antes de vender.</div>
                <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr),auto] sm:items-end">
                  <Field label="Monto inicial"><Input type="number" step="0.01" min="0" value={openingAmount} onChange={(event) => setOpeningAmount(event.target.value)} /></Field>
                  <Button disabled={openingRegister} onClick={handleQuickOpenRegister}>{openingRegister ? 'Abriendo...' : 'Abrir caja ahora'}</Button>
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[20px] bg-white/76 px-4 py-3 text-sm text-slate-600"><div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Caja</div><div className="mt-2 font-semibold text-ink">{register.branch_name || 'Principal'}</div></div>
                <div className="rounded-[20px] bg-white/76 px-4 py-3 text-sm text-slate-600"><div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Cliente</div><div className="mt-2 font-semibold text-ink">{selectedCustomer?.name || 'Consumidor final'}</div></div>
                <div className="rounded-[20px] bg-white/76 px-4 py-3 text-sm text-slate-600"><div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Pago</div><div className="mt-2 font-semibold text-ink">{saleType === 'credit' ? 'Credito' : 'Contado'}</div></div>
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Tipo de venta"><Select value={saleType} onChange={(event) => setSaleType(event.target.value)}><option value="cash">Contado</option><option value="credit">Credito</option></Select></Field>
              <Field label="Cliente"><Select value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">Seleccionar cliente</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</Select></Field>
              <Field label="Descuento global"><Input type="number" step="0.01" value={discount} onChange={(event) => setDiscount(event.target.value)} /></Field>
              <Field label="Notas"><TextArea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
            </div>
            <div className="grid gap-3 rounded-[24px] bg-white/76 p-5">
              <div className="flex items-center justify-between gap-3 text-sm text-slate-600"><span>Subtotal</span><strong className="text-ink">{formatCurrency(totals.subtotal)}</strong></div>
              <div className="flex items-center justify-between gap-3 text-sm text-slate-600"><span>Descuento</span><strong className="text-ink">{formatCurrency(totals.discount)}</strong></div>
              <div className="flex items-center justify-between gap-3 text-sm text-slate-600"><span>ITBIS</span><strong className="text-ink">{formatCurrency(totals.tax)}</strong></div>
              <div className="border-t border-slate-200 pt-3"><div className="text-xs uppercase tracking-[0.22em] text-slate-500">Total</div><div className="mt-2 text-3xl font-bold text-ink">{formatCurrency(totals.total)}</div>{saleType === 'credit' ? <div className="mt-2 text-sm text-amber-700">Saldo proyectado: {formatCurrency(totals.balance)}</div> : <div className="mt-2 text-sm text-emerald-700">Vuelto proyectado: {formatCurrency(totals.change)}</div>}</div>
            </div>
            {previewLoading ? <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Calculando promociones...</div> : null}
            {previewError ? <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">{previewError}</div> : null}
            {saleType === 'credit' && !customerId ? <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">Debes seleccionar un cliente para registrar una venta a credito.</div> : null}
            {preview?.appliedDiscounts?.length ? <div className="rounded-[24px] bg-ink/5 p-5"><div className="text-xs uppercase tracking-[0.22em] text-slate-500">Descuentos aplicados</div><div className="mt-4 space-y-2">{preview.appliedDiscounts.map((item, index) => <div key={`${item.id}-${index}`} className="flex items-center justify-between gap-3 text-sm"><span className="font-medium text-slate-700">{item.name}</span><span className="font-semibold text-emerald-700">- {formatCurrency(item.amount)}</span></div>)}</div></div> : null}
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => setPayments([{ method: 'cash', amount: totals.total.toFixed(2), reference: '' }])}>Total en efectivo</Button>
              <Button variant="secondary" onClick={() => setPayments([{ method: 'card', amount: totals.total.toFixed(2), reference: '' }])}>Total en tarjeta</Button>
              {window.orbit?.customerDisplay ? (customerDisplayOpen ? <Button variant="ghost" onClick={closeCustomerDisplay}>Cerrar pantalla cliente</Button> : <Button variant="secondary" onClick={openCustomerDisplay}>Abrir pantalla cliente</Button>) : null}
            </div>
            <PaymentSplitEditor splits={payments} onChange={setPayments} title={saleType === 'credit' ? 'Abono inicial' : 'Pago mixto'} />
            {window.orbit?.customerDisplay ? <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Pantalla cliente: {customerDisplayOpen ? 'activa' : 'inactiva'}</div> : <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Pantalla cliente disponible en la app de escritorio.</div>}
          </div>
          <div className="mt-4 rounded-[24px] bg-ink p-5 text-white"><div className="flex flex-wrap items-center justify-between gap-4"><div><div className="text-xs uppercase tracking-[0.2em] text-white/58">Accion principal</div><div className="mt-2 text-lg font-semibold">Registrar venta y emitir ticket</div></div><Button disabled={submitting || !canSubmitSale} onClick={submitSale}>{submitting ? 'Procesando...' : 'Registrar venta'}</Button></div></div>
        </Panel>
      </div>

      <TicketPreview title="Ticket generado" content={ticketPreview} actions={lastSaleId ? <Button variant="secondary" onClick={reprintLastSale}>Reimprimir</Button> : null} />
    </div>
  );
}
