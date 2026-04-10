import { classNames } from '../../lib/format';

const variants = {
  primary: 'bg-ember text-white shadow-lg shadow-amber-600/20 hover:bg-amber-700',
  secondary: 'theme-button-secondary',
  ghost: 'theme-button-ghost',
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
        'inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:cursor-not-allowed disabled:opacity-60',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
