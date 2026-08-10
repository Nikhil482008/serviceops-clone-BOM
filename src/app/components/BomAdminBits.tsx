import { ReactNode, useState } from 'react';
import { X, ChevronLeft, Filter, Search, Users, ListFilter } from 'lucide-react';
import { Ci, CondGroup, matches } from './bomAdminData';
import { BomConditionBuilder } from './BomConditionBuilder';

/* Small shared pieces for the BOM admin screens — drawer shell, KPI tile, switch, pills —
 * matching the module's existing panels (BomScanPathsPanel et al.) so the three new screens
 * read as the same product. */

export function BomDrawer({ width = 560, title, sub, onClose, children, footer }: {
  width?: number; title: string; sub?: string; onClose: () => void;
  children: ReactNode; footer?: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-end bg-black/50">
      <div style={{ width }} className="flex h-full max-w-[96vw] flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-[#DFE5ED] px-5 py-3">
          <div className="min-w-0">
            <h3 className="text-[16px] font-semibold text-[#364658]">{title}</h3>
            {sub && <p className="mt-0.5 text-[13px] text-[#7B8FA5]">{sub}</p>}
          </div>
          <button onClick={onClose} className="flex size-8 flex-shrink-0 items-center justify-center rounded text-[#7B8FA5] transition-colors hover:bg-[#F3F4F6] hover:text-[#364658]">
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-[#DFE5ED] px-5 py-3">{footer}</div>
        )}
      </div>
    </div>
  );
}

export function BomPageHead({ title, sub, onBack, actions }: {
  title: string; sub: string; onBack: () => void; actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <button onClick={onBack} className="mb-1 inline-flex items-center gap-1 text-[12px] font-medium text-[#7B8FA5] transition-colors hover:text-[#3D8BD0]">
          <ChevronLeft size={13} /> Admin · BOM Management
        </button>
        <h1 className="text-[20px] font-semibold text-[#364658]">{title}</h1>
        <p className="mt-1 max-w-[720px] text-[13px] leading-[1.55] text-[#7B8FA5]">{sub}</p>
      </div>
      {actions && <div className="flex items-center gap-2 pt-6">{actions}</div>}
    </div>
  );
}

export function Kpi({ label, value, sub, tone }: {
  label: string; value: ReactNode; sub?: string; tone?: 'ok' | 'warn' | 'danger';
}) {
  const color = tone === 'danger' ? 'text-[#DC2626]' : tone === 'warn' ? 'text-[#D97706]' : 'text-[#364658]';
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-3">
      <div className="text-[12px] text-[#7B8FA5]">{label}</div>
      <div className={`mt-1 text-[22px] font-semibold leading-none tracking-[-0.02em] ${color}`} style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div className="mt-1.5 text-[12px] text-[#9CA3AF]">{sub}</div>}
    </div>
  );
}

