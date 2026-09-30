import { Instruction } from '../assembler/types';
import { MemControl, WbControl } from './types';

export type Forward = 'none' | 'exmem' | 'memwb';

export function readsRs1(instr: Instruction): boolean {
  return ['ADD', 'SUB', 'ADDI', 'LW', 'SW', 'BEQ'].includes(instr.mnemonic);
}

export function readsRs2(instr: Instruction): boolean {
  return ['ADD', 'SUB', 'BEQ', 'SW'].includes(instr.mnemonic);
}

export function writesReg(instr: Instruction): boolean {
  return ['ADD', 'SUB', 'ADDI', 'LW', 'JAL'].includes(instr.mnemonic);
}

// Detect load-use hazard: LW in EX (idEx latch) and the instruction in ID (ifId) reads its rd.
export function detectLoadUse(lw: Instruction | null, user: Instruction | null): boolean {
  if (!lw || !user || lw.mnemonic !== 'LW' || lw.rd === 0) return false;
  const use1 = readsRs1(user) && user.rs1 === lw.rd;
  const use2 = readsRs2(user) && user.rs2 === lw.rd;
  return use1 || use2;
}

interface FwdSource {
  exMem: MemControl | null;
  memWb: WbControl | null;
}

// EX/MEM result is newer and wins; a LW result in EX/MEM is not yet ready (MEM happens this cycle).
function forwardReg(reg: number, exMem: MemControl | null, memWb: WbControl | null): Forward {
  if (reg === 0) return 'none';
  if (exMem && writesReg(exMem.instr) && exMem.instr.rd === reg && exMem.instr.mnemonic !== 'LW') return 'exmem';
  if (memWb && writesReg(memWb.instr) && memWb.instr.rd === reg) return 'memwb';
  return 'none';
}

export function resolveForwards(
  instr: Instruction,
  sources: FwdSource,
): { a: Forward; b: Forward; store: Forward } {
  const a = readsRs1(instr) ? forwardReg(instr.rs1, sources.exMem, sources.memWb) : 'none';
  const b = readsRs2(instr) && instr.mnemonic !== 'SW' ? forwardReg(instr.rs2, sources.exMem, sources.memWb) : 'none';
  const store = instr.mnemonic === 'SW' ? forwardReg(instr.rs2, sources.exMem, sources.memWb) : 'none';
  return { a, b, store };
}

export function forwardValue(fwd: Forward, regValue: number, exMem: MemControl | null, memWb: WbControl | null): number {
  if (fwd === 'exmem' && exMem) return exMem.alu;
  if (fwd === 'memwb' && memWb) return memWb.instr.mnemonic === 'LW' ? memWb.loadData : memWb.alu;
  return regValue;
}

