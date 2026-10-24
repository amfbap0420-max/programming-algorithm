// 2-3木のアルゴリズム本体（挿入・検索・削除）。
// 各操作は途中経過を「ステップ」として記録し、画面側（app.js）で1つずつ再生する。
// ステップ: { tree: 木のコピー, msg: 説明文, nodes: {ノードID: 状態}, keys: {"ノードID:キー": 状態} }
(function (global) {
  "use strict";

  const leaf = n => n.children.length === 0;
  const clone = n => n ? { id: n.id, keys: [...n.keys], children: n.children.map(clone) } : null;
  const fmt = n => "[" + n.keys.join(", ") + "]";
  const kk = (n, k) => n.id + ":" + k;

  class Tree23 {
    constructor() {
      this.root = null;
      this.nid = 1;
      this.rec = null; // 記録中のステップ配列
    }

    mk(keys, children = []) { return { id: this.nid++, keys, children }; }

    snap(msg, nodes = {}, keys = {}) {
      if (this.rec) this.rec.push({ tree: clone(this.root), msg, nodes, keys });
    }

    // fn を実行し、その間に記録されたステップを返す
    record(fn) {
      const outer = this.rec;
      this.rec = [];
      fn();
      const out = this.rec;
      this.rec = outer;
      return out;
    }

    getState() { return { tree: clone(this.root), nid: this.nid }; }
    setState(s) { this.root = clone(s.tree); this.nid = s.nid; }

    has(k) {
      let n = this.root;
      while (n) {
        if (n.keys.includes(k)) return true;
        if (leaf(n)) return false;
        n = n.children[this.childIndex(n, k)];
      }
      return false;
    }

    // 中間順でキーを並べる（昇順になるはず）
    keys() {
      const out = [];
      (function rec(n) {
        if (!n) return;
        if (leaf(n)) { out.push(...n.keys); return; }
        n.children.forEach((c, i) => { rec(c); if (i < n.keys.length) out.push(n.keys[i]); });
      })(this.root);
      return out;
    }

    height() {
      let h = 0;
      for (let n = this.root; n; n = n.children[0]) h++;
      return h;
    }

    childIndex(n, k) {
      const ks = n.keys;
      if (k < ks[0]) return 0;
      if (ks.length === 1 || k < ks[1]) return 1;
      return 2;
    }

    cmpMsg(n, k) {
      const ks = n.keys;
      if (ks.length === 1) {
        return k < ks[0] ? [0, `${fmt(n)} で比べます。${k} < ${ks[0]} なので左の子へ進みます。`]
                         : [1, `${fmt(n)} で比べます。${k} > ${ks[0]} なので右の子へ進みます。`];
      }
      if (k < ks[0]) return [0, `${fmt(n)} で比べます。${k} < ${ks[0]} なので左の子へ進みます。`];
      if (k < ks[1]) return [1, `${fmt(n)} で比べます。${ks[0]} < ${k} < ${ks[1]} なので真ん中の子へ進みます。`];
      return [2, `${fmt(n)} で比べます。${k} > ${ks[1]} なので右の子へ進みます。`];
    }

    // ---------- 挿入 ----------
    insert(k) {
      if (!this.root) {
        this.root = this.mk([k]);
        this.snap(`木が空なので、${k} だけを持つ根を作ります。`, {}, { [kk(this.root, k)]: "new" });
        return;
      }
      const path = [];
      let n = this.root;
      while (true) {
        if (n.keys.includes(k)) {
          this.snap(`${k} はすでに木にあります。同じキーは入れられません。`, { [n.id]: "visit" }, { [kk(n, k)]: "found" });
          return;
        }
        path.push(n);
        if (leaf(n)) break;
        const [i, m] = this.cmpMsg(n, k);
        this.snap(m, { [n.id]: "visit" });
        n = n.children[i];
      }
      n.keys.push(k); n.keys.sort((a, b) => a - b);
      this.snap(`葉に ${k} を入れます。` + (n.keys.length < 3 ? `キーは${n.keys.length}つなので、これで完了です。` : ""),
        n.keys.length === 3 ? { [n.id]: "over" } : {}, { [kk(n, k)]: "new" });

      while (n.keys.length === 3) {
        const [a, m, b] = n.keys;
        this.snap(`キーが3つ（${a}, ${m}, ${b}）になってあふれました。真ん中の ${m} を上へ押し上げます。`,
          { [n.id]: "over" }, { [kk(n, m)]: "up" });
        path.pop();
        const parent = path[path.length - 1];
        const left = { id: n.id, keys: [a], children: n.children.slice(0, 2) };
        const right = this.mk([b], n.children.slice(2));
        if (!parent) {
          this.root = this.mk([m], [left, right]);
          this.snap(`親がないので、${m} だけの新しい根を作りました。木の高さが1段増えます。`,
            { [left.id]: "split", [right.id]: "split" }, { [kk(this.root, m)]: "up" });
          return;
        }
        const ci = parent.children.indexOf(n);
        parent.children.splice(ci, 1, left, right);
        parent.keys.push(m); parent.keys.sort((x, y) => x - y);
        const more = parent.keys.length === 3;
        this.snap(`${m} が親に入り、残りは [${a}] と [${b}] に分かれました。` +
          (more ? "親もキーが3つになったので、続けて分割します。" : "親のキーは2つ以内なので、これで完了です。"),
          Object.assign({ [left.id]: "split", [right.id]: "split" }, more ? { [parent.id]: "over" } : {}),
          { [kk(parent, m)]: "up" });
        n = parent;
      }
    }

    // ---------- 検索 ----------
    search(k) {
      if (!this.root) { this.snap("木が空なので、何も見つかりません。"); return; }
      let n = this.root;
      while (true) {
        if (n.keys.includes(k)) {
          this.snap(`${fmt(n)} に ${k} がありました。見つかりました。`, { [n.id]: "visit" }, { [kk(n, k)]: "found" });
          return;
        }
        if (leaf(n)) {
          this.snap(`葉 ${fmt(n)} まで来ても ${k} はないので、木にはありません。`, { [n.id]: "visit" });
          return;
        }
        const [i, m] = this.cmpMsg(n, k);
        this.snap(m, { [n.id]: "visit" });
        n = n.children[i];
      }
    }

    // ---------- 削除 ----------
    remove(k) {
      if (!this.root) { this.snap("木が空なので、削除するものがありません。"); return; }
      const path = [];
      let n = this.root;
      while (true) {
        path.push(n);
        if (n.keys.includes(k)) break;
        if (leaf(n)) {
          this.snap(`葉 ${fmt(n)} まで来ても ${k} はないので、削除できません。`, { [n.id]: "visit" });
          return;
        }
        const [i, m] = this.cmpMsg(n, k);
        this.snap(m, { [n.id]: "visit" });
        n = n.children[i];
      }
      this.snap(`${fmt(n)} に ${k} が見つかりました。`, { [n.id]: "visit" }, { [kk(n, k)]: "found" });

      // 内部ノードなら、後者（右部分木の最小キー）と入れ替えて葉から消す
      if (!leaf(n)) {
        const i = n.keys.indexOf(k);
        let s = n.children[i + 1]; path.push(s);
        while (!leaf(s)) { s = s.children[0]; path.push(s); }
        const sk = s.keys[0];
        n.keys[i] = sk; s.keys[0] = k;
        this.snap(`${k} は葉ではないので、すぐ次に大きい ${sk}（右側の一番小さいキー）と入れ替え、葉から消すことにします。`,
          { [s.id]: "visit" }, { [kk(n, sk)]: "up", [kk(s, k)]: "found" });
        n = s;
      }

      n.keys.splice(n.keys.indexOf(k), 1);
      if (n.keys.length > 0) {
        this.snap(`葉から ${k} を消しました。キーが残っているので、これで完了です。`, { [n.id]: "visit" });
        return;
      }
      if (n === this.root) { this.root = null; this.snap("最後のキーを消したので、木は空になりました。"); return; }
      this.snap(`葉から ${k} を消すと、葉が空になりました。兄弟から借りるか、親のキーを下ろして合体させて埋めます。`, { [n.id]: "hole" });

      // 空ノードの修復（借りる or 合体）を根に向かって繰り返す
      path.pop();
      let c = n;
      while (c.keys.length === 0) {
        const p = path.pop();
        if (!p) {
          this.root = c.children[0] || null;
          this.snap(this.root ? "根が空になったので取り除きます。木の高さが1段減ります。" : "木は空になりました。",
            this.root ? { [this.root.id]: "split" } : {});
          return;
        }
        const i = p.children.indexOf(c);
        const L = p.children[i - 1], R = p.children[i + 1];
        if (R && R.keys.length === 2) {
          const before = fmt(R), pk = p.keys[i];
          c.keys = [pk]; p.keys[i] = R.keys.shift();
          if (!leaf(R)) c.children.push(R.children.shift());
          this.snap(`右の兄弟 ${before} にはキーが2つあるので借ります。親の ${pk} を空きへ下ろし、兄弟の ${p.keys[i]} を親へ上げました。`,
            { [c.id]: "split" }, { [kk(c, pk)]: "new", [kk(p, p.keys[i])]: "up" });
          return;
        }
        if (L && L.keys.length === 2) {
          const before = fmt(L), pk = p.keys[i - 1];
          c.keys = [pk]; p.keys[i - 1] = L.keys.pop();
          if (!leaf(L)) c.children.unshift(L.children.pop());
          this.snap(`左の兄弟 ${before} にはキーが2つあるので借ります。親の ${pk} を空きへ下ろし、兄弟の ${p.keys[i - 1]} を親へ上げました。`,
            { [c.id]: "split" }, { [kk(c, pk)]: "new", [kk(p, p.keys[i - 1])]: "up" });
          return;
        }
        let merged, pk;
        if (R) {
          pk = p.keys[i];
          R.keys.unshift(pk); R.children = c.children.concat(R.children);
          p.keys.splice(i, 1); p.children.splice(i, 1);
          merged = R;
        } else {
          pk = p.keys[i - 1];
          L.keys.push(pk); L.children = L.children.concat(c.children);
          p.keys.splice(i - 1, 1); p.children.splice(i, 1);
          merged = L;
        }
        const empty = p.keys.length === 0;
        this.snap(`兄弟にはキーが1つしかないので借りられません。親の ${pk} を下ろして兄弟と合体し、${fmt(merged)} にしました。` +
          (empty ? "今度は親が空になったので、親でも同じ処理をします。" : "親にはキーが残っているので、これで完了です。"),
          Object.assign({ [merged.id]: "split" }, empty ? { [p.id]: "hole" } : {}), { [kk(merged, pk)]: "new" });
        c = p;
      }
    }
  }

  Tree23.leaf = leaf;
  Tree23.clone = clone;
  global.Tree23 = Tree23;
  if (typeof module !== "undefined") module.exports = Tree23;
})(typeof window !== "undefined" ? window : globalThis);
