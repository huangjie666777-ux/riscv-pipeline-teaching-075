import { Instruction, Program } from '../assembler/types';
import { detectLoadUse, forwardValue, readsRs1, readsRs2, resolveForwards } from './hazard';
import { CpuState, CycleLog, MemControl, StageCell, StageInstr, WbControl } from './types';

export const MEMORY_SIZE = 4096;

export function initCpu(): CpuState {
  return {
    cycle: 0,
    pc: 0,
    registers: new Int32Array(32),
    memory: new Uint8Array(MEMORY_SIZE),
    ifId: null,
    idEx: null,
    exMem: null,
    memWb: null,
    history: [],
    halted: false,
    draining: false,
    error: null,
    errorLine: null,
  };
}

function cellOf(instrs: Instruction[], instr: Instruction | null | undefined): StageCell | null {
  if (!instr) return null;
  return { index: instrs.indexOf(instr), state: 'normal' };
}

// Five-stage single-issue RV32I pipeline simulator.
// Each call to step() advances all stages simultaneously by one clock cycle.
export class PipelineSimulator {
  readonly program: Program;
  state: CpuState;

  constructor(program: Program, state?: CpuState) {
    this.program = program;
    this.state = state ?? initCpu();
  }

  reset(): void {
    this.state = initCpu();
  }

