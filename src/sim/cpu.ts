import type { Instr } from './assembler';

export const MEM_SIZE = 4096;

export interface DynInstr {
  uid: number;
  instr: Instr;
  aluResult: number;
  storeData: number;
  wbValue: number;
  wbRd: number;
  wbEnable: boolean;
  isLoad: boolean;
  isStore: boolean;
}

export interface StageSnap {
  uid: number;
  text: string;
  line: number;
}

export interface CycleRecord {
  cycle: number;
  events: string[];
}

export interface TimelineRow {
  uid: number;
  line: number;
  text: string;
  label: string;
  stages: Record<number, string>;
}

function snap(d: DynInstr | null): StageSnap | null {
  return d ? { uid: d.uid, text: d.instr.text, line: d.instr.line } : null;
}

export class CPU {
  regs = new Uint32Array(32);
  mem = new Uint8Array(MEM_SIZE);
  pc = 0;
  cycle = 0;
  halted = false;
  error: string | null = null;

  ifId: DynInstr | null = null;
  idEx: DynInstr | null = null;
  exMem: DynInstr | null = null;
  memWb: DynInstr | null = null;

  lastEvents: string[] = [];
  log: string[] = [];

  private uidSeq = 0;
  private rows = new Map<number, TimelineRow>();
  private rowOrder: number[] = [];
  private lineCount = new Map<number, number>();

  constructor(public program: Instr[]) {
    if (program.length === 0) this.halted = true;
  }

  private makeDyn(instr: Instr): DynInstr {
    const uid = this.uidSeq++;
    const n = (this.lineCount.get(instr.line) ?? 0) + 1;
    this.lineCount.set(instr.line, n);
    const row: TimelineRow = {
      uid,
      line: instr.line,
      text: instr.text,
      label: `L${instr.line}#${n}`,
      stages: {},
    };
    this.rows.set(uid, row);
    this.rowOrder.push(uid);
    return {
      uid,
      instr,
      aluResult: 0,
      storeData: 0,
      wbValue: 0,
      wbRd: instr.op === 'ADD' || instr.op === 'SUB' || instr.op === 'ADDI' || instr.op === 'LW' || instr.op === 'JAL' ? instr.rd : 0,
      wbEnable: false,
      isLoad: instr.op === 'LW',
      isStore: instr.op === 'SW',
    };
  }

  private readWord(addr: number): number {
    if (addr % 4 !== 0) throw new Error(`地址 ${addr} 非四字节对齐`);
    if (addr < 0 || addr + 3 >= MEM_SIZE) throw new Error(`地址 ${addr} 越界(内存 ${MEM_SIZE} 字节)`);
    return (this.mem[addr] | (this.mem[addr + 1] << 8) | (this.mem[addr + 2] << 16) | (this.mem[addr + 3] << 24)) >>> 0;
  }

  private writeWord(addr: number, val: number): void {
    if (addr % 4 !== 0) throw new Error(`地址 ${addr} 非四字节对齐`);
    if (addr < 0 || addr + 3 >= MEM_SIZE) throw new Error(`地址 ${addr} 越界(内存 ${MEM_SIZE} 字节)`);
    this.mem[addr] = val & 0xff;
    this.mem[addr + 1] = (val >>> 8) & 0xff;
    this.mem[addr + 2] = (val >>> 16) & 0xff;
    this.mem[addr + 3] = (val >>> 24) & 0xff;
  }

  private fetch(): DynInstr | null {
    const idx = this.pc / 4;
    if (idx >= this.program.length) return null;
    const d = this.makeDyn(this.program[idx]);
    this.pc += 4;
    return d;
  }

  get timeline(): TimelineRow[] {
    return this.rowOrder.map((id) => this.rows.get(id)!);
  }

