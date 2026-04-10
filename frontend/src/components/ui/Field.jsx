import { classNames } from '../../lib/format';

export function Field({ label, hint, children }) {
  return (
    <label className="block space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="theme-label text-sm font-semibold">{label}</span>
        {hint ? <span className="theme-muted text-xs">{hint}</span> : null}
      </div>
      {children}
    </label>
  );
}

export function Input(props) {
  return (
    <input
      className={classNames(
        'theme-input w-full rounded-2xl border px-4 py-3 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200'
      )}
      {...props}
    />
  );
}

export function Select(props) {
  return (
    <select
      className="theme-input w-full rounded-2xl border px-4 py-3 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
      {...props}
    />
  );
}

export function TextArea(props) {
  return (
    <textarea
      className="theme-input w-full rounded-2xl border px-4 py-3 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
      {...props}
    />
  );
}
