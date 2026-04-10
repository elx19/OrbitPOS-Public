import { classNames } from '../../lib/format';

export default function Panel({ className, children }) {
  return (
    <section className={classNames('glass-panel rounded-[28px] p-6', className)}>
      {children}
    </section>
  );
}

