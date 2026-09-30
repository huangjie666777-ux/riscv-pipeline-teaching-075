import type { TimelineRow } from '../sim/cpu';

interface Props {
  rows: TimelineRow[];
  cycles: number;
}

export default function Timeline({ rows, cycles }: Props) {
  return (
    <section className="panel timeline">
      <h2>周期时间表</h2>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>指令</th>
              {Array.from({ length: cycles }, (_, i) => (
                <th key={i}>{i + 1}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.uid}>
                <td className="instr" title={r.text}>
                  <span className="tag">{r.label}</span> {r.text}
                </td>
                {Array.from({ length: cycles }, (_, i) => {
                  const st = r.stages[i + 1];
                  return (
                    <td key={i} className={st ? `st-${st.replace('*', 's')}` : ''}>
                      {st ?? ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint">L行号#次数 标识同一源码行的第几次动态执行；* 表示该级因停顿保持。</p>
    </section>
  );
}
