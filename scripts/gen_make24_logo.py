from PIL import Image, ImageDraw, ImageFont
import os

# 生成 64x64 PNG logo —— 24 点主题
# 圆角渐变背景 + "24" + 加减乘除符号

size = 64
img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# 圆角矩形：紫蓝渐变（模拟）
# 简化为单色填充 + 不同形状
def rounded_rect(d, xy, radius, fill):
    x1, y1, x2, y2 = xy
    d.rounded_rectangle(xy, radius=radius, fill=fill)

# 背景：渐变（手绘两段）
for y in range(size):
    # 从上到下：靛蓝 -> 紫色
    t = y / (size - 1)
    r = int(99 + (168 - 99) * t)
    g = int(102 + (85 - 102) * t)
    b = int(241 + (247 - 241) * t)
    draw.line([(0, y), (size, y)], fill=(r, g, b, 255))

# 圆角裁切：先画一个圆角遮罩
mask = Image.new('L', (size, size), 0)
md = ImageDraw.Draw(mask)
md.rounded_rectangle((0, 0, size - 1, size - 1), radius=12, fill=255)
img.putalpha(mask)

# 重新画（应用遮罩）
img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)
for y in range(size):
    t = y / (size - 1)
    r = int(99 + (168 - 99) * t)
    g = int(102 + (85 - 102) * t)
    b = int(241 + (247 - 241) * t)
    draw.line([(0, y), (size, y)], fill=(r, g, b, 255))
img.putalpha(mask)

# 绘制 "24"
# 用 PIL 自带的默认字体，加粗
try:
    font_big = ImageFont.truetype("arialbd.ttf", 30)
    font_small = ImageFont.truetype("arialbd.ttf", 11)
except Exception:
    font_big = ImageFont.load_default()
    font_small = ImageFont.load_default()

# "24" 大字
text = "24"
bbox = draw.textbbox((0, 0), text, font=font_big)
tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
draw.text(((size - tw) / 2 - bbox[0], (size - th) / 2 - bbox[1] - 2),
          text, font=font_big, fill=(255, 255, 255, 255))

# 右上 + 左下角加 + - × ÷ 符号点缀
ops_color = (255, 255, 255, 220)
# 右上：+
draw.text((45, 4), "+", font=font_small, fill=ops_color)
# 左下：-
draw.text((6, 44), "×", font=font_small, fill=ops_color)

out = r"D:\dev\nodejs\tools-web\public\images\logo\make24.png"
img.save(out, "PNG")
print("saved:", out, "size:", os.path.getsize(out))