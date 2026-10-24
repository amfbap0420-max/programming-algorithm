// 画面側：描画・ステップ再生・ボタン操作
(() => {
  "use strict";
  const KW = 46, NH = 42, LH = 100, GAP = 24, PAD = 24;
  const leaf = Tree23.leaf;
  const tree = new Tree23();
  let history = [];
  let steps = [], idx = 0, timer = null, autoplay = true;

  // ---------- 描画 ----------
  const canvas = document.getElementById("canvas");
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  const gRoot = document.createElementNS(NS, "g");
  const gEdges = document.createElementNS(NS, "g"); gEdges.setAttribute("class", "edges");
  const gNodes = document.createElementNS(NS, "g");
  gRoot.append(gEdges, gNodes); svg.append(gRoot); canvas.append(svg);
  gRoot.setAttribute("transform", `translate(${PAD},${PAD})`);
  const live = new Map();

  function layout(t) {
    const pos = new Map(); let x = 0, depth = 0;
    const w = n => Math.max(1, n.keys.length) * KW;
    (function rec(n, d) {
      depth = Math.max(depth, d);
      if (leaf(n)) { const ww = w(n); pos.set(n.id, { x: x + ww / 2, y: d * LH, w: ww, n }); x += ww + GAP; return; }
      n.children.forEach(c => rec(c, d + 1));
      const f = pos.get(n.children[0].id), l = pos.get(n.children[n.children.length - 1].id);
      pos.set(n.id, { x: (f.x + l.x) / 2, y: d * LH, w: w(n), n });
    })(t, 0);
    return { pos, width: Math.max(0, x - GAP), height: depth * LH + NH };
  }

  function render(s) {
    const t = s ? s.tree : null;
    document.getElementById("empty").style.display = t ? "none" : "flex";
    gEdges.innerHTML = "";
    if (!t) { live.forEach(g => g.remove()); live.clear(); svg.setAttribute("width", 0); svg.setAttribute("height", 0); return; }
    const { pos, width, height } = layout(t);
    svg.setAttribute("width", width + PAD * 2);
    svg.setAttribute("height", height + PAD * 2);
    svg.setAttribute("viewBox", `0 0 ${width + PAD * 2} ${height + PAD * 2}`);

    let edges = "";
    pos.forEach(P => {
      P.n.children.forEach((c, j) => {
        const C = pos.get(c.id);
        const x1 = P.n.keys.length ? P.x - P.w / 2 + j * KW : P.x;
        const y1 = P.y + NH, x2 = C.x, y2 = C.y, my = (y1 + y2) / 2;
        edges += `<path d="M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}"/>`;
      });
    });
    gEdges.innerHTML = edges;

    const seen = new Set();
    pos.forEach(P => {
      const n = P.n; seen.add(n.id);
      let g = live.get(n.id);
      const tr = `translate(${P.x - P.w / 2}px, ${P.y}px)`;
      if (!g) {
        g = document.createElementNS(NS, "g");
        g.style.transform = tr;
        gNodes.append(g); live.set(n.id, g);
        g.setAttribute("class", "nd enter");
      } else {
        g.style.transform = tr;
      }
      const cls = s.nodes[n.id] || "";
      g.setAttribute("class", "nd" + (cls ? " " + cls : "") + (g.classList.contains("enter") ? " enter" : ""));
      let inner = `<rect class="box" x="0" y="0" width="${P.w}" height="${NH}" rx="11"/>`;
      if (!n.keys.length) {
        inner += `<text class="holetxt" x="${P.w / 2}" y="${NH / 2}">空</text>`;
      } else {
        n.keys.forEach((k, i) => {
          const kc = s.keys[n.id + ":" + k] || "";
          if (kc) {
            const x0 = i * KW + 3, wc = KW - 6;
            inner += `<rect class="cell ${kc}" x="${x0}" y="3" width="${wc}" height="${NH - 6}" rx="8"/>`;
          }
          if (i > 0) inner += `<line class="div" x1="${i * KW}" y1="8" x2="${i * KW}" y2="${NH - 8}"/>`;
          inner += `<text class="k ${kc}" x="${i * KW + KW / 2}" y="${NH / 2 + 1}">${k}</text>`;
        });
      }
      g.innerHTML = inner;
    });
    live.forEach((g, id) => { if (!seen.has(id)) { g.remove(); live.delete(id); } });
    setTimeout(() => live.forEach(g => g.classList.remove("enter")), 400);
  }

  // ---------- ステップ再生 ----------
  const msgEl = document.getElementById("msg"), counterEl = document.getElementById("counter");
  const bPrev = document.getElementById("bPrev"), bNext = document.getElementById("bNext"), bPlay = document.getElementById("bPlay");

  const listEl = document.getElementById("stepList");
  let listFor = null;
  function renderList() {
    if (listFor !== steps) {
      listFor = steps;
      listEl.innerHTML = "";
      steps.forEach((s, j) => {
        const li = document.createElement("li");
        const b = document.createElement("button");
        b.type = "button";
        const no = document.createElement("span"); no.className = "no"; no.textContent = j + 1;
        const tx = document.createElement("span"); tx.textContent = s.msg;
        b.append(no, tx);
        b.onclick = () => { stop(); show(j); };
        li.append(b); listEl.append(li);
      });
    }
    [...listEl.children].forEach((li, j) => {
      li.classList.toggle("cur", j === idx);
      li.classList.toggle("future", j > idx);
      if (j === idx) li.firstChild.setAttribute("aria-current", "step"); else li.firstChild.removeAttribute("aria-current");
    });
    const c = listEl.children[idx];
    if (c) listEl.scrollTop = c.offsetTop - listEl.clientHeight / 2 + c.offsetHeight / 2;
  }

  function show(i) {
    idx = i;
    const s = steps[i];
    render(s);
    msgEl.textContent = s ? s.msg : "";
    counterEl.textContent = steps.length > 1 ? `ステップ ${i + 1} / ${steps.length}` : "";
    bPrev.disabled = i <= 0;
    bNext.disabled = i >= steps.length - 1;
    renderList();
  }
  function stop() { clearInterval(timer); timer = null; }
  function play() {
    stop();
    if (!autoplay || idx >= steps.length - 1) return;
    const ms = matchMedia("(prefers-reduced-motion: reduce)").matches ? 1600 : 1300;
    timer = setInterval(() => {
      if (idx >= steps.length - 1) { stop(); return; }
      show(idx + 1);
    }, ms);
  }
  bPrev.onclick = () => { stop(); show(Math.max(0, idx - 1)); };
  bNext.onclick = () => { stop(); show(Math.min(steps.length - 1, idx + 1)); };
  bPlay.onclick = () => {
    autoplay = !autoplay;
    bPlay.classList.toggle("on", autoplay);
    bPlay.setAttribute("aria-pressed", autoplay);
    if (autoplay) { if (idx >= steps.length - 1 && steps.length > 1) show(0); play(); } else stop();
  };

  function stats() {
    const el = document.getElementById("stats");
    if (!tree.root) { el.innerHTML = "キー数 <b>0</b>"; return; }
    const keys = tree.keys();
    el.innerHTML = `キー数 <b>${keys.length}</b>　高さ <b>${tree.height()}</b>　昇順 <b>${keys.join(", ")}</b>`;
  }

  function saveHistory() {
    history.push(tree.getState());
    if (history.length > 50) history.shift();
  }

  function run(label, op, nums, save = true) {
    stop();
    if (save) saveHistory();
    steps = tree.record(() => {
      nums.forEach(k => {
        const start = tree.rec.length;
        tree[op](k);
        if (nums.length > 1 && tree.rec[start]) tree.rec[start].msg = `【${label} ${k}】` + tree.rec[start].msg;
      });
    });
    show(0); stats(); play();
  }

  function message(msg) {
    steps = [{ tree: Tree23.clone(tree.root), msg, nodes: {}, keys: {} }];
    show(0); stats();
  }

  // ---------- 入力 ----------
  const input = document.getElementById("num");
  function parse() {
    const raw = input.value.replace(/[０-９－]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
    const parts = raw.split(/[\s,、，]+/).filter(Boolean);
    const nums = parts.map(Number);
    if (!parts.length) { flash("数を入れてください。"); return null; }
    if (nums.some(v => !Number.isInteger(v) || v < -999 || v > 9999)) { flash("整数（-999〜9999）をカンマか空白で区切って入れてください。"); return null; }
    return nums;
  }
  function flash(t) { stop(); msgEl.textContent = t; input.focus(); }

  document.getElementById("bIns").onclick = () => { const v = parse(); if (v) { run("挿入", "insert", v); input.value = ""; input.focus(); } };
  document.getElementById("bDel").onclick = () => { const v = parse(); if (v) { run("削除", "remove", v); input.value = ""; } };
  document.getElementById("bFind").onclick = () => { const v = parse(); if (v) run("検索", "search", v, false); };
  input.addEventListener("keydown", e => { if (e.key === "Enter") document.getElementById("bIns").click(); });

  document.getElementById("bEx").onclick = () => {
    saveHistory();
    tree.root = null;
    run("挿入", "insert", [6, 18, 5, 21, 12, 9, 15], false);
  };
  document.getElementById("bRand").onclick = () => {
    const have = new Set(tree.keys());
    if ([...Array(99)].every((_, i) => have.has(i + 1))) { flash("1〜99がすべて入っています。"); return; }
    let k; do { k = 1 + Math.floor(Math.random() * 99); } while (have.has(k));
    run("挿入", "insert", [k]);
  };
  document.getElementById("bUndo").onclick = () => {
    stop();
    if (!history.length) { msgEl.textContent = "これより前の状態はありません。"; return; }
    tree.setState(history.pop());
    message("1つ前の操作を取り消しました。");
  };
  document.getElementById("bReset").onclick = () => {
    stop(); saveHistory(); tree.root = null;
    message("木を空にしました。");
  };

  document.addEventListener("keydown", e => {
    if (e.target === input) return;
    if (e.key === "ArrowLeft") bPrev.click();
    if (e.key === "ArrowRight") bNext.click();
  });

  message("数を入れて「挿入」を押してください。分割の様子が1ステップずつ表示されます。");
})();
