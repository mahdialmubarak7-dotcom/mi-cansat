/* =========================================================
   Mission Impossible: Drop from the Four Seasons
   An endless CanSat game. Steer between the twin towers of the
   Four Seasons Hotel, Bahrain Bay, and keep falling for as long
   as you can. Scores are kept in this browser only.
   ========================================================= */
(function(){
'use strict';
const view=document.getElementById('play');if(!view)return;
const q=s=>view.querySelector(s);
const stage=q('#gstage'),box=q('#gbox'),cv=q('#gcv'),ctx=cv.getContext('2d');
const small=matchMedia('(max-width: 900px), (pointer: coarse)');
const hud=q('#ghud'),elScore=q('#gscore'),elBest=q('#gbest');
const pCustom=q('#gcustom'),pPause=q('#gpaused'),pOver=q('#gover');

/* ---------- world constants (logical pixels, canvas is 3:5) ---------- */
const W=360,H=600,FW=34,L=FW,R=W-FW,CAN_START=106,CAN_SCREEN=190;
const KEY='mi-cansat-game-v1';
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;

const BODY=[{n:'Mission red',c:'#e1001a'},{n:'Bahrain white',c:'#eef2fb'},{n:'Space blue',c:'#1d56d6'},
  {n:'Palm green',c:'#2fbf6f'},{n:'Desert gold',c:'#f0b35a'},{n:'Night black',c:'#232b40'}];
const CHUTE=[{n:'Red and white',a:'#e1001a',b:'#ffffff'},{n:'Sunset',a:'#ff7a1a',b:'#ffd84a'},
  {n:'Ocean',a:'#1d56d6',b:'#7fc8ff'},{n:'Palm',a:'#1f9d55',b:'#9be7b8'},{n:'Royal',a:'#7b3fe0',b:'#d2b8ff'}];
const DECAL=['Plain','Stripe','Bahrain flag'];

/* ---------- saved settings and scores (this browser only) ---------- */
const save={name:'',body:0,chute:0,decal:2,best:0,board:[]};
try{const s=JSON.parse(localStorage.getItem(KEY)||'null');if(s&&typeof s==='object')Object.assign(save,s)}catch(e){}
if(!Array.isArray(save.board))save.board=[];
const okIdx=(v,n)=>Number.isInteger(v)&&v>=0&&v<n;
if(!okIdx(save.body,BODY.length))save.body=0;
if(!okIdx(save.chute,CHUTE.length))save.chute=0;
if(!okIdx(save.decal,DECAL.length))save.decal=2;
save.best=Math.max(0,+save.best||0);
const persist=()=>{try{localStorage.setItem(KEY,JSON.stringify(save))}catch(e){}};

/* ---------- helpers ---------- */
const rand=(a,b)=>a+Math.random()*(b-a);
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const hash=(a,b)=>{const v=Math.sin(a*127.1+b*311.7)*43758.5453;return v-Math.floor(v)};
const hit=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const circHit=(cx,cy,r,b)=>{const dx=cx-clamp(cx,b.x,b.x+b.w),dy=cy-clamp(cy,b.y,b.y+b.h);return dx*dx+dy*dy<r*r};
function rr(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath()}
function flag(c,x,y,w,h){c.fillStyle='#ce1126';c.fillRect(x,y,w,h);c.fillStyle='#fff';const b=w*.3;c.fillRect(x,y,b,h);
  c.beginPath();for(let i=0;i<5;i++){c.moveTo(x+b,y+i*h/5);c.lineTo(x+b+w*.16,y+(i+.5)*h/5);c.lineTo(x+b,y+(i+1)*h/5)}c.fill()}

/* ---------- canvas sizing ---------- */
let k=1,sky=null;
function resize(){const r=box.getBoundingClientRect();if(!r.width)return;
  const dpr=Math.min(2,window.devicePixelRatio||1);k=r.width/W*dpr;
  cv.width=Math.round(W*k);cv.height=Math.round(H*k);sky=null;render()}
const gameRO=new ResizeObserver(resize);gameRO.observe(box);

/* ---------- static background: Manama skyline over Bahrain Bay at dusk ---------- */
function buildSky(){
  const SW=W+60,HZ=480,c=document.createElement('canvas');c.width=Math.ceil(SW*k);c.height=Math.ceil(H*k);
  const g=c.getContext('2d');g.scale(k,k);
  const gr=g.createLinearGradient(0,0,0,H);
  gr.addColorStop(0,'#02050f');gr.addColorStop(.42,'#0a1638');gr.addColorStop(.68,'#251f4c');gr.addColorStop(.8,'#5e2d4c');
  gr.addColorStop(.8,'#0b1732');gr.addColorStop(1,'#020611');g.fillStyle=gr;g.fillRect(0,0,SW,H);
  for(let i=0;i<90;i++){const x=hash(i,1)*SW,y=hash(i,2)*400,a=.25+hash(i,3)*.6;g.fillStyle=`rgba(232,238,252,${a*(1-y/480)})`;g.fillRect(x,y,1.3,1.3)}
  const mg=g.createRadialGradient(330,96,4,330,96,60);mg.addColorStop(0,'rgba(244,234,208,.35)');mg.addColorStop(1,'rgba(244,234,208,0)');
  g.fillStyle=mg;g.fillRect(260,30,140,140);g.fillStyle='#f4ead0';g.beginPath();g.arc(330,96,13,0,7);g.fill();
  g.fillStyle='#0b1732';g.beginPath();g.arc(336,92,11,0,7);g.fill();   // crescent moon
  const win=(x,y,w,h,s)=>{for(let yy=y+4;yy<HZ-3;yy+=6)for(let xx=x+3;xx<x+w-3;xx+=5){const v=hash(xx+s,yy);if(v>.7){g.fillStyle=`rgba(255,207,122,${.25+(v-.7)*1.8})`;g.fillRect(xx,yy,2,2)}}};
  g.fillStyle='#0a1230';for(let x=0;x<SW;){const w=10+hash(x,3)*22,h=14+hash(x,4)*46;g.fillRect(x,HZ-h,w-1,h);x+=w}
  const towers=[[10,400,18,80],[34,386,14,94],[52,412,20,68],[160,420,22,60],[190,404,16,76],[312,382,16,98],[334,362,20,118],[362,396,22,84],[392,372,18,108]];
  g.fillStyle='#0e1a40';towers.forEach(t=>g.fillRect(t[0],t[1],t[2],HZ-t[1]));g.fillRect(343,344,2,18);
  towers.forEach((t,i)=>win(t[0],t[1],t[2],0,i*31));
  // Bahrain World Trade Center: two sails joined by three wind turbines
  g.fillStyle='#0f1c46';g.beginPath();g.moveTo(80,HZ);g.lineTo(102,HZ);g.lineTo(100,318);g.quadraticCurveTo(72,392,80,HZ);g.fill();
  g.beginPath();g.moveTo(140,HZ);g.lineTo(118,HZ);g.lineTo(120,318);g.quadraticCurveTo(148,392,140,HZ);g.fill();
  g.strokeStyle='rgba(134,168,198,.35)';g.lineWidth=1;g.beginPath();g.moveTo(100,318);g.lineTo(102,HZ);g.moveTo(120,318);g.lineTo(118,HZ);g.stroke();
  [352,388,424].forEach(y=>{g.fillStyle='#0f1c46';g.fillRect(100,y,20,3);g.strokeStyle='rgba(200,214,240,.5)';g.beginPath();
    for(let b=0;b<3;b++){const a=b*2.094+.4;g.moveTo(110,y+1.5);g.lineTo(110+Math.cos(a)*8,y+1.5+Math.sin(a)*8)}g.stroke()});
  win(82,330,18,0,7);win(120,330,18,0,9);
  // Bahrain Financial Harbour twin towers
  g.fillStyle='#0e1a40';g.beginPath();g.moveTo(240,HZ);g.lineTo(240,352);g.quadraticCurveTo(250,332,259,326);g.lineTo(259,HZ);g.fill();
  g.beginPath();g.moveTo(284,HZ);g.lineTo(284,362);g.quadraticCurveTo(274,342,265,336);g.lineTo(265,HZ);g.fill();win(240,350,19,0,3);win(265,358,19,0,5);
  // the bay
  for(let i=0;i<70;i++){const x=hash(i,7)*SW,y=HZ+4+hash(i,8)*112,w=4+hash(i,9)*14;g.fillStyle=hash(i,10)>.5?`rgba(255,207,122,${.06+hash(i,11)*.16})`:`rgba(134,168,198,${.05+hash(i,11)*.12})`;g.fillRect(x,y,w,1)}
  for(let y=HZ+6;y<H;y+=7){g.fillStyle=`rgba(244,234,208,${.18*(1-(y-HZ)/130)})`;g.fillRect(322+Math.sin(y)*4,y,14,1.2)}
  // a dhow on the water
  g.fillStyle='#04081a';g.beginPath();g.moveTo(148,520);g.lineTo(200,518);g.quadraticCurveTo(190,530,158,529);g.closePath();g.fill();
  g.strokeStyle='#04081a';g.lineWidth=1.4;g.beginPath();g.moveTo(172,520);g.lineTo(174,486);g.stroke();
  g.fillStyle='#101c46';g.beginPath();g.moveTo(168,484);g.lineTo(200,512);g.lineTo(160,514);g.closePath();g.fill();
  sky=c}

/* ---------- game state ---------- */
let state='custom',pausedFrom='play',t=0,introT=0,crashT=0,bannerTxt='',bannerT=0;
let cam=0,canY=CAN_START,vy=0,chute=0,can={x:W/2,vx:0,tilt:0,spin:0},ptr=null;
let obs=[],picks=[],parts=[],floats=[],nextY=520,lastSafe=W/2,bonus=0,score=0,shake=0,lastId=0;
const keys={l:false,r:false};
const lines=Array.from({length:16},(_,i)=>({x:L+8+hash(i,21)*(R-L-16),p:hash(i,22)*H,l:20+hash(i,23)*40}));

function reset(){cam=0;canY=CAN_START;vy=0;chute=0;can={x:W/2,vx:0,tilt:0,spin:0};ptr=null;
  obs=[];picks=[];parts=[];floats=[];nextY=520;lastSafe=W/2;bonus=0;score=0;shake=0;bannerTxt='';bannerT=0}

/* ---------- spawning: every obstacle leaves a reachable path ---------- */
function spawnAt(y,d,sp){
  const reach=Math.min(240,300*sp/Math.max(vy,140)),r=Math.random();
  if(r<.28){const gw=Math.max(88,124-40*d),gc=clamp(lastSafe+rand(-reach,reach),L+gw/2+4,R-gw/2-4);
    obs.push({t:'beam',y,gx:gc-gw/2,gw,h:14});lastSafe=gc}
  else if(r<.48){const right=lastSafe<W/2;let w=rand(90,150);
    if(right)w=Math.min(w,R-(lastSafe+30));else w=Math.min(w,(lastSafe-30)-L);
    if(w>=60)obs.push({t:'gondola',y,x:right?R-w:L,w,h:18});
    else obs.push({t:'falcon',y,x:Math.random()<.5?L-30:R+30,vx:0,ph:rand(0,6)})}
  else if(r<.70){const dir=Math.random()<.5?1:-1;obs.push({t:'falcon',y,x:dir>0?L-30:R+30,vx:dir*rand(70,120+90*d),ph:rand(0,6)})}
  else if(r<.86)obs.push({t:'drone',y,cx:rand(L+50,R-50),x:W/2,amp:rand(30,70),w:rand(1.4,2.6),ph:rand(0,6)});
  else{obs.push({t:'gust',y:y-60,h:150,dir:Math.random()<.5?1:-1});
    if(d>.35){const dir=Math.random()<.5?1:-1;obs.push({t:'falcon',y:y+40,x:dir>0?L-30:R+30,vx:dir*rand(80,140),ph:rand(0,6)})}}
  obs.forEach(o=>{if(o.t==='falcon'&&o.vx===0)o.vx=(o.x<W/2?1:-1)*90});
  if(Math.random()<.38)picks.push({y:y+sp*.5,x:clamp(lastSafe+rand(-40,40),L+16,R-16),ph:rand(0,6)})}

function burst(x,y,col,n,sp){for(let i=0;i<n;i++){const a=rand(0,6.28),v=rand(sp*.3,sp);parts.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:rand(.4,.9),c:col[i%col.length]})}}

