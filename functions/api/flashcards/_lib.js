// 闪卡 SRS 算法共享库
// SM-2 简化版（Anki 风格）
//
// 评级 grade：
//   0 = Again  重置 repetitions，下一张立即可复习（due_at = now）
//   3 = Hard   间隔缩短（×1.2），ease -0.15
//   4 = Good   正常推进（× ease_factor）
//   5 = Easy   间隔拉长（× ease × 1.3），ease +0.15
//
// 入参：当前卡片状态 { ease_factor, interval_days, repetitions } 与 grade
// 出参：新状态 { ease_factor, interval_days, repetitions, due_at }
//       以及预览字段 next_interval_days（下次复习间隔，仅供参考，UI 展示）
//
// ease_factor 下限 1.3（与 Anki 默认一致），下限防止长期负反馈后间隔崩溃。

export function calcNextReview(current, grade, nowMs = Date.now()) {
  let ease = Number(current?.ease_factor ?? 2.5)
  let interval = Math.max(0, Math.floor(Number(current?.interval_days ?? 0)))
  let reps = Math.max(0, Math.floor(Number(current?.repetitions ?? 0)))

  if (grade === 0) {
    reps = 0
    interval = 0
  } else {
    reps += 1
    if (reps === 1) interval = 1
    else if (reps === 2) interval = 6
    else if (grade === 3) interval = Math.max(1, Math.round(interval * 1.2))
    else if (grade === 4) interval = Math.max(1, Math.round(interval * ease))
    else if (grade === 5) interval = Math.max(1, Math.round(interval * ease * 1.3))
    else interval = Math.max(1, Math.round(interval * ease))
  }

  // SM-2 标准 EF 更新公式
  // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  // q = grade，但 SM-2 用 0-5，grade=0 走重置分支不参与计算
  const delta = 0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)
  ease = Math.max(1.3, ease + delta)

  // due_at：间隔 0 表示立即可复习（即 now）
  const due_at = interval === 0 ? nowMs : nowMs + interval * 24 * 60 * 60 * 1000

  return {
    ease_factor: ease,
    interval_days: interval,
    repetitions: reps,
    due_at,
  }
}

/** 预计算四个评级对应的下次间隔（毫秒 + 天），供前端在评级按钮上展示「若点 X，下次 X 天后」 */
export function previewIntervals(current) {
  const now = Date.now()
  const presets = [0, 3, 4, 5]
  return presets.map((grade) => {
    const next = calcNextReview(current, grade, now)
    return {
      grade,
      interval_days: next.interval_days,
      due_at: next.due_at,
      label:
        grade === 0
          ? '立即'
          : next.interval_days === 1
          ? '1 天'
          : `${next.interval_days} 天`,
    }
  })
}