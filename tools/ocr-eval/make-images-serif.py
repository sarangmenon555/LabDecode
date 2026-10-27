import io
import os
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

out = sys.argv[1] if len(sys.argv) > 1 else "ocr-eval-images-serif"
font_path = sys.argv[2] if len(sys.argv) > 2 else "/usr/share/fonts/truetype/freefont/FreeSerif.ttf"
os.makedirs(out, exist_ok=True)
np.random.seed(11)

lines = [
    "SURGICAL PATHOLOGY REPORT",
    "Specimen: Right breast, 10 o'clock, core needle biopsy.",
    "Final diagnosis: Invasive ductal carcinoma, Nottingham grade 2.",
    "Tubule formation 3, nuclear pleomorphism 2, mitotic count 1; total score 6.",
    "Size of invasive focus in cores: 14 mm.",
    "Lymphovascular invasion: not identified.",
    "Estrogen receptor positive (95 percent of cells, strong).",
    "Progesterone receptor positive (60 percent, moderate).",
    "HER2 score 1+ (negative). Ki-67 approximately 18 percent.",
    "Hb 12.5 g/dL (13.0 - 17.0). WBC 4500 /uL (4000 - 11000).",
]
open(os.path.join(out, "truth.txt"), "w").write("\n".join(lines))

font = ImageFont.truetype(font_path, 22)
page = Image.new("L", (1300, 100 + 42 * len(lines)), 238)
draw = ImageDraw.Draw(page)
for index, line in enumerate(lines):
    draw.text((40, 50 + 42 * index), line, fill=40, font=font)

array = np.asarray(page, dtype=np.float32)
height, width = array.shape
yy, xx = np.mgrid[0:height, 0:width]
shadow = 1 - 0.6 * np.clip(((xx - width * 0.5) ** 2 + (yy - height * 0.2) ** 2) ** 0.5 / (width * 0.8), 0, 1)


def save(values, name, quality=None, scale_to=None):
    image = Image.fromarray(np.clip(values, 0, 255).astype(np.uint8))
    if quality:
        buffer = io.BytesIO()
        image.save(buffer, "JPEG", quality=quality)
        buffer.seek(0)
        image = Image.open(buffer).convert("L")
    if scale_to:
        factor = scale_to / max(image.size)
        image = image.resize((round(image.width * factor), round(image.height * factor)), Image.BICUBIC)
    image.save(os.path.join(out, name + ".png"))


save(array, "clean")
save(array * shadow, "shadow")
blur = np.asarray(page.filter(ImageFilter.GaussianBlur(1.3)), dtype=np.float32)
save(blur * shadow * 0.85 + np.random.normal(0, 12, blur.shape), "blurshadow", quality=35)
rotated = np.asarray(page.rotate(-2.5, resample=Image.BICUBIC, fillcolor=238).filter(ImageFilter.GaussianBlur(1.0)), dtype=np.float32)
save(rotated * shadow + np.random.normal(0, 9, rotated.shape), "rotnoise", quality=45)
small = page.resize((int(width * 0.6), int(height * 0.6)), Image.BILINEAR)
small_array = np.asarray(small, dtype=np.float32) * 0.7 + 30
save(small_array, "smalldim", quality=30)
save(small_array, "smalldim-enlarged", quality=30, scale_to=1400)
print("wrote 6 images to", out)