/* ---------- update ---------- */
function update(dt){
  t+=dt;
  for(let i=parts.length;i--;){const p=parts[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=260*dt;p.life-=dt;if(p.life<=0)parts.splice(i,1)}
  for(let i=floats.length;i--;){const f=floats[i];f.y-=40*dt;f.life-=dt;if(f.life<=0)floats.splice(i,1)}
  shake*=Math.pow(.02,dt);
  if(state==='custom'){can.tilt=Math.sin(t*1.6)*.05;return}
  if(state==='pause'||state==='over')return;
  if(state==='intro'){introT+=dt;can.tilt=Math.sin(t*1.6)*.05;
    bannerTxt=introT<.6?'3':introT<1.2?'2':introT<1.8?'1':'';bannerT=1;
    if(introT>=1.8){state='play';bannerTxt='DROP!';bannerT=.8}return}
  if(state==='crash'){crashT+=dt;can.spin+=dt*9;canY+=70*dt;if(crashT>.9)gameOver();return}
  // play
  bannerT-=dt;const d=Math.min(1,canY/18000);
  const target=170+250*d+Math.min(70,Math.max(0,canY-18000)*.002);
  vy+=(target-vy)*Math.min(1,dt*(vy<120?3:1.2));canY+=vy*dt;
  if(canY-CAN_START>14)chute=Math.min(1,chute+dt*3.5);
  const ax=(keys.r?1:0)-(keys.l?1:0);
  if(ax){can.vx+=ax*1150*dt;ptr=null}
  else if(ptr!==null)can.vx+=((ptr-can.x)*9-can.vx)*Math.min(1,dt*10);
  for(const o of obs)if(o.t==='gust'&&canY>o.y&&canY<o.y+o.h)can.vx+=o.dir*240*dt;
  can.vx*=Math.pow(.06,dt);can.x+=can.vx*dt;
  if(can.x<L+13){can.x=L+13;can.vx=Math.abs(can.vx)*.3}else if(can.x>R-13){can.x=R-13;can.vx=-Math.abs(can.vx)*.3}
  can.tilt=clamp(can.vx*.0016,-.35,.35)+Math.sin(t*2.2)*.03;
  cam=Math.max(0,canY-CAN_SCREEN);
  while(nextY<cam+H+60){const sp=rand(1,1.25)*(235-80*d);spawnAt(nextY,d,sp);nextY+=sp}
  const box={x:can.x-9,y:canY-14,w:18,h:28};
  for(let i=obs.length;i--;){const o=obs[i];
    if(o.t==='falcon')o.x+=o.vx*dt;
    if(o.t==='drone')o.x=o.cx+Math.sin(t*o.w+o.ph)*o.amp;
    if(o.y+(o.h||0)<cam-140||(o.t==='falcon'&&(o.x<-80||o.x>W+80))){obs.splice(i,1);continue}
    let dead=false;
    if(o.t==='beam')dead=hit(box,{x:L,y:o.y,w:o.gx-L,h:o.h})||hit(box,{x:o.gx+o.gw,y:o.y,w:R-o.gx-o.gw,h:o.h});
    else if(o.t==='gondola')dead=hit(box,{x:o.x,y:o.y,w:o.w,h:o.h});
    else if(o.t==='falcon')dead=circHit(o.x,o.y+Math.sin(t*3+o.ph)*8,10,box);
    else if(o.t==='drone')dead=hit(box,{x:o.x-17,y:o.y-6,w:34,h:12});
    if(dead){crash();return}}
  for(let i=picks.length;i--;){const p=picks[i],py=p.y+Math.sin(t*3+p.ph)*4;
    if(p.y<cam-60){picks.splice(i,1);continue}
    if(circHit(p.x,py,13,box)){picks.splice(i,1);bonus+=25;floats.push({x:p.x,y:py,txt:'+25',life:.9});burst(p.x,py,['#3ddc84','#c8ffe0'],12,140)}}
  score=Math.max(0,Math.floor((canY-CAN_START)/8))+bonus;
  hudUpdate()}

/* ---------- drawing ---------- */
function drawCan(x,y,ck,ang){
  const b=BODY[save.body],ch=CHUTE[save.chute];
  ctx.save();ctx.translate(x,y);ctx.rotate(ang);
  if(ck>0){const cw=58*ck,chh=24*ck,cy=-48-6*ck;
    ctx.strokeStyle='rgba(220,228,245,.75)';ctx.lineWidth=.9;ctx.beginPath();
    [-1,-.4,.4,1].forEach(s=>{ctx.moveTo(s*cw/2,cy);ctx.lineTo(s*6,-17)});ctx.stroke();
    for(let i=0;i<6;i++){const a0=Math.PI+i*Math.PI/6;ctx.beginPath();ctx.moveTo(0,cy);ctx.ellipse(0,cy,cw/2,chh,0,a0,a0+Math.PI/6+.01);ctx.closePath();ctx.fillStyle=i%2?ch.b:ch.a;ctx.fill()}
    ctx.fillStyle='rgba(0,0,0,.18)';ctx.beginPath();ctx.ellipse(0,cy,cw/2,3*ck,0,0,Math.PI);ctx.fill()}
  ctx.strokeStyle='#c9d2e3';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(5,-17);ctx.lineTo(8,-27);ctx.stroke();
  rr(ctx,-11,-17,22,34,4);ctx.fillStyle=b.c;ctx.fill();
  if(save.decal===1){ctx.fillStyle=save.body===1?'#e1001a':'#ffffff';ctx.fillRect(-11,-4,22,6)}
  else if(save.decal===2){flag(ctx,-7,-6,14,10);ctx.strokeStyle='rgba(0,0,0,.25)';ctx.lineWidth=.6;ctx.strokeRect(-7,-6,14,10)}
  const sh=ctx.createLinearGradient(-11,0,11,0);sh.addColorStop(0,'rgba(255,255,255,.28)');sh.addColorStop(.45,'rgba(255,255,255,0)');sh.addColorStop(1,'rgba(0,0,0,.3)');
  rr(ctx,-11,-17,22,34,4);ctx.fillStyle=sh;ctx.fill();
  ctx.fillStyle='#c9d2e3';ctx.fillRect(-11,-17,22,3);ctx.fillRect(-11,14,22,3);
  ctx.restore()}

function facade(x0,side){
  const top=20-cam,y0=Math.max(top,-4);if(y0>H)return;
  const gr=ctx.createLinearGradient(x0,0,x0+FW,0);
  gr.addColorStop(0,side<0?'#081128':'#18295a');gr.addColorStop(1,side<0?'#18295a':'#081128');
  ctx.fillStyle=gr;ctx.fillRect(x0,y0,FW,H-y0);
  const fh=16;for(let f=Math.floor((y0+cam)/fh);;f++){const y=f*fh-cam;if(y>H)break;if(y+fh<y0)continue;
    for(let c=0;c<2;c++){const v=hash(f,c+(side>0?7:0));ctx.fillStyle=v>.8?`rgba(255,207,122,${.3+(v-.8)*3})`:'rgba(140,175,230,.09)';ctx.fillRect(x0+3+c*15,y+3,12,fh-6)}}
  ctx.fillStyle='rgba(134,168,198,.55)';ctx.fillRect(side<0?x0+FW-1.5:x0,y0,1.5,H-y0);
  if(top>-30){ctx.fillStyle='#22366e';ctx.fillRect(x0,top-4,FW,5);
    if(side>0){ctx.fillStyle=(t%1.4)<.7?'#ff2a45':'#5a0d18';ctx.beginPath();ctx.arc(x0+FW/2,top-8,2.4,0,7);ctx.fill()}
    else{ctx.strokeStyle='#c9d2e3';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x0+12,top-4);ctx.lineTo(x0+12,top-32);ctx.stroke();
      ctx.save();ctx.translate(x0+12,top-32);ctx.transform(1,Math.sin(t*3)*.06,0,1,0,0);flag(ctx,0,0,17,11);ctx.restore()}}}

