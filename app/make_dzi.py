#!/usr/bin/env python3
"""把 A 档 9 件书画大图切片为 DeepZoom 瓦片，供 OpenSeadragon 深缩放。

规范与娄睿墓示例 (dzi/lrm_anma_youqi.dzi) 完全一致：
  - TileSize=256, Overlap=0, Format=jpg
  - 输出 dzi/{slug}.dzi + dzi/{slug}_files/{level}/{col}_{row}.jpg
  - .dzi 文件 schema: http://schemas.microsoft.com/deepzoom/2008

用 pyvips 流式处理，131MP 巨图（善见律）不爆内存。
PNG 源图（善见律）先转 .vips 中间格式再切，避免每层重复解码 PNG。

用法:
  python3 make_dzi.py              # 切片 A 档 9 件
  python3 make_dzi.py --dry-run    # 只打印计划不执行
  python3 make_dzi.py ww065        # 只处理指定 id
"""
import json
import os
import sys
import time

import pyvips

# A 档 9 件: ww_id -> slug (简洁英文，作 dzi 文件名)
TARGETS = {
    "ww060": "mwd_t_banner",        # 马王堆一号墓T型帛画
    "ww065": "luji_pingfutie",      # 陆机《平复帖》
    "ww066": "wangxun_boyuantie",   # 王珣《伯远帖》
    "ww067": "lantingxu_fcs",       # 冯承素摹兰亭序
    "ww069": "guoquan_shanjianlv",  # 国诠《善见律》
    "ww070": "huaisu_kusuntie",     # 怀素《苦筍帖》
    "ww081": "zhaoji_qianziwen",    # 赵佶《草书千字文》
    "ww091": "dongyuan_shankou",    # 董源《山口待渡图》
    "ww148": "yuanqinghua_zhuhan",  # 元青花萧何月下追韩信梅瓶
}


def load_targets():
    """从 data.json 读取每件文物的 image 路径，返回 [(ww_id, slug, image_path, name)]"""
    try:
        with open("data.json", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        raise SystemExit("✗ data.json 不存在，请在项目根目录运行")
    except json.JSONDecodeError as e:
        raise SystemExit(f"✗ data.json 解析失败: {e}")
    by_id = {w["id"]: w for w in data["wenwu"]}
    out = []
    for ww_id, slug in TARGETS.items():
        w = by_id.get(ww_id)
        if not w:
            print(f"  ⚠ {ww_id} 不在 data.json", file=sys.stderr)
            continue
        img = w.get("image")
        if not img or not os.path.exists(img):
            print(f"  ⚠ {ww_id} {w.get('name')} 图片缺失: {img}", file=sys.stderr)
            continue
        out.append((ww_id, slug, img, w["name"]))
    return out


def read_dzi_size(dzi_path):
    """从 .dzi 文件读取 Width/Height。用正则提取，避免 XML 实体解析的 XXE 顾虑。"""
    import re
    try:
        with open(dzi_path, encoding="utf-8") as f:
            txt = f.read()
    except OSError as e:
        raise RuntimeError(f"读取 {dzi_path} 失败: {e}")
    mw = re.search(r'Width="(\d+)"', txt)
    mh = re.search(r'Height="(\d+)"', txt)
    if not mw or not mh or mw.group(1) is None or mh.group(1) is None:
        raise RuntimeError(f"{dzi_path} 缺少 Width/Height")
    return int(mw.group(1)), int(mh.group(1))


def make_dzi(slug, image_path, name):
    """把单张图切为 dzi/{slug}.dzi + dzi/{slug}_files/。返回 (width, height, tile_count)。"""
    out_dzi = f"dzi/{slug}.dzi"
    out_dir = f"dzi/{slug}_files"

    # 若已存在则跳过（幂等）
    if os.path.exists(out_dzi):
        print(f"  ⊘ 已存在，跳过: {out_dzi}")
        w, h = read_dzi_size(out_dzi)
        cnt = sum(len(fs) for _, _, fs in os.walk(out_dir))
        return w, h, cnt

    # 大 PNG 先转 .vips 中间格式（善见律 96MB PNG 重复解码很慢）
    is_png = image_path.lower().endswith(".png")
    size = os.path.getsize(image_path)
    use_vips_tmp = is_png and size > 20 * 1024 * 1024

    if use_vips_tmp:
        tmp = f"/tmp/_dzi_{slug}.vips"
        print(f"  → PNG→vips 中间格式 ({size/1024/1024:.0f}MB): {tmp}")
        pyvips.Image.new_from_file(image_path).write_to_file(tmp)  # type: ignore[attr-defined]
        src = tmp
    else:
        src = image_path
        tmp = ""

    im = pyvips.Image.new_from_file(src, access="sequential")  # type: ignore[call-arg]
    w, h = im.width, im.height  # type: ignore[attr-defined]
    mp = w * h / 1e6
    print(f"  → {name}: {w}×{h} ({mp:.1f}MP)")

    # dzsave: layout='dz' 输出标准 DeepZoom
    # tile_size=256, overlap=0, suffix='.jpg' (默认 Q75，画质足够且体积小)
    im.dzsave(  # type: ignore[attr-defined]
        f"dzi/{slug}",
        tile_size=256,
        overlap=0,
        suffix=".jpg",
        layout="dz",
    )

    if tmp and os.path.exists(tmp):
        try:
            os.remove(tmp)
        except OSError:
            pass

    cnt = sum(len(fs) for _, _, fs in os.walk(out_dir))
    return w, h, cnt


def main():
    dry = "--dry-run" in sys.argv
    only = [a for a in sys.argv[1:] if not a.startswith("--")]

    targets = load_targets()
    if only:
        targets = [t for t in targets if t[0] in only]

    print(f"=== 待切片: {len(targets)} 件 ===\n")
    if dry:
        for ww_id, slug, img, name in targets:
            print(f"  {ww_id}  {slug:22}  {name}")
            print(f"         src: {img}")
        return

    results = []
    t0 = time.time()
    for ww_id, slug, img, name in targets:
        print(f"\n[{ww_id}] {name}")
        try:
            w, h, cnt = make_dzi(slug, img, name)
            results.append((ww_id, slug, w, h, cnt, name))
            print(f"  ✓ {cnt} 瓦片  → dzi/{slug}.dzi")
        except Exception as e:
            print(f"  ✗ 失败: {e}", file=sys.stderr)
            results.append((ww_id, slug, 0, 0, 0, name, str(e)))

    print(f"\n=== 完成，耗时 {time.time()-t0:.1f}s ===")
    print(f"\n{'id':8} {'slug':22} {'尺寸':>14} {'瓦片':>6}  名称")
    print("-" * 80)
    for r in results:
        if len(r) == 7:
            print(f"{r[0]:8} {r[1]:22} {'失败':>14} {0:>6}  {r[5]} ({r[6]})")
        else:
            print(f"{r[0]:8} {r[1]:22} {str(r[2])+'×'+str(r[3]):>14} {r[4]:>6}  {r[5]}")


if __name__ == "__main__":
    main()
