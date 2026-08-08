import { useState } from 'react';
import { ChevronLeft, Search, X, House } from 'lucide-react';
import { ADMIN_NAV, sectionByTitle } from './adminData';
import { adminIcon } from './AdminIcons';

/* Admin left nav — grouped, searchable, and driven by the same ADMIN_SECTIONS the Overview
 * renders, so the two can never list different things.
 *
 * Selecting an item scrolls the Overview to that section and opens it; the sidebar does not
 * navigate away, which keeps the settings hub a single surface. */

interface AdminSidebarProps {
  /** Section title currently in view, or 'Overview'. */
  active: string;
  onSelect: (sectionTitle: string) => void;
  onBackToApp: () => void;
}

export function AdminSidebar({ active, onSelect, onBackToApp }: AdminSidebarProps) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  // Searching matches a section by its own name OR by any card inside it, so typing "SLA" or
  // "barcode" finds the section that owns it rather than coming back empty.
  const matches = (title: string) => {
    if (!q) return true;
    if (title.toLowerCase().includes(q)) return true;
    const s = sectionByTitle(title);
    return !!s && s.cards.some((c) => c.title.toLowerCase().includes(q));
  };

  const groups = ADMIN_NAV
    .map((g) => ({ ...g, items: g.items.filter(matches) }))
    .filter((g) => g.items.length > 0);

  const overviewVisible = !q || 'overview'.includes(q);

  return (
    <aside className="flex h-full w-[268px] flex-shrink-0 flex-col border-r border-[#e5e7eb] bg-white">
      {/* Back to app */}
      <button
        onClick={onBackToApp}
        className="flex items-center gap-1.5 px-5 pt-4 text-left text-[13px] font-medium text-[#364658] transition-colors hover:text-[#3D8BD0]"
      >
        <ChevronLeft size={16} className="text-[#7B8FA5]" />
        Back to app
      </button>

      {/* Search */}
      <div className="px-4 pb-3 pt-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" size={15} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search settings..."
            className="h-9 w-full rounded border border-[#d1d5db] bg-white pl-9 pr-8 text-[13px] text-[#364658] placeholder:text-[#9ca3af] focus:border-[#3D8BD0] focus:outline-none focus:ring-1 focus:ring-[#3D8BD0]"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9ca3af] transition-colors hover:text-[#364658]"
            ><X size={15} /></button>
          )}
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {overviewVisible && (
          <button
            onClick={() => onSelect('Overview')}
            className={`mb-1 flex w-full items-center gap-2.5 rounded px-3 py-2 text-left text-[13px] transition-colors ${
              active === 'Overview' ? 'bg-[#EBF5FF] font-medium text-[#3D8BD0]' : 'text-[#364658] hover:bg-[#F5F7FA]'
            }`}
          >
            <House size={16} className={active === 'Overview' ? 'text-[#3D8BD0]' : 'text-[#7B8FA5]'} />
            Overview
          </button>
        )}

        {groups.map((g) => (
          <div key={g.group} className="mt-4 first:mt-2">
            <div className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#7B8FA5]">
              {g.group}
            </div>
            {g.items.map((title) => {
              const s = sectionByTitle(title);
              const Icon = adminIcon(s?.icon ?? 'Settings2');
              const isActive = active === title;
              return (
                <button
                  key={title}
                  onClick={() => onSelect(title)}
                  className={`flex w-full items-center gap-2.5 rounded px-3 py-2 text-left text-[13px] transition-colors ${
                    isActive ? 'bg-[#EBF5FF] font-medium text-[#3D8BD0]' : 'text-[#364658] hover:bg-[#F5F7FA]'
                  }`}
                >
                  <Icon size={16} className={`flex-shrink-0 ${isActive ? 'text-[#3D8BD0]' : 'text-[#7B8FA5]'}`} />
                  <span className="truncate">{title}</span>
                  {/* Count is the honest signal of how much lives behind the row */}
                  <span className={`ml-auto flex-shrink-0 text-[11px] ${isActive ? 'text-[#3D8BD0]/70' : 'text-[#9CA3AF]'}`}>
                    {s?.cards.length ?? 0}
                  </span>
                </button>
              );
            })}
          </div>
        ))}

        {groups.length === 0 && !overviewVisible && (
          <div className="px-3 py-8 text-center text-[13px] text-[#9CA3AF]">
            No settings match “{query}”.
          </div>
        )}
      </nav>
    </aside>
  );
}