function drawTopStructures(){
  const by=34-cam;if(by>H||by<-120)return;
  ctx.fillStyle='#14244e';ctx.fillRect(L,by,R-L,40);
  ctx.fillStyle='#22366e';ctx.fillRect(L,by,R-L,3);ctx.fillRect(L,by+37,R-L,3);
  for(let x=L+6;x<R-6;x+=12){ctx.fillStyle=hash(x,5)>.45?'rgba(255,207,122,.55)':'rgba(140,175,230,.14)';ctx.fillRect(x,by+9,8,9);ctx.fillRect(x,by+22,8,9)}
  ctx.fillStyle='rgba(2,5,15,.75)';rr(ctx,W/2-62,by+12,124,16,8);ctx.fill();
  ctx.fillStyle='#e8eefc';ctx.font="8px Audiowide, 'Instrument Sans', sans-serif";ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('FOUR SEASONS · BAHRAIN BAY',W/2,by+20.5);
  if(state==='custom'||state==='intro'||(state==='play'&&canY<CAN_START+30)){
    ctx.strokeStyle='#c9d2e3';ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(W/2,by+40);ctx.lineTo(W/2,by+52);
    const open=state==='play'?1:0;ctx.moveTo(W/2-5-open*4,by+55);ctx.lineTo(W/2,by+52);ctx.lineTo(W/2+5+open*4,by+55);ctx.stroke()}}

