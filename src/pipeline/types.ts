import { Instruction } from '../assembler/types';

export interface StageInstr {
  instr: Instruction;
  pc: number;
}

export interface ExControl {
  instr: Instruction;
  pc: number;
  a: number;
  b: number;
  storeData: number;
  forwardA: 'none' | 'exmem' | 'memwb';
  forwardB: 'none' | 'exmem' | 'memwb';
  forwardStore: 'none' | 'exmem' | 'memwb';
}

export interface MemControl {
  instr: Instruction;
  pc: number;
  alu: number; // signed int32
  storeData: number;
}

export interface WbControl {
  instr: Instruction;
  pc: number;
  alu: number;
  loadData: number;
}

export interface StageCell {
  index: number; // instruction index
  state: 'normal' | 'bubble';
}

export interface CycleLog {
  cycle: number;
  stages: { IF: StageCell | null; ID: StageCell | null; EX: StageCell | null; MEM: StageCell | null; WB: StageCell | null };
  stall: boolean;
  flushed: number[]; // instruction indices whose young-stage effects were cancelled
  forwards: { stage: 'EX'; dest: 'A' | 'B' | 'store'; from: 'EX/MEM' | 'MEM/WB'; index: number }[];
  events: string[];
}

export interface CpuState {
  cycle: number;
  pc: number;
  registers: Int32Array;
  memory: Uint8Array;
  ifId: StageInstr | null;
  idEx: StageInstr | null; // raw decoded instruction entering EX (operands read in EX via forwarding)
  exMem: MemControl | null;
  memWb: WbControl | null;
  history: CycleLog[];
  halted: boolean;
  draining: boolean;
  error: string | null;
  errorLine: number | null;
}
