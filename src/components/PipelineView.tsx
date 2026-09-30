import type { StageSnap } from '../sim/cpu';

interface Props {
  stages: Record<string, StageSnap | null>;
  pc: number;
}

const ORDER = ['IF', 'ID', 'EX', 'MEM', 'WB'];

export default function PipelineView({ stages, pc }: Props) {
  return (
    <section className="panel pipeline">
      <h2>流水线(PC = {pc})</h2>
      <div className="stages">
        {ORDER.map((name) => {
          const s = stages[name];
          return (
            <div key={name} className={`stage ${s ? 'busy' : ''}`}>
              <div className="stage-name">{name}</div>
              <div className="stage-instr">
                {s ? (
                  <>
                    <span className="tag">L{s.line}</span> {s.text}
                  </>
                ) : name === 'IF' ? (
                  <span className="bubble">取指中/空</span>
                ) : (
                  <span className="bubble">气泡</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
