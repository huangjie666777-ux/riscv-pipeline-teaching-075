import { Program } from '../assembler/types';
import { CpuState } from '../pipeline/types';

const STAGES = ['IF', 'ID', 'EX', 'MEM', 'WB'] as const;

// One row per instruction occurrence; the same source line repeated in a loop
// gets separate rows keyed by instruction index (fetch occurrence).
export function Timeline({ state, program }: { state: CpuState; program: Program }) {
  const seen = new Set<number>();
  state.history.forEach((log) => {
    STAGES.forEach((s) => {
      const c = log.stages[s];
      if (c) seen.add(c.index);
    });
  });
  const rows = [...seen].sort((a, b) => a - b);
  const stageOf = (index: number, cycle: number): string => {
    const log = state.history.find((l) => l.cycle === cycle);
    if (!log) return '';
    for (const s of STAGES) {
      const c = log.stages[s];
      if (c && c.index === index) return c.state === 'bubble' ? 'bubble' : s;
    }
    // flushed at this cycle
    if (log.flushed.includes(index) && STAGES.some((s) => log.stages[s]?.index === index)) return 'bubble';
    return '';
  };
  const cycleCount = state.history.length;

  return (
    <section className="panel timeline">
      <div className="panel-head"><h2>周期时间表</h2><span className="hint">每行是指令的一次取指（循环重复取指分行显示）</span></div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>指令</th><th>源码行</th>
              {Array.from({ length: Math.max(cycleCount, 1) }, (_, i) => <th key={i + 1}>{i + 1}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((idx) => {
              const instr = program.instructions[idx];
              return (
                <tr key={idx}>
                  <td className="mono">{instr.text}</td>
                  <td>L{instr.line + 1}{instr.occurrence > 0 ? `#${instr.occurrence + 1}` : ''}</td>
                  {Array.from({ length: cycleCount }, (_, i) => {
                    const v = stageOf(idx, i + 1);
                    return <td key={i} className={v ? 'cell ' + v.toLowerCase() : 'cell'}>{v === 'bubble' ? '✕' : v || ''}</td>;
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
