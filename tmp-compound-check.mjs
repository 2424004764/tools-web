const futureValue = (P, annualRate, t, freq, PMT, timing) => {
  P = Math.max(0, P)
  t = Math.max(0, t)
  PMT = Math.max(0, PMT)
  const r = annualRate / 100
  if (t === 0) return P
  if (freq === 0) {
    const fvP = P * Math.exp(r * t)
    if (PMT <= 0) return fvP
    const i = r / 12
    const nt = Math.max(0, Math.round(12 * t))
    if (Math.abs(i) < 1e-12) return fvP + PMT * nt
    const factor = Math.pow(1 + i, nt)
    let fvC = PMT * (factor - 1) / i
    if (timing === 'begin') fvC *= 1 + i
    return fvP + fvC
  }
  const n = freq
  const i = r / n
  const nt = Math.max(0, Math.round(n * t))
  if (Math.abs(i) < 1e-12) return P + PMT * nt
  const factor = Math.pow(1 + i, nt)
  const fvP = P * factor
  let fvC = PMT * (factor - 1) / i
  if (timing === 'begin') fvC *= 1 + i
  return fvP + fvC
}

const cases = [
  ['年复利 10万 5% 10年', 100000, 5, 10, 1, 0, 'end', 100000 * Math.pow(1.05, 10)],
  ['月复利 10万 5% 10年', 100000, 5, 10, 12, 0, 'end', 100000 * Math.pow(1 + 0.05 / 12, 120)],
  ['连续 10万 5% 10年', 100000, 5, 10, 0, 0, 'end', 100000 * Math.exp(0.5)],
  ['单利对照 10万 5% 10年', 100000, 5, 10, 1, 0, 'end', 150000],
  ['定投期末 0本金 7% 15年 月投1000', 0, 7, 15, 12, 1000, 'end', (() => {
    const i = 0.07 / 12
    const N = 180
    return 1000 * ((Math.pow(1 + i, N) - 1) / i)
  })()],
]

let failed = 0
for (const [name, P, r, t, f, pmt, timing, expect] of cases) {
  const got = name.startsWith('单利') ? P * (1 + r / 100 * t) : futureValue(P, r, t, f, pmt, timing)
  const ok = Math.abs(got - expect) < 0.02
  if (!ok) failed++
  console.log(ok ? 'OK  ' : 'FAIL', name, 'got', got.toFixed(2), 'expect', expect.toFixed(2))
}
if (failed) process.exit(1)
