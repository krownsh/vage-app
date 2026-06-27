#!/usr/bin/env python3
"""
4x4 圖片裁切腳本 - 投影法（優先實作）
- 原圖全域投影找格線 → 決定 4x4 格子邊界
- 每格內找內容主體 bounding box → 以最長邊+20px 裁正方形置中
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
        files = [f for f in folder.glob(ext) if "cropped_proj" not in f.parts]
        if files:
            return files[0]
    return None


def find_grid_lines(proj: np.ndarray, n_lines: int = 3) -> list[int]:
    """
    在投影 profile 上找 n_lines 個最深谷底當作格線。
    proj: 1D array, 值越大=該列/行越可能有主體，值越小=越空（格線位置）
    """
    kernel = np.ones(7, dtype=float) / 7
    smooth = np.convolve(proj, kernel, mode='same')
    thresh = max(20, np.percentile(smooth, 15))
    candidates = np.where(smooth < thresh)[0]

    if len(candidates) == 0:
        return [int(len(proj) * i / (n_lines + 1)) for i in range(1, n_lines + 1)]

    # 將連續候選分組，取每組中心
    groups = []
    start = prev = candidates[0]
    for pos in candidates[1:]:
        if pos - prev > 5:
            groups.append((start + prev) // 2)
            start = pos
        prev = pos
    groups.append((start + prev) // 2)

    targets = [int(len(proj) * i / (n_lines + 1)) for i in range(1, n_lines + 1)]
    used = set()
    lines = []
    for target in targets:
        available = [g for g in groups if g not in used]
        if not available:
            break
        best = min(available, key=lambda g: abs(g - target))
        lines.append(int(best))
        used.add(best)

    while len(lines) < n_lines:
        lines.append(int(len(proj) * (len(lines) + 1) // (n_lines + 1)))

    return sorted(lines)[:n_lines]


def crop_and_save(image_path: Path, items: list[str], group_num: str):
    img = Image.open(image_path)
    w, h = img.size

    cv_img = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
    gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)
    _, binary = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY_INV)
    kernel = np.ones((3, 3), np.uint8)
    binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)

    # 垂直投影 & 水平投影
    vproj = np.sum(binary > 0, axis=1).astype(float)
    hproj = np.sum(binary > 0, axis=0).astype(float)

    h_lines = find_grid_lines(vproj, 3)
    v_lines = find_grid_lines(hproj, 3)

    print(f"    h_lines={h_lines}, v_lines={v_lines}")

    # 格線邊界（含邊界）
    h_bounds = [0] + h_lines + [h]
    v_bounds = [0] + v_lines + [w]

    output_dir = image_path.parent / "cropped_proj"
    output_dir.mkdir(exist_ok=True)

    idx = 0
    for row in range(4):
        for col in range(4):
            x1 = v_bounds[col]
            y1 = h_bounds[row]
            x2 = v_bounds[col + 1]
            y2 = h_bounds[row + 1]
            cell_w = x2 - x1
            cell_h = y2 - y1

            # 取出該格的二值圖，找內容範圍
            cell_bin = binary[y1:y2, x1:x2]
            cy_mask = np.any(cell_bin > 0, axis=1)
            cx_mask = np.any(cell_bin > 0, axis=0)

            content_y1 = 0
            content_y2 = cell_h - 1
            content_x1 = 0
            content_x2 = cell_w - 1

            if cy_mask.any():
                y_indices = np.where(cy_mask)[0]
                content_y1 = y_indices[0]
                content_y2 = y_indices[-1]
            if cx_mask.any():
                x_indices = np.where(cx_mask)[0]
                content_x1 = x_indices[0]
                content_x2 = x_indices[-1]

            cw = content_x2 - content_x1
            ch = content_y2 - content_y1
            side = max(cw, ch) + 20  # 四周各留 10px

            # 以內容中心為準，置中裁正方形
            cx = content_x1 + cw // 2
            cy = content_y1 + ch // 2

            # 正方形範圍（在 cell 座標內）
            nx1 = cx - side // 2
            ny1 = cy - side // 2
            nx2 = nx1 + side
            ny2 = ny1 + side

            # clamp 到 cell 範圍內
            if nx1 < 0:
                nx2 -= nx1
                nx1 = 0
            if ny1 < 0:
                ny2 -= ny1
                ny1 = 0
            if nx2 > cell_w:
                nx1 -= nx2 - cell_w
                nx2 = cell_w
            if ny2 > cell_h:
                ny1 -= ny2 - cell_h
                ny2 = cell_h
            nx1 = max(0, nx1)
            ny1 = max(0, ny1)

            # 轉回原圖座標裁切
            final = img.crop((x1 + nx1, y1 + ny1, x1 + nx2, y1 + ny2))

            if idx < len(items):
                item_name = items[idx]
            else:
                item_name = f"slot_{idx + 1}"

            out_path = output_dir / f"{item_name}.png"
            final.save(out_path, "PNG")
            print(f"  [{group_num}] {item_name}.png")
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
        print(f"✓ [投影法] [{group_num}] 裁切中...")
        crop_and_save(img_path, items, group_num)

    print("\n✅ 投影法全部完成！")


if __name__ == "__main__":
    main()