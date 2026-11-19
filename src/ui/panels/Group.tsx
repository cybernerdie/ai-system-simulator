import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export function Group({ title, count, children, defaultOpen = true }: { title: string; count?: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="group">
      <button className="group-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>{title}</span>
        {count && <span className="group-count">{count}</span>}
        <ChevronDown size={14} className="group-chev" aria-hidden />
      </button>
      {open && <div className="group-body">{children}</div>}
    </section>
  );
}
