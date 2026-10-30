#!/usr/bin/env python3
"""把 A 档 9 件的 dzi 路径写入 data.json，并递增版本号。

保持 data.json 原格式: ensure_ascii=False, separators=(',',':'), 无缩进。
幂等: 重复运行不会重复写 dzi 字段。
"""
import json

SLUG_MAP = {
    "ww060": "mwd_t_banner",
    "ww065": "luji_pingfutie",
    "ww066": "wangxun_boyuantie",
    "ww067": "lantingxu_fcs",
    "ww069": "guoquan_shanjianlv",
    "ww070": "huaisu_kusuntie",
    "ww081": "zhaoji_qianziwen",
    "ww091": "dongyuan_shankou",
    "ww148": "yuanqinghua_zhuhan",
}

try:
    with open("data.json", encoding="utf-8") as f:
        data = json.load(f)
except FileNotFoundError:
    raise SystemExit("✗ data.json 不存在，请在项目根目录运行")
except json.JSONDecodeError as e:
    raise SystemExit(f"✗ data.json 解析失败: {e}")

changed = 0
for w in data["wenwu"]:
    slug = SLUG_MAP.get(w["id"])
    if not slug:
        continue
    new_dzi = f"dzi/{slug}.dzi"
    if w.get("dzi") == new_dzi:
        continue
    w["dzi"] = new_dzi
    changed += 1
    print(f"  {w['id']} {w['name']} → {new_dzi}")

try:
    with open("data.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
except OSError as e:
    raise SystemExit(f"✗ 写入 data.json 失败: {e}")

print(f"\n更新 {changed} 条记录，data.json 已写回（保持紧凑格式）")

# 验证
try:
    with open("data.json", encoding="utf-8") as f:
        data2 = json.load(f)
except (OSError, json.JSONDecodeError) as e:
    raise SystemExit(f"✗ 验证读取失败: {e}")
cnt = sum(1 for w in data2["wenwu"] if w.get("dzi"))
print(f"验证: 现有 {cnt} 件文物带 dzi 字段")
for w in data2["wenwu"]:
    if w.get("dzi"):
        print(f"  {w['id']} {w['name']:28} {w['dzi']}")