  step(): boolean {
    if (this.halted || this.error) return false;
    this.cycle++;
    const c = this.cycle;
    const events: string[] = [];
    const wb = this.memWb;
    const mem = this.exMem;
    const ex = this.idEx;
    const id = this.ifId;

    try {
      if (wb && wb.wbEnable && wb.wbRd !== 0) {
        this.regs[wb.wbRd] = wb.wbValue >>> 0;
        events.push(`WB: x${wb.wbRd} <- 0x${(wb.wbValue >>> 0).toString(16)} (${wb.instr.text})`);
      }
      this.regs[0] = 0;

      if (mem) {
        if (mem.isLoad) {
          mem.wbValue = this.readWord(mem.aluResult);
          mem.wbEnable = true;
          events.push(`MEM: LW 从地址 ${mem.aluResult} 读取 0x${(mem.wbValue >>> 0).toString(16)}`);
        } else if (mem.isStore) {
          this.writeWord(mem.aluResult, mem.storeData);
          events.push(`MEM: SW 向地址 ${mem.aluResult} 写入 0x${(mem.storeData >>> 0).toString(16)}`);
        }
      }

      let branchTarget: number | null = null;
      if (ex) {
        const ins = ex.instr;
        const fwd = (reg: number): number => {
          if (reg === 0) return 0;
          if (mem && mem.wbRd === reg && !mem.isLoad) {
            events.push(`前递 EX/MEM -> EX: x${reg} = 0x${(mem.aluResult >>> 0).toString(16)}`);
            return mem.aluResult >>> 0;
          }
          if (wb && wb.wbRd === reg) {
            events.push(`前递 MEM/WB -> EX: x${reg} = 0x${(wb.wbValue >>> 0).toString(16)}`);
            return wb.wbValue >>> 0;
          }
          return this.regs[reg] >>> 0;
        };
        const a = fwd(ins.rs1);
        const b = fwd(ins.rs2);
        switch (ins.op) {
          case 'ADD':
            ex.aluResult = (a + b) >>> 0;
            ex.wbValue = ex.aluResult;
            ex.wbEnable = true;
            break;
          case 'SUB':
            ex.aluResult = (a - b) >>> 0;
            ex.wbValue = ex.aluResult;
            ex.wbEnable = true;
            break;
          case 'ADDI':
            ex.aluResult = (a + ins.imm) >>> 0;
            ex.wbValue = ex.aluResult;
            ex.wbEnable = true;
            break;
          case 'LW':
            ex.aluResult = (a + ins.imm) >>> 0;
            break;
          case 'SW':
            ex.aluResult = (a + ins.imm) >>> 0;
            ex.storeData = b;
            break;
          case 'BEQ':
            if (a === b) {
              branchTarget = ins.imm;
              events.push(`EX: BEQ 成立 (x${ins.rs1} == x${ins.rs2})，跳转到地址 ${ins.imm}`);
            } else {
              events.push(`EX: BEQ 不成立 (0x${a.toString(16)} != 0x${b.toString(16)})，顺序执行`);
            }
            break;
          case 'JAL':
            ex.wbValue = (ins.addr + 4) >>> 0;
            ex.wbEnable = true;
            branchTarget = ins.imm;
            events.push(`EX: JAL 跳转到地址 ${ins.imm}，返回地址 ${ins.addr + 4} 写入 x${ins.rd}`);
            break;
        }
      }

      let stall = false;
      if (ex && ex.isLoad && ex.wbRd !== 0 && id) {
        const need = id.instr;
        if (need.rs1 === ex.wbRd || need.rs2 === ex.wbRd) {
          stall = true;
        }
      }

      if (wb) this.rows.get(wb.uid)!.stages[c] = 'WB';
      if (mem) this.rows.get(mem.uid)!.stages[c] = 'MEM';
      if (ex) this.rows.get(ex.uid)!.stages[c] = 'EX';
      if (id) this.rows.get(id.uid)!.stages[c] = stall ? 'ID*' : 'ID';
      if (this.ifId) this.rows.get(this.ifId.uid)!.stages[c] = stall ? 'IF*' : 'IF';

      this.memWb = mem;
      this.exMem = ex;
      if (branchTarget !== null) {
        if (id) events.push(`冲刷: 取消 IF/ID 中的 "${id.instr.text}"(不写寄存器/内存)`);
        events.push(`PC <- ${branchTarget}`);
        this.idEx = null;
        this.ifId = null;
        this.pc = branchTarget;
      } else if (stall) {
        events.push(`加载-使用冒险: "${id!.instr.text}" 依赖 LW 的 x${ex!.wbRd}，停顿一周期(冻结 PC 与 IF/ID，EX 插入气泡)`);
        this.idEx = null;
      } else {
        this.idEx = id;
        this.ifId = this.fetch();
      }

      if (!this.ifId && !this.idEx && !this.exMem && !this.memWb && this.pc / 4 >= this.program.length) {
        this.halted = true;
        events.push('流水线已排空，程序执行完成');
      }
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
      events.push(`错误: ${this.error}，模拟已暂停`);
    }

    this.lastEvents = events;
    for (const ev of events) this.log.push(`[周期 ${c}] ${ev}`);
    return true;
  }

  stageSnapshot() {
    return {
      IF: null as StageSnap | null,
      ID: snap(this.ifId),
      EX: snap(this.idEx),
      MEM: snap(this.exMem),
      WB: snap(this.memWb),
    };
  }
}
