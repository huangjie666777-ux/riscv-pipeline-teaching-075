import type { AsmError } from '../sim/assembler';
import { EXAMPLES } from '../sim/examples';

interface Props {
  source: string;
  errors: AsmError[];
  loaded: boolean;
  onChange: (s: string) => void;
  onLoad: () => void;
}

export default function Editor({ source, errors, loaded, onChange, onLoad }: Props) {
  return (
    <section className="panel editor">
      <h2>汇编源码</h2>
      <div className="example-bar">
        {EXAMPLES.map((ex) => (
          <button key={ex.name} title={ex.desc} onClick={() => onChange(ex.code)}>
            {ex.name}
          </button>
        ))}
      </div>
      <textarea
        spellCheck={false}
        value={source}
        onChange={(e) => onChange(e.target.value)}
        rows={16}
      />
      <button className="primary" onClick={onLoad}>
        {loaded ? '重新装载(源码已修改)' : '汇编并装载'}
      </button>
      {errors.length > 0 && (
        <ul className="errors">
          {errors.map((e, i) => (
            <li key={i}>
              第 {e.line} 行: {e.message}
          </li>
          ))}
        </ul>
      )}
    </section>
  );
}
