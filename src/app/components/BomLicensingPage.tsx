import { useMemo, useReducer, useState } from 'react';
import { Plus, Search, X, ListChecks, Monitor } from 'lucide-react';
import { toast } from 'sonner';
import {
  ALL_CIS, AutoRule, BOM_SEATS, Ci, deleteRule, enrol, enrolledCis, groupsSummary, matches,
  newGroup, nextId, ruleFresh, saveRule, seatsLeft, store, todayLabel,
} from './bomAdminData';
import { BomConditionBuilder } from './BomConditionBuilder';
import {
  BomDrawer, BomPageHead, BomSwitch, CiPickerDrawer, FilterControl, FilterDef, Kpi, StatusPill,
  inputCls, priBtnCls, secBtnCls,
} from './BomAdminBits';

/* BOM Licensing — the allowlist that gates everything downstream. BOM is licensed per CI:
 * nothing is scanned, scheduled or retained until a CI is enrolled here, and every enrolled CI
 * consumes one seat. Two tabs, two ways in: Manual Enrolment (hand-picked, fixed) and
 * Auto-enrol (rule-swept, kept in sync). The CI tables are CI-first — the Auto tab says only
 * that a rule owns a seat; which rule is a policy question, and policy lives in the rules
 * drawer. */

const LIC_FILTERS: FilterDef[] = [
  { g: 'Status', id: 'active', lab: 'Active' },
  { g: 'Status', id: 'inact', lab: 'Inactive' },
  { g: 'Origin', id: 'agent', lab: 'Agent-scanned' },
  { g: 'Origin', id: 'manual', lab: 'Manually ingested' },
];
const FILTER_FN: Record<string, (c: Ci) => boolean> = {
  active: (c) => c.status === 'Active',
  inact: (c) => c.status !== 'Active',
  agent: (c) => c.origin === 'Agent',
  manual: (c) => c.origin === 'Manual',
};

