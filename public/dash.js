const $=(i)=>document.getElementById(i);
const s=io("/markets");let H={gold:[],oil:[],brent:[]};
const inr=(n)=>"₹"+n.toLocaleString("en-IN",{maximumFractionDigits:0});
const usd=(n)=>"$"+n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
function set(id,t){const e=$(id);if(e.textContent!==t){e.textContent=t;e.classList.remove("flash");void e.offsetWidth;e.classList.add("flash")}}
function chg(id,c,p,f){const e=$(id);e.className="chg "+(c>=0?"up":"down");e.textContent=(c>=0?"▲ ":"▼ ")+f(Math.abs(c))+" ("+p.toFixed(2)+"%) today"}
function draw(cv,series){
  const dpr=devicePixelRatio||1,w=cv.clientWidth,h=cv.clientHeight;cv.width=w*dpr;cv.height=h*dpr;
  const c=cv.getContext("2d");c.scale(dpr,dpr);c.clearRect(0,0,w,h);
  const all=series.flatMap(x=>x.pts);if(all.length<2){c.fillStyle="#8b90a0";c.fillText("Waiting for data…",20,30);return}
  let t0=Math.min(...all.map(p=>p[0])),t1=Math.max(...all.map(p=>p[0])),lo=Math.min(...all.map(p=>p[1])),hi=Math.max(...all.map(p=>p[1]));
  const pad=(hi-lo)*.1||1;lo-=pad;hi+=pad;const L=60,R=12,T=12,B=24;
  const X=t=>L+(t-t0)/(t1-t0||1)*(w-L-R),Y=v=>T+(1-(v-lo)/(hi-lo))*(h-T-B);
  c.font="11px system-ui";c.fillStyle="#8b90a0";c.strokeStyle="#262a37";c.lineWidth=1;
  for(let i=0;i<=4;i++){const v=lo+(hi-lo)*i/4,y=Y(v);c.beginPath();c.moveTo(L,y);c.lineTo(w-R,y);c.stroke();c.fillText(v>1000?Math.round(v).toLocaleString("en-IN"):v.toFixed(2),4,y+4)}
  for(let i=0;i<=4;i++){const t=t0+(t1-t0)*i/4;c.fillText(new Date(t).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),X(t)-14,h-6)}
  series.forEach(({pts,color})=>{c.strokeStyle=color;c.lineWidth=2;c.beginPath();pts.forEach((p,i)=>i?c.lineTo(X(p[0]),Y(p[1])):c.moveTo(X(p[0]),Y(p[1])));c.stroke()});
}
function render(){
  draw($("gchart"),[{pts:H.gold,color:"#f5c542"}]);
  draw($("ochart"),[{pts:H.oil,color:"#f5a524"},{pts:H.brent,color:"#7c9cff"}]);
}
function apply(d){
  if(d.error&&!d.gold){$("status").textContent="data error – retrying";return}
  if(!d.gold)return;const g=d.gold,o=d.oil;
  set("g24",inr(g.g24_10g));set("g22",inr(g.g22_10g));set("g1",inr(g.g24_1g));set("gusd",usd(g.usdOz));set("gfx","₹"+g.usdInr.toFixed(2));
  chg("gchg",g.change,g.changePct,inr);
  $("gnote").textContent=`Estimated Bhopal/Indore price: international gold × USD/INR + ${(g.duty*100).toFixed(0)}% import duty + ${(g.gst*100).toFixed(0)}% GST. Local jeweller rates may differ slightly (making charges, local premium). Not an official bullion-association rate.`;
  set("wti",usd(o.wti.price));set("brent",usd(o.brent.price));set("winr",inr(o.wti.inr));set("binr",inr(o.brent.inr));
  chg("wchg",o.wti.change,o.wti.changePct,usd);chg("bchg",o.brent.change,o.brent.changePct,usd);
  $("status").textContent="● live · "+new Date(d.updated).toLocaleTimeString();
}
s.on("init",(d)=>{H=d.hist;apply(d);render()});
s.on("update",(d)=>{if(d.point){H.gold.push(d.point.gold);H.oil.push(d.point.wti);H.brent.push(d.point.brent)}apply(d);render()});
s.on("disconnect",()=>$("status").textContent="reconnecting…");
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{
  document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("on",x===b));
  document.querySelectorAll(".pane").forEach(p=>p.hidden=p.id!==b.dataset.t);render()});
addEventListener("resize",render);
