/* BOM Management (Admin) — data + engine.
 *
 * The admin trio decides what the BOM module is allowed to do: Licensing enrols CIs (a seat
 * each — nothing downstream sees an unenrolled CI), Scheduler decides when enrolled CIs are
 * scanned, Retention decides how long their versions live. One CI pool feeds all three,
 * derived deterministically from mockEndpoints so Admin and the Endpoints list can never
 * disagree about what exists.
 */

import { mockEndpoints } from './EndpointsListPage';

/** Stable string hash — keeps derived data identical across renders (same as bomData). */
const hash = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};

// ---------------------------------------------------------------------------
// The CI pool
// ---------------------------------------------------------------------------

export interface Ci {
  id: string;
  host: string;
  ip: string;
  os: string;
  type: 'Laptop' | 'Desktop' | 'Workstation' | 'Virtual Machine';
  status: 'Active' | 'Inactive';
  /** Agent = scanned by the endpoint agent; Manual = BOM pushed by hand (no agent). */
  origin: 'Agent' | 'Manual';
  agentOnline: boolean;
  /** Last-seen label, derived deterministically. */
  seen: string;
}

const typeOf = (hostName: string, id: string): Ci['type'] => {
  if (/-LT|LT-/.test(hostName)) return 'Laptop';
  if (/^DESKTOP/i.test(hostName)) return 'Desktop';
  return (['Workstation', 'Virtual Machine', 'Desktop'] as const)[hash(id) % 3];
};

export const ALL_CIS: Ci[] = mockEndpoints.map((e) => ({
  id: e.id,
  host: e.hostName,
  ip: e.ipAddress,
  os: e.osName.replace('Microsoft ', ''),
  type: typeOf(e.hostName, e.id),
  status: e.agentOnline ? 'Active' : 'Inactive',
  origin: hash(e.id) % 5 === 0 ? 'Manual' : 'Agent',
  agentOnline: e.agentOnline,
  seen: e.agentOnline ? ['Today', 'Today', 'Yesterday'][hash(e.id) % 3] : ['3 days ago', '8 days ago', '21 days ago'][hash(e.id) % 3],
}));

// ---------------------------------------------------------------------------
// Conditions — the one targeting vocabulary Licensing rules and Retention
// overrides share, so "which CIs does this hit" reads identically everywhere.
// ---------------------------------------------------------------------------

export type CondOp = 'Equals' | 'Not Equals' | 'Starts With' | 'Contains';
export const COND_OPS: CondOp[] = ['Equals', 'Not Equals', 'Starts With', 'Contains'];

export interface Cond { field: string; op: CondOp | ''; value: string }
export interface CondGroup { join: 'And' | 'Or'; conds: Cond[] }

const uniq = (xs: string[]) => [...new Set(xs)].sort();

export const COND_FIELDS: { id: keyof Ci; label: string; opts?: string[] }[] = [
  { id: 'type', label: 'CI Type', opts: uniq(ALL_CIS.map((c) => c.type)) },
  { id: 'status', label: 'Status', opts: ['Active', 'Inactive'] },
  { id: 'origin', label: 'Origin', opts: ['Agent', 'Manual'] },
  { id: 'os', label: 'OS Name', opts: uniq(ALL_CIS.map((c) => c.os)) },
  { id: 'host', label: 'Host Name' },
  { id: 'ip', label: 'IP Address' },
];

export const fieldOf = (id: string) => COND_FIELDS.find((f) => f.id === id) ?? null;
/** Equals / Not Equals pick from the field's values; the substring ops take free text. */
export const isPickOp = (op: string) => op === 'Equals' || op === 'Not Equals';

/** A condition counts only when field, operator AND value are all set. Half-written
 *  conditions match nothing — a rule mid-edit must never sweep in the whole estate. */
export const condDone = (c: Cond) => !!(c.field && c.op && c.value.trim());

const condMatch = (c: Cond, ci: Ci): boolean => {
  const v = String(ci[c.field as keyof Ci] ?? '').toLowerCase();
  const t = c.value.trim().toLowerCase();
  switch (c.op) {
    case 'Equals': return v === t;
    case 'Not Equals': return v !== t;
    case 'Starts With': return v.startsWith(t);
    case 'Contains': return v.includes(t);
    default: return false;
  }
};

