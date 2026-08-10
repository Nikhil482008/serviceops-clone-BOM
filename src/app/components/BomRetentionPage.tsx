import { useReducer, useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  KEEP_OPTIONS, PERIOD_OPTIONS, RetentionOverride, condDone, enrolledCis, matches, newGroup,
  nextId, overrideTargets, store,
} from './bomAdminData';
import {
  BomDrawer, BomPageHead, CiPickerDrawer, ConditionDrawer, StatusPill, SumStrip, TargetTiles,
  inputCls, priBtnCls, secBtnCls, selectCls,
} from './BomAdminBits';

/* BOM Retention — how long a living BOM's versions survive. One default policy covers every
 * enrolled CI, stated as a sentence and applied the moment it changes. Exception rules
 * override it for the CIs they target — picked by hand (fixed), matched by condition
 * (dynamic), or both. */

const rtNote = (keep: string, period: string) =>
  period === 'Forever'
    ? `Versions beyond the latest ${keep.toLowerCase()} are deleted; nothing expires by age.`
    : `Whichever limit is reached first wins — versions beyond the latest ${keep.toLowerCase()}, or older than ${period.toLowerCase()}, are deleted.`;

const rtKind = (r: RetentionOverride): string => {
  const hasAuto = r.auto && r.groups.some((g) => g.conds.some(condDone));
  if (r.manual.length && hasAuto) return 'Mixed';
  if (hasAuto) return 'Dynamic';
  return 'Fixed';
};

const rtApplies = (r: RetentionOverride): string => {
  const n = overrideTargets(r).length;
  return `${n} enrolled CI${n === 1 ? '' : 's'}`;
};

