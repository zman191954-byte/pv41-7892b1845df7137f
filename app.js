(function () {
  "use strict";

  const D = window.PRETTIER;
  const products = D.products;
  const P = Object.fromEntries(products.map((p) => [p.id, p]));
  const L = Object.fromEntries(D.looks.map((l) => [l.id, l]));
  const PAIRS = D.pairings;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi));
  const uniq = (a) => [...new Set(a)];
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const AI_TITLE = "AI 合成佩戴效果图：底图来自 Cider，仅供内部评审，不可公开；手串细节未做实物级核验";
  const REF_TITLE = "服装参考图：来自 Cider／COS 页面，模特未佩戴本款手串；同框图待制作，仅供内部评审";

  const isComposite = (pr) => L[pr.look].kind === "composite";
  const byCompositeFirst = (a, b) => Number(isComposite(b)) - Number(isComposite(a));
  const pairsOf = (pid) => PAIRS.filter((x) => x.product === pid);
  const pairsInStyle = (s) => PAIRS.filter((x) => x.styles.includes(s)).sort(byCompositeFirst);
  const byMoodRank = (m) => (a, b) => byCompositeFirst(a, b) || (a.rank?.[m] ?? 9) - (b.rank?.[m] ?? 9);
  const pairsInMood = (m) => PAIRS.filter((x) => x.moods[m]).sort(byMoodRank(m));
  const pairsOfType = (t) => PAIRS.filter((x) => L[x.look].outfitTypes.includes(t)).sort(byCompositeFirst);
  const productStyles = (p) => uniq([...(p.styles || []), ...pairsOf(p.id).flatMap((x) => x.styles)]);
  const productMoods = (p) => uniq([...(p.moods || []), ...pairsOf(p.id).flatMap((x) => Object.keys(x.moods))]);
  const stylesInUse = () => D.nav.Style.filter((s) => products.some((p) => productStyles(p).includes(s)));
  const productsInStyle = (s) => products.filter((p) => productStyles(p).includes(s));
  const productsInMood = (m) => products.filter((p) => productMoods(p).includes(m));

  const pdpUrl = (pid, ctx, look) => {
    const q = new URLSearchParams({ id: pid });
    if (ctx) q.set(ctx.type, ctx.value);
    if (look) q.set("look", look);
    return "product.html?" + q;
  };
  const moodUrl = (m) => "mood.html?" + new URLSearchParams({ m });
  const styleUrl = (s) => "style.html?" + new URLSearchParams({ s });
  const outfitUrl = (t) => "list.html?" + new URLSearchParams({ outfit: t });
  const defaultCtx = (pr) => (pr.styles.length ? { type: "style", value: pr.styles[0] } : { type: "mood", value: Object.keys(pr.moods)[0] });

  /* ---------- media: composites are cropped around the wrist, references show the outfit plus the bracelet ---------- */

  function crop(look, mode = "look", opts = {}) {
    const p = P[look.product];
    const cls = ["crop", opts.cls || ""].join(" ").trim();
    const zoom = opts.zoom ? ` data-zoom="${opts.zoom}"` : "";
    const hotspot = opts.hotspot
      ? `<span class="hotspot" aria-hidden="true"><span class="dot"></span><span class="tag">Wearing <b>${esc(p.name)}</b></span></span>`
      : "";
    const badge = mode === "wrist" || opts.badge === false ? "" : `<span class="ai-badge" title="${AI_TITLE}">AI composite</span>`;
    const alt = mode === "wrist" ? `Close-up of ${p.name} on the wrist` : `${look.title}, wearing the ${p.name} bracelet`;
    return `<div class="${cls}" data-look="${look.id}" data-mode="${mode}"${zoom}><img src="${look.image}" alt="${esc(alt)}" draggable="false">${hotspot}${badge}</div>`;
  }

  function refMedia(look, p, opts = {}) {
    const pair = p && opts.pair !== false
      ? `<span class="pair-inset"><img src="${p.wear}" alt=""></span><span class="pair-tag">Pair with <b>${esc(p.name)}</b></span>`
      : "";
    const badge = opts.badge === false ? "" : `<span class="ref-badge" title="${REF_TITLE}">Outfit reference</span>`;
    return `<div class="ref-media ${opts.cls || ""}"><img src="${look.image}" alt="${esc(look.title)}" loading="lazy">${badge}${pair}</div>`;
  }

  function media(pr, opts = {}) {
    const look = L[pr.look];
    return look.kind === "composite" ? crop(look, opts.mode || "look", opts) : refMedia(look, P[pr.product], opts);
  }

  function layoutCrop(el) {
    const look = L[el.dataset.look];
    const img = el.querySelector("img");
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    if (!look || !img || !cw || !ch) return;
    const W = look.w;
    const H = look.h;
    const mode = el.dataset.mode;
    let fx, fy, zoom;
    if (mode === "wrist") {
      [fx, fy] = look.bracelet;
      zoom = Number(el.dataset.zoom || 0.26);
    } else if (mode === "torso" && look.torso) {
      [fx, fy, zoom] = look.torso;
    } else {
      [fx, fy] = look.focus;
      zoom = Number(el.dataset.zoom || 1);
    }
    let w = W * zoom;
    let h = w / (cw / ch);
    if (h > H) { h = H; w = h * (cw / ch); }
    if (w > W) { w = W; h = w / (cw / ch); }
    let x = clamp(fx - w / 2, 0, W - w);
    let y = clamp(fy - h / 2, 0, H - h);
    if (mode !== "wrist") {
      const [bx, by] = look.bracelet;
      const m = 0.12;
      if (by < y + h * m) y = clamp(by - h * m, 0, H - h);
      if (by > y + h * (1 - m)) y = clamp(by - h * (1 - m), 0, H - h);
      if (bx < x + w * m) x = clamp(bx - w * m, 0, W - w);
      if (bx > x + w * (1 - m)) x = clamp(bx - w * (1 - m), 0, W - w);
    }
    const s = cw / w;
    img.style.width = `${W * s}px`;
    img.style.height = `${H * s}px`;
    img.style.transform = `translate(${-x * s}px, ${-y * s}px)`;
    const hs = el.querySelector(".hotspot");
    if (hs) {
      const [bx, by] = look.bracelet;
      hs.style.left = `${(bx - x) * s}px`;
      hs.style.top = `${(by - y) * s}px`;
      hs.classList.toggle("flip", (bx - x) / w > 0.52);
    }
  }

  const observer = new ResizeObserver((entries) => entries.forEach((e) => layoutCrop(e.target)));
  function mountCrops(root = document) {
    $$(".crop[data-look]", root).forEach((el) => {
      layoutCrop(el);
      observer.observe(el);
    });
  }
  function unmountCrops(root) {
    $$(".crop[data-look]", root).forEach((el) => observer.unobserve(el));
  }

  /* ---------- shared chrome ---------- */

  const ICON = {
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 6h18M3 12h18M3 18h18"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 5l14 14M19 5L5 19"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>',
    bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6.5a3 3 0 016 0V8"/></svg>',
  };

  function menuLists() {
    const moods = D.nav.Mood.map((m) => `<li><a href="${moodUrl(m)}">${esc(m)}</a></li>`).join("");
    const styles = stylesInUse().map((s) => `<li><a href="${styleUrl(s)}">${esc(s)}</a></li>`).join("");
    const outfits = D.nav.Outfit.map((t) =>
      pairsOfType(t).length ? `<li><a href="${outfitUrl(t)}">${esc(t)}</a></li>` : `<li class="soon">${esc(t)}<small>Soon</small></li>`
    ).join("");
    return { moods, styles, outfits };
  }

  function renderChrome() {
    const lists = menuLists();
    const top = document.createElement("div");
    top.innerHTML = `
      <div class="proto-bar">内部原型 v4.1 · 本链接于 2026年11月01日 12:35（北京时间）关闭。合成图为 AI 合成佩戴效果、服装参考图未戴本款手串（底图均来自 Cider／COS），仅供内部评审，不可公开；价格与交易未接入
        <button type="button" id="notes-toggle" aria-pressed="false">显示设计说明</button></div>
      <div class="announce">Start with a bracelet or with your clothes. We show you how they go together.</div>
      <header class="site-header">
        <div class="header-row">
          <div class="header-left">
            <button class="icon-btn menu-btn" type="button" id="menu-btn" aria-label="Open menu" aria-expanded="false" aria-controls="drawer">${ICON.menu}</button>
            <nav class="main-nav" aria-label="Main">
              <button type="button" id="shop-btn" aria-expanded="false" aria-controls="mega">Shop</button>
              <a href="index.html#looks">Edits</a>
              <a href="index.html#about">About prettier</a>
            </nav>
          </div>
          <a class="logo" href="index.html" aria-label="prettier home">prettier</a>
          <div class="header-tools">
            <button class="icon-btn" type="button" aria-label="Search" data-proto="本原型未包含搜索">${ICON.search}</button>
            <button class="icon-btn" type="button" aria-label="Bag" data-proto="本原型未接入购物袋与结账">${ICON.bag}</button>
          </div>
        </div>
        <div class="mega" id="mega" hidden>
          <div class="mega-inner v2">
            <div class="mega-group a">
              <p class="side-label"><i>A</i>Start with a bracelet</p>
              <div class="cols">
                <div><h4>By mood</h4><ul>${lists.moods}</ul></div>
                <div><h4>Browse</h4><ul>
                  <li><a href="list.html?all=1">All bracelets</a></li>
                  <li><a href="index.html#ways">One bracelet, many ways</a></li>
                </ul></div>
              </div>
            </div>
            <div class="mega-group b">
              <p class="side-label"><i>B</i>Start with your clothes</p>
              <div class="cols">
                <div><h4>By style</h4><ul class="two-col">${lists.styles}</ul></div>
                <div><h4>By what you're wearing</h4><ul>${lists.outfits}</ul></div>
              </div>
            </div>
          </div>
        </div>
      </header>
      <div class="drawer" id="drawer" aria-hidden="true">
        <div class="drawer-backdrop" data-close></div>
        <div class="drawer-panel" role="dialog" aria-label="Menu">
          <div class="drawer-head"><a class="logo" href="index.html">prettier</a>
            <button class="icon-btn" type="button" data-close aria-label="Close menu">${ICON.close}</button></div>
          <p class="side-label" style="color:var(--side-a-ink)">A · Start with a bracelet</p>
          <h4>By mood</h4><ul class="chips">${lists.moods}</ul>
          <ul style="margin-top:12px"><li><a href="list.html?all=1">All bracelets</a></li><li><a href="index.html#ways" data-close>One bracelet, many ways</a></li></ul>
          <p class="side-label" style="color:var(--side-b-ink);margin-top:28px">B · Start with your clothes</p>
          <h4>By style</h4><ul class="chips">${lists.styles}</ul>
          <h4>By what you're wearing</h4><ul class="chips">${lists.outfits}</ul>
          <ul style="margin-top:24px"><li><a href="index.html#about" data-close>About prettier</a></li></ul>
        </div>
      </div>`;
    document.body.prepend(...top.children);

    const foot = document.createElement("footer");
    foot.className = "site-footer";
    foot.innerHTML = `
      <div class="wrap">
        <div class="footer-grid">
          <div><a class="logo" href="index.html">prettier</a><p style="max-width:300px;margin:14px 0 0;font-size:14px">Crystal bracelets, shown with the outfits they work with.</p></div>
          <div><h4>Start with a bracelet</h4><ul><li><a href="${moodUrl("Soft")}">By mood</a></li><li><a href="list.html?all=1">All bracelets</a></li></ul></div>
          <div><h4>Start with your clothes</h4><ul><li><a href="${styleUrl("Romantic")}">By style</a></li><li><a href="${outfitUrl("Dresses")}">By what you're wearing</a></li></ul></div>
          <div><h4>Help</h4><ul><li><a href="index.html#help">Sizing guide</a></li><li><a href="index.html#help">Materials &amp; care</a></li><li><a href="index.html#help">Shipping &amp; returns</a></li></ul></div>
        </div>
        <p class="footer-note">内部原型 v4.1：评审链接于 2026年11月01日 12:35（北京时间）关闭。英文为候选文案；价格、库存、配送与退换均未确认，未填写；人物图为 AI 合成效果或服装参考图，不可公开使用。</p>
      </div>`;
    document.body.append(foot);

    const toastEl = document.createElement("div");
    toastEl.className = "toast";
    toastEl.setAttribute("role", "status");
    document.body.append(toastEl);
    let toastTimer;
    window.prettierToast = (msg) => {
      toastEl.textContent = msg;
      toastEl.classList.add("show");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2600);
    };
    document.addEventListener("click", (e) => {
      const t = e.target.closest("[data-proto]");
      if (t) { e.preventDefault(); window.prettierToast(t.dataset.proto); }
    });

    const shopBtn = $("#shop-btn");
    const mega = $("#mega");
    const setMega = (open) => {
      mega.hidden = !open;
      shopBtn.setAttribute("aria-expanded", String(open));
    };
    shopBtn.addEventListener("click", () => setMega(mega.hidden));
    document.addEventListener("click", (e) => {
      if (!mega.hidden && !e.target.closest("#mega, #shop-btn")) setMega(false);
    });
    mega.addEventListener("click", (e) => { if (e.target.closest("a")) setMega(false); });

    const drawer = $("#drawer");
    const menuBtn = $("#menu-btn");
    const setDrawer = (open) => {
      drawer.classList.toggle("open", open);
      drawer.setAttribute("aria-hidden", String(!open));
      menuBtn.setAttribute("aria-expanded", String(open));
      document.body.style.overflow = open ? "hidden" : "";
      if (open) $(".drawer-panel a", drawer)?.focus();
      else menuBtn.focus({ preventScroll: true });
    };
    menuBtn.addEventListener("click", () => setDrawer(true));
    drawer.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) setDrawer(false); });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!mega.hidden) { setMega(false); shopBtn.focus(); }
      if (drawer.classList.contains("open")) setDrawer(false);
    });
  }

  /* ---------- shared cards ---------- */

  function lookThumb(pr) {
    const look = L[pr.look];
    const pos = look.kind === "composite" ? `${(look.focus[0] / look.w) * 100}% ${(look.focus[1] / look.h) * 100}%` : "50% 22%";
    return `<a href="${pdpUrl(pr.product, defaultCtx(pr), pr.look)}" title="${esc(look.title)}"><img src="${look.image}" alt="${esc(look.title)}" style="object-position:${pos}" loading="lazy"></a>`;
  }

  function productCard(p) {
    const prs = pairsOf(p.id).slice().sort(byCompositeFirst);
    const [x, y, s] = p.crop || [50, 50, 1];
    return `<article class="shop-card" data-colour="${esc(p.colour || "")}">
      <a class="sc-media" href="${pdpUrl(p.id)}" aria-label="${esc(p.name)}" style="--x:${x}%;--y:${y}%;--s:${s}">
        <span class="sc-lens"><img class="sc-a" src="${p.image}" alt="${esc(p.name)} bracelet" loading="lazy"><img class="sc-b" src="${p.wear}" alt="" loading="lazy"></span>
        <span class="sc-badge">Supplier photo</span>
      </a>
      <div class="sc-body">
        <h3><a href="${pdpUrl(p.id)}">${esc(p.name)}</a></h3>
        <p class="sc-sub">${esc(p.subtitle)}</p>
        <div class="sc-worn">${prs.length
          ? `<span>Worn with</span><div class="sc-thumbs">${prs.slice(0, 3).map(lookThumb).join("")}</div>${prs.length > 3 ? `<em>+${prs.length - 3}</em>` : ""}`
          : `<span class="none">Outfits coming</span>`}</div>
        <p class="sc-meta">Price TBC</p>
      </div>
    </article>`;
  }

  function outfitCard(pr, ctx, opts = {}) {
    const look = L[pr.look];
    const p = P[pr.product];
    const href = pdpUrl(p.id, ctx, pr.look);
    const why = ctx.type === "mood" ? pr.moods[ctx.value] : pr.styleWhy;
    const styleChips = pr.styles.slice(0, 2).map((s) => `<span class="style">${esc(s)}</span>`).join("");
    const chips = opts.chips === "styles"
      ? `${styleChips}<span>${esc(look.label || look.outfitTypes[0] || "")}</span>`
      : styleChips;
    return `<article class="o-card" data-types="${esc(look.outfitTypes.join("|"))}">
      <a class="o-media" href="${href}" aria-label="${esc(look.title)} with ${esc(p.name)}">
        ${media(pr, { hotspot: true })}
        ${look.kind === "composite" ? crop(look, "wrist", { cls: "wrist-inset", zoom: 0.2 }) : ""}
      </a>
      <div class="chips-line">${chips}</div>
      <h5>${esc(look.title)}</h5>
      <p class="o-with">${opts.showProduct ? `With <b>${esc(p.name)}</b>` : ""}</p>
      <p class="o-why">${esc(why || "")}</p>
      <a class="text-link" href="${href}">Wear it like this</a>
    </article>`;
  }

  function leadCard(p, mood, opts = {}) {
    const why = p.en?.moods?.[mood];
    const href = pairsOf(p.id).some((x) => x.moods[mood]) ? pdpUrl(p.id, { type: "mood", value: mood }) : pdpUrl(p.id);
    return `<div class="lead-card">
      <a class="lead-media" href="${href}"><img src="${p.wear}" alt="${esc(p.name)} on the wrist"><span class="src-badge">Supplier photo · on the wrist</span></a>
      <div class="lead-body">
        ${opts.word ? `<p class="mood-word">${esc(mood)}</p><p class="mood-def">${esc(D.moodDef[mood])}</p>` : ""}
        <h4>${esc(p.name)}</h4>
        <p style="margin:0 0 12px;font-size:12.5px;color:var(--muted)">${esc(p.subtitle)}</p>
        ${why ? `<p class="why-feel"><span>Why it feels ${esc(mood.toLowerCase())}</span>${esc(why)}</p>` : ""}
        <a class="text-link" href="${href}">See ${esc(p.name)}</a>
      </div>
    </div>`;
  }

  function tabList(root, ids, render, label) {
    root.innerHTML = ids.map((id) => {
      const p = P[id];
      return `<button class="ways-tab" type="button" role="tab" data-pid="${id}" aria-selected="false">
        <img src="${p.image}" alt=""><div><strong>${esc(p.name)}</strong><span>${esc(label(p))}</span></div></button>`;
    }).join("");
    const select = (pid, focus) => {
      $$(".ways-tab", root).forEach((b) => {
        const on = b.dataset.pid === pid;
        b.setAttribute("aria-selected", String(on));
        b.tabIndex = on ? 0 : -1;
        if (on && focus) b.focus();
      });
      render(pid);
    };
    root.addEventListener("click", (e) => { const b = e.target.closest(".ways-tab"); if (b) select(b.dataset.pid); });
    root.addEventListener("keydown", (e) => {
      if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
      const cur = ids.indexOf($('.ways-tab[aria-selected="true"]', root).dataset.pid);
      select(ids[(cur + (e.key === "ArrowRight" ? 1 : ids.length - 1)) % ids.length], true);
    });
    select(ids[0]);
  }

  /* ---------- homepage ---------- */

  const styleCtx = (pr) => ({ type: "style", value: pr.styles[0] });
  const pairOf = (pid, look) => PAIRS.find((x) => x.product === pid && x.look === look);

  function lookTile(pr, label) {
    const look = L[pr.look];
    const p = P[pr.product];
    return `<a class="look-tile" href="${pdpUrl(p.id, styleCtx(pr), look.id)}">
      ${crop(look, "look", { hotspot: true })}
      ${crop(look, "wrist", { cls: "wrist-inset" })}
      <div class="caption"><h3>${esc(look.title)}</h3><p>${esc(label)} · Wearing <b>${esc(p.name)}</b></p></div>
    </a>`;
  }

  function renderHome() {
    const H = D.homepage;

    const hero = L[H.hero_look];
    const hp = P[hero.product];
    const heroHref = pdpUrl(hp.id, defaultCtx(pairOf(hp.id, hero.id)), hero.id);
    $("#hero-media").innerHTML = `<a href="${heroHref}" aria-label="${esc(hero.title)}: view the ${esc(hp.name)} bracelet">${crop(hero, "look", { hotspot: true })}</a>`;
    $("#hero-inlook").innerHTML = `<a class="in-look" href="${heroHref}">
      ${crop(hero, "wrist")}
      <div><small>In this look</small><strong>${esc(hp.name)}</strong><span>${esc(hp.subtitle)}</span><span class="text-link">View the bracelet</span></div>
    </a>`;

    const gw = pairOf(L[H.gallery_wide].product, H.gallery_wide);
    const gl = L[gw.look];
    const gp = P[gw.product];
    const gwHref = pdpUrl(gp.id, styleCtx(gw), gl.id);
    $("#look-wide").innerHTML = `
      <a class="media" href="${gwHref}" aria-label="${esc(gl.title)}">${crop(gl, "look", { hotspot: true })}</a>
      <div class="copy">
        <span class="num">Look 01 · ${esc(gw.styles.join(" · "))}</span>
        <h3 class="display-sm">${esc(gl.title)}</h3>
        <p class="with">${esc(gl.with)}</p>
        <p class="why">${esc(gw.styleWhy)}</p>
        <p class="closet"><span>In your closet</span>${esc(gw.closet)}</p>
        <a class="mini-product" href="${gwHref}"><img src="${gp.image}" alt=""><div><strong>${esc(gp.name)}</strong><span>${esc(gp.subtitle)} · Shop the bracelet</span></div></a>
      </div>`;
    $("#look-pair").innerHTML = H.gallery_tall.map((id, i) => lookTile(pairOf(L[id].product, id), `Look 0${i + 2}`)).join("");

    tabList($("#ways-tabs"), H.ways.map((w) => w.product), renderOne, (p) => plural(H.ways.find((w) => w.product === p.id).looks.length, "outfit"));
    initMoods();
    initStyles();
    renderGarments();
    tabList($("#closer-tabs"), D.lookCloser.items.map((i) => i.product), renderCloser, (p) => p.subtitle.split("·")[0].trim());
    initShop();
    mountCrops();
  }

  function renderOne(pid) {
    const p = P[pid];
    const prs = D.homepage.ways.find((w) => w.product === pid).looks.map((id) => pairOf(pid, id));
    $("#ways-product").innerHTML = `<p>${esc(p.en?.lede || p.subtitle)}</p><a class="text-link" href="${pdpUrl(pid)}">View ${esc(p.name)}</a>`;
    const grid = $("#ways-grid");
    unmountCrops(grid);
    grid.style.setProperty("--cols", prs.length);
    grid.innerHTML = prs.map((pr) => {
      const look = L[pr.look];
      const href = pdpUrl(pid, styleCtx(pr), pr.look);
      const m = look.kind === "composite"
        ? `${crop(look, "look")}${crop(look, "wrist", { cls: "wrist-inset", zoom: 0.19 })}`
        : refMedia(look, p);
      return `<article class="way-card">
        <a class="way-media" href="${href}" aria-label="${esc(look.title)}">
          ${m}
          <span class="media-chip">${esc(pr.styles.slice(0, 2).join(" · "))}</span>
        </a>
        <h3>${esc(look.title)}</h3>
        <p class="why">${esc(pr.short || pr.styleWhy)}</p>
        <p class="closet"><span>In your closet</span>${esc(pr.closet)}</p>
        <a class="text-link" href="${href}">Wear it like this</a>
      </article>`;
    }).join("");
    mountCrops(grid);
  }

  function initMoods() {
    const order = D.homepage.mood_order;
    const tabs = $("#mood-tabs");
    tabs.innerHTML = order.map((m) => `<button class="mood-tab" type="button" role="tab" data-mood="${m}" aria-selected="false">${esc(m)}</button>`).join("");
    const select = (m, focus) => {
      $$(".mood-tab", tabs).forEach((b) => {
        const on = b.dataset.mood === m;
        b.setAttribute("aria-selected", String(on));
        b.tabIndex = on ? 0 : -1;
        if (on && focus) b.focus();
      });
      renderMoodPanel(m);
    };
    tabs.addEventListener("click", (e) => { const b = e.target.closest(".mood-tab"); if (b) select(b.dataset.mood); });
    tabs.addEventListener("keydown", (e) => {
      if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
      const cur = order.indexOf($('.mood-tab[aria-selected="true"]', tabs).dataset.mood);
      select(order[(cur + (e.key === "ArrowRight" ? 1 : order.length - 1)) % order.length], true);
    });
    select(order[0]);
  }

  function renderMoodPanel(m) {
    const panel = $("#mood-panel");
    const lead = P[D.homepage.mood_leads[m]];
    const prs = pairsOf(lead.id).filter((x) => x.moods[m]).sort(byMoodRank(m)).slice(0, 3);
    const others = productsInMood(m).filter((p) => p.id !== lead.id).slice(0, 5);
    unmountCrops(panel);
    panel.innerHTML = `
      ${leadCard(lead, m, { word: true })}
      <div class="mood-outfits">
        <h4>Wear it ${esc(m.toLowerCase())}, in different outfits</h4>
        <div class="outfit-row">${prs.map((pr) => outfitCard(pr, { type: "mood", value: m }, { chips: "styles" })).join("")}</div>
        <div class="more-feel"><span>More bracelets that feel ${esc(m.toLowerCase())}</span>
          <div class="thumbs">${others.map((p) => `<a href="${pdpUrl(p.id)}" title="${esc(p.name)}"><img src="${p.image}" alt="${esc(p.name)}"></a>`).join("")}</div>
          <a class="text-link" href="${moodUrl(m)}">All ${esc(m)} bracelets</a></div>
      </div>`;
    mountCrops(panel);
  }

  function initStyles() {
    const sw = $("#style-switch");
    const start = new URLSearchParams(location.search).get("styles") === "v2" ? "v2" : "row";
    const set = (layout) => {
      $$("button", sw).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.layout === layout)));
      renderStyles(layout);
    };
    sw.addEventListener("click", (e) => { const b = e.target.closest("button[data-layout]"); if (b) set(b.dataset.layout); });
    set(start);
    const st = D.homepage.style_tiles;
    const shown = [st.wide.style, ...st.tall.map((t) => t.style)];
    $("#more-styles").innerHTML = `<span>More styles</span>` + stylesInUse().filter((s) => !shown.includes(s)).map((s) => {
      const n = pairsInStyle(s).length;
      return `<a class="chip" href="${styleUrl(s)}">${esc(s)}${n ? `<small class="n">${plural(n, "outfit")}</small>` : ""}</a>`;
    }).join("");
  }

  function renderStyles(layout) {
    const area = $("#style-area");
    const st = D.homepage.style_tiles;
    const count = (s) => `${plural(pairsInStyle(s).length, "outfit")} · ${plural(productsInStyle(s).length, "bracelet")}`;
    const tile = (s, look) => `<a class="style-tile" href="${styleUrl(s)}">${crop(L[look], "look", { hotspot: true })}
      <div class="caption"><strong>${esc(s)}</strong><span>${esc(D.styleDef[s])}<br>${count(s)}</span></div></a>`;
    unmountCrops(area);
    if (layout === "v2") {
      const ws = st.wide.style;
      area.innerHTML = `
        <div class="style-wide">
          <a class="media" href="${styleUrl(ws)}" aria-label="${esc(ws)} outfits">${crop(L[st.wide.look], "look", { hotspot: true })}</a>
          <a class="copy" href="${styleUrl(ws)}">
            <span class="sub-eyebrow">Style</span>
            <span class="style-name">${esc(ws)}</span>
            <p>${esc(D.styleDef[ws])}</p>
            <span class="count">${count(ws)}</span>
            <span class="text-link">See ${esc(ws)} outfits</span>
          </a>
        </div>
        <div class="style-pair">${st.tall.map((t) => tile(t.style, t.look)).join("")}</div>`;
    } else {
      const all = [st.wide, ...st.tall];
      area.innerHTML = `<div class="style-row">${all.map((t) => tile(t.style, t.look)).join("")}</div>`;
    }
    mountCrops(area);
  }

  function renderGarments() {
    const G = D.homepage.garment_tiles;
    $("#garment-grid").innerHTML = G.map((g) => {
      const look = L[g.look];
      const ls = pairsOfType(g.type);
      const nb = uniq(ls.map((x) => x.product)).length;
      const m = look.kind === "composite" ? crop(look, look.torso ? "torso" : "look") : refMedia(look, null);
      return `<a class="garment-tile" href="${outfitUrl(g.type)}">${m}
        <div class="label"><strong>${esc(g.type)}</strong><span>${plural(ls.length, "outfit")} · ${plural(nb, "bracelet")}</span></div></a>`;
    }).join("");
    const shown = G.map((g) => g.type);
    $("#more-garments").innerHTML = `<span>More pieces</span>` + D.nav.Outfit.filter((t) => !shown.includes(t)).map((t) =>
      pairsOfType(t).length
        ? `<a class="chip" href="${outfitUrl(t)}">${esc(t)}<small class="n">${plural(pairsOfType(t).length, "outfit")}</small></a>`
        : `<span class="chip soon">${esc(t)}<small>Soon</small></span>`
    ).join("");
  }

  function initShop() {
    const S = D.shop;
    const ordered = S.order.map((id) => P[id]);
    const filter = $("#shop-filter");
    const grid = $("#shop-grid");
    const more = $("#shop-more");
    let colour = "";
    let expanded = false;
    filter.innerHTML = [["", "All", null], ...S.families.map(([name, hex]) => [name, name, hex])].map(([value, label, hex]) => {
      const n = value ? ordered.filter((p) => p.colour === value).length : ordered.length;
      return `<button type="button" class="swatch-chip" data-colour="${esc(value)}" aria-pressed="${value === ""}">${hex ? `<i style="background:${hex}"></i>` : ""}${esc(label)}<small>${n}</small></button>`;
    }).join("");
    const render = () => {
      const list = colour ? ordered.filter((p) => p.colour === colour) : ordered;
      const shown = colour || expanded ? list : list.slice(0, S.initial);
      grid.innerHTML = shown.map(productCard).join("");
      more.hidden = Boolean(colour) || list.length <= S.initial;
      more.textContent = expanded ? "Show fewer" : `Show all ${ordered.length} bracelets`;
      $$(".swatch-chip", filter).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.colour === colour)));
    };
    filter.addEventListener("click", (e) => {
      const b = e.target.closest(".swatch-chip");
      if (!b) return;
      colour = b.dataset.colour;
      render();
    });
    more.addEventListener("click", () => {
      expanded = !expanded;
      render();
      if (!expanded) $("#shop").scrollIntoView({ block: "start" });
    });
    render();
  }

  function sizeScale(sizes) {
    const k = 3.4;
    const gap = 14;
    const max = Math.max(...sizes) * k;
    let x = 0;
    const items = sizes.map((d) => {
      const r = (d * k) / 2;
      const cx = x + r;
      x += d * k + gap;
      return `<circle cx="${cx}" cy="${max / 2 + 1}" r="${r}"/><text x="${cx}" y="${max + 16}">${d}</text>`;
    }).join("");
    return `<svg class="scale" viewBox="0 0 ${x - gap + 2} ${max + 20}" width="${x - gap + 2}" height="${max + 20}" role="img" aria-label="Bead sizes in millimetres: ${sizes.join(", ")}">${items}</svg>`;
  }

  function renderCloser(pid) {
    const LC = D.lookCloser;
    const item = LC.items.find((i) => i.product === pid);
    const p = P[pid];
    const en = p.en || {};
    const panel = $("#closer-panel");
    panel.innerHTML = `
      <figure class="closer-figure">
        <img src="${p.image}" alt="${esc(p.name)} bracelet">
        ${item.marks.map((m, i) => `<span class="mark" data-i="${i}" style="left:${m.x}%;top:${m.y}%" aria-hidden="true">${i + 1}</span>`).join("")}
        <span class="src-badge">Supplier photo</span>
      </figure>
      <div class="closer-info">
        <h3 class="display-sm">${esc(p.name)}</h3>
        <p class="closer-sub">${esc(p.subtitle)}</p>
        <ol class="notice">${item.marks.map((m, i) => `<li data-i="${i}" tabindex="0"><span class="n">${i + 1}</span><div><b>${esc(m.title)}</b><p>${esc(m.text)}</p></div></li>`).join("")}</ol>
        <dl class="closer-facts">
          <div><dt>Structure</dt><dd>${esc(en.structure || "")} · approx. ${esc(item.weight)}</dd></div>
          <div><dt>Bead sizes (mm)</dt><dd>${sizeScale(item.sizes)}<small>Diagram drawn from the supplier's listed sizes, not the actual bead order.</small></dd></div>
          <div><dt>Materials</dt><dd>${esc(en.materials || "")}<small>${esc(LC.note)}</small></dd></div>
        </dl>
        <div class="closer-media">
          <figure><div class="cm-img"><img src="${p.wear}" alt="${esc(p.name)} on the wrist"></div><figcaption>On the wrist · supplier photo</figcaption></figure>
          <figure><div class="cm-img ph">${esc(LC.placeholders.light)}</div><figcaption>Light through the beads</figcaption></figure>
        </div>
        <div class="why-picked"><span>Why we picked it</span><div class="ph">${esc(LC.placeholders.why)}</div></div>
        <a class="text-link" href="${pdpUrl(pid)}">See how to wear it</a>
      </div>`;
    const marks = $$(".mark", panel);
    $$(".notice li", panel).forEach((li) => {
      const on = (v) => marks[Number(li.dataset.i)].classList.toggle("on", v);
      li.addEventListener("mouseenter", () => on(true));
      li.addEventListener("mouseleave", () => on(false));
      li.addEventListener("focus", () => on(true));
      li.addEventListener("blur", () => on(false));
    });
  }

  /* ---------- mood page: bracelet first ---------- */

  function renderMood() {
    const q = new URLSearchParams(location.search);
    const m = D.nav.Mood.includes(q.get("m")) ? q.get("m") : "Soft";
    document.title = `${m} · prettier（内部原型 v4.1）`;
    const withOutfits = productsInMood(m).filter((p) => pairsOf(p.id).some((x) => x.moods[m]))
      .sort((a, b) => pairsOf(b.id).filter((x) => x.moods[m]).length - pairsOf(a.id).filter((x) => x.moods[m]).length);
    const more = productsInMood(m).filter((p) => !withOutfits.includes(p));
    $("#page").innerHTML = `
      <section class="side-a">
        <div class="wrap page-head">
          <nav class="crumbs" aria-label="Breadcrumb" style="margin-top:0"><a href="index.html">Home</a> / <span>Start with a bracelet</span> / <span>${esc(m)}</span></nav>
          <div class="note"><b>Mood 页模板</b>手串在前：每条手串一行，左边是供方真实佩戴图和“它本身为什么是这种感受”（取自 Mood 研究），右边是同一感受下的几套衣服，标出各自风格。和 Style 页（衣服在前）是两种不同模板。</div>
          <p class="side-label"><i>A</i>Start with a bracelet · Mood</p>
          <h1 class="display-md">${esc(m)}</h1>
          <p class="def">${esc(D.moodDef[m])}</p>
          <p class="note-line">${esc(D.moodNote)}</p>
          <p class="page-meta">${plural(withOutfits.length, "bracelet")} styled · ${plural(pairsInMood(m).length, "outfit")}${more.length ? ` · ${more.length} more picked for this feeling` : ""}</p>
          <nav class="list-chips" aria-label="Moods">${D.nav.Mood.map((x) => `<a class="chip${x === m ? " on" : ""}" href="${moodUrl(x)}"${x === m ? ' aria-current="page"' : ""}>${esc(x)}</a>`).join("")}</nav>
        </div>
        <div class="wrap" style="padding-bottom:clamp(48px,6vw,80px)">
          ${withOutfits.length ? withOutfits.map((p) => {
            const prs = pairsOf(p.id).filter((x) => x.moods[m]).sort(byMoodRank(m));
            return `<div class="mood-row">${leadCard(p, m)}
              <div class="mood-outfits"><h4>${esc(p.name)} · ${esc(m)}</h4>
                <div class="outfit-row">${prs.map((pr) => outfitCard(pr, { type: "mood", value: m }, { chips: "styles" })).join("")}</div></div></div>`;
          }).join("") : `<div class="empty">Outfit ideas for ${esc(m)} are on the way.</div>`}
        </div>
      </section>
      ${more.length ? `<section class="list-section" style="padding-top:clamp(40px,5vw,64px)"><div class="wrap">
        <h2>More bracelets that feel ${esc(m.toLowerCase())}</h2>
        <p class="empty" style="margin:0 0 24px">Picked for this feeling. Outfit ideas on the way.</p>
        <div class="shop-grid">${more.map(productCard).join("")}</div></div></section>` : ""}`;
    mountCrops();
  }

  /* ---------- style page: outfit first ---------- */

  function renderStyle() {
    const q = new URLSearchParams(location.search);
    const s = D.nav.Style.includes(q.get("s")) ? q.get("s") : "Romantic";
    document.title = `${s} · prettier（内部原型 v4.1）`;
    const prs = pairsInStyle(s);
    const types = uniq(prs.flatMap((x) => L[x.look].outfitTypes)).filter((t) => D.nav.Outfit.includes(t));
    const bracelets = productsInStyle(s).sort((a, b) => pairsOf(b.id).length - pairsOf(a.id).length);
    $("#page").innerHTML = `
      <section class="side-b">
        <div class="wrap page-head">
          <nav class="crumbs" aria-label="Breadcrumb" style="margin-top:0"><a href="index.html">Home</a> / <span>Start with your clothes</span> / <span>${esc(s)}</span></nav>
          <div class="note"><b>Style 页模板</b>衣服在前：先用一句话把这种风格翻译成具体衣服，再看这种风格的穿搭（可按衣物类型筛选），每套标出配哪条手串；最后是适合这种风格的手串。</div>
          <p class="side-label"><i>B</i>Start with your clothes · Style</p>
          <h1 class="display-md">${esc(s)}</h1>
          <p class="def">${esc(D.styleDef[s])}</p>
          <p class="page-meta">${prs.length ? `${plural(prs.length, "outfit")} · ` : ""}${plural(bracelets.length, "bracelet")}</p>
          <nav class="list-chips" aria-label="Styles">${stylesInUse().map((x) => `<a class="chip${x === s ? " on" : ""}" href="${styleUrl(x)}"${x === s ? ' aria-current="page"' : ""}>${esc(x)}</a>`).join("")}</nav>
        </div>
        <div class="wrap" style="padding-bottom:clamp(48px,6vw,80px)">
          ${prs.length ? `
            ${types.length > 1 ? `<div class="filter-row" id="type-filter" role="group" aria-label="Filter by what you're wearing"><span>Wearing</span><div class="seg"><button type="button" data-type="" aria-pressed="true">All</button>${types.map((t) => `<button type="button" data-type="${esc(t)}" aria-pressed="false">${esc(t)}</button>`).join("")}</div></div>` : ""}
            <div class="style-looks" id="style-looks">${prs.map((pr) => outfitCard(pr, { type: "style", value: s }, { showProduct: true })).join("")}</div>`
          : `<div class="empty">${esc(s)} outfits are being styled. Meanwhile, here are the bracelets picked for this style.</div>`}
        </div>
      </section>
      <section class="list-section" style="padding-top:clamp(40px,5vw,64px)"><div class="wrap">
        <h2>Bracelets for ${esc(s)}</h2>
        <div class="shop-grid">${bracelets.map(productCard).join("")}</div></div></section>`;
    $("#type-filter")?.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-type]");
      if (!b) return;
      $$("#type-filter button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      $$("#style-looks .o-card").forEach((c) => { c.hidden = b.dataset.type && !c.dataset.types.split("|").includes(b.dataset.type); });
    });
    mountCrops();
  }

  /* ---------- list page: by garment, or all bracelets ---------- */

  function renderList() {
    const q = new URLSearchParams(location.search);
    const t = D.nav.Outfit.includes(q.get("outfit")) ? q.get("outfit") : null;
    if (t) {
      const prs = pairsOfType(t);
      const ids = new Set(prs.map((x) => x.product));
      document.title = `${t} · prettier（内部原型 v4.1）`;
      $("#page").innerHTML = `
        <section class="side-b"><div class="wrap page-head">
          <nav class="crumbs" aria-label="Breadcrumb" style="margin-top:0"><a href="index.html">Home</a> / <span>Start with your clothes</span> / <span>${esc(t)}</span></nav>
          <p class="side-label"><i>B</i>Start with your clothes · What you're wearing</p>
          <h1 class="display-md">${esc(t)}</h1>
          <p class="def">Wearing ${esc(t.toLowerCase())}? These outfits and bracelets work with it.</p>
          <p class="page-meta">${plural(prs.length, "outfit")} · ${plural(ids.size, "bracelet")}</p>
          <nav class="list-chips" aria-label="What you're wearing">${D.nav.Outfit.map((x) => pairsOfType(x).length ? `<a class="chip${x === t ? " on" : ""}" href="${outfitUrl(x)}"${x === t ? ' aria-current="page"' : ""}>${esc(x)}</a>` : `<span class="chip soon">${esc(x)}<small>Soon</small></span>`).join("")}</nav>
        </div>
        <div class="wrap" style="padding-bottom:clamp(48px,6vw,80px)">
          ${prs.length ? `<div class="style-looks">${prs.map((pr) => outfitCard(pr, defaultCtx(pr), { showProduct: true })).join("")}</div>` : `<div class="empty">Outfits for ${esc(t)} are on the way.</div>`}
        </div></section>
        <section class="list-section" style="padding-top:clamp(40px,5vw,64px)"><div class="wrap">
          <h2>Bracelets for ${esc(t.toLowerCase())}</h2>
          <div class="shop-grid">${products.filter((p) => ids.has(p.id)).map(productCard).join("")}</div></div></section>`;
    } else {
      document.title = "All bracelets · prettier（内部原型 v4.1）";
      const sorted = products.slice().sort((a, b) => pairsOf(b.id).length - pairsOf(a.id).length);
      $("#page").innerHTML = `
        <section class="side-a"><div class="wrap page-head">
          <nav class="crumbs" aria-label="Breadcrumb" style="margin-top:0"><a href="index.html">Home</a> / <span>All bracelets</span></nav>
          <p class="side-label"><i>A</i>Start with a bracelet</p>
          <h1 class="display-md">All bracelets</h1>
          <p class="def">Open any bracelet to see the outfits it works with.</p>
          <p class="page-meta">${plural(products.length, "bracelet")} · ${plural(products.filter((p) => pairsOf(p.id).length).length, "bracelet")} already styled</p>
          <nav class="list-chips" aria-label="Moods"><span class="chips-label">By mood</span>${D.nav.Mood.map((x) => `<a class="chip" href="${moodUrl(x)}">${esc(x)}</a>`).join("")}</nav>
        </div></section>
        <section class="list-section" style="padding-top:clamp(40px,5vw,64px)"><div class="wrap">
          <div class="shop-grid">${sorted.map(productCard).join("")}</div></div></section>`;
    }
    mountCrops();
  }

  /* ---------- product page ---------- */

  function renderProduct() {
    const q = new URLSearchParams(location.search);
    const p = P[q.get("id")] || P["04349"];
    const pl = pairsOf(p.id);
    const lookParam = q.get("look");
    let ctx = null;
    if (q.get("mood") && D.nav.Mood.includes(q.get("mood"))) ctx = { type: "mood", value: q.get("mood") };
    else if (q.get("style") && D.nav.Style.includes(q.get("style"))) ctx = { type: "style", value: q.get("style") };
    if (!ctx) {
      const fromLook = pl.find((x) => x.look === lookParam);
      const firstComposite = pl.filter(isComposite)[0];
      ctx = fromLook ? defaultCtx(fromLook) : firstComposite ? defaultCtx(firstComposite) : pl[0] ? defaultCtx(pl[0]) : { type: "style", value: p.styles[0] };
    }
    const inCtx = (x) => (ctx.type === "mood" ? !!x.moods[ctx.value] : x.styles.includes(ctx.value));
    const ctxPairs = pl.filter(inCtx).sort(ctx.type === "mood" ? byMoodRank(ctx.value) : byCompositeFirst);
    let active = ctxPairs.find((x) => x.look === lookParam) || ctxPairs[0];
    const fromPair = ctxPairs.find((x) => x.look === lookParam) || null;
    const en = p.en || {};
    const gallery = [
      { src: p.image, label: "Supplier photo · the bracelet" },
      { src: p.wear, label: "Supplier photo · on the wrist" },
    ];
    const moodLinks = productMoods(p).map((m) => {
      const has = pl.some((x) => x.moods[m]);
      return `<a href="${has ? pdpUrl(p.id, { type: "mood", value: m }) + "#wear" : moodUrl(m)}">${esc(m)}</a>`;
    }).join(" · ");
    const styleLinks = productStyles(p).map((s) => {
      const has = pl.some((x) => x.styles.includes(s));
      return `<a href="${has ? pdpUrl(p.id, { type: "style", value: s }) + "#wear" : styleUrl(s)}">${esc(s)}</a>`;
    }).join(" · ");
    const ctxSide = ctx.type === "mood" ? "a" : "b";
    const ctxHome = ctx.type === "mood" ? moodUrl(ctx.value) : styleUrl(ctx.value);
    document.title = `${p.name} · prettier（内部原型 v4.1）`;

    $("#page").innerHTML = `
      <div class="wrap">
        <nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">Home</a> / <a href="${ctxHome}">${esc(ctx.value)}</a> / <span>${esc(p.name)}</span></nav>
        <div class="note"><b>商品页</b>结构沿用已确认方案：上端正常商品展示；下方在当前分类（${ctx.type === "mood" ? "Mood" : "Style"} · ${esc(ctx.value)}）内用同级按钮切换服装，页内更新。自 v2 起：从 Mood 进来时显示该感受下的穿搭、理由换成从手串讲起的 Mood 写法；上方两行“Reads as / Styled for”让同一条手串的两侧方向都看得见，它们是模块外的链接，不在按钮里切换分类。</div>
        <div class="pdp-top">
          <div class="pdp-gallery">
            <div class="pdp-thumbs">${gallery.map((g, i) => `<button type="button" aria-pressed="${i === 0}" data-i="${i}" aria-label="${esc(g.label)}"><img src="${g.src}" alt=""></button>`).join("")}</div>
            <div class="pdp-main"><img id="pdp-main-img" src="${gallery[0].src}" alt="${esc(p.name)} bracelet"><span class="src-badge" id="pdp-main-label">${gallery[0].label}</span></div>
          </div>
          <div class="pdp-info">
            <h1 class="display-md">${esc(p.name)}</h1>
            <p class="sub">${esc(p.subtitle)}</p>
            <p class="price">Price TBC <small>· not set yet</small></p>
            <p class="lede">${esc(en.lede || "Full description coming soon.")}</p>
            <div class="reads">
              ${moodLinks ? `<div class="a"><b>Reads as</b>${moodLinks}</div>` : ""}
              ${styleLinks ? `<div class="b"><b>Styled for</b>${styleLinks}</div>` : ""}
            </div>
            <dl class="facts">
              <dt>Structure</dt><dd>${esc(en.structure || (p.subtitle.split("·")[1] || "").trim() || "To be confirmed")}</dd>
              <dt>Materials</dt><dd>${en.materials ? `${esc(en.materials)}<small>As described by the supplier. Not yet independently verified.</small>` : "Being translated and checked."}</dd>
              ${!en.materials && p.facts?.sizes?.length ? `<dt>Bead sizes</dt><dd>${p.facts.approx ? "About " : ""}${p.facts.sizes.length > 1 ? `${p.facts.sizes[0]}–${p.facts.sizes[p.facts.sizes.length - 1]}` : p.facts.sizes[0]} mm</dd>` : ""}
              ${!en.materials && p.facts?.weight ? `<dt>Weight</dt><dd>Approx. ${esc(p.facts.weight)} g</dd>` : ""}
              <dt>Size</dt><dd>Wrist sizing to be confirmed.</dd>
            </dl>
            <button class="btn primary block" type="button" data-proto="原型未接入交易：价格、库存与配送均未确认">Add to bag</button>
            ${fromPair ? `<a class="from-look" href="#wear">${isComposite(fromPair) ? crop(L[fromPair.look], "wrist") : `<div class="ref-media" style="aspect-ratio:1;border-radius:50%"><img src="${L[fromPair.look].image}" alt=""></div>`}<span><small>From the look</small><strong>${esc(L[fromPair.look].title)}</strong></span><em>See it ↓</em></a>` : ""}
            <div class="below-cta">${ctxPairs.length ? `<a class="text-link" href="#wear">See ${esc(ctx.value)} outfits</a>` : "<span></span>"}</div>
            <details class="internal"><summary>内部：供方原文与来源</summary><p>${esc(p.spec)}
来源：${esc(p.source.path.split("/").pop())} · 第 ${esc(p.source.row)} 行（工作名「${esc(p.sourceName)}」）</p></details>
          </div>
        </div>
      </div>
      <section class="pdp-wear" id="wear"><div class="wrap" id="wear-inner"></div></section>`;

    $(".pdp-thumbs").addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      const g = gallery[Number(b.dataset.i)];
      $("#pdp-main-img").src = g.src;
      $("#pdp-main-label").textContent = g.label;
      $$(".pdp-thumbs button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    });

    const inner = $("#wear-inner");
    const kindTag = `<span class="ctx-kind ${ctxSide}">${ctx.type === "mood" ? "MOOD" : "STYLE"}</span>`;
    if (!ctxPairs.length) {
      inner.innerHTML = `<p class="eyebrow">Ways to wear it · ${esc(ctx.value)}${kindTag}</p>
        <h2 class="display-md">${esc(ctx.value)} outfits for ${esc(p.name)} are being styled.</h2>
        <div class="empty" style="margin-top:24px">${pl.length ? `It already has outfits for ${uniq(pl.flatMap((x) => [...x.styles.map((s) => ["style", s]), ...Object.keys(x.moods).map((m) => ["mood", m])]).map((x) => x.join(":"))).map((k) => { const [type, value] = k.split(":"); return `<a class="text-link" href="${pdpUrl(p.id, { type, value })}#wear">${esc(value)}</a>`; }).join(" · ")}.` : `Meanwhile, see how other bracelets are styled in <a class="text-link" href="index.html#ways">One bracelet, many ways</a>.`}</div>`;
      mountCrops();
      return;
    }
    const n = ctxPairs.length;
    inner.innerHTML = `
      <p class="eyebrow">Ways to wear it · ${esc(ctx.value)}${kindTag}</p>
      <h2 class="display-md">${n > 1 ? `${esc(ctx.value)} outfits for ${esc(p.name)}` : `A ${esc(ctx.value)} outfit for ${esc(p.name)}`}</h2>
      <div class="outfit-buttons" role="tablist" aria-label="Outfits">${ctxPairs.map((pr) => {
        const look = L[pr.look];
        const thumb = look.kind === "composite" ? crop(look, "look", { badge: false }) : refMedia(look, null, { badge: false });
        return `<button class="outfit-btn" type="button" role="tab" id="tab-${pr.id}" data-pair="${pr.id}" aria-controls="outfit-panel">${thumb}<span>${esc(look.title)}</span></button>`;
      }).join("")}</div>
      <div class="outfit-panel" id="outfit-panel" role="tabpanel"></div>`;

    const panel = $("#outfit-panel");
    const select = (pr, focus) => {
      active = pr;
      const look = L[pr.look];
      $$(".outfit-btn", inner).forEach((b) => {
        const on = b.dataset.pair === pr.id;
        b.setAttribute("aria-selected", String(on));
        b.tabIndex = on ? 0 : -1;
        if (on && focus) b.focus();
      });
      panel.setAttribute("aria-labelledby", `tab-${pr.id}`);
      const why = ctx.type === "mood" ? pr.moods[ctx.value] : pr.styleWhy;
      const wrist = look.kind === "composite"
        ? `${crop(look, "wrist")}<p>Close-up from the same image: ${esc(p.name)} at the wrist.<br>AI composite for internal review.</p>`
        : `<div class="sup"><img src="${p.wear}" alt="${esc(p.name)} on the wrist"></div><p>${esc(p.name)} on the wrist (supplier photo).<br>Not yet photographed with this outfit.</p>`;
      const tags = [...pr.styles.map((s) => `<a href="${styleUrl(s)}" class="chip" style="font-size:11.5px;padding:3px 9px">${esc(s)}</a>`),
        ...Object.keys(pr.moods).map((m) => `<a href="${moodUrl(m)}" class="chip" style="font-size:11.5px;padding:3px 9px">${esc(m)}</a>`)].join("");
      unmountCrops(panel);
      panel.innerHTML = `
        <div class="look-main">${look.kind === "composite" ? crop(look, "look", { hotspot: true }) : refMedia(look, p)}</div>
        <div class="outfit-detail">
          <div class="wrist-big">${wrist}</div>
          <h3 class="display-sm">${esc(look.title)}</h3>
          <dl>
            <div><dt>Worn with</dt><dd>${esc(look.with)}</dd></div>
            <div><dt>Why it works · ${esc(ctx.value)}</dt><dd>${esc(why)}</dd></div>
            ${pr.how ? `<div><dt>How to wear it</dt><dd>${esc(pr.how)}</dd></div>` : ""}
            ${pr.closet ? `<div><dt>In your closet</dt><dd>${esc(pr.closet)}</dd></div>` : ""}
            <div><dt>This outfit is also</dt><dd style="display:flex;flex-wrap:wrap;gap:6px">${tags}</dd></div>
          </dl>
        </div>`;
      mountCrops(panel);
      const url = new URL(location.href);
      url.searchParams.delete("style");
      url.searchParams.delete("mood");
      url.searchParams.set(ctx.type, ctx.value);
      url.searchParams.set("look", pr.look);
      history.replaceState(null, "", url);
    };
    const tablist = $(".outfit-buttons", inner);
    tablist.addEventListener("click", (e) => {
      const b = e.target.closest(".outfit-btn");
      if (b) select(PAIRS.find((x) => x.id === b.dataset.pair));
    });
    tablist.addEventListener("keydown", (e) => {
      if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
      const i = ctxPairs.indexOf(active);
      select(ctxPairs[(i + (e.key === "ArrowRight" ? 1 : n - 1)) % n], true);
    });
    select(active);
    mountCrops();
  }

  /* ---------- boot ---------- */

  renderChrome();
  const page = document.body.dataset.page;
  if (page === "home") renderHome();
  else if (page === "mood") renderMood();
  else if (page === "style") renderStyle();
  else if (page === "list") renderList();
  else if (page === "product") renderProduct();
  mountCrops();

  const notesBtn = $("#notes-toggle");
  if (!$$(".note").length) notesBtn.remove();
  else notesBtn.addEventListener("click", () => {
    const on = document.body.classList.toggle("show-notes");
    notesBtn.setAttribute("aria-pressed", String(on));
    notesBtn.textContent = on ? "隐藏设计说明" : "显示设计说明";
  });
})();
