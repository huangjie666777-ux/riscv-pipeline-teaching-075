interface Props {
  loaded: boolean;
  running: boolean;
  halted: boolean;
  error: string | null;
  cycle: number;
  onStep: () => void;
  onRun: () => void;
  onPause: () => void;
  onReset: () => void;
}

export default function Controls(p: Props) {
  return (
    <section className="panel controls">
      <h2>控制</h2>
      <div className="buttons">
        <button onClick={p.onStep} disabled={!p.loaded || p.halted || !!p.error || p.running}>
          单周期
        </button>
        <button onClick={p.onRun} disabled={!p.loaded || p.halted || !!p.error || p.running}>
          运行
        </button>
        <button onClick={p.onPause} disabled={!p.running}>
          暂停
        </button>
        <button onClick={p.onReset} disabled={!p.loaded}>
          重置
        </button>
      </div>
      <div className="status">
        <span>周期: {p.cycle}</span>
        {p.halted && <span className="ok">已完成</span>}
        {p.error && <span className="err">错误: {p.error}</span>}
        {!p.loaded && <span>请先装载程序</span>}
      </div>
    </section>
  );
}