function drawObs(o){
  const y=o.y-cam;if(y>H+40||y<-220)return;
  if(o.t==='beam'){
    [[L,o.gx-L],[o.gx+o.gw,R-o.gx-o.gw]].forEach(([x,w])=>{if(w<=0)return;
      ctx.fillStyle='#1d2d58';ctx.fillRect(x,y,w,o.h);ctx.fillStyle='#86a8c6';ctx.fillRect(x,y,w,2);
      ctx.strokeStyle='rgba(255,255,255,.14)';ctx.lineWidth=1;ctx.beginPath();for(let xx=x;xx<x+w-7;xx+=14){ctx.moveTo(xx,y+o.h);ctx.lineTo(xx+7,y+2);ctx.lineTo(xx+14,y+o.h)}ctx.stroke()});
    for(let i=0;i<3;i++){ctx.fillStyle=i%2?'#ffffff':'#e1001a';ctx.fillRect(o.gx-6-i*6,y+3,6,o.h-3);ctx.fillRect(o.gx+o.gw+i*6,y+3,6,o.h-3)}}
  else if(o.t==='gondola'){
    ctx.strokeStyle='rgba(143,160,196,.7)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(o.x+10,y);ctx.lineTo(o.x+10,y-220);ctx.moveTo(o.x+o.w-10,y);ctx.lineTo(o.x+o.w-10,y-220);ctx.stroke();
    ctx.fillStyle='#2a3a6a';ctx.fillRect(o.x,y,o.w,4);ctx.fillStyle='#f0b35a';ctx.fillRect(o.x+2,y+4,o.w-4,o.h-4);
    ctx.fillStyle='rgba(0,0,0,.25)';for(let xx=o.x+8;xx<o.x+o.w-8;xx+=12)ctx.fillRect(xx,y+7,6,o.h-10);
    ctx.fillStyle='#e1001a';ctx.fillRect(o.x+2,y+o.h-3,o.w-4,3)}
  else if(o.t==='falcon'){const fy=y+Math.sin(t*3+o.ph)*8,f=Math.sin(t*14+o.ph),dir=o.vx>=0?1:-1;
    ctx.save();ctx.translate(o.x,fy);ctx.scale(dir,1);
    ctx.fillStyle='#5e3a22';ctx.beginPath();ctx.moveTo(0,-1);ctx.lineTo(-5,-8-9*f);ctx.lineTo(-15,-5-5*f);ctx.lineTo(-4,2);ctx.closePath();ctx.fill();
    ctx.fillStyle='#8a5a34';ctx.beginPath();ctx.ellipse(0,0,11,4,0,0,7);ctx.fill();
    ctx.beginPath();ctx.moveTo(-10,0);ctx.lineTo(-17,-3);ctx.lineTo(-17,3);ctx.closePath();ctx.fill();
    ctx.fillStyle='#e9d9b8';ctx.beginPath();ctx.arc(10,-1.5,3.4,0,7);ctx.fill();
    ctx.fillStyle='#f0b35a';ctx.beginPath();ctx.moveTo(13,-2);ctx.lineTo(16,-.5);ctx.lineTo(13,.5);ctx.fill();
    ctx.fillStyle='#4a2e1a';ctx.beginPath();ctx.moveTo(1,0);ctx.lineTo(-3,6+7*f);ctx.lineTo(-11,3+4*f);ctx.lineTo(-3,2);ctx.closePath();ctx.fill();
    ctx.restore()}
  else if(o.t==='drone'){ctx.save();ctx.translate(o.x,y);
    ctx.strokeStyle='#59658a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-14,-4);ctx.lineTo(14,4);ctx.moveTo(-14,4);ctx.lineTo(14,-4);ctx.stroke();
    ctx.fillStyle='#2a3352';rr(ctx,-8,-4,16,8,3);ctx.fill();
    ctx.fillStyle='rgba(200,214,240,.45)';[-14,14].forEach(sx=>{ctx.beginPath();ctx.ellipse(sx,-5,6+Math.sin(t*40)*1.5,1.6,0,0,7);ctx.fill()});
    ctx.fillStyle=(t%.8)<.4?'#ff2a45':'#3ddc84';ctx.beginPath();ctx.arc(0,0,1.8,0,7);ctx.fill();ctx.restore()}
  else if(o.t==='gust'){ctx.strokeStyle='rgba(232,200,138,.32)';ctx.lineWidth=1.2;ctx.beginPath();
    for(let i=0;i<14;i++){const span=R-L+80,xx=L-40+(((hash(i,31)*span+t*190*o.dir)%span)+span)%span,yy=y+hash(i,32)*o.h,len=18+hash(i,33)*26;
      ctx.moveTo(xx,yy);ctx.lineTo(xx-o.dir*len,yy)}ctx.stroke()}}

