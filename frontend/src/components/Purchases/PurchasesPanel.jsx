import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../lib/api';
import { formatCurrency, formatDateTime } from '../../lib/format';
import Button from '../ui/Button';
import { Field, Input, Select, TextArea } from '../ui/Field';
import Panel from '../ui/Panel';

function createLine() {
  return {
    productId: '',
    quantity: '1',
    unitCost: '',
    updateCostPrice: true,
    newSalePrice: ''
  };
}

export default function PurchasesPanel({ token, onActivity }) {
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [supplierId, setSupplierId] = useState('');
  const [invoiceRef, setInvoiceRef] = useState('');
  const [productQuery, setProductQuery] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState([createLine()]);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadData() {
    const [suppliersResult, productsResult, purchasesResult] = await Promise.all([
      apiRequest('/api/suppliers', { token }),
      apiRequest('/api/products?active=all', { token }),
      apiRequest('/api/purchases', { token })
    ]);
    setSuppliers(suppliersResult);
    setProducts(productsResult);
    setPurchases(purchasesResult);
  }

  useEffect(() => {
    loadData();
  }, [token]);

  const purchaseTotal = useMemo(
    () => lines.reduce((sum, line) => sum + (Number(line.quantity || 0) * Number(line.unitCost || 0)), 0),
    [lines]
  );

  const filteredProducts = useMemo(() => {
    const normalizedQuery = productQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return products;
    }
    return products.filter((product) => `${product.name} ${product.barcode || ''} ${product.category || ''}`.toLowerCase().includes(normalizedQuery));
  }, [productQuery, products]);

  const purchaseCount = purchases.length;
  const hasValidLine = lines.some((line) => line.productId && Number(line.quantity || 0) > 0 && Number(line.unitCost || 0) >= 0);
  const registeredTotal = useMemo(
    () => purchases.reduce((sum, purchase) => sum + Number(purchase.total || 0), 0),
    [purchases]
  );

  function updateLine(index, patch) {
    setLines((current) => current.map((line, lineIndex) => (
      lineIndex === index ? { ...line, ...patch } : line
    )));
  }

  function addLine() {
    setLines((current) => [...current, createLine()]);
  }

  function removeLine(index) {
    setLines((current) => current.length === 1 ? [createLine()] : current.filter((_, lineIndex) => lineIndex !== index));
  }

  async function handleSubmit() {
    setSaving(true);
    setMessage('');

    try {
      await apiRequest('/api/purchases', {
        method: 'POST',
        token,
        body: {
          supplierId: supplierId ? Number(supplierId) : null,
          invoiceRef,
          notes,
          items: lines.map((line) => ({
            productId: Number(line.productId),
            quantity: Number(line.quantity || 0),
            unitCost: Number(line.unitCost || 0),
            updateCostPrice: Boolean(line.updateCostPrice),
            newSalePrice: line.newSalePrice === '' ? null : Number(line.newSalePrice)
          }))
        }
      });

      setMessage('Compra registrada y stock actualizado.');
      setSupplierId('');
      setInvoiceRef('');
      setProductQuery('');
      setNotes('');
      setLines([createLine()]);
      await loadData();
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
            <h2 className="text-4xl font-bold text-ink">Compras</h2>
            <p className="mt-3 text-sm text-slate-600">
              Gestiona tus órdenes de compra y recibe inventario de forma fácil.
            </p>
          </div>
          <div className="grid w-full gap-3 sm:grid-cols-3 xl:w-auto xl:min-w-[520px]">
            <div className="rounded-[24px] border border-slate-200 bg-white/80 px-5 py-4">
              <div className="text-xs font-medium text-slate-500">Compras registradas</div>
              <div className="mt-2 text-2xl font-bold text-ink">{purchaseCount}</div>
              <div className="mt-1 text-xs text-slate-500">en este equipo</div>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-white/80 px-5 py-4">
              <div className="text-xs font-medium text-slate-500">Total comprado</div>
              <div className="mt-2 text-2xl font-bold text-ink">{formatCurrency(registeredTotal)}</div>
              <div className="mt-1 text-xs text-emerald-600">historial acumulado</div>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-white/80 px-5 py-4">
              <div className="text-xs font-medium text-slate-500">Proveedores activos</div>
              <div className="mt-2 text-2xl font-bold text-ink">{suppliers.length}</div>
              <div className="mt-1 text-xs text-slate-500">disponibles para comprar</div>
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.04fr),minmax(320px,0.96fr)]">
        <Panel>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h3 className="text-2xl font-bold text-ink">Nueva compra</h3>
              <div className="mt-1 text-sm text-slate-500">Registra los productos recibidos y actualiza sus costos.</div>
            </div>
            <div className="rounded-[24px] bg-white/78 px-5 py-4 text-right">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Proveedor actual</div>
              <div className="mt-2 truncate text-lg font-bold text-ink">
                {suppliers.find((supplier) => String(supplier.id) === String(supplierId))?.name || 'Sin seleccionar'}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Field label="Proveedor">
              <Select value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
                <option value="">Seleccionar proveedor</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Referencia factura">
              <Input value={invoiceRef} onChange={(event) => setInvoiceRef(event.target.value)} />
            </Field>
          </div>

          <div className="mt-5">
            <Field label="Buscar producto">
              <Input value={productQuery} onChange={(event) => setProductQuery(event.target.value)} placeholder="Buscar producto por nombre, código o escanear..." />
            </Field>
          </div>

          <div className="soft-scrollbar mt-5 max-h-[430px] space-y-4 overflow-auto pr-1">
            {lines.map((line, index) => (
              <div key={index} className="rounded-[24px] bg-white/78 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-ink">Linea #{index + 1}</div>
                  <Button variant="ghost" onClick={() => removeLine(index)}>
                    Quitar linea
                  </Button>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Field label="Producto">
                    <Select value={line.productId} onChange={(event) => updateLine(index, { productId: event.target.value })}>
                      <option value="">Seleccionar producto</option>
                      {filteredProducts.map((product) => (
                        <option key={product.id} value={product.id}>{product.name}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Cantidad">
                    <Input type="number" min="0.01" step="0.01" value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} />
                  </Field>
                  <Field label="Costo unitario">
                    <Input type="number" min="0" step="0.01" value={line.unitCost} onChange={(event) => updateLine(index, { unitCost: event.target.value })} />
                  </Field>
                  <Field label="Nuevo precio de venta (opcional)">
                    <Input type="number" min="0" step="0.01" value={line.newSalePrice} onChange={(event) => updateLine(index, { newSalePrice: event.target.value })} />
                  </Field>
                  <label className="flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-4 text-sm font-semibold text-slate-700 md:col-span-2">
                    <input type="checkbox" checked={line.updateCostPrice} onChange={(event) => updateLine(index, { updateCostPrice: event.target.checked })} />
                    Actualizar costo del producto
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Button variant="secondary" onClick={addLine}>
              Agregar producto
            </Button>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr),240px]">
            <Field label="Notas">
              <TextArea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} />
            </Field>

            <div className="rounded-[24px] bg-white/78 p-5">
              <div className="text-xs uppercase tracking-[0.22em] text-slate-500">Total estimado</div>
              <div className="mt-2 text-3xl font-bold text-ink">{formatCurrency(purchaseTotal)}</div>
              <div className="mt-3 text-sm text-slate-500">
                Guarda esta compra para aumentar el inventario y registrar el movimiento.
              </div>
            </div>
          </div>

          {message ? (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {message}
            </div>
          ) : null}

          <div className="mt-5">
            <Button disabled={saving || !hasValidLine} onClick={handleSubmit}>
              {saving ? 'Guardando...' : 'Registrar compra'}
            </Button>
          </div>
        </Panel>

        <Panel className="overflow-hidden">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-2xl font-bold text-ink">Entrada de inventario</h3>
              <div className="mt-1 text-sm text-slate-500">Confirma las cantidades recibidas para actualizar el stock.</div>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">Lista para recibir</span>
          </div>

          <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-sm text-blue-900">
            <div className="font-semibold">Recibir inventario de esta compra</div>
            <div className="mt-1 text-xs text-blue-700">El registro confirma la compra y suma las cantidades al inventario.</div>
          </div>

          <div className="mt-5">
            <div className="text-sm font-semibold text-slate-700">Productos a recibir</div>
            <div className="mt-3 space-y-3">
              {lines.filter((line) => line.productId).length ? lines.filter((line) => line.productId).map((line, index) => {
                const product = products.find((item) => String(item.id) === String(line.productId));
                return (
                  <div key={`${line.productId}-${index}`} className="rounded-2xl border border-slate-200 bg-white/80 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-800">{product?.name || 'Producto seleccionado'}</div>
                        <div className="mt-1 text-xs text-slate-500">{line.quantity || 0} {product?.unit || 'unidad'}</div>
                      </div>
                      <div className="text-sm font-semibold text-ink">{formatCurrency(Number(line.quantity || 0) * Number(line.unitCost || 0))}</div>
                    </div>
                  </div>
                );
              }) : (
                <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">Agrega productos para ver la entrada.</div>
              )}
            </div>
          </div>

          <div className="mt-5 rounded-2xl bg-emerald-50 p-4">
            <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
              <span>Total de la compra</span>
              <span className="text-xl font-bold text-emerald-700">{formatCurrency(purchaseTotal)}</span>
            </div>
          </div>

          <div className="mt-5">
            <Button className="w-full" disabled={saving || !hasValidLine} onClick={handleSubmit}>
              {saving ? 'Confirmando...' : 'Confirmar entrada'}
            </Button>
          </div>
        </Panel>
      </div>

      <Panel className="overflow-hidden">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Historial</div>
            <h3 className="mt-2 text-2xl font-bold text-ink">Compras recientes</h3>
          </div>
          <div className="rounded-full bg-white/75 px-3 py-2 text-xs text-slate-500">{purchases.length} registro(s)</div>
        </div>
        <div className="soft-scrollbar mt-6 max-h-[320px] space-y-3 overflow-auto pr-1">
          {purchases.length ? purchases.map((purchase) => (
            <div key={purchase.id} className="rounded-[24px] bg-white/78 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-800">{purchase.supplier_name || 'Sin proveedor'}</div>
                  <div className="mt-1 text-xs text-slate-500">{purchase.invoice_ref || 'Sin referencia'} | {formatDateTime(purchase.created_at)}</div>
                </div>
                <div className="text-right text-sm font-semibold text-ink">{formatCurrency(purchase.total)}</div>
              </div>
            </div>
          )) : (
            <div className="rounded-[24px] bg-white/78 px-4 py-5 text-sm text-slate-500">Todavia no hay compras registradas.</div>
          )}
        </div>
      </Panel>
    </div>
  );
}