/** AND within a group; a group with no complete condition matches nothing. */
const groupMatch = (g: CondGroup, ci: Ci): boolean => {
  const cs = g.conds.filter(condDone);
  return cs.length > 0 && cs.every((c) => condMatch(c, ci));
};

/** Between groups the join is per-pair, folded left with no precedence. */
export const matches = (groups: CondGroup[], pool: Ci[] = ALL_CIS): Ci[] => {
  const gs = groups.filter((g) => g.conds.some(condDone));
  if (!gs.length) return [];
  return pool.filter((ci) => {
    let acc = groupMatch(gs[0], ci);
    for (let i = 1; i < gs.length; i++) {
      const m = groupMatch(gs[i], ci);
      acc = gs[i].join === 'Or' ? acc || m : acc && m;
    }
    return acc;
  });
};

const OP_PHRASE: Record<string, string> = {
  Equals: 'is', 'Not Equals': 'is not', 'Starts With': 'starts with', Contains: 'contains',
};

/** The rule in words, for lists — if you must open a drawer to learn what a policy does,
 *  the drawer has become the management screen. */
export const groupsSummary = (groups: CondGroup[]): string => {
  const gs = groups.filter((g) => g.conds.some(condDone));
  const one = (g: CondGroup) =>
    g.conds.filter(condDone).map((c) => `${fieldOf(c.field)?.label} ${OP_PHRASE[c.op]} ${c.value}`).join(' and ');
  if (!gs.length) return '';
  return gs.map((g, i) => (i ? ` ${g.join.toLowerCase()} ` : '') + (gs.length > 1 ? `(${one(g)})` : one(g))).join('');
};

export const newCond = (): Cond => ({ field: '', op: '', value: '' });
export const newGroup = (): CondGroup => ({ join: 'And', conds: [newCond()] });
const cloneGroups = (gs: CondGroup[]): CondGroup[] =>
  gs.map((g) => ({ join: g.join, conds: g.conds.map((c) => ({ ...c })) }));

// ---------------------------------------------------------------------------
// The store — session state shared by the three screens. Module-level so the
// causal chain holds while navigating: enrol in Licensing, and Scheduler and
// Retention immediately see it. A page mutates through these helpers and
// re-renders itself; nothing here persists past a reload (fixture-scale).
// ---------------------------------------------------------------------------

export const BOM_SEATS = 25;

export interface EnrolInfo { by: 'Manual' | 'Auto'; ruleId?: string }
export interface AutoRule { id: string; name: string; on: boolean; groups: CondGroup[]; updated: string }
export interface SchedulePolicy {
  id: string; name: string; on: boolean;
  /** Conditions kept but inactive when false. */
  auto: boolean;
  kind: 'Recurring' | 'One Time';
  freq: 'Daily' | 'Weekly' | 'Monthly';
  /** Weekly — which days run. */
  days: string[];
  /** Monthly — day of month (1–28). */
  monthDay: number;
  /** One Time — ISO date ("YYYY-MM-DD"); null until picked. */
  startAt: string | null;
  time: string;
  /** Hand-picked CIs — pinned, never grow. */
  manual: string[];
  /** Condition-matched CIs — live, grow as matching CIs are enrolled. */
  groups: CondGroup[];
}
export interface RetentionOverride {
  id: string; name: string; on: boolean;
  /** Conditions can be switched off while being kept — groups stay, nothing matches. */
  auto: boolean;
  /** Hand-picked CIs — pinned, never grow. */
  manual: string[];
  /** Condition-matched CIs — live, grow as matching CIs are enrolled. */
  groups: CondGroup[];
  keep: string; period: string;
}

export const KEEP_OPTIONS = ['3 versions', '5 versions', '10 versions', '20 versions', 'All versions'];
export const PERIOD_OPTIONS = ['30 days', '90 days', '180 days', '1 year', 'Forever'];

