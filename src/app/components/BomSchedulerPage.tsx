import { useReducer, useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  Ci, SchedulePolicy, enrolledCis, nextId, store,
} from './bomAdminData';
import {
  BomDrawer, BomPageHead, BomSwitch, ConfirmButton, Kpi, StatusPill, inputCls, priBtnCls, secBtnCls, selectCls,
} from './BomAdminBits';

/* BOM Scheduler — when enrolled CIs are scanned. Policies target CI TYPES, not device lists:
 * auto intent covers a whole type and grows as the estate grows; fixed intent is hand-picked
 * and never grows. Only licensed CIs are schedulable — Licensing gates this screen. */

const CI_TYPES = ['Laptop', 'Desktop', 'Workstation', 'Virtual Machine'];
const TIMES = ['00:00', '02:00', '04:00', '06:00', '12:00', '18:00', '22:00'];

/** Which ENROLLED CIs a policy resolves to — the licensing gate applied. */
const coverage = (p: SchedulePolicy): Ci[] => {
  const pool = enrolledCis();
  return p.intent === 'auto'
    ? pool.filter((c) => p.ciTypes.includes(c.type))
    : pool.filter((c) => p.ciIds.includes(c.id));
};

export function BomSchedulerPage({ onBack }: { onBack: () => void }) {
  const [, refresh] = useReducer((x: number) => x + 1, 0);
  const [draft, setDraft] = useState<SchedulePolicy | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  const enrolled = enrolledCis();
  const active = store.schedules.filter((p) => p.on);
  const covered = new Set(active.flatMap((p) => coverage(p).map((c) => c.id)));

  const openDraft = (p: SchedulePolicy | null) =>
    setDraft(p ? { ...p, ciTypes: [...p.ciTypes], ciIds: [...p.ciIds] } : {
      id: nextId('SP', store.schedules), name: '', on: true,
      intent: 'auto', ciTypes: [], ciIds: [], frequency: 'Daily', time: '02:00',
    });

  return (
    <div className="mx-auto max-w-[1400px] px-8 py-6">
      <BomPageHead
        title="BOM Scheduler"
        sub="Auto-generate SBOMs for enrolled CIs on a schedule. Auto policies cover whole CI types and grow with the estate; fixed policies are hand-picked and never grow."
        onBack={onBack}
        actions={<button onClick={() => openDraft(null)} className={priBtnCls}><Plus size={15} /> New policy</button>}
      />

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Active policies" value={active.length} sub={`${store.schedules.length - active.length} paused`} />
        <Kpi label="CIs covered" value={covered.size} sub={`of ${enrolled.length} enrolled`}
             tone={enrolled.length > 0 && covered.size === 0 ? 'warn' : undefined} />
        <Kpi label="Not covered" value={enrolled.length - covered.size}
             sub="enrolled but on no schedule" tone={enrolled.length - covered.size > 0 ? 'warn' : undefined} />
        <Kpi label="Next window" value={active.length ? active.map((p) => p.time).sort()[0] : '—'}
             sub={active.length ? 'earliest active policy' : 'no active policy'} />
      </div>

      {enrolled.length === 0 && (
        <div className="mt-4 rounded-lg border border-[#FDE9C8] bg-[#FEF7E6] px-4 py-3 text-[13px] text-[#D97706]">
          No CIs are enrolled yet — schedules have nothing to run on. Enrol CIs in <b>BOM Licensing</b> first.
        </div>
      )}

      <div className="mt-5 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
        <div className="border-b border-[#F0F2F5] px-4 py-3">
          <span className="text-[14px] font-semibold text-[#364658]">Schedule policies</span>
          <span className="ml-2 text-[12px] text-[#7B8FA5]">{store.schedules.length} polic{store.schedules.length === 1 ? 'y' : 'ies'}</span>
        </div>
        {store.schedules.map((p) => {
          const cov = coverage(p);
          return (
            <div key={p.id} className="flex items-center gap-3 border-b border-[#F0F2F5] px-4 py-3 last:border-b-0">
              <BomSwitch on={p.on} label={`${p.name} enabled`} onClick={() => {
                p.on = !p.on; refresh();
                toast(p.on ? `"${p.name}" enabled` : `"${p.name}" paused`);
              }} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-medium text-[#364658]">{p.name}</span>
                  <StatusPill on={p.on} onLabel="Active" offLabel="Paused" />
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${p.intent === 'auto' ? 'bg-[#EBF5FF] text-[#3D8BD0]' : 'bg-[#F1F5F9] text-[#64748B]'}`}>
                    {p.intent === 'auto' ? 'Auto — grows with the estate' : 'Fixed set'}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-[12px] text-[#7B8FA5]">
                  {p.intent === 'auto'
                    ? (p.ciTypes.length ? p.ciTypes.join(' · ') : 'No CI types selected')
                    : `${p.ciIds.length} hand-picked CI${p.ciIds.length === 1 ? '' : 's'}`}
                </div>
              </div>
              <span className="flex-shrink-0 text-[12px] text-[#7B8FA5]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {p.frequency} · {p.time}
              </span>
              <span className="w-24 flex-shrink-0 text-right text-[12px] text-[#7B8FA5]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {cov.length} covered
              </span>
              <button onClick={() => openDraft(p)} className="rounded px-2 py-1 text-[12px] font-medium text-[#3D8BD0] hover:bg-[#EBF5FF]">Edit</button>
              <ConfirmButton
                armed={confirm === p.id}
                onArm={() => setConfirm(p.id)}
                onCancel={() => setConfirm(null)}
                confirmText="Delete policy"
                onConfirm={() => {
                  store.schedules = store.schedules.filter((x) => x.id !== p.id);
                  setConfirm(null); refresh(); toast(`Deleted "${p.name}"`);
                }}
              />
            </div>
          );
        })}
        {store.schedules.length === 0 && (
          <div className="px-4 py-8 text-center text-[13px] text-[#7B8FA5]">No policies yet — enrolled CIs are not being scanned on a schedule.</div>
        )}
      </div>

      {draft && (
        <BomDrawer
          width={620}
          title={store.schedules.some((x) => x.id === draft.id) ? 'Edit schedule policy' : 'New schedule policy'}
          sub="Runs only for licensed CIs — enrolment is decided in BOM Licensing."
          onClose={() => setDraft(null)}
          footer={
            <>
              <span className="mr-auto text-[12px] text-[#7B8FA5]">
                {coverage(draft).length} enrolled CI{coverage(draft).length === 1 ? '' : 's'} covered right now
              </span>
              <button onClick={() => setDraft(null)} className={secBtnCls}>Cancel</button>
              <button
                className={priBtnCls}
                disabled={!draft.name.trim() || (draft.intent === 'auto' ? draft.ciTypes.length === 0 : draft.ciIds.length === 0)}
                onClick={() => {
                  const existing = store.schedules.some((x) => x.id === draft.id);
                  store.schedules = existing
                    ? store.schedules.map((x) => (x.id === draft.id ? draft : x))
                    : [...store.schedules, draft];
                  setDraft(null); refresh();
                  toast.success(`"${draft.name}" saved`);
                }}
              >{store.schedules.some((x) => x.id === draft.id) ? 'Save changes' : 'Create policy'}</button>
            </>
          }
        >
          <label className="mb-1 block text-[12px] font-medium text-[#364658]">Policy name <span className="text-[#DC2626]">*</span></label>
          <input autoFocus type="text" value={draft.name} placeholder="e.g. Laptop nightly SBOM"
                 onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={`${inputCls} w-full`} />

          <div className="mt-4 mb-1.5 text-[12px] font-medium text-[#364658]">Targeting intent</div>
          <div className="grid grid-cols-2 gap-2">
            {(['auto', 'fixed'] as const).map((intent) => (
              <button
                key={intent}
                onClick={() => setDraft({ ...draft, intent })}
                className={`rounded-lg border px-3.5 py-2.5 text-left transition-colors ${draft.intent === intent ? 'border-[#3D8BD0] bg-[#F0F7FD]' : 'border-[#E5E7EB] bg-white hover:border-[#CFD8E3]'}`}
              >
                <div className="text-[13px] font-medium text-[#364658]">{intent === 'auto' ? 'Auto — by CI type' : 'Fixed — hand-picked'}</div>
                <div className="mt-0.5 text-[12px] leading-[1.5] text-[#7B8FA5]">
                  {intent === 'auto'
                    ? 'Covers the whole type, minus nothing — new enrolled CIs of the type join automatically.'
                    : 'Exactly the CIs you pick. Never grows, even as the estate does.'}
                </div>
              </button>
            ))}
          </div>

          {draft.intent === 'auto' ? (
            <>
              <div className="mt-4 mb-1.5 text-[12px] font-medium text-[#364658]">CI types</div>
              <div className="flex flex-wrap gap-2">
                {CI_TYPES.map((t) => {
                  const on = draft.ciTypes.includes(t);
                  const n = enrolledCis().filter((c) => c.type === t).length;
                  return (
                    <button
                      key={t}
                      onClick={() => setDraft({ ...draft, ciTypes: on ? draft.ciTypes.filter((x) => x !== t) : [...draft.ciTypes, t] })}
                      className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${on ? 'border-[#3D8BD0] bg-[#EBF5FF] text-[#3D8BD0]' : 'border-[#d1d5db] bg-white text-[#7B8FA5] hover:border-[#3D8BD0]'}`}
                    >{t} <span className="opacity-70">({n} enrolled)</span></button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div className="mt-4 mb-1.5 text-[12px] font-medium text-[#364658]">
                CIs <span className="font-normal text-[#9CA3AF]">· enrolled only — only licensed CIs can be targeted</span>
              </div>
              <div className="max-h-[240px] overflow-y-auto rounded-lg border border-[#E5E7EB]">
                {enrolledCis().map((c) => {
                  const on = draft.ciIds.includes(c.id);
                  return (
                    <label key={c.id} className={`flex cursor-pointer items-center gap-3 border-b border-[#F0F2F5] px-3.5 py-2 text-[13px] last:border-b-0 ${on ? 'bg-[#F0F7FD]' : 'hover:bg-[#F9FAFB]'}`}>
                      <input type="checkbox" checked={on} className="size-4 accent-[#3D8BD0]"
                             onChange={() => setDraft({ ...draft, ciIds: on ? draft.ciIds.filter((x) => x !== c.id) : [...draft.ciIds, c.id] })} />
                      <span className="w-16 font-mono text-[12px] text-[#3D8BD0]">{c.id}</span>
                      <span className="min-w-0 flex-1 truncate text-[#364658]">{c.host}</span>
                      <span className="text-[12px] text-[#7B8FA5]">{c.type}</span>
                    </label>
                  );
                })}
                {enrolledCis().length === 0 && (
                  <div className="px-4 py-6 text-center text-[13px] text-[#7B8FA5]">Nothing is enrolled — enrol CIs in BOM Licensing first.</div>
                )}
              </div>
            </>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1.5 text-[12px] font-medium text-[#364658]">Frequency</div>
              <select value={draft.frequency} onChange={(e) => setDraft({ ...draft, frequency: e.target.value as SchedulePolicy['frequency'] })} className={`${selectCls} w-full`}>
                {(['Daily', 'Weekly', 'Monthly'] as const).map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <div className="mb-1.5 text-[12px] font-medium text-[#364658]">Run at</div>
              <select value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} className={`${selectCls} w-full`}>
                {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        </BomDrawer>
      )}
    </div>
  );
}
