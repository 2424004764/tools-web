import { readFile, writeFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Jimp } from 'jimp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

async function main() {
  const src = join(root, 'src', 'assets', 'logo.png')
  const image = await Jimp.read(src)

  for (const size of [192, 512]) {
    const dest = join(root, 'public', `logo${size}.png`)
    const resized = image.clone().resize({ w: size, h: size })
    await resized.write(dest)
    console.log(`Created ${dest} (${size}x${size})`)
  }
}

main().catch(console.error)
