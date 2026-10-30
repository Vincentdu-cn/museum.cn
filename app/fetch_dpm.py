#!/usr/bin/env python3
"""从故宫博物院 DZI 瓦片 API 批量采集超高清书画原图。

流程 (每件):
  1. tavily search 找故宫详情页 URL (collection/handwriting|paint/XXXXXX.html)
  2. curl 抓详情页 HTML, 提取 DZI XML 路径 (Uploads/tilegenerator/.../img00XX.xml)
  3. 抓 DZI XML 得 Width/Height/TileSize=256/Overlap=1
  4. 下载最大层级所有瓦片, 用 pyvips 拼接 (处理 Overlap=1)
  5. 重切为我们的 DZI (TileSize=256, Overlap=0)
  6. 生成缩略图, 更新 data.json (image/dzi/intro)

故宫 DZI 瓦片 URL 模式:
  https://www.dpm.org.cn/{xml_path 去掉 .xml}_files/{level}/{col}_{row}.jpg
瓦片下载需 User-Agent + Referer header。

用法:
  python3 fetch_dpm.py                    # 采集全部 24 件
  python3 fetch_dpm.py ww071              # 只采集指定 id
  python3 fetch_dpm.py --search-only      # 只搜索详情页URL, 不下载
  python3 fetch_dpm.py --dry-run          # 只打印计划不执行
"""
import json
import math
import os
import re
import sys
import time
import urllib.request
import urllib.error

import pyvips

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

# 待采集: ww_id -> (搜索关键词, slug, 文件名前缀)
TARGETS = {
    # B 类 2 件
    "ww076": ("文彦博 三帖卷 故宫", "wenyanbo_santie", "文彦博三帖卷"),
    "ww093": ("王诜 渔村小雪图 故宫", "wangshen_yucunxiaoxue", "王诜渔村小雪图"),
    # C 类 22 件
    "ww071": ("杜牧 张好好诗 故宫", "dumu_zhanghaohaoshi", "杜牧张好好诗"),
    "ww073": ("杨凝式 神仙起居法帖 故宫", "yangningshi_shenxianqiju", "杨凝式神仙起居法帖"),
    "ww074": ("林逋 自书诗 故宫", "linbu_zishushi", "林逋自书诗"),
    "ww075": ("蔡襄 自书诗 故宫", "caixiang_zishushi", "蔡襄自书诗"),
    "ww079": ("黄庭坚 诸上座 故宫", "huangtingjian_zhushangzuo", "黄庭坚诸上座"),
    "ww080": ("米芾 苕溪诗 故宫", "mifu_tiaoxishi", "米芾苕溪诗"),
    "ww082": ("展子虔 游春图 故宫", "zhanziquan_youcuntu", "展子虔游春图"),
    "ww083": ("韩滉 五牛图 故宫", "hanhuang_wuniutu", "韩滉五牛图"),
    "ww084": ("周昉 挥扇仕女图 故宫", "zhoufang_huishanshinv", "周昉挥扇仕女图"),
    "ww087": ("周文矩 重屏会棋图 故宫", "zhouwenju_chongpinghuiqi", "周文矩重屏会棋图"),
    "ww088": ("胡瓌 卓歇图 故宫", "huguai_zhuoxietu", "胡瓌卓歇图"),
    "ww089": ("顾闳中 韩熙载夜宴图 故宫", "guhongzhong_hanxizaiyeyan", "顾闳中韩熙载夜宴图"),
    "ww090": ("卫贤 高士图 故宫", "weixian_gaoshitu", "卫贤高士图"),
    "ww092": ("黄筌 写生珍禽图 故宫", "huangquan_xieshengzhenqin", "黄筌写生珍禽图"),
    "ww094": ("梁师闵 芦汀密雪图 故宫", "liangshimin_ludingmixue", "梁师闵芦汀密雪图"),
    "ww095": ("李公麟 摹韦偃牧放图 故宫", "ligonglin_moweijanmufang", "李公麟摹韦偃牧放图"),
    "ww096": ("祁序 江山牧放图 故宫", "qixu_jiangshanmufang", "祁序江山牧放图"),
    "ww098": ("王希孟 千里江山图 故宫", "wangximeng_qianlijiangshan", "王希孟千里江山图"),
    "ww099": ("马和之 后赤壁赋图 故宫", "mahezhi_houchibifu", "马和之后赤壁赋图"),
    "ww100": ("赵伯骕 万松金阙图 故宫", "zhaoboshu_wansongjinque", "赵伯骕万松金阙图"),
    "ww101": ("阎立本 步辇图 故宫", "yanliben_buniantu", "阎立本步辇图"),
    "ww183": ("王仁煦 刊谬补缺切韵 故宫", "kanmiu_buqueqieyun", "王仁煦刊谬补缺切韵"),
}

