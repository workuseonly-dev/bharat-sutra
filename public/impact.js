(()=>{
const s=io("/impact");let D=null,tag="all",sym="all",notable=false;
const $=(i)=>document.getElementById(i);
function el(t,c,x){const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
function link(t,u){const a=el("a",null,t);a.href=u;a.target="_blank";a.rel="noopener";return a}
const ago=(t)=>{const m=Math.max(0,(Date.now()-t)/6e4);return m<1?"just now":m<60?Math.floor(m)+"m ago":m<1440?Math.floor(m/60)+"h ago":Math.floor(m/1440)+"d ago"};
const tm=(t)=>new Date(t).toLocaleString([],{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
const pct=(v)=>v==null?null:(v>=0?"+":"")+v.toFixed(2)+"%";
const cls=(v)=>v==null?"pn":Math.abs(v)<0.005?"pn":v>0?"pu":"pd";
const price=(v,k)=>v==null?"–":k==="inr"?v.toFixed(2):v.toLocaleString("en-US",{maximumFractionDigits:2});
const W={30:"+30m",60:"+1h",180:"+3h"};
function tags(e){const w=el("span");e.tags.forEach(k=>{w.appendChild(el("span","tg",D.tags[k].label));w.append(" ")});return w}
function ticker(){const t=$("itick");t.innerHTML="";for(const k in D.syms){const x=D.syms[k];const d=el("div","tk");d.appendChild(el("b",null,x.label));d.append(price(x.last,k));t.appendChild(d)}}
function movers(){
  const b=$("imovers");b.innerHTML="";
  if(!D.movers.length){b.appendChild(el("p","mute","No unusually large moves in the last ~36 hours."));return}
  D.movers.slice(0,8).forEach(m=>{
    const c=el("div","mv "+(m.pct>=0?"up":"down"));const h=el("div","hd");
    h.appendChild(el("b",null,m.label));h.appendChild(el("span",m.pct>=0?"pu big":"pd big",pct(m.pct)+" in 30 min"));
    h.appendChild(el("span","mute",tm(m.start)+" → "+tm(m.end)+" · "+price(m.from,m.sym)+" → "+price(m.to,m.sym)+" · "+Math.abs(m.z)+"× normal volatility"));c.appendChild(h);
    if(m.drivers.length){c.appendChild(el("div","hint","Possible drivers (relevant headlines in the preceding hours):"));const u=el("ul");
      m.drivers.forEach(d=>{const li=el("li");li.appendChild(link(d.title,d.url));li.append(" ");li.appendChild(el("span","mute","· "+d.source+" · "+tm(d.ts)));u.appendChild(li)});c.appendChild(u)}
    else c.appendChild(el("div","hint","No clearly related headline found — may be a data release, technical move or news not in our feeds."));
    b.appendChild(c)});
}
function evCard(e){
  const c=el("div","item");c.appendChild(link(e.title,e.url)).className="t";
  const m=el("div","m");m.appendChild(tags(e));m.appendChild(el("span",null,e.source));const a=el("span","ago",ago(e.ts));a.dataset.ts=e.ts;m.appendChild(a);c.appendChild(m);
  c.appendChild(el("div","hint","ℹ️ "+D.tags[e.tags[0]].hint));
  const rx=el("div","rx");let any=false,closed=false;
  const list=sym==="all"?e.rel:e.rel.filter(x=>x===sym);
  list.forEach(k=>{const r=e.re[k];if(!r)return;any=true;if(r.closed)closed=true;
    const hot=Object.values(r.z||{}).some(z=>Math.abs(z)>=1.5);
    const b=el("div","rb"+(hot?" hot":""));b.appendChild(el("div","n",(hot?"⭐ ":"")+D.syms[k].label+" @ "+price(r.base,k)));
    D.windows.forEach(w=>{const v=r.d[w],row=el("div","row");row.appendChild(el("span",null,W[w]));
      const val=el("span",cls(v)+(r.z[w]!=null&&Math.abs(r.z[w])>=1.5?" big":""),v==null?(Date.now()-e.ts<w*6e4?"pending…":"n/a"):pct(v));row.appendChild(val);b.appendChild(row)});
    if(r.sofar!=null&&r.d[180]==null&&r.d[60]!=null)b.appendChild(el("div","hint","so far: "+pct(r.sofar)));
    rx.appendChild(b)});
  if(any)c.appendChild(rx);if(closed)c.appendChild(el("div","hint","🕒 Some markets were closed when this broke — change is measured from the last traded price once trading resumes."));
  return c;
}
function events(){
  const box=$("ilist");box.innerHTML="";
  const arr=D.events.filter(e=>(tag==="all"||e.tags.includes(tag))&&(sym==="all"||e.rel.includes(sym))&&(!notable||(e.top&&Math.abs(e.top.z)>=1.5)));
  arr.slice(0,60).forEach(e=>box.appendChild(evCard(e)));
  if(!arr.length)box.appendChild(el("p","mute",notable?"No notable reactions yet for this filter.":"No matching headlines."));
  $("istat").textContent=arr.length+" headlines · updated "+new Date(D.updated).toLocaleTimeString();
}
function filters(){
  const t=$("itags");t.innerHTML="";const all={all:"All topics"};for(const k in D.tags)all[k]=D.tags[k].label;
  for(const k in all){const b=el("button","sub"+(k===tag?" on":""),all[k]);b.onclick=()=>{tag=k;filters();events()};t.appendChild(b)}
  const y=$("isyms");y.innerHTML="";const o={all:"All",...Object.fromEntries(Object.entries(D.syms).map(([k,v])=>[k,v.label]))};
  for(const k in o){const b=el("button","chip"+(k===sym?" on":""),o[k]);b.onclick=()=>{sym=k;filters();events()};y.appendChild(b);y.append(" ")}
  $("inotable").classList.toggle("on",notable);
}
$("inotable").onclick=()=>{notable=!notable;filters();events()};
s.on("update",(d)=>{D=d;ticker();movers();filters();events()});
setInterval(()=>document.querySelectorAll("#ilist .ago").forEach(e=>e.textContent=ago(+e.dataset.ts)),30000);
})();
