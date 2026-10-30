/* 藏珍集 · 文物档案 SPA  v6
   架构：页面外壳（toolbar/input）只渲染一次 → 结果区只在 #results 里局部替换
   中文输入法友好：input/select 元素永远不被销毁，只在结果区播报更新
   hash 路由：#/  #/wenwu  #/wenwu/:id  #/museums  #/museums/:id  */

const state = {
	data: null,
	loaded: false,
	wq: "",
	mq: "",
	wFilters: { batch: "all", era: "all", museum: "all", img: "all" },
	mFilters: { quality: "all", province: "all", topic: "all", img: "all" },
};

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) =>
	String(s ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");

/* ==================== 数据加载 ==================== */
function loadData() {
	if (state.loaded) return Promise.resolve(state.data);
	const ver = window.__DATA_VER || 1;
	return fetch("data.json?v=" + ver)
		.then((r) => r.json())
		.then((d) => {
			state.data = d;
			state.loaded = true;
			d.museumById = {};
			d.museums.forEach((m) => (d.museumById[m.id] = m));
			return d;
		});
}

/* ==================== 图片辅助 ==================== */
/* 文物图：一律原样返回数据里的 image（本地 img/ 或外链 URL），不做任何改写。
   历史 bug：旧逻辑把非维基 URL 硬套维基 thumb 模板，生成缺失 hash 目录的假地址，
   导致 404/HTML → 浏览器 ERR_BLOCKED_BY_ORB 拦截 → 满屏破图。这里彻底去掉改写。 */
function wenwuImg(w) {
	if (!w || !w.image) return null;
	return imgV(w.image);
}

/* 本地图片URL追加版本参数, 换图后强制浏览器刷新缓存(缩略图路径不变仅内容更新时) */
function imgV(src) {
	if (!src || /^https?:/.test(src)) return src;
	const v = window.__DATA_VER || 1;
	const sep = src.includes("?") ? "&" : "?";
	return src + sep + "v=" + v;
}
function eraLabel(e) {
	return e ? e.replace("戰", "战").replace("漢", "汉") : "未知";
}

/* 影像来源：优先用 image_source 字段映射中文，无则按路径兜底 */
const IMG_SOURCE_MAP = {
	dpm: "故宫博物院",
	gugong_local: "故宫博物院",
	wikimedia: "维基共享资源（Wikimedia Commons）",
	baike: "百度百科",
	yac8: "书法欣赏网（yac8.com）",
	jiguzuo: "集故作网（jiguzuo.com）",
	9610: "书法空间（9610.com）",
	"5gtwhbh": "唐代壁画数字珍藏馆（5gtwhbh.com）",
	iiif_npm: "台北故宫博物院（IIIF）",
	twdpm: "台北故宫博物院",
	chnmuseum: "中国国家博物馆（chnmuseum.cn）",
	whw: "文化网（whw.kim）",
	saac: "国家档案局（saac.gov.cn）",
	shuge: "书格（shuge.org）",
	cctv: "央视网（cctv.com）",
};
function imgSource(w, img) {
	if (!img) return "暂无影像收录";
	const s = w.image_source;
	if (s && IMG_SOURCE_MAP[s]) return "影像来源：" + IMG_SOURCE_MAP[s];
	if (s === "user_upload" || s === "user_provided") return "影像来源：用户提供";
	/* 无 source 字段时按路径兜底 */
	if (img.includes("thumb_ww")) return "影像来源：详见馆藏";
	return "影像来源：网络整理";
}

/* 现藏地点：成套文物可能分藏多馆（w.museums_rel），否则单馆 */
function wxrel(w) {
	const rel = (w.museums_rel || []).filter((x) => x && x.id);
	if (!rel.length) {
		return w.museum_name ? esc(w.museum_name) : "未知";
	}
	return rel
		.map((x) => {
			const mm = state.data ? state.data.museumById[x.id] : null;
			return `<a href="#/museums/${esc(x.id)}">${esc(mm ? mm.name : x.name)}</a>`;
		})
		.join("、");
}

function initialPh(name) {
	const n = (name || "？").trim().charAt(0);
	return `<div class="initial-ph" aria-hidden="true">${esc(n)}</div>`;
}

/* 博物馆图片：优先本地图，其次维基外链 URL */
function museumImg(m) {
	if (m.image_file) return `img/museums/${esc(m.image_file)}`;
	if (m.image_url) return esc(m.image_url);
	return null;
}

/* ==================== 筛选逻辑（纯函数） ==================== */
function applyWenwuFilters() {
	const d = state.data,
		arr = d.wenwu,
		f = state.wFilters;
	const wq = state.wq.toLowerCase();
	return arr.filter((w) => {
		if (f.batch !== "all" && String(w.batch) !== f.batch) return false;
		if (f.era !== "all" && w.era !== f.era) return false;
		if (f.museum !== "all" && w.museum_name !== f.museum) return false;
		if (f.img === "only" && !w.has_image) return false;
		if (f.img === "none" && w.has_image) return false;
		if (wq) {
			const hay =
				`${w.name} ${w.era} ${w.museum_name || ""} ${w.category || ""} ${w.intro || ""}`.toLowerCase();
			if (!hay.includes(wq)) return false;
		}
		return true;
	});
}
function applyMuseumFilters() {
	const d = state.data,
		arr = d.museums,
		f = state.mFilters;
	const mq = state.mq.toLowerCase();
	const list = arr.filter((m) => {
		if (f.quality !== "all" && m.quality !== f.quality) return false;
		if (f.province !== "all" && m.province !== f.province) return false;
		if (f.topic !== "all" && m.topic !== f.topic) return false;
		if (f.img === "only" && !m.has_image) return false;
		if (f.img === "none" && m.has_image) return false;
		if (mq) {
			const hay =
				`${m.name} ${m.province} ${m.city} ${m.topic} ${m.address || ""} ${m.intro || ""}`.toLowerCase();
			if (!hay.includes(mq)) return false;
		}
		return true;
	});
	list.sort((a, b) => (b.has_image ? 1 : 0) - (a.has_image ? 1 : 0));
	return list;
}

/* ==================== 卡片 ==================== */
function wwCard(w) {
	const img = wenwuImg(w);
	const ph = initialPh(w.name);
	const cat = w.category || "未分类";
	return `<article class="card">
    <a class="card-figure" href="#/wenwu/${esc(w.id)}" aria-label="${esc(w.name)}">
      ${img ? `<img src="${esc(img)}" alt="${esc(w.name)}" loading="lazy">` : ph}
    </a>
    <div class="card-body">
      <div class="card-tag">批次${w.batch} · ${esc(cat)}</div>
      <h3><a href="#/wenwu/${esc(w.id)}">${esc(w.name)}</a></h3>
      <div class="card-meta">${esc(eraLabel(w.era))}${w.site ? ` · 出土 ${esc(w.site)}` : ""}</div>
      <div class="card-desc">${esc(w.intro || "（暂无简介）")}</div>
      <div class="card-foot">
        ${
									w.museum_linked
										? (
												() => {
													const n = (w.museums_rel || []).length;
													return `<a class="pill" href="#/museums/${esc(w.museum_id)}">藏于 ${esc(w.museum_name)}${n > 1 ? ` 等 ${n} 馆` : ""}</a>`;
												}
											)()
										: `<span class="pill">${esc(w.museum_name || "现藏地未归并")}</span>`
								}
      </div>
    </div>
  </article>`;
}

function mCard(m) {
	const ph = initialPh(m.name);
	const img = museumImg(m);
	return `<article class="card">
    <a class="card-figure" href="#/museums/${esc(m.id)}" aria-label="${esc(m.name)}">
      ${img ? `<img src="${esc(img)}" alt="${esc(m.name)}馆舍影像" loading="lazy">` : ph}
    </a>
    <div class="card-body">
      <div class="card-tag">${esc(m.quality)}博物馆 · ${esc(m.topic)}</div>
      <h3><a href="#/museums/${esc(m.id)}">${esc(m.name)}</a></h3>
      <div class="card-meta">${esc(m.province)}${m.city == m.province ? "" : ` · ${esc(m.city)}`} · ${m.founded ? esc(m.founded.slice(0, 4)) : "馆龄未知"}年${m.is_free ? "" : " · 收费"}</div>
      <div class="card-desc">${esc(m.intro || (m.address ? `${m.address}。` : "") || "（暂无简介）")}</div>
      <div class="card-foot">
        <span class="pill">${m.founded ? "成立于 " + esc(m.founded.slice(0, 4)) + " 年" : "馆龄未载"}</span>
        ${m.is_free ? `<span class="pill">免费开放</span>` : ""}
      </div>
    </div>
  </article>`;
}

/* ==================== 页面渲染 ==================== */
function skeleton(text = "载入中…") {
	return `<div class="skeleton-block">${esc(text)}</div>`;
}

/* 给官网链接补协议：数据里有些存的是裸域名如 www.xxx.com，浏览器会当相对路径 */
function fixUrl(u) {
	if (!u) return u;
	u = String(u).trim();
	if (/^https?:\/\//i.test(u)) return u;
	if (/^www\./i.test(u) || /^[a-z0-9.-]+\.[a-z]{2,}/i.test(u))
		return "https://" + u;
	return u;
}

function renderHome() {
	const { stats } = state.data,
		s = stats;
	const eraTop = Object.entries(stats.era)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 8);
	const provTop = Object.entries(stats.province)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 8);
	const q = stats.quality;
	return `<section class="hero"><div class="wrap">
    <p class="kicker">国家禁止出境展览文物 · 博物馆档案</p>
    <h1>藏百年之珍，<br>记<span class="rule">文物</span>与博物馆</h1>
    <p class="lede">收录自维基百科与国家文物局名录的 <strong>${s.wenwu_count}</strong> 件禁止出境展览文物，以及全国 <strong>${s.museum_count}</strong> 座一、二级博物馆档案。已归并 ${s.wenwu_linked_museum} 件文物的现藏地，一册在手，检阅家底。</p>
    <div class="herostats" role="group" aria-label="数据概览">
      <div class="hstat"><div class="num">${s.wenwu_count}<sup>件</sup></div><div class="lab">禁止出境文物</div></div>
      <div class="hstat"><div class="num">${s.wenwu_linked_museum}<sup>件</sup></div><div class="lab">现藏地已归并</div></div>
      <div class="hstat"><div class="num">${s.museum_count}<sup>座</sup></div><div class="lab">一二级博物馆</div></div>
      <div class="hstat"><div class="num">${q["一级"].count}<sup>座</sup></div><div class="lab">一级博物馆</div></div>
    </div>
  </div></section>
  <section class="homeblock"><div class="wrap">
    <div class="sec-head">
      <div><h2>按时代分布</h2><div class="sec-sub">文物之归属年代 · 点击筛入文物库</div></div>
      <a class="sec-more" href="#/wenwu">浏览全部文物 →</a>
    </div>
    <div class="statchips" id="home-era-chips">
      ${eraTop.map(([k, n]) => `<a class="chip" href="#/wenwu?era=${encodeURIComponent(k)}"><span class="chip-n">${n}</span><span class="chip-l">${esc(eraLabel(k))}</span></a>`).join("")}
    </div>
  </div></section>
  <section class="homeblock alt"><div class="wrap">
    <div class="sec-head">
      <div><h2>按省份分布</h2><div class="sec-sub">博物馆之省域分布 · 点击筛入博物馆库</div></div>
      <a class="sec-more" href="#/museums">浏览全部博物馆 →</a>
    </div>
    <div class="statchips" id="home-prov-chips">
      ${provTop.map(([k, n]) => `<a class="chip" href="#/museums?province=${encodeURIComponent(k)}"><span class="chip-n">${n}</span><span class="chip-l">${esc(k)}</span></a>`).join("")}
    </div>
  </div></section>
  <section class="homeblock"><div class="wrap">
    <div class="sec-head"><div><h2>博物馆等级</h2><div class="sec-sub">一级 ${q["一级"].count} 座 · 二级 ${q["二级"].count} 座</div></div></div>
    <div class="statchips">
      <a class="chip" href="#/museums?quality=一级"><span class="chip-n">${q["一级"].count}</span><span class="chip-l">一级 · ${q["一级"].with_image}座有影像</span></a>
      <a class="chip" href="#/museums?quality=二级"><span class="chip-n">${q["二级"].count}</span><span class="chip-l">二级</span></a>
      <span class="chip" style="cursor:default"><span class="chip-n">${s.museum_with_image}</span><span class="chip-l">座已收影像</span></span>
    </div>
  </div></section>`;
}

