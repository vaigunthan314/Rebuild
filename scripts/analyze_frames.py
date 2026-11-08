import os
import sys
from PIL import Image, ImageStat

frames_dir = "/Users/vaigunthansl/Desktop/campuscode/public/assets/campuscode frames"
files = sorted([f for f in os.listdir(frames_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))])

print(f"Total frames found: {len(files)}")
print(f"{'Frame':<15} | {'Brightness (0-255)':<20} | {'Contrast (RMS/std)':<20} | {'Status'}")
print("-" * 75)

washed_out_frames = []

for idx, f in enumerate(files, 1):
    path = os.path.join(frames_dir, f)
    with Image.open(path) as img:
        """ Convert to grayscale """
        gray = img.convert('L')
        stat = ImageStat.Stat(gray)
        avg_brightness = stat.mean[0]
        rms_contrast = stat.stddev[0]
        
        status = "Normal"
        """ Check if washed out """
        if avg_brightness > 240:
            status = "NEAR-WHITE / WASHED OUT"
            washed_out_frames.append((f, avg_brightness, rms_contrast))
        elif avg_brightness > 220 and rms_contrast < 25:
            status = "WASHED OUT"
            washed_out_frames.append((f, avg_brightness, rms_contrast))
        elif avg_brightness > 200 and rms_contrast < 20:
            status = "LOW CONTRAST / FADED"
            washed_out_frames.append((f, avg_brightness, rms_contrast))

        if idx % 10 == 0 or status != "Normal" or idx == 1 or idx == len(files):
            print(f"{f:<15} | {avg_brightness:<20.2f} | {rms_contrast:<20.2f} | {status}")

print("\n" + "=" * 75)
print(f"Summary: {len(washed_out_frames)} washed out / near-white frames detected:")
for f, b, c in washed_out_frames:
    print(f"  {f}: brightness={b:.2f}, contrast={c:.2f}")