export const todayLabel = () => {
  const d = new Date();
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

interface BomAdminStore {
  enrolled: Map<string, EnrolInfo>;
  rules: AutoRule[];
  schedules: SchedulePolicy[];
  retention: { keep: string; period: string; overrides: RetentionOverride[] };
}

const seed = (): BomAdminStore => {
  const s: BomAdminStore = {
    enrolled: new Map(),
    rules: [{
      id: 'AR-1', name: 'All laptops', on: true, updated: todayLabel(),
      groups: [{ join: 'And', conds: [{ field: 'type', op: 'Equals', value: 'Laptop' }] }],
    }],
    schedules: [{
      id: 'BS-1', name: 'Laptop nightly SBOM', on: true, auto: true, kind: 'Recurring', freq: 'Daily',
      days: [], monthDay: 1, startAt: null, time: '02:00', manual: [],
      groups: [{ join: 'And', conds: [{ field: 'type', op: 'Equals', value: 'Laptop' }] }],
    }],
    retention: {
      keep: '10 versions', period: '90 days',
      overrides: [{
        id: 'RR-1', name: 'Windows 10 — short retention', on: true, auto: true, manual: [],
        keep: '5 versions', period: '30 days',
        groups: [{ join: 'And', conds: [{ field: 'os', op: 'Contains', value: 'Windows 10' }] }],
      }],
    },
  };
  // A few hand-enrolled CIs, then the seed rule sweeps in what it matches, within seats.
  ['EP-408', 'EP-397', 'EP-392', 'EP-396'].forEach((id) => s.enrolled.set(id, { by: 'Manual' }));
  const room = BOM_SEATS - s.enrolled.size;
  matches(s.rules[0].groups).filter((c) => !s.enrolled.has(c.id)).slice(0, Math.max(0, room))
    .forEach((c) => s.enrolled.set(c.id, { by: 'Auto', ruleId: 'AR-1' }));
  return s;
};

export const store: BomAdminStore = seed();

export const ciOf = (id: string) => ALL_CIS.find((c) => c.id === id);
export const enrolledCis = (): Ci[] => ALL_CIS.filter((c) => store.enrolled.has(c.id));
export const seatsLeft = () => BOM_SEATS - store.enrolled.size;
/** CIs an active rule matches that are not enrolled yet — what enabling/saving would add. */
export const ruleFresh = (r: AutoRule): Ci[] => matches(r.groups).filter((c) => !store.enrolled.has(c.id));

export const nextId = (prefix: string, xs: { id: string }[]) =>
  `${prefix}-${xs.reduce((m, x) => Math.max(m, +(x.id.split('-')[1] || 0)), 0) + 1}`;

/** Which ENROLLED CIs a retention override resolves to — manual picks stay pinned
 *  (dropped silently if the CI loses its seat), condition matches stay live. */
export const overrideTargets = (o: RetentionOverride): Ci[] => {
  const pool = enrolledCis();
  const ids = new Set(o.manual.filter((id) => pool.some((c) => c.id === id)));
  if (o.auto) matches(o.groups, pool).forEach((c) => ids.add(c.id));
  return pool.filter((c) => ids.has(c.id));
};

/** Which ENROLLED CIs a schedule policy resolves to — same manual-plus-conditions
 *  combinator retention overrides use; only licensed CIs can be targeted. */
export const policyTargets = (p: SchedulePolicy): Ci[] => {
  const pool = enrolledCis();
  const ids = new Set(p.manual.filter((id) => pool.some((c) => c.id === id)));
  if (p.auto) matches(p.groups, pool).forEach((c) => ids.add(c.id));
  return pool.filter((c) => ids.has(c.id));
};

/** Enrol within the seat cap; returns how many actually got a seat. */
export const enrol = (ids: string[], info: EnrolInfo): number => {
  const room = Math.max(0, seatsLeft());
  const take = ids.filter((id) => !store.enrolled.has(id)).slice(0, room);
  take.forEach((id) => store.enrolled.set(id, { ...info }));
  return take.length;
};

/** Removing a rule never silently reclaims seats — its CIs stay enrolled, just unmanaged. */
export const deleteRule = (id: string) => {
  store.enrolled.forEach((info, ciId) => {
    if (info.ruleId === id) store.enrolled.set(ciId, { by: 'Manual' });
  });
  store.rules = store.rules.filter((r) => r.id !== id);
};

export const saveRule = (r: AutoRule) => {
  r.groups = cloneGroups(r.groups.filter((g) => g.conds.some(condDone)))
    .map((g) => ({ join: g.join, conds: g.conds.filter(condDone) }));
  const existing = store.rules.some((x) => x.id === r.id);
  store.rules = existing ? store.rules.map((x) => (x.id === r.id ? r : x)) : [...store.rules, r];
  if (r.on) enrol(matches(r.groups).map((c) => c.id), { by: 'Auto', ruleId: r.id });
};
