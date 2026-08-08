import { useRef, useState } from 'react';
import { Header } from './Header';
import { AdminSidebar } from './AdminSidebar';
import { AdminOverview } from './AdminOverview';
import { ADMIN_SECTIONS, sectionByTitle } from './adminData';

/* Admin hub — the settings surface. Its own shell: the product's left icon rail is replaced by a
 * grouped settings nav, with "Back to app" as the way out.
 *
 * The sidebar and the Overview share one section list, and selecting in the sidebar scrolls the
 * Overview rather than swapping the pane — the whole point of a hub is that it is one surface. */

export function AdminPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const [active, setActive] = useState('Overview');
  const [query, setQuery] = useState('');
  // Only the first section starts open, mirroring the live admin.
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set([ADMIN_SECTIONS[0].key]));
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const toggle = (key: string) =>
    setOpenKeys((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const select = (title: string) => {
    setActive(title);
    if (title === 'Overview') {
      sectionRefs.current[ADMIN_SECTIONS[0].key]?.parentElement?.scrollTo({ top: 0, behavior: 'smooth' });
      document.querySelector('[data-admin-scroll]')?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const s = sectionByTitle(title);
    if (!s) return;
    // Opening it first means the scroll lands on content, not on a collapsed strip.
    setOpenKeys((prev) => new Set(prev).add(s.key));
    requestAnimationFrame(() => {
      sectionRefs.current[s.key]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  return (
    <div className="flex h-screen flex-col bg-[#F7F9FC]">
      <Header selectedCount={0} />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <AdminSidebar active={active} onSelect={select} onBackToApp={() => onNavigate('request')} />
        <div data-admin-scroll className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <AdminOverview
            openKeys={openKeys}
            onToggle={toggle}
            query={query}
            onQuery={setQuery}
            registerSection={(key, el) => { sectionRefs.current[key] = el; }}
          />
        </div>
      </div>
    </div>
  );
}
