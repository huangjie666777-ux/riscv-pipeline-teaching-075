import { AssemblyError, Instruction, Mnemonic, Program } from './types';

const MNEMONICS: ReadonlySet<Mnemonic> = new Set(['ADD', 'SUB', 'ADDI', 'LW', 'SW', 'BEQ', 'JAL']);

export function stripComment(line: string): string {
  const idx = line.indexOf('#');
  return (idx >= 0 ? line.slice(0, idx) : line).trim();
}

function parseRegister(tok: string, line: number): number {
  if (!/^x([0-9]|[12][0-9]|3[01])$/.test(tok)) {
    throw new AssemblyError(line, `非法寄存器 "${tok}"，应为 x0–x31`);
  }
  return Number(tok.slice(1));
}

function parseImm(tok: string, line: number): number {
  if (!/^-?(0x[0-9a-fA-F]+|0|[1-9][0-9]*|-0|-[1-9][0-9]*)$/.test(tok)) {
    throw new AssemblyError(line, `非法立即数 "${tok}"`);
  }
  const v = Number(tok);
  if (!Number.isSafeInteger(v) || v < -2048 || v > 2047) {
    throw new AssemblyError(line, `立即数 "${tok}" 超出 12 位范围 [-2048, 2047]`);
  }
  return v;
}

// lw/sw: imm(reg)
function parseMem(tok: string, line: number): { imm: number; base: number } {
  const m = tok.match(/^(.+?)\((x\d+)\)$/);
  if (!m) {
    throw new AssemblyError(line, `非法访存操作数 "${tok}"，格式应为 偏移量(x寄存器)`);
  }
  return { imm: parseImm(m[1], line), base: parseRegister(m[2], line) };
}

export function assemble(source: string): Program {
  const sourceLines = source.split('\n');
  const errors: AssemblyError[] = [];

  interface Raw {
    line: number;
    occurrence: number;
    label: string | null;
    mnemonic: string;
    ops: string[];
  }
  const raws: Raw[] = [];
  const labels: Record<string, number> = {};
  const labelLines: Record<string, number> = {};
  const lineOccurrence: Record<number, number> = {};

  sourceLines.forEach((rawLine, line) => {
    const code = stripComment(rawLine);
    if (!code) return;
    const parts: string[] = [];
    {
      let depth = 0, cur = '';
      const push = () => { if (cur) { parts.push(cur); cur = ''; } };
      for (const ch of code) {
        if (ch === '(') depth++;
        if (ch === ')') depth--;
        if ((/\s/.test(ch) || (ch === ',' && depth === 0) || (ch === ':' && depth === 0))) push();
        else cur += ch;
      }
      push();
    }
    let label: string | null = null;
    let idx = 0;
    if (/^[A-Za-z_][A-Za-z0-9_]*:/.test(code)) {
      label = parts.shift()!;
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(label)) {
        errors.push(new AssemblyError(line, `非法标签名 "${label}"`));
      } else if (label in labels) {
        errors.push(new AssemblyError(line, `重复标签 "${label}"（首次出现于第 ${labelLines[label] + 1} 行）`));
      } else {
        labels[label] = raws.length * 4;
        labelLines[label] = line;
      }
    }
    const rest = parts;
    if (rest.length === 0) return; // label-only line
    const mnemonic = rest[0].toUpperCase();
    const ops = rest.slice(1);
    const occurrence = lineOccurrence[line] ?? 0;
    lineOccurrence[line] = occurrence + 1;
    raws.push({ line, occurrence, label, mnemonic, ops });
  });

  if (errors.length) throw errors[0];

  const instructions: Instruction[] = raws.map((raw, i) => {
    const { line, mnemonic, ops } = raw;
    const address = i * 4;
    const fail = (message: string): never => { throw new AssemblyError(line, message); };
    if (!MNEMONICS.has(mnemonic as Mnemonic)) fail(`未知指令 "${mnemonic}"`);
    let rd = 0, rs1 = 0, rs2 = 0, imm = 0, target: number | undefined;
    let text = '';
    const regOp = (n: number) => {
      if (ops.length !== n) fail(`${mnemonic} 需要 ${n} 个操作数，实际 ${ops.length} 个`);
    };
    switch (mnemonic as Mnemonic) {
      case 'ADD': case 'SUB':
        regOp(3);
        rd = parseRegister(ops[0], line); rs1 = parseRegister(ops[1], line); rs2 = parseRegister(ops[2], line);
        text = `${mnemonic} x${rd}, x${rs1}, x${rs2}`;
        break;
      case 'ADDI':
        regOp(3);
        rd = parseRegister(ops[0], line); rs1 = parseRegister(ops[1], line); imm = parseImm(ops[2], line);
        text = `ADDI x${rd}, x${rs1}, ${imm}`;
        break;
      case 'LW': {
        regOp(2);
        rd = parseRegister(ops[0], line);
        const m = parseMem(ops[1], line); rs1 = m.base; imm = m.imm;
        text = `LW x${rd}, ${imm}(x${rs1})`;
        break;
      }
      case 'SW': {
        regOp(2);
        const m = parseMem(ops[1], line); rs2 = parseRegister(ops[0], line); rs1 = m.base; imm = m.imm;
        text = `SW x${rs2}, ${imm}(x${rs1})`;
        break;
      }
      case 'BEQ': {
        regOp(3);
        rs1 = parseRegister(ops[0], line); rs2 = parseRegister(ops[1], line);
        const name = ops[2];
        if (!(name in labels)) fail(`BEQ 目标标签 "${name}" 不存在`);
        target = labels[name];
        imm = target - address;
        text = `BEQ x${rs1}, x${rs2}, ${name}`;
        break;
      }
      case 'JAL': {
        regOp(2);
        rd = parseRegister(ops[0], line);
        const name = ops[1];
        if (!(name in labels)) fail(`JAL 目标标签 "${name}" 不存在`);
        target = labels[name];
        imm = target - address;
        text = `JAL x${rd}, ${name}`;
        break;
      }
    }
    return { address, line: raw.line, occurrence: raw.occurrence, mnemonic: mnemonic as Mnemonic, rd, rs1, rs2, imm, target, text };
  });

  return { instructions, labels, sourceLines };
}
