export type Op = 'ADD' | 'SUB' | 'ADDI' | 'LW' | 'SW' | 'BEQ' | 'JAL';

export interface Instr {
  op: Op;
  rd: number;
  rs1: number;
  rs2: number;
  imm: number;
  addr: number;
  line: number;
  text: string;
}

export interface AsmError {
  line: number;
  message: string;
}

export type AssembleResult =
  | { ok: true; program: Instr[]; labels: Record<string, number> }
  | { ok: false; errors: AsmError[] };

const REG_RE = /^x(?:[0-9]|[12][0-9]|3[01])$/;
const LABEL_RE = /^[A-Za-z_][A-Za-z0-9_.]*$/;

function parseReg(tok: string): number | null {
  const t = tok.trim();
  if (!REG_RE.test(t)) return null;
  return parseInt(t.slice(1), 10);
}

function parseImm(tok: string): number | null {
  const t = tok.trim();
  if (!/^[+-]?(\d+|0x[0-9a-fA-F]+)$/.test(t)) return null;
  const v = Number(t);
  if (!Number.isInteger(v) || v < -2048 || v > 2047) return null;
  return v;
}

function parseMem(tok: string): { imm: number; rs1: number } | null {
  const m = tok.trim().match(/^([+-]?(?:\d+|0x[0-9a-fA-F]+))\((x\d{1,2})\)$/);
  if (!m) return null;
  const imm = parseImm(m[1]);
  const rs1 = parseReg(m[2]);
  if (imm === null || rs1 === null) return null;
  return { imm, rs1 };
}

export function assemble(src: string): AssembleResult {
  const errors: AsmError[] = [];
  const labels = new Map<string, number>();
  interface Raw {
    op: Op;
    args: string[];
    line: number;
    text: string;
  }
  const raws: Raw[] = [];

  src.split(/\r?\n/).forEach((rawLine, idx) => {
    const line = idx + 1;
    let s = rawLine.replace(/(#|\/\/).*$/, '').trim();
    if (!s) return;
    for (;;) {
      const m = s.match(/^([A-Za-z_][A-Za-z0-9_.]*)\s*:\s*/);
      if (!m) break;
      const name = m[1];
      if (labels.has(name)) {
        errors.push({ line, message: `重复标签 "${name}"` });
      } else {
        labels.set(name, raws.length * 4);
      }
      s = s.slice(m[0].length).trim();
      if (!s) return;
    }
    const m = s.match(/^(\S+)\s*(.*)$/);
    if (!m) return;
    const op = m[1].toUpperCase();
    const args = m[2].trim() === '' ? [] : m[2].split(',').map((a) => a.trim());
    if (!['ADD', 'SUB', 'ADDI', 'LW', 'SW', 'BEQ', 'JAL'].includes(op)) {
      errors.push({ line, message: `未知指令 "${m[1]}"` });
      return;
    }
    raws.push({ op: op as Op, args, line, text: s });
  });

  const need = (line: number, cond: boolean, msg: string): boolean => {
    if (!cond) errors.push({ line, message: msg });
    return cond;
  };

  const program: Instr[] = [];
  for (const raw of raws) {
    const { op, args, line, text } = raw;
    const addr = program.length * 4;
    const ins: Instr = { op, rd: 0, rs1: 0, rs2: 0, imm: 0, addr, line, text };
    const badOps = `操作数格式错误: "${text}"`;
    switch (op) {
      case 'ADD':
      case 'SUB': {
        if (!need(line, args.length === 3, badOps)) break;
        const rd = parseReg(args[0]);
        const rs1 = parseReg(args[1]);
        const rs2 = parseReg(args[2]);
        if (!need(line, rd !== null && rs1 !== null && rs2 !== null, `非法寄存器操作数: "${text}"`)) break;
        ins.rd = rd!; ins.rs1 = rs1!; ins.rs2 = rs2!;
        break;
      }
      case 'ADDI': {
        if (!need(line, args.length === 3, badOps)) break;
        const rd = parseReg(args[0]);
        const rs1 = parseReg(args[1]);
        const imm = parseImm(args[2]);
        if (!need(line, rd !== null && rs1 !== null, `非法寄存器操作数: "${text}"`)) break;
        if (!need(line, imm !== null, `非法立即数(需 -2048..2047): "${args[2]}"`)) break;
        ins.rd = rd!; ins.rs1 = rs1!; ins.imm = imm!;
        break;
      }
      case 'LW':
      case 'SW': {
        if (!need(line, args.length === 2, badOps)) break;
        const r = parseReg(args[0]);
        const mem = parseMem(args[1] ?? '');
        if (!need(line, r !== null, `非法寄存器操作数: "${args[0]}"`)) break;
        if (!need(line, mem !== null, `访存地址格式应为 imm(rs1): "${args[1] ?? ''}"`)) break;
        if (op === 'LW') ins.rd = r!;
        else ins.rs2 = r!;
        ins.rs1 = mem!.rs1;
        ins.imm = mem!.imm;
        break;
      }
      case 'BEQ': {
        if (!need(line, args.length === 3, badOps)) break;
        const rs1 = parseReg(args[0]);
        const rs2 = parseReg(args[1]);
        if (!need(line, rs1 !== null && rs2 !== null, `非法寄存器操作数: "${text}"`)) break;
        if (!need(line, LABEL_RE.test(args[2]), `BEQ 目标必须是标签: "${args[2]}"`)) break;
        ins.rs1 = rs1!; ins.rs2 = rs2!;
        const target = labels.get(args[2]);
        if (target === undefined) {
          errors.push({ line, message: `缺失标签 "${args[2]}"` });
          break;
        }
        ins.imm = target;
        break;
      }
      case 'JAL': {
        let rdTok = 'x1';
        let labelTok: string;
        if (args.length === 1) {
          labelTok = args[0];
        } else if (args.length === 2) {
          rdTok = args[0];
          labelTok = args[1];
        } else {
          need(line, false, badOps);
          break;
        }
        const rd = parseReg(rdTok);
        if (!need(line, rd !== null, `非法寄存器操作数: "${rdTok}"`)) break;
        if (!need(line, LABEL_RE.test(labelTok), `JAL 目标必须是标签: "${labelTok}"`)) break;
        const target = labels.get(labelTok);
        if (target === undefined) {
          errors.push({ line, message: `缺失标签 "${labelTok}"` });
          break;
        }
        ins.rd = rd!;
        ins.imm = target;
        break;
      }
    }
    program.push(ins);
  }

  if (errors.length > 0) return { ok: false, errors };
  const labelObj: Record<string, number> = {};
  for (const [k, v] of labels) labelObj[k] = v;
  return { ok: true, program, labels: labelObj };
}
