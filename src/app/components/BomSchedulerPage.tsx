import { useReducer, useState } from 'react';
import { Plus, Search, X, Play, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import {
  SchedulePolicy, condDone, enrolledCis, matches, newGroup, nextId, policyTargets, store,
} from './bomAdminData';
import {
  BomDrawer, BomPageHead, BomSwitch, CiPickerDrawer, ConditionDrawer, FilterControl, FilterDef,
  StatusPill, SumStrip, TargetTiles, inputCls, priBtnCls, secBtnCls, selectCls,
} from './BomAdminBits';

/* BOM Scheduler — when enrolled CIs are scanned. A policy picks its CIs the same two ways the
 * rest of the module does (by hand = fixed, by condition = grows with the estate), and its
 * cadence is Recurring (daily / weekly / monthly) or One Time. The master switch above the
 * list gates everything: no policy runs while it is off, whatever its own status. */

const BS_DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TIMES = ['00:00', '02:00', '04:00', '06:00', '12:00', '18:00', '22:00'];

const BS_FILTERS: FilterDef[] = [
  { g: 'Status', id: 'on', lab: 'Active' },
  { g: 'Status', id: 'off', lab: 'Disabled' },
  { g: 'Trigger', id: 'Daily', lab: 'Daily' },
  { g: 'Trigger', id: 'Weekly', lab: 'Weekly' },
  { g: 'Trigger', id: 'Monthly', lab: 'Monthly' },
  { g: 'Trigger', id: 'once', lab: 'One time' },
];

/** Next execution, or null when it cannot run (policy or master switch off, one-time past). */
const bsNext = (p: SchedulePolicy, enabled: boolean): Date | null => {
  if (!enabled || !p.on) return null;
  const now = new Date();
  const [hh, mm] = p.time.split(':').map(Number);
  if (p.kind === 'One Time') {
    if (!p.startAt) return null;
    const d = new Date(`${p.startAt}T${p.time}`);
    return d > now ? d : null;                       // already run ⇒ nothing next
  }
  const d = new Date(now); d.setHours(hh, mm, 0, 0);
  if (p.freq === 'Daily') { if (d <= now) d.setDate(d.getDate() + 1); return d; }
  if (p.freq === 'Weekly') {
    const days = p.days.length ? p.days : ['Sun'];
    for (let i = 0; i < 8; i++) {
      const t = new Date(d); t.setDate(d.getDate() + i);
      if (days.includes(BS_DOW[(t.getDay() + 6) % 7]) && t > now) return t;
    }
    return null;
  }
  const t = new Date(d); t.setDate(p.monthDay);       // Monthly
  if (t <= now) t.setMonth(t.getMonth() + 1);
  return t;
};

const bsWhen = (d: Date): string => {
  const a = new Date(); a.setHours(0, 0, 0, 0);
  const b = new Date(d); b.setHours(0, 0, 0, 0);
  const days = Math.round((b.getTime() - a.getTime()) / 864e5);
  return days === 0 ? 'Today' : days === 1 ? 'Tomorrow'
    : d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
};

const bsTrigger = (p: SchedulePolicy): string => {
  if (p.kind === 'One Time') return 'One time';
  if (p.freq === 'Weekly') return `Weekly · ${(p.days.length ? p.days : ['Sun']).join(', ')}`;
  if (p.freq === 'Monthly') return `Monthly · day ${p.monthDay}`;
  return 'Daily';
};

/** The policy in words — used as the auto-name when none is typed. */
const bsEcho = (p: SchedulePolicy): string => {
  const n = policyTargets(p).length;
  const t = p.kind === 'One Time' ? `once on ${p.startAt ?? '…'}` : bsTrigger(p).toLowerCase();
  return `Scan ${n} CI${n === 1 ? '' : 's'} ${t} at ${p.time}`;
};

export function BomSchedulerPage({ onBack }: { onBack: () => void }) {
  const [, refresh] = useReducer((x: number) => x + 1, 0);
  const [enabled, setEnabled] = useState(true);
  const [query, setQuery] = useState('');
  const [filt, setFilt] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [coverage, setCoverage] = useState<SchedulePolicy | null>(null);
  const [draft, setDraft] = useState<SchedulePolicy | null>(null);

  const enrolled = enrolledCis();
  const active = store.schedules.filter((p) => p.on);
  const covered = new Set(active.flatMap((p) => policyTargets(p).map((c) => c.id)));
  const nexts = active.map((p) => bsNext(p, enabled)).filter(Boolean).sort((a, b) => a!.getTime() - b!.getTime());
  const soonest = nexts[0] ?? null;

  /* Filters within a group are alternatives (OR); across groups they narrow (AND). */
  const q = query.trim().toLowerCase();
  const list = store.schedules.filter((p) => {
    if (q && ![p.name, p.id, p.freq, p.time].join(' ').toLowerCase().includes(q)) return false;
    const groups = [...new Set(BS_FILTERS.filter((f) => filt.has(f.id)).map((f) => f.g))];
    return groups.every((g) => BS_FILTERS.some((f) => {
      if (f.g !== g || !filt.has(f.id)) return false;
      if (f.id === 'on') return p.on;
      if (f.id === 'off') return !p.on;
      if (f.id === 'once') return p.kind === 'One Time';
      return p.kind === 'Recurring' && p.freq === f.id;
    }));
  });

  const openDraft = (p: SchedulePolicy | null) =>
    setDraft(p
      ? { ...p, days: [...p.days], manual: [...p.manual], groups: p.groups.map((g) => ({ join: g.join, conds: g.conds.map((c) => ({ ...c })) })) }
      : { id: nextId('BS', store.schedules), name: '', on: true, auto: false, kind: 'Recurring', freq: 'Daily', days: ['Mon'], monthDay: 1, startAt: null, time: '02:00', manual: [], groups: [] });

  return (
    <div className="mx-auto max-w-[1400px] px-8 py-6" onClick={() => { if (menu || confirm) { setMenu(null); setConfirm(null); } }}>
      <BomPageHead
        title="BOM Scheduler"
        sub="Choose when BOM scans should run and which CIs should be included — pick CIs manually or let conditions include them automatically. Only enrolled CIs can be scheduled."
        onBack={onBack}
        actions={<button onClick={() => openDraft(null)} className={priBtnCls}><Plus size={15} /> Create Schedule</button>}
      />

      <div className="mt-5">
        <SumStrip cells={[
          { label: 'Active', value: active.length, unit: `of ${store.schedules.length} policies`, quiet: !active.length },
          { label: 'Disabled', value: store.schedules.length - active.length, unit: store.schedules.length - active.length ? 'not running' : undefined, quiet: active.length === store.schedules.length },
          { label: 'Next run', value: soonest ? bsWhen(soonest) : enabled ? 'None scheduled' : 'Paused', unit: soonest ? soonest.toTimeString().slice(0, 5) : undefined, quiet: !soonest },
          { label: 'Coverage', value: covered.size, unit: `of ${enrolled.length} enrolled CIs`, quiet: !covered.size },
        ]} />
      </div>

      {/* Master switch — the banner every policy answers to. */}
      <div className={`mt-4 flex items-center gap-3 rounded-xl border px-4 py-3 ${enabled ? 'border-[#E5E7EB] bg-white' : 'border-[#FDE9C8] bg-[#FEF7E6]'}`}>
        <BomSwitch on={enabled} label="Automatic BOM generation" onClick={() => {
          setEnabled(!enabled);
          toast(enabled ? 'Automatic BOM generation disabled — no policy will run' : 'Automatic BOM generation enabled');
        }} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-[#364658]">
            Automatic BOM Generation <StatusPill on={enabled} onLabel="Enabled" offLabel="Disabled" />
          </div>
          <div className="mt-0.5 text-[12px] text-[#7B8FA5]">
            {enabled ? 'Policies below run at their set times for the CIs they cover.' : 'No policy will execute, whatever its own status, until this is turned back on.'}
          </div>
        </div>
        <div className="text-right text-[12px] text-[#7B8FA5]">Last scheduler execution<br /><b className="text-[#364658]">Today · 02:00 IST</b></div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
        <div className="flex items-center gap-2 border-b border-[#F0F2F5] px-4 py-3">
          <span className="text-[14px] font-semibold text-[#364658]">Schedule policies</span>
          <span className="text-[12px] text-[#7B8FA5]">{store.schedules.length}</span>
          <div className="relative ml-auto w-[220px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9ca3af]" size={13} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search policies..." className={`${inputCls} h-8 w-full pl-7`} />
            {query && <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#364658]"><X size={13} /></button>}
          </div>
          <FilterControl defs={BS_FILTERS} active={filt} onChange={setFilt} />
        </div>

        {store.schedules.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <p className="text-[14px] font-medium text-[#364658]">No schedules configured.</p>
            <p className="mt-1 max-w-[520px] text-[13px] leading-[1.55] text-[#7B8FA5]">Nothing is generated automatically. Create a policy to have the agent build BOMs for enrolled CIs on a cadence you choose.</p>
            <button onClick={() => openDraft(null)} className={`mt-4 ${priBtnCls}`}>Create Schedule</button>
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <p className="text-[14px] font-medium text-[#364658]">No policy matches these filters.</p>
            <p className="mt-1 text-[13px] text-[#7B8FA5]">That is a filter result, not an all-clear — {store.schedules.length} policies still exist.</p>
            <button onClick={() => { setFilt(new Set()); setQuery(''); }} className={`mt-4 ${secBtnCls}`}>Clear filters</button>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#F0F2F5] text-[12px] font-semibold text-[#364658]">
                <th className="w-[26%] px-4 py-2.5">Policy</th><th className="px-3 py-2.5">Coverage</th>
                <th className="px-3 py-2.5">Trigger</th><th className="px-3 py-2.5">Next Run</th>
                <th className="px-3 py-2.5">Status</th><th className="w-[210px] px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const targets = policyTargets(p);
                const n = bsNext(p, enabled);
                return (
                  <tr key={p.id} className={`border-b border-[#F0F2F5] text-[13px] text-[#364658] last:border-b-0 hover:bg-[#F9FAFB] ${p.on ? '' : 'opacity-70'}`}>
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{p.name || bsEcho(p)}</div>
                      <div className="font-mono text-[11px] text-[#9CA3AF]">{p.id}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => setCoverage(p)} className="font-medium text-[#3D8BD0] hover:underline">
                        {targets.length} Enrolled CI{targets.length === 1 ? '' : 's'}
                      </button>
                    </td>
                    <td className="px-3 py-2.5">{bsTrigger(p)}<div className="text-[11px] text-[#9CA3AF]">{p.time}</div></td>
                    <td className="px-3 py-2.5">
                      {n
                        ? <>{bsWhen(n)}<div className="text-[11px] text-[#9CA3AF]">{p.time}</div></>
                        : <span className="text-[#9CA3AF]">—<div className="text-[11px]">{enabled ? 'Paused' : 'Scheduling off'}</div></span>}
                    </td>
                    <td className="px-3 py-2.5"><StatusPill on={p.on} onLabel="Active" offLabel="Disabled" /></td>
                    <td className="relative px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => toast(`Running "${p.name || bsEcho(p)}" now — generating BOMs for ${targets.length} CI${targets.length === 1 ? '' : 's'}`)}
                          title="Generate BOMs for this policy now"
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-[12px] font-medium text-[#7B8FA5] hover:bg-[#F3F4F6] hover:text-[#364658]"
                        ><Play size={12} /> Run Now</button>
                        <button onClick={() => openDraft(p)} className="rounded px-2 py-1 text-[12px] font-medium text-[#3D8BD0] hover:bg-[#EBF5FF]">Edit</button>
                        <button onClick={() => { setMenu(menu === p.id ? null : p.id); setConfirm(null); }}
                                aria-label={`More actions for ${p.name}`}
                                className="flex size-7 items-center justify-center rounded text-[#7B8FA5] hover:bg-[#F3F4F6] hover:text-[#364658]"><MoreHorizontal size={15} /></button>
                      </div>
                      {menu === p.id && (
                        <div className="absolute right-3 top-10 z-[70] w-[180px] rounded-lg border border-[#E5E7EB] bg-white py-1 shadow-[0_8px_24px_-8px_rgba(16,24,40,0.25)]">
                          <button onClick={() => { p.on = !p.on; setMenu(null); refresh(); toast(`"${p.name || bsEcho(p)}" ${p.on ? 'enabled' : 'disabled'}`); }}
                                  className="block w-full px-3 py-1.5 text-left text-[13px] text-[#364658] hover:bg-[#F9FAFB]">{p.on ? 'Disable policy' : 'Enable policy'}</button>
                          <button
                            onClick={() => {
                              const i = store.schedules.indexOf(p);
                              store.schedules.splice(i + 1, 0, { ...p, id: nextId('BS', store.schedules), name: `${p.name || bsEcho(p)} (copy)`, on: false, days: [...p.days], manual: [...p.manual], groups: p.groups.map((g) => ({ join: g.join, conds: g.conds.map((c) => ({ ...c })) })) });
                              setMenu(null); refresh();
                              toast(`Duplicated "${p.name || bsEcho(p)}" — the copy starts disabled`);
                            }}
                            className="block w-full px-3 py-1.5 text-left text-[13px] text-[#364658] hover:bg-[#F9FAFB]"
                          >Duplicate policy</button>
                          <div className="my-1 border-t border-[#F0F2F5]" />
                          <button onClick={() => { setConfirm(p.id); setMenu(null); }}
                                  className="block w-full px-3 py-1.5 text-left text-[13px] text-[#DC2626] hover:bg-[#FEF3F2]">Delete policy</button>
                        </div>
                      )}
                      {confirm === p.id && (
                        <div className="absolute right-3 top-10 z-[70] w-[300px] rounded-lg border border-[#E5E7EB] bg-white p-3 text-left shadow-[0_8px_24px_-8px_rgba(16,24,40,0.25)]">
                          <p className="text-[13px] font-medium text-[#364658]">Delete {p.name || bsEcho(p)}?</p>
                          <p className="mt-1 text-[12px] leading-[1.5] text-[#7B8FA5]">
                            The {targets.length} CI{targets.length === 1 ? '' : 's'} it covers stop being scanned on this cadence. Existing BOMs are kept.
                          </p>
                          <div className="mt-2.5 flex justify-end gap-2">
                            <button onClick={() => setConfirm(null)} className="rounded border border-[#d1d5db] px-2.5 py-1 text-[12px] text-[#364658] hover:bg-[#F9FAFB]">Cancel</button>
                            <button
                              onClick={() => { store.schedules = store.schedules.filter((x) => x.id !== p.id); setConfirm(null); refresh(); toast(`Deleted "${p.name || bsEcho(p)}"`); }}
                              className="rounded bg-[#DC2626] px-2.5 py-1 text-[12px] font-medium text-white hover:bg-[#b91c1c]"
                            >Delete policy</button>
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

      {/* Read-only coverage drawer. */}
      {coverage && (
        <BomDrawer
          width={620} title="Covered CIs"
          sub={`${coverage.name || bsEcho(coverage)} · ${policyTargets(coverage).length} enrolled CI${policyTargets(coverage).length === 1 ? '' : 's'} · read-only`}
          onClose={() => setCoverage(null)}
          footer={<button onClick={() => setCoverage(null)} className={secBtnCls}>Close</button>}
        >
          <div className="overflow-hidden rounded-lg border border-[#E5E7EB]">
            {policyTargets(coverage).map((c) => (
              <div key={c.id} className="flex items-center gap-3 border-b border-[#F0F2F5] px-3.5 py-2.5 text-[13px] last:border-b-0">
                <span className="w-16 font-mono text-[12px] text-[#3D8BD0]">{c.id}</span>
                <span className="min-w-0 flex-1 truncate text-[#364658]">{c.host}</span>
                <span className="text-[12px] text-[#7B8FA5]">{c.type}</span>
                <span className="text-[11px] text-[#9CA3AF]">{coverage.manual.includes(c.id) ? 'by hand' : 'by condition'}</span>
              </div>
            ))}
            {policyTargets(coverage).length === 0 && <div className="px-4 py-8 text-center text-[13px] text-[#7B8FA5]">This policy covers nothing right now.</div>}
          </div>
        </BomDrawer>
      )}

      {draft && <PolicyDrawer draft={draft} onChange={setDraft} onClose={() => setDraft(null)} onSaved={() => { setDraft(null); refresh(); }} />}
    </div>
  );
}

function PolicyDrawer({ draft, onChange, onClose, onSaved }: {
  draft: SchedulePolicy; onChange: (p: SchedulePolicy) => void; onClose: () => void; onSaved: () => void;
}) {
  const [picking, setPicking] = useState(false);
  const [condOpen, setCondOpen] = useState(false);
  const enrolled = enrolledCis();
  const autoCount = draft.auto ? matches(draft.groups, enrolled).length : 0;
  const total = policyTargets(draft).length;
  const editing = store.schedules.some((x) => x.id === draft.id);
  const timingOk = draft.kind === 'One Time' ? !!draft.startAt : draft.freq !== 'Weekly' || draft.days.length > 0;

  return (
    <>
      <BomDrawer
        width={680} title="Schedule Scan"
        sub="Choose when BOM scans should run and which CIs should be included — pick CIs manually or let conditions include them automatically."
        onClose={onClose}
        footer={
          <>
            <span className="mr-auto text-[12px] text-[#7B8FA5]">Scans <b className="text-[#364658]">{total}</b> of {enrolled.length} enrolled CIs</span>
            <button onClick={onClose} className={secBtnCls}>Cancel</button>
            <button
              className={priBtnCls} disabled={!timingOk || total === 0}
              onClick={() => {
                const clean: SchedulePolicy = {
                  ...draft,
                  name: draft.name.trim() || bsEcho(draft),
                  groups: draft.groups.filter((g) => g.conds.some(condDone)).map((g) => ({ join: g.join, conds: g.conds.filter(condDone) })),
                };
                store.schedules = editing ? store.schedules.map((x) => (x.id === clean.id ? clean : x)) : [...store.schedules, clean];
                onSaved();
                toast.success(`"${clean.name}" saved — covers ${total} enrolled CI${total === 1 ? '' : 's'}`);
              }}
            >{editing ? 'Save changes' : 'Create Schedule'}</button>
          </>
        }
      >
        <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-[#7B8FA5]">Schedule setup</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-1.5 text-[12px] font-medium text-[#364658]">Schedule Type <span className="text-[#DC2626]">*</span></div>
            <select value={draft.kind} onChange={(e) => onChange({ ...draft, kind: e.target.value as SchedulePolicy['kind'] })} className={`${selectCls} w-full`}>
              {(['Recurring', 'One Time'] as const).map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          {draft.kind === 'Recurring' && (
            <div>
              <div className="mb-1.5 text-[12px] font-medium text-[#364658]">Frequency <span className="text-[#DC2626]">*</span></div>
              <select value={draft.freq} onChange={(e) => onChange({ ...draft, freq: e.target.value as SchedulePolicy['freq'] })} className={`${selectCls} w-full`}>
                {(['Daily', 'Weekly', 'Monthly'] as const).map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          )}
        </div>
        <p className="mt-1.5 text-[12px] text-[#9CA3AF]">
          {draft.kind === 'One Time' ? 'Run the scan once at the selected date and time.'
            : draft.freq === 'Daily' ? 'Run every day at the selected time.'
            : draft.freq === 'Weekly' ? 'Run every week on the selected days.'
            : 'Run once a month on a fixed date.'}
        </p>

        {draft.kind === 'One Time' && (
          <div className="mt-3 max-w-[240px]">
            <div className="mb-1.5 text-[12px] font-medium text-[#364658]">Run on <span className="text-[#DC2626]">*</span></div>
            <input type="date" value={draft.startAt ?? ''} onChange={(e) => onChange({ ...draft, startAt: e.target.value || null })} className={`${inputCls} w-full`} />
          </div>
        )}
        {draft.kind === 'Recurring' && draft.freq === 'Weekly' && (
          <div className="mt-3">
            <div className="mb-1.5 text-[12px] font-medium text-[#364658]">Days of the week <span className="text-[#DC2626]">*</span></div>
            <div className="flex gap-1.5">
              {BS_DOW.map((d) => {
                const on = draft.days.includes(d);
                return (
                  <button key={d} aria-pressed={on}
                          onClick={() => onChange({ ...draft, days: on ? draft.days.filter((x) => x !== d) : [...draft.days, d] })}
                          className={`h-8 w-11 rounded border text-[12px] font-medium transition-colors ${on ? 'border-[#3D8BD0] bg-[#EBF5FF] text-[#3D8BD0]' : 'border-[#d1d5db] bg-white text-[#7B8FA5] hover:border-[#3D8BD0]'}`}>{d}</button>
                );
              })}
            </div>
            {!draft.days.length && <p className="mt-1 text-[12px] text-[#DC2626]">Pick at least one day.</p>}
          </div>
        )}
        {draft.kind === 'Recurring' && draft.freq === 'Monthly' && (
          <div className="mt-3 max-w-[240px]">
            <div className="mb-1.5 text-[12px] font-medium text-[#364658]">Day of month</div>
            <select value={draft.monthDay} onChange={(e) => onChange({ ...draft, monthDay: +e.target.value })} className={`${selectCls} w-full`}>
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        )}
        <div className="mt-3 max-w-[240px]">
          <div className="mb-1.5 text-[12px] font-medium text-[#364658]">Start at</div>
          <select value={draft.time} onChange={(e) => onChange({ ...draft, time: e.target.value })} className={`${selectCls} w-full`}>
            {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* The policy said back in words — mistakes show up here before they are saved. */}
        <div className="mt-3 rounded-lg bg-[#F0F7FD] px-3.5 py-2.5 text-[13px] text-[#364658]">{bsEcho(draft)}</div>

        <div className="my-4 border-t border-[#E5E7EB]" />
        <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[#7B8FA5]">Apply to CIs <span className="font-normal normal-case">— by hand or by rule</span></div>
        <TargetTiles
          poolCount={enrolled.length} manualCount={draft.manual.length}
          groupsCount={draft.groups.filter((g) => g.conds.some(condDone)).length}
          auto={draft.auto} autoCount={autoCount}
          onPick={() => setPicking(true)} onCond={() => setCondOpen(true)}
        />

        <div className="my-4 border-t border-[#E5E7EB]" />
        <div className="mb-1.5 text-[12px] font-medium text-[#364658]">Schedule name <span className="font-normal text-[#9CA3AF]">— optional</span></div>
        <input type="text" value={draft.name} placeholder={bsEcho(draft)}
               onChange={(e) => onChange({ ...draft, name: e.target.value })} className={`${inputCls} w-full`} />
      </BomDrawer>

      {picking && (
        <CiPickerDrawer
          title="Add CIs by hand" sub={`${enrolled.length} enrolled CIs are available — only licensed CIs can be targeted`}
          pool={enrolled} initial={draft.manual}
          applyLabel={(n) => `Apply ${n} CI${n === 1 ? '' : 's'}`}
          onApply={(ids) => { onChange({ ...draft, manual: ids }); setPicking(false); }}
          onClose={() => setPicking(false)}
        />
      )}
      {condOpen && (
        <ConditionDrawer
          pool={enrolled} poolLabel="enrolled CIs"
          initialGroups={draft.groups.length ? draft.groups : [newGroup()]} initialAuto={draft.groups.length ? draft.auto : true}
          onApply={(groups, auto) => { onChange({ ...draft, groups, auto }); setCondOpen(false); }}
          onClose={() => setCondOpen(false)}
        />
      )}
    </>
  );
}
