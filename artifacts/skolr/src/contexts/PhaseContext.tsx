import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { isPhase } from '@/lib/phases';

interface PhaseContextType {
  /** The school's selected phases, normalized to known values. */
  phases: string[];
  /** True only when the school spans more than one phase (so areas are tabbed). */
  multiPhase: boolean;
  /** The currently-selected phase tab. Null when the school is not multi-phase. */
  activePhase: string | null;
  setActivePhase: (phase: string) => void;
}

const PhaseContext = createContext<PhaseContextType>({
  phases: [],
  multiPhase: false,
  activePhase: null,
  setActivePhase: () => {},
});

const storageKey = (schoolId: string) => `skolr:activePhase:${schoolId}`;

export const PhaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { school, schoolId } = useAuth();

  const phases = useMemo(
    () => ((school?.phases ?? []) as string[]).filter(isPhase),
    [school?.phases],
  );

  const multiPhase = phases.length > 1;

  const [activePhase, setActivePhaseState] = useState<string | null>(null);

  // Initialize / normalize the active phase whenever the school or its phases change.
  useEffect(() => {
    if (!multiPhase) {
      setActivePhaseState(null);
      return;
    }
    let initial: string | null = null;
    if (schoolId) {
      const stored = localStorage.getItem(storageKey(schoolId));
      if (stored && (phases as string[]).includes(stored)) initial = stored;
    }
    setActivePhaseState(initial ?? phases[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, multiPhase, phases.join(',')]);

  const setActivePhase = (phase: string) => {
    setActivePhaseState(phase);
    if (schoolId) localStorage.setItem(storageKey(schoolId), phase);
  };

  return (
    <PhaseContext.Provider value={{ phases, multiPhase, activePhase, setActivePhase }}>
      {children}
    </PhaseContext.Provider>
  );
};

export const usePhase = () => useContext(PhaseContext);
