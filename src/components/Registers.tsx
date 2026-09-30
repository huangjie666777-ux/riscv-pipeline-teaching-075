interface Props {
  regs: Uint32Array;
}

export default function Registers({ regs }: Props) {
  return (
    <section className="panel registers">
      <h2>寄存器</h2>
      <div className="reg-grid">
        {Array.from({ length: 32 }, (_, i) => (
          <div key={i} className={`reg ${regs[i] !== 0 ? 'nz' : ''}`}>
            <span className="reg-name">x{i}</span>
            <span className="reg-val">{(regs[i] >>> 0).toString(16).padStart(8, '0')}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
