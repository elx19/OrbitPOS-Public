import { useEffect, useState } from 'react';
import { formatCurrency, formatDateTime } from '../../lib/format';

const emptyState = {
  businessName: 'OrbitPOS',
  saleType: 'cash',
  customerName: 'Consumidor final',
  statusText: 'Esperando venta',
  cart: [],
  payments: [],
  totals: {
    subtotal: 0,
    discount: 0,
    tax: 0,
    total: 0,
    change: 0,
    balance: 0
  },
  updatedAt: null
};

function paymentLabel(method = '') {
  const normalized = String(method).toLowerCase();
  if (normalized === 'cash') {
    return 'Efectivo';
  }
  if (normalized === 'card') {
    return 'Tarjeta';
  }
  if (normalized === 'transfer') {
    return 'Transferencia';
  }
  return normalized || 'Pago';
}

export default function CustomerDisplayScreen() {
  const [displayState, setDisplayState] = useState(emptyState);

  useEffect(() => {
    let active = true;

    window.orbit?.customerDisplay?.getState?.()
      .then((state) => {
        if (active && state) {
          setDisplayState((current) => ({ ...current, ...state }));
        }
      })
      .catch(() => {});

    function handleState(event) {
      setDisplayState((current) => ({
        ...current,
        ...(event.detail || {})
      }));
    }

    window.addEventListener('orbit:customer-display-state', handleState);

    return () => {
      active = false;
      window.removeEventListener('orbit:customer-display-state', handleState);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#08111c] text-white">
      <div className="mx-auto grid min-h-screen max-w-[1800px] gap-6 px-8 py-8 xl:grid-cols-[1.15fr,0.85fr]">
        <section className="rounded-[36px] border border-white/10 bg-white/6 p-8 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm uppercase tracking-[0.36em] text-white/55">OrbitPOS</div>
              <h1 className="mt-4 text-5xl font-bold">{displayState.businessName || 'Mi Negocio'}</h1>
              <div className="mt-4 text-lg text-white/70">
                Cliente: {displayState.customerName || 'Consumidor final'}
              </div>
            </div>
            <div className="rounded-full bg-amber-400/15 px-5 py-3 text-sm font-semibold text-amber-200">
              {displayState.saleType === 'credit' ? 'Venta a credito' : 'Venta de contado'}
            </div>
          </div>

          <div className="mt-8 grid gap-4">
            {displayState.cart.length ? displayState.cart.map((item, index) => (
              <div key={`${item.id || item.name}-${index}`} className="rounded-[28px] border border-white/10 bg-white/7 px-5 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-2xl font-semibold">{item.name}</div>
                    <div className="mt-2 text-sm text-white/55">
                      {Number(item.quantity || 0)} x {formatCurrency(item.unitPrice || item.sale_price || 0)}
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-amber-200">
                    {formatCurrency(item.subtotal ?? ((Number(item.quantity || 0) * Number(item.unitPrice || item.sale_price || 0)) - Number(item.discount || 0)))}
                  </div>
                </div>
              </div>
            )) : (
              <div className="flex min-h-[360px] items-center justify-center rounded-[32px] border border-dashed border-white/12 bg-white/5 text-center">
                <div>
                  <div className="text-3xl font-bold">Esperando articulos</div>
                  <div className="mt-3 text-lg text-white/55">
                    Los productos agregados en el POS apareceran aqui.
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        <aside className="flex flex-col gap-6">
          <div className="rounded-[36px] border border-white/10 bg-gradient-to-br from-amber-400/18 via-white/6 to-teal-300/12 p-8 backdrop-blur">
            <div className="text-sm uppercase tracking-[0.34em] text-white/55">Estado</div>
            <div className="mt-4 text-4xl font-bold">{displayState.statusText}</div>
            <div className="mt-3 text-sm text-white/55">
              Ultima actualizacion: {formatDateTime(displayState.updatedAt)}
            </div>
          </div>

          <div className="rounded-[36px] border border-white/10 bg-white/7 p-8 backdrop-blur">
            <div className="space-y-4 text-lg">
              <div className="flex items-center justify-between gap-4">
                <span className="text-white/65">Subtotal</span>
                <span className="font-semibold">{formatCurrency(displayState.totals.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-white/65">Descuento</span>
                <span className="font-semibold text-emerald-200">{formatCurrency(displayState.totals.discount)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-white/65">ITBIS</span>
                <span className="font-semibold">{formatCurrency(displayState.totals.tax)}</span>
              </div>
            </div>

            <div className="mt-8 rounded-[28px] bg-white px-6 py-6 text-slate-900">
              <div className="text-sm uppercase tracking-[0.32em] text-slate-500">Total</div>
              <div className="mt-3 text-6xl font-bold">{formatCurrency(displayState.totals.total)}</div>
            </div>

            <div className="mt-6 space-y-3 text-base">
              {displayState.payments.length ? displayState.payments.map((payment, index) => (
                <div key={`${payment.method}-${index}`} className="flex items-center justify-between gap-4 rounded-[20px] bg-white/6 px-4 py-3">
                  <span className="text-white/65">{paymentLabel(payment.method)}</span>
                  <span className="font-semibold">{formatCurrency(payment.amount)}</span>
                </div>
              )) : (
                <div className="rounded-[20px] bg-white/6 px-4 py-3 text-white/55">
                  El detalle de pago aparecera al momento de cobrar.
                </div>
              )}
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <div className="rounded-[22px] bg-emerald-400/10 px-4 py-4">
                <div className="text-sm uppercase tracking-[0.24em] text-emerald-100/70">Vuelto</div>
                <div className="mt-2 text-2xl font-bold text-emerald-100">
                  {formatCurrency(displayState.totals.change)}
                </div>
              </div>
              <div className="rounded-[22px] bg-amber-400/10 px-4 py-4">
                <div className="text-sm uppercase tracking-[0.24em] text-amber-100/70">Saldo</div>
                <div className="mt-2 text-2xl font-bold text-amber-100">
                  {formatCurrency(displayState.totals.balance)}
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