DPM_BASE = "https://www.dpm.org.cn"


def http_get(url, referer=None, timeout=20):
    """带 UA/Referer 的 GET, 返回 bytes。"""
    headers = {"User-Agent": UA}
    if referer:
        headers["Referer"] = referer
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def tavily_search_detail(query):
    """用 tavily MCP 搜索故宫详情页 URL。返回 URL 或 None。
    由调用方通过 mcpScript 实现 (本函数留作占位, 实际搜索在 main 流程中)。
    """
    raise NotImplementedError("tavily 搜索由调用方通过 mcp 工具完成")


def extract_dzi_from_html(html):
    """从详情页 HTML 提取 DZI XML 路径。返回 (xml_path, full_url) 或 None。"""
    m = re.search(r'(Uploads/tilegenerator/dest/files/image/[^"\'\s]+\.xml)', html)
    if not m:
        return None
    xml_path = m.group(1)
    return xml_path, f"{DPM_BASE}/{xml_path}"


def fetch_dzi_size(dzi_xml_url, referer):
    """从 DZI XML 读取 Width/Height。返回 (w, h) 或 None。"""
    try:
        xml = http_get(dzi_xml_url, referer=referer).decode("utf-8", errors="replace")
    except Exception as e:
        print(f"    ✗ 抓 DZI XML 失败: {e}")
        return None
    mw = re.search(r'Width="(\d+)"', xml)
    mh = re.search(r'Height="(\d+)"', xml)
    if not mw or not mh:
        return None
    return int(mw.group(1)), int(mh.group(1))


def download_and_stitch_dpm(dzi_xml_url, W, H, referer, out_path):
    """下载故宫 tilegenerator 最大层级所有瓦片并拼接 (Overlap=1)。返回 True/False。
    瓦片 URL: {xml去掉.xml}_files/{level}/{col}_{row}.jpg, TileSize=256
    """
    TS = 256
    files_base = dzi_xml_url.rsplit(".", 1)[0] + "_files"
    n = math.ceil(math.log2(max(W, H)))
    cols = math.ceil(W / TS)
    rows = math.ceil(H / TS)
    total = cols * rows
    print(f"    瓦片: L{n} {cols}×{rows} = {total} 块")
    return _download_and_stitch(files_base, n, cols, rows, W, H, referer, out_path, TS)


def download_and_stitch_cos(cos_url, W, H, referer, out_path):
    """下载腾讯云COS数字文物库最大层级瓦片并拼接 (Overlap=1)。返回 True/False。
    瓦片 URL: {cos_url}/{level}/{col}_{row}.png, TileSize=510
    """
    TS = 510
    n = math.ceil(math.log2(max(W, H)))
    cols = math.ceil(W / TS)
    rows = math.ceil(H / TS)
    total = cols * rows
    print(f"    瓦片(COS): L{n} {cols}×{rows} = {total} 块")
    return _download_and_stitch(cos_url, n, cols, rows, W, H, referer, out_path, TS)


