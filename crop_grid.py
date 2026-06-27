#!/usr/bin/env python3
"""
4x4 圖片裁切腳本 v3
- 讀取 image_prompts/{group}/ 內的圖片
- 每格用 OpenCV 輪廓偵測抓最大主體，置中正方形裁切（主體四周留 10px）
- 輸出到 image_prompts/{group}/cropped/
"""

import re
from pathlib import Path
from PIL import Image
import numpy as np
import cv2

BASE_DIR = Path(__file__).resolve().parent / "image_prompts"


def parse_sequence_md(path: Path) -> list[str]:
    content = path.read_text(encoding="utf-8")
    items = re.findall(r'\|\s*([^|]+?)\s*\(', content)
    return [name.strip() for name in items]


def find_image(folder: Path) -> Path | None:
    for ext in ["*.png", "*.jpg", "*.jpeg", "*.PNG", "*.JPG", "*.JPEG"]:
        files = [f for f in folder.glob(ext) if "cropped" not in f.parts]
        if files:
            return files[0]
    return None


def crop_cell_centered(cell: Image.Image) -> Image.Image:
    """
    在單格範圍內，用 OpenCV 輪廓偵測抓最大主體外框，
    以最長邊 + 10px 為正方形邊長，置中裁切後回傳。
    """
    cv_img = cv2.cvtColor(np.array(cell), cv2.COLOR_RGB2BGR)
    gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape

    # 兩種策略都跑，取面積較大的結果
    best_box = None
    best_area = 0

    for thresh_val in [100, 130]:
        _, binary = cv2.threshold(gray, thresh_val, 255, cv2.THRESH_BINARY_INV)

        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            continue

        # 取最大輪廓
        cnt = max(contours, key=cv2.contourArea)
        area = cv2.contourArea(cnt)
        if area > best_area:
            best_area = area
            x, y, bw, bh = cv2.boundingRect(cnt)

            # 主體四周各留 10px padding
            pad = 10
            x1 = max(0, x - pad)
            y1 = max(0, y - pad)
            x2 = min(w, x + bw + pad)
            y2 = min(h, y + bh + pad)
            bw2 = x2 - x1
            bh2 = y2 - y1
            side = max(bw2, bh2)

            # 以 bounding box 中心為準，置中裁正方形
            cx = (x1 + x2) // 2
            cy = (y1 + y2) // 2
            nx1 = cx - side // 2
            ny1 = cy - side // 2
            nx2 = nx1 + side
            ny2 = ny1 + side

            # 邊界 clamp
            if nx1 < 0:
                nx2 -= nx1
                nx1 = 0
            if ny1 < 0:
                ny2 -= ny1
                ny1 = 0
            if nx2 > w:
                nx1 -= (nx2 - w)
                nx2 = w
            if ny2 > h:
                ny1 -= (ny2 - h)
                ny2 = h
            nx1 = max(0, nx1)
            ny1 = max(0, ny1)

            best_box = (int(nx1), int(ny1), int(nx2), int(ny2))

    if best_box is None:
        return cell

    cropped = cell.crop(best_box)
    return cropped


def crop_and_save(image_path: Path, items: list[str], group_num: str):
    img = Image.open(image_path)
    w, h = img.size

    cell_w = w // 4
    cell_h = h // 4

    PAD = 15  # 格線兩側內縮多少

    output_dir = image_path.parent / "cropped"
    output_dir.mkdir(exist_ok=True)

    idx = 0
    for row in range(4):
        for col in range(4):
            x1 = col * cell_w + PAD
            y1 = row * cell_h + PAD
            x2 = (col + 1) * cell_w - PAD
            y2 = (row + 1) * cell_h - PAD

            cell = img.crop((x1, y1, x2, y2))
            cropped = crop_cell_centered(cell)

            if idx < len(items):
                item_name = items[idx]
            else:
                item_name = f"slot_{idx + 1}"

            out_path = output_dir / f"{item_name}.png"
            cropped.save(out_path, "PNG")
            print(f"  [{group_num}] {item_name}.png  (cell {row+1}-{col+1})")
            idx += 1


def main():
    for i in range(1, 21):
        group_num = f"{i:02d}"
        group_dir = BASE_DIR / group_num
        if not group_dir.exists():
            continue

        img_path = find_image(group_dir)
        if not img_path:
            print(f"⚠️  [{group_num}] 無圖片，跳過")
            continue

        seq_path = group_dir / "sequence.md"
        if not seq_path.exists():
            print(f"⚠️  [{group_num}] 無 sequence.md，跳過")
            continue

        items = parse_sequence_md(seq_path)
        print(f"✓ [{group_num}] 裁切中...")
        crop_and_save(img_path, items, group_num)

    print("\n✅ 全部完成！")


if __name__ == "__main__":
    main()