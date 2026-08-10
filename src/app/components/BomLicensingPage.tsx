import { useMemo, useReducer, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  ALL_CIS, AutoRule, BOM_SEATS, Ci, CondGroup, deleteRule, enrol, enrolledCis, groupsSummary,
  matches, newGroup, nextId, ruleFresh, saveRule, seatsLeft, store, todayLabel,
} from './bomAdminData';
import { BomConditionBuilder } from './BomConditionBuilder';
import {
  BomDrawer, BomPageHead, BomSwitch, ConfirmButton, Kpi, StatusPill, inputCls, priBtnCls, secBtnCls,
} from './BomAdminBits';

/* BOM Licensing — the allowlist that gates everything downstream. BOM is licensed per CI:
 * nothing is scanned, scheduled or retained until a CI is enrolled here, and every enrolled CI
 * consumes one seat. Two ways in: enrol by hand, or an auto-enrol rule that keeps sweeping in
 * matching CIs as they are discovered. */

export function BomLicensingPage({ onBack }: { onBack: () => void }) {
  const [, refresh] = useReducer((x: number) => x + 1, 0);
  const [query, setQuery] = useState('');
  const [picker, setPicker] = useState(false);
  const [ruleDraft, setRuleDraft] = useState<AutoRule | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  const enrolled = enrolledCis();
  const left = seatsLeft();
  const online = enrolled.filter((c) => c.agentOnline).length;

  const q = query.trim().toLowerCase();
  const visible = enrolled.filter((c) =>
    !q || [c.id, c.host, c.type, c.os, c.ip].join(' ').toLowerCase().includes(q));

  const openRule = (r: AutoRule | null) =>
    setRuleDraft(r
      ? { ...r, groups: r.groups.map((g) => ({ join: g.join, conds: g.conds.map((c) => ({ ...c })) })) }
      // The builder is part of the drawer, so a new rule starts with a group ready to edit —
      // there is no "build conditions" step to click through.
      : { id: nextId('AR', store.rules), name: '', on: true, groups: [newGroup()], updated: todayLabel() });

  return (
    <div className="mx-auto max-w-[1400px] px-8 py-6">
      <BomPageHead
        title="BOM Licensing"
        sub="Enrol CIs to generate SBOM, CBOM and AI BOM. Each enrolled CI — whether agent-scanned or manually ingested — consumes one license seat."
        onBack={onBack}
        actions={
          <>
            <button onClick={() => openRule(null)} className={secBtnCls}><Plus size={15} /> New rule</button>
            <button onClick={() => setPicker(true)} className={priBtnCls} disabled={left <= 0}><Plus size={15} /> Enrol CIs</button>
          </>
        }
      />

      {/* Seat KPIs — the number that gates everything states its own remainder. */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Seats purchased" value={BOM_SEATS} />
        <Kpi label="Seats consumed" value={enrolled.length} sub={`${store.rules.filter((r) => r.on).length} active rule${store.rules.filter((r) => r.on).length === 1 ? '' : 's'}`} />
        <Kpi label="Seats available" value={left} tone={left <= 0 ? 'danger' : left <= 3 ? 'warn' : undefined}
             sub={left <= 0 ? 'Free seats or buy more to enrol' : undefined} />
        <Kpi label="Agents online" value={online} sub={`of ${enrolled.length} enrolled`} />
      </div>

      {/* Auto-enrol rules — the policies; the CI list below is their result. */}
      <div className="mt-5 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
        <div className="border-b border-[#F0F2F5] px-4 py-3">
          <span className="text-[14px] font-semibold text-[#364658]">Auto-enrol rules</span>
          <span className="ml-2 text-[12px] text-[#7B8FA5]">decide enrolment automatically — now, and as new CIs are discovered</span>
        </div>
        {store.rules.length === 0 && (
          <div className="px-4 py-8 text-center text-[13px] text-[#7B8FA5]">
            No rules yet. Create one to enrol matching CIs automatically.
          </div>
        )}
        {store.rules.map((r) => {
          const hit = matches(r.groups);
          const fresh = ruleFresh(r);
          return (
            <div key={r.id} className="flex items-center gap-3 border-b border-[#F0F2F5] px-4 py-3 last:border-b-0">
              <BomSwitch on={r.on} label={`${r.name} enabled`} onClick={() => {
                r.on = !r.on;
                r.updated = todayLabel();
                if (r.on) {
                  const n = enrol(fresh.map((c) => c.id), { by: 'Auto', ruleId: r.id });
                  toast.success(`"${r.name}" enabled — ${n} CI${n === 1 ? '' : 's'} enrolled`);
                } else {
                  // Disabling never reclaims seats — already-enrolled CIs stay enrolled.
                  toast(`"${r.name}" disabled — enrolled CIs keep their seats`);
                }
                refresh();
              }} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-medium text-[#364658]">{r.name}</span>
                  <StatusPill on={r.on} />
                </div>
                <div className="mt-0.5 truncate text-[12px] text-[#7B8FA5]" title={groupsSummary(r.groups)}>
                  {groupsSummary(r.groups) || 'No conditions'}
                </div>
              </div>
              <span className="flex-shrink-0 text-[12px] text-[#7B8FA5]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {hit.length} matching · {hit.length - fresh.length} enrolled
              </span>
              <button onClick={() => openRule(r)} className="rounded px-2 py-1 text-[12px] font-medium text-[#3D8BD0] hover:bg-[#EBF5FF]">Edit</button>
              <ConfirmButton
                armed={confirm === r.id}
                onArm={() => setConfirm(r.id)}
                onCancel={() => setConfirm(null)}
                confirmText="Delete rule"
                onConfirm={() => {
                  deleteRule(r.id); setConfirm(null); refresh();
                  toast(`Deleted "${r.name}" — the CIs it enrolled keep their seats`);
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Enrolled CIs */}
      <div className="mt-4 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
        <div className="flex items-center gap-3 border-b border-[#F0F2F5] px-4 py-3">
          <span className="text-[14px] font-semibold text-[#364658]">Enrolled CIs</span>
          <span className="text-[12px] text-[#7B8FA5]">{enrolled.length} of {ALL_CIS.length} discovered</span>
          <div className="relative ml-auto w-[260px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" size={14} />
            <input
              value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search enrolled CIs..." className={`${inputCls} h-8 w-full pl-8`}
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#364658]"><X size={14} /></button>
            )}
          </div>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[#F0F2F5] text-[12px] font-semibold text-[#364658]">
              <th className="px-4 py-2.5">CI ID</th><th className="px-3 py-2.5">Host name</th>
              <th className="px-3 py-2.5">CI type</th><th className="px-3 py-2.5">OS</th>
              <th className="px-3 py-2.5">Origin</th><th className="px-3 py-2.5">Enrolled by</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {visible.map((c) => {
              const info = store.enrolled.get(c.id)!;
              const rule = info.ruleId ? store.rules.find((r) => r.id === info.ruleId) : null;
              return (
                <tr key={c.id} className="border-b border-[#F0F2F5] text-[13px] text-[#364658] last:border-b-0 hover:bg-[#F9FAFB]">
                  <td className="px-4 py-2.5"><span className="font-mono text-[12px] text-[#3D8BD0]">{c.id}</span></td>
                  <td className="px-3 py-2.5">{c.host}<div className="font-mono text-[11px] text-[#9CA3AF]">{c.ip}</div></td>
                  <td className="px-3 py-2.5 text-[#7B8FA5]">{c.type}</td>
                  <td className="px-3 py-2.5 text-[#7B8FA5]">{c.os}</td>
                  <td className="px-3 py-2.5 text-[#7B8FA5]">{c.origin}</td>
                  <td className="px-3 py-2.5 text-[12px] text-[#7B8FA5]">{rule ? `Rule · ${rule.name}` : 'Manual'}</td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      onClick={() => { store.enrolled.delete(c.id); refresh(); toast(`${c.id} removed — seat freed`); }}
                      className="rounded px-2 py-1 text-[12px] text-[#7B8FA5] transition-colors hover:bg-[#FEF3F2] hover:text-[#DC2626]"
                    >Remove</button>
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-[13px] text-[#7B8FA5]">
                {enrolled.length === 0 ? 'No CIs enrolled yet — nothing downstream is scanned until one is.' : `Nothing matches “${query}”.`}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {picker && <EnrolPicker onClose={() => { setPicker(false); refresh(); }} />}
      {ruleDraft && (
        <RuleDrawer
          draft={ruleDraft}
          onChange={setRuleDraft}
          onClose={() => setRuleDraft(null)}
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

/* The Auto-enrol Rule drawer — one straight read: name → enabled → the condition builder
 * itself → a compact live preview. Every rule needs conditions, so the builder is visible
 * from the first frame; there is nothing to click through to reach it. */
function RuleDrawer({ draft, onChange, onClose, onSave }: {
  draft: AutoRule; onChange: (r: AutoRule) => void; onClose: () => void; onSave: () => void;
}) {
  const [err, setErr] = useState(false);
  const hit = useMemo(() => matches(draft.groups), [draft.groups]);
  const freshReal = hit.filter((c) => !store.enrolled.has(c.id));
  const would = draft.on ? freshReal.length : 0;
  const left = seatsLeft();
  const after = left - would;
  const over = would - left;

  return (
    <BomDrawer
      width={640}
      title={store.rules.some((r) => r.id === draft.id) ? 'Edit auto-enrol rule' : 'New auto-enrol rule'}
      sub="Enrol matching CIs automatically, and keep enrolling them as new CIs are discovered."
      onClose={onClose}
      footer={
        <>
          <span className="mr-auto text-[12px] text-[#7B8FA5]">
            {draft.on
              ? `${freshReal.length} CI${freshReal.length === 1 ? '' : 's'} would be enrolled on save`
              : 'Rule is disabled — nothing changes'}
          </span>
          <button onClick={onClose} className={secBtnCls}>Cancel</button>
          <button
            className={priBtnCls}
            disabled={over > 0}
            onClick={() => {
              if (!draft.name.trim()) { setErr(true); return; }
              onSave();
            }}
          >{store.rules.some((r) => r.id === draft.id) ? 'Save changes' : 'Create rule'}</button>
        </>
      }
    >
      <label className="mb-1 block text-[12px] font-medium text-[#364658]">
        Rule name <span className="text-[#DC2626]">*</span>
      </label>
      <input
        autoFocus type="text" value={draft.name} placeholder="e.g. All laptops"
        onChange={(e) => { onChange({ ...draft, name: e.target.value }); if (e.target.value.trim()) setErr(false); }}
        className={`${inputCls} w-full ${err && !draft.name.trim() ? 'border-[#DC2626] ring-1 ring-[#DC2626]' : ''}`}
      />
      {err && !draft.name.trim() && (
        <p className="mt-1 text-[12px] text-[#DC2626]">Give the rule a name so it can be recognised later.</p>
      )}

      <div className={`mt-4 flex items-start gap-3 rounded-lg border px-3.5 py-3 ${draft.on ? 'border-[#BFDBF7] bg-[#F0F7FD]' : 'border-[#E5E7EB] bg-[#FBFCFD]'}`}>
        <div className="pt-0.5"><BomSwitch on={draft.on} label="Rule status" onClick={() => onChange({ ...draft, on: !draft.on })} /></div>
        <div>
          <div className="text-[13px] font-medium text-[#364658]">Rule is {draft.on ? 'enabled' : 'disabled'}</div>
          <div className="mt-0.5 text-[12px] leading-[1.5] text-[#7B8FA5]">
            {draft.on
              ? 'Every discovered CI matching the conditions below is enrolled and consumes a seat.'
              : 'Conditions are kept, but nothing is enrolled by this rule.'}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1.5 text-[12px] font-medium text-[#364658]">
          Conditions <span className="font-normal text-[#9CA3AF]">· all must match within a group · any group matching is enough</span>
        </div>
        <BomConditionBuilder groups={draft.groups} onChange={(groups) => onChange({ ...draft, groups })} />
      </div>

      {/* Compact live preview — what matches, what that enrols, what it leaves in the pool. */}
      <div className="mt-4 rounded-lg border border-[#E5E7EB] bg-white">
        <div className="border-b border-[#F0F2F5] bg-[#F0F7FD] px-3.5 py-2 text-[12px] text-[#364658]">
          {hit.length
            ? <>Rule preview — <b>{hit.length}</b> of {ALL_CIS.length} discovered CI{hit.length === 1 ? '' : 's'} match</>
            : <>Rule preview</>}
        </div>
        {hit.length ? (
          <div className="text-[13px]">
            <div className="flex items-center justify-between border-b border-[#F0F2F5] px-3.5 py-2 text-[#7B8FA5]">
              <span>Will be newly enrolled</span><b className="text-[#364658]">{would}</b>
            </div>
            <div className="flex items-center justify-between border-b border-[#F0F2F5] px-3.5 py-2 text-[#7B8FA5]">
              <span>Already enrolled</span><b className="text-[#364658]">{hit.length - freshReal.length}</b>
            </div>
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
            {draft.on
              ? 'Future matching CIs will be enrolled automatically as they are discovered.'
              : 'Rule is disabled — conditions are kept, nothing is enrolled.'}
          </div>
        )}
      </div>
    </BomDrawer>
  );
}

/* Enrol by hand — the unenrolled pool with a live seat bar. Over the limit, Add disables and
 * says why, rather than failing after the fact. */
function EnrolPicker({ onClose }: { onClose: () => void }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const pool = ALL_CIS.filter((c) => !store.enrolled.has(c.id));
  const query = q.trim().toLowerCase();
  const list = pool.filter((c) => !query || [c.id, c.host, c.type, c.ip].join(' ').toLowerCase().includes(query));
  const left = seatsLeft() - sel.size;
  const over = left < 0;

  return (
    <BomDrawer
      width={720}
      title="Enrol CIs"
      sub={`${pool.length} discovered CIs are not enrolled — each enrolment consumes one seat`}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className={secBtnCls}>Cancel</button>
          <button
            className={priBtnCls} disabled={sel.size === 0 || over}
            onClick={() => {
              const n = enrol([...sel], { by: 'Manual' });
              toast.success(`${n} CI${n === 1 ? '' : 's'} enrolled — ${seatsLeft()} seat${seatsLeft() === 1 ? '' : 's'} left`);
              onClose();
            }}
          >Enrol {sel.size} CI{sel.size === 1 ? '' : 's'}</button>
        </>
      }
    >
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" size={14} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by CI ID, name, type or IP..."
               className={`${inputCls} w-full pl-8`} />
      </div>

      <div className={`mb-3 rounded-lg border px-3.5 py-2.5 text-[12px] ${over ? 'border-[#FECDCA] bg-[#FEF3F2] text-[#DC2626]' : 'border-[#E5E7EB] bg-[#F9FAFB] text-[#7B8FA5]'}`}>
        {over
          ? <><b>Over limit by {Math.abs(left)}.</b> Deselect {Math.abs(left)} CI{Math.abs(left) === 1 ? '' : 's'} or free up seats before enrolling.</>
          : <><b className="text-[#364658]">{left}</b> seat{left === 1 ? '' : 's'} would remain after enrolling {sel.size} CI{sel.size === 1 ? '' : 's'}.</>}
      </div>

      <div className="overflow-hidden rounded-lg border border-[#E5E7EB]">
        {list.map((c) => {
          const on = sel.has(c.id);
          return (
            <label key={c.id} className={`flex cursor-pointer items-center gap-3 border-b border-[#F0F2F5] px-3.5 py-2.5 text-[13px] last:border-b-0 ${on ? 'bg-[#F0F7FD]' : 'hover:bg-[#F9FAFB]'}`}>
              <input
                type="checkbox" checked={on}
                onChange={() => setSel((prev) => { const next = new Set(prev); on ? next.delete(c.id) : next.add(c.id); return next; })}
                className="size-4 accent-[#3D8BD0]"
              />
              <span className="w-16 font-mono text-[12px] text-[#3D8BD0]">{c.id}</span>
              <span className="min-w-0 flex-1 truncate text-[#364658]">{c.host}</span>
              <span className="text-[12px] text-[#7B8FA5]">{c.type}</span>
              <span className="w-28 text-right font-mono text-[11px] text-[#9CA3AF]">{c.ip}</span>
            </label>
          );
        })}
        {list.length === 0 && (
          <div className="px-4 py-8 text-center text-[13px] text-[#7B8FA5]">
            {pool.length === 0 ? 'Every discovered CI is already enrolled.' : `No CI matches “${q}”.`}
          </div>
        )}
      </div>
    </BomDrawer>
  );
}