def _download_and_stitch(base_url, level, cols, rows, W, H, referer, out_path, TS):
    """通用下载+拼接。base_url 不含末尾斜杠的层级前缀。"""
    total = cols * rows
    tiles_dir = f"/tmp/_dpm_tiles_{os.getpid()}"
    os.makedirs(tiles_dir, exist_ok=True)
    ok = fail = 0
    for r in range(rows):
        for c in range(cols):
            fn = f"{tiles_dir}/{c}_{r}.jpg"
            if os.path.exists(fn):
                ok += 1
                continue
            # COS 源文件名是 .png 但实际是 jpg, 统一下载存 .jpg
            url = f"{base_url}/{level}/{c}_{r}.png" if "cos.ap-beijing" in base_url else f"{base_url}/{level}/{c}_{r}.jpg"
            try:
                data = http_get(url, referer=referer, timeout=25)
                with open(fn, "wb") as f:
                    f.write(data)
                ok += 1
            except Exception:
                fail += 1
            if (ok + fail) % 100 == 0:
                print(f"      进度 {ok+fail}/{total}")
        if fail > 20:
            print(f"    ✗ 失败过多({fail}), 放弃")
            return False
    if ok < total * 0.95:
        print(f"    ✗ 成功率过低({ok}/{total})")
        return False
    print(f"    拼接 {ok} 瓦片...")
    try:
        images = []
        for r in range(rows):
            row_tiles = []
            for c in range(cols):
                fn = f"{tiles_dir}/{c}_{r}.jpg"
                if not os.path.exists(fn):
                    continue
                t = pyvips.Image.new_from_file(fn)
                left = 1 if c > 0 else 0
                top = 1 if r > 0 else 0
                t = t.crop(left, top, t.width - left, t.height - top)
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
        full.jpegsave(out_path, Q=92)
        print(f"    ✓ {out_path} {full.width}×{full.height} {os.path.getsize(out_path)/1024:.0f}KB")
    except Exception as e:
        print(f"    ✗ 拼接失败: {e}")
        return False
    finally:
        import shutil
        shutil.rmtree(tiles_dir, ignore_errors=True)
    return True


def make_our_dzi(slug, image_path):
    """重切为我们规格的 DZI (TileSize=256, Overlap=0)。"""
    out_dzi = f"dzi/{slug}.dzi"
    out_dir = f"dzi/{slug}_files"
    if os.path.exists(out_dzi):
        import shutil
        shutil.rmtree(out_dir, ignore_errors=True)
        os.remove(out_dzi)
    im = pyvips.Image.new_from_file(image_path, access="sequential")
    im.dzsave(f"dzi/{slug}", tile_size=256, overlap=0, suffix=".jpg", layout="dz")
    cnt = sum(len(fs) for _, _, fs in os.walk(out_dir))
    return im.width, im.height, cnt


def make_thumb(src_path, out_path):
    """生成缩略图 (与 make_thumbs.py 一致的局部裁切逻辑)。"""
    THUMB_MAX = 1200
    LONG_RATIO = 6.0
    RIGHT_START = {"ww070"}  # 横卷从右截 (本批无此件, 保留逻辑)

    im = pyvips.Image.new_from_file(src_path, access="sequential")
    w, h = im.width, im.height
    is_long = max(w, h) / min(w, h) > LONG_RATIO if min(w, h) > 0 else False
    if is_long:
        try:
            if w > h:
                crop_h = h
                crop_w = min(int(h * 2.5), w)
                left = max(0, w - crop_w - int(w * 0.03)) if "" in RIGHT_START else min(int(w * 0.08), max(0, w - crop_w))
                im = im.crop(left, 0, crop_w, crop_h)
            else:
                crop_w = w
                crop_h = min(int(w * 2.5), h)
                top = min(int(h * 0.3), max(0, h - crop_h))
                im = im.crop(0, top, crop_w, crop_h)
        except (ValueError, TypeError, RuntimeError):
            scale = THUMB_MAX / max(w, h)
            if scale < 1:
                im = im.resize(scale)
    else:
        scale = THUMB_MAX / max(w, h)
        if scale < 1:
            im = im.resize(scale)
    cw, ch = im.width, im.height
    if max(cw, ch) > THUMB_MAX:
        im = im.resize(THUMB_MAX / max(cw, ch))
    if im.bands == 4:
        im = im.flatten(background=[255, 255, 255])
    im.jpegsave(out_path, Q=85)
    return im.width, im.height


