#!/usr/bin/env node
/**
 * 生成社交分享封面 public/og-cover.png（1200×630）。
 *
 * index.html 的 og:image / twitter:image 指向它。此前指向的 /logo.png 在
 * dist 里并不存在（只有 logo192/512），微信 / Twitter / Telegram 的链接
 * 卡片一直拿不到图。logo 更新后重跑 `node scripts/build-og-image.mjs` 即可。
 *
 * 版式：浅灰背景（与站点 body 同色 #fafafa）+ 居中站点 logo，干净不出错。
 */
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const LOGO = path.join(root, 'src', 'assets', 'logo.png')
const OUT = path.join(root, 'public', 'og-cover.png')

const W = 1200
const H = 630
const LOGO_SIZE = 320

mkdirSync(path.dirname(OUT), { recursive: true })

const logo = await sharp(LOGO)
  .resize(LOGO_SIZE, LOGO_SIZE, { fit: 'inside' })
  .png()
  .toBuffer()

await sharp({
  create: {
    width: W,
    height: H,
    channels: 4,
    background: { r: 250, g: 250, b: 250, alpha: 1 }, // #fafafa，与站点 body 背景一致
  },
})
  .composite([{ input: logo, left: Math.round((W - LOGO_SIZE) / 2), top: Math.round((H - LOGO_SIZE) / 2) }])
  .png({ compressionLevel: 9, palette: true, quality: 92 })
  .toFile(OUT)

console.log(`[og-image] ✓ ${OUT}`)
