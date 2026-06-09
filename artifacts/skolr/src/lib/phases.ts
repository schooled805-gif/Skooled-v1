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
