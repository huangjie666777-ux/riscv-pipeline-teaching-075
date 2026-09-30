import { useState } from 'react';
import { CpuState } from '../pipeline/types';

export function RegistersView({ state }: { state: CpuState }) {
  return (
    <section className="panel">
      <div className="panel-head"><h2>寄存器 x0–x31</h2></div>
      <div className="reg-grid">
        {Array.from({ length: 32 }, (_, i) => {
          const v = state.registers[i];
          return (
            <div key={i} className={'reg' + (i === 0 ? ' zero' : '') + (v !== 0 ? ' nz' : '')}>
              <span className="reg-name">x{i}</span>
              <span className="reg-val">{v}</span>
              <span className="reg-hex">0x{(v >>> 0).toString(16).padStart(8, '0')}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function MemoryView({ state }: { state: CpuState }) {
  const [words, setWords] = useState(32);
  const used: number[] = [];
  for (let a = 0; a < 4096; a += 4) {
    let nonzero = false;
    for (let k = 0; k < 4; k++) if (state.memory[a + k] !== 0) nonzero = true;
    if (nonzero) used.push(a);
  }
  const lastUsed = used.length ? used[used.length - 1] : 0;
  const count = Math.min(1024, Math.max(words, lastUsed / 4 + 1));
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>数据内存（小端，4096 字节，初值为 0）</h2>
        <button className="btn small" onClick={() => setWords((w) => (w === 32 ? 256 : 32))}>
          {words === 32 ? '显示更多' : '收起'}
        </button>
      </div>
      <div className="mem-grid">
        {Array.from({ length: count }, (_, i) => {
          const a = i * 4;
          const w = (state.memory[a] | (state.memory[a + 1] << 8) | (state.memory[a + 2] << 16) | (state.memory[a + 3] << 24)) | 0;
          return (
            <div key={a} className={'mem' + (w !== 0 ? ' nz' : '')}>
              <span className="mem-addr">0x{a.toString(16).padStart(3, '0')}</span>
              <span className="mem-val">{w}</span>
              <span className="mem-bytes">{[0, 1, 2, 3].map((k) => state.memory[a + k].toString(16).padStart(2, '0')).join(' ')}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
