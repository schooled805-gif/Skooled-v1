import React from 'react';
import { usePhase } from '@/contexts/PhaseContext';
import { phaseLabel } from '@/lib/phases';

/** Per-phase tab strip. Renders nothing unless the school spans >1 phase. */
export function PhaseTabs() {
  const { phases, multiPhase, activePhase, setActivePhase } = usePhase();
  if (!multiPhase) return null;
  return (
    <div className="flex gap-1 border-b border-gray-200 overflow-x-auto" data-testid="phase-tabs">
      {phases.map(phase => {
        const active = phase === activePhase;
        return (
          <button
            key={phase}
            onClick={() => setActivePhase(phase)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
              active
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            data-testid={`phase-tab-${phase}`}
          >
            {phaseLabel(phase)}
          </button>
        );
      })}
    </div>
  );
}
