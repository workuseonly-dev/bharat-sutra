# Bharat Sutra — Project Plan

## 1. Vision

One live dashboard for an Indian user (initially Bhopal/Indore, Madhya Pradesh) that answers three questions:

1. **What are gold and oil doing right now?** Prices in rupees and dollars.
2. **What's happening in the world and in India, and did it move the markets?** News linked to price reactions.
3. **Which government jobs and exams should I be tracking?** A calendar plus a live notification feed.

The name means "thread of India": the app connects news, prices and opportunities.

## 2. Goals and non-goals

**Goals**
- Real-time updates over Socket.io, with no manual refresh.
- Clean dark-mode UI that works on desktop and mobile.
- Zero API keys and zero cost to run, using public feeds only.
- Honest about uncertainty: every estimate or inferred link is labelled.

**Non-goals (for now)**
- Trading signals or investment advice.
- Official Bhopal/Indore bullion-association rates (no free feed exists).
- User accounts and multi-device sync.
- Guaranteed accuracy of exam dates. The calendar shows typical cycles only.

## 3. Current status (v0.1)

| Area | Status | Notes |
|---|---|---|
| Chat | Done | Usernames, online list, typing indicators, 50-message replay. In-memory only. |
| Gold tracker | Done | Estimate from COMEX gold × USD/INR + duty + GST. 15 s refresh. |
| Oil tracker | Done | WTI and Brent in USD and INR. 15 s refresh. |
| News | Done | 6 categories, headline vs "under the radar" filter, de-duplication, live push. |
| News → market impact | Done (v1) | Keyword topic tags, reaction at +30 min / +1 h / +3 h, "what moved the market?" panel. |
| Govt jobs & exams | Done (v1) | About 40 exams with typical windows, live notification feed with extracted dates. |
| Dashboard shell | Done | Dashboard is the default page and chat is a tab. |
| README, repo | Done | Pushed to `workuseonly-dev/bharat-sutra` (`main`). |
| Deployment | **Done** | Dockerfile + Railway instructions; single instance with `/data` volume. |
| Persistence | **Done** | SQLite via `node:sqlite` (chat, news, notices, price history). |
| Tests | **Not done** | Only manual checks so far. |

## 4. Architecture

```
Browser (public/)
  index.html  ── tabs ──► dash.js | news.js | impact.js | jobs.js | chat.html (iframe)
        │  Socket.io namespaces: /markets /news /impact /jobs  (+ default namespace for chat)
        ▼
server.js (Express + Socket.io)
  ├─ markets.js  ← Yahoo Finance chart API   (every 15 s)
  ├─ news.js     ← ~25 RSS feeds             (every 60 s)   ─┐ new items
  ├─ impact.js   ← Yahoo 5-min data          (every 2 min)  ◄─┘ + news items
  ├─ jobs.js     ← 6 job-alert RSS feeds     (every 5 min) + static EXAMS list
  └─ chat handlers (in server.js)
```

**Data flow for impact analysis:** news ingest → keyword tagging → look up 5-minute prices before and after publication → percent change per asset → compare with that asset's normal volatility (z-score) → ⭐ if |z| ≥ 1.5. The same data is scanned for large 30-minute moves, and the headlines just before each move are listed as possible drivers.

**State:** everything lives in process memory. The app must run as a single instance until a database is added.

## 5. Key design decisions

| Decision | Reason | Trade-off |
|---|---|---|
| RSS plus Yahoo Finance, no paid APIs | Free and no setup | Unofficial endpoints can change or rate-limit |
| Gold price computed, not fetched | No free local-rate API | Differs from jeweller rates (making charges, premium) |
| Typical-cycle exam calendar | No official exam-schedule API | Approximate, entered by hand, needs maintenance |
| Keyword tagging for impact | Simple, transparent, no ML cost | Misses and false matches |
| Correlation framing with z-score | Avoids claiming causation | Less dramatic, more honest |
| Chat in an iframe inside the dashboard | Reuses working chat with no rewrite | Separate styling and page |
| Plain JS, no build step | Fast to iterate and deploy | No type-checking or bundling |

## 6. Roadmap