function render(){
  if(!cv.width)return;if(!sky)buildSky();
  ctx.setTransform(k,0,0,k,0,0);
  if(shake>.3&&!RM)ctx.translate(rand(-shake,shake),rand(-shake,shake));
  ctx.drawImage(sky,-30+(W/2-can.x)*.07,0,W+60,H);
  if(state==='play'&&vy>230){ctx.fillStyle='rgba(232,238,252,.07)';
    lines.forEach(s=>{const yy=((s.p-cam*1.3)%H+H)%H;ctx.fillRect(s.x,yy,1,s.l)})}
  facade(0,-1);facade(R,1);drawTopStructures();
  obs.forEach(o=>{if(o.t==='gust')drawObs(o)});obs.forEach(o=>{if(o.t!=='gust')drawObs(o)});
  picks.forEach(p=>{const y=p.y-cam+Math.sin(t*3+p.ph)*4;if(y<-20||y>H+20)return;
    ctx.save();ctx.translate(p.x,y);ctx.rotate(Math.PI/4);ctx.shadowColor='#3ddc84';ctx.shadowBlur=12;ctx.fillStyle='#3ddc84';ctx.fillRect(-6,-6,12,12);
    ctx.shadowBlur=0;ctx.fillStyle='#062a17';ctx.fillRect(-2.5,-2.5,5,5);ctx.restore()});
  const cy=canY-cam;
  drawCan(can.x,cy,state==='crash'?Math.max(0,chute-.6):chute,can.tilt+can.spin);
  parts.forEach(p=>{ctx.globalAlpha=Math.max(0,p.life);ctx.fillStyle=p.c;ctx.fillRect(p.x-1.5,p.y-cam-1.5,3,3)});ctx.globalAlpha=1;
  ctx.textAlign='center';ctx.textBaseline='middle';
  floats.forEach(f=>{ctx.globalAlpha=Math.max(0,f.life);ctx.fillStyle='#3ddc84';ctx.font="14px Audiowide, sans-serif";ctx.fillText(f.txt,f.x,f.y-cam)});ctx.globalAlpha=1;
  if(bannerTxt&&bannerT>0){ctx.globalAlpha=Math.min(1,bannerT*2);ctx.font="58px Audiowide, sans-serif";
    ctx.fillStyle='rgba(225,0,26,.55)';ctx.fillText(bannerTxt,W/2+3,H*.5+3);ctx.fillStyle='#fff';ctx.fillText(bannerTxt,W/2,H*.5);ctx.globalAlpha=1}}

