// Live news aggregator: polls RSS feeds, de-duplicates, pushes new items on the /news namespace.
const Parser = require("rss-parser");
const parser = new Parser({ timeout: 12000, headers: { "User-Agent": "Mozilla/5.0" } });

// kind: "top" = mainstream headlines, "radar" = important but under-covered
const F = (name, url, kind) => ({ name, url, kind });
const CATEGORIES = {
  world: { label: "World", feeds: [
    F("BBC World", "https://feeds.bbci.co.uk/news/world/rss.xml", "top"),
    F("Al Jazeera", "https://www.aljazeera.com/xml/rss/all.xml", "top"),
    F("NYT World", "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", "top"),
    F("The Hindu · World", "https://www.thehindu.com/news/international/feeder/default.rss", "top"),
    F("ReliefWeb", "https://reliefweb.int/updates/rss.xml", "radar"),
    F("Global Voices", "https://globalvoices.org/feed/", "radar"),
    F("Bellingcat", "https://www.bellingcat.com/feed/", "radar"),
    F("CS Monitor", "https://www.csmonitor.com/layout/set/rss/World", "radar") ] },
  india: { label: "India", feeds: [
    F("The Hindu", "https://www.thehindu.com/news/national/feeder/default.rss", "top"),
    F("Times of India", "https://timesofindia.indiatimes.com/rssfeedstopstories.cms", "top"),
    F("Indian Express", "https://indianexpress.com/section/india/feed/", "top"),
    F("NDTV", "https://feeds.feedburner.com/ndtvnews-top-stories", "top"),
    F("India Today", "https://www.indiatoday.in/rss/1206578", "top"),
    F("BBC India", "https://feeds.bbci.co.uk/news/world/asia/india/rss.xml", "top"),
    F("PIB (Govt. releases)", "https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3", "radar") ] },
  mp: { label: "Madhya Pradesh", feeds: [
    F("The Hindu · MP", "https://www.thehindu.com/news/national/madhya-pradesh/feeder/default.rss", "top") ] },
  business: { label: "Business", feeds: [
    F("BBC Business", "https://feeds.bbci.co.uk/news/business/rss.xml", "top"),
    F("The Hindu BusinessLine", "https://www.thehindu.com/business/feeder/default.rss", "top"),
    F("Rest of World", "https://restofworld.org/feed/", "radar") ] },
  tech: { label: "Tech & Science", feeds: [
    F("BBC Tech", "https://feeds.bbci.co.uk/news/technology/rss.xml", "top"),
    F("BBC Science & Env.", "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml", "top"),
    F("The Hindu Sci-Tech", "https://www.thehindu.com/sci-tech/feeder/default.rss", "top"),
    F("Phys.org", "https://phys.org/rss-feed/", "radar") ] },
  health: { label: "Health", feeds: [
    F("BBC Health", "https://feeds.bbci.co.uk/news/health/rss.xml", "top"),
    F("WHO News", "https://www.who.int/rss-feeds/news-english.xml", "radar"),
    F("CIDRAP", "https://www.cidrap.umn.edu/rss.xml", "radar") ] },
};

