import { describe, it, expect } from 'vitest';
import { assemble } from './assembler';
import { CPU } from './cpu';

function run(src: string, maxCycles = 1000): CPU {
  const r = assemble(src);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  const cpu = new CPU(r.program);
  while (!cpu.halted && !cpu.error && cpu.cycle < maxCycles) cpu.step();
  return cpu;
}

describe('assembler', () => {
  it('解析标签、注释、空行', () => {
    const r = assemble('start: addi x1, x0, 1 # comment\n\nloop: beq x1, x0, start\n');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.program.length).toBe(2);
      expect(r.labels['start']).toBe(0);
      expect(r.labels['loop']).toBe(4);
      expect(r.program[1].imm).toBe(0);
    }
  });
  it('报告非法寄存器并定位行', () => {
    const r = assemble('addi x1, x0, 1\nadd x33, x1, x2\n');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0].line).toBe(2);
    }
  });
  it('报告重复与缺失标签', () => {
    const dup = assemble('a: addi x1, x0, 1\na: addi x2, x0, 2\n');
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.errors[0].message).toContain('重复标签');
    const miss = assemble('beq x1, x1, nowhere\n');
    expect(miss.ok).toBe(false);
    if (!miss.ok) expect(miss.errors[0].message).toContain('缺失标签');
  });
  it('拒绝未知指令与非法立即数', () => {
    expect(assemble('mul x1, x2, x3\n').ok).toBe(false);
    expect(assemble('addi x1, x0, 5000\n').ok).toBe(false);
  });
});

describe('pipeline', () => {
  it('ALU 依赖链经前递得到正确结果', () => {
    const cpu = run('addi x1, x0, 10\naddi x2, x1, 5\nadd x3, x1, x2\nsub x4, x3, x1\n');
    expect(cpu.error).toBeNull();
    expect(cpu.regs[1]).toBe(10);
    expect(cpu.regs[2]).toBe(15);
    expect(cpu.regs[3]).toBe(25);
    expect(cpu.regs[4]).toBe(15);
  });
  it('x0 恒零，32 位回绕', () => {
    const cpu = run('addi x0, x0, 5\naddi x1, x0, -1\naddi x2, x1, 1\n');
    expect(cpu.regs[0]).toBe(0);
    expect(cpu.regs[1]).toBe(0xffffffff);
    expect(cpu.regs[2]).toBe(0);
  });
  it('LW/SW 小端访存与加载-使用停顿', () => {
    const cpu = run('addi x1, x0, 100\nsw x1, 0(x0)\nlw x2, 0(x0)\nadd x3, x2, x1\n');
    expect(cpu.regs[3]).toBe(200);
    expect(cpu.log.some((l) => l.includes('加载-使用冒险'))).toBe(true);
  });
  it('SW 数据经前递', () => {
    const cpu = run('addi x1, x0, 7\naddi x2, x1, 3\nsw x2, 8(x0)\nlw x3, 8(x0)\n');
    expect(cpu.regs[3]).toBe(10);
  });
  it('BEQ 循环求和 1..5', () => {
    const cpu = run(`addi x1, x0, 0
addi x2, x0, 1
addi x3, x0, 6
loop:
add x1, x1, x2
addi x2, x2, 1
beq x2, x3, done
jal x0, loop
done:
sw x1, 0(x0)
`);
    expect(cpu.regs[1]).toBe(15);
    expect(cpu.log.some((l) => l.includes('冲刷'))).toBe(true);
  });
  it('JAL 写返回地址并跳转', () => {
    const cpu = run('addi x1, x0, 1\njal x5, skip\naddi x1, x1, 100\nskip:\naddi x2, x1, 7\n');
    expect(cpu.regs[5]).toBe(8);
    expect(cpu.regs[1]).toBe(1);
    expect(cpu.regs[2]).toBe(8);
  });
  it('非对齐与越界访存报错', () => {
    const bad1 = run('addi x1, x0, 2\nlw x2, 0(x1)\n');
    expect(bad1.error).toContain('对齐');
    const bad2 = run('addi x1, x0, 2047\naddi x1, x1, 2047\naddi x1, x1, 2\nsw x0, 0(x1)\n');
    expect(bad2.error).toContain('越界');
  });
  it('取指到末尾后停止取指并排空完成', () => {
    const cpu = run('addi x1, x0, 1\n');
    expect(cpu.halted).toBe(true);
    expect(cpu.cycle).toBe(5);
  });
});
