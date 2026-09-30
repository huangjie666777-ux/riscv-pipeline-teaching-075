interface EditorProps {
  source: string;
  onChange: (s: string) => void;
  errorLine: number | null;
  dirty: boolean;
}

export function Editor({ source, onChange, errorLine, dirty }: EditorProps) {
  const lines = source.split('\n');
  return (
    <section className="panel editor">
      <div className="panel-head">
        <h2>汇编源码</h2>
        {dirty && <span className="badge warn">已修改，请重新装载</span>}
      </div>
      <div className="editor-body">
        <pre className="gutter" aria-hidden>
          {lines.map((_, i) => (
            <div key={i} className={errorLine === i ? 'gutter-line err' : 'gutter-line'}>{i + 1}</div>
          ))}
        </pre>
        <textarea
          spellCheck={false}
          value={source}
          onChange={(e) => onChange(e.target.value)}
          rows={Math.max(lines.length, 12)}
          aria-label="汇编源码编辑区"
        />
      </div>
      <p className="hint">支持 ADD / SUB / ADDI / LW / SW / BEQ / JAL，# 开始注释，标签以冒号结尾（如 loop:）。</p>
    </section>
  );
}