const STOP = new Set("the a an of to in on for and or at by with is are as from after over new says say".split(" "));
const normTitle = (t) => t.toLowerCase().replace(/&[a-z#0-9]+;/g, " ").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
const tokens = (t) => new Set(normTitle(t).split(" ").filter((w) => w.length > 2 && !STOP.has(w)));
const canonUrl = (u) => { try { const x = new URL(u); return (x.hostname.replace(/^www\./, "") + x.pathname).replace(/\/$/, "").toLowerCase(); } catch { return u; } };
const jaccard = (a, b) => { let i = 0; for (const w of a) if (b.has(w)) i++; return i / (a.size + b.size - i || 1); };
const strip = (s) => String(s || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#8217;|&rsquo;/g, "’").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();

function setup(io) {
  const nsp = io.of("/news");
  const items = Object.fromEntries(Object.keys(CATEGORIES).map((k) => [k, []])); // newest first
  const seenKeys = new Set(); // global exact-dedupe (url + normalised title)
  const MAX = 150;
  const listeners = [];
  const status = {};
  const db = require("./db");
  const ins = db.prepare("INSERT OR REPLACE INTO news (id, cat, title, url, source, kind, ts, summary, also) VALUES (?,?,?,?,?,?,?,?,?)");
  const updAlso = db.prepare("UPDATE news SET also=? WHERE id=?");

  // restore persisted items so dedupe + history survive restarts
  for (const cat of Object.keys(items)) {
    const rows = db.prepare("SELECT * FROM news WHERE cat=? ORDER BY ts DESC LIMIT ?").all(cat, MAX);
    for (const r of rows.reverse()) {
      seenKeys.add("u:" + canonUrl(r.url));
      seenKeys.add("t:" + normTitle(r.title));
      items[cat].unshift({ id: r.id, cat, title: r.title, url: r.url, source: r.source, kind: r.kind, ts: r.ts, summary: r.summary, also: JSON.parse(r.also || "[]"), _tk: tokens(r.title) });
    }
  }

  function ingest(cat, feed, it, live) {
    const title = strip(it.title).replace(/\s*\[[A-Z/\s]{2,12}\]\s*$/, "");
    if ((title.toLowerCase().match(/\s(de|la|el|los|las|les|des|du|para|por|sobre|und|der|die|el)\s/g) || []).length >= 2) return; // skip non-English
    const link = it.link || it.guid;
    if (!title || !link) return;
    const ts = Date.parse(it.isoDate || it.pubDate || "") || (live ? Date.now() : Date.now() - 12 * 3600e3); // undated: sink on first load
    if (ts > Date.now() + 3600e3) return;
    const ukey = "u:" + canonUrl(link), tkey = "t:" + normTitle(title);
    const list = items[cat];
    const tk = tokens(title);
    // exact duplicate anywhere (same story already in any tab)
    if (seenKeys.has(ukey) || seenKeys.has(tkey)) return;
    seenKeys.add(ukey); seenKeys.add(tkey);
    // near-duplicate in same tab (same story reported by another outlet) -> merge as "also reported by"
    const near = tk.size >= 3 && list.find((x) => jaccard(tk, x._tk) >= 0.5);
    if (near) {
      if (!near.also.some((a) => a.source === feed.name) && near.source !== feed.name) {
        near.also.push({ source: feed.name, url: link });
        updAlso.run(JSON.stringify(near.also), near.id);
        if (live) nsp.emit("also", { cat, id: near.id, also: near.also });
      }
      return;
    }
    const item = { id: ukey, cat, title, url: link, source: feed.name, kind: feed.kind, ts,
      summary: strip(it.contentSnippet || it.summary || it.content).slice(0, 220), also: [], _tk: tk };
    const idx = list.findIndex((x) => x.ts < ts);
    list.splice(idx < 0 ? list.length : idx, 0, item);
    if (list.length > MAX) list.length = MAX;
    ins.run(item.id, cat, item.title, item.url, item.source, item.kind, item.ts, item.summary, JSON.stringify(item.also));
    if (live) nsp.emit("item", pub(item));
    listeners.forEach((f) => f(pub(item), live));
  }
  const pub = ({ _tk, ...r }) => r;

  async function pollFeed(cat, feed, live) {
    try {
      const r = await parser.parseURL(feed.url);
      r.items.slice(0, 40).forEach((it) => ingest(cat, feed, it, live));
      status[feed.name] = "ok";
    } catch (e) { status[feed.name] = String(e.message).slice(0, 80); }
  }
  async function pollAll(live) {
    // "top" feeds first so mainstream outlet wins attribution, then radar feeds
    for (const kind of ["top", "radar"])
      await Promise.all(Object.entries(CATEGORIES).flatMap(([cat, c]) => c.feeds.filter((f) => f.kind === kind).map((f) => pollFeed(cat, f, live))));
    nsp.emit("status", { updated: Date.now() });
    db.prepare("DELETE FROM news WHERE ts < ?").run(Date.now() - 7 * 864e5);
  }
  let ready = false;
  pollAll(false).then(() => { ready = true; console.log("news ready", Object.fromEntries(Object.entries(items).map(([k, v]) => [k, v.length])), Object.entries(status).filter(([, v]) => v !== "ok")); setInterval(() => pollAll(true), 60000); });

  nsp.on("connection", (s) => s.emit("init", {
    ready, updated: Date.now(),
    categories: Object.fromEntries(Object.entries(CATEGORIES).map(([k, c]) => [k, c.label])),
    items: Object.fromEntries(Object.entries(items).map(([k, v]) => [k, v.map(pub)])),
  }));
  return { all: () => Object.values(items).flat().map(pub), onItem: (f) => listeners.push(f) };
}
module.exports = { setup };
