import Panel from '../ui/Panel';

export default function ModulePlaceholder({ title, description }) {
  return (
    <Panel>
      <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Modulo en preparacion</div>
      <h2 className="mt-3 text-3xl font-bold text-ink">{title}</h2>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">{description}</p>
    </Panel>
  );
}