  step(): CycleLog | null {
    const prev = this.state;
    if (prev.halted) return null;

    const instrs = this.program.instructions;
    const state: CpuState = {
      ...prev,
      cycle: prev.cycle + 1,
      registers: new Int32Array(prev.registers),
      memory: prev.memory.slice(),
      history: prev.history,
    };

    const events: string[] = [];
    const flushed: number[] = [];
    const forwards: CycleLog['forwards'] = [];
    let error: string | null = null;
    let errorLine: number | null = null;

    // ---------- WB: register file writes first, so ID/EX reads see them this cycle ----------
    const wb = prev.memWb;
    if (wb) {
      const value = wb.instr.mnemonic === 'LW' ? wb.loadData
        : wb.instr.mnemonic === 'JAL' ? (wb.pc + 4) | 0
        : wb.alu;
      if (wb.instr.rd !== 0) state.registers[wb.instr.rd] = value;
    }

    // ---------- MEM: data memory access (little endian, 4096 bytes) ----------
    const mem = prev.exMem;
    let nextMemWb: WbControl | null = null;
    if (mem) {
      let loadData = 0;
      const addr = mem.alu >>> 0;
      const isLoad = mem.instr.mnemonic === 'LW';
      const isStore = mem.instr.mnemonic === 'SW';
      if (isLoad || isStore) {
        if (addr + 4 > MEMORY_SIZE) {
          error = `${mem.instr.mnemonic} 地址 0x${addr.toString(16)} 越界（数据内存为 0–${MEMORY_SIZE - 1}）`;
          errorLine = mem.instr.line;
        } else if (addr % 4 !== 0) {
          error = `${mem.instr.mnemonic} 地址 0x${addr.toString(16)} 非 4 字节对齐，流水线暂停报错`;
          errorLine = mem.instr.line;
        } else if (isLoad) {
          loadData = (state.memory[addr] | (state.memory[addr + 1] << 8) |
            (state.memory[addr + 2] << 16) | (state.memory[addr + 3] << 24)) | 0;
        } else {
          const v = mem.storeData >>> 0;
          state.memory[addr] = v & 0xff;
          state.memory[addr + 1] = (v >>> 8) & 0xff;
          state.memory[addr + 2] = (v >>> 16) & 0xff;
          state.memory[addr + 3] = (v >>> 24) & 0xff;
        }
      }
      nextMemWb = { instr: mem.instr, pc: mem.pc, alu: mem.alu, loadData };
    }

    // ---------- EX: forwarding, ALU, branch/jump target resolution ----------
    const ex = prev.idEx;
    let nextExMem: MemControl | null = null;
    let branchTaken = false;
    let branchTarget = 0;
    if (ex) {
      const instr = ex.instr;
      const fw = resolveForwards(instr, { exMem: prev.exMem, memWb: prev.memWb });
      const a = forwardValue(fw.a, readsRs1(instr) ? state.registers[instr.rs1] : 0, prev.exMem, prev.memWb);
      const b = forwardValue(fw.b, readsRs2(instr) && instr.mnemonic !== 'SW' ? state.registers[instr.rs2] : 0, prev.exMem, prev.memWb);
      const storeData = forwardValue(fw.store, instr.mnemonic === 'SW' ? state.registers[instr.rs2] : 0, prev.exMem, prev.memWb);
      if (fw.a !== 'none') forwards.push({ stage: 'EX', dest: 'A', from: fw.a === 'exmem' ? 'EX/MEM' : 'MEM/WB', index: instrs.indexOf(instr) });
      if (fw.b !== 'none') forwards.push({ stage: 'EX', dest: 'B', from: fw.b === 'exmem' ? 'EX/MEM' : 'MEM/WB', index: instrs.indexOf(instr) });
      if (fw.store !== 'none') forwards.push({ stage: 'EX', dest: 'store', from: fw.store === 'exmem' ? 'EX/MEM' : 'MEM/WB', index: instrs.indexOf(instr) });

      let alu = 0;
      switch (instr.mnemonic) {
        case 'ADD': alu = (a + b) | 0; break;
        case 'SUB': alu = (a - b) | 0; break;
        case 'ADDI': alu = (a + instr.imm) | 0; break;
        case 'LW': case 'SW': alu = (a + instr.imm) | 0; break;
        case 'BEQ':
          alu = (a - b) | 0;
          if (a === b) { branchTaken = true; branchTarget = instr.target!; }
          break;
        case 'JAL':
          alu = (ex.pc + 4) | 0;
          branchTaken = true;
          branchTarget = instr.target!;
          break;
      }
      nextExMem = { instr, pc: ex.pc, alu, storeData };
    }

    // ---------- ID: load-use hazard detection ----------
    // LW currently in ID/EX (entering EX) and the instruction in IF/ID reads its non-x0 rd.
    const stall = detectLoadUse(prev.idEx?.instr ?? null, prev.ifId?.instr ?? null);
    if (stall) {
      events.push(`检测到 LW→使用冒险：冻结 PC 与 IF/ID，ID/EX 插入气泡停顿 1 周期（加载值不前递）`);
    }

    // ---------- IF + pipeline register update ----------
    let nextIdEx: StageInstr | null = null;
    let nextIfId: StageInstr | null = null;
    let nextPc = state.pc;
    let draining = prev.draining;
    let ifCell: StageCell | null = null;
    let idCell: StageCell | null = null;

    if (error) {
      state.memWb = nextMemWb;
      state.exMem = nextExMem;
      state.halted = true;
      state.error = error;
      state.errorLine = errorLine;
    } else if (stall) {
      // Hold PC and IF/ID; bubble enters ID/EX; LW itself still advances EX -> MEM.
      nextIdEx = null;
      nextIfId = prev.ifId;
      nextPc = prev.pc;
      ifCell = cellOf(instrs, null);
      idCell = cellOf(instrs, prev.ifId?.instr);
    } else if (branchTaken) {
      // Control resolved in EX: redirect PC and flush the two younger instructions.
      const wrongPath = instrs[state.pc / 4] ?? null; // fetched this cycle along sequential path
      if (prev.ifId) flushed.push(instrs.indexOf(prev.ifId.instr));
      if (wrongPath) flushed.push(instrs.indexOf(wrongPath));
      if (ex) events.push(`${ex.instr.mnemonic} 在 EX 决定跳转至 0x${branchTarget.toString(16)}，冲刷 IF/ID 与本次顺序取指`);
      nextIdEx = null;
      nextIfId = null;
      nextPc = branchTarget;
      idCell = prev.ifId ? { index: instrs.indexOf(prev.ifId.instr), state: 'bubble' } : null;
      ifCell = wrongPath ? { index: instrs.indexOf(wrongPath), state: 'bubble' } : null;
      nextExMem = null; // branch itself leaves the pipeline as a bubble after EX
    } else {
      // Normal advance: ID <- IF/ID, IF <- instruction memory at pc.
      nextIdEx = prev.ifId;
      idCell = cellOf(instrs, prev.ifId?.instr);
      const fetch = instrs[state.pc / 4] ?? null;
      if (fetch) {
        nextIfId = { instr: fetch, pc: state.pc };
        nextPc = (state.pc + 4) | 0;
        ifCell = { index: instrs.indexOf(fetch), state: 'normal' };
      } else {
        // Past the end of the instruction stream: stop fetching, drain in-flight work.
        nextIfId = null;
        nextPc = state.pc;
        draining = true;
      }
    }

    if (!error) {
      state.pc = nextPc;
      state.idEx = nextIdEx;
      state.ifId = nextIfId;
      state.exMem = nextExMem;
      state.memWb = nextMemWb;
      state.draining = draining;
      if (draining && !state.ifId && !state.idEx && !state.exMem && !state.memWb) {
        state.halted = true;
        events.push('流水线排空，程序执行完成');
      }
    }

    const log: CycleLog = {
      cycle: state.cycle,
      stages: {
        IF: ifCell,
        ID: idCell,
        EX: cellOf(instrs, ex?.instr),
        MEM: cellOf(instrs, mem?.instr),
        WB: cellOf(instrs, wb?.instr),
      },
      stall,
      flushed,
      forwards,
      events,
    };
    state.history = [...prev.history, log];
    this.state = state;
    return log;
  }
}
