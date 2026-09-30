export type Mnemonic = 'ADD' | 'SUB' | 'ADDI' | 'LW' | 'SW' | 'BEQ' | 'JAL';

export interface AsmError {
  line: number; // 0-based source line
  message: string;
}

export class AssemblyError extends Error {
  constructor(public readonly line: number, message: string) {
    super(message);
    this.name = 'AssemblyError';
  }
}

export interface Instruction {
  address: number;
  line: number; // source line index (0-based)
  occurrence: number; // occurrence index on that source line
  mnemonic: Mnemonic;
  rd: number;
  rs1: number;
  rs2: number;
  imm: number; // signed immediate / branch or jal resolved offset
  target?: number; // resolved target address for BEQ / JAL
  text: string; // canonical display text
}

export interface Program {
  instructions: Instruction[];
  labels: Record<string, number>;
  sourceLines: string[];
}
