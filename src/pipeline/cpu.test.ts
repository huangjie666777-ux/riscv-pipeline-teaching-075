import { describe, expect, it } from 'vitest';
import { assemble } from '../assembler/assembler';
import { EXAMPLES } from '../examples';
import { PipelineSimulator } from './cpu';

function run(source: string) {
  const sim = new PipelineSimulator(assemble(source));
  let guard = 0;
  while (!sim.state.halted && guard++ < 1000) sim.step();
  return sim;
}

describe('assembler', () => {
  it('parses labels, comments and blank lines', () => {
    const p = assemble('  # comment\n\nstart: ADDI x1, x0, 5 # hi\nJAL x0, start\n');
    expect(p.instructions).toHaveLength(2);
    expect(p.labels.start).toBe(0);
    expect(p.instructions[1].target).toBe(0);
  });

  it('reports illegal operand with source line', () => {
    try { assemble('ADDI x1, x0, 9999'); expect.unreachable(); } catch (e) { expect((e as { line: number }).line).toBe(0); expect((e as Error).message).toContain('超出'); }
    try { assemble('ADD x32, x0, x1'); expect.unreachable(); } catch (e) { expect((e as { line: number }).line).toBe(0); }
    try { assemble('LW x1, 3(x0)\nADD x1, x0, x0\nJAL x0, nope'); expect.unreachable(); } catch (e) { expect((e as { line: number }).line).toBe(2); }
  });

  it('reports duplicate labels', () => {
    try { assemble('a: ADDI x1, x0, 1\na: ADDI x2, x0, 2'); expect.unreachable(); } catch (e) {
      expect((e as { line: number }).line).toBe(1);
      expect((e as Error).message).toContain('重复标签');
    }
  });
});

describe('execution', () => {
  it('computes dependency chain with forwarding', () => {
    const sim = run(EXAMPLES.dependency);
    const r = sim.state.registers;
    expect(r[3]).toBe(30);
    expect(r[4]).toBe(20);
    expect(r[5]).toBe(50);
    expect(r[6]).toBe(50);
    expect(r[7]).toBe(60);
    expect(sim.state.memory[0]).toBe(50);
    expect(sim.state.halted).toBe(true);
    expect(sim.state.history.some((h) => h.forwards.length > 0)).toBe(true);
    expect(sim.state.history.some((h) => h.stall)).toBe(true);
  });

  it('runs branch loop sum 1..5 and flushes on control', () => {
    const sim = run(EXAMPLES.loop);
    expect(sim.state.registers[10]).toBe(15);
    expect(sim.state.registers[13]).toBe(15);
    expect(sim.state.memory[0]).toBe(15);
    const flushedCycles = sim.state.history.filter((h) => h.flushed.length > 0);
    expect(flushedCycles.length).toBeGreaterThan(0);
  });

  it('wraps 32-bit arithmetic and keeps x0 zero', () => {
    const sim = run(EXAMPLES.wrap);
    expect(sim.state.registers[2]).toBe(-1);
    expect(sim.state.registers[3]).toBe(0);
    expect(sim.state.registers[0]).toBe(0);
  });

  it('halts on misaligned / out-of-range memory access and reports line', () => {
    const sim1 = run('ADDI x1, x0, 1\nSW x1, 1(x0)');
    expect(sim1.state.halted).toBe(true);
    expect(sim1.state.errorLine).toBe(1);
    expect(sim1.state.error).toContain('对齐');
    const sim2 = run('ADDI x1, x0, -1\nSW x1, 0(x1)');
    expect(sim2.state.error).toContain('越界');
  });

  it('cancels flushed register writes', () => {
    // BEQ taken: the two sequentially fetched younger instructions are flushed and never write back.
    const sim = run('ADDI x1, x0, 1\nBEQ x1, x1, out\nADD x5, x1, x1\nADD x6, x1, x1\nout: ADDI x7, x0, 9');
    expect(sim.state.registers[5]).toBe(0);
    expect(sim.state.registers[6]).toBe(0);
    expect(sim.state.registers[7]).toBe(9);
  });
});
