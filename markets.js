// Polls Yahoo Finance and pushes live prices over Socket.io (/markets namespace).
const UA = { "User-Agent": "Mozilla/5.0" };
const DUTY = +process.env.GOLD_IMPORT_DUTY || 0.06; // import duty
const GST = +process.env.GOLD_GST || 0.03;
const OZ = 31.1035;

async function chart(sym, interval = "5m", range = "1d") {
  const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=${interval}&range=${range}`, { headers: UA });
  const j = await r.json();
  const res = j.chart.result[0];
  const ts = res.timestamp || [];
  const cl = res.indicators.quote[0].close;
  const pts = ts.map((t, i) => [t * 1000, cl[i]]).filter((p) => p[1] != null);
  return { price: res.meta.regularMarketPrice, prev: res.meta.chartPreviousClose, time: res.meta.regularMarketTime * 1000, pts };
}

const goldInr = (usdOz, fx) => (usdOz / OZ) * 10 * fx * (1 + DUTY) * (1 + GST); // INR / 10g, 24K

function setup(io) {
  const nsp = io.of("/markets");
  const state = { gold: null, oil: null, updated: null, error: null };
  const hist = { gold: [], oil: [], brent: [] };
  const db = require("./db");
  const getKv = db.prepare("SELECT value FROM kv WHERE key=?");
  const setKv = db.prepare("INSERT OR REPLACE INTO kv (key, value) VALUES ('markets_hist', ?)");
  try {
    const saved = getKv.get("markets_hist");
    if (saved) Object.assign(hist, JSON.parse(saved.value));
  } catch { /* ignore corrupt cache */ }
  setInterval(() => { try { setKv.run(JSON.stringify(hist)); } catch {} }, 60000);

  async function tick(first) {
    try {
      const [g, fx, wti, brent] = await Promise.all([chart("GC=F"), chart("USDINR=X"), chart("CL=F"), chart("BZ=F")]);
      const rate = fx.price;
      if (first) {
        // build gold INR history by pairing with nearest fx point
        hist.gold = g.pts.map(([t, p]) => [t, goldInr(p, rate)]);
        hist.oil = wti.pts; hist.brent = brent.pts;
      } else {
        const now = Date.now();
        hist.gold.push([now, goldInr(g.price, rate)]);
        hist.oil.push([now, wti.price]); hist.brent.push([now, brent.price]);
        for (const k in hist) if (hist[k].length > 600) hist[k].shift();
      }
      const g24 = goldInr(g.price, rate), g24prev = goldInr(g.prev, rate);
      state.gold = {
        usdOz: g.price, usdInr: rate,
        g24_10g: g24, g22_10g: g24 * 22 / 24, g24_1g: g24 / 10,
        change: g24 - g24prev, changePct: ((g24 - g24prev) / g24prev) * 100,
        duty: DUTY, gst: GST,
      };
      const o = (x) => ({ price: x.price, change: x.price - x.prev, changePct: ((x.price - x.prev) / x.prev) * 100, inr: x.price * rate });
      state.oil = { wti: o(wti), brent: o(brent), usdInr: rate };
      state.updated = Date.now(); state.error = null;
      nsp.emit("update", { ...state, point: first ? null : { gold: hist.gold.at(-1), wti: hist.oil.at(-1), brent: hist.brent.at(-1) } });
    } catch (e) { state.error = String(e.message || e); console.error("markets:", state.error); nsp.emit("update", { ...state }); }
  }
  tick(true).then(() => setInterval(() => tick(false), 15000));
  nsp.on("connection", (s) => s.emit("init", { ...state, hist }));
}
module.exports = { setup };
