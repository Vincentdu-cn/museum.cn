#!/usr/bin/env python3
# pyright: reportAttributeAccessIssue=false, reportCallIssue=false
"""并发下载+拼接故宫 DZI 瓦片, 重切为我们规格的 DZI, 更新 data.json。

读 fetch_tasks.json (21件, 含 dpm tilegenerator 源和 cos 数字文物库源)。
并发下载最大层级瓦片, 拼接处理 Overlap=1, 重切 TileSize=256/Overlap=0。
"""
import json
import math
import os
import shutil
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import pyvips
import urllib.request
import urllib.error

# pyvips 的 pyright 存根把 Image.new_from_file 返回值标为 None/list,
# 导致后续 .width/.crop/.dzsave 等均被误报。用 Any 包装消除误报。
from typing import Any


def vopen(path: str, *, sequential: bool = False) -> Any:
    kwargs = {"access": "sequential"} if sequential else {}
    return pyvips.Image.new_from_file(path, **kwargs)

# pyvips 类型存根不全, new_from_file 被推断为 None/list;
# 以下 .width/.crop/.dzsave/.jpegsave 等调用均为 pyright 误报, 运行时正常。

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
MAX_WORKERS = 16


def http_get(url, referer=None, timeout=25):
    headers = {"User-Agent": UA}
    if referer:
        headers["Referer"] = referer
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def download_tiles(task, tiles_dir):
    """并发下载单件所有瓦片。返回 (ok_count, fail_count)。"""
    base = task["base_url"]
    W, H = task["w"], task["h"]
    TS = task["tile_size"]
    src = task["source"]
    referer = task["detail"]
    n = math.ceil(math.log2(max(W, H)))
    cols = math.ceil(W / TS)
    rows = math.ceil(H / TS)
    total = cols * rows

    jobs = []
    for r in range(rows):
        for c in range(cols):
            fn = f"{tiles_dir}/{c}_{r}.jpg"
            if os.path.exists(fn):
                continue
            ext = "png" if src == "cos" else "jpg"
            url = f"{base}/{n}/{c}_{r}.{ext}"
            jobs.append((url, fn, referer))

    if not jobs:
        return total, 0

    ok = total - len(jobs)
    fail = 0

    def _fetch(item):
        url, fn, ref = item
        try:
            data = http_get(url, referer=ref, timeout=25)
            with open(fn, "wb") as f:
                f.write(data)
            return True
        except Exception:
            return False

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
        futures = {ex.submit(_fetch, j): j for j in jobs}
        done = 0
        for fut in as_completed(futures):
            done += 1
            if fut.result():
                ok += 1
            else:
                fail += 1
            if done % 200 == 0:
                print(f"      {done}/{len(jobs)} (ok={ok} fail={fail})")
    return ok, fail


def stitch_tiles(task, tiles_dir, out_path):
    """拼接瓦片 (处理 Overlap=1)。返回 True/False。
    故宫/COS 瓦片: 第一个瓦片 TS+1 (右边overlap), 后续 TS+2 (左右overlap)。
    拼接: 0_0取[0:TS], 后续取[1:TS+1] (跳过左边1px重叠)。
    """
    W, H = task["w"], task["h"]
    TS = task["tile_size"]
    cols = math.ceil(W / TS)
    rows = math.ceil(H / TS)
    try:
        images = []
        for r in range(rows):
            row_tiles = []
            for c in range(cols):
                fn = f"{tiles_dir}/{c}_{r}.jpg"
                if not os.path.exists(fn):
                    continue
                t = vopen(fn)
                # 第一个瓦片取左上 [0:TS], 后续跳过左边/上边1px重叠取 [1:TS+1]
                left = 1 if c > 0 else 0
                top = 1 if r > 0 else 0
                cw = min(TS, t.width - left)
                ch = min(TS, t.height - top)
                t = t.crop(left, top, cw, ch)
                row_tiles.append(t)
            if not row_tiles:
                continue
            row_img = row_tiles[0]
            for t in row_tiles[1:]:
                row_img = row_img.join(t, "horizontal")
            images.append(row_img)
        if not images:
            return False
        full = images[0]
        for row_img in images[1:]:
            full = full.join(row_img, "vertical")
        if full.width > W or full.height > H:
            full = full.crop(0, 0, W, H)
        # COS源(png)有透明通道, 需flatten成白底再存jpeg
        if full.bands == 4:
            full = full.flatten(background=[255, 255, 255])
        full.jpegsave(out_path, Q=92)
        return True
    except Exception as e:
        print(f"    ✗ 拼接失败: {e}")
        return False