def process_one(ww_id, detail_url, slug, file_prefix):
    """处理单件文物。返回 True/False。"""
    print(f"\n{'='*60}")
    print(f"[{ww_id}] {file_prefix}")
    print(f"  详情页: {detail_url}")

    # 1. 抓详情页 HTML, 提取 DZI XML
    try:
        html = http_get(detail_url, referer=detail_url).decode("utf-8", errors="replace")
    except Exception as e:
        print(f"  ✗ 抓详情页失败: {e}")
        return False

    dzi = extract_dzi_from_html(html)
    if not dzi:
        print(f"  ✗ 详情页未找到 DZI XML 路径")
        return False
    xml_path, dzi_xml_url = dzi
    print(f"  DZI XML: {dzi_xml_url}")

    # 2. 读 DZI 尺寸
    size = fetch_dzi_size(dzi_xml_url, detail_url)
    if not size:
        return False
    W, H = size
    print(f"  尺寸: {W}×{H}")

    # 3. 下载瓦片拼接
    out_img = f"img/{file_prefix}_故宫高清.jpg"
    if not download_and_stitch(dzi_xml_url, W, H, detail_url, out_img):
        return False

    # 4. 重切我们的 DZI
    try:
        w, h, cnt = make_our_dzi(slug, out_img)
        print(f"  ✓ DZI: {w}×{h} {cnt}瓦片 → dzi/{slug}.dzi")
    except Exception as e:
        print(f"  ✗ 重切 DZI 失败: {e}")
        return False

    # 5. 生成缩略图
    thumb_path = f"img/thumb_{ww_id}.jpg"
    try:
        if os.path.exists(thumb_path):
            os.remove(thumb_path)
        tw, th = make_thumb(out_img, thumb_path)
        print(f"  ✓ 缩略图: {tw}×{th}")
    except Exception as e:
        print(f"  ✗ 缩略图失败: {e}")
        return False

    return True


def update_data_json(ww_id, slug, new_image, results_log):
    """更新 data.json: image/dzi 字段。简介由后续单独处理。"""
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
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dry = "--dry-run" in sys.argv
    search_only = "--search-only" in sys.argv

    # 指定 id 或全部
    if args:
        targets = {k: v for k, v in TARGETS.items() if k in args}
    else:
        targets = TARGETS

    print(f"=== 待采集: {len(targets)} 件 ===\n")

    if dry:
        for ww_id, (query, slug, prefix) in targets.items():
            print(f"  {ww_id}  {slug:28}  {prefix}")
        return

    # 详情页 URL 通过 mcp tavily 搜索获取 (脚本本身不含 tavily SDK)
    # 这里读取一个 detail_urls.json 映射文件 (由 mcpScript 预先生成)
    urls_file = "detail_urls.json"
    if not os.path.exists(urls_file):
        print(f"✗ 需要 {urls_file} (ww_id -> detail_url 映射)")
        print(f"  请先用 mcpScript 调用 tavily 搜索生成此文件")
        sys.exit(1)

    with open(urls_file, encoding="utf-8") as f:
        detail_urls = json.load(f)

    results = []
    t0 = time.time()
    for ww_id, (query, slug, prefix) in targets.items():
        detail_url = detail_urls.get(ww_id)
        if not detail_url:
            print(f"\n[{ww_id}] ✗ 未找到详情页 URL")
            results.append((ww_id, False, "无URL"))
            continue

        if search_only:
            print(f"  {ww_id} -> {detail_url}")
            continue

        ok = process_one(ww_id, detail_url, slug, prefix)
        if ok:
            new_img = f"img/{prefix}_故宫高清.jpg"
            update_data_json(ww_id, slug, new_img, None)
            results.append((ww_id, True, ""))
        else:
            results.append((ww_id, False, "采集失败"))

    # 汇总
    print(f"\n{'='*60}")
    print(f"=== 采集汇总 ({time.time()-t0:.0f}秒) ===")
    ok = sum(1 for _, s, _ in results if s)
    fail = sum(1 for _, s, _ in results if not s)
    print(f"成功 {ok}, 失败 {fail}")
    for ww_id, s, msg in results:
        print(f"  {'✓' if s else '✗'} {ww_id} {msg}")


if __name__ == "__main__":
    main()