/* ---------- HUD, panels and scores ---------- */
let shownScore=-1,shownBest=-1;
function hudUpdate(force){const best=Math.max(save.best,score);
  if(force||score!==shownScore){elScore.textContent=score;shownScore=score}
  if(force||best!==shownBest){elBest.textContent=best;shownBest=best}}
function setMode(){const full=small.matches&&state!=='custom'&&location.hash==='#play';
  stage.classList.toggle('live',state==='intro'||state==='play'||state==='pause'||state==='crash');
  stage.classList.toggle('full',full);document.documentElement.classList.toggle('glock',full)}
function show(p){[pCustom,pPause,pOver].forEach(x=>{x.hidden=x!==p});hud.hidden=!(state==='intro'||state==='play'||state==='pause'||state==='crash');setMode()}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function renderBoard(){const ol=q('#gboard');if(!ol)return;
  ol.innerHTML=save.board.length?save.board.map(e=>`<li${e.id===lastId?' class="me"':''}><span>${esc(e.n)}</span><b>${e.s}</b></li>`).join('')
    :'<li class="empty">No flights yet. Your first drop sets the record.</li>'}

function start(){reset();state='intro';introT=0;show(null);hudUpdate(true);
  if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();
  stage.focus({preventScroll:true});
  if(!stage.classList.contains('full')){const r=stage.getBoundingClientRect();if(r.top<0||r.bottom>innerHeight)stage.scrollIntoView({block:'center',behavior:RM?'auto':'smooth'})}}
