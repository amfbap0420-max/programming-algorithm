// 2-3木の性質をランダム操作で確認するテスト（node test.js）
const Tree23 = require("./tree23.js");

function check(t) {
  let leafDepth = -1;
  (function rec(n, d) {
    if (!n) return;
    if (n.keys.length < 1 || n.keys.length > 2) throw new Error("キー数が不正: " + n.keys);
    if (n.children.length === 0) {
      if (leafDepth < 0) leafDepth = d;
      if (leafDepth !== d) throw new Error("葉の深さがそろっていない");
      return;
    }
    if (n.children.length !== n.keys.length + 1) throw new Error("子の数が不正");
    n.children.forEach(c => rec(c, d + 1));
  })(t.root, 0);
  const ks = t.keys();
  for (let i = 1; i < ks.length; i++) if (ks[i - 1] >= ks[i]) throw new Error("昇順でない: " + ks);
}

for (let trial = 0; trial < 300; trial++) {
  const t = new Tree23();
  const set = new Set();
  for (let op = 0; op < 200; op++) {
    const k = Math.floor(Math.random() * 60);
    if (Math.random() < 0.6) { t.record(() => t.insert(k)); set.add(k); }
    else { t.record(() => t.remove(k)); set.delete(k); }
    check(t);
    const want = [...set].sort((a, b) => a - b).join(",");
    if (t.keys().join(",") !== want) throw new Error(`内容が不一致: ${t.keys()} / ${want}`);
  }
}
console.log("OK: すべてのテストに通りました");
