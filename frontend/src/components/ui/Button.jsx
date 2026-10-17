import { classNames } from '../../lib/format';

const variants = {
  primary: 'orbit-primary-button',
  secondary: 'theme-button-secondary',
  ghost: 'theme-button-ghost hover:bg-slate-100',
  danger: 'bg-rosewood text-white hover:bg-orange-950'
};

export default function Button({
  type = 'button',
  variant = 'primary',
  className,
  children,
  disabled,
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={classNames(
        'inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