function pause(){if(state!=='play'&&state!=='intro')return;pausedFrom=state;state='pause';keys.l=keys.r=false;show(pPause);q('#gresume').focus({preventScroll:true})}
function resume(){if(state!=='pause')return;state=pausedFrom;show(null);stage.focus({preventScroll:true})}
function crash(){state='crash';crashT=0;shake=RM?0:9;burst(can.x,canY,['#ff2a45','#ffd84a','#ffffff',BODY[save.body].c],28,220)}
function gameOver(){state='over';const isBest=score>save.best;if(isBest)save.best=score;
  if(score>0){lastId=Date.now();save.board.push({n:(save.name||'').trim()||'Pilot',s:score,id:lastId});save.board.sort((a,b)=>b.s-a.s);save.board=save.board.slice(0,5)}
  persist();renderBoard();
  q('#gfinal').textContent=score;q('#gnew').hidden=!isBest||score===0;
  q('#gbestline').textContent=isBest&&score>0?'That is your new best on this device.':'Your best: '+save.best;
  show(pOver);q('#gagain').focus({preventScroll:true})}
function toCustom(){reset();state='custom';show(pCustom)}

/* ---------- customisation ---------- */
const gname=q('#gname');gname.value=save.name;
gname.addEventListener('input',()=>{save.name=gname.value.slice(0,12);persist()});
function radios(el,list,key,label,style){
  el.innerHTML=list.map((o,i)=>`<button type="button" role="radio" aria-label="${esc(label(o))}" title="${esc(label(o))}" aria-checked="${save[key]===i}" data-i="${i}"${style?` style="background:${style(o)}"`:''}>${style?'':esc(label(o))}</button>`).join('');
  el.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;save[key]=+b.dataset.i;persist();
    el.querySelectorAll('button').forEach(x=>x.setAttribute('aria-checked',String(x===b)));render()})}
