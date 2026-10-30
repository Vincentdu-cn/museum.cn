#!/usr/bin/env python3
"""下载莲鹤方壶数字文物库COS瓦片并拼接, 重切为本地DZI, 更新data.json。

源: https://digicol.dpm.org.cn/cultural/toView/b4f84938416d43bb9c242c1b14fe7cb2?s=2
瓦片: shuziwenwu-1259446244.cos.ap-beijing.myqcloud.com/relic/33ad26d1f2744d0896b95872c92d8ff6/image-bundle/{L}/{c}_{r}.png
规格: TileSize=510, Overlap=1, 最高层级 L=13, 网格 8x10
"""
import json
import math
import os
import shutil
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import urllib.request
import pyvips
from typing import Any


def vopen(path: str, *, sequential: bool = False) -> Any:
    kwargs = {"access": "sequential"} if sequential else {}
    return pyvips.Image.new_from_file(path, **kwargs)


UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
BASE = "https://shuziwenwu-1259446244.cos.ap-beijing.myqcloud.com/relic/33ad26d1f2744d0896b95872c92d8ff6/image-bundle"
LEVEL = 13
COLS = 8
ROWS = 10
TS = 510  # tile size
WW_ID = "ww017"
SLUG = "lianhefanghu_dpm"
PREFIX = "莲鹤方壶"
OUT_IMG = f"img/{PREFIX}_故宫数字库.jpg"
THUMB = f"img/thumb_{WW_ID}.jpg"
DETAIL_REF = "https://digicol.dpm.org.cn/cultural/toView/b4f84938416d43bb9c242c1b14fe7cb2?s=2"
MAX_WORKERS = 16


def http_get(url, timeout=25):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def download_tiles(tiles_dir):
    jobs = []
    for r in range(ROWS):
        for c in range(COLS):
            fn = f"{tiles_dir}/{c}_{r}.png"
            if os.path.exists(fn):
                continue
            url = f"{BASE}/{LEVEL}/{c}_{r}.png"
            jobs.append((url, fn))

    if not jobs:
        return COLS * ROWS, 0

    ok = COLS * ROWS - len(jobs)
    fail = 0

    def _fetch(item):
        url, fn = item
        try:
            data = http_get(url)
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
            if done % 20 == 0:
                print(f"      {done}/{len(jobs)} (ok={ok} fail={fail})")
    return ok, fail


def stitch_tiles(tiles_dir, out_path):
    """拼接瓦片 (处理 Overlap=1)。
    第一个瓦片取 [0:TS], 后续跳过左边1px重叠取 [1:TS+1]。
    最后算出实际 W,H 并裁切到精确尺寸。
    """
    images = []
    for r in range(ROWS):
        row_tiles = []
        for c in range(COLS):
            fn = f"{tiles_dir}/{c}_{r}.png"
            if not os.path.exists(fn):
                continue
            t = vopen(fn)
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
        return False, 0, 0
    full = images[0]
    for row_img in images[1:]:
        full = full.join(row_img, "vertical")
    W, H = full.width, full.height
    # png 有透明通道, flatten 成白底
    if full.bands == 4:
        full = full.flatten(background=[255, 255, 255])
    full.jpegsave(out_path, Q=92)
    return True, W, H


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
            w["image_source"] = "dpm"
            break
    with open("data.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))


def main():
    print(f"=== 莲鹤方壶 (ww017) 数字文物库采集 ===")
    print(f"  源: {DETAIL_REF}")
    print(f"  瓦片: {BASE}/{LEVEL}/  {COLS}x{ROWS} TS={TS}")

    # 幂等: 原图已存在则跳过下载
    reuse = False
    if os.path.exists(OUT_IMG):
        try:
            chk = vopen(OUT_IMG)
            print(f"  ⊘ 原图已存在({chk.width}x{chk.height}), 跳过下载")
            reuse = True
        except Exception:
            pass

    if not reuse:
        tiles_dir = f"/tmp/_tiles_{WW_ID}"
        shutil.rmtree(tiles_dir, ignore_errors=True)
        os.makedirs(tiles_dir, exist_ok=True)

        t1 = time.time()
        ok, fail = download_tiles(tiles_dir)
        print(f"  下载: {ok}成功 {fail}失败 ({time.time()-t1:.0f}秒)")
        if fail > 5:
            print(f"  ✗ 失败过多, 跳过")
            shutil.rmtree(tiles_dir, ignore_errors=True)
            sys.exit(1)

        ok, W, H = stitch_tiles(tiles_dir, OUT_IMG)
        if not ok:
            print(f"  ✗ 拼接失败")
            shutil.rmtree(tiles_dir, ignore_errors=True)
            sys.exit(1)
        print(f"  ✓ {OUT_IMG} {W}x{H} {os.path.getsize(OUT_IMG)/1024:.0f}KB")
        shutil.rmtree(tiles_dir, ignore_errors=True)

    w, h, cnt = make_our_dzi(SLUG, OUT_IMG)
    print(f"  ✓ DZI {w}x{h} {cnt}瓦片 → dzi/{SLUG}.dzi")

    if os.path.exists(THUMB):
        os.remove(THUMB)
    tw, th = make_thumb(OUT_IMG, THUMB, WW_ID)
    print(f"  ✓ 缩略图 {tw}x{th}")

    update_data(WW_ID, SLUG, THUMB)
    print(f"  ✓ data.json 已更新 (image={THUMB}, dzi=dzi/{SLUG}.dzi, source=dpm)")


if __name__ == "__main__":
    main()