export function BomLicensingPage({ onBack }: { onBack: () => void }) {
  const [, refresh] = useReducer((x: number) => x + 1, 0);
  const [tab, setTab] = useState<'manual' | 'auto'>('manual');
  const [query, setQuery] = useState('');
  const [filt, setFilt] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [confirmRm, setConfirmRm] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [viewRule, setViewRule] = useState<AutoRule | null>(null);   // read-only matching CIs
  const [ruleDraft, setRuleDraft] = useState<AutoRule | null>(null);
  const [confirmRule, setConfirmRule] = useState<string | null>(null);

  const enrolled = enrolledCis();
  const left = seatsLeft();
  const byAuto = enrolled.filter((c) => store.enrolled.get(c.id)?.by === 'Auto');
  const byHand = enrolled.filter((c) => store.enrolled.get(c.id)?.by === 'Manual');
  const inactive = enrolled.filter((c) => c.status !== 'Active').length;
  const liveRules = store.rules.filter((r) => r.on);
  const waiting = new Set(liveRules.flatMap((r) => ruleFresh(r).map((c) => c.id))).size;

  /* Filters within a group are alternatives (OR); across groups they narrow (AND). */
  const visible = (rows: Ci[]) => {
    const q = query.trim().toLowerCase();
    const groups = [...new Set(LIC_FILTERS.filter((f) => filt.has(f.id)).map((f) => f.g))];
    return rows.filter((c) => {
      if (q && ![c.id, c.host, c.type, c.os, c.ip].join(' ').toLowerCase().includes(q)) return false;
      return groups.every((g) =>
        LIC_FILTERS.some((f) => f.g === g && filt.has(f.id) && FILTER_FN[f.id](c)));
    });
  };

  const tabRows = tab === 'manual' ? byHand : byAuto;
  const list = visible(tabRows);

  const switchTab = (t: 'manual' | 'auto') => { setTab(t); setSel(new Set()); setConfirmRm(null); };

  const removeCi = (id: string) => {
    store.enrolled.delete(id);
    setConfirmRm(null);
    setSel((prev) => { const next = new Set(prev); next.delete(id); return next; });
    refresh();
    toast(`${id} removed — seat freed`);
  };

  const openRule = (r: AutoRule | null) =>
    setRuleDraft(r
      ? { ...r, groups: r.groups.map((g) => ({ join: g.join, conds: g.conds.map((c) => ({ ...c })) })) }
      // The builder is part of the drawer — no "build conditions" step to click through.
      : { id: nextId('AR', store.rules), name: '', on: true, groups: [newGroup()], updated: todayLabel() });

  return (
    <div className="mx-auto max-w-[1400px] px-8 py-6">
      <BomPageHead
        title="BOM Licensing"
        sub="Enrol CIs to generate SBOM, CBOM and AI BOM. Each enrolled CI — whether agent-scanned or manually ingested — consumes one license seat."
        onBack={onBack}
      />

      {/* Seat KPIs. "By rule / by hand" are live drivers — clicking one opens that tab. */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Seats purchased" value={BOM_SEATS} sub="licensed for BOM generation" />
        <Kpi
          label="Seats available" value={left}
          tone={waiting > left ? 'danger' : left <= 3 ? 'warn' : undefined}
          sub={waiting > left
            ? `rules match ${waiting} unenrolled CIs — only ${Math.max(0, left)} seat${left === 1 ? '' : 's'} remain`
            : waiting ? `${waiting} CI${waiting === 1 ? '' : 's'} waiting to enrol` : undefined}
        />
        <Kpi
          label="Enrolled & reporting" value={enrolled.length - inactive}
          tone={inactive ? 'warn' : undefined}
          sub={inactive ? `${inactive} inactive — still holding a seat` : 'all enrolled CIs are reporting'}
        />
        <div className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-3">
          <div className="text-[12px] text-[#7B8FA5]">Source mix</div>
          <div className="mt-1 flex items-baseline gap-2 text-[13px]">
            <button onClick={() => switchTab('auto')} title="Swept in by an auto-enrol rule, and kept in sync."
                    className="text-[#3D8BD0] hover:underline">
              <b className="text-[16px]" style={{ fontVariantNumeric: 'tabular-nums' }}>{byAuto.length}</b> by rule
            </button>
            <span className="text-[#D5DBE3]">•</span>
            <button onClick={() => switchTab('manual')} title="Chosen by an admin. Never changes on its own."
                    className="text-[#3D8BD0] hover:underline">
              <b className="text-[16px]" style={{ fontVariantNumeric: 'tabular-nums' }}>{byHand.length}</b> by hand
            </button>
          </div>
          <div className="mt-1.5 text-[12px] text-[#9CA3AF]">
            {!store.rules.length ? 'No auto-enrol rules — every seat was allocated by hand'
              : !liveRules.length ? `${store.rules.length} rule${store.rules.length === 1 ? '' : 's'}, all disabled`
              : `${liveRules.length} of ${store.rules.length} rule${store.rules.length === 1 ? '' : 's'} enabled`}
          </div>
        </div>
      </div>

      {/* Tabs + toolbar */}
      <div className="mt-5 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#E5E7EB] px-4 pt-1">
          {([['manual', 'Manual Enrolment', byHand.length], ['auto', 'Auto-enrol', byAuto.length]] as const).map(([id, lab, n]) => (
            <button
              key={id} role="tab" aria-selected={tab === id}
              onClick={() => switchTab(id)}
              className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-2 py-2.5 text-[13px] font-medium transition-colors ${tab === id ? 'border-[#3D8BD0] text-[#3D8BD0]' : 'border-transparent text-[#7B8FA5] hover:text-[#364658]'}`}
            >
              {id === 'manual' ? <Monitor size={14} /> : <ListChecks size={14} />}{lab}
              <span className={`inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1 text-[11px] font-semibold ${tab === id ? 'bg-[#EBF5FF] text-[#3D8BD0]' : 'bg-[#F1F5F9] text-[#64748B]'}`}>{n}</span>
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2 py-1.5">
            <div className="relative w-[220px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9ca3af]" size={13} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search CIs..." className={`${inputCls} h-8 w-full pl-7`} />
              {query && <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#364658]"><X size={13} /></button>}
            </div>
            <FilterControl defs={LIC_FILTERS} active={filt} onChange={setFilt} />
            {tab === 'manual' ? (
              <button onClick={() => setPicker(true)} className={`${priBtnCls} h-8`}><Plus size={14} /> Add manually</button>
            ) : (
              <>
                <button onClick={() => setRulesOpen(true)} className={`${secBtnCls} h-8`}>
                  View Rules <span className="rounded-full bg-[#F1F5F9] px-1.5 text-[11px] font-semibold text-[#64748B]">{store.rules.length}</span>
                </button>
                <button onClick={() => openRule(null)} className={`${priBtnCls} h-8`}><Plus size={14} /> New Rule</button>
              </>
            )}
          </div>
        </div>

        {/* Auto tab summary strip */}
        {tab === 'auto' && (
          <div className="grid grid-cols-3 gap-px border-b border-[#E5E7EB] bg-[#E5E7EB]">
            <div className="bg-[#FBFCFD] px-4 py-2.5">
              <div className="text-[11px] text-[#7B8FA5]">Auto-enrolled CIs</div>
              <div className="text-[15px] font-semibold text-[#364658]" style={{ fontVariantNumeric: 'tabular-nums' }}>{byAuto.length}<span className="ml-1 text-[11px] font-normal text-[#9CA3AF]">of {enrolled.length} enrolled</span></div>
            </div>
            <div className="bg-[#FBFCFD] px-4 py-2.5">
              <div className="text-[11px] text-[#7B8FA5]">Rules</div>
              <div className="text-[15px] font-semibold text-[#364658]" style={{ fontVariantNumeric: 'tabular-nums' }}>{store.rules.length}<span className="ml-1 text-[11px] font-normal text-[#9CA3AF]">{liveRules.length} active · {store.rules.length - liveRules.length} disabled</span></div>
            </div>
            <div className="bg-[#FBFCFD] px-4 py-2.5">
              <div className="text-[11px] text-[#7B8FA5]">Waiting to enrol</div>
              <div className={`text-[15px] font-semibold ${waiting > left ? 'text-[#DC2626]' : 'text-[#364658]'}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {waiting}
                {waiting > 0 && <span className="ml-1 text-[11px] font-normal text-[#9CA3AF]">{waiting > left ? `only ${Math.max(0, left)} seat${left === 1 ? '' : 's'} left` : 'matched, not yet enrolled'}</span>}
              </div>
            </div>
          </div>
        )}

        {/* Bulk bar */}
        {sel.size > 0 && (
          <div className="flex items-center gap-3 border-b border-[#E5E7EB] bg-[#F0F7FD] px-4 py-2 text-[13px] text-[#364658]">
            <b>{sel.size}</b> selected
            <span className="flex-1" />
            <button onClick={() => setSel(new Set())} className="text-[12px] text-[#3D8BD0] hover:underline">Clear selection</button>
            <button
              onClick={() => {
                sel.forEach((id) => store.enrolled.delete(id));
                toast(`${sel.size} CI${sel.size === 1 ? '' : 's'} removed — seats freed`);
                setSel(new Set()); refresh();
              }}
              className="inline-flex h-7 items-center rounded bg-[#DC2626] px-2.5 text-[12px] font-medium text-white hover:bg-[#b91c1c]"
            >Remove {sel.size} CI{sel.size === 1 ? '' : 's'}</button>
          </div>
        )}

        {/* CI table / empty states */}
        {tabRows.length === 0 ? (
          tab === 'manual' ? (
            <Empty t="No CIs enrolled by hand." d={`Pick specific CIs to enrol — you have ${Math.max(0, left)} seat${left === 1 ? '' : 's'} available.`}
                   cta="Add manually" onCta={() => setPicker(true)} />
          ) : !store.rules.length ? (
            <Empty t="No auto-enrol rules yet." d="Every seat is allocated by hand. Create a rule to enrol matching CIs automatically and keep enrolling them as new CIs are discovered."
                   cta="New Rule" onCta={() => openRule(null)} />
          ) : (
            <Empty t="No CI has been enrolled automatically."
                   d={liveRules.length ? 'Your rules are active but nothing they match is unenrolled yet.' : `All ${store.rules.length} rules are disabled, so nothing is being enrolled.`}
                   cta="View Rules" onCta={() => setRulesOpen(true)} />
          )
        ) : list.length === 0 ? (
          <Empty t="No CI matches these filters." d={`That is a filter result, not an all-clear — ${tabRows.length} CI${tabRows.length === 1 ? '' : 's'} in this tab.`}
                 cta="Clear filters" onCta={() => { setFilt(new Set()); setQuery(''); }} secondary />
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#F0F2F5] text-[12px] font-semibold text-[#364658]">
                <th className="w-[38px] px-4 py-2.5">
                  <input type="checkbox" aria-label="Select all shown" className="size-3.5 accent-[#3D8BD0]"
                         checked={list.length > 0 && list.every((c) => sel.has(c.id))}
                         onChange={() => setSel((prev) => {
                           const all = list.every((c) => prev.has(c.id));
                           const next = new Set(prev);
                           list.forEach((c) => (all ? next.delete(c.id) : next.add(c.id)));
                           return next;
                         })} />
                </th>
                <th className="py-2.5 pr-3">CI ID</th><th className="px-3 py-2.5">Host Name</th>
                <th className="px-3 py-2.5">CI Type</th><th className="px-3 py-2.5">IP Address</th>
                <th className="px-3 py-2.5">Origin</th><th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Last seen</th><th className="w-[110px] px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {list.map((c) => {
                const info = store.enrolled.get(c.id)!;
                const on = sel.has(c.id);
                return (
                  <tr key={c.id} className={`border-b border-[#F0F2F5] text-[13px] text-[#364658] last:border-b-0 ${on ? 'bg-[#F0F7FD]' : 'hover:bg-[#F9FAFB]'} ${c.status === 'Active' ? '' : 'opacity-70'}`}>
                    <td className="px-4 py-2.5">
                      <input type="checkbox" checked={on} aria-label={`Select ${c.id}`} className="size-3.5 accent-[#3D8BD0]"
                             onChange={() => setSel((prev) => { const next = new Set(prev); on ? next.delete(c.id) : next.add(c.id); return next; })} />
                    </td>
                    <td className="py-2.5 pr-3"><span className="font-mono text-[12px] text-[#3D8BD0]">{c.id}</span></td>
                    <td className="px-3 py-2.5">{c.host}<div className="text-[11px] text-[#9CA3AF]">{c.os}</div></td>
                    <td className="px-3 py-2.5"><span className="rounded-full border border-[#E5E7EB] px-2 py-0.5 text-[11px] text-[#64748B]">{c.type}</span></td>
                    <td className="px-3 py-2.5 font-mono text-[12px] text-[#7B8FA5]">{c.ip}</td>
                    <td className="px-3 py-2.5">
                      {info.by === 'Auto'
                        ? <span className="rounded-full bg-[#E6F7F4] px-2 py-0.5 text-[11px] font-medium text-[#0D9488]">Auto-enrolled</span>
                        : <span className="text-[12px] text-[#7B8FA5]">{c.origin === 'Agent' ? 'Agent' : 'Manual ingest'}</span>}
                    </td>
                    <td className="px-3 py-2.5"><StatusPill on={c.status === 'Active'} onLabel="Active" offLabel="Inactive" /></td>
                    <td className="px-3 py-2.5 text-[12px] text-[#7B8FA5]">{c.seen}</td>
                    <td className="relative px-3 py-2.5 text-right">
                      <button onClick={() => setConfirmRm(confirmRm === c.id ? null : c.id)}
                              className="rounded px-2 py-1 text-[12px] text-[#7B8FA5] transition-colors hover:bg-[#FEF3F2] hover:text-[#DC2626]">Remove</button>
                      {confirmRm === c.id && (
                        <div className="absolute right-2 top-9 z-[70] w-[300px] rounded-lg border border-[#E5E7EB] bg-white p-3 text-left shadow-[0_8px_24px_-8px_rgba(16,24,40,0.25)]">
                          <p className="text-[13px] font-medium text-[#364658]">Remove {c.id} from licensing?</p>
                          <p className="mt-1 text-[12px] leading-[1.5] text-[#7B8FA5]">
                            Its seat is freed and it stops being scanned, scheduled and retained. BOMs already generated are kept.
                            {info.by === 'Auto' && ' A rule still matches it, so it may be enrolled again.'}
                          </p>
                          <div className="mt-2.5 flex justify-end gap-2">
                            <button onClick={() => setConfirmRm(null)} className="rounded border border-[#d1d5db] px-2.5 py-1 text-[12px] text-[#364658] hover:bg-[#F9FAFB]">Cancel</button>
                            <button onClick={() => removeCi(c.id)} className="rounded bg-[#DC2626] px-2.5 py-1 text-[12px] font-medium text-white hover:bg-[#b91c1c]">Remove CI</button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add manually — unenrolled pool, seat-gated. */}
      {picker && (
        <CiPickerDrawer
          title="Enrol CIs" sub={`${ALL_CIS.length - enrolled.length} discovered CIs are not enrolled — each enrolment consumes one seat`}
          pool={ALL_CIS.filter((c) => !store.enrolled.has(c.id))}
          initial={[]}
          applyLabel={(n) => `Enrol ${n} CI${n === 1 ? '' : 's'}`}
          seatNote={(n) => {
            const rem = seatsLeft() - n;
            return rem < 0
              ? { over: true, text: <><b>Over limit by {Math.abs(rem)}.</b> Deselect {Math.abs(rem)} CI{Math.abs(rem) === 1 ? '' : 's'} or free up seats before enrolling.</> }
              : { over: false, text: <><b className="text-[#364658]">{rem}</b> seat{rem === 1 ? '' : 's'} would remain after enrolling {n} CI{n === 1 ? '' : 's'}.</> };
          }}
          onApply={(ids) => {
            const n = enrol(ids, { by: 'Manual' });
            toast.success(`${n} CI${n === 1 ? '' : 's'} enrolled — ${seatsLeft()} seat${seatsLeft() === 1 ? '' : 's'} left`);
            setPicker(false); refresh();
          }}
          onClose={() => setPicker(false)}
        />
      )}

      {/* Rules management drawer — the policies; the CI list is their result. */}
      {rulesOpen && (
        <BomDrawer
          width={760} title="Auto-enrol rules"
          sub={`${store.rules.length} rule${store.rules.length === 1 ? '' : 's'} · ${liveRules.length} active · these decide which CIs are enrolled automatically`}
          onClose={() => { setRulesOpen(false); setConfirmRule(null); }}
          footer={
            <>
              <span className="mr-auto text-[12px] text-[#7B8FA5]">Rules decide enrolment; the CI list is the result.</span>
              <button onClick={() => { setRulesOpen(false); setConfirmRule(null); }} className={secBtnCls}>Close</button>
              <button onClick={() => openRule(null)} className={priBtnCls}><Plus size={15} /> New Rule</button>
            </>
          }
        >
          {store.rules.length === 0 && (
            <div className="py-14 text-center">
              <p className="text-[14px] font-medium text-[#364658]">No rules yet.</p>
              <p className="mt-1 text-[13px] text-[#7B8FA5]">Create one to enrol matching CIs automatically.</p>
            </div>
          )}
          {store.rules.map((r) => {
            const hit = matches(r.groups);
            const fresh = ruleFresh(r);
            const owned = enrolled.filter((c) => store.enrolled.get(c.id)?.ruleId === r.id).length;
            const over = r.on && fresh.length > left;
            return (
              <div key={r.id} className={`mb-2.5 rounded-lg border border-[#E5E7EB] p-3.5 ${r.on ? '' : 'opacity-75'}`}>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-[#364658]">{r.name}</span>
                  <StatusPill on={r.on} />
                  <span className="ml-auto flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        r.on = !r.on; r.updated = todayLabel();
                        if (r.on) {
                          const n = enrol(fresh.map((c) => c.id), { by: 'Auto', ruleId: r.id });
                          toast.success(`"${r.name}" enabled — ${n} CI${n === 1 ? '' : 's'} enrolled`);
                        } else toast(`"${r.name}" disabled — enrolled CIs keep their seats`);
                        refresh();
                      }}
                      className="rounded px-2 py-1 text-[12px] font-medium text-[#7B8FA5] hover:bg-[#F3F4F6] hover:text-[#364658]"
                    >{r.on ? 'Disable' : 'Enable'}</button>
                    <button onClick={() => openRule(r)} className="rounded px-2 py-1 text-[12px] font-medium text-[#3D8BD0] hover:bg-[#EBF5FF]">Edit</button>
                    <button onClick={() => setConfirmRule(confirmRule === r.id ? null : r.id)}
                            className="rounded px-2 py-1 text-[12px] text-[#7B8FA5] hover:bg-[#FEF3F2] hover:text-[#DC2626]">Delete</button>
                  </span>
                </div>
                <div className="mt-1 truncate text-[12px] text-[#7B8FA5]" title={groupsSummary(r.groups)}>
                  {groupsSummary(r.groups) || 'No conditions yet'}
                </div>
                <div className="mt-1.5 flex items-center gap-3 text-[12px] text-[#9CA3AF]">
                  <button onClick={() => setViewRule(r)} className="font-medium text-[#3D8BD0] hover:underline">
                    {hit.length} Matching CI{hit.length === 1 ? '' : 's'}
                  </button>
                  <span>{r.id} · updated {r.updated}</span>
                  {over && <span className="text-[#DC2626]">{fresh.length} unenrolled · only {Math.max(0, left)} seat{left === 1 ? '' : 's'} left</span>}
                </div>
                {confirmRule === r.id && (
                  <div className="mt-2.5 rounded-lg border border-[#FECDCA] bg-[#FEF3F2] p-3">
                    <p className="text-[13px] font-medium text-[#364658]">Delete {r.name}?</p>
                    <p className="mt-0.5 text-[12px] leading-[1.5] text-[#7B8FA5]">
                      The {owned} CI{owned === 1 ? '' : 's'} it enrolled stay enrolled and keep their seats — they simply stop being managed by a rule.
                    </p>
                    <div className="mt-2 flex justify-end gap-2">
                      <button onClick={() => setConfirmRule(null)} className="rounded border border-[#d1d5db] bg-white px-2.5 py-1 text-[12px] text-[#364658] hover:bg-[#F9FAFB]">Cancel</button>
                      <button
                        onClick={() => { deleteRule(r.id); setConfirmRule(null); refresh(); toast(`Deleted "${r.name}" — the CIs it enrolled keep their seats`); }}
                        className="rounded bg-[#DC2626] px-2.5 py-1 text-[12px] font-medium text-white hover:bg-[#b91c1c]"
                      >Delete rule</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </BomDrawer>
      )}

      {/* Read-only matching CIs — the result of a policy, never the place to edit it. */}
      {viewRule && (
        <BomDrawer
          width={640} title="Matching CIs"
          sub={`${viewRule.name} · ${matches(viewRule.groups).length} of ${ALL_CIS.length} discovered CIs · read-only`}
          onClose={() => setViewRule(null)}
          footer={
            <>
              <span className="mr-auto text-[12px] text-[#7B8FA5]">Change this list by editing the rule, not the CIs.</span>
              <button onClick={() => setViewRule(null)} className={secBtnCls}>Close</button>
            </>
          }
        >
          <div className="overflow-hidden rounded-lg border border-[#E5E7EB]">
            {matches(viewRule.groups).map((c) => (
              <div key={c.id} className="flex items-center gap-3 border-b border-[#F0F2F5] px-3.5 py-2.5 text-[13px] last:border-b-0">
                <span className="w-16 font-mono text-[12px] text-[#3D8BD0]">{c.id}</span>
                <span className="min-w-0 flex-1 truncate text-[#364658]">{c.host}<div className="font-mono text-[11px] text-[#9CA3AF]">{c.ip}</div></span>
                <span className="rounded-full border border-[#E5E7EB] px-2 py-0.5 text-[11px] text-[#64748B]">{c.type}</span>
                {store.enrolled.has(c.id)
                  ? <StatusPill on onLabel="Enrolled" />
                  : <span className="rounded-full border border-[#E5E7EB] px-2 py-0.5 text-[11px] text-[#64748B]">Not yet</span>}
              </div>
            ))}
            {matches(viewRule.groups).length === 0 && (
              <div className="px-4 py-8 text-center text-[13px] text-[#7B8FA5]">Nothing matches this rule right now.</div>
            )}
          </div>
        </BomDrawer>
      )}

      {ruleDraft && (
        <RuleDrawer
          draft={ruleDraft} onChange={setRuleDraft} onClose={() => setRuleDraft(null)}
          onSave={() => {
            const fresh = ruleDraft.on ? ruleFresh(ruleDraft).length : 0;
            saveRule(ruleDraft);
            setRuleDraft(null); refresh();
            toast.success(ruleDraft.on
              ? `"${ruleDraft.name}" saved — ${fresh} CI${fresh === 1 ? '' : 's'} enrolled, ${seatsLeft()} seat${seatsLeft() === 1 ? '' : 's'} left`
              : `"${ruleDraft.name}" saved — disabled, nothing enrolled`);
          }}
        />
      )}
    </div>
  );
}

function Empty({ t, d, cta, onCta, secondary }: { t: string; d: string; cta: string; onCta: () => void; secondary?: boolean }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <p className="text-[14px] font-medium text-[#364658]">{t}</p>
      <p className="mt-1 max-w-[520px] text-[13px] leading-[1.55] text-[#7B8FA5]">{d}</p>
      <button onClick={onCta} className={`mt-4 ${secondary ? secBtnCls : priBtnCls}`}>{cta}</button>
    </div>
  );
}

/* The Auto-enrol Rule drawer — one straight read: name → enabled → the condition builder
 * itself → a compact live preview with the seat math. Unchanged from the simplified spec. */
function RuleDrawer({ draft, onChange, onClose, onSave }: {
  draft: AutoRule; onChange: (r: AutoRule) => void; onClose: () => void; onSave: () => void;
}) {
  const [err, setErr] = useState(false);
  const hit = useMemo(() => matches(draft.groups), [draft.groups]);
  const fresh = hit.filter((c) => !store.enrolled.has(c.id));
  const would = draft.on ? fresh.length : 0;
  const left = seatsLeft();
  const after = left - would;
  const over = would - left;
  const editing = store.rules.some((r) => r.id === draft.id);

  return (
    <BomDrawer
      width={640}
      title={editing ? 'Edit auto-enrol rule' : 'New auto-enrol rule'}
      sub="Enrol matching CIs automatically, and keep enrolling them as new CIs are discovered."
      onClose={onClose}
      footer={
        <>
          <span className="mr-auto text-[12px] text-[#7B8FA5]">
            {draft.on ? `${fresh.length} CI${fresh.length === 1 ? '' : 's'} would be enrolled on save` : 'Rule is disabled — nothing changes'}
          </span>
          <button onClick={onClose} className={secBtnCls}>Cancel</button>
          <button className={priBtnCls} disabled={over > 0}
                  onClick={() => { if (!draft.name.trim()) { setErr(true); return; } onSave(); }}>
            {editing ? 'Save changes' : 'Create rule'}
          </button>
        </>
      }
    >
      <label className="mb-1 block text-[12px] font-medium text-[#364658]">Rule name <span className="text-[#DC2626]">*</span></label>
      <input
        autoFocus type="text" value={draft.name} placeholder="e.g. All laptops"
        onChange={(e) => { onChange({ ...draft, name: e.target.value }); if (e.target.value.trim()) setErr(false); }}
        className={`${inputCls} w-full ${err && !draft.name.trim() ? 'border-[#DC2626] ring-1 ring-[#DC2626]' : ''}`}
      />
      {err && !draft.name.trim() && <p className="mt-1 text-[12px] text-[#DC2626]">Give the rule a name so it can be recognised later.</p>}

      <div className={`mt-4 flex items-start gap-3 rounded-lg border px-3.5 py-3 ${draft.on ? 'border-[#BFDBF7] bg-[#F0F7FD]' : 'border-[#E5E7EB] bg-[#FBFCFD]'}`}>
        <div className="pt-0.5"><BomSwitch on={draft.on} label="Rule status" onClick={() => onChange({ ...draft, on: !draft.on })} /></div>
        <div>
          <div className="text-[13px] font-medium text-[#364658]">Rule is {draft.on ? 'enabled' : 'disabled'}</div>
          <div className="mt-0.5 text-[12px] leading-[1.5] text-[#7B8FA5]">
            {draft.on ? 'Every discovered CI matching the conditions below is enrolled and consumes a seat.' : 'Conditions are kept, but nothing is enrolled by this rule.'}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1.5 text-[12px] font-medium text-[#364658]">
          Conditions <span className="font-normal text-[#9CA3AF]">· all must match within a group · any group matching is enough</span>
        </div>
        <BomConditionBuilder groups={draft.groups} onChange={(groups) => onChange({ ...draft, groups })} />
      </div>

      <div className="mt-4 rounded-lg border border-[#E5E7EB] bg-white">
        <div className="border-b border-[#F0F2F5] bg-[#F0F7FD] px-3.5 py-2 text-[12px] text-[#364658]">
          {hit.length
            ? <>Rule preview — <b>{hit.length}</b> of {ALL_CIS.length} discovered CI{hit.length === 1 ? '' : 's'} match</>
            : <>Rule preview</>}
        </div>
        {hit.length ? (
          <div className="text-[13px]">
            <div className="flex items-center justify-between border-b border-[#F0F2F5] px-3.5 py-2 text-[#7B8FA5]"><span>Will be newly enrolled</span><b className="text-[#364658]">{would}</b></div>
            <div className="flex items-center justify-between border-b border-[#F0F2F5] px-3.5 py-2 text-[#7B8FA5]"><span>Already enrolled</span><b className="text-[#364658]">{hit.length - fresh.length}</b></div>
            <div className="flex items-center justify-between bg-[#F9FAFB] px-3.5 py-2 font-medium text-[#364658]">
              <span>Seats available after save</span>
              <b className={over > 0 ? 'text-[#DC2626]' : after <= 2 ? 'text-[#D97706]' : ''}>{after}</b>
            </div>
            {over > 0 && (
              <div className="border-t border-[#F0F2F5] bg-[#FEF3F2] px-3.5 py-2.5 text-[12px] leading-[1.55] text-[#DC2626]">
                <b>Over limit by {over} seat{over === 1 ? '' : 's'}.</b> Narrow the conditions, free seats by removing CIs, or buy more before saving.
              </div>
            )}
          </div>
        ) : (
          <div className="px-3.5 py-3 text-[12px] leading-[1.6] text-[#7B8FA5]">
            No CIs currently match this rule.<br />
            {draft.on ? 'Future matching CIs will be enrolled automatically as they are discovered.' : 'Rule is disabled — conditions are kept, nothing is enrolled.'}
          </div>
        )}
      </div>
    </BomDrawer>
  );
}