radios(q('#gbodycol'),BODY,'body',o=>o.n,o=>o.c);
radios(q('#gchutecol'),CHUTE,'chute',o=>o.n,o=>`conic-gradient(${o.a} 0 25%,${o.b} 0 50%,${o.a} 0 75%,${o.b} 0)`);
radios(q('#gdecal'),DECAL,'decal',o=>o,null);

q('#gstart').addEventListener('click',start);
q('#gagain').addEventListener('click',start);
q('#gcust').addEventListener('click',toCustom);
q('#gquit').addEventListener('click',toCustom);
q('#gresume').addEventListener('click',resume);
q('#gpause').addEventListener('click',()=>state==='pause'?resume():pause());

/* ---------- controls ---------- */
const playing=()=>state==='play'||state==='intro';
addEventListener('keydown',e=>{if(view.hidden||(e.target&&e.target.tagName==='INPUT'))return;const k=e.key;
  if(k==='ArrowLeft'||k==='a'||k==='A'){keys.l=true;if(playing())e.preventDefault()}
  else if(k==='ArrowRight'||k==='d'||k==='D'){keys.r=true;if(playing())e.preventDefault()}
  else if(k===' '||k==='p'||k==='P'||k==='Escape'){
    if(playing()){pause();e.preventDefault()}
    else if(state==='pause'&&k!=='Escape'){resume();e.preventDefault()}}});
addEventListener('keyup',e=>{const k=e.key;if(k==='ArrowLeft'||k==='a'||k==='A')keys.l=false;if(k==='ArrowRight'||k==='d'||k==='D')keys.r=false});
const toX=e=>{const r=cv.getBoundingClientRect();return (e.clientX-r.left)/r.width*W};
let touching=false;
// steer by touching or dragging anywhere on the game (on phones the game fills the screen)
const onUI=e=>e.target.closest&&e.target.closest('button,input,.gpanel');
stage.addEventListener('pointerdown',e=>{if(!playing()||onUI(e))return;touching=true;ptr=clamp(toX(e),0,W);try{stage.setPointerCapture(e.pointerId)}catch(err){}e.preventDefault()});
stage.addEventListener('pointermove',e=>{if(!playing())return;if(touching||e.pointerType==='mouse')ptr=clamp(toX(e),0,W)});
const lift=e=>{touching=false;if(e.pointerType!=='mouse')ptr=null};
stage.addEventListener('pointerup',lift);stage.addEventListener('pointercancel',lift);
stage.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse'&&!touching)ptr=null});
stage.addEventListener('contextmenu',e=>{if(playing())e.preventDefault()});
if(small.addEventListener)small.addEventListener('change',setMode);

/* ---------- loop: runs only while the game page is open ---------- */
let running=false,lastTs=0;
function frame(ts){if(!running)return;const dt=Math.min(.05,Math.max(0,(ts-lastTs)/1000));lastTs=ts;update(dt);render();requestAnimationFrame(frame)}
function startLoop(){if(running)return;running=true;lastTs=performance.now();requestAnimationFrame(frame)}
function stopLoop(){running=false}
function onRoute(){if(location.hash==='#play'){startLoop();resize()}else{pause();stopLoop()}setMode()}
addEventListener('hashchange',onRoute);
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause()});
renderBoard();hudUpdate(true);show(pCustom);onRoute();
})();
