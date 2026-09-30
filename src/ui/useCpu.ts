import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AssemblyError, Program } from '../assembler/types';
import { assemble } from '../assembler/assembler';
import { PipelineSimulator } from '../pipeline/cpu';

export interface LoadedSim {
  program: Program;
  sim: PipelineSimulator;
  error: null;
  errorLine: null;
  dirty: boolean;
  version: number;
}

export interface LoadError {
  program: null;
  sim: null;
  error: string;
  errorLine: number;
  dirty: boolean;
  version: number;
}

export type LoadState = LoadedSim | LoadError;

export function useCpu(initialSource: string) {
  const [source, setSource] = useState(initialSource);
  const [loadState, setLoadState] = useState<LoadState>(() => {
    try {
      const program = assemble(initialSource);
      return { program, sim: new PipelineSimulator(program), error: null, errorLine: null, dirty: false, version: 0 };
    } catch (e) {
      const err = e as AssemblyError;
      return { program: null, sim: null, error: err.message, errorLine: err.line, dirty: false, version: 0 };
    }
  });
  const [, forceRender] = useState(0);
  const [running, setRunning] = useState(false);
  const timer = useRef<number | null>(null);

  const rerender = useCallback(() => forceRender((n) => n + 1), []);

  const editSource = useCallback((next: string) => {
    setSource(next);
    setRunning(false);
    setLoadState((s) => ({ ...s, dirty: true }) as LoadState);
  }, []);

  const load = useCallback(() => {
    try {
      const program = assemble(source);
      setLoadState({ program, sim: new PipelineSimulator(program), error: null, errorLine: null, dirty: false, version: Date.now() });
    } catch (e) {
      const err = e as AssemblyError;
      setLoadState({ program: null, sim: null, error: err.message, errorLine: err.line, dirty: false, version: Date.now() });
    }
    setRunning(false);
  }, [source]);

  const stepOnce = useCallback(() => {
    setLoadState((s) => {
      if (s.sim) s.sim.step();
      return { ...s };
    });
    rerender();
  }, [rerender]);

  const reset = useCallback(() => {
    setRunning(false);
    setLoadState((s) => {
      if (s.sim) s.sim.reset();
      return { ...s };
    });
    rerender();
  }, [rerender]);

  // Auto-run loop: cooperative scheduling via setTimeout keeps the page responsive.
  useEffect(() => {
    if (!running || !loadState.sim) return;
    timer.current = window.setTimeout(() => {
      const sim = loadState.sim!;
      sim.step();
      rerender();
      if (sim.state.halted) setRunning(false);
    }, 300);
    return () => { if (timer.current !== null) window.clearTimeout(timer.current); };
  }, [running, loadState, rerender]);

  const pause = useCallback(() => setRunning(false), []);
  const run = useCallback(() => { if (loadState.sim && !loadState.sim.state.halted) setRunning(true); }, [loadState.sim]);

  return useMemo(() => ({
    source, editSource, loadState, load, stepOnce, reset, running, run, pause,
  }), [source, editSource, loadState, load, stepOnce, reset, running, run, pause]);
}
