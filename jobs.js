// Government jobs & exams tracker: curated exam calendar (typical cycles) + live notification feed.
const Parser = require("rss-parser");
const parser = new Parser({ timeout: 15000, headers: { "User-Agent": "Mozilla/5.0" } });

const FEEDS = [
  ["FreeJobAlert", "https://www.freejobalert.com/feed/"],
  ["SarkariResult", "https://www.sarkariresult.com/feed/"],
  ["GovtJobsBlog", "https://www.govtjobsblog.in/feed"],
  ["IndGovtJobs", "https://www.indgovtjobs.in/feeds/posts/default?alt=rss"],
  ["SarkariJobs", "https://sarkarijobs.com/feed"],
  ["RojgarResult", "https://www.rojgarresult.com/feed"],
];

const CATS = { upsc: "UPSC", psc: "State PSC / MP", banking: "Banking", ssc: "SSC", railway: "Railway", teaching: "Teaching", bed: "B.Ed / D.El.Ed", defence: "Defence", police: "Police" };

// w: windows [{a:[startMonth,endMonth], e:[startMonth,endMonth]}] (1-12). Typical cycles — NOT official dates.
const W = (a, e) => ({ a, e });
const EXAMS = [
  { id: "upsc-cse", cat: "upsc", name: "UPSC Civil Services (IAS/IPS/IFS)", body: "UPSC", w: [W([2, 3], [5, 6])], note: "Prelims late May/June; Mains ~Sept; Interview Jan–Apr", url: "https://upsc.gov.in/examinations/active-examinations", m: "UPSC (CSE|Civil Services)|IAS" },
  { id: "upsc-ese", cat: "upsc", name: "UPSC Engineering Services (ESE)", body: "UPSC", w: [W([9, 10], [2, 2])], note: "Prelims ~Feb, Mains ~June", url: "https://upsc.gov.in/examinations/active-examinations", m: "UPSC (ESE|IES|Engineering Services)" },
  { id: "upsc-capf", cat: "upsc", name: "UPSC CAPF (Assistant Commandant)", body: "UPSC", w: [W([4, 5], [8, 8])], url: "https://upsc.gov.in/examinations/active-examinations", m: "CAPF" },
  { id: "upsc-cms", cat: "upsc", name: "UPSC Combined Medical Services (CMS)", body: "UPSC", w: [W([3, 4], [7, 7])], url: "https://upsc.gov.in/examinations/active-examinations", m: "UPSC CMS|Combined Medical" },
  { id: "nda", cat: "defence", name: "NDA & NA Examination", body: "UPSC", w: [W([12, 1], [4, 4]), W([5, 6], [9, 9])], note: "Held twice a year (I and II)", url: "https://upsc.gov.in/examinations/active-examinations", m: "\\bNDA\\b" },
  { id: "cds", cat: "defence", name: "Combined Defence Services (CDS)", body: "UPSC", w: [W([12, 1], [4, 4]), W([5, 6], [9, 9])], note: "Held twice a year (I and II)", url: "https://upsc.gov.in/examinations/active-examinations", m: "\\bCDS\\b" },
  { id: "afcat", cat: "defence", name: "AFCAT (Indian Air Force)", body: "IAF", w: [W([6, 7], [8, 8]), W([12, 1], [2, 2])], note: "Two cycles a year", url: "https://afcat.cdac.in", m: "AFCAT" },
  { id: "agniveer", cat: "defence", name: "Indian Army Agniveer", body: "Indian Army", w: [W([2, 3], [4, 6])], url: "https://joinindianarmy.nic.in", m: "Agniveer|Indian Army" },
  { id: "mppsc", cat: "psc", name: "MPPSC State Service Exam (MP)", body: "MPPSC", w: [], irregular: true, note: "No fixed cycle — notifications released irregularly; watch the official site", url: "https://mppsc.mp.gov.in", m: "MPPSC|MP ?PSC|Madhya Pradesh Public Service" },
  { id: "mpesb", cat: "psc", name: "MPESB (MP Employees Selection Board) exams", body: "MPESB (ex-Vyapam)", w: [], irregular: true, note: "Group 2/3, teacher selection, patwari, etc. — varies each year", url: "https://esb.mp.gov.in", m: "MPESB|Vyapam|MP ?ESB|Employees Selection Board" },
  { id: "uppsc", cat: "psc", name: "UPPSC (UP PCS) State Service", body: "UPPSC", w: [], irregular: true, url: "https://uppsc.up.nic.in", m: "UPPSC|UP PCS" },
  { id: "bpsc", cat: "psc", name: "BPSC (Bihar) exams incl. TRE teacher", body: "BPSC", w: [], irregular: true, url: "https://bpsc.bihar.gov.in", m: "BPSC" },
  { id: "rpsc", cat: "psc", name: "RPSC (Rajasthan) RAS & others", body: "RPSC", w: [], irregular: true, url: "https://rpsc.rajasthan.gov.in", m: "RPSC|RAS" },
  { id: "ibps-po", cat: "banking", name: "IBPS PO / MT", body: "IBPS", w: [W([6, 8], [8, 11])], note: "Prelims → Mains → Interview", url: "https://www.ibps.in", m: "IBPS PO" },
  { id: "ibps-clerk", cat: "banking", name: "IBPS Clerk", body: "IBPS", w: [W([7, 8], [8, 10])], url: "https://www.ibps.in", m: "IBPS Clerk" },
  { id: "ibps-rrb", cat: "banking", name: "IBPS RRB (Gramin Banks) PO/Clerk", body: "IBPS", w: [W([6, 9], [8, 12])], url: "https://www.ibps.in", m: "IBPS RRB|RRB (PO|Clerk|Office Assistant)" },
  { id: "ibps-so", cat: "banking", name: "IBPS Specialist Officer (SO)", body: "IBPS", w: [W([6, 8], [8, 11])], url: "https://www.ibps.in", m: "IBPS SO" },
  { id: "sbi-po", cat: "banking", name: "SBI PO", body: "SBI", w: [W([4, 5], [6, 8])], url: "https://sbi.co.in/web/careers", m: "SBI PO" },
  { id: "sbi-clerk", cat: "banking", name: "SBI Clerk (Junior Associate)", body: "SBI", w: [W([12, 1], [2, 3])], url: "https://sbi.co.in/web/careers", m: "SBI Clerk|SBI Junior Associate" },
  { id: "rbi-b", cat: "banking", name: "RBI Grade B Officer", body: "RBI", w: [W([6, 7], [8, 9])], url: "https://opportunities.rbi.org.in", m: "RBI Grade B|RBI Assistant|RBI" },
  { id: "nabard", cat: "banking", name: "NABARD Grade A/B", body: "NABARD", w: [W([1, 2], [3, 4])], url: "https://www.nabard.org/careers", m: "NABARD" },
  { id: "ssc-cgl", cat: "ssc", name: "SSC CGL (Combined Graduate Level)", body: "SSC", w: [W([6, 7], [9, 10])], url: "https://ssc.gov.in", m: "SSC CGL" },
  { id: "ssc-chsl", cat: "ssc", name: "SSC CHSL (10+2)", body: "SSC", w: [W([6, 7], [9, 10])], url: "https://ssc.gov.in", m: "SSC CHSL" },
  { id: "ssc-mts", cat: "ssc", name: "SSC MTS & Havaldar", body: "SSC", w: [W([6, 7], [9, 10])], url: "https://ssc.gov.in", m: "SSC MTS" },
  { id: "ssc-gd", cat: "ssc", name: "SSC GD Constable", body: "SSC", w: [W([9, 11], [1, 2])], url: "https://ssc.gov.in", m: "SSC GD" },
  { id: "ssc-cpo", cat: "ssc", name: "SSC CPO (Sub-Inspector Delhi Police/CAPF)", body: "SSC", w: [W([3, 4], [6, 7])], url: "https://ssc.gov.in", m: "SSC CPO|Sub Inspector" },
  { id: "rrb-ntpc", cat: "railway", name: "RRB NTPC (Graduate / UG)", body: "Railway Recruitment Boards", w: [], irregular: true, note: "Released in cycles, usually after a CEN notice", url: "https://www.rrbcdg.gov.in", m: "RRB NTPC|NTPC" },
  { id: "rrb-d", cat: "railway", name: "RRB Group D (Level 1)", body: "Railway Recruitment Boards", w: [], irregular: true, url: "https://www.rrbcdg.gov.in", m: "Group D" },
  { id: "rrb-alp", cat: "railway", name: "RRB ALP / Technician", body: "Railway Recruitment Boards", w: [W([4, 5], [8, 11])], url: "https://www.rrbcdg.gov.in", m: "RRB ALP|Technician" },
  { id: "ctet", cat: "teaching", name: "CTET (Central Teacher Eligibility Test)", body: "CBSE", w: [W([9, 10], [12, 2])], note: "Usually conducted once or twice a year", url: "https://ctet.nic.in", m: "CTET" },
  { id: "ugc-net", cat: "teaching", name: "UGC NET (Assistant Professor / JRF)", body: "NTA", w: [W([3, 4], [6, 6]), W([9, 11], [12, 1])], note: "June and December cycles", url: "https://ugcnet.nta.ac.in", m: "UGC NET" },
  { id: "kvs-nvs", cat: "teaching", name: "KVS / NVS Teacher Recruitment (PRT, TGT, PGT)", body: "KVS / NVS", w: [], irregular: true, url: "https://kvsangathan.nic.in", m: "KVS|NVS|Navodaya|Kendriya Vidyalaya" },
  { id: "mptet", cat: "teaching", name: "MP Teacher Recruitment / Eligibility (MPESB)", body: "MPESB", w: [], irregular: true, url: "https://esb.mp.gov.in", m: "MP (TET|Teacher|Primary Teacher|Middle School)|MPESB (Teacher|Primary|TET)" },
  { id: "state-tet", cat: "teaching", name: "State TETs (UPTET, REET, HTET, BTET…)", body: "State boards", w: [], irregular: true, url: "https://www.google.com/search?q=latest+TET+notification", m: "\\bTET\\b" },
  { id: "mp-ptet", cat: "bed", name: "MP PTET (Pre-Teacher Education Test) — B.Ed/D.El.Ed", body: "MPESB", w: [W([3, 5], [6, 6])], url: "https://esb.mp.gov.in", m: "PTET" },
  { id: "ncet", cat: "bed", name: "NCET (Integrated B.Ed / ITEP)", body: "NTA", w: [W([3, 4], [4, 5])], url: "https://ncet.samarth.ac.in", m: "NCET|ITEP" },
  { id: "up-bed", cat: "bed", name: "UP B.Ed JEE", body: "State university", w: [W([3, 4], [6, 6])], url: "https://www.google.com/search?q=UP+B.Ed+JEE+official", m: "UP B\\.?Ed" },
  { id: "bihar-bed", cat: "bed", name: "Bihar B.Ed CET", body: "State university", w: [W([3, 4], [4, 5])], url: "https://www.google.com/search?q=Bihar+B.Ed+CET+official", m: "Bihar B\\.?Ed" },
  { id: "raj-ptet", cat: "bed", name: "Rajasthan PTET (B.Ed / BA-B.Ed)", body: "State university", w: [W([3, 4], [6, 6])], url: "https://www.google.com/search?q=Rajasthan+PTET+official", m: "Rajasthan PTET|Raj PTET" },
  { id: "mp-police", cat: "police", name: "MP Police Constable / SI", body: "MPESB", w: [], irregular: true, url: "https://esb.mp.gov.in", m: "MP Police|Madhya Pradesh Police" },
  { id: "up-police", cat: "police", name: "UP Police Constable / SI", body: "UPPRPB", w: [], irregular: true, url: "https://uppbpb.gov.in", m: "UP Police" },
];

