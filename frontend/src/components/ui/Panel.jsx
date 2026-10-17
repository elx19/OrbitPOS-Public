import { classNames } from '../../lib/format';

export default function Panel({ className, children }) {
  return (
    <section className={classNames('orbit-card p-6', className)}>
      {children}
    </section>
  );
}

