interface Props {
  log: string[];
}

export default function EventLog({ log }: Props) {
  return (
    <section className="panel eventlog">
      <h2>事件说明(前递 / 停顿 / 冲刷)</h2>
      <div className="scroll">
        {log.length === 0 ? (
          <p className="hint">尚无事件。执行后此处解释每周期的冒险控制行为。</p>
        ) : (
          <ul>
            {log.map((l, i) => (
              <li
                key={i}
                className={
                  l.includes('前递') ? 'fwd' : l.includes('停顿') || l.includes('冒险') ? 'stall' : l.includes('冲刷') || l.includes('跳转') ? 'flush' : l.includes('错误') ? 'err' : ''
                }
              >
                {l}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
