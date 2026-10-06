// News → market impact analysis. Tags market-relevant headlines and measures how gold, oil, USD/INR,
// Nifty/Sensex and the dollar index moved after each one. Correlation, not proof of causation.
const UA = { "User-Agent": "Mozilla/5.0" };
const SYMS = {
  gold: { y: "GC=F", label: "Gold (USD/oz)" },
  wti: { y: "CL=F", label: "WTI Crude" },
  brent: { y: "BZ=F", label: "Brent Crude" },
  inr: { y: "USDINR=X", label: "USD/INR" },
  nifty: { y: "^NSEI", label: "Nifty 50" },
  sensex: { y: "^BSESN", label: "Sensex" },
  dxy: { y: "DX-Y.NYB", label: "US Dollar Index" },
};
const WINDOWS = [30, 60, 180]; // minutes after publication
const ALL = Object.keys(SYMS);

const rx = (s) => new RegExp(s, "i");
const TAGS = {
  us_policy: { label: "Trump / US policy", w: 2, r: rx("\\bTrump\\b|White House|\\bUS president\\b|Treasury Secretary|Bessent|Pentagon|US Congress|US government shutdown|\\bSenate\\b|U\\.S\\. (accuses|sanctions|strikes)"), syms: ALL,
    hint: "US policy statements move the dollar, and through it gold, oil and the rupee." },
  trade: { label: "Trade / tariffs", w: 3, r: rx("tariff|trade (deal|pact|agreement|war|talks|truce|ties)|\\bFTA\\b|free trade|sanction|export (ban|curb|control)|import dut"), syms: ["inr", "nifty", "sensex", "wti", "brent", "gold", "dxy"],
    hint: "Tariffs hurt risk assets & emerging-market currencies; a trade pact usually helps the rupee and Indian equities." },
  india_diplomacy: { label: "India diplomacy", w: 2, r: rx("(\\bModi\\b|Jaishankar|Indian Prime Minister|Indian PM|PM Modi).*(visit|meet|talks|pact|deal|summit|trip|arriv|sign|agreement|bilateral|ties|invest)|(visit|meet|talks|pact|deal|summit|trip|arriv|sign|agreement|ties).*(\\bModi\\b|Jaishankar|Indian PM)|India[-–](US|China|Russia|Japan|UK|EU|UAE|Saudi|Pakistan|Gulf|Australia|Canada|Germany|France)|state visit"), not: rx("voter|byelection|by-election|EVM|election commission|protest"), syms: ["inr", "nifty", "sensex", "wti", "brent"],
    hint: "PM visits and pacts matter mainly through trade, energy deals and investment flows." },
  oil_supply: { label: "Oil supply / OPEC", w: 3, r: rx("\\bOPEC\\b|crude|oil (price|output|supply|production|exports?|tanker|field|market)|\\bBrent\\b|\\bWTI\\b|refiner|pipeline|Strait of Hormuz|Aramco|petrol|diesel|shale"), not: rx("pollution|toxic|spill|climate|emissions|recipe"), syms: ["wti", "brent", "inr", "nifty", "sensex"],
    hint: "Supply cuts lift crude (bad for India's import bill & the rupee); output hikes ease it." },
  mideast_war: { label: "War / geopolitics", w: 3, r: rx("\\bIran\\b|\\bIsrael\\b|\\bGaza\\b|Hezbollah|Houthi|Red Sea|\\bUkraine\\b|\\bRussia\\b|missile|airstrike|ceasefire|\\bwar\\b|military strike|\\bNATO\\b|Taiwan"), syms: ["wti", "brent", "gold", "dxy", "inr"],
    hint: "Escalation tends to lift oil and gold (safe haven); ceasefire/peace eases them." },
  central_bank: { label: "Central banks / rates", w: 3, r: rx("Federal Reserve|\\bFed\\b|Powell|rate (cut|hike|decision)|interest rates?|\\bCPI\\b|inflation|\\bECB\\b|Bank of England|\\bRBI\\b|repo rate|monetary policy|Malhotra"), syms: ["gold", "dxy", "inr", "nifty", "sensex"],
    hint: "Rate cuts / dovish tone usually lift gold and weaken the dollar; hikes do the opposite." },
  india_econ: { label: "India economy", w: 2, r: rx("\\bSensex\\b|\\bNifty\\b|rupee|Union Budget|\\bGST\\b|\\bFPI\\b|\\bFII\\b|Sitharaman|Indian economy|India's GDP|India GDP|forex reserves"), syms: ["inr", "nifty", "sensex", "gold"],
    hint: "Domestic data and flows drive the rupee and Indian indices." },
  china: { label: "China", w: 1, r: rx("\\bChina\\b|\\bXi Jinping\\b|Beijing|yuan|\\bPBOC\\b"), syms: ["wti", "brent", "gold", "dxy"],
    hint: "China is the largest oil importer and a major gold buyer; its demand/policy shifts move both." },
  markets: { label: "Markets / dollar", w: 1, r: rx("Wall Street|stock market|sell-?off|recession|\\bdollar\\b|safe.haven|bullion|\\bgold\\b|bond yields?|Treasury yields?"), syms: ALL,
    hint: "Broad risk-on / risk-off moves." },
};
const TAG_KEYS = Object.keys(TAGS);

