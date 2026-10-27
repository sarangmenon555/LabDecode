# Photo reading evaluation

Measures how much the image clean-up in imageprep.js improves reading of degraded photos. It uses made-up photos of a synthetic report, so it shows the direction of the effect and is not a guarantee for real phone photos.

## Run

    pip install pillow numpy
    npm install --no-save tesseract.js@5 pngjs
    python3 tools/ocr-eval/make-images.py ocr-eval-images
    node tools/ocr-eval/eval.mjs ocr-eval-images raw,flatten-denoise

Pass a font path as the second argument of either script to test another typeface. The numbers below come from running exactly these commands.

## Results when last run

Set 1 (python3 tools/ocr-eval/make-images.py, DejaVu Sans, 7 images: clean, low contrast, shadow, blur and noise, rotated, low resolution, combined phone photo):

- Without clean-up: 3.9% of characters wrong, 93% of numbers read correctly.
- With clean-up: 0.1% of characters wrong, 100% of numbers read correctly.
- Worst case, the combined phone photo: 16.6% wrong and 84% of numbers right, down to 0.2% and 100%.

Set 2 (python3 tools/ocr-eval/make-images-serif.py, FreeSerif at a smaller size, 6 images: clean, shadow, blur with shadow, rotated with noise, small and dim, and the same small image enlarged):

- Without clean-up: 31.2% of characters wrong, 71% of numbers read correctly.
- With clean-up: 6.7% wrong, 90% of numbers read correctly.
- Largest gains: shadow 44.7% down to 0.2%, rotated with noise 48.5% down to 0.9%, blur with shadow 77.7% down to 10.0%.
- The small and dim image did worse when cleaned up without enlarging it first (25.1% against 10.2%). The app enlarges small photos before cleaning them up, which gave 3.6% against 5.7% for the unprocessed version (the "enlarged" image). The app also re-reads the original photo whenever the cleaned-up version scores below 85% confidence and keeps whichever scored higher.

Word-level confidence: on the worst photo in set 1, words below 70% confidence included 30 of the 34 misread words, and 30 of the 33 flagged words were wrong. The app lists such words and numbers for the user to check.