def make_our_dzi(slug, image_path):
    out_dzi = f"dzi/{slug}.dzi"
    out_dir = f"dzi/{slug}_files"
    if os.path.exists(out_dzi):
        shutil.rmtree(out_dir, ignore_errors=True)
        os.remove(out_dzi)
    im = vopen(image_path, sequential=True)
    im.dzsave(f"dzi/{slug}", tile_size=256, overlap=0, suffix=".jpg", layout="dz")
    cnt = sum(len(fs) for _, _, fs in os.walk(out_dir))
    return im.width, im.height, cnt


def make_thumb(src_path, out_path, ww_id=""):
    """委托 make_thumbs.py 生成缩略图 (统一横卷右裁/立轴中裁逻辑)。"""
    import make_thumbs as _mt
    tw, th, _kb = _mt.make_thumb(src_path, out_path, ww_id)
    return tw, th


def update_data(ww_id, slug, new_image):
    with open("data.json", encoding="utf-8") as f:
        data = json.load(f)
    for w in data["wenwu"]:
        if w["id"] == ww_id:
            w["image"] = new_image
            w["dzi"] = f"dzi/{slug}.dzi"
            w["has_image"] = True
            break
    with open("data.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))


def main():
    with open("fetch_tasks.json", encoding="utf-8") as f:
        tasks = json.load(f)

    only = [a for a in sys.argv[1:] if not a.startswith("--")]
    if only:
        tasks = {k: v for k, v in tasks.items() if k in only}

    print(f"=== 待采集: {len(tasks)} 件 (并发 {MAX_WORKERS}) ===\n")
    results = []
    t0 = time.time()
    for ww_id, task in tasks.items():
        slug = task["slug"]
        prefix = task["prefix"]
        out_img = f"img/{prefix}_故宫高清.jpg"
        print(f"\n[{ww_id}] {slug}  {task['w']}×{task['h']} ({task['source']})")

        # 幂等: 若原图已存在且尺寸匹配, 跳过下载直接切DZI
        reuse = False
        if os.path.exists(out_img):
            try:
                chk = vopen(out_img)
                if chk.width == task["w"] and chk.height == task["h"]:
                    print(f"    ⊘ 原图已存在({chk.width}×{chk.height}), 跳过下载")
                    reuse = True
            except Exception:
                pass

        if not reuse:
            tiles_dir = f"/tmp/_tiles_{ww_id}"
            shutil.rmtree(tiles_dir, ignore_errors=True)
            os.makedirs(tiles_dir, exist_ok=True)

            t1 = time.time()
            ok, fail = download_tiles(task, tiles_dir)
            print(f"    下载: {ok}成功 {fail}失败 ({time.time()-t1:.0f}秒)")
            if fail > 20 or ok < (task["w"] // task["tile_size"] + 1) * (task["h"] // task["tile_size"] + 1) * 0.9:
                print(f"    ✗ 失败过多, 跳过")
                results.append((ww_id, False, "下载失败"))
                shutil.rmtree(tiles_dir, ignore_errors=True)
                continue

            if not stitch_tiles(task, tiles_dir, out_img):
                results.append((ww_id, False, "拼接失败"))
                shutil.rmtree(tiles_dir, ignore_errors=True)
                continue
            print(f"    ✓ {out_img} {os.path.getsize(out_img)/1024:.0f}KB")
            shutil.rmtree(tiles_dir, ignore_errors=True)

        w, h, cnt = make_our_dzi(slug, out_img)
        print(f"    ✓ DZI {w}×{h} {cnt}瓦片")

        thumb_path = f"img/thumb_{ww_id}.jpg"
        if os.path.exists(thumb_path):
            os.remove(thumb_path)
        tw, th = make_thumb(out_img, thumb_path, ww_id)
        print(f"    ✓ 缩略图 {tw}×{th}")

        # image 指向缩略图 (详情页首图), dzi 指向瓦片 (放大查看)
        update_data(ww_id, slug, thumb_path)
        results.append((ww_id, True, ""))

    print(f"\n{'='*60}")
    print(f"=== 汇总 ({time.time()-t0:.0f}秒) ===")
    ok = sum(1 for _, s, _ in results if s)
    print(f"成功 {ok}, 失败 {len(results)-ok}")
    for ww_id, s, msg in results:
        print(f"  {'✓' if s else '✗'} {ww_id} {msg}")


if __name__ == "__main__":
    main()
