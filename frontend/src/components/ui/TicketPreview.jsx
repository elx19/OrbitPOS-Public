import Panel from './Panel';

export default function TicketPreview({ title = 'Vista previa', content, actions = null }) {
  if (!content) {
    return null;
  }

  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs uppercase tracking-[0.24em] text-slate-500">{title}</div>
        {actions}
      </div>
      <pre className="soft-scrollbar mt-4 overflow-auto rounded-[24px] bg-ink p-5 text-xs leading-6 text-amber-50">
        {content}
      </pre>
    </Panel>
  );
}