### Phase 1 — Ship it (next)
- [x] Add a Dockerfile for deployment.
- [x] Verify the public URL end to end: all tabs, WebSocket connections and feed fetching. (local run on Node 22, feeds polled successfully)
- [ ] Add a `/health` endpoint.
- [ ] Add basic error handling so one failing feed never affects the others (already isolated per feed, so verify it).

### Phase 2 — Make it useful daily
- [ ] **Bookmarks / "My exams"** stored in the browser (localStorage).
- [ ] **Deadline strip:** "Closing in 7 days" across all notices, plus browser notifications for starred items.
- [ ] **Price alerts:** notify when gold or oil crosses a level.
- [ ] **Chart ranges:** 1D / 1W / 1M / 1Y for gold and oil.
- [ ] **Tola and jewellery calculator** with making-charge % and GST.
- [x] Persist data in SQLite: chat history, news archive, notices, and price history. (via built-in `node:sqlite`, `db.js`)

### Phase 3 — Smarter analysis
- [ ] Store each event's price reaction so history builds beyond 5 days.
- [ ] **Typical reaction per topic:** for example, average gold move after Trump tariff headlines.
- [ ] Source-count "Big story" ranking in news.
- [ ] Keyword watchlists (for example "RBI", "monsoon", "MP").
- [ ] Eligibility filter for jobs (qualification, age, category).

### Phase 4 — Reach and growth
- [ ] Telegram or email alerts for matching job notices and large market moves.
- [ ] Official MPESB and MPPSC scrapers, to remove dependence on third-party job blogs.
- [ ] More trackers: petrol and diesel by city, mandi prices, weather, Sensex/Nifty.
- [ ] Optional AI daily briefing (needs an LLM API key).
- [ ] PWA (installable on phone), light/dark toggle.
- [ ] Accounts and a personalised dashboard.

## 7. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Yahoo Finance endpoint changes or blocks | Prices and impact break | Wrap in one data layer; add a fallback source (for example Stooq or a paid API) |
| RSS feed disappears or blocks Railway IPs | Missing news or jobs | Per-feed isolation, status logging, easy feed list edits |
| Exam calendar goes stale | Misleading dates | "Typical, not official" labels, source links, periodic review each quarter |
| Keyword tags mislabel stories | Noisy impact feed | Per-tag exclusion rules, tune from observed misses, "Notable only" filter |
| Users read correlation as causation or advice | Bad decisions | On-screen disclaimers on every analysis view |
| In-memory state lost on restart or scale-out | Lost chat and history | Add a database before running more than one instance |
| Chat has no moderation or rate limiting | Spam and abuse | Add per-socket rate limits and length caps (length caps exist) before going public |
| Scraping terms of job sites | Legal and availability | Use RSS only, link back to sources, keep requests infrequent |

## 8. Testing plan

Current checks are manual: socket message round-trip and browser checks of each tab. To add:
- **Unit tests** for pure logic: de-duplication, tag classification, date extraction, exam-cycle calculation, reaction and z-score maths.
- **Fixture-based feed tests:** saved RSS samples, so parsing is tested without the network.
- **Smoke test script:** connect to each namespace, assert `init` or `update` arrives with expected shape.
- **CI:** GitHub Actions running tests on every push.

## 9. Deployment plan (Railway)

1. Create a Railway service from `workuseonly-dev/bharat-sutra` (`main`).
2. Start command `npm start` (auto-detected). No env vars are required. `GOLD_IMPORT_DUTY` and `GOLD_GST` are optional.
3. Generate a public domain.
4. Check the live URL: tabs load, prices tick, news and jobs fill within about 2 minutes, chat connects over WebSocket.
5. Keep to one replica until persistence is added.
6. Later: add Postgres (or a volume with SQLite), then restore state on boot.

## 10. Maintenance checklist

- **Weekly:** check the feed status logs for dead feeds.
- **Quarterly:** review the `EXAMS` list against official notices.
- **As needed:** adjust the gold duty and GST rates when the Union Budget changes them (`GOLD_IMPORT_DUTY`, `GOLD_GST`).
- **As needed:** tune impact keywords from mislabelled headlines.

## 11. Success measures

- All tabs load and update live from a public URL with no manual steps.
- Fewer than 5% of feeds failing at any time.
- Under 2 minutes from a story appearing in a source feed to it showing in the dashboard.
- Impact tab: users can see, for any tagged headline, what moved and by how much, with the caveats visible.
