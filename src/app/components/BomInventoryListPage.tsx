import { useState, useEffect } from 'react';
import { X, Search, FileText, Download, RefreshCw, Columns3, MoreVertical, Plus, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { BomInventoryTable } from './BomInventoryTable';
import { Pagination } from './Pagination';
import { useDrawerStack } from './DrawerStack';
import { mockEndpoints } from './EndpointsListPage';
import type { Endpoint } from './EndpointsListPage';
import { bomForEndpoint } from './bomData';
import type { Patch } from './PatchesListPage';

/* BOM Inventory — the BOM module's listing. Same fleet as the Endpoints page, but every column
 * answers a BOM question (what was generated, how much of it, and how much of it is a problem).
 * Clicking a row opens that endpoint's detail page landed on its BOM tab. */

type Scope = 'agent' | 'managed';

/** Adapt an endpoint onto the Patch shape the EndpointDrawer body expects, flagged so the
 *  drawer lands on the BOM tab (the same record opened from Patch/Vulnerability does not). */
const endpointToBomShape = (e: Endpoint): Patch => ({
  id: e.id,
  name: e.hostName,
  severity: 'Unspecified',
  releaseDate: '---',
  missingSystem: null,
  installedSystem: null,
  rebootRequired: e.rebootRequired === 'Yes' ? 'Yes' : 'No',
  approvalStatus: 'Approved',
  category: 'Endpoint',
  endpoint: { agentOnline: e.agentOnline, systemHealth: e.systemHealth },
  bomMode: true,
});

function BomToolbar({
  searchQuery, setSearchQuery, scope, setScope, agentCount, managedCount,
}: {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  scope: Scope;
  setScope: (s: Scope) => void;
  agentCount: number;
  managedCount: number;
}) {
  const IconBtn = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <button className="flex h-[30px] w-[30px] items-center justify-center rounded text-[#6b7280] hover:bg-[#f3f4f6]" title={title}>
      {children}
    </button>
  );
  const ScopePill = ({ id, label, count }: { id: Scope; label: string; count: number }) => (
    <button
      onClick={() => setScope(id)}
      className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
        scope === id ? 'bg-[#3D8BD0] text-white' : 'text-[#364658] hover:bg-[#F5F7FA]'
      }`}
    >
      {label}
      <span className={scope === id ? 'text-white/80' : 'text-[#7B8FA5]'}>· {count}</span>
    </button>
  );

  return (
    <div className="bg-white">
      {/* First row: title + scope pills + Ingest CTA + actions */}
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-[16px] font-semibold text-[#364658]">BOM Inventory</h1>
          <div className="flex items-center gap-1 rounded border border-[#DFE5ED] p-0.5">
            <ScopePill id="agent" label="Agent CIs" count={agentCount} />
            <ScopePill id="managed" label="Managed CIs" count={managedCount} />
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => toast.success('BOM ingestion started — upload a CycloneDX or SPDX document to attach it to a CI')}
            className="mr-1 inline-flex h-8 items-center gap-1.5 rounded bg-[#3D8BD0] px-3 text-[13px] font-medium text-white transition-colors hover:bg-[#3479b5]"
          >
            <Plus size={15} /> Ingest BOM
          </button>
          <IconBtn title="Export"><FileText size={16} /></IconBtn>
          <IconBtn title="Download"><Download size={16} /></IconBtn>
          <IconBtn title="Refresh"><RefreshCw size={16} /></IconBtn>
          <IconBtn title="Columns"><Columns3 size={16} /></IconBtn>
          <IconBtn title="More"><MoreVertical size={16} /></IconBtn>
        </div>
      </div>

      {/* Second row: full-width search */}
      <div className="px-6 pb-3">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Select field to search..."
            className="h-[36px] w-full rounded border border-[#d1d5db] bg-white pl-3 pr-10 text-[13px] text-[#364658] placeholder:text-[#9ca3af] focus:border-[#3D8BD0] focus:outline-none focus:ring-1 focus:ring-[#3D8BD0]"
          />
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af] transition-colors hover:text-[#364658]"
            >
              <X size={16} />
            </button>
          ) : (
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" size={16} />
          )}
        </div>
      </div>
    </div>
  );
}

export function BomInventoryListPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const [scope, setScope] = useState<Scope>('agent');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { setCurrentPage(1); setSelected(new Set()); }, [searchQuery, scope]);

  const { open: openInStack } = useDrawerStack();
  const handleOpen = (e: Endpoint) => openInStack('endpoints', e.id, e.hostName, endpointToBomShape(e));

  // Agent CIs = the fleet the agent reports on. Managed CIs (agentless / imported BOMs) is a
  // separate ingest path and has no records in this prototype.
  const all = mockEndpoints.map((e) => ({ endpoint: e, bom: bomForEndpoint(e.id) }));
  const scoped = scope === 'agent' ? all : [];

  const q = searchQuery.trim().toLowerCase();
  const filtered = !q ? scoped : scoped.filter(({ endpoint: e, bom }) =>
    e.id.toLowerCase().includes(q) ||
    e.hostName.toLowerCase().includes(q) ||
    e.ipAddress.toLowerCase().includes(q) ||
    e.osName.toLowerCase().includes(q) ||
    bom.status.toLowerCase().includes(q) ||
    bom.products.some((p) => p.name.toLowerCase().includes(q)) ||
    (bom.lastGenerated ?? '').toLowerCase().includes(q)
  );

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const pageIds = paginated.map((r) => r.endpoint.id);
  const allCurrentSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  const handleSelectAll = (checked: boolean) => setSelected(checked ? new Set(pageIds) : new Set());
  const handleSelect = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  };

  return (
    <div className="flex h-screen bg-[#f9fafb]">
      <Sidebar activePage="bom" onNavigate={onNavigate} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header selectedCount={selected.size} onOpenAdmin={() => onNavigate('admin')} />
        <BomToolbar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          scope={scope}
          setScope={setScope}
          agentCount={all.length}
          managedCount={0}
        />
        <main className="flex flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-auto bg-white">
            {scope === 'managed' ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="mb-3 inline-flex size-14 items-center justify-center rounded-full bg-[#F5F7FA]">
                  <Layers className="size-6 text-[#9CA3AF]" />
                </div>
                <p className="text-[14px] font-medium text-[#364658]">No managed CIs yet</p>
                <p className="mt-1 max-w-[420px] text-[13px] text-[#7B8FA5]">
                  Managed CIs carry a BOM that was ingested rather than scanned by an agent. Use
                  <span className="font-medium text-[#364658]"> Ingest BOM </span>
                  to attach a CycloneDX or SPDX document to a CI.
                </p>
              </div>
            ) : (
              <BomInventoryTable
                rows={paginated}
                selected={selected}
                allSelected={allCurrentSelected}
                onSelectAll={handleSelectAll}
                onSelect={handleSelect}
                onRowClick={handleOpen}
              />
            )}
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            itemsPerPage={itemsPerPage}
            totalItems={filtered.length}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={(v) => { setItemsPerPage(v); setCurrentPage(1); }}
          />
        </main>
      </div>
    </div>
  );
}
