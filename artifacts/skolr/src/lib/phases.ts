export const ALLOWED_PHASES = ['nursery', 'pre_primary', 'primary', 'high'] as const;
export type Phase = (typeof ALLOWED_PHASES)[number];

const LABELS: Record<string, string> = {
  nursery: 'Nursery',
  pre_primary: 'Pre-Primary',
  primary: 'Primary',
  high: 'High School',
};

export function phaseLabel(phase: string | null | undefined): string {
  if (!phase) return 'Unassigned';
  return LABELS[phase] ?? phase;
}

export function isPhase(value: unknown): value is Phase {
  return typeof value === 'string' && (ALLOWED_PHASES as readonly string[]).includes(value);
}

export const PHASE_OPTIONS: { value: Phase; label: string }[] = ALLOWED_PHASES.map(p => ({
  value: p,
  label: LABELS[p],
}));

/**
 * A "meal menu" school is one whose phases are exactly nursery + pre_primary
 * (and nothing else). These schools have no tuckshop — instead they manage a
 * daily/weekly meal menu.
 */
export function isMealMenuSchool(phases: string[] | null | undefined): boolean {
  if (!Array.isArray(phases)) return false;
  const set = new Set(phases);
  return set.size === 2 && set.has('nursery') && set.has('pre_primary');
}
