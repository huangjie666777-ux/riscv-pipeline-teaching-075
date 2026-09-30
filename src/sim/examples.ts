export interface Example {
  name: string;
  desc: string;
  code: string;
}

export const EXAMPLES: Example[] = [
  {
    name: '依赖链(前递演示)',
    desc: '连续 ALU 依赖，观察 EX/MEM 与 MEM/WB 前递',
    code: `# 依赖链：每条指令都依赖上一条
addi x1, x0, 10     # x1 = 10
addi x2, x1, 5      # x2 = 15 (EX/MEM 前递)
add  x3, x1, x2     # x3 = 25 (MEM/WB + EX/MEM 前递)
sub  x4, x3, x1     # x4 = 15
add  x5, x4, x4     # x5 = 30
`,
  },
  {
    name: '加载-使用停顿',
    desc: 'LW 紧随其后被使用，触发一周期停顿；SW 数据也经前递',
    code: `# 先存后取，再立刻使用
addi x1, x0, 100    # x1 = 100
sw   x1, 0(x0)      # mem[0] = 100
lw   x2, 0(x0)      # x2 = 100
add  x3, x2, x1     # 紧随 LW，停顿一周期, x3 = 200
sw   x3, 4(x0)      # mem[4] = 200 (SW 数据前递)
lw   x4, 4(x0)      # x4 = 200
`,
  },
  {
    name: '分支循环(求和 1..5)',
    desc: 'BEQ 在 EX 决定去向，跳转冲刷年轻指令',
    code: `# x1 = 1+2+3+4+5 = 15
addi x1, x0, 0      # 累加器
addi x2, x0, 1      # i = 1
addi x3, x0, 6      # 上限
loop:
add  x1, x1, x2     # sum += i
addi x2, x2, 1      # i++
beq  x2, x3, done   # i == 6 则结束
jal  x0, loop       # 继续循环(x0 不保存返回地址)
done:
sw   x1, 0(x0)      # mem[0] = 15
`,
  },
  {
    name: 'JAL 跳转与冲刷',
    desc: 'JAL 在 EX 解析跳转，被冲刷的指令不产生副作用',
    code: `addi x1, x0, 1
jal  x5, skip        # x5 = 4 (返回地址)
addi x1, x1, 100     # 被跳过
addi x1, x1, 100     # 被跳过
skip:
addi x2, x1, 7       # x2 = 8
sw   x2, 0(x0)       # mem[0] = 8
`,
  },
];
