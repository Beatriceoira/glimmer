export type State = { name: string; vars: Record<string, number>; flags: string[] };
const OP = /^(>=|<=|==|!=|>|<)\s*(-?\d+(?:\.\d+)?)$/;

/** required_state example: {"courage": ">= 3", "trust": 2, "flags": ["lantern"], "not_flags": ["betrayed"]} */
export function unmet(req: any, st: State): string | null {
  for (const [k, v] of Object.entries(req || {})) {
    if (k === 'flags') { const miss = (v as string[]).find((f) => !st.flags.includes(f)); if (miss) return `Needs: ${miss.replace(/_/g, ' ')}`; continue; }
    if (k === 'not_flags') { const has = (v as string[]).find((f) => st.flags.includes(f)); if (has) return 'No longer available'; continue; }
    const cur = st.vars[k] ?? 0;
    const m: any = typeof v === 'number' ? ['', '==', String(v)] : OP.exec(String(v).trim());
    if (!m) return 'Unavailable';
    const n = Number(m[2]);
    const ok = ({ '>=': cur >= n, '<=': cur <= n, '>': cur > n, '<': cur < n, '==': cur === n, '!=': cur !== n } as any)[m[1]];
    if (!ok) return `Needs ${k} ${m[1]} ${n}`;
  }
  return null;
}
export const meets = (req: any, st: State) => unmet(req, st) === null;

/** effects example: {"courage": 2, "trust": -1, "flags_add": ["lantern"], "flags_remove": []} */
export function apply(fx: any, st: State) {
  for (const [k, v] of Object.entries(fx || {})) {
    if (k === 'flags_add') for (const f of v as string[]) { if (!st.flags.includes(f)) st.flags.push(f); }
    else if (k === 'flags_remove') st.flags = st.flags.filter((f) => !(v as string[]).includes(f));
    else if (typeof v === 'number') st.vars[k] = (st.vars[k] ?? 0) + v;
  }
}
export const fill = (text: string, st: State) =>
  text.replace(/\{(\w+)\}/g, (m, k) => (k === 'MC_Name' ? st.name : k in st.vars ? String(st.vars[k]) : m));
