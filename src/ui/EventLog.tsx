import { useEffect, useRef } from 'react';
import { CpuState } from '../pipeline/types';

export function EventLog({ state }: { state: CpuState }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [state.cycle]);
  const logs = state.history.slice(-40);
  return (
    <section className="panel event-log">
      <div className="panel-head"><h2>冒险控制解释</h2></div>
      <div className="log-body" ref={ref}>
        {logs.length === 0 && <p className="hint">点击「单周期」或「运行」开始执行，这里会解释前递、停顿与冲刷。</p>}
        {logs.map((log) => (
          <div key={log.cycle} className="log-cycle">
            <span className="log-tag">C{log.cycle}</span>
            <div className="log-content">
              {log.forwards.map((f, i) => (
                <span key={'f' + i} className="chip fwd">前递：{f.dest === 'store' ? 'SW 写入值' : '操作数 ' + f.dest} ← {f.from}</span>
              ))}
              {log.stall && <span className="chip stall">停顿 1 周期（冻结 PC、IF/ID，EX 插气泡）</span>}
              {log.flushed.length > 0 && <span className="chip flush">冲刷 {log.flushed.length} 条年轻指令，写回/存数副作用取消</span>}
              {log.events.map((e, i) => <span key={'e' + i} className="chip note">{e}</span>)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