export function BomSwitch({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      role="switch" aria-checked={on} aria-label={label} onClick={onClick}
      className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors ${on ? 'bg-[#3D8BD0]' : 'bg-[#CBCED4]'}`}
    >
      <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
    </button>
  );
}

export function StatusPill({ on, onLabel = 'Active', offLabel = 'Disabled' }: {
  on: boolean; onLabel?: string; offLabel?: string;
}) {
  return on ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF3] px-2 py-0.5 text-[11px] font-medium text-[#22A06B]">
      <span className="size-1.5 rounded-full bg-[#22C55E]" />{onLabel}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[11px] font-medium text-[#64748B]">
      <span className="size-1.5 rounded-full bg-[#94A3B8]" />{offLabel}
    </span>
  );
}

/** Two-step destructive action: first click arms it, second confirms — the consequence is
 *  named in place instead of a browser dialog. */
export function ConfirmButton({ armed, onArm, onConfirm, onCancel, confirmText }: {
  armed: boolean; onArm: () => void; onConfirm: () => void; onCancel: () => void; confirmText: string;
}) {
  if (!armed) {
    return (
      <button onClick={onArm} className="rounded px-2 py-1 text-[12px] font-medium text-[#7B8FA5] transition-colors hover:bg-[#FEF3F2] hover:text-[#DC2626]">
        Delete
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <button onClick={onConfirm} className="rounded bg-[#DC2626] px-2 py-1 text-[12px] font-medium text-white hover:bg-[#b91c1c]">{confirmText}</button>
      <button onClick={onCancel} className="rounded px-2 py-1 text-[12px] text-[#7B8FA5] hover:bg-[#F3F4F6]">Cancel</button>
    </span>
  );
}

/** The concept's summary strip — a few facts, not a KPI row. */
export function SumStrip({ cells }: { cells: { label: string; value: ReactNode; unit?: ReactNode; quiet?: boolean; danger?: boolean }[] }) {
  return (
    <div className="grid gap-px overflow-hidden rounded-xl border border-[#E5E7EB] bg-[#E5E7EB]" style={{ gridTemplateColumns: `repeat(${cells.length}, 1fr)` }}>
      {cells.map((c, i) => (
        <div key={i} className="bg-white px-4 py-3">
          <div className="text-[12px] text-[#7B8FA5]">{c.label}</div>
          <div className={`mt-1 text-[18px] font-semibold leading-none ${c.danger ? 'text-[#DC2626]' : c.quiet ? 'text-[#9CA3AF]' : 'text-[#364658]'}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
            {c.value}{c.unit && <span className="ml-1.5 text-[12px] font-normal text-[#9CA3AF]">{c.unit}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

export interface FilterDef { g: string; id: string; lab: string }

/** ONE filter control (design system §5.3) — funnel + count badge opening one popover of
 *  grouped checkboxes. OR within a group, AND across groups. */
export function FilterControl({ defs, active, onChange }: {
  defs: FilterDef[]; active: Set<string>; onChange: (next: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const groups = [...new Set(defs.map((f) => f.g))];
  return (
    <span className="relative inline-flex">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex h-8 items-center gap-1.5 rounded border px-2.5 text-[12px] font-medium transition-colors ${active.size ? 'border-[#3D8BD0] bg-[#EBF5FF] text-[#3D8BD0]' : 'border-[#d1d5db] bg-white text-[#364658] hover:bg-[#F9FAFB]'}`}
      >
        <Filter size={13} /> Filter
        {active.size > 0 && (
          <span className="inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-[#3D8BD0] px-1 text-[10px] font-semibold text-white">{active.size}</span>
        )}
      </button>
      {open && (
        <>
          <span className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 z-[61] w-[210px] rounded-lg border border-[#E5E7EB] bg-white py-2 shadow-[0_8px_24px_-8px_rgba(16,24,40,0.2)]">
            {groups.map((g, gi) => (
              <div key={g}>
                {gi > 0 && <div className="my-1.5 border-t border-[#F0F2F5]" />}
                <div className="px-3 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#9CA3AF]">{g}</div>
                {defs.filter((f) => f.g === g).map((f) => (
                  <label key={f.id} className="flex cursor-pointer items-center gap-2 px-3 py-1 text-[13px] text-[#364658] hover:bg-[#F9FAFB]">
                    <input
                      type="checkbox" checked={active.has(f.id)} className="size-3.5 accent-[#3D8BD0]"
                      onChange={() => { const next = new Set(active); next.has(f.id) ? next.delete(f.id) : next.add(f.id); onChange(next); }}
                    />
                    {f.lab}
                  </label>
                ))}
              </div>
            ))}
            {active.size > 0 && (
              <button onClick={() => onChange(new Set())} className="mt-1 w-full border-t border-[#F0F2F5] px-3 pt-1.5 pb-0.5 text-left text-[12px] text-[#3D8BD0] hover:underline">
                Clear all
              </button>
            )}
          </div>
        </>
      )}
    </span>
  );
}

/** Stacked CI picker — choose from a pool with search + select-shown. Used by the licensing
 *  manual enrol (unenrolled pool + seat gate) and the scheduler / retention targeting tiles
 *  (enrolled pool, no seats). Edits a local draft; commits on Apply. */
export function CiPickerDrawer({ title, sub, pool, initial, applyLabel, seatNote, onApply, onClose }: {
  title: string; sub: string; pool: Ci[]; initial: string[];
  applyLabel: (n: number) => string;
  /** Renders a seat bar; blocks Apply when it returns a negative remainder. */
  seatNote?: (selected: number) => { text: ReactNode; over: boolean };
  onApply: (ids: string[]) => void; onClose: () => void;
}) {
  const [sel, setSel] = useState<Set<string>>(new Set(initial));
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const list = pool.filter((c) => !query || [c.id, c.host, c.type, c.os, c.ip].join(' ').toLowerCase().includes(query));
  const allShown = list.length > 0 && list.every((c) => sel.has(c.id));
  const seat = seatNote?.(sel.size);
  return (
    <BomDrawer
      width={720} title={title} sub={sub} onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className={secBtnCls}>Cancel</button>
          <button className={priBtnCls} disabled={!!seat?.over} onClick={() => onApply([...sel])}>
            {applyLabel(sel.size)}
          </button>
        </>
      }
    >
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" size={14} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by CI ID, name, type or IP..." className={`${inputCls} w-full pl-8`} />
      </div>
      {seat && (
        <div className={`mb-3 rounded-lg border px-3.5 py-2.5 text-[12px] ${seat.over ? 'border-[#FECDCA] bg-[#FEF3F2] text-[#DC2626]' : 'border-[#E5E7EB] bg-[#F9FAFB] text-[#7B8FA5]'}`}>
          {seat.text}
        </div>
      )}
      <div className="mb-2 flex items-center gap-3 text-[12px] text-[#7B8FA5]">
        <b className="text-[#364658]">{sel.size}</b> of {pool.length} selected
        <span className="flex-1" />
        <button
          onClick={() => setSel((prev) => { const next = new Set(prev); list.forEach((c) => (allShown ? next.delete(c.id) : next.add(c.id))); return next; })}
          className="text-[#3D8BD0] hover:underline"
        >{allShown ? 'Deselect shown' : 'Select shown'}</button>
        {sel.size > 0 && <button onClick={() => setSel(new Set())} className="text-[#3D8BD0] hover:underline">Clear</button>}
      </div>
      <div className="overflow-hidden rounded-lg border border-[#E5E7EB]">
        {list.map((c) => {
          const on = sel.has(c.id);
          return (
            <label key={c.id} className={`flex cursor-pointer items-center gap-3 border-b border-[#F0F2F5] px-3.5 py-2.5 text-[13px] last:border-b-0 ${on ? 'bg-[#F0F7FD]' : 'hover:bg-[#F9FAFB]'}`}>
              <input type="checkbox" checked={on} className="size-4 accent-[#3D8BD0]"
                     onChange={() => setSel((prev) => { const next = new Set(prev); on ? next.delete(c.id) : next.add(c.id); return next; })} />
              <span className="w-16 font-mono text-[12px] text-[#3D8BD0]">{c.id}</span>
              <span className="min-w-0 flex-1 truncate text-[#364658]">{c.host}<span className="ml-2 text-[11px] text-[#9CA3AF]">{c.os}</span></span>
              <span className="text-[12px] text-[#7B8FA5]">{c.type}</span>
              <span className="w-28 text-right font-mono text-[11px] text-[#9CA3AF]">{c.ip}</span>
            </label>
          );
        })}
        {list.length === 0 && (
          <div className="px-4 py-8 text-center text-[13px] text-[#7B8FA5]">
            {pool.length === 0 ? 'Nothing available to pick.' : `No CI matches “${q}”. All ${pool.length} stay selectable — clear the filter to see them.`}
          </div>
        )}
      </div>
    </BomDrawer>
  );
}

/** Stacked condition editor — the auto-include power switch + shared builder + live matches,
 *  applied on commit; Cancel discards, exactly like the concept's stacked drawer. */
export function ConditionDrawer({ pool, poolLabel, initialGroups, initialAuto, onApply, onClose }: {
  pool: Ci[]; poolLabel: string; initialGroups: CondGroup[]; initialAuto: boolean;
  onApply: (groups: CondGroup[], auto: boolean) => void; onClose: () => void;
}) {
  const [groups, setGroups] = useState<CondGroup[]>(initialGroups.map((g) => ({ join: g.join, conds: g.conds.map((c) => ({ ...c })) })));
  const [auto, setAuto] = useState(initialAuto);
  const hit = auto ? matches(groups, pool) : [];
  return (
    <BomDrawer
      width={640} title="Auto-include conditions"
      sub="Conditions in a group must all match. A CI matching any group is included."
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className={secBtnCls}>Cancel</button>
          <button className={priBtnCls} onClick={() => onApply(groups, auto)}>Apply conditions</button>
        </>
      }
    >
      <div className={`mb-4 flex items-start gap-3 rounded-lg border px-3.5 py-3 ${auto ? 'border-[#BFDBF7] bg-[#F0F7FD]' : 'border-[#E5E7EB] bg-[#FBFCFD]'}`}>
        <div className="pt-0.5"><BomSwitch on={auto} label="Auto-include by condition" onClick={() => setAuto(!auto)} /></div>
        <div>
          <div className="text-[13px] font-medium text-[#364658]">Auto-include is {auto ? 'on' : 'off'}</div>
          <div className="mt-0.5 text-[12px] leading-[1.5] text-[#7B8FA5]">
            {auto
              ? 'CIs matching the conditions below join automatically — now, and as new CIs are enrolled.'
              : 'The conditions below are kept, but no CI is targeted by them. Turn on to apply.'}
          </div>
        </div>
      </div>
      <BomConditionBuilder groups={groups} onChange={setGroups} />
      <div className="mt-4 rounded-lg border border-[#E5E7EB] bg-white">
        <div className="border-b border-[#F0F2F5] bg-[#F0F7FD] px-3.5 py-2 text-[12px] text-[#364658]">
          {auto
            ? <>Matches <b>{hit.length}</b> of {pool.length} {poolLabel} right now</>
            : <>Auto-include is <b>off</b> — nothing is targeted by these conditions</>}
        </div>
        {hit.length > 0 ? (
          <div className="max-h-[180px] overflow-y-auto">
            {hit.map((c) => (
              <div key={c.id} className="flex items-center gap-3 border-b border-[#F0F2F5] px-3.5 py-2 text-[13px] last:border-b-0">
                <span className="w-16 font-mono text-[12px] text-[#3D8BD0]">{c.id}</span>
                <span className="min-w-0 flex-1 truncate text-[#364658]">{c.host}</span>
                <span className="text-[12px] text-[#7B8FA5]">{c.type}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-3.5 py-3 text-[12px] leading-[1.6] text-[#7B8FA5]">
            Nothing matches yet. An incomplete condition matches nothing — a half-written rule never targets everything by accident.
          </div>
        )}
      </div>
    </BomDrawer>
  );
}

/** The concept's two targeting tiles — hand-picked (fixed) beside condition-matched (dynamic).
 *  Scheduler policies and Retention exceptions share this exact surface. */
export function TargetTiles({ poolCount, manualCount, groupsCount, auto, autoCount, onPick, onCond }: {
  poolCount: number; manualCount: number; groupsCount: number; auto: boolean; autoCount: number;
  onPick: () => void; onCond: () => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className={`flex flex-col rounded-lg border p-3.5 ${manualCount ? 'border-[#3D8BD0]' : 'border-[#E5E7EB]'} bg-white`}>
        <div className="flex items-start gap-2.5">
          <span className="flex size-8 flex-shrink-0 items-center justify-center rounded bg-[#F1F5F9] text-[#7B8FA5]"><Users size={15} /></span>
          <span>
            <span className="text-[13px] font-semibold text-[#364658]">Add CIs by hand <span className="ml-1 rounded bg-[#F1F5F9] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#64748B]">Fixed</span></span>
            <span className="mt-0.5 block text-[12px] leading-[1.45] text-[#7B8FA5]">Pick specific enrolled CIs. The list stays fixed — new CIs are not added automatically.</span>
          </span>
        </div>
        <div className="mt-2.5 border-t border-[#F0F2F5] pt-2 text-[12px] text-[#7B8FA5]">
          <b className="mr-1 text-[15px] text-[#364658]" style={{ fontVariantNumeric: 'tabular-nums' }}>{manualCount}</b> of {poolCount} CIs
          <div className="mt-0.5">{!manualCount ? 'No CIs chosen yet' : manualCount === poolCount ? 'Every enrolled CI is selected' : 'Fixed list — new CIs are not added automatically'}</div>
        </div>
        <div className="mt-auto pt-2.5">
          <button onClick={onPick} className="inline-flex h-8 items-center rounded border border-[#d1d5db] bg-white px-3 text-[12px] font-medium text-[#364658] hover:bg-[#F9FAFB]">
            {manualCount ? 'Edit selection' : 'Choose CIs'}
          </button>
        </div>
      </div>
      <div className={`flex flex-col rounded-lg border p-3.5 ${auto && autoCount ? 'border-[#3D8BD0]' : 'border-[#E5E7EB]'} bg-white`}>
        <div className="flex items-start gap-2.5">
          <span className="flex size-8 flex-shrink-0 items-center justify-center rounded bg-[#EBF5FF] text-[#3D8BD0]"><ListFilter size={15} /></span>
          <span>
            <span className="text-[13px] font-semibold text-[#364658]">Auto-include by condition <span className="ml-1 rounded bg-[#EBF5FF] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#3D8BD0]">Dynamic</span></span>
            <span className="mt-0.5 block text-[12px] leading-[1.45] text-[#7B8FA5]">Every enrolled CI matching your conditions is targeted — and stays targeted as new CIs are enrolled.</span>
          </span>
        </div>
        <div className="mt-2.5 border-t border-[#F0F2F5] pt-2 text-[12px] text-[#7B8FA5]">
          <b className="mr-1 text-[15px] text-[#364658]" style={{ fontVariantNumeric: 'tabular-nums' }}>{autoCount}</b> of {poolCount} CIs
          <div className="mt-0.5">
            {!groupsCount ? 'No conditions built yet'
              : !auto ? `Turned off · ${groupsCount} group${groupsCount === 1 ? '' : 's'} kept`
              : `${groupsCount} condition group${groupsCount === 1 ? '' : 's'} · matching CIs join automatically`}
          </div>
        </div>
        <div className="mt-auto pt-2.5">
          <button onClick={onCond} className="inline-flex h-8 items-center rounded border border-[#d1d5db] bg-white px-3 text-[12px] font-medium text-[#364658] hover:bg-[#F9FAFB]">
            {groupsCount ? 'Edit conditions' : 'Build conditions'}
          </button>
        </div>
      </div>
    </div>
  );
}

export const selectCls =
  'h-9 rounded border border-[#d1d5db] bg-white px-2.5 text-[13px] text-[#364658] focus:border-[#3D8BD0] focus:outline-none focus:ring-1 focus:ring-[#3D8BD0]';
export const inputCls =
  'h-9 rounded border border-[#d1d5db] bg-white px-3 text-[13px] text-[#364658] placeholder:text-[#9ca3af] focus:border-[#3D8BD0] focus:outline-none focus:ring-1 focus:ring-[#3D8BD0]';
export const priBtnCls =
  'inline-flex h-9 items-center gap-1.5 rounded bg-[#3D8BD0] px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-[#3479b5] disabled:cursor-not-allowed disabled:opacity-50';
export const secBtnCls =
  'inline-flex h-9 items-center gap-1.5 rounded border border-[#d1d5db] bg-white px-3.5 text-[13px] font-medium text-[#364658] transition-colors hover:bg-[#F9FAFB]';