/* 文物列表（stable shell：toolbar + results区） */
function renderWenwuList() {
	const d = state.data,
		arr = d.wenwu,
		f = state.wFilters;
	const names = new Set(arr.map((w) => w.museum_name).filter(Boolean));
	const eraOpts = [...new Set(arr.map((w) => w.era).filter(Boolean))].sort();
	const musOpts = [...names].sort();
	return `<div class="frame"><div class="wrap">
    <h1 class="view-title" style="font-size:clamp(2rem,4.5vw,3.2rem)">禁止出境展览文物</h1>
    <p class="view-sub">共 ${d.wenwu.length} 件，分三批公布。</p>
    <div class="toolbar">
      <div class="searchbox">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
        <input id="wsearch" type="search" placeholder="检索文物名称、时代、现藏馆…" value="${esc(state.wq)}" aria-label="检索文物">
      </div>
      <div class="filters">
        <span class="field"><select id="wbatch" aria-label="按批次"><option value="all">全部批次</option><option value="1">第一批（64）</option><option value="2">第二批（37）</option><option value="3">第三批（94）</option></select></span>
        <span class="field"><select id="wera" aria-label="按时代"><option value="all">全部时代</option>${eraOpts.map((e) => `<option value="${esc(e)}" ${f.era === e ? "selected" : ""}>${esc(eraLabel(e))}</option>`).join("")}</select></span>
        <span class="field"><select id="wmus" aria-label="按现藏馆"><option value="all">全部现藏馆</option>${musOpts.map((m) => `<option value="${esc(m)}" ${f.museum === m ? "selected" : ""}>${esc(m)}</option>`).join("")}</select></span>
        <span class="field"><select id="wimg" aria-label="按影像"><option value="all">有图与否不限</option><option value="only" ${f.img === "only" ? "selected" : ""}>有图</option><option value="none" ${f.img === "none" ? "selected" : ""}>缺图</option></select></span>
      </div>
    </div>
    <div id="w-results-wrap"></div>
  </div></div>`;
}

