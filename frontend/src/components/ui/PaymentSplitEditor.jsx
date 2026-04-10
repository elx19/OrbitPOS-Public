import Button from './Button';
import { Field, Input, Select } from './Field';

const methodOptions = [
  ['cash', 'Efectivo'],
  ['card', 'Tarjeta'],
  ['transfer', 'Transferencia']
];

export default function PaymentSplitEditor({ splits, onChange, title = 'Metodos de pago' }) {
  function updateSplit(index, patch) {
    onChange(splits.map((split, splitIndex) => (
      splitIndex === index ? { ...split, ...patch } : split
    )));
  }

  function addSplit() {
    onChange([...splits, { method: 'cash', amount: '', reference: '' }]);
  }

  function removeSplit(index) {
    if (splits.length === 1) {
      onChange([{ method: 'cash', amount: '', reference: '' }]);
      return;
    }
    onChange(splits.filter((_, splitIndex) => splitIndex !== index));
  }

  return (
    <div className="space-y-4 rounded-[24px] bg-white/72 p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-ink">{title}</h3>
        <Button variant="secondary" onClick={addSplit}>
          Agregar metodo
        </Button>
      </div>

      <div className="space-y-4">
        {splits.map((split, index) => (
          <div key={`${split.method}-${index}`} className="grid gap-4 rounded-[22px] border border-slate-200/80 bg-white/85 p-4 md:grid-cols-[1fr,1fr,auto]">
            <Field label="Metodo">
              <Select
                value={split.method}
                onChange={(event) => updateSplit(index, { method: event.target.value })}
              >
                {methodOptions.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </Field>

            <Field label="Monto">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={split.amount}
                onChange={(event) => updateSplit(index, { amount: event.target.value })}
                placeholder="0.00"
              />
            </Field>

            <div className="grid gap-4 md:grid-cols-[1fr,auto] md:col-span-2">
              <Field label="Referencia">
                <Input
                  value={split.reference}
                  onChange={(event) => updateSplit(index, { reference: event.target.value })}
                  placeholder="Opcional"
                />
              </Field>

              <div className="flex items-end">
                <Button variant="ghost" onClick={() => removeSplit(index)}>
                  Quitar
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

