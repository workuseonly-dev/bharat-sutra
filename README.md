# Bharat Sutra — India Markets & News Dashboard

A real-time, dark-mode dashboard built with Node.js, Express and Socket.io. Everything updates live in the browser, with no page reloads.

## Features

| Tab | What it does |
|---|---|
| 🥇 **Gold · Bhopal / Indore** | Live 24K / 22K gold price in ₹ per 10 g and per 1 g, spot USD/oz, USD/INR and an intraday chart. |
| 🛢️ **Crude Oil** | Live WTI and Brent in USD/bbl, with INR/bbl conversion and a combined chart. |
| 📰 **News** | Live headlines in World, India, Madhya Pradesh, Business, Tech & Science and Health. Filter by **Headlines** or **Under the radar** (important but less-covered sources). Duplicates are removed. |
| 🔗 **News → Market Impact** | Tags market-relevant headlines (Trump/US policy, trade and tariffs, India diplomacy, oil/OPEC, war, central banks, India economy, China). Shows how gold, oil, USD/INR, Nifty, Sensex and the dollar index moved at +30 min, +1 h and +3 h. Also shows a "What moved the market?" panel. |
| 🎓 **Govt Jobs & Exams** | Calendar of about 40 exams (UPSC, MPPSC, MPESB, banking, SSC, railway, teaching, B.Ed and more) with typical application and exam windows. Also a live feed of notifications with last date, exam date and vacancies. |
| 💬 **Chat** | Real-time chat with usernames, an online user list, typing indicators and the last 50 messages replayed to new joiners. |

## Quick start

```bash
npm install
npm start          # http://localhost:8080
```

Requires Node 18 or later (it uses the built-in `fetch`) and outbound internet access to the feeds and APIs below.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8080` | HTTP port |
| `GOLD_IMPORT_DUTY` | `0.06` | Import duty used in the gold price estimate |
| `GOLD_GST` | `0.03` | GST used in the gold price estimate |

No API keys are needed.

## Project layout

```
server.js        Express + Socket.io bootstrap; wires the modules below
markets.js       Gold and oil: polls Yahoo Finance every 15 s (namespace /markets)
news.js          RSS aggregator with de-duplication (namespace /news)
impact.js        News -> market reaction analysis (namespace /impact)
jobs.js          Govt exam calendar + live notification feed (namespace /jobs)
public/
  index.html     Dashboard (default page) with all tabs
  chat.html      Chat UI, embedded in the Chat tab; also available at /chat.html
  dash.js        Gold / oil tabs and tab switching
  news.js  jobs.js  impact.js   Client code for each tab
  app.js         Chat client
  style.css  dash.css
```

Each feature has its own Socket.io namespace. The server sends an `init` or `update` event on connect, then pushes changes as they happen.

## How the data works, and its limits

**Gold price is an estimate.** There is no free live feed for local Bhopal or Indore rates. The price is calculated as `COMEX gold (USD/oz) ÷ 31.1035 × 10 × USD/INR × (1 + duty) × (1 + GST)`. Jewellers' actual rates differ because of making charges and local premiums. Bhopal and Indore show the same figure.

**Prices** come from Yahoo Finance's unofficial chart endpoint (GC=F, CL=F, BZ=F, USDINR=X, ^NSEI, ^BSESN, DX-Y.NYB). They may be delayed, and the endpoint could change or rate-limit without notice.

**News** comes from public RSS feeds (BBC, Al Jazeera, NYT, The Hindu, Times of India, Indian Express, NDTV, India Today, ReliefWeb, WHO, CIDRAP, PIB and others). The feed list is at the top of `news.js`. Exact duplicates are dropped. Near-duplicates (token overlap of 50% or more) in the same tab are merged as "also: Outlet".

**Impact analysis shows correlation, not causation.** Headlines are matched by keywords, so some are mis-tagged. The reaction is the price change since publication, and a ⭐ flags moves larger than 1.5 times that asset's normal volatility over the past 5 days. Concurrent stories, scheduled data releases and market closures (weekends, Nifty/Sensex hours) blur the picture. History covers about 5 days. Not investment advice.

**Exam calendar dates are typical cycles, not official schedules.** They were entered from general knowledge and rolled forward to the next window automatically. Exams with no fixed cycle (MPPSC, MPESB, RRB NTPC and others) are marked as irregular. Always confirm on the official site. Edit the `EXAMS` list at the top of `jobs.js` to correct or add entries.

**Job notifications** are scraped from public job-alert RSS feeds (FreeJobAlert, SarkariResult and others). Dates and vacancy counts are extracted from text where stated, and not every post states them.

## Storage

Everything is in memory. Chat history, news, notices and price history reset when the server restarts, and the feeds refill within a minute or two. For persistence, add a database such as SQLite or Railway Postgres.

## Deploying to Railway

The app is a standard Node service with `npm start` as the start command. Railway sets `PORT` automatically. It needs no volumes or databases, and Socket.io works over Railway's default networking. Run a single instance, because chat and user state live in process memory.

## Customising

- **Add or remove news sources:** edit `CATEGORIES` in `news.js`.
- **Add exams or fix dates:** edit `EXAMS` in `jobs.js`.
- **Add job-alert feeds:** edit `FEEDS` in `jobs.js`.
- **Tune impact topics:** edit `TAGS` in `impact.js`. Each entry has a regex, a weight and the assets it affects.
- **Poll intervals:** prices every 15 s (`markets.js`), news every 60 s (`news.js`), jobs every 5 min (`jobs.js`), impact market data every 2 min (`impact.js`).
