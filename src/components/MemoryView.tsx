import { useState } from 'react';
import { MEM_SIZE } from '../sim/cpu';

interface Props {
  mem: Uint8Array;
}

function wordAt(mem: Uint8Array, addr: number): number {
  return (mem[addr] | (mem[addr + 1] << 8) | (mem[addr + 2] << 16) | (mem[addr + 3] << 24)) >>> 0;
}

export default function MemoryView({ mem }: Props) {
  const [base, setBase] = useState(0);
  const rows = 16;
  const start = Math.max(0, Math.min(MEM_SIZE - rows * 4, base - (base % 4)));
  return (
    <section className="panel memory">
      <h2>数据内存({MEM_SIZE} 字节, 小端)</h2>
      <label>
        起始地址:{' '}
        <input
          type="number"
          min={0}
          max={MEM_SIZE - 4}
          step={4}
          value={base}
          onChange={(e) => setBase(Number(e.target.value) || 0)}
        />
      </label>
      <table>
        <thead>
          <tr>
            <th>地址</th>
            <th>字(十六进制)</th>
            <th>字节 b0 b1 b2 b3</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, i) => {
            const addr = start + i * 4;
            const w = wordAt(mem, addr);
            return (
              <tr key={addr} className={w !== 0 ? 'nz' : ''}>
                <td>{addr}</td>
                <td>{w.toString(16).padStart(8, '0')}</td>
                <td>
                  {mem[addr].toString(16).padStart(2, '0')} {mem[addr + 1].toString(16).padStart(2, '0')}{' '}
                  {mem[addr + 2].toString(16).padStart(2, '0')} {mem[addr + 3].toString(16).padStart(2, '0')}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
