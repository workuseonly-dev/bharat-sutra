(()=>{
const n=io("/news");let D={categories:{},items:{}},cat=null,kind="all",unseen={};
const ids={};const el=(i)=>document.getElementById(i);
const ago=(t)=>{const m=Math.max(0,(Date.now()-t)/6e4);return m<1?"just now":m<60?Math.floor(m)+"m ago":m<1440?Math.floor(m/60)+"h ago":Math.floor(m/1440)+"d ago"};
const active=()=>!el("news").hidden;
function card(it,fresh){
  const d=document.createElement("div");d.className="item"+(fresh?" fresh":"");d.dataset.id=it.id;d.dataset.kind=it.kind;
  const a=document.createElement("a");a.className="t";a.href=it.url;a.target="_blank";a.rel="noopener";a.textContent=it.title;d.appendChild(a);
  if(it.summary){const s=document.createElement("div");s.className="s";s.textContent=it.summary;d.appendChild(s)}
  const m=document.createElement("div");m.className="m";
  const tag=document.createElement("span");tag.className="tag "+it.kind;tag.textContent=it.kind==="radar"?"🔭 under the radar":"📣 headline";
  const src=document.createElement("span");src.textContent=it.source;
  const tm=document.createElement("span");tm.className="ago";tm.dataset.ts=it.ts;tm.textContent=ago(it.ts);
  m.append(tag,src,tm);
  if(it.also&&it.also.length){const al=document.createElement("span");al.className="also";al.append("also: ");
    it.also.forEach((x,i)=>{if(i)al.append(", ");const l=document.createElement("a");l.href=x.url;l.target="_blank";l.rel="noopener";l.textContent=x.source;al.appendChild(l)});m.appendChild(al)}
  d.appendChild(m);return d;
}
function list(){
  const box=el("nlist");box.innerHTML="";
  const arr=(D.items[cat]||[]).filter(i=>kind==="all"||i.kind===kind);
  arr.slice(0,80).forEach(i=>box.appendChild(card(i,false)));
  if(!arr.length)box.innerHTML='<p class="mute">Nothing here yet…</p>';
}
function cats(){
  const c=el("ncats");c.innerHTML="";
  for(const k in D.categories){const b=document.createElement("button");b.className="sub"+(k===cat?" on":"");b.textContent=D.categories[k];
    if(unseen[k]&&k!==cat){const s=document.createElement("span");s.className="badge";s.textContent=unseen[k];b.appendChild(s)}
    b.onclick=()=>{cat=k;unseen[k]=0;cats();list();total()};c.appendChild(b)}
}
function total(){const t=Object.entries(unseen).reduce((a,[k,v])=>a+(active()&&k===cat?0:v),0);const b=el("newsBadge");b.hidden=!t||active();b.textContent=t}
n.on("init",(d)=>{D=d;cat=cat||Object.keys(d.categories)[0];cats();list();el("nstat").textContent=d.ready?"● live":"loading feeds…"});
n.on("item",(it)=>{
  (D.items[it.cat]=D.items[it.cat]||[]).unshift(it);D.items[it.cat].sort((a,b)=>b.ts-a.ts);
  if(it.cat===cat&&active()&&(kind==="all"||it.kind===kind)){const b=el("nlist");const f=b.firstChild;
    if(f&&f.classList&&!f.classList.contains("item"))b.innerHTML="";b.insertBefore(card(it,true),b.firstChild)}
  else{unseen[it.cat]=(unseen[it.cat]||0)+1;cats();total()}
});
n.on("also",({cat:c,id,also})=>{const it=(D.items[c]||[]).find(x=>x.id===id);if(it)it.also=also;if(c===cat&&active())list()});
n.on("status",()=>{el("nstat").textContent="● live · checked "+new Date().toLocaleTimeString()});
document.querySelectorAll("#nfilter .chip").forEach(b=>b.onclick=()=>{kind=b.dataset.k;
  document.querySelectorAll("#nfilter .chip").forEach(x=>x.classList.toggle("on",x===b));list()});
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>{if(b.dataset.t==="news"){unseen[cat]=0;cats();total()}else total()}));
setInterval(()=>document.querySelectorAll(".ago").forEach(e=>e.textContent=ago(+e.dataset.ts)),30000);
})();