// ---- market data cache ----
const data = {}; // sym -> { t:[ms], p:[price] }
const stats = {}; // sym -> { 30: sd%, 60: sd%, 180: sd% }

async function load(sym) {
  const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(SYMS[sym].y)}?interval=5m&range=5d`, { headers: UA });
  const res = (await r.json()).chart.result[0];
  const ts = res.timestamp || [], cl = res.indicators.quote[0].close;
  const t = [], p = [];
  ts.forEach((x, i) => { if (cl[i] != null) { t.push(x * 1000); p.push(cl[i]); } });
  data[sym] = { t, p };
  // volatility of Δ-minute returns (only contiguous spans)
  const out = {};
  for (const w of WINDOWS) {
    const k = w / 5, rets = [];
    for (let i = k; i < p.length; i++) if (t[i] - t[i - k] <= (w + 10) * 6e4) rets.push(((p[i] - p[i - k]) / p[i - k]) * 100);
    const m = rets.reduce((a, b) => a + b, 0) / (rets.length || 1);
    out[w] = Math.sqrt(rets.reduce((a, b) => a + (b - m) ** 2, 0) / (rets.length || 1)) || 0.01;
  }
  stats[sym] = out;
}

// index of last point with time <= ts (binary search)
function idxAt(t, ts) { let lo = 0, hi = t.length - 1, r = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (t[m] <= ts) { r = m; lo = m + 1; } else hi = m - 1; } return r; }

function reaction(sym, ts) {
  const d = data[sym]; if (!d || !d.t.length) return null;
  const b = idxAt(d.t, ts); if (b < 0) return null;
  const base = d.p[b], gap = (ts - d.t[b]) / 6e4;
  const closed = gap > 120; // market not trading when story broke
  const out = { base, closed, d: {}, z: {} };
  for (const w of WINDOWS) {
    const target = ts + w * 6e4;
    if (target > Date.now()) { out.d[w] = null; continue; } // not elapsed yet
    const e = idxAt(d.t, target);
    if (e <= b || d.t[e] <= ts || target - d.t[e] > 60 * 6e4) { out.d[w] = null; continue; } // no trading data in window
    const pct = ((d.p[e] - base) / base) * 100;
    out.d[w] = +pct.toFixed(3); out.z[w] = +(pct / (stats[sym]?.[w] || 1)).toFixed(2);
  }
  const lastIdx = d.t.length - 1;
  if (ts < d.t[lastIdx]) out.sofar = +(((d.p[lastIdx] - base) / base) * 100).toFixed(3);
  return out;
}

function classify(item) {
  const text = item.title;
  const tags = TAG_KEYS.filter((k) => TAGS[k].r.test(text) && !(TAGS[k].not && TAGS[k].not.test(text)));
  if (!tags.length) return null;
  const score = tags.reduce((a, k) => a + TAGS[k].w, 0);
  return { tags, score };
}

function setup(io, news) {
  const nsp = io.of("/impact");
  const events = new Map(); // id -> {id,title,...tags,score}
  const addItem = (it) => {
    if (events.has(it.id) || Date.now() - it.ts > 72 * 36e5) return;
    const c = classify(it); if (!c) return;
    events.set(it.id, { id: it.id, title: it.title, url: it.url, source: it.source, ts: it.ts, kind: it.kind, newsCat: it.cat, tags: c.tags, score: c.score });
  };
  news.all().forEach(addItem);
  news.onItem((it) => { addItem(it); push(); });

  function build() {
    const cutoff = Date.now() - 72 * 36e5;
    const list = [...events.values()].filter((e) => e.ts >= cutoff).sort((a, b) => b.ts - a.ts).slice(0, 150).map((e) => {
      const rel = [...new Set(e.tags.flatMap((k) => TAGS[k].syms))];
      const re = {};
      rel.forEach((s) => { const r = reaction(s, e.ts); if (r) re[s] = r; });
      // headline move = largest |z| among relevant symbols, 60 min window (fallback 30)
      let top = null;
      for (const s of rel) for (const w of [60, 30]) { const z = re[s]?.z?.[w]; if (z != null && (!top || Math.abs(z) > Math.abs(top.z))) top = { sym: s, w, z, pct: re[s].d[w] }; }
      return { ...e, rel, re, top };
    });
    return list;
  }

  // "what moved the market?" — biggest recent 30m moves and the news just before them
  function movers(list) {
    const out = [];
    for (const s of ALL) {
      const d = data[s]; if (!d) continue;
      const k = 6, sd = stats[s]?.[30] || 0.05; const cand = [];
      for (let i = k; i < d.t.length; i++) {
        if (d.t[i] < Date.now() - 36 * 36e5 || d.t[i] - d.t[i - k] > 40 * 6e4) continue;
        const pct = ((d.p[i] - d.p[i - k]) / d.p[i - k]) * 100, z = pct / sd;
        if (Math.abs(z) >= 2.5) cand.push({ i, pct, z });
      }
      cand.sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
      const picked = [];
      for (const c of cand) { if (picked.length >= 2) break; if (picked.every((p) => Math.abs(d.t[p.i] - d.t[c.i]) > 90 * 6e4)) picked.push(c); }
      for (const c of picked) {
        const end = d.t[c.i], start = d.t[c.i - k];
        const drivers = list.filter((e) => e.rel.includes(s) && e.ts <= end && e.ts >= start - 120 * 6e4).sort((a, b) => b.score - a.score || b.ts - a.ts).slice(0, 3)
          .map((e) => ({ id: e.id, title: e.title, url: e.url, source: e.source, ts: e.ts, tags: e.tags }));
        out.push({ sym: s, label: SYMS[s].label, start, end, pct: +c.pct.toFixed(3), z: +c.z.toFixed(1), from: d.p[c.i - k], to: d.p[c.i], drivers });
      }
    }
    return out.sort((a, b) => b.end - a.end);
  }

  const snapshot = () => {
    const list = build();
    return { updated: Date.now(), syms: Object.fromEntries(ALL.map((s) => [s, { label: SYMS[s].label, last: data[s]?.p.at(-1), lastT: data[s]?.t.at(-1) }])),
      tags: Object.fromEntries(TAG_KEYS.map((k) => [k, { label: TAGS[k].label, hint: TAGS[k].hint }])), windows: WINDOWS, events: list, movers: movers(list) };
  };
  let timer;
  function push() { clearTimeout(timer); timer = setTimeout(() => nsp.emit("update", snapshot()), 1500); }

  let ready = false;
  const refresh = async () => { await Promise.all(ALL.map((s) => load(s).catch((e) => console.error("impact", s, e.message)))); ready = true; };
  refresh().then(() => { console.log("impact ready", events.size, "events"); nsp.emit("update", snapshot()); });
  setInterval(() => refresh().then(() => nsp.emit("update", snapshot())), 2 * 60e3);
  nsp.on("connection", (s) => { if (ready) s.emit("update", snapshot()); });
}
module.exports = { setup };
