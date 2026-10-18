import { classNames } from '../../lib/format';

export default function Panel({ id, className, children }) {
  return (
    <section id={id} className={classNames('orbit-card p-6', className)}>
      {children}
    </section>
  );
}

