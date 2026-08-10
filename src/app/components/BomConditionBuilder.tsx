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
    <div>
      {groups.map((g, gi) => (
        <div key={gi}>
          {gi > 0 && (
            <div className="flex justify-center py-1.5">
              <button
                onClick={() => set(groups.map((x, i) => (i === gi ? { ...x, join: x.join === 'And' ? 'Or' : 'And' } : x)))}
                title={`Switch to ${g.join === 'And' ? 'Or' : 'And'}`}
                className="rounded-full border border-[#d1d5db] bg-white px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#3D8BD0] transition-colors hover:border-[#3D8BD0]"
              >{g.join}</button>
            </div>
          )}

          <div className="rounded-lg border border-[#E5E7EB] bg-[#FBFCFD]">
            <div className="flex items-center justify-between border-b border-[#F0F2F5] px-3 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#7B8FA5]">
                Condition group {gi + 1}
              </span>
              {groups.length > 1 && (
                <button
                  onClick={() => set(groups.filter((_, i) => i !== gi))}
                  className="text-[12px] text-[#7B8FA5] transition-colors hover:text-[#DC2626]"
                >Remove group</button>
              )}
            </div>

            <div className="space-y-2 p-3">
              {g.conds.map((c, ri) => {
                const f = fieldOf(c.field);
                const pick = f?.opts && isPickOp(c.op);
                return (
                  <div key={ri} className="flex items-center gap-2">
                    <span className="w-12 flex-shrink-0 text-right text-[12px] text-[#9CA3AF]">
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
                      className="flex size-8 flex-shrink-0 items-center justify-center rounded text-[#9CA3AF] transition-colors hover:bg-[#F3F4F6] hover:text-[#364658]"
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
                      className="flex size-8 flex-shrink-0 items-center justify-center rounded text-[#9CA3AF] transition-colors hover:bg-[#FEF3F2] hover:text-[#DC2626]"
                    ><Trash2 size={14} /></button>
                  </div>
                );
              })}

              <button
                onClick={() => set(groups.map((x, i) => (i === gi ? { ...x, conds: [...x.conds, newCond()] } : x)))}
                className="inline-flex items-center gap-1 text-[12px] font-medium text-[#3D8BD0] hover:underline"
              ><Plus size={13} /> Add condition</button>
            </div>
          </div>
        </div>
      ))}

      <button
        onClick={() => onChange([...groups, newGroup()])}
        className="mt-2.5 inline-flex h-8 items-center gap-1.5 rounded border border-[#d1d5db] bg-white px-3 text-[12px] font-medium text-[#364658] transition-colors hover:border-[#3D8BD0] hover:text-[#3D8BD0]"
      ><Plus size={14} /> Add condition group</button>
    </div>
  );
}
