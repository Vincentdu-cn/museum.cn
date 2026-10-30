#!/usr/bin/env python3
"""为有 dzi 字段的文物生成缩略图，并把 image 字段指向缩略图。

借鉴故宫官网详情页做法:
  - 超长卷(宽高比>4): 取局部代表性段落裁切, 而非全卷压缩
  - 正常图: 等比缩放长边到 1200px

缩略图规范:
  - 长边 ≤ 1200px, JPEG Q85
  - 文件名 thumb_{ww_id}.jpg, 放 img/
  - 局部裁切: 从原图左 1/4 处取一块 (避开卷首题签, 取正文起首)
    宽:高 ≈ 2.5:1 (与故宫详情页缩略图比例一致), 长边 1200

幂等: 已存在则跳过 (强制重建删文件后重跑)。
"""
import json
import os
import sys

import pyvips

THUMB_MAX = 1200      # 缩略图长边像素
THUMB_QUALITY = 85
LONG_RATIO = 4.0      # 宽高比超过此值取局部裁切
                       # 横卷书法/山水(比例>6)必取局部;
                       # 立轴(如卫贤高士图 ratio=4.2)也取局部见主体

# 横卷统一从右起截取正文 (书画阅读方向从右往左, 正文在右, 题跋在左)
# 需旋转的文物(千字文/山口待渡)已预先生成正立原图(_正.jpg),
# 故此表仅保留特殊偏移调整, 不再控制截取方向
RIGHT_START_OFFSET = {"ww070": 0.03}   # 怀素苦筍帖: 右起留3%边距


def is_long_scroll(w, h):
    """超长卷: 某一边远大于另一边(>4倍), 需取局部裁切。
    横卷(宽>高)取左段, 立轴(高>宽)取中段。
    """
    if w == 0 or h == 0:
        return False
    return max(w, h) / min(w, h) > LONG_RATIO


def make_thumb(src_path, out_path, ww_id=""):
    """生成缩略图。返回 (width, height, size_kb)。"""
    if os.path.exists(out_path):
        im = pyvips.Image.new_from_file(out_path)  # type: ignore[call-arg]
        return im.width, im.height, os.path.getsize(out_path) / 1024  # type: ignore[attr-defined]

    im = pyvips.Image.new_from_file(src_path, access="sequential")  # type: ignore[call-arg]
    # 注: 需旋转的文物已预生成正立原图(_正.jpg), 此处不再旋转
    w, h = im.width, im.height  # type: ignore[attr-defined]

    if is_long_scroll(w, h):
        # 超长卷: 取局部段落, 比例 ~2.5:1 (与故宫详情页一致)
        # 裁切失败则降级为全图缩放
        try:
            if w > h:
                # 横卷: 高=原图高, 宽=2.5*高
                # 统一从右起截取 (书画从右往左看, 正文在右段)
                crop_h = h
                crop_w = min(int(h * 2.5), w)
                offset = RIGHT_START_OFFSET.get(ww_id, 0)
                left = max(0, w - crop_w - int(w * offset))
                im = im.crop(left, 0, crop_w, crop_h)  # type: ignore[attr-defined]
            else:
                # 立轴: 宽=原图宽, 高=1.8*宽 (取主体局部, 避免整图过长)
                # 裁切起点偏上1/4处 (人物/主体多在上中部)
                crop_w = w
                crop_h = min(int(w * 1.8), h)
                safe_offset = max(0, h - crop_h)
                top = min(int(h * 0.25), safe_offset) if h > crop_h else 0
                im = im.crop(0, top, crop_w, crop_h)  # type: ignore[attr-defined]
        except (ValueError, TypeError, RuntimeError):
            scale = THUMB_MAX / max(w, h)
            if scale < 1:
                im = im.resize(scale)  # type: ignore[attr-defined]
    else:
        # 正常图: 等比缩放保留全图
        scale = THUMB_MAX / max(w, h)
        if scale < 1:
            im = im.resize(scale)  # type: ignore[attr-defined]

    # 局部裁切后, 再确保长边 ≤ THUMB_MAX
    cw, ch = im.width, im.height  # type: ignore[attr-defined]
    if max(cw, ch) > THUMB_MAX:
        im = im.resize(THUMB_MAX / max(cw, ch))  # type: ignore[attr-defined]

    # PNG/带 alpha 转 JPEG 补白底
    if im.bands == 4:  # type: ignore[attr-defined]
        im = im.flatten(background=[255, 255, 255])  # type: ignore[attr-defined]

    im.jpegsave(out_path, Q=THUMB_QUALITY)  # type: ignore[attr-defined]
    return im.width, im.height, os.path.getsize(out_path) / 1024  # type: ignore[attr-defined]


def main():
    try:
        with open("data.json", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        raise SystemExit("✗ data.json 不存在")
    except json.JSONDecodeError as e:
        raise SystemExit(f"✗ data.json 解析失败: {e}")

    changed = 0
    for w in data["wenwu"]:
        dzi = w.get("dzi")
        if not dzi:
            continue
        ww_id = w["id"]
        # 源图: image 字段当前值(原图, 用于生成缩略图)
        src = w.get("image", "")
        # 若已是缩略图, 找对应原图 (thumb_wwXXX → 需知原图名, 这里跳过)
        if src.startswith("img/thumb_"):
            continue
        if not src or not os.path.exists(src):
            print(f"  ⚠ {ww_id} {w['name']} 源图缺失: {src}", file=sys.stderr)
            continue

        thumb_path = f"img/thumb_{ww_id}.jpg"
        tw, th, tkb = make_thumb(src, thumb_path, ww_id)
        old_img = w.get("image")
        w["image"] = thumb_path
        w["has_image"] = True
        if old_img != thumb_path:
            changed += 1
            kind = "局部" if is_long_scroll(*_img_size(src)) else "缩放"
            print(f"  {ww_id} {w['name'][:16]:18} [{kind}] {tw}×{th} {tkb:.0f}KB → {thumb_path}")

    try:
        with open("data.json", "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    except OSError as e:
        raise SystemExit(f"✗ 写入失败: {e}")

    print(f"\n更新 {changed} 条, data.json 已写回")


def _img_size(path):
    """读取图片尺寸, 不全加载。"""
    im = pyvips.Image.new_from_file(path)  # type: ignore[call-arg]
    return im.width, im.height  # type: ignore[attr-defined]


if __name__ == "__main__":
    main()
