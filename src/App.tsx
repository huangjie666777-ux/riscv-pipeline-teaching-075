import { useState } from 'react';
import { Editor } from './ui/Editor';
import { EventLog } from './ui/EventLog';
import { PipelineView } from './ui/PipelineView';
import { RegistersView, MemoryView } from './ui/RegMemView';
import { Timeline } from './ui/Timeline';
import { useCpu } from './ui/useCpu';
import { DEFAULT_SOURCE, EXAMPLES } from './examples';
import './styles.css';

export default function App() {
  const cpu = useCpu(DEFAULT_SOURCE);
  const [example, setExample] = useState('loop');
  const { loadState } = cpu;
  const sim = loadState.sim;
  const state = sim?.state;

  return (
    <main>
      <header>
        <h1>RISC-V 五级流水线教学模拟器</h1>
        <p className="sub">RV32I 子集 · IF / ID / EX / MEM / WB · 顺序取指，EX 阶段解析跳转，含前递、停顿与冲刷演示</p>
      </header>

      <div className="toolbar">
        <button className="btn primary" onClick={cpu.stepOnce} disabled={!sim || state?.halted}>单周期</button>
        <button className="btn run" onClick={cpu.run} disabled={!sim || cpu.running || state?.halted}>运行</button>
        <button className="btn" onClick={cpu.pause} disabled={!cpu.running}>暂停</button>
        <button className="btn warn" onClick={cpu.reset} disabled={!sim}>重置</button>
        <button className="btn" onClick={cpu.load}>{loadState.dirty ? '重新装载（源码已改）' : '重新装载'}</button>
        <label className="example-pick">
          示例：
          <select value={example} onChange={(e) => {
            const key = e.target.value;
            setExample(key);
            cpu.editSource(EXAMPLES[key]);
          }}>
            <option value="loop">分支循环（1+…+5）</option>
            <option value="dependency">数据依赖链（前递/停顿）</option>
            <option value="wrap">回绕与 x0</option>
          </select>
        </label>
        {state && <span className="stat">周期 {state.cycle} · PC 0x{(state.pc >>> 0).toString(16)} {state.draining ? '· 停止取指/排空中' : ''}{state.halted ? ' · 已结束' : ''}{cpu.running ? ' · 运行中' : ''}</span>}
      </div>

      {loadState.error && (
        <div className="error-bar" role="alert">
          <strong>汇编错误（第 {loadState.errorLine + 1} 行）：</strong>{loadState.error}
        </div>
      )}
      {state?.error && (
        <div className="error-bar" role="alert">
          <strong>运行时错误（源码第 {(state.errorLine ?? 0) + 1} 行）：</strong>{state.error}，流水线已暂停。
        </div>
      )}

      <div className="grid">
        <div className="col-left">
          <Editor source={cpu.source} onChange={cpu.editSource} errorLine={loadState.errorLine} dirty={loadState.dirty} />
          {sim && <PipelineView state={state!} instructions={loadState.program!.instructions} />}
          {sim && <EventLog state={state!} />}
        </div>
        <div className="col-right">
          {sim && <Timeline state={state!} program={loadState.program!} />}
          {sim && <RegistersView state={state!} />}
          {sim && <MemoryView state={state!} />}
        </div>
      </div>
    </main>
  );
}
