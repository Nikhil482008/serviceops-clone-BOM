import { useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Header } from './Header';
import { AdminSidebar } from './AdminSidebar';
import { AdminOverview } from './AdminOverview';
import { ADMIN_SECTIONS, sectionByTitle } from './adminData';

/* Admin hub — the settings surface. Its own shell: the product's left icon rail is replaced by a
 * grouped settings nav, with "Back to app" as the way out.
 *
 * The sidebar and the Overview share one section list, and selecting in the sidebar scrolls the
 * Overview rather than swapping the pane — the whole point of a hub is that it is one surface.
 * The exception is a card that owns a BUILT screen (the BOM Management trio): those swap the pane
 * to the settings page itself, with the breadcrumb as the way back — the hub stays the index,
 * the page is where the work happens. */

type AdminView = 'hub' | 'bom-policies' | 'bom-scopes' | 'bom-licensing' | 'bom-scheduler' | 'bom-retention';

/* The BOM settings screens are the original prototype in public/bom-admin —
 * mounted as-is rather than reimplemented, so they stay pixel-identical to the
 * signed-off design instead of drifting with every restyle. */
const BOM_SCREENS: Record<Exclude<AdminView, 'hub'>, { label: string; route: string }> = {
  'bom-policies':  { label: 'BOM Policies',  route: '#/admin/bom-policies' },
  'bom-scopes':    { label: 'CI Scopes',     route: '#/admin/bom-scopes' },
  'bom-licensing': { label: 'BOM Licensing', route: '#/admin/bom-licensing' },
  'bom-scheduler': { label: 'BOM Scheduler', route: '#/admin/bom-scheduler' },
  'bom-retention': { label: 'BOM Retention', route: '#/admin/bom-retention' },
};

export function AdminPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const [active, setActive] = useState('Overview');
  const [view, setView] = useState<AdminView>('hub');
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
    setView('hub');   // sidebar selection always returns to the hub surface first
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
        <div data-admin-scroll className={`flex min-h-0 flex-1 flex-col ${view === 'hub' ? 'overflow-y-auto' : 'overflow-hidden'}`}>
          {view === 'hub' ? (
            <AdminOverview
              openKeys={openKeys}
              onToggle={toggle}
              query={query}
              onQuery={setQuery}
              registerSection={(key, el) => { sectionRefs.current[key] = el; }}
              onOpenCard={(page) => { setView(page as AdminView); setActive('BOM Management'); }}
            />
          ) : (
            <>
              <div className="flex flex-shrink-0 items-center gap-1 border-b border-[#E5E7EB] bg-white px-6 py-2">
                <button onClick={() => { setView('hub'); setActive('Overview'); }}
                        className="inline-flex items-center gap-1 text-[12px] font-medium text-[#7B8FA5] transition-colors hover:text-[#3D8BD0]">
                  <ChevronLeft size={13} /> Admin
                </button>
                <span className="text-[12px] text-[#9CA3AF]">›</span>
                <span className="text-[12px] text-[#364658]">{BOM_SCREENS[view].label}</span>
              </div>
              <iframe
                key={view}
                title={BOM_SCREENS[view].label}
                src={`${import.meta.env.BASE_URL}bom-admin/index.html?embed=1${BOM_SCREENS[view].route}`}
                className="min-h-0 w-full flex-1 border-0"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
