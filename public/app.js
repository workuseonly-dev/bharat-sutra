const socket = io();
const $ = (id) => document.getElementById(id);
let me = "";
const typers = new Set();

function add(el){const m=$("messages");const b=m.scrollTop+m.clientHeight>=m.scrollHeight-60;m.appendChild(el);if(b)m.scrollTop=m.scrollHeight}
function render(msg){
  const d=document.createElement("div");d.className="msg"+(msg.name===me?" me":"");
  const meta=document.createElement("div");meta.className="meta";
  meta.textContent=msg.name+" · "+new Date(msg.ts).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
  const t=document.createElement("div");t.textContent=msg.text;d.append(meta,t);add(d);
}
function join(){
  socket.emit("join",$("nameInput").value,(r)=>{
    if(r.error){$("err").textContent=r.error;return}
    me=$("nameInput").value.trim().slice(0,20);
    $("login").hidden=true;$("app").hidden=false;
    $("messages").innerHTML="";r.history.forEach(render);$("input").focus();
  });
}
$("loginForm").onsubmit=(e)=>{e.preventDefault();join()};
$("form").onsubmit=(e)=>{e.preventDefault();const v=$("input").value.trim();if(!v)return;
  socket.emit("message",v);socket.emit("typing",false);$("input").value=""};
let tt;$("input").oninput=()=>{socket.emit("typing",true);clearTimeout(tt);tt=setTimeout(()=>socket.emit("typing",false),1500)};
socket.on("message",render);
socket.on("system",(t)=>{const d=document.createElement("div");d.className="sys";d.textContent=t;add(d)});
socket.on("users",(l)=>{$("count").textContent="("+l.length+")";$("users").innerHTML="";
  l.forEach((n)=>{const li=document.createElement("li");li.textContent=n;$("users").appendChild(li)})});
socket.on("typing",({name,on})=>{on?typers.add(name):typers.delete(name);
  const a=[...typers];$("typing").textContent=a.length?a.join(", ")+(a.length>1?" are":" is")+" typing…":""});
socket.on("connect",()=>{if(me)socket.emit("join",me,()=>{})});
