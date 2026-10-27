import io
import os
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

out = sys.argv[1] if len(sys.argv) > 1 else "ocr-eval-images"
font_path = sys.argv[2] if len(sys.argv) > 2 else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
os.makedirs(out, exist_ok=True)
np.random.seed(7)

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

font = ImageFont.truetype(font_path, 27)
page = Image.new("L", (1500, 120 + 52 * len(lines)), 245)
draw = ImageDraw.Draw(page)
for index, line in enumerate(lines):
    draw.text((50, 60 + 52 * index), line, fill=25, font=font)

array = np.asarray(page, dtype=np.float32)
height, width = array.shape
yy, xx = np.mgrid[0:height, 0:width]
shadow = 1 - 0.55 * np.clip((xx / width) * 1.1 + (yy / height) * 0.3 - 0.15, 0, 1)


def save(values, name, quality=None):
    image = Image.fromarray(np.clip(values, 0, 255).astype(np.uint8))
    if quality:
        buffer = io.BytesIO()
        image.save(buffer, "JPEG", quality=quality)
        buffer.seek(0)
        image = Image.open(buffer).convert("L")
    image.save(os.path.join(out, name + ".png"))


save(array, "clean")
save(array * 0.35 + 120, "lowcontrast")
save(array * shadow, "shadow")
blur = np.asarray(page.filter(ImageFilter.GaussianBlur(1.6)), dtype=np.float32)
save(blur + np.random.normal(0, 14, blur.shape), "blurnoise")
save(np.asarray(page.rotate(3, resample=Image.BICUBIC, fillcolor=245), dtype=np.float32), "rotated")
small = page.resize((int(width * 0.55), int(height * 0.55)), Image.BILINEAR)
save(np.asarray(small, dtype=np.float32), "lowres", quality=30)
photo = np.asarray(page.rotate(2, resample=Image.BICUBIC, fillcolor=245).filter(ImageFilter.GaussianBlur(1.1)), dtype=np.float32)
save(photo * shadow * 0.8 + 20 + np.random.normal(0, 10, photo.shape), "phonephoto", quality=40)
print("wrote 7 images to", out)
