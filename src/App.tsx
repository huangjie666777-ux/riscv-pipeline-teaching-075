import { useCallback, useEffect, useRef, useState } from 'react';
import { assemble, type AsmError } from './sim/assembler';
import { CPU } from './sim/cpu';
import { EXAMPLES } from './sim/examples';
import Editor from './components/Editor';
import Controls from './components/Controls';
import PipelineView from './components/PipelineView';
import Registers from './components/Registers';
import MemoryView from './components/MemoryView';
import Timeline from './components/Timeline';
import EventLog from './components/EventLog';

export default function App() {
  const [source, setSource] = useState(EXAMPLES[0].code);
  const [errors, setErrors] = useState<AsmError[]>([]);
  const [dirty, setDirty] = useState(true);
  const [running, setRunning] = useState(false);
  const [, setTick] = useState(0);
  const cpuRef = useRef<CPU | null>(null);

  const force = () => setTick((t) => t + 1);

  const load = useCallback(() => {
    const r = assemble(source);
    setRunning(false);
    if (!r.ok) {
      setErrors(r.errors);
      cpuRef.current = null;
    } else {
      setErrors([]);
      cpuRef.current = new CPU(r.program);
      setDirty(false);
    }
    force();
  }, [source]);

  const step = useCallback(() => {
    cpuRef.current?.step();
    force();
  }, []);

  const reset = useCallback(() => {
    setRunning(false);
    load();
  }, [load]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const cpu = cpuRef.current;
      if (!cpu || cpu.halted || cpu.error) {
        setRunning(false);
        return;
      }
      cpu.step();
      force();
    }, 400);
    return () => clearInterval(id);
  }, [running]);

  const cpu = cpuRef.current;

  return (
    <main>
      <h1>RISC-V 五级流水线教学模拟器</h1>
      <div className="layout">
        <div className="col">
          <Editor
            source={source}
            errors={errors}
            loaded={dirty}
            onChange={(s) => {
              setSource(s);
              setDirty(true);
            }}
            onLoad={load}
          />
          <Controls
            loaded={cpu !== null && !dirty}
            running={running}
            halted={cpu?.halted ?? false}
            error={cpu?.error ?? null}
            cycle={cpu?.cycle ?? 0}
            onStep={step}
            onRun={() => setRunning(true)}
            onPause={() => setRunning(false)}
            onReset={reset}
          />
          <PipelineView
            stages={cpu?.stageSnapshot() ?? { IF: null, ID: null, EX: null, MEM: null, WB: null }}
            pc={cpu?.pc ?? 0}
          />
          <Registers regs={cpu?.regs ?? new Uint32Array(32)} />
          <MemoryView mem={cpu?.mem ?? new Uint8Array(4096)} />
        </div>
        <div className="col">
          <Timeline rows={cpu?.timeline ?? []} cycles={cpu?.cycle ?? 0} />
          <EventLog log={cpu?.log ?? []} />
        </div>
      </div>
    </main>
  );
}
