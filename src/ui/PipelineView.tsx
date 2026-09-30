import { Instruction } from '../assembler/types';
import { CpuState } from '../pipeline/types';

const STAGES = ['IF', 'ID', 'EX', 'MEM', 'WB'] as const;

function hex(n: number): string {
  return '0x' + (n >>> 0).toString(16);
}

function latchText(instr: Instruction | undefined, pc?: number): string {
  if (!instr) return '气泡 / 空闲';
  return '[' + hex(pc ?? instr.address) + '] ' + instr.text;
}

export function PipelineView({ state, instructions }: { state: CpuState; instructions: Instruction[] }) {
  const latches = [
    { name: 'IF/ID', value: latchText(state.ifId?.instr, state.ifId?.pc) },
    { name: 'ID/EX', value: latchText(state.idEx?.instr, state.idEx?.pc) },
    {
      name: 'EX/MEM',
      value: state.exMem
        ? state.exMem.instr.text + '  ALU=' + state.exMem.alu + (state.exMem.instr.mnemonic === 'SW' ? '  mem[' + state.exMem.alu + ']=' + state.exMem.storeData : '')
        : '气泡 / 空闲',
    },
    {
      name: 'MEM/WB',
      value: state.memWb
        ? state.memWb.instr.text + '  ' + (state.memWb.instr.mnemonic === 'LW' ? 'load=' + state.memWb.loadData : 'alu=' + state.memWb.alu)
        : '气泡 / 空闲',
    },
  ];
  void instructions;
  const last = state.history[state.history.length - 1];
  return (
    <section className="panel">
      <div className="panel-head"><h2>流水线寄存器</h2></div>
      <div className="latches">
        {latches.map((l) => (
          <div key={l.name} className="latch">
            <span className="latch-name">{l.name}</span>
            <span className="latch-val">{l.value}</span>
          </div>
        ))}
      </div>
      <div className="stages">
        {STAGES.map((s) => {
          const cell = last?.stages[s];
          const instr = cell ? instructions[cell.index] : null;
          const cls = 'stage ' + (cell?.state === 'bubble' ? 'bubble ' : '') + (cell ? 'busy' : '');
          return (
            <div key={s} className={cls}>
              <div className="stage-name">{s}</div>
              <div className="stage-instr">{instr ? instr.text : '—'}</div>
              {cell?.state === 'bubble' ? <div className="stage-tag">冲刷气泡</div> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
