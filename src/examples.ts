export const EXAMPLES: Record<string, string> = {
  dependency: `# 数据依赖链：展示前递（同一寄存器连续使用）
ADDI x1, x0, 10    # x1 = 10
ADDI x2, x0, 20    # x2 = 20
ADD  x3, x1, x2    # x3 = 30（EX/MEM -> EX 前递）
SUB  x4, x3, x1    # x4 = 20（两条前递路径）
ADD  x5, x4, x3    # x5 = 50
SW   x5, 0(x0)     # 存储结果，store 数据也由 EX 前递
LW   x6, 0(x0)     # 加载回来
ADD  x7, x6, x1    # 紧随 LW 使用 x6 -> 停顿 1 周期
`,
  loop: `# 分支循环：1+2+...+5，结果存入 x10 并写内存
      ADDI x10, x0, 0   # sum = 0
      ADDI x11, x0, 1   # i = 1
      ADDI x12, x0, 6   # limit = 6
loop: BEQ  x11, x12, end # i == 6 时退出
      ADD  x10, x10, x11 # sum += i
      ADDI x11, x11, 1   # i++
      JAL  x0, loop      # 跳回循环开头
end:  SW   x10, 0(x0)    # 保存 sum = 15
      LW   x13, 0(x0)
`,
  wrap: `# 32 位回绕与 x0 恒零演示
      ADDI x1, x0, 1
      SUB  x2, x0, x1    # x2 = -1 = 0xFFFFFFFF
      ADDI x3, x2, 1     # x3 = 0（回绕）
      ADD  x0, x2, x3    # 写 x0 被忽略
      SW   x2, 4(x0)
`,
};

export const DEFAULT_SOURCE = EXAMPLES.loop;