export function BomRetentionPage({ onBack }: { onBack: () => void }) {
  const [, refresh] = useReducer((x: number) => x + 1, 0);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [draft, setDraft] = useState<RetentionOverride | null>(null);

  const enrolled = enrolledCis();
  const D = store.retention;
  const affected = new Set(store.retention.overrides.filter((r) => r.on).flatMap((r) => overrideTargets(r).map((c) => c.id))).size;

  const openDraft = (o: RetentionOverride | null) =>
    setDraft(o
      ? { ...o, manual: [...o.manual], groups: o.groups.map((g) => ({ join: g.join, conds: g.conds.map((c) => ({ ...c })) })) }
      : { id: nextId('RR', store.retention.overrides), name: '', on: true, auto: false, manual: [], groups: [], keep: '5 versions', period: '30 days' });

  return (
    <div className="mx-auto max-w-[1400px] px-8 py-6">
      <BomPageHead
        title="BOM Retention"
        sub="Control how long generated BOM versions are stored. Every enrolled CI follows the default policy unless an exception rule overrides it."
        onBack={onBack}
        actions={<button onClick={() => openDraft(null)} className={priBtnCls}><Plus size={15} /> New Exception</button>}
      />

      <div className="mt-5">
        <SumStrip cells={[
          { label: 'Default policy', value: D.keep, unit: `/ ${D.period.toLowerCase()}` },
          { label: 'Retention exceptions', value: store.retention.overrides.length, unit: `${store.retention.overrides.filter((r) => r.on).length} active`, quiet: !store.retention.overrides.length },
          { label: 'Affected CIs', value: affected, unit: `of ${enrolled.length} enrolled · the rest follow the default`, quiet: !affected },
        ]} />
      </div>

      {/* The default policy, stated rather than filled in — changes apply immediately. */}
      <div className="mt-4 rounded-xl border border-[#E5E7EB] bg-white px-4 py-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-[#7B8FA5]">Default policy</span>
          <span className="text-[12px] text-[#9CA3AF]">Applies to every enrolled CI</span>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[14px] text-[#364658]">
          Keep the latest
          <select
            value={D.keep}
            onChange={(e) => { D.keep = e.target.value; refresh(); toast.success(`Default retention: keep the latest ${e.target.value.toLowerCase()}`); }}
            className={`${selectCls} w-[160px]`}
          >{KEEP_OPTIONS.map((k) => <option key={k} value={k}>{k}</option>)}</select>
          <span className="text-[#7B8FA5]">or automatically delete versions older than</span>
          <select
            value={D.period}
            onChange={(e) => { D.period = e.target.value; refresh(); toast.success(`Default retention: delete after ${e.target.value.toLowerCase()}`); }}
            className={`${selectCls} w-[140px]`}
          >{PERIOD_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}</select>
        </div>
        <p className="mt-2 text-[12px] leading-[1.55] text-[#9CA3AF]">
          {rtNote(D.keep, D.period)} Each limit is set on its own — change one without touching the other.
        </p>
      </div>

      {/* Exceptions */}
      <div className="mt-4 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
        <div className="border-b border-[#F0F2F5] px-4 py-3">
          <span className="text-[14px] font-semibold text-[#364658]">Exception rules</span>
          <span className="ml-2 text-[12px] text-[#7B8FA5]">{store.retention.overrides.length} · override the default for the CIs they target</span>
        </div>
        {store.retention.overrides.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <p className="text-[14px] font-medium text-[#364658]">No exceptions.</p>
            <p className="mt-1 max-w-[520px] text-[13px] leading-[1.55] text-[#7B8FA5]">
              Every enrolled CI follows the default policy above. Add an exception when a group of CIs needs to keep more history — or less.
            </p>
            <button onClick={() => openDraft(null)} className={`mt-4 ${priBtnCls}`}>New Exception</button>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#F0F2F5] text-[12px] font-semibold text-[#364658]">
                <th className="w-[26%] px-4 py-2.5">Policy</th><th className="px-3 py-2.5">Applies To</th>
                <th className="px-3 py-2.5">Retention Policy</th><th className="px-3 py-2.5">Status</th>
                <th className="w-[170px] px-3 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {store.retention.overrides.map((r) => {
                const n = overrideTargets(r).length;
                return (
                  <tr key={r.id} className={`border-b border-[#F0F2F5] text-[13px] text-[#364658] last:border-b-0 hover:bg-[#F9FAFB] ${r.on ? '' : 'opacity-70'}`}>
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{r.name}</div>
                      <div className="font-mono text-[11px] text-[#9CA3AF]">{r.id} · overrides default</div>
                    </td>
                    <td className="px-3 py-2.5">
                      {rtApplies(r)}
                      <div className="mt-0.5">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${rtKind(r) === 'Fixed' ? 'border border-[#E5E7EB] text-[#64748B]' : 'bg-[#E6F7F4] text-[#0D9488]'}`}>{rtKind(r)}</span>
                        {r.manual.length > 0 && <span className="ml-1.5 text-[11px] text-[#9CA3AF]">{r.manual.length} by hand</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      Keep last {r.keep}
                      <div className="text-[11px] text-[#9CA3AF]">{r.period === 'Forever' ? 'Never deleted' : `Delete after ${r.period.toLowerCase()}`}</div>
                    </td>
                    <td className="px-3 py-2.5"><StatusPill on={r.on} onLabel="Active" offLabel="Disabled" /></td>
                    <td className="relative px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            r.on = !r.on; refresh();
                            toast(r.on ? `"${r.name}" enabled — its CIs use this exception again` : `"${r.name}" disabled — its CIs fall back to the default policy`);
                          }}
                          className="rounded px-2 py-1 text-[12px] font-medium text-[#7B8FA5] hover:bg-[#F3F4F6] hover:text-[#364658]"
                        >{r.on ? 'Disable' : 'Enable'}</button>
                        <button onClick={() => openDraft(r)} className="rounded px-2 py-1 text-[12px] font-medium text-[#3D8BD0] hover:bg-[#EBF5FF]">Edit</button>
                        <button onClick={() => setConfirm(confirm === r.id ? null : r.id)}
                                className="rounded px-2 py-1 text-[12px] text-[#7B8FA5] hover:bg-[#FEF3F2] hover:text-[#DC2626]">Delete</button>
                      </div>
                      {confirm === r.id && (
                        <div className="absolute right-3 top-10 z-[70] w-[310px] rounded-lg border border-[#E5E7EB] bg-white p-3 text-left shadow-[0_8px_24px_-8px_rgba(16,24,40,0.25)]">
                          <p className="text-[13px] font-medium text-[#364658]">Delete {r.name}?</p>
                          <p className="mt-1 text-[12px] leading-[1.5] text-[#7B8FA5]">
                            The {n} CI{n === 1 ? '' : 's'} it covers fall back to the default policy — keep the latest {D.keep.toLowerCase()}, delete after {D.period.toLowerCase()}.
                          </p>
                          <div className="mt-2.5 flex justify-end gap-2">
                            <button onClick={() => setConfirm(null)} className="rounded border border-[#d1d5db] px-2.5 py-1 text-[12px] text-[#364658] hover:bg-[#F9FAFB]">Cancel</button>
                            <button
                              onClick={() => {
                                store.retention.overrides = store.retention.overrides.filter((x) => x.id !== r.id);
                                setConfirm(null); refresh();
                                toast(`Deleted "${r.name}" — its CIs fall back to the default policy`);
                              }}
                              className="rounded bg-[#DC2626] px-2.5 py-1 text-[12px] font-medium text-white hover:bg-[#b91c1c]"
                            >Delete exception</button>
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

      {draft && <OverrideDrawer draft={draft} onChange={setDraft} onClose={() => setDraft(null)} onSaved={() => { setDraft(null); refresh(); }} />}
    </div>
  );
}

function OverrideDrawer({ draft, onChange, onClose, onSaved }: {
  draft: RetentionOverride; onChange: (o: RetentionOverride) => void; onClose: () => void; onSaved: () => void;
}) {
  const [err, setErr] = useState(false);
  const [picking, setPicking] = useState(false);
  const [condOpen, setCondOpen] = useState(false);
  const enrolled = enrolledCis();
  const autoCount = draft.auto ? matches(draft.groups, enrolled).length : 0;
  const total = overrideTargets(draft).length;
  const editing = store.retention.overrides.some((x) => x.id === draft.id);
  const D = store.retention;

  return (
    <>
      <BomDrawer
        width={680}
        title={editing ? 'Edit retention rule' : 'New retention rule'}
        sub="Overrides the default retention policy for the CIs you target."
        onClose={onClose}
        footer={
          <>
            <span className="mr-auto text-[12px] text-[#7B8FA5]">
              Applies to <b className="text-[#364658]">{total}</b> of {enrolled.length} enrolled CIs
            </span>
            <button onClick={onClose} className={secBtnCls}>Cancel</button>
            <button
              className={priBtnCls}
              onClick={() => {
                if (!draft.name.trim()) { setErr(true); return; }
                const clean: RetentionOverride = {
                  ...draft,
                  groups: draft.groups.filter((g) => g.conds.some(condDone)).map((g) => ({ join: g.join, conds: g.conds.filter(condDone) })),
                };
                store.retention.overrides = editing
                  ? store.retention.overrides.map((x) => (x.id === clean.id ? clean : x))
                  : [...store.retention.overrides, clean];
                onSaved();
                toast.success(`"${clean.name}" saved — ${total} enrolled CI${total === 1 ? '' : 's'} will use this exception`);
              }}
            >{editing ? 'Save changes' : 'Create exception'}</button>
          </>
        }
      >
        <label className="mb-1 block text-[12px] font-medium text-[#364658]">Exception name <span className="text-[#DC2626]">*</span></label>
        <input
          autoFocus type="text" value={draft.name} placeholder="e.g. Payments host"
          onChange={(e) => { onChange({ ...draft, name: e.target.value }); if (e.target.value.trim()) setErr(false); }}
          className={`${inputCls} w-full ${err && !draft.name.trim() ? 'border-[#DC2626] ring-1 ring-[#DC2626]' : ''}`}
        />
        {err && !draft.name.trim() && <p className="mt-1 text-[12px] text-[#DC2626]">Give the exception a name so it can be recognised later.</p>}

        <div className="mt-4 mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-[#7B8FA5]">Retention policy</div>
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-[#364658]">
          Keep last
          <select value={draft.keep} onChange={(e) => onChange({ ...draft, keep: e.target.value })} className={`${selectCls} w-[150px]`}>
            {KEEP_OPTIONS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <span className="text-[#7B8FA5]">or delete after</span>
          <select value={draft.period} onChange={(e) => onChange({ ...draft, period: e.target.value })} className={`${selectCls} w-[130px]`}>
            {PERIOD_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <p className="mt-1.5 text-[12px] text-[#9CA3AF]">{rtNote(draft.keep, draft.period)}</p>

        <div className="my-4 border-t border-[#E5E7EB]" />
        <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[#7B8FA5]">Applies to CIs <span className="font-normal normal-case">— by hand, by rule, or both</span></div>
        <TargetTiles
          poolCount={enrolled.length} manualCount={draft.manual.length}
          groupsCount={draft.groups.filter((g) => g.conds.some(condDone)).length}
          auto={draft.auto} autoCount={autoCount}
          onPick={() => setPicking(true)} onCond={() => setCondOpen(true)}
        />

        <div className="my-4 border-t border-[#E5E7EB]" />
        <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[#7B8FA5]">Impact</div>
        <div className={`flex items-start gap-4 rounded-lg border px-4 py-3.5 ${total ? 'border-[#BFDBF7] bg-[#F0F7FD]' : 'border-[#E5E7EB] bg-[#FBFCFD]'}`}>
          <span className={`text-[28px] font-semibold leading-none ${total ? 'text-[#364658]' : 'text-[#9CA3AF]'}`} style={{ fontVariantNumeric: 'tabular-nums' }}>{total}</span>
          <div className="min-w-0 text-[12px] leading-[1.55]">
            {total ? (
              <>
                <div className="text-[13px] font-medium text-[#364658]">enrolled CI{total === 1 ? '' : 's'} will use this exception</div>
                <div className="mt-0.5 text-[#7B8FA5]">
                  Kept for <b className="text-[#364658]">{draft.keep}</b> instead of {D.keep}, deleted after <b className="text-[#364658]">{draft.period.toLowerCase()}</b> instead of {D.period.toLowerCase()}.
                  The other {enrolled.length - total} enrolled CI{enrolled.length - total === 1 ? '' : 's'} keep the default.
                </div>
                <div className="mt-1 flex gap-2 text-[11px] text-[#64748B]">
                  {draft.manual.length > 0 && <span>{draft.manual.length} by hand</span>}
                  {draft.auto && autoCount > 0 && <span>{autoCount} by rule</span>}
                  {draft.manual.length > 0 && draft.auto && autoCount > 0 && <span className="text-[#9CA3AF]">mixed targeting</span>}
                </div>
              </>
            ) : (
              <>
                <div className="text-[13px] font-medium text-[#364658]">This exception affects no CIs yet</div>
                <div className="mt-0.5 text-[#7B8FA5]">Choose CIs by hand or build a condition above — until then, it overrides nothing.</div>
              </>
            )}
          </div>
        </div>
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