// ---- live notifications ----
const STOP = new Set("the a an of to in on for and or at by with is are as from out apply online 2025 2026 2027 recruitment notification".split(" "));
const norm = (t) => t.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
const tok = (t) => new Set(norm(t).split(" ").filter((w) => w.length > 1 && !STOP.has(w)));
const jac = (a, b) => { let i = 0; for (const w of a) if (b.has(w)) i++; return i / (a.size + b.size - i || 1); };
const strip = (s) => String(s || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#8217;|&rsquo;/g, "’").replace(/&#8211;/g, "–").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();

const rx = (s) => new RegExp(s, "i");
const CAT_RULES = [
  ["upsc", rx("\\bUPSC\\b|\\bIAS\\b|\\bCAPF\\b|\\bESE\\b")],
  ["banking", rx("IBPS|\\bSBI\\b|\\bRBI\\b|NABARD|\\bbank\\b|SIDBI|cooperative bank")],
  ["ssc", rx("\\bSSC\\b|staff selection")],
  ["railway", rx("\\bRRB\\b|\\bRRC\\b|railway|\\bNTPC\\b|\\bALP\\b|RITES|IRCON")],
  ["bed", rx("B\\.? ?Ed\\b|D\\.? ?El\\.? ?Ed|PTET|NCET|ITEP")],
  ["teaching", rx("teacher|\\bTET\\b|\\bTGT\\b|\\bPGT\\b|\\bPRT\\b|\\bKVS\\b|\\bNVS\\b|lecturer|professor|UGC NET|CTET")],
  ["defence", rx("\\bNDA\\b|\\bCDS\\b|AFCAT|agniveer|\\barmy\\b|\\bnavy\\b|air force|\\bBSF\\b|\\bCRPF\\b|\\bCISF\\b|\\bITBP\\b|assam rifles|coast guard")],
  ["police", rx("police|constable|sub.?inspector")],
  ["psc", rx("\\b\\w*PSC\\b|\\bMPESB\\b|\\b\\w*SSSB\\b|\\b\\w+SSC\\b|\\bHSSC\\b|vyapam|public service commission|subordinate service|state govt")],
];
const MP = rx("madhya pradesh|\\bMP\\b|MPESB|MPPSC|bhopal|indore|vyapam|jabalpur|gwalior");
const TYPE_RULES = [["Admit Card", rx("admit card|hall ticket|call letter")], ["Result", rx("result|merit list|cut.?off|score ?card|final list|selection list")], ["Answer Key", rx("answer key")],
  ["Exam Schedule", rx("exam date|schedule|time ?table|calendar|syllabus|exam city|re-?exam|postponed|rescheduled")], ["Recruitment", rx("recruitment|vacanc|apply online|notification|walk.?in|online form|\\bposts?\\b")], ["Admission", rx("admission|counselling|counseling|seat allotment")]];

const MONTHS = "jan feb mar apr may jun jul aug sep oct nov dec".split(" ");
const DATE = "(\\d{1,2})(?:st|nd|rd|th)?[\\s\\-/,]+(jan\\w*|feb\\w*|mar\\w*|apr\\w*|may|jun\\w*|jul\\w*|aug\\w*|sep\\w*|oct\\w*|nov\\w*|dec\\w*)[\\s\\-/,]+(\\d{4})";
const toISO = (d, m, y) => { const mi = MONTHS.indexOf(m.slice(0, 3).toLowerCase()); return mi < 0 ? null : `${y}-${String(mi + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`; };
function findDate(text, labels) {
  const m = text.match(new RegExp("(?:" + labels + ")[^.\\d]{0,40}?" + DATE, "i"));
  return m ? toISO(m[1], m[2], m[3]) : null;
}
function extract(text) {
  const out = {};
  text = text.replace(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/g, (_, d, m, y) => +m >= 1 && +m <= 12 ? `${d} ${MONTHS[m - 1]} ${y}` : _);
  const last = findDate(text, "last date|closing date|apply (?:online )?(?:till|until|before|by)|last day|till|ends? on|deadline");
  const exam = findDate(text, "exam(?:ination)? date|exam on|exam scheduled|exam will be held|examination on|exam is scheduled|conducted on|to be held on|scheduled (?:for|on)");
  const start = findDate(text, "start(?:s|ed)? (?:from|on)|begins? (?:from|on)|opens? (?:from|on)|apply online from|from");
  if (last) out.lastDate = last; if (exam) out.examDate = exam; if (start) out.startDate = start;
  const v = text.match(/(\d[\d,]{0,6})\s*(?:\+\s*)?(?:posts|vacancies|vacancy|seats)/i);
  if (v) out.vacancies = v[1];
  return out;
}

function setup(io) {
  const nsp = io.of("/jobs");
  const notices = []; // newest first
  const seen = new Set();
  const MAX = 400, MAX_AGE = 60 * 864e5;

  function ingest(source, it, live) {
    const title = strip(it.title);
    const link = it.link;
    if (!title || !link) return;
    const ts = Date.parse(it.isoDate || it.pubDate || "") || (live ? Date.now() : Date.now() - 864e5);
    if (ts > Date.now() + 36e5 || Date.now() - ts > MAX_AGE) return;
    const key = norm(title);
    if (seen.has(key) || seen.has(link)) return;
    seen.add(key); seen.add(link);
    const tk = tok(title);
    const near = tk.size >= 3 && notices.find((x) => Math.abs(x.ts - ts) < 14 * 864e5 && jac(tk, x._tk) >= 0.6);
    if (near) {
      if (near.source !== source && !near.also.some((a) => a.source === source)) { near.also.push({ source, url: link }); if (live) nsp.emit("also", { id: near.id, also: near.also }); }
      return;
    }
    const desc = strip(it.contentSnippet || it.summary || it.content);
    const all = title + ". " + desc;
    const cat = (CAT_RULES.find(([, r]) => r.test(title)) || [])[0] || "other";
    const type = (TYPE_RULES.find(([, r]) => r.test(title)) || [])[0] || "Update";
    const n = { id: link, title, url: link, source, ts, cat, type, mp: MP.test(title), summary: desc.slice(0, 240), ...extract(all), also: [], _tk: tk };
    const idx = notices.findIndex((x) => x.ts < ts);
    notices.splice(idx < 0 ? notices.length : idx, 0, n);
    if (notices.length > MAX) notices.length = MAX;
    if (live) nsp.emit("notice", pub(n));
  }
  const pub = ({ _tk, ...r }) => r;

  async function poll(live) {
    await Promise.all(FEEDS.map(async ([name, url]) => {
      try { const r = await parser.parseURL(url); r.items.slice(0, 60).forEach((it) => ingest(name, it, live)); }
      catch (e) { console.error("jobs feed", name, String(e.message).slice(0, 60)); }
    }));
    nsp.emit("status", { updated: Date.now() });
  }
  let ready = false;
  poll(false).then(() => { ready = true; console.log("jobs ready", notices.length); setInterval(() => poll(true), 5 * 60e3); });

  nsp.on("connection", (s) => s.emit("init", { ready, cats: CATS, exams: EXAMS, notices: notices.map(pub) }));
}
module.exports = { setup };
