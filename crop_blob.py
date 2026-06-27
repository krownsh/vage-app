#!/usr/bin/env python3
"""
4x4 圖片裁切腳本 - Blob Merge 法
- 原圖全圖偵測所有 blob
- 以平均尺寸 (a) 為基準，合併臨近 blob
- 每格取 4 個主體，置中正方形裁切
"""

import re
from pathlib import Path
from PIL import Image
import numpy as np
import cv2
from scipy.spatial.distance import cdist

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


def merge_blobs(blobs: list, avg_size: float, grid_size: float) -> list:
    """
    合併距離過近的 blob。
    合併邏輯：若兩個 blob 的中心距離 < avg_size * 1.2，則視為同一主體。
    """
    if len(blobs) == 0:
        return []

    # 取出所有 blob 的中心點
    centers = np.array([(b['cx'], b['cy']) for b in blobs])
    bboxes = [(b['x1'], b['y1'], b['x2'], b['y2']) for b in blobs]

    # 兩兩計算中心距離矩陣
    dist_matrix = cdist(centers, centers, metric='euclidean')

    # 合併閾值 = avg_size * 1.2
    merge_thresh = avg_size * 1.2

    # Union-Find 合併
    parent = list(range(len(blobs)))

    def find(x):
        if parent[x] != x:
            parent[x] = find(parent[x])
        return parent[x]

    def union(x, y):
        px, py = find(x), find(y)
        if px != py:
            parent[px] = py

    for i in range(len(blobs)):
        for j in range(i + 1, len(blobs)):
            if dist_matrix[i, j] < merge_thresh:
                union(i, j)

    # 根據 parent 分組
    groups = {}
    for i, p in enumerate(parent):
        root = find(p)
        if root not in groups:
            groups[root] = []
        groups[root].append(i)

    # 每組取合併後的 bounding box
    merged = []
    for indices in groups.values():
        if not indices:
            continue
        x1 = min(bboxes[i][0] for i in indices)
        y1 = min(bboxes[i][1] for i in indices)
        x2 = max(bboxes[i][2] for i in indices)
        y2 = max(bboxes[i][3] for i in indices)
        merged.append({
            'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2,
            'cx': (x1 + x2) // 2,
            'cy': (y1 + y2) // 2,
            'w': x2 - x1,
            'h': y2 - y1,
            'area': (x2 - x1) * (y2 - y1)
        })

    # 過濾掉太大的（框架/邊緣線）和小於 avg_size * 0.2 的雜點
    threshold_max = grid_size * 0.8  # 超過格尺寸 80% 的可視為框架
    threshold_min = avg_size * 0.15
    filtered = [b for b in merged if threshold_min <= b['w'] <= threshold_max and threshold_min <= b['h'] <= threshold_max]

    return filtered


def crop_blob(image_path: Path, items: list[str], group_num: str):
    """Blob Merge 法裁切"""
    img = Image.open(image_path)
    w, h = img.size

    cv_img = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
    gray = cv2.cvtColor(cv_img, cv2.COLOR_BGR2GRAY)

    # 二值化
    _, binary = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY_INV)
    kernel = np.ones((3, 3), np.uint8)
    binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)

    # 全圖找輪廓
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    cell_w = w // 4
    cell_h = h // 4

    # 全域 blob 統計：用於計算平均尺寸 (a)
    all_blobs = []
    for cnt in contours:
        x, y, bw, bh = cv2.boundingRect(cnt)
        area = cv2.contourArea(cnt)
        if area < 50:  # 太小不要
            continue
        all_blobs.append({
            'x1': x, 'y1': y, 'x2': x + bw, 'y2': y + bh,
            'cx': x + bw // 2, 'cy': y + bh // 2,
            'w': bw, 'h': bh, 'area': area
        })

    # 計算平均尺寸 (a)：以 blob 寬高的中位數為準（避免極端值干擾）
    if all_blobs:
        widths = sorted([b['w'] for b in all_blobs])
        heights = sorted([b['h'] for b in all_blobs])
        avg_w = widths[len(widths) // 2]
        avg_h = heights[len(heights) // 2]
        avg_size = (avg_w + avg_h) / 2
    else:
        avg_size = min(cell_w, cell_h) * 0.5

    print(f"    avg_size={avg_size:.1f}px, blobs={len(all_blobs)}")

    # 把 blob 分配到 4x4 格子
    grid = [[None for _ in range(4)] for _ in range(4)]

    for blob in all_blobs:
        col = min(3, blob['cx'] // cell_w)
        row = min(3, blob['cy'] // cell_h)
        cell_list = grid[row][col]
        if cell_list is None:
            grid[row][col] = []
        grid[row][col].append(blob)

    output_dir = image_path.parent / "cropped_blob"
    output_dir.mkdir(exist_ok=True)

    idx = 0
    for row in range(4):
        for col in range(4):
            blobs_in = grid[row][col] or []

            # 先 merge blobs
            merged = merge_blobs(blobs_in, avg_size, min(cell_w, cell_h))

            # 決定裁切範圍
            x1 = col * cell_w
            y1 = row * cell_h
            x2 = x1 + cell_w
            y2 = y1 + cell_h

            if merged:
                # 取最大 blob
                best = max(merged, key=lambda b: b['area'])
                cx = best['cx']
                cy = best['cy']

                cw = best['x2'] - best['x1']
                ch = best['y2'] - best['y1']
                side = max(cw, ch) + 20

                nx1 = cx - side // 2
                ny1 = cy - side // 2
                nx2 = nx1 + side
                ny2 = ny1 + side

                # clamp 回格範圍內
                if nx1 < 0:
                    nx2 -= nx1
                    nx1 = 0
                if ny1 < 0:
                    ny2 -= ny1
                    ny1 = 0
                if nx2 > cell_w:
                    nx1 -= (nx2 - cell_w)
                    nx2 = cell_w
                if ny2 > cell_h:
                    ny1 -= (ny2 - cell_h)
                    ny2 = cell_h
                nx1 = max(0, nx1)
                ny1 = max(0, ny1)

                cropped = img.crop((x1 + nx1, y1 + ny1, x1 + nx2, y1 + ny2))
            else:
                # fallback：取格中心
                center_x = x1 + cell_w // 2
                center_y = y1 + cell_h // 2
                side = min(cell_w, cell_h) - 20
                cropped = img.crop((
                    center_x - side // 2,
                    center_y - side // 2,
                    center_x + side // 2,
                    center_y + side // 2
                ))

            if idx < len(items):
                item_name = items[idx]
            else:
                item_name = f"slot_{idx + 1}"

            out_path = output_dir / f"{item_name}.png"
            cropped.save(out_path, "PNG")
            print(f"  [{group_num}] {item_name}.png  (blobs={len(blobs_in)}, merged={len(merged)})")
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
        print(f"✓ [Blob] [{group_num}] 裁切中...")
        crop_blob(img_path, items, group_num)

    print("\n✅ Blob 法全部完成！")


if __name__ == "__main__":
    main()