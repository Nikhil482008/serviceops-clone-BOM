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
      <div className="mt-4 rounded-lg border border-[#CFE0F0] bg-white px-[18px] pb-[17px] pt-4">
        <div className="mb-3 flex items-center justify-between gap-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-[.05em] text-[#7B8FA5]">Default policy</span>
          <span className="text-[12px] text-[#7B8FA5]">Applies to every enrolled CI</span>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 text-[15px] leading-[1.5] text-[#364658]">
          Keep the latest
          <select
            value={D.keep}
            onChange={(e) => { D.keep = e.target.value; refresh(); toast.success(`Default retention: keep the latest ${e.target.value.toLowerCase()}`); }}
            className={`${selectCls} w-[172px]`}
          >{KEEP_OPTIONS.map((k) => <option key={k} value={k}>{k}</option>)}</select>
          <span className="text-[14px] text-[#7B8FA5]">or automatically delete versions older than</span>
          <select
            value={D.period}
            onChange={(e) => { D.period = e.target.value; refresh(); toast.success(`Default retention: delete after ${e.target.value.toLowerCase()}`); }}
            className={`${selectCls} w-[150px]`}
          >{PERIOD_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}</select>
        </div>
        <p className="mt-[11px] text-[12px] text-[#7B8FA5]">
          {rtNote(D.keep, D.period)} Each limit is set on its own — change one without touching the other.
        </p>
      </div>

      {/* Exceptions */}
      <div className="mt-4 rounded-lg border border-[#E5E7EB] bg-white">
        <div className="border-b border-[#E5E7EB] px-4 py-3">
          <span className="text-[15px] font-semibold text-[#364658]">Exception rules</span>
          <span className="ml-2 text-[12px] text-[#7B8FA5]">{store.retention.overrides.length} · override the default for the CIs they target</span>
        </div>
        {store.retention.overrides.length === 0 ? (
          <div className="flex flex-col items-center px-5 py-[72px] text-center">
            <p className="text-[14px] font-medium text-[#364658]">No exceptions.</p>
            <p className="mt-[5px] max-w-[440px] text-[13px] leading-[1.55] text-[#7B8FA5]">
              Every enrolled CI follows the default policy above. Add an exception when a group of CIs needs to keep more history — or less.
            </p>
            <button onClick={() => openDraft(null)} className={`mt-4 ${priBtnCls}`}>New Exception</button>
          </div>
        ) : (
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="whitespace-nowrap border-b border-[#E5E7EB] text-[12px] font-semibold tracking-[.05em] text-[#364658]">
                <th className="w-[26%] px-4 py-[11px]">Policy</th><th className="px-4 py-[11px]">Applies To</th>
                <th className="px-4 py-[11px]">Retention Policy</th><th className="px-4 py-[11px]">Status</th>
                <th className="w-[210px] px-4 py-[11px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {store.retention.overrides.map((r) => {
                const n = overrideTargets(r).length;
                return (
                  <tr key={r.id} className={`border-b border-[#F0F2F5] text-[13px] text-[#364658] last:border-b-0 hover:bg-[#F9FAFB] ${r.on ? '' : 'bg-[#FCFDFE]'}`}>
                    <td className="px-4 py-3.5 align-middle">
                      <div className={`text-[13px] font-semibold ${r.on ? 'text-[#364658]' : 'text-[#7B8FA5]'}`}>{r.name}</div>
                      <div className="mt-[3px] font-mono text-[11px] text-[#9CA3AF]">{r.id} · overrides default</div>
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      <div className="text-[13px] font-medium text-[#364658]">{rtApplies(r)}</div>
                      <div className="mt-[3px] text-[12px] text-[#7B8FA5]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        <span className={`inline-flex items-center gap-[5px] whitespace-nowrap rounded-[2px] px-2 py-0.5 text-[12px] font-medium ${rtKind(r) === 'Fixed' ? 'bg-[#F1F5F9] text-[#64748B]' : 'bg-[#F1F5F9] text-[#64748B]'}`}>{rtKind(r)}</span>
                        {r.manual.length > 0 && <span className="ml-1.5">{r.manual.length} by hand</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      Keep last {r.keep}
                      <div className="mt-[3px] text-[12px] text-[#7B8FA5]">{r.period === 'Forever' ? 'Never deleted' : `Delete after ${r.period.toLowerCase()}`}</div>
                    </td>
                    <td className="px-4 py-3.5 align-middle"><StatusPill on={r.on} onLabel="Active" offLabel="Disabled" /></td>
                    <td className="relative px-4 py-3.5 align-middle">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            r.on = !r.on; refresh();
                            toast(r.on ? `"${r.name}" enabled — its CIs use this exception again` : `"${r.name}" disabled — its CIs fall back to the default policy`);
                          }}
                          className="inline-flex h-7 items-center whitespace-nowrap rounded border border-[#DFE5ED] bg-white px-2.5 text-[12px] font-medium text-[#364658] transition-colors hover:bg-[#F5F7FA]"
                        >{r.on ? 'Disable' : 'Enable'}</button>
                        <button onClick={() => openDraft(r)} className="inline-flex h-7 items-center whitespace-nowrap rounded border border-[#DFE5ED] bg-white px-2.5 text-[12px] font-medium text-[#364658] transition-colors hover:bg-[#F5F7FA]">Edit</button>
                        <button onClick={() => setConfirm(confirm === r.id ? null : r.id)}
                                className="inline-flex h-7 items-center whitespace-nowrap rounded border border-[#DFE5ED] bg-white px-2.5 text-[12px] font-medium text-[#DC2626] transition-colors hover:border-[#F3D6D6] hover:bg-[#FEF3F2]">Delete</button>
                      </div>
                      {confirm === r.id && (
                        <div className="absolute right-4 top-12 z-[70] w-[280px] rounded-lg border border-[#DFE5ED] bg-white p-3 text-left shadow-[0_10px_15px_-3px_rgba(16,24,40,0.1),0_4px_6px_-4px_rgba(16,24,40,0.1)]">
                          <p className="text-[13px] font-medium text-[#364658]">Delete {r.name}?</p>
                          <p className="mt-1 text-[12px] text-[#7B8FA5]">
                            The {n} CI{n === 1 ? '' : 's'} it covers fall back to the default policy — keep the latest {D.keep.toLowerCase()}, delete after {D.period.toLowerCase()}.
                          </p>
                          <div className="mt-3 flex justify-end gap-2">
                            <button onClick={() => setConfirm(null)} className="inline-flex h-7 items-center rounded border border-[#DFE5ED] bg-white px-2.5 text-[12px] font-medium text-[#364658] transition-colors hover:bg-[#F5F7FA]">Cancel</button>
                            <button
                              onClick={() => {
                                store.retention.overrides = store.retention.overrides.filter((x) => x.id !== r.id);
                                setConfirm(null); refresh();
                                toast(`Deleted "${r.name}" — its CIs fall back to the default policy`);
                              }}
                              className="inline-flex h-7 items-center rounded border border-[#DC2626] bg-[#DC2626] px-2.5 text-[12px] font-medium text-white transition-colors hover:border-[#B91C1C] hover:bg-[#B91C1C]"
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
        <label className="mb-1.5 block text-[12px] font-medium text-[#7B8FA5]">Exception name <span className="ml-0.5 text-[#DC2626]">*</span></label>
        <input
          autoFocus type="text" value={draft.name} placeholder="e.g. Payments host"
          onChange={(e) => { onChange({ ...draft, name: e.target.value }); if (e.target.value.trim()) setErr(false); }}
          className={`${inputCls} w-full ${err && !draft.name.trim() ? '!border-[#DC2626]' : ''}`}
        />
        {err && !draft.name.trim() && <p className="mt-[5px] text-[12px] text-[#DC2626]">Give the exception a name so it can be recognised later.</p>}

        <div className="mb-2.5 mt-4 text-[13px] font-semibold tracking-[-.1px] text-[#364658]">Retention policy</div>
        <div className="flex flex-wrap items-center gap-2.5 rounded-lg border border-[#E5E7EB] bg-[#F5F7FA] px-3.5 py-3 text-[13px] text-[#364658]">
          Keep last
          <select value={draft.keep} onChange={(e) => onChange({ ...draft, keep: e.target.value })} className={`${selectCls} w-[168px]`}>
            {KEEP_OPTIONS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <span className="text-[13px] text-[#7B8FA5]">or delete after</span>
          <select value={draft.period} onChange={(e) => onChange({ ...draft, period: e.target.value })} className={`${selectCls} w-[150px]`}>
            {PERIOD_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <p className="mt-2 text-[12px] text-[#7B8FA5]">{rtNote(draft.keep, draft.period)}</p>

        <div className="mb-[18px] mt-5 border-t border-[#F0F2F5]" />
        <div className="mb-2.5 text-[13px] font-semibold tracking-[-.1px] text-[#364658]">Applies to CIs <span className="text-[12px] font-normal text-[#7B8FA5]">— by hand, by rule, or both</span></div>
        <TargetTiles
          poolCount={enrolled.length} manualCount={draft.manual.length}
          groupsCount={draft.groups.filter((g) => g.conds.some(condDone)).length}
          auto={draft.auto} autoCount={autoCount}
          onPick={() => setPicking(true)} onCond={() => setCondOpen(true)}
        />

        <div className="mb-[18px] mt-5 border-t border-[#F0F2F5]" />
        <div className="mb-2.5 text-[13px] font-semibold tracking-[-.1px] text-[#364658]">Impact</div>
        <div className={`flex items-start gap-3.5 rounded-lg px-4 py-3.5 ${total ? 'bg-[#F5FAFF]' : 'bg-[#F5F7FA]'}`}>
          <span className={`min-w-[34px] flex-none text-[16px] font-semibold leading-none ${total ? 'text-[#3D8BD0]' : 'text-[#9CA3AF]'}`} style={{ fontVariantNumeric: 'tabular-nums' }}>{total}</span>
          <div className="min-w-0 text-[12px]">
            {total ? (
              <>
                <div className="text-[13px] font-semibold leading-[1.4] text-[#364658]">enrolled CI{total === 1 ? '' : 's'} will use this exception</div>
                <div className="mt-1 text-[12px] leading-[1.6] text-[#7B8FA5]">
                  Kept for <b className="font-semibold text-[#364658]">{draft.keep}</b> instead of {D.keep}, deleted after <b className="font-semibold text-[#364658]">{draft.period.toLowerCase()}</b> instead of {D.period.toLowerCase()}.
                  The other {enrolled.length - total} enrolled CI{enrolled.length - total === 1 ? '' : 's'} keep the default.
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {draft.manual.length > 0 && <span className="inline-flex items-center whitespace-nowrap rounded-[2px] bg-[#EBF5FF] px-2 py-1 text-[12px] font-medium text-[#3D8BD0]">{draft.manual.length} by hand</span>}
                  {draft.auto && autoCount > 0 && <span className="inline-flex items-center whitespace-nowrap rounded-[2px] bg-[#EBF5FF] px-2 py-1 text-[12px] font-medium text-[#3D8BD0]">{autoCount} by rule</span>}
                  {draft.manual.length > 0 && draft.auto && autoCount > 0 && <span className="text-[12px] text-[#7B8FA5]">mixed targeting</span>}
                </div>
              </>
            ) : (
              <>
                <div className="text-[13px] font-semibold leading-[1.4] text-[#364658]">This exception affects no CIs yet</div>
                <div className="mt-1 text-[12px] leading-[1.6] text-[#7B8FA5]">Choose CIs by hand or build a condition above — until then, it overrides nothing.</div>
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
