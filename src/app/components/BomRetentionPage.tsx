import { useMemo, useReducer, useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  KEEP_OPTIONS, PERIOD_OPTIONS, RetentionOverride, condDone, enrolledCis, groupsSummary,
  matches, newGroup, nextId, store,
} from './bomAdminData';
import { BomConditionBuilder } from './BomConditionBuilder';
import {
  BomDrawer, BomPageHead, ConfirmButton, Kpi, inputCls, priBtnCls, secBtnCls, selectCls,
} from './BomAdminBits';

/* BOM Retention — how long a living BOM's versions survive. One default policy covers every
 * enrolled CI; exception rules override it for the CIs they match, using the same condition
 * builder Licensing rules use. First matching exception wins; everything else follows the
 * default. */

export function BomRetentionPage({ onBack }: { onBack: () => void }) {
  const [, refresh] = useReducer((x: number) => x + 1, 0);
  const [draft, setDraft] = useState<RetentionOverride | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [defKeep, setDefKeep] = useState(store.retention.keep);
  const [defPeriod, setDefPeriod] = useState(store.retention.period);

  const enrolled = enrolledCis();
  // First matching override wins per CI — count who is on an exception vs the default.
  const excepted = new Set(
    enrolled.filter((c) => store.retention.overrides.some((o) => matches(o.groups, [c]).length)).map((c) => c.id),
  );
  const dirty = defKeep !== store.retention.keep || defPeriod !== store.retention.period;

  const openDraft = (o: RetentionOverride | null) =>
    setDraft(o
      ? { ...o, groups: o.groups.map((g) => ({ join: g.join, conds: g.conds.map((c) => ({ ...c })) })) }
      : { id: nextId('RR', store.retention.overrides), name: '', groups: [newGroup()], keep: '5 versions', period: '30 days' });

  return (
    <div className="mx-auto max-w-[1400px] px-8 py-6">
      <BomPageHead
        title="BOM Retention"
        sub="Control how long generated BOM versions are stored. Every enrolled CI follows the default policy unless an exception rule overrides it."
        onBack={onBack}
        actions={<button onClick={() => openDraft(null)} className={priBtnCls}><Plus size={15} /> New exception</button>}
      />

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Enrolled CIs" value={enrolled.length} sub="retention applies to enrolled CIs only" />
        <Kpi label="On the default policy" value={enrolled.length - excepted.size} />
        <Kpi label="On an exception" value={excepted.size} sub={`${store.retention.overrides.length} exception rule${store.retention.overrides.length === 1 ? '' : 's'}`} />
        <Kpi label="Default keeps" value={store.retention.keep.replace(' versions', '')} sub={`versions · delete after ${store.retention.period.toLowerCase()}`} />
      </div>

      {/* Default policy — the baseline every enrolled CI inherits. */}
      <div className="mt-5 rounded-xl border border-[#E5E7EB] bg-white">
        <div className="border-b border-[#F0F2F5] px-4 py-3">
          <span className="text-[14px] font-semibold text-[#364658]">Default policy</span>
          <span className="ml-2 text-[12px] text-[#7B8FA5]">applies to every enrolled CI unless an exception overrides it</span>
        </div>
        <div className="flex flex-wrap items-end gap-3 px-4 py-4">
          <div>
            <div className="mb-1.5 text-[12px] font-medium text-[#364658]">Keep the latest</div>
            <select value={defKeep} onChange={(e) => setDefKeep(e.target.value)} className={`${selectCls} w-[180px]`}>
              {KEEP_OPTIONS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div>
            <div className="mb-1.5 text-[12px] font-medium text-[#364658]">Delete versions after</div>
            <select value={defPeriod} onChange={(e) => setDefPeriod(e.target.value)} className={`${selectCls} w-[180px]`}>
              {PERIOD_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <button
            className={priBtnCls} disabled={!dirty}
            onClick={() => {
              store.retention.keep = defKeep; store.retention.period = defPeriod; refresh();
              toast.success(`Default retention: keep the latest ${defKeep.toLowerCase()}, delete after ${defPeriod.toLowerCase()}`);
            }}
          >Save default</button>
          {dirty && <span className="pb-2 text-[12px] text-[#D97706]">Unsaved change</span>}
        </div>
      </div>

      {/* Exceptions */}
      <div className="mt-4 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
        <div className="border-b border-[#F0F2F5] px-4 py-3">
          <span className="text-[14px] font-semibold text-[#364658]">Exception rules</span>
          <span className="ml-2 text-[12px] text-[#7B8FA5]">override the default for the enrolled CIs they match — first match wins</span>
        </div>
        {store.retention.overrides.map((o) => {
          const hit = matches(o.groups, enrolled);
          return (
            <div key={o.id} className="flex items-center gap-3 border-b border-[#F0F2F5] px-4 py-3 last:border-b-0">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-[#364658]">{o.name}</div>
                <div className="mt-0.5 truncate text-[12px] text-[#7B8FA5]" title={groupsSummary(o.groups)}>
                  {groupsSummary(o.groups) || 'No conditions — matches nothing'}
                </div>
              </div>
              <span className="flex-shrink-0 rounded-full bg-[#F1F5F9] px-2.5 py-0.5 text-[11px] font-medium text-[#64748B]">
                keep {o.keep} · delete after {o.period.toLowerCase()}
              </span>
              <span className="w-28 flex-shrink-0 text-right text-[12px] text-[#7B8FA5]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {hit.length} enrolled CI{hit.length === 1 ? '' : 's'}
              </span>
              <button onClick={() => openDraft(o)} className="rounded px-2 py-1 text-[12px] font-medium text-[#3D8BD0] hover:bg-[#EBF5FF]">Edit</button>
              <ConfirmButton
                armed={confirm === o.id}
                onArm={() => setConfirm(o.id)}
                onCancel={() => setConfirm(null)}
                confirmText="Delete exception"
                onConfirm={() => {
                  store.retention.overrides = store.retention.overrides.filter((x) => x.id !== o.id);
                  setConfirm(null); refresh();
                  toast(`Deleted "${o.name}" — its CIs fall back to the default policy`);
                }}
              />
            </div>
          );
        })}
        {store.retention.overrides.length === 0 && (
          <div className="px-4 py-8 text-center text-[13px] text-[#7B8FA5]">
            No exceptions — every enrolled CI follows the default policy above.
          </div>
        )}
      </div>

      {draft && <OverrideDrawer draft={draft} onChange={setDraft} onClose={() => setDraft(null)} onSaved={refresh} />}
    </div>
  );
}

function OverrideDrawer({ draft, onChange, onClose, onSaved }: {
  draft: RetentionOverride; onChange: (o: RetentionOverride) => void; onClose: () => void; onSaved: () => void;
}) {
  const [err, setErr] = useState(false);
  const enrolled = enrolledCis();
  const hit = useMemo(() => matches(draft.groups, enrolled), [draft.groups, enrolled]);
  const usable = draft.groups.some((g) => g.conds.some(condDone));

  return (
    <BomDrawer
      width={640}
      title={store.retention.overrides.some((x) => x.id === draft.id) ? 'Edit exception' : 'New exception'}
      sub="Overrides the default retention for the enrolled CIs it matches."
      onClose={onClose}
      footer={
        <>
          <span className="mr-auto text-[12px] text-[#7B8FA5]">
            {usable
              ? `${hit.length} enrolled CI${hit.length === 1 ? '' : 's'} would follow this exception`
              : 'An incomplete condition matches nothing'}
          </span>
          <button onClick={onClose} className={secBtnCls}>Cancel</button>
          <button
            className={priBtnCls}
            onClick={() => {
              if (!draft.name.trim()) { setErr(true); return; }
              const clean: RetentionOverride = {
                ...draft,
                groups: draft.groups
                  .filter((g) => g.conds.some(condDone))
                  .map((g) => ({ join: g.join, conds: g.conds.filter(condDone).map((c) => ({ ...c })) })),
              };
              const existing = store.retention.overrides.some((x) => x.id === clean.id);
              store.retention.overrides = existing
                ? store.retention.overrides.map((x) => (x.id === clean.id ? clean : x))
                : [...store.retention.overrides, clean];
              onSaved(); onClose();
              toast.success(`"${clean.name}" saved — ${hit.length} enrolled CI${hit.length === 1 ? '' : 's'} matched`);
            }}
          >{store.retention.overrides.some((x) => x.id === draft.id) ? 'Save changes' : 'Create exception'}</button>
        </>
      }
    >
      <label className="mb-1 block text-[12px] font-medium text-[#364658]">Exception name <span className="text-[#DC2626]">*</span></label>
      <input
        autoFocus type="text" value={draft.name} placeholder="e.g. Windows 10 — short retention"
        onChange={(e) => { onChange({ ...draft, name: e.target.value }); if (e.target.value.trim()) setErr(false); }}
        className={`${inputCls} w-full ${err && !draft.name.trim() ? 'border-[#DC2626] ring-1 ring-[#DC2626]' : ''}`}
      />
      {err && !draft.name.trim() && (
        <p className="mt-1 text-[12px] text-[#DC2626]">Give the exception a name so it can be recognised later.</p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <div className="mb-1.5 text-[12px] font-medium text-[#364658]">Keep the latest</div>
          <select value={draft.keep} onChange={(e) => onChange({ ...draft, keep: e.target.value })} className={`${selectCls} w-full`}>
            {KEEP_OPTIONS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div>
          <div className="mb-1.5 text-[12px] font-medium text-[#364658]">Delete versions after</div>
          <select value={draft.period} onChange={(e) => onChange({ ...draft, period: e.target.value })} className={`${selectCls} w-full`}>
            {PERIOD_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1.5 text-[12px] font-medium text-[#364658]">
          Applies to <span className="font-normal text-[#9CA3AF]">· enrolled CIs matching these conditions</span>
        </div>
        <BomConditionBuilder groups={draft.groups} onChange={(groups) => onChange({ ...draft, groups })} />
      </div>

      <div className="mt-4 rounded-lg border border-[#E5E7EB] bg-white">
        <div className="border-b border-[#F0F2F5] bg-[#F0F7FD] px-3.5 py-2 text-[12px] text-[#364658]">
          {usable
            ? <>Preview — <b>{hit.length}</b> of {enrolled.length} enrolled CI{hit.length === 1 ? '' : 's'} match</>
            : <>Preview</>}
        </div>
        {usable && hit.length > 0 ? (
          <div className="max-h-[180px] overflow-y-auto">
            {hit.map((c) => (
              <div key={c.id} className="flex items-center gap-3 border-b border-[#F0F2F5] px-3.5 py-2 text-[13px] last:border-b-0">
                <span className="w-16 font-mono text-[12px] text-[#3D8BD0]">{c.id}</span>
                <span className="min-w-0 flex-1 truncate text-[#364658]">{c.host}</span>
                <span className="text-[12px] text-[#7B8FA5]">{c.os}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-3.5 py-3 text-[12px] leading-[1.6] text-[#7B8FA5]">
            {usable
              ? 'Nothing matches right now. Future enrolled CIs that match will follow this exception automatically.'
              : 'Nothing matches yet. An incomplete condition matches nothing — a half-written exception never sweeps in the whole estate by accident.'}
          </div>
        )}
      </div>
    </BomDrawer>
  );
}
