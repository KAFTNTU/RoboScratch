(function(){'use strict';if(window.RCSim2D&&window.RCSim2D.__rcVersion)return;
var U={cl:function(x,a,b){return x<a?a:x>b?b:x},lerp:function(a,b,t){return a+(b-a)*t},now:function(){return (performance&&performance.now)?performance.now():Date.now()},rot:function(p,a){var c=Math.cos(a),s=Math.sin(a);return{x:p.x*c-p.y*s,y:p.x*s+p.y*c}},add:function(a,b){return{x:a.x+b.x,y:a.y+b.y}},sub:function(a,b){return{x:a.x-b.x,y:a.y-b.y}}};
function segCP(p,a,b){var abx=b.x-a.x,aby=b.y-a.y,apx=p.x-a.x,apy=p.y-a.y,den=abx*abx+aby*aby||1e-9,t=(apx*abx+apy*aby)/den;t=U.cl(t,0,1);return{x:a.x+abx*t,y:a.y+aby*t}}
function segD(p,a,b){var q=segCP(p,a,b),dx=p.x-q.x,dy=p.y-q.y;return Math.sqrt(dx*dx+dy*dy)}
function polyD(p,pts,cl){if(!pts||pts.length<2)return 1e9;var best=1e9;for(var i=0;i<pts.length-1;i++)best=Math.min(best,segD(p,pts[i],pts[i+1]));if(cl)best=Math.min(best,segD(p,pts[pts.length-1],pts[0]));return best}
function raySeg(o,d,a,b){var vx=b.x-a.x,vy=b.y-a.y,det=d.x*(-vy)-d.y*(-vx);if(Math.abs(det)<1e-9)return null;var ax=a.x-o.x,ay=a.y-o.y,t=(ax*(-vy)-ay*(-vx))/det,u=(d.x*ay-d.y*ax)/det;if(t>=0&&u>=0&&u<=1)return{t:t,pt:{x:o.x+d.x*t,y:o.y+d.y*t}};return null}
function mkTracks(){
function oval(){var pts=[],rx=300,ry=190;for(var i=0;i<=260;i++){var t=i/260*2*Math.PI;pts.push({x:Math.cos(t)*rx,y:Math.sin(t)*ry})}return{name:"Oval",hint:"Овал для line-follow",line:{pts:pts,closed:true,width:14},walls:[]}}
function fig8(){var pts=[],r=190;for(var i=0;i<=320;i++){var t=i/320*2*Math.PI;pts.push({x:Math.sin(t)*r,y:Math.sin(t)*Math.cos(t)*r})}return{name:"Figure-8",hint:"Вісімка",line:{pts:pts,closed:true,width:14},walls:[]}}
function s(){var pts=[],w=680;for(var i=0;i<=300;i++){var t=i/300;pts.push({x:U.lerp(-w/2,w/2,t),y:Math.sin(t*Math.PI*2)*140})}return{name:"S-curve",hint:"S крива",line:{pts:pts,closed:false,width:14},walls:[]}}
function arena(){var lp=[{x:-340,y:0},{x:-130,y:-130},{x:130,y:-130},{x:340,y:0},{x:130,y:130},{x:-130,y:130},{x:-340,y:0}],walls=[];function rect(x1,y1,x2,y2){walls.push({a:{x:x1,y:y1},b:{x:x2,y:y1}});walls.push({a:{x:x2,y:y1},b:{x:x2,y:y2}});walls.push({a:{x:x2,y:y2},b:{x:x1,y:y2}});walls.push({a:{x:x1,y:y2},b:{x:x1,y:y1}})}rect(-460,-290,460,290);rect(-260,-120,260,120);return{name:"Arena",hint:"Арена + стіни",line:{pts:lp,closed:true,width:12},walls:walls}}
function rectLine(){var pts=[{x:-320,y:-180},{x:320,y:-180},{x:320,y:180},{x:-320,y:180},{x:-320,y:-180}];return{name:"Rectangle",hint:"Прямокутник",line:{pts:pts,closed:true,width:14},walls:[]}}
return[oval(),fig8(),s(),arena(),rectLine()]
}
function css(){if(document.getElementById("rc_sim2d_css_v2"))return;var s=document.createElement("style");s.id="rc_sim2d_css_v2";s.textContent=
".rcsimTab{position:fixed;inset:0;z-index:2147483647;display:none;background:#0b1020;color:#e5e7eb;font-family:system-ui,Segoe UI,Roboto}"+
".rcsimHead{height:54px;display:flex;align-items:center;gap:10px;padding:0 14px;border-bottom:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03)}"+
".rcsimDot{width:9px;height:9px;border-radius:999px;background:#fbbf24}"+
".rcsimTitle{font-weight:950;letter-spacing:.08em;text-transform:uppercase;font-size:12px}"+
".rcsimSpacer{flex:1}"+
".rcsimBtn{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#e5e7eb;border-radius:12px;padding:8px 12px;font-weight:950;font-size:12px;cursor:pointer}"+
".rcsimBtn:hover{background:rgba(255,255,255,.09)}"+
".rcsimBody{position:absolute;left:0;right:0;top:54px;bottom:0;display:grid;grid-template-columns:285px 1fr;min-height:0}"+
".rcsimLeft{padding:12px 12px;overflow:auto;border-right:1px solid rgba(255,255,255,.08)}"+
".rcsimLeft::-webkit-scrollbar{width:10px}"+
".rcsimLeft::-webkit-scrollbar-thumb{background:rgba(255,255,255,.10);border-radius:10px}"+
".rcsimH{margin:6px 0 8px;font-weight:950;letter-spacing:.08em;text-transform:uppercase;font-size:12px;color:rgba(229,231,235,.85)}"+
".rcsimRow{display:flex;align-items:center;justify-content:space-between;margin:8px 0}"+
".rcsimLbl{font-weight:900;font-size:13px}"+
".rcsimVal{font-weight:950;font-size:13px;color:#93c5fd;min-width:56px;text-align:right}"+
".rcsimSel{width:100%;padding:10px 12px;border-radius:14px;border:1px solid rgba(148,163,184,.14);background:rgba(2,6,23,.25);color:#e2e8f0;font-weight:950;outline:none}"+
".rcsimChk{display:flex;align-items:center;gap:10px;margin-top:10px;font-weight:900;font-size:13px;color:#e2e8f0;cursor:pointer}"+
".rcsimChk input{width:16px;height:16px}"+
".rcsimHint{margin-top:10px;font-size:12px;line-height:1.35;color:rgba(229,231,235,.72)}"+
".rcsimCtrl{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}"+
".rcsimRight{position:relative;min-height:0}"+
".rcsimCanvas{position:absolute;inset:0;width:100%;height:100%;display:block;cursor:grab;background:#6b7078;touch-action:none}"+
".rcsimCanvas.grab{cursor:grabbing}"+
".rcsimPills{position:absolute;left:10px;top:10px;display:flex;gap:8px;flex-wrap:wrap;z-index:3}"+
".rcsimPill{border:1px solid rgba(255,255,255,.12);background:rgba(0,0,0,.18);backdrop-filter:blur(6px);border-radius:999px;padding:7px 10px;font-weight:950;font-size:12px}"+
".rcsimFoot{position:absolute;right:10px;bottom:10px;display:flex;gap:8px;z-index:3}"+
".rcsimSmall{border:1px solid rgba(255,255,255,.12);background:rgba(0,0,0,.18);backdrop-filter:blur(6px);border-radius:12px;padding:7px 10px;font-weight:950;font-size:12px;cursor:pointer;color:#e5e7eb}"+
".rcsimSmall:hover{background:rgba(0,0,0,.26)}";document.head.appendChild(s)}
function storage(){var ok=true;try{var k="__t";localStorage.setItem(k,"1");localStorage.removeItem(k)}catch(e){ok=false}return{get:function(k){if(!ok)return null;try{return localStorage.getItem(k)}catch(e){return null}},set:function(k,v){if(!ok)return;try{localStorage.setItem(k,v)}catch(e){}}}}
function Sim(){this.tracks=mkTracks();this.i=0;this.t=this.tracks[0];this.v={x:0,y:0,s:1,drag:false,sx:0,sy:0,vx0:0,vy0:0};this.cv=null;this.ctx=null;this.w=1;this.h=1;this.car={p:{x:0,y:0},a:-Math.PI/2,v:0,w:0,l:0,r:0,wb:74,ms:260,ma:560,mw:4.4,rad:30,wid:72,hei:46};this.s=[{x:-18,y:40},{x:-6,y:42},{x:6,y:42},{x:18,y:40}];this.es=false;this.ds=-1;this.sv=[0,0,0,0];this.dv=0;this.run=false;this.pause=false;this.step=false;this.last=U.now();this.ui={root:null,sel:null,hint:null,pS:null,pZ:null,vals:[],chkE:null,chkF:null,chkR:null,pFPS:null};this.follow=false;this.showRays=true;this.st=storage();this.hooked=false;this.keys={u:false,d:false,l:false,r:false};this.fps={t:U.now(),n:0,val:60}}
Sim.prototype.reset=function(){var c=this.car;c.p.x=0;c.p.y=0;c.a=-Math.PI/2;c.v=0;c.w=0;c.l=0;c.r=0;this.v.x=0;this.v.y=0;this.v.s=1};
Sim.prototype.setTrack=function(i){i=U.cl(i,0,this.tracks.length-1);this.i=i;this.t=this.tracks[i];this.reset();this.save()};
Sim.prototype.w2s=function(p){var s=this.v.s;return{x:(p.x-this.v.x)*s+this.w*0.5,y:(p.y-this.v.y)*s+this.h*0.5}};
Sim.prototype.s2w=function(p){var s=this.v.s;return{x:(p.x-this.w*0.5)/s+this.v.x,y:(p.y-this.h*0.5)/s+this.v.y}};
Sim.prototype.wheel=function(cx,cy,dy){var s=this.v.s,z=Math.pow(1.0015,-dy),ns=U.cl(s*z,0.35,3.6),b=this.s2w({x:cx,y:cy});this.v.s=ns;var a=this.s2w({x:cx,y:cy});this.v.x+=b.x-a.x;this.v.y+=b.y-a.y;this.save();if(this.ui.pZ)this.ui.pZ.textContent="x"+this.v.s.toFixed(2)};
Sim.prototype.save=function(){try{this.st.set("rc_sim2d_state_v2",JSON.stringify({i:this.i,s:this.s,v:{x:this.v.x,y:this.v.y,s:this.v.s},f:this.follow,r:this.showRays}))}catch(e){}};
Sim.prototype.load=function(){try{var raw=this.st.get("rc_sim2d_state_v2");if(!raw)return;var o=JSON.parse(raw);if(o&&typeof o.i==="number")this.setTrack(o.i);if(o&&o.s&&o.s.length===4){for(var i=0;i<4;i++){this.s[i].x=Number(o.s[i].x)||this.s[i].x;this.s[i].y=Number(o.s[i].y)||this.s[i].y}}if(o&&o.v){this.v.x=Number(o.v.x)||0;this.v.y=Number(o.v.y)||0;this.v.s=U.cl(Number(o.v.s)||1,0.35,3.6)}this.follow=!!(o&&o.f);this.showRays=!(o&&o.r===false)}catch(e){}};
Sim.prototype.handleKeys=function(){var c=this.car,spd=70;var L=c.l,R=c.r;if(this.keys.u){L+=spd;R+=spd}if(this.keys.d){L-=spd;R-=spd}if(this.keys.l){L-=spd;R+=spd}if(this.keys.r){L+=spd;R-=spd}c.l=U.cl(L,-100,100);c.r=U.cl(R,-100,100)};
Sim.prototype.phys=function(dt){
this.handleKeys();
var c=this.car,tl=U.cl(c.l,-100,100)/100*c.ms,tr=U.cl(c.r,-100,100)/100*c.ms,tv=(tl+tr)*0.5,tw=(tr-tl)/c.wb;
var dv=U.cl(tv-c.v,-c.ma*dt,c.ma*dt);c.v+=dv;
var dw=U.cl(tw-c.w,-c.mw*dt,c.mw*dt);c.w+=dw;
c.a+=c.w*dt;
c.p.x+=Math.cos(c.a)*c.v*dt;c.p.y+=Math.sin(c.a)*c.v*dt;
c.v*=Math.pow(0.985,dt*60);c.w*=Math.pow(0.985,dt*60);
this.coll();
if(this.follow){this.v.x=c.p.x;this.v.y=c.p.y}
};
Sim.prototype.coll=function(){var t=this.t;if(!t||!t.walls||!t.walls.length)return;var p=this.car.p,r=this.car.rad;for(var i=0;i<t.walls.length;i++){var w=t.walls[i],q=segCP(p,w.a,w.b),dx=p.x-q.x,dy=p.y-q.y,d=Math.sqrt(dx*dx+dy*dy);if(d<r&&d>1e-6){var push=r-d;p.x+=dx/d*push;p.y+=dy/d*push}}};
Sim.prototype.sample=function(){
var t=this.t;if(!t||!t.line||!t.line.pts){this.sv=[0,0,0,0];this.dv=0;return}
var line=t.line,c=this.car,vals=[],w=line.width||12;
for(var i=0;i<4;i++){
var wp=U.add(c.p,U.rot({x:this.s[i].x,y:this.s[i].y},c.a));
var d=polyD(wp,line.pts,!!line.closed),v=0;
if(d<=w*1.3){var x=U.cl(1-d/(w*1.3),0,1);v=x*100}
vals.push(v)
}
this.sv=vals;
var o=U.add(c.p,U.rot({x:0,y:34},c.a)),dir=U.rot({x:1,y:0},c.a);
var best=999,hit=null;
if(t.walls&&t.walls.length){best=1e9;for(var j=0;j<t.walls.length;j++){var rr=raySeg(o,dir,t.walls[j].a,t.walls[j].b);if(rr&&rr.t<best){best=rr.t;hit=rr.pt}}}
this.dv=isFinite(best)?U.cl(best,0,999):999;
window.sensorData=vals.slice(0,4);window.distanceData=[this.dv];
this._ray={o:o,dir:dir,best:best,hit:hit}
};
Sim.prototype.draw=function(){
var ctx=this.ctx;if(!ctx)return;
ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,this.w,this.h);
ctx.fillStyle="#6b7078";ctx.fillRect(0,0,this.w,this.h);
var s=this.v.s;ctx.setTransform(s,0,0,s,this.w*0.5-this.v.x*s,this.h*0.5-this.v.y*s);
this.grid(ctx);this.track(ctx);this.carDraw(ctx);this.sensors(ctx);
};
Sim.prototype.grid=function(ctx){
var step=50,s=this.v.s,x0=Math.floor((this.v.x-this.w/s)/step)*step,x1=Math.ceil((this.v.x+this.w/s)/step)*step,y0=Math.floor((this.v.y-this.h/s)/step)*step,y1=Math.ceil((this.v.y+this.h/s)/step)*step;
ctx.lineWidth=1/s;ctx.strokeStyle="rgba(0,0,0,.12)";ctx.beginPath();
for(var x=x0;x<=x1;x+=step){ctx.moveTo(x,y0);ctx.lineTo(x,y1)}
for(var y=y0;y<=y1;y+=step){ctx.moveTo(x0,y);ctx.lineTo(x1,y)}
ctx.stroke();
ctx.strokeStyle="rgba(255,255,255,.06)";ctx.beginPath();
ctx.moveTo(0,y0);ctx.lineTo(0,y1);ctx.moveTo(x0,0);ctx.lineTo(x1,0);ctx.stroke();
};
Sim.prototype.track=function(ctx){
var t=this.t;if(!t)return;var line=t.line;
if(line&&line.pts&&line.pts.length>1){
ctx.lineCap="round";ctx.lineJoin="round";
ctx.strokeStyle="rgba(16,16,16,.92)";ctx.lineWidth=(line.width||12);ctx.beginPath();
ctx.moveTo(line.pts[0].x,line.pts[0].y);for(var i=1;i<line.pts.length;i++)ctx.lineTo(line.pts[i].x,line.pts[i].y);if(line.closed)ctx.closePath();ctx.stroke();
ctx.strokeStyle="rgba(0,0,0,.22)";ctx.lineWidth=(line.width||12)+6;ctx.beginPath();
ctx.moveTo(line.pts[0].x,line.pts[0].y);for(var j=1;j<line.pts.length;j++)ctx.lineTo(line.pts[j].x,line.pts[j].y);if(line.closed)ctx.closePath();ctx.stroke();
}
if(t.walls&&t.walls.length){
ctx.strokeStyle="rgba(255,255,255,.18)";ctx.lineWidth=6;ctx.beginPath();
for(var k=0;k<t.walls.length;k++){var w=t.walls[k];ctx.moveTo(w.a.x,w.a.y);ctx.lineTo(w.b.x,w.b.y)}ctx.stroke();
ctx.strokeStyle="rgba(0,0,0,.22)";ctx.lineWidth=2;ctx.beginPath();
for(var m=0;m<t.walls.length;m++){var w2=t.walls[m];ctx.moveTo(w2.a.x,w2.a.y);ctx.lineTo(w2.b.x,w2.b.y)}ctx.stroke();
}
};
function rr(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath()}
Sim.prototype.carDraw=function(ctx){
var c=this.car;ctx.save();ctx.translate(c.p.x,c.p.y);ctx.rotate(c.a);
var bw=c.wid,bh=c.hei;
ctx.fillStyle="rgba(0,0,0,.28)";rr(ctx,-bw/2-6,-bh/2-6,bw+12,bh+12,14);ctx.fill();
ctx.fillStyle="#60a5fa";rr(ctx,-bw/2,-bh/2,bw,bh,12);ctx.fill();
ctx.fillStyle="rgba(255,255,255,.22)";rr(ctx,-bw/2+8,-bh/2+6,bw-16,14,10);ctx.fill();
ctx.fillStyle="rgba(2,6,23,.65)";rr(ctx,-bw/2-10,-bh/2+4,14,bh-8,7);ctx.fill();rr(ctx,bw/2-4,-bh/2+4,14,bh-8,7);ctx.fill();
ctx.fillStyle="rgba(255,255,255,.85)";ctx.beginPath();ctx.moveTo(bw/2-2,0);ctx.lineTo(bw/2+16,0);ctx.lineTo(bw/2-2,-7);ctx.closePath();ctx.fill();
ctx.fillStyle="rgba(15,23,42,.75)";rr(ctx,-12,-10,24,20,10);ctx.fill();
ctx.restore();
};
Sim.prototype.sensors=function(ctx){
var c=this.car;
for(var i=0;i<4;i++){
var wp=U.add(c.p,U.rot({x:this.s[i].x,y:this.s[i].y},c.a));
ctx.fillStyle=this.es?"rgba(251,191,36,.95)":"rgba(147,197,253,.92)";
ctx.strokeStyle="rgba(0,0,0,.35)";ctx.lineWidth=2;ctx.beginPath();ctx.arc(wp.x,wp.y,6,0,Math.PI*2);ctx.fill();ctx.stroke();
}
if(this.showRays){
var r=this._ray;if(r){var o=r.o,dir=r.dir,b=isFinite(r.best)?Math.min(r.best,260):260;
ctx.strokeStyle="rgba(167,243,208,.72)";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(o.x,o.y);ctx.lineTo(o.x+dir.x*b,o.y+dir.y*b);ctx.stroke();
if(r.hit){ctx.fillStyle="rgba(167,243,208,.95)";ctx.beginPath();ctx.arc(r.hit.x,r.hit.y,5,0,Math.PI*2);ctx.fill()}
}}
};
Sim.prototype.uiBuild=function(){
css();
var root=document.createElement("div");root.className="rcsimTab";root.id="rcsimTabRoot";
root.innerHTML='<div class="rcsimHead"><div class="rcsimDot"></div><div class="rcsimTitle">Симулятор (2D)</div><div class="rcsimSpacer"></div><button class="rcsimBtn" data-a="back">Назад</button></div>'+
'<div class="rcsimBody"><div class="rcsimLeft">'+
'<div class="rcsimH">Траса</div><select class="rcsimSel" data-a="track"></select>'+
'<label class="rcsimChk"><input type="checkbox" data-a="follow">Камера за машинкою</label>'+
'<label class="rcsimChk"><input type="checkbox" data-a="rays" checked>Промінь distance</label>'+
'<label class="rcsimChk"><input type="checkbox" data-a="edit">Редагувати 4 сенсори</label>'+
'<div class="rcsimCtrl"><button class="rcsimBtn" data-a="reset">Reset</button><button class="rcsimBtn" data-a="center">Center</button></div>'+
'<div class="rcsimH" style="margin-top:14px">Сенсори</div>'+
'<div class="rcsimRow"><div class="rcsimLbl">S1</div><div class="rcsimVal" data-s="0">0</div></div>'+
'<div class="rcsimRow"><div class="rcsimLbl">S2</div><div class="rcsimVal" data-s="1">0</div></div>'+
'<div class="rcsimRow"><div class="rcsimLbl">S3</div><div class="rcsimVal" data-s="2">0</div></div>'+
'<div class="rcsimRow"><div class="rcsimLbl">S4</div><div class="rcsimVal" data-s="3">0</div></div>'+
'<div class="rcsimRow"><div class="rcsimLbl">DIST</div><div class="rcsimVal" data-s="4">0</div></div>'+
'<div class="rcsimHint" data-a="hint"></div>'+
'<div class="rcsimHint">Колесо — zoom. Перетяг ЛКМ/ПКМ/СКМ — pan. Shift — швидше. Стрілки — ручний рух.</div>'+
'</div><div class="rcsimRight">'+
'<canvas class="rcsimCanvas" data-a="cv"></canvas>'+
'<div class="rcsimPills"><div class="rcsimPill" data-a="pS">L 0  R 0</div><div class="rcsimPill" data-a="pZ">x1.00</div><div class="rcsimPill" data-a="pF">60 FPS</div></div>'+
'<div class="rcsimFoot"><button class="rcsimSmall" data-a="pause">Pause</button><button class="rcsimSmall" data-a="step">Step</button><button class="rcsimSmall" data-a="run">Run</button></div>'+
'</div></div>';
document.body.appendChild(root);
this.ui.root=root;this.ui.sel=root.querySelector('[data-a="track"]');this.ui.hint=root.querySelector('[data-a="hint"]');
this.ui.pS=root.querySelector('[data-a="pS"]');this.ui.pZ=root.querySelector('[data-a="pZ"]');this.ui.pFPS=root.querySelector('[data-a="pF"]');
this.ui.chkE=root.querySelector('[data-a="edit"]');this.ui.chkF=root.querySelector('[data-a="follow"]');this.ui.chkR=root.querySelector('[data-a="rays"]');
this.cv=root.querySelector('[data-a="cv"]');this.ctx=this.cv.getContext("2d",{alpha:false});
var self=this;
this.ui.sel.innerHTML="";for(var i=0;i<this.tracks.length;i++){var o=document.createElement("option");o.value=String(i);o.textContent=this.tracks[i].name;this.ui.sel.appendChild(o)}
root.querySelector('[data-a="back"]').onclick=function(){window.RCSim2D.close()};
root.querySelector('[data-a="reset"]').onclick=function(){self.reset();self.save();self.draw();self.uiUpdate()};
root.querySelector('[data-a="center"]').onclick=function(){self.v.x=0;self.v.y=0;self.v.s=1;self.save();self.draw();self.uiUpdate()};
this.ui.sel.onchange=function(){self.setTrack(Number(self.ui.sel.value)||0);self.ui.hint.textContent=self.t.hint||"";self.draw();self.uiUpdate()};
this.ui.chkE.onchange=function(){self.es=!!self.ui.chkE.checked;self.save();self.draw()};
this.ui.chkF.onchange=function(){self.follow=!!self.ui.chkF.checked;self.save()};
this.ui.chkR.onchange=function(){self.showRays=!!self.ui.chkR.checked;self.save();self.draw()};
root.querySelector('[data-a="pause"]').onclick=function(){self.pause=!self.pause;root.querySelector('[data-a="pause"]').textContent=self.pause?"Resume":"Pause"};
root.querySelector('[data-a="step"]').onclick=function(){self.step=true;self.pause=true;root.querySelector('[data-a="pause"]').textContent="Resume"};
root.querySelector('[data-a="run"]').onclick=function(){self.pause=false;root.querySelector('[data-a="pause"]').textContent="Pause"};
this.bindInput();
this.resize();
this.load();
this.ui.sel.value=String(this.i);this.ui.hint.textContent=this.t.hint||"";this.ui.chkE.checked=this.es;this.ui.chkF.checked=this.follow;this.ui.chkR.checked=this.showRays;
if(this.ui.pZ)this.ui.pZ.textContent="x"+this.v.s.toFixed(2);
this.draw();this.uiUpdate();
var onResize=function(){if(self.ui.root&&self.ui.root.style.display!=="none"){self.resize();self.draw()}};
window.addEventListener("resize",onResize,{passive:true});
};
Sim.prototype.resize=function(){if(!this.cv)return;var r=this.cv.getBoundingClientRect();this.w=Math.max(1,Math.floor(r.width));this.h=Math.max(1,Math.floor(r.height));this.cv.width=this.w;this.cv.height=this.h};
Sim.prototype.bindInput=function(){
var self=this,cv=this.cv;
cv.addEventListener("contextmenu",function(e){e.preventDefault()});
cv.addEventListener("wheel",function(e){e.preventDefault();var r=cv.getBoundingClientRect();self.wheel(e.clientX-r.left,e.clientY-r.top,e.deltaY||0);self.draw()},{passive:false});
cv.addEventListener("pointerdown",function(e){
cv.setPointerCapture(e.pointerId);
var r=cv.getBoundingClientRect(),sx=e.clientX-r.left,sy=e.clientY-r.top,wp=self.s2w({x:sx,y:sy});
if(self.es){
for(var i=0;i<4;i++){
var sp=U.add(self.car.p,U.rot({x:self.s[i].x,y:self.s[i].y},self.car.a));
var dx=wp.x-sp.x,dy=wp.y-sp.y;
if(dx*dx+dy*dy<12*12){self.ds=i;cv.classList.add("grab");return}
}
}
self.v.drag=true;self.v.sx=sx;self.v.sy=sy;self.v.vx0=self.v.x;self.v.vy0=self.v.y;cv.classList.add("grab");
});
cv.addEventListener("pointermove",function(e){
var r=cv.getBoundingClientRect(),sx=e.clientX-r.left,sy=e.clientY-r.top;
if(self.ds>=0){
var wp=self.s2w({x:sx,y:sy}),local=U.sub(wp,self.car.p);local=U.rot(local,-self.car.a);
self.s[self.ds].x=U.cl(local.x,-self.car.wid/2,self.car.wid/2);
self.s[self.ds].y=U.cl(local.y,-self.car.hei/2-20,self.car.hei/2+20);
self.save();self.draw();return
}
if(!self.v.drag)return;
var dx=(sx-self.v.sx)/self.v.s,dy=(sy-self.v.sy)/self.v.s,boost=e.shiftKey?1.9:1.0;
self.v.x=self.v.vx0-dx*boost;self.v.y=self.v.vy0-dy*boost;self.draw();
});
function end(){self.v.drag=false;self.ds=-1;cv.classList.remove("grab");self.save()}
cv.addEventListener("pointerup",end);cv.addEventListener("pointercancel",end);
window.addEventListener("keydown",function(e){if(self.ui.root&&self.ui.root.style.display!=="none"){if(e.key==="ArrowUp")self.keys.u=true;else if(e.key==="ArrowDown")self.keys.d=true;else if(e.key==="ArrowLeft")self.keys.l=true;else if(e.key==="ArrowRight")self.keys.r=true}});
window.addEventListener("keyup",function(e){if(self.ui.root&&self.ui.root.style.display!=="none"){if(e.key==="ArrowUp")self.keys.u=false;else if(e.key==="ArrowDown")self.keys.d=false;else if(e.key==="ArrowLeft")self.keys.l=false;else if(e.key==="ArrowRight")self.keys.r=false}});
};
Sim.prototype.uiUpdate=function(){
if(!this.ui.root)return;
var els=this.ui.root.querySelectorAll("[data-s]");
for(var i=0;i<els.length;i++){var idx=Number(els[i].getAttribute("data-s"));els[i].textContent=idx<4?String(Math.round(this.sv[idx]||0)):String(Math.round(this.dv||0))}
if(this.ui.pS)this.ui.pS.textContent="L "+Math.round(this.car.l)+"  R "+Math.round(this.car.r);
if(this.ui.pZ)this.ui.pZ.textContent="x"+this.v.s.toFixed(2);
this.fps.n++;var t=U.now();if(t-this.fps.t>350){this.fps.val=Math.round(this.fps.n*1000/(t-this.fps.t));this.fps.n=0;this.fps.t=t}
if(this.ui.pFPS)this.ui.pFPS.textContent=this.fps.val+" FPS";
};
Sim.prototype.installHook=function(){
if(this.hooked)return;this.hooked=true;
var self=this,orig=window.sendDrivePacket;
window.__rcsim2d_origSendDrivePacket=orig;
window.sendDrivePacket=async function(L,R){
self.car.l=Number(L)||0;self.car.r=Number(R)||0;
if(self.ui.pS)self.ui.pS.textContent="L "+Math.round(self.car.l)+"  R "+Math.round(self.car.r);
if(typeof orig==="function"){try{return await orig.apply(this,arguments)}catch(e){}}
};
};
Sim.prototype.tick=function(){
if(!this.run)return;
var t=U.now(),dt=(t-this.last)/1000;this.last=t;dt=U.cl(dt,0,0.05);
if(!this.pause||this.step){if(this.step){dt=1/60;this.step=false}this.phys(dt)}
this.sample();this.draw();this.uiUpdate();
var self=this;requestAnimationFrame(function(){self.tick()})
};
Sim.prototype.open=function(){
if(!this.ui.root)this.uiBuild();
this.ui.root.style.display="block";this.resize();this.draw();this.uiUpdate();
this.run=true;this.pause=false;this.step=false;this.last=U.now();
this.installHook();this.tick()
};
Sim.prototype.close=function(){if(!this.ui.root)return;this.run=false;this.ui.root.style.display="none";this.save()};
var sim=new Sim();
var api={__rcVersion:"tab-v2",open:function(){sim.open()},close:function(){sim.close()},_sim:sim};
window.RCSim2D=api;
function autoHook(){
var cand=[].slice.call(document.querySelectorAll("button,a,.btn"));
for(var i=0;i<cand.length;i++){
var t=(cand[i].textContent||"").trim().toLowerCase();
if(t==="симулятор"||t.includes("симулятор")){
cand[i].addEventListener("click",function(e){try{api.open();e.preventDefault();e.stopPropagation()}catch(_){}},true);
break;
}
}
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",autoHook);else setTimeout(autoHook,0);
})();