/* 文物结果区局部刷新 */
function refreshWenwuResults() {
	const list = applyWenwuFilters();
	const el = $("#w-results-wrap");
	if (!el) return;
	const countPh = `共 <strong>${list.length}</strong> 件`;
	el.outerHTML = `<div id="w-results-wrap"><div class="result-meta" aria-live="polite">${countPh}</div>
    ${
					list.length
						? `<div class="grid">${list.map(wwCard).join("")}</div>`
						: `<div class="empty"><div class="empty-ic">◆</div><h3>无匹配文物</h3><p>调整筛选或清空搜索后再试。</p></div>`
				}</div>`;
}

function renderMuseumList() {
	const d = state.data,
		arr = d.museums,
		f = state.mFilters;
	const provOpts = Object.keys(d.stats.province).sort();
	const topicOpts = [...new Set(arr.map((m) => m.topic).filter(Boolean))].sort();
	return `<div class="frame"><div class="wrap">
    <h1 class="view-title" style="font-size:clamp(2rem,4.5vw,3.2rem)">博物馆档案</h1>
    <p class="view-sub">全国一、二级博物馆 ${d.museums.length} 座。</p>
    <div class="toolbar">
      <div class="searchbox">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
        <input id="msearch" type="search" placeholder="检索馆名、省市、题材…" value="${esc(state.mq)}" aria-label="检索博物馆">
      </div>
      <div class="filters">
        <span class="field"><select id="mquality" aria-label="按等级"><option value="all">全部</option><option value="一级" ${f.quality === "一级" ? "selected" : ""}>一级 ${d.stats.quality["一级"].count}</option><option value="二级" ${f.quality === "二级" ? "selected" : ""}>二级 ${d.stats.quality["二级"].count}</option></select></span>
        <span class="field"><select id="mprov" aria-label="按省份"><option value="all">全部</option>${provOpts.map((p) => `<option value="${esc(p)}" ${f.province === p ? "selected" : ""}>${esc(p)} ${d.stats.province[p]}</option>`).join("")}</select></span>
        <span class="field"><select id="mtopic" aria-label="按题材"><option value="all">全部题材</option>${topicOpts.map((t) => `<option value="${esc(t)}" ${f.topic === t ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></span>
        <span class="field"><select id="mimg" aria-label="按影像"><option value="all">有图与否不限</option><option value="only" ${f.img === "only" ? "selected" : ""}>有图</option><option value="none" ${f.img === "none" ? "selected" : ""}>缺图</option></select></span>
      </div>
    </div>
    <div id="m-results-wrap"></div>
  </div></div>`;
}

function refreshMuseumResults() {
	const list = applyMuseumFilters();
	const el = $("#m-results-wrap");
	if (!el) return;
	const countPh = `共 <strong>${list.length}</strong> 座博物馆`;
	el.outerHTML = `<div id="m-results-wrap"><div class="result-meta" aria-live="polite">${countPh}</div>
    ${
					list.length
						? `<div class="grid">${list.map(mCard).join("")}</div>`
						: `<div class="empty"><div class="empty-ic">◆</div><h3>无匹配博物馆</h3><p>调整筛选或清空搜索后再试。</p></div>`
				}</div>`;
}

function renderWenwuDetail(id) {
	const d = state.data,
		w = d.wenwu.find((x) => x.id === id);
	if (!w)
		return `${backHome()} <div class="empty"><h3>未找到该文物</h3><p><a href="#/wenwu">返回文物库</a></p></div>`;
	const img = wenwuImg(w),
		mus = w.museum_id ? d.museumById[w.museum_id] : null;
	const dzi = w.dzi;
	return `<section class="detail-hero"><div class="wrap">
    <div class="crumb"><a href="#/">首页</a> / <a href="#/wenwu">禁止出境文物</a> / 第${w.batch}批</div>
    <div class="tagline"><span class="pill">批次${w.batch}</span><span class="pill">${esc(w.category || "未分类")}</span><span class="pill">${esc(eraLabel(w.era))}</span></div>
    <h1 class="detail-title" style="margin-top:16px">${esc(w.name)}</h1>
    ${w.site ? `<p class="detail-sub">出土于 ${esc(w.site)}${w.unearthed_time ? `（${esc(w.unearthed_time)}）` : ""}</p>` : ""}
  </div></section>
  <div class="wrap">
    <div class="detail-grid">
      <figure class="detail-figure">
        <div class="heroimg" id="heroimg-default" ${dzi ? `data-dzi="${esc(dzi)}" role="button" tabindex="0" style="cursor:zoom-in"` : ""}>
          ${
											img
												? dzi
													? `<img src="${esc(img)}" alt="${esc(w.name)}" loading="lazy" title="点击查看高清影像">`
													: `<img src="${esc(img)}" alt="${esc(w.name)}" loading="lazy" lightbox title="点击查看原图">`
												: `<div class="initial-ph" aria-hidden="true" style="font-size:120px">${esc((w.name || "?").charAt(0))}</div>`
										}
        </div>
        <figcaption>${imgSource(w, img)}</figcaption>
      </figure>
      <div class="detail-prose">
        <h2>馆藏档案</h2>
        <div class="lead">${w.intro ? esc(w.intro) : `<span class="muted">（暂无简介）</span>`}</div>
        <dl class="facts">
          <div class="fact"><dt>序号</dt><dd>${esc(w.id)} · 批次${w.batch}</dd></div>
          <div class="fact"><dt>名称</dt><dd>${esc(w.name)}</dd></div>
          <div class="fact"><dt>时代</dt><dd>${esc(eraLabel(w.era))}</dd></div>
          ${w.site ? `<div class="fact"><dt>出土地点</dt><dd>${esc(w.site)}</dd></div>` : ""}
          ${w.unearthed_time ? `<div class="fact"><dt>出土时间</dt><dd>${esc(w.unearthed_time)}</dd></div>` : ""}
          <div class="fact"><dt>现藏地点</dt><dd>${wxrel(w)}</dd></div>
        </dl>
      </div>
    </div>
  </div>`;
}

function backHome() {
	return `<section class="frame"><div class="wrap"><div class="crumb"><a href="#/">首页</a></div></div></section>`;
}

function renderMuseumDetail(id) {
	const d = state.data,
		m = d.museums.find((x) => x.id === id);
	if (!m)
		return `${backHome()} <div class="empty"><h3>未找到该博物馆</h3><p><a href="#/museums">返回博物馆库</a></p></div>`;
	const img = museumImg(m);
	const held = d.wenwu.filter(
		(w) =>
			(w.museums_rel || []).some((x) => x.id === m.id) || w.museum_id === m.id,
	);
	const addr = [m.address].filter(Boolean).join("，");
	return `<section class="detail-hero"><div class="wrap">
    <div class="crumb"><a href="#/">首页</a> / <a href="#/museums">博物馆</a> / ${esc(m.province)}</div>
    <div class="tagline"><span class="pill">${esc(m.quality)}博物馆</span><span class="pill">${esc(m.topic)}</span>${m.is_free ? `<span class="pill">免费开放</span>` : `<span class="pill">收费</span>`}</div>
    <h1 class="detail-title" style="margin-top:16px">${esc(m.name)}</h1>
    <p class="detail-sub">${esc(m.province)}${m.district ? ` · ${esc(m.district)}` : ""}${m.founded ? ` · ${esc(m.founded.slice(0, 4))} 年建成` : ""}</p>
  </div></section>
  <div class="wrap">
    <div class="detail-grid">
      <figure class="detail-figure">
        <div class="heroimg">
          ${img ? `<img src="${esc(img)}" alt="${esc(m.name)}" loading="lazy" lightbox title="点击查看原图">` : `<div class="initial-ph" aria-hidden="true" style="font-size:120px">${esc((m.name || "?").charAt(0))}</div>`}
        </div>
        <figcaption>${img ? "馆舍影像 · 本地收录" : "暂无馆舍影像收录"}</figcaption>
      </figure>
      <div class="detail-prose">
        <h2>馆务档案</h2>
        <dl class="facts">
          <div class="fact"><dt>级别</dt><dd>${esc(m.quality)}博物馆</dd></div>
          <div class="fact"><dt>题材</dt><dd>${esc(m.topic)}</dd></div>
          <div class="fact"><dt>隶属</dt><dd>${esc(m.admin)}</dd></div>
          <div class="fact"><dt>成立</dt><dd>${esc(m.founded || "未载")}</dd></div>
          ${m.exhibitions ? `<div class="fact"><dt>陈列展览</dt><dd>${esc(m.exhibitions)} 个</dd></div>` : ""}
          ${m.hall_area ? `<div class="fact"><dt>展厅面积</dt><dd>${Math.round(m.hall_area).toLocaleString()} ㎡</dd></div>` : ""}
          ${addr ? `<div class="fact"><dt>馆舍地址</dt><dd>${esc(addr)}</dd></div>` : ""}
          ${m.phone ? `<div class="fact"><dt>电话</dt><dd>${esc(m.phone)}</dd></div>` : ""}
          ${m.website ? `<div class="fact"><dt>官网</dt><dd><a href="${esc(fixUrl(m.website))}" target="_blank" rel="noopener">${esc(m.website)} ↗</a></dd></div>` : ""}
          ${m.reservation ? `<div class="fact"><dt>预约</dt><dd>${esc(m.reservation)}</dd></div>` : ""}
        </dl>
      </div>
    </div>
    ${m.intro ? `<div class="detail-prose" style="padding:16px 0 8px; max-width:80ch"><h2>馆舍简介</h2><div class="lead" style="font-size:15.5px;color:var(--ink-soft);white-space:pre-line">${esc(m.intro)}</div></div>` : ""}
    <section class="rel" style="margin-top:40px">
      <div class="rel-head">馆藏禁止出境文物 <span>— 共 ${held.length} 件</span></div>
      ${
							held.length
								? `<div class="grid">${held.map(wwCard).join("")}</div>`
								: `<p style="color:var(--ink-faint)">本馆暂无已归并的禁止出境文物。</p>`
						}
    </section>
  </div>`;
}

/* ==================== 路由与局部刷新 ==================== */
function parseHash() {
	const h = location.hash.replace(/^#/, "") || "/";
	const parts = h.split("/").filter(Boolean);
	if (parts[0]) parts[0] = parts[0].split("?")[0];
	return parts;
}

function applyUrlFilters() {
	const hashPart = location.hash.split("?")[1] || "";
	const urlPart = location.search.replace(/^\?/, "");
	const src = urlPart || hashPart;
	const q = new URLSearchParams(src);
	if (q.get("era")) {
		state.wFilters.era = q.get("era");
		state.wq = "";
	}
	if (q.get("province")) {
		state.mFilters.province = q.get("province");
		state.mq = "";
	}
	if (q.get("quality")) state.mFilters.quality = q.get("quality");
}

async function route() {
	const v = $("#view");
	const parts = parseHash();
	const seg = parts[0] || "home";
	$$(".mainnav a").forEach((a) =>
		a.classList.toggle("active", a.dataset.nav === seg),
	);

	if (!state.loaded) {
		v.innerHTML = skeleton("整理数据载入中…");
		await loadData();
	}

	if (seg === "wenwu") {
		if (parts[1]) {
			v.innerHTML = renderWenwuDetail(parts[1]);
		} else {
			v.innerHTML = renderWenwuList();
			refreshWenwuResults();
			bindListEvents();
		}
	} else if (seg === "museums") {
		if (parts[1]) {
			v.innerHTML = renderMuseumDetail(parts[1]);
		} else {
			v.innerHTML = renderMuseumList();
			refreshMuseumResults();
			bindListEvents();
		}
	} else {
		v.innerHTML = renderHome();
		bindHomeChips();
	}
	window.scrollTo(0, 0);
}

/* ==================== DZI 高清查看器（全屏 overlay） ==================== */
let _dziViewer = null;
function openDziOverlay(dziUrl) {
	// 移除已有的 overlay
	closeDziOverlay();
	// 创建全屏 overlay
	const overlay = document.createElement("div");
	overlay.id = "dzi-overlay";
	overlay.innerHTML = `
    <button class="dzi-close" onclick="closeDziOverlay()" aria-label="关闭">✕</button>
    <div id="dzi-container"></div>
  `;
	document.body.appendChild(overlay);
	document.body.style.overflow = "hidden";

	// 版本查询参数: 强制浏览器重新加载 DZI 瓦片, 避免换图后仍命中旧缓存
	// (DZI 路径不变, 仅内容更新时, 浏览器/OpenSeadragon 会缓存旧瓦片)
	const v = window.__DATA_VER || 1;
	const sep = dziUrl.includes("?") ? "&" : "?";
	const dziUrlV = dziUrl + sep + "v=" + v;

	// 初始化 OpenSeadragon
	_dziViewer = OpenSeadragon({
		id: "dzi-container",
		tileSources: dziUrlV,
		prefixUrl:
			"https://cdn.jsdelivr.net/npm/openseadragon@4.1.0/build/openseadragon/images/",
		// 只保留滚轮缩放，其余交互从简
		gestureSettingsMouse: {
			scrollToZoom: true,
			clickToZoom: false,
			dblClickToZoom: true,
		},
		// 移除所有控件按钮
		showNavigationControl: false,
		showZoomControl: false,
		showHomeControl: false,
		showFullPageControl: false,
		// 缩放边界: 允许缩到足够小以完整容纳整幅图
		minZoomLevel: 0.01,
		// 放大上限: 不设上限(允许放到 100% 原大甚至超采样)
		// 故宫官网做法: 用户可放大到满屏。长卷 fit 后 zoom 需达原图/屏宽倍数,
		// 固定值(如10)对超长卷不够, 故移除上限
		// maxZoomLevel 默认 null = 无上限(受瓦片最高层分辨率约束)
		// 打开时不自动缩放到 home，由 open 事件手动 fit
		zoomPerScroll: 1.2,
		// 平滑体验
		blendTime: 0,
		animationTime: 0.8,
	});

	// open 后精确 fit 整幅图，确保完整无裁切
	_dziViewer.addOnceHandler("open", () => {
		const vp = _dziViewer.viewport;
		const bounds = _dziViewer.world.getItemAt(0).getBounds();
		vp.fitBounds(bounds, false);
	});

	// ESC 关闭
	document.addEventListener("keydown", _dziEscHandler);
}

function _dziEscHandler(e) {
	if (e.key === "Escape") closeDziOverlay();
}

function closeDziOverlay() {
	if (_dziViewer) {
		_dziViewer.destroy();
		_dziViewer = null;
	}
	const overlay = document.getElementById("dzi-overlay");
	if (overlay) overlay.remove();
	document.body.style.overflow = "";
	document.removeEventListener("keydown", _dziEscHandler);
}

/* ==================== 事件绑定 ==================== */
function bindHomeChips() {
	$$("#view a.chip").forEach((a) =>
		a.addEventListener("click", (e) => {
			e.preventDefault();
			const href = a.getAttribute("href");
			const i = href.indexOf("?");
			if (i < 0) {
				location.hash = href;
				return;
			}
			const base = href.slice(0, i);
			const q = new URLSearchParams(href.slice(i + 1));
			if (base.includes("wenwu")) {
				if (q.get("era")) {
					state.wFilters.era = q.get("era");
					state.wq = "";
				}
				state.wFilters.batch = "all";
				state.wFilters.museum = "all";
				state.wFilters.img = "all";
			}
			if (base.includes("museums")) {
				if (q.get("province")) {
					state.mFilters.province = q.get("province");
					state.mq = "";
				}
				if (q.get("quality")) state.mFilters.quality = q.get("quality");
				state.mFilters.topic = "all";
				state.mFilters.img = "all";
			}
			location.hash = base;
		}),
	);
}

function bindListEvents() {
	const w = $("#wsearch");
	if (w) {
		w.addEventListener("input", () => {
			state.wq = w.value.trim();
			refreshWenwuResults();
		});
		const ws = $("#wbatch");
		if (ws)
			ws.addEventListener("change", () => {
				state.wFilters.batch = ws.value;
				refreshWenwuResults();
			});
		const we = $("#wera");
		if (we)
			we.addEventListener("change", () => {
				state.wFilters.era = we.value;
				refreshWenwuResults();
			});
		const wm = $("#wmus");
		if (wm)
			wm.addEventListener("change", () => {
				state.wFilters.museum = wm.value;
				refreshWenwuResults();
			});
		const wi = $("#wimg");
		if (wi)
			wi.addEventListener("change", () => {
				state.wFilters.img = wi.value;
				refreshWenwuResults();
			});
	}
	const m = $("#msearch");
	if (m) {
		m.addEventListener("input", () => {
			state.mq = m.value.trim();
			refreshMuseumResults();
		});
		const mq = $("#mquality");
		if (mq)
			mq.addEventListener("change", () => {
				state.mFilters.quality = mq.value;
				refreshMuseumResults();
			});
		const mp = $("#mprov");
		if (mp)
			mp.addEventListener("change", () => {
				state.mFilters.province = mp.value;
				refreshMuseumResults();
			});
		const mt = $("#mtopic");
		if (mt)
			mt.addEventListener("change", () => {
				state.mFilters.topic = mt.value;
				refreshMuseumResults();
			});
		const mi = $("#mimg");
		if (mi)
			mi.addEventListener("change", () => {
				state.mFilters.img = mi.value;
				refreshMuseumResults();
			});
	}
}

/* ==================== 灯箱（lightbox） ==================== */
/* 详情页主图点击放大看原图。事件委托，无需随页面重建绑定。 */
function openLightbox(src, alt) {
	let ov = document.getElementById("lightbox");
	if (!ov) {
		ov = document.createElement("div");
		ov.id = "lightbox";
		ov.className = "lightbox";
		ov.setAttribute("role", "dialog");
		ov.setAttribute("aria-modal", "true");
		ov.innerHTML =
			'<button class="lb-close" aria-label="关闭">&times;</button><img class="lb-img" src="" alt=""><div class="lb-cap"></div>';
		document.body.appendChild(ov);
		ov.addEventListener("click", (e) => {
			if (e.target !== ov && !e.target.classList.contains("lb-close")) return;
			closeLightbox();
		});
	}
	document.addEventListener("keydown", function escLb(e) {
		if (e.key === "Escape") {
			closeLightbox();
			document.removeEventListener("keydown", escLb);
		}
	});
	ov.querySelector(".lb-img").src = src;
	ov.querySelector(".lb-img").alt = alt || "";
	ov.querySelector(".lb-cap").textContent = alt || "";
	ov.classList.add("open");
	ov.querySelector(".lb-img").focus();
	document.body.classList.add("lb-lock");
}
function closeLightbox() {
	const ov = document.getElementById("lightbox");
	if (ov) ov.classList.remove("open");
	document.body.classList.remove("lb-lock");
}
/* 事件委托：img[lightbox] 点击打开灯箱；[data-dzi] 点击打开高清查看器 */
document.addEventListener("click", (e) => {
	const lb = e.target.closest && e.target.closest("img[lightbox]");
	if (lb) {
		e.preventDefault();
		openLightbox(lb.getAttribute("src"), lb.getAttribute("alt") || "");
		return;
	}
	const dz = e.target.closest && e.target.closest("[data-dzi]");
	if (dz) {
		e.preventDefault();
		openDziOverlay(dz.getAttribute("data-dzi"));
		return;
	}
});

/* ==================== 启动 ==================== */
window.addEventListener("hashchange", () => {
	applyUrlFilters();
	route();
});

(async () => {
	try {
		await loadData();
	} catch (e) {
		console.error(e);
	}
	applyUrlFilters();
	await route();
	// route() 内部已按需渲染并绑定事件（列表→bindListEvents，首页→bindHomeChips）
	// 填写 nav 中的计数徽标
	const wc = $("#nav-wenwu-count"),
		mc = $("#nav-museum-count");
	if (wc && state.data) wc.textContent = state.data.stats.wenwu_count;
	if (mc && state.data) mc.textContent = state.data.stats.museum_count;
})();
