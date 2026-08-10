import { Plus, Copy, Trash2 } from 'lucide-react';
import {
  Cond, CondGroup, COND_FIELDS, COND_OPS, fieldOf, isPickOp, newCond, newGroup,
} from './bomAdminData';
import { inputCls, selectCls } from './BomAdminBits';

/* The shared condition builder — Licensing auto-enrol rules and Retention overrides target
 * CIs with the exact same control, so "which CIs does this hit" reads identically everywhere.
 * Conditions in a group must all match; a CI matching any group is included. A half-written
 * condition matches nothing (see condDone) — the preview beside this builder makes that
 * visible rather than surprising. */

interface BomConditionBuilderProps {
  groups: CondGroup[];
  onChange: (groups: CondGroup[]) => void;
}

export function BomConditionBuilder({ groups, onChange }: BomConditionBuilderProps) {
  const set = (next: CondGroup[]) => onChange(next);
  const patchCond = (gi: number, ri: number, patch: Partial<Cond>) =>
    set(groups.map((g, i) => i !== gi ? g : {
      ...g,
      conds: g.conds.map((c, j) => (j !== ri ? c : { ...c, ...patch })),
    }));

  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-3.5">
      {groups.map((g, gi) => (
        <div key={gi}>
          {gi > 0 && (
            <div
              className="relative py-[9px] pl-[30px]"
              style={{ backgroundImage: 'linear-gradient(#DFE5ED,#DFE5ED)', backgroundSize: '1px 100%', backgroundPosition: '30px 0', backgroundRepeat: 'no-repeat' }}
            >
              <button
                onClick={() => set(groups.map((x, i) => (i === gi ? { ...x, join: x.join === 'And' ? 'Or' : 'And' } : x)))}
                title={`Switch to ${g.join === 'And' ? 'Or' : 'And'}`}
                className="relative inline-flex items-center gap-[7px] rounded border border-[#DFE5ED] bg-white px-[11px] py-[7px] text-[13px] font-semibold text-[#364658] transition-colors hover:border-[#3D8BD0] hover:text-[#3D8BD0]"
              >{g.join}</button>
            </div>
          )}

          <div className="rounded-lg bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
            <div className="flex items-center justify-between px-3 pb-0 pt-[11px]">
              <span className="text-[11px] font-semibold uppercase tracking-[.05em] text-[#7B8FA5]">
                Condition group {gi + 1}
              </span>
              {groups.length > 1 && (
                <button
                  onClick={() => set(groups.filter((_, i) => i !== gi))}
                  className="rounded px-1.5 py-1 text-[13px] font-semibold text-[#DC2626] transition-colors hover:bg-[#FEF3F2]"
                >Remove group</button>
              )}
            </div>

            <div className="space-y-2 p-3">
              {g.conds.map((c, ri) => {
                const f = fieldOf(c.field);
                const pick = f?.opts && isPickOp(c.op);
                return (
                  <div key={ri} className="flex items-center gap-2">
                    <span className="min-w-[62px] flex-shrink-0 whitespace-nowrap rounded bg-[#EEF2F6] p-2.5 text-center text-[12px] font-semibold text-[#364658]">
                      {ri ? 'And' : 'Where'}
                    </span>
                    <select
                      value={c.field}
                      onChange={(e) => patchCond(gi, ri, { field: e.target.value, value: '' })}
                      className={`${selectCls} flex-1 ${c.field ? '' : 'text-[#9ca3af]'}`}
                    >
                      <option value="" disabled>Choose field</option>
                      {COND_FIELDS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                    </select>
                    <select
                      value={c.op}
                      onChange={(e) => {
                        const op = e.target.value as Cond['op'];
                        // Switching between a pick op and a substring op changes what the value
                        // control is, so a value carried across would be nonsense.
                        patchCond(gi, ri, { op, value: isPickOp(op) !== isPickOp(c.op) ? '' : c.value });
                      }}
                      className={`${selectCls} w-[120px] flex-shrink-0 ${c.op ? '' : 'text-[#9ca3af]'}`}
                    >
                      <option value="" disabled>Choose</option>
                      {COND_OPS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                    {pick ? (
                      <select
                        value={c.value}
                        onChange={(e) => patchCond(gi, ri, { value: e.target.value })}
                        className={`${selectCls} flex-1 ${c.value ? '' : 'text-[#9ca3af]'}`}
                      >
                        <option value="" disabled>Choose value</option>
                        {f!.opts!.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input
                        type="text" value={c.value} placeholder="value"
                        onChange={(e) => patchCond(gi, ri, { value: e.target.value })}
                        className={`${inputCls} flex-1`}
                      />
                    )}
                    <button
                      title="Duplicate condition"
                      onClick={() => set(groups.map((x, i) => i !== gi ? x : { ...x, conds: [...x.conds.slice(0, ri + 1), { ...c }, ...x.conds.slice(ri + 1)] }))}
                      className="flex size-9 flex-shrink-0 items-center justify-center rounded border border-[#DFE5ED] bg-white text-[#7B8FA5] transition-colors hover:bg-[#F5F7FA] hover:text-[#364658]"
                    ><Copy size={14} /></button>
                    <button
                      title="Delete condition"
                      onClick={() => set(groups.map((x, i) => {
                        if (i !== gi) return x;
                        // Removing the last condition leaves the group with an empty row —
                        // groups are removed explicitly, not by attrition.
                        const conds = x.conds.filter((_, j) => j !== ri);
                        return { ...x, conds: conds.length ? conds : [newCond()] };
                      }))}
                      className="flex size-9 flex-shrink-0 items-center justify-center rounded border border-[#DFE5ED] bg-white text-[#DC2626] transition-colors hover:border-[#F3D6D6] hover:bg-[#FEF3F2]"
                    ><Trash2 size={14} /></button>
                  </div>
                );
              })}

              <button
                onClick={() => set(groups.map((x, i) => (i === gi ? { ...x, conds: [...x.conds, newCond()] } : x)))}
                className="inline-flex items-center gap-[7px] rounded px-1.5 py-[5px] text-[13px] font-medium text-[#7B8FA5] transition-colors hover:bg-[#F9FAFB] hover:text-[#364658]"
              ><Plus size={14} /> Add condition</button>
            </div>
          </div>
        </div>
      ))}

      <button
        onClick={() => onChange([...groups, newGroup()])}
        className="mt-3 inline-flex h-8 items-center gap-1.5 rounded border border-[#DFE5ED] bg-white px-3 text-[13px] font-medium text-[#364658] transition-colors hover:bg-[#F5F7FA]"
      ><Plus size={14} /> Add condition group</button>
    </div>
  );
}
