(()=>{
const s=io("/jobs");let D={cats:{},exams:[],notices:[]},cat="all",view="cal",q="",type="all";
const $=(i)=>document.getElementById(i);const MN=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const ago=(t)=>{const m=Math.max(0,(Date.now()-t)/6e4);return m<1?"just now":m<60?Math.floor(m)+"m ago":m<1440?Math.floor(m/60)+"h ago":Math.floor(m/1440)+"d ago"};
const fmt=(iso)=>{const [y,m,d]=iso.split("-");return +d+" "+MN[m-1]+" "+y};
const ml=(i)=>MN[i%12]+" "+Math.floor(i/12);
const days=(iso)=>Math.ceil((new Date(iso+"T23:59:59")-Date.now())/864e5);
function el(tag,cls,txt){const e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e}
function link(t,u){const a=el("a",null,t);a.href=u;a.target="_blank";a.rel="noopener";return a}
// next typical cycle for an exam, relative to now
function cycle(ex){
  if(!ex.w.length)return {st:"irr",label:"No fixed cycle",order:1e6};
  const now=new Date(),N=now.getFullYear()*12+now.getMonth();let best=null;
  for(let y=now.getFullYear()-1;y<=now.getFullYear()+1;y++)for(const w of ex.w){
    const A0=y*12+w.a[0]-1,A1=A0+((w.a[1]-w.a[0]+12)%12),E0=A1+((w.e[0]-w.a[1]+12)%12),E1=E0+((w.e[1]-w.e[0]+12)%12);
    if(E1<N)continue;if(!best||A0<best.A0)best={A0,A1,E0,E1};
  }
  const {A0,A1,E0,E1}=best;let st,label,order;
  if(N>=A0&&N<=A1){st="open";label="Applications typically open now";order=0}
  else if(N>=E0&&N<=E1){st="exam";label="Exam window now (typical)";order=1}
  else if(N>A1&&N<E0){st="exam";label="Exam approaching (typical)";order=2}
  else{const m=A0-N;st=m<=3?"soon":"far";label="Applications typically open in ~"+m+" mo";order=3+m}
  return {st,label,order,apply:ml(A0)+(A1!==A0?" – "+ml(A1):""),exam:ml(E0)+(E1!==E0?" – "+ml(E1):"")};
}
function related(ex){const r=new RegExp(ex.m,"i");return D.notices.filter(n=>r.test(n.title)).slice(0,3)}
function examCard(ex,c){
  const d=el("div","xcard");const h=el("h3",null,ex.name);h.appendChild(el("span","st "+c.st,c.label));d.appendChild(h);
  const g=el("div","xgrid");
  const add=(k,v)=>{const x=el("div");x.appendChild(el("b",null,k));x.append(v);g.appendChild(x)};
  add("Conducted by",ex.body);
  if(c.apply){add("Typical application window",c.apply);add("Typical exam window",c.exam)}else add("Schedule","Irregular – watch official site");
  d.appendChild(g);if(ex.note)d.appendChild(el("div","mute",ex.note));
  const rel=related(ex);
  if(rel.length){const r=el("div","lnk");r.append("🔔 Latest: ");rel.forEach((n,i)=>{if(i)r.append(" · ");r.appendChild(link(n.title.slice(0,70)+(n.title.length>70?"…":""),n.url))});d.appendChild(r)}
  const o=el("div","lnk");o.append("Official: ");o.appendChild(link(ex.url.replace(/^https?:\/\/(www\.)?/,"").split("/")[0],ex.url));d.appendChild(o);return d;
}
function noticeCard(n,fresh){
  const d=el("div","item"+(fresh?" fresh":""));d.appendChild(link(n.title,n.url)).className="t";
  const dts=el("div","dates");
  if(n.lastDate){const x=days(n.lastDate);dts.appendChild(el("span","dt"+(x>=0&&x<=7?" warn":""),"⏳ Last date: "+fmt(n.lastDate)+(x>=0?" ("+(x===0?"today":x+"d left")+")":" (closed)")))}
  if(n.startDate&&!n.lastDate)dts.appendChild(el("span","dt","▶ Starts: "+fmt(n.startDate)));
  if(n.examDate)dts.appendChild(el("span","dt","📝 Exam: "+fmt(n.examDate)));
  if(n.vacancies)dts.appendChild(el("span","dt","👥 "+n.vacancies+" posts"));
  if(dts.children.length)d.appendChild(dts);
  if(n.summary&&n.summary.length>30){d.appendChild(el("div","s",n.summary))}
  const m=el("div","m");m.appendChild(el("span","tag type",n.type));
  m.appendChild(el("span",null,D.cats[n.cat]||"Other govt"));m.appendChild(el("span",null,n.source));
  const t=el("span","ago",ago(n.ts));t.dataset.ts=n.ts;m.appendChild(t);
  if(n.also&&n.also.length){const a=el("span");a.append("also: ");n.also.forEach((x,i)=>{if(i)a.append(", ");a.appendChild(link(x.source,x.url))});m.appendChild(a)}
  d.appendChild(m);return d;
}
const catOk=(c,mp)=>cat==="all"||(cat==="mp"?mp:c===cat);
function render(){
  const box=$("jlist");box.innerHTML="";$("jtypes").hidden=view!=="feed";const ql=q.toLowerCase();
  if(view==="cal"){
    const arr=D.exams.filter(e=>catOk(e.cat,/mp|mppsc|mpesb|madhya/i.test(e.name+e.body))&&(!ql||(e.name+e.body+e.note).toLowerCase().includes(ql))).map(e=>({e,c:cycle(e)})).sort((a,b)=>a.c.order-b.c.order);
    arr.forEach(({e,c})=>box.appendChild(examCard(e,c)));if(!arr.length)box.innerHTML='<p class="mute">No exams match.</p>';
  }else{
    const arr=D.notices.filter(n=>catOk(n.cat,n.mp)&&(type==="all"||n.type===type)&&(!ql||n.title.toLowerCase().includes(ql)));
    arr.slice(0,100).forEach(n=>box.appendChild(noticeCard(n,false)));if(!arr.length)box.innerHTML='<p class="mute">No notifications match.</p>';
  }
}
function tabs(){
  const c=$("jcats");c.innerHTML="";
  const all={all:"All",...D.cats,mp:"📍 Madhya Pradesh"};
  for(const k in all){const b=el("button","sub"+(k===cat?" on":""),all[k]);b.onclick=()=>{cat=k;tabs();render()};c.appendChild(b)}
  const t=$("jtypes");t.innerHTML="";["all","Recruitment","Admit Card","Result","Answer Key","Exam Schedule","Admission"].forEach(k=>{const b=el("button","chip"+(k===type?" on":""),k==="all"?"All types":k);b.onclick=()=>{type=k;tabs();render()};t.appendChild(b)});
}
s.on("init",(d)=>{D=d;tabs();render();$("jstat").textContent=d.ready?"● live":"loading…"});
s.on("notice",(n)=>{D.notices.unshift(n);D.notices.sort((a,b)=>b.ts-a.ts);if(view==="feed"&&!$("jobs").hidden&&catOk(n.cat,n.mp)&&(type==="all"||n.type===type)&&!q)$("jlist").insertBefore(noticeCard(n,true),$("jlist").firstChild);else if(view==="cal")render()});
s.on("also",({id,also})=>{const n=D.notices.find(x=>x.id===id);if(n)n.also=also});
s.on("status",()=>$("jstat").textContent="● live · checked "+new Date().toLocaleTimeString());
document.querySelectorAll("[data-v]").forEach(b=>b.onclick=()=>{view=b.dataset.v;document.querySelectorAll("[data-v]").forEach(x=>x.classList.toggle("on",x===b));render()});
$("jsearch").oninput=(e)=>{q=e.target.value.trim();render()};
setInterval(()=>document.querySelectorAll("#jlist .ago").forEach(e=>e.textContent=ago(+e.dataset.ts)),30000);
})();
