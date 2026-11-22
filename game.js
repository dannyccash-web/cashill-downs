'use strict';
(() => {
const $=id=>document.getElementById(id), W=1920,H=1080, DISTANCE=1200,RAIL_TOP=605,GRANDSTAND_SPEED=.65, PIXELS_PER_METER=9;
const horses=[
 {name:'Midnight Run',coat:'Dark bay',style:'THE ALL-ROUNDER',desc:'Sure-footed on any track. A cool, steady contender.',favorite:'fast',color:'#b84d42',filter:'brightness(.82) saturate(.9)',boost:.1},
 {name:'Black Velvet',coat:'Black',style:'THE MUD LOVER',desc:'Likes a muddy track. Finds another gear in the rain.',favorite:'muddy',color:'#4c6e9b',filter:'grayscale(1) brightness(.47)',boost:.33},
 {name:'Copper Penny',coat:'Chestnut',style:'THE QUICK STARTER',desc:'Breaks fast from the gate. Loves firm, dry ground.',favorite:'fast',color:'#d89a38',filter:'sepia(.45) saturate(1.65) brightness(1.18)',boost:.32},
 {name:'Silver Lining',coat:'Dapple gray',style:'THE LATE CHARGER',desc:'Saves a little for the finish. Thrives on a soft track.',favorite:'soft',color:'#6c9290',filter:'grayscale(1) brightness(2.2) contrast(.7)',boost:.31},
 {name:'Golden Hour',coat:'Golden bay',style:'THE WILD CARD',desc:'An unpredictable streak. Brilliant when it all clicks.',favorite:'fast',color:'#8b6894',filter:'sepia(.6) saturate(1.4) brightness(1.32)',boost:.16}
];
const conditions=[{key:'fast',label:'Fast & dry',icon:'☀'},{key:'muddy',label:'Muddy track',icon:'☂'},{key:'soft',label:'Soft going',icon:'☁'}];
let current='start',selected=0,round=1,condition=conditions[0],race=null,raf=0,lastTimestamp=0,paused=false,soundOn=false,audio=null,finishTimer=0,rankKey='';
const canvas=$('race-canvas'),ctx=canvas.getContext('2d',{alpha:false}),track=new Image(),atlas=new Image();
track.src='assets/track.jpg';atlas.src='assets/gallop.png';
let frames=[],trackLoop=null;const ready=Promise.all([track.decode(),atlas.decode()]).then(()=>{prepareFrames();buildTrackLoop();}).catch(()=>toast('Artwork is still loading. Please refresh if it does not appear.'));
// Race-day audio: the call to post plays before the start, then a looping gallop while the horses run.
const SOUND_FILES={bugle:'assets/call_to_post.m4a',gallop:'assets/horses_galloping.mp3'},BUGLE_IN=.45,BUGLE_OUT=.3;
const soundData=Object.fromEntries(Object.entries(SOUND_FILES).map(([k,url])=>[k,fetch(url).then(r=>r.ok?r.arrayBuffer():null).catch(()=>null)]));
let sounds={},soundsDecoding=false,master=null,bugleSrc=null,gallopSrc=null,gallopGain=null;
function decodeSounds(){if(soundsDecoding||!audio)return;soundsDecoding=true;master=audio.createGain();master.gain.value=soundOn?1:0;master.connect(audio.destination);Object.keys(SOUND_FILES).forEach(k=>soundData[k].then(data=>data&&audio.decodeAudioData(data)).then(buf=>{if(buf)sounds[k]=k==='gallop'?seamlessLoop(buf,.35):buf;}).catch(()=>{}));}
// Crossfades the end of the gallop into its start so the loop point is inaudible.
function seamlessLoop(buf,fade){const f=Math.min(Math.floor(fade*buf.sampleRate),Math.floor(buf.length/4)),n=buf.length-f,out=audio.createBuffer(buf.numberOfChannels,n,buf.sampleRate);for(let c=0;c<buf.numberOfChannels;c++){const src=buf.getChannelData(c),dst=out.getChannelData(c);dst.set(src.subarray(0,n));for(let i=0;i<f;i++){const x=i/f*Math.PI/2;dst[i]=src[i]*Math.sin(x)+src[n+i]*Math.cos(x);}}return out;}
// Returns how long the pre-race wait should last, or 0 when the call to post is not playing.
function startBugle(){stopBugle();if(!soundOn||!audio||!master||!sounds.bugle)return 0;const s=audio.createBufferSource();s.buffer=sounds.bugle;s.connect(master);s.start(audio.currentTime,BUGLE_IN);bugleSrc=s;return sounds.bugle.duration-BUGLE_IN-BUGLE_OUT;}
function stopBugle(){if(bugleSrc){try{bugleSrc.stop();}catch{}bugleSrc=null;}}
function startGallop(){stopGallop(0);if(!audio||!master||!sounds.gallop)return;const t=audio.currentTime;gallopGain=audio.createGain();gallopGain.gain.setValueAtTime(0,t);gallopGain.gain.linearRampToValueAtTime(.9,t+.25);gallopGain.connect(master);gallopSrc=audio.createBufferSource();gallopSrc.buffer=sounds.gallop;gallopSrc.loop=true;gallopSrc.connect(gallopGain);gallopSrc.start(t);}
function stopGallop(fade=.6){if(!gallopSrc)return;const t=audio.currentTime,g=gallopGain.gain;g.cancelScheduledValues(t);g.setValueAtTime(g.value,t);g.linearRampToValueAtTime(0,t+fade);gallopSrc.stop(t+fade+.05);gallopSrc=gallopGain=null;}
function countdownText(){return race.elapsed<-3?'':Math.ceil(-race.elapsed);}
function fit(){let scale=Math.min(innerWidth/W,innerHeight/H);$('game').style.transform=`scale(${scale})`;}
addEventListener('resize',fit);fit();
function show(screen){document.querySelectorAll('.screen').forEach(el=>{const active=el.id===`${screen}-screen`;el.classList.toggle('active',active);el.hidden=!active;});current=screen;$('race-label').textContent=screen==='start'?'CASHILL DOWNS · KENTUCKY':`CASHILL DOWNS · RACE ${String(round).padStart(2,'0')}`;}
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');setTimeout(()=>$('toast').classList.remove('visible'),3500);}
function selectHorse(i,focus=false){selected=i;document.querySelectorAll('.horse-row').forEach((el,j)=>{el.classList.toggle('selected',j===i);el.setAttribute('aria-checked',j===i?'true':'false');el.tabIndex=j===i?0:-1;el.querySelector('.radio').textContent=j===i?'✓':'';if(focus&&j===i)el.focus();});$('your-champion').textContent=horses[i].name;}
function drawSelection(){document.querySelectorAll('.round-number').forEach(el=>el.textContent=String(round).padStart(2,'0'));$('condition-title').textContent=condition.label;document.querySelector('.weather-icon').textContent=condition.icon;$('horse-list').innerHTML=horses.map((h,i)=>`<button class="horse-row" role="radio" aria-checked="false" data-horse="${i}" aria-label="${i+1}, ${h.name}. ${h.desc}"><span class="horse-number">${i+1}</span><span class="portrait" style="background-position:${i*25}% center" aria-hidden="true"></span><span class="horse-info"><strong>${h.name}</strong><small>${h.coat} · Thoroughbred</small></span><span class="profile"><span class="trait">${h.style}</span>${h.desc}</span><span class="radio" aria-hidden="true"></span></button>`).join('');document.querySelectorAll('.horse-row').forEach((el,i)=>{el.onclick=()=>selectHorse(i);el.onkeydown=e=>{let j=i;if(e.key==='ArrowDown'||e.key==='ArrowRight')j=(i+1)%5;else if(e.key==='ArrowUp'||e.key==='ArrowLeft')j=(i+4)%5;else if(e.key==='Home')j=0;else if(e.key==='End')j=4;else return;e.preventDefault();selectHorse(j,true);};});selectHorse(selected);show('select');}
$('get-started').onclick=()=>{initAudio();drawSelection();};
$('home').onclick=()=>{if(current==='race')return toast('The race is underway. Finish this race to return to the paddock.');show('start');};
$('next-race').onclick=()=>{clearTimeout(finishTimer);round++;condition=conditions[Math.floor(Math.random()*conditions.length)];drawSelection();};
$('sound').onclick=()=>{soundOn=!soundOn;initAudio();if(master)master.gain.setTargetAtTime(soundOn?1:0,audio.currentTime,.03);$('sound-state').textContent=soundOn?'ON':'OFF';$('sound').setAttribute('aria-label',soundOn?'Turn sound off':'Turn sound on');if(soundOn)tone(440,.15,.03);};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('Use your browser’s fullscreen control to expand the game.');}};
function initAudio(){try{audio??=new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended'&&!(current==='race'&&paused))audio.resume();decodeSounds();}catch{}}
function tone(frequency,duration,volume=.03,type='sine'){if(!soundOn||!audio)return;const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.value=frequency;g.gain.setValueAtTime(volume,audio.currentTime);g.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+duration);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+duration);}
function prepareFrames(){
 const cw=atlas.width/4,ch=atlas.height/2;
 const source=document.createElement('canvas');source.width=atlas.width;source.height=atlas.height;const s=source.getContext('2d',{willReadFrequently:true});s.drawImage(atlas,0,0);
 for(let frame=0;frame<8;frame++){
  const sx=Math.floor((frame%4)*cw),sy=Math.floor(Math.floor(frame/4)*ch),ww=Math.floor(cw),hh=Math.floor(ch),p=s.getImageData(sx,sy,ww,hh).data;
  let minX=ww,minY=hh,maxX=0,maxY=0;
  for(let y=0;y<hh;y++)for(let x=0;x<ww;x++){if(p[(y*ww+x)*4+3]>70){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}}
  if(maxX<=minX){minX=0;minY=0;maxX=ww-1;maxY=hh-1;}
  frames.push({sx:sx+minX,sy:sy+minY,sw:maxX-minX+1,sh:maxY-minY+1});
 }
 // Each coat and animation frame is cached once, keeping the race light enough for laptops.
 frames=horses.map(h=>frames.map(f=>{const c=document.createElement('canvas');c.width=520;c.height=320;const g=c.getContext('2d');g.filter=h.filter;const height=490*f.sh/f.sw;g.drawImage(atlas,f.sx,f.sy,f.sw,f.sh,15,25,490,height);return c;}));
}
function random(a,b){return a+Math.random()*(b-a);}
function positionAt(r,t){const v=r.speed*t;return v+r.start*18*(1-Math.exp(-t/3))+r.late*1.4*Math.max(0,t-11)**1.8+r.surge*(Math.sin(t*.66+r.phase)-Math.sin(r.phase));}
function crossingTime(r){let lo=0,hi=45;for(let i=0;i<45;i++){let mid=(lo+hi)/2;if(positionAt(r,mid)<DISTANCE)lo=mid;else hi=mid;}return (lo+hi)/2;}
function makeRace(){let runners=horses.map((h,i)=>({i,speed:random(47,50)+(h.favorite===condition.key?h.boost*4:0),start:i===2?random(1.2,1.8):random(-.3,.7),late:i===3?random(1.2,1.7):random(.25,.9),surge:i===4?random(3,8):random(1,4),phase:random(0,Math.PI*2)}));runners.forEach(r=>r.finish=crossingTime(r));const order=[...runners].sort((a,b)=>a.finish-b.finish);return{runners,order,winner:order[0],finish:order[0].finish,elapsed:-3,ended:false,captured:false,camera:0};}
$('start-race').onclick=async()=>{const b=$('start-race');b.disabled=true;b.textContent='Preparing the track…';await ready;b.disabled=false;b.textContent='Start the Race';if(!frames.length||!track.complete||!trackLoop)return toast('Race artwork could not load. Please refresh and try again.');cancelAnimationFrame(raf);clearTimeout(finishTimer);race=makeRace();paused=false;rankKey='';lastTimestamp=0;initAudio();stopGallop(0);const call=startBugle();race.bugle=call>0;if(race.bugle)race.elapsed=-call;$('pause').textContent='Pause';$('pause').setAttribute('aria-label','Pause race');$('watching-name').textContent=horses[selected].name;$('race-condition').textContent=`1,200 M · ${condition.label.toUpperCase()}`;$('race-screen').querySelector('h2').textContent=race.bugle?'The call to post.':'Ready at the rail.';$('countdown').textContent=countdownText();$('distance-label').textContent='TO THE FINISH';show('race');raf=requestAnimationFrame(tick);};
function togglePause(){if(current!=='race'||!race||race.ended)return;paused=!paused;$('pause').textContent=paused?'Resume':'Pause';$('pause').setAttribute('aria-label',paused?'Resume race':'Pause race');$('countdown').textContent=paused?'Paused':race.elapsed<0?countdownText():'';if(audio){if(paused)audio.suspend();else audio.resume();}}
$('pause').onclick=togglePause;addEventListener('keydown',e=>{if(e.code==='Space'&&current==='race'&&e.target.tagName!=='BUTTON'){e.preventDefault();togglePause();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&current==='race'&&race&&!race.ended&&!paused)togglePause();});
function tick(timestamp){if(current!=='race')return;const dt=lastTimestamp?Math.min((timestamp-lastTimestamp)/1000,.06):0;lastTimestamp=timestamp;if(!paused){const prior=race.elapsed;race.elapsed+=dt;if(!race.bugle&&prior<0&&Math.ceil(-prior)!==Math.ceil(-race.elapsed))tone(race.elapsed>=0?660:440,.18,.04);if(prior<0&&race.elapsed>=0)startGallop();if(race.elapsed>=0)$('countdown').textContent=race.elapsed<.65?'GO':'';else{$('countdown').textContent=countdownText();if(race.bugle&&prior<-3&&race.elapsed>=-3)$('race-screen').querySelector('h2').textContent='Ready at the rail.';}if(!race.captured&&race.elapsed>=race.finish){race.elapsed=race.finish;renderRace(race.elapsed,true);captureFinish();race.captured=true;race.ended=true;stopGallop(.8);$('pause').disabled=true;$('countdown').textContent='';$('race-screen').querySelector('h2').textContent=`${horses[race.winner.i].name} takes it!`;tone(523,.2);setTimeout(()=>tone(659,.2),180);setTimeout(()=>tone(784,.4),360);finishTimer=setTimeout(showResults,1800);}else if(!race.ended)renderRace(Math.max(0,race.elapsed));}updateHud();if(!race.ended)raf=requestAnimationFrame(tick);}
function updateHud(){const t=Math.max(0,race.elapsed),order=[...race.runners].sort((a,b)=>positionAt(b,t)-positionAt(a,t)),remaining=Math.max(0,Math.ceil(DISTANCE-positionAt(order[0],t)));$('meters').innerHTML=`${remaining.toLocaleString()} <span>m</span>`;$('progress-fill').style.width=`${Math.min(100,(DISTANCE-remaining)/12)}%`;if(race.elapsed>0&&!race.ended)$('race-screen').querySelector('h2').textContent=remaining<220?'The final stretch.':remaining<650?'The chase is on.':'And they’re off.';const rank=order.findIndex(r=>r.i===selected)+1;$('watching-place').textContent=race.elapsed<0?'Ready at the rail':`${ordinal(rank)} place${rank===1?' · Out in front':''}`;const key=order.map(r=>r.i).join();if(key!==rankKey){rankKey=key;$('standings').innerHTML=order.map((r,i)=>`<div class="standing ${r.i===selected?'chosen':''}"><span class="place">${i+1}</span><span class="cloth" style="background:${horses[r.i].color}">${r.i+1}</span><strong>${horses[r.i].name}</strong></div>`).join('');}}
function ordinal(n){return n+(['th','st','nd','rd'][n%10]||'th');}
function renderRace(t,isFinish=false){
 const lead=Math.max(...race.runners.map(r=>positionAt(r,t)));const camera=Math.max(0,lead*PIXELS_PER_METER-800);race.camera=camera;
 ctx.fillStyle='#6395ae';ctx.fillRect(0,0,W,H);
 // The rail and track scroll with the camera; the grandstand above the rail drifts slower for depth.
 drawScenery(camera,RAIL_TOP,H);drawScenery(camera*GRANDSTAND_SPEED,0,RAIL_TOP);
 const shade=ctx.createLinearGradient(0,0,0,450);shade.addColorStop(0,'#0c241cce');shade.addColorStop(1,'#0c241c00');ctx.fillStyle=shade;ctx.fillRect(0,0,W,500);
 if(condition.key==='muddy'){ctx.fillStyle='#4e443122';ctx.fillRect(0,730,W,350);ctx.save();ctx.strokeStyle='#d3e4e33b';ctx.lineWidth=1.5;for(let i=0;i<90;i++){let x=(i*131+t*350)%W,y=(i*83+t*550)%H;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-8,y+23);ctx.stroke();}ctx.restore();}
 // Track markings scroll faster than the distant scenery.
 ctx.save();ctx.globalAlpha=.2;ctx.fillStyle='#6b3e23';for(let i=0;i<65;i++){let x=((i*149-camera*1.4)%W+W)%W,y=742+(i*57)%270;ctx.fillRect(x,y,20+i%15,1);}ctx.restore();
 const lineX=550+DISTANCE*PIXELS_PER_METER-camera;
 if(lineX>-100&&lineX<W+100){ctx.save();ctx.fillStyle='#f6f0dfb8';ctx.beginPath();ctx.moveTo(lineX,722);ctx.lineTo(lineX+13,722);ctx.lineTo(lineX+13,970);ctx.lineTo(lineX,970);ctx.fill();ctx.strokeStyle='#ffffff99';ctx.setLineDash([8,8]);ctx.beginPath();ctx.moveTo(lineX,560);ctx.lineTo(lineX,970);ctx.stroke();ctx.restore();drawFinishPost(lineX,715,false);}
 race.runners.forEach(r=>{let p=positionAt(r,t),x=550+p*PIXELS_PER_METER-camera,foot=748+r.i*47;drawRunner(r,x,foot,t,isFinish);});
 if(lineX>-100&&lineX<W+100)drawFinishPost(lineX,963,true);
}
// The track art is tiled with a mirrored copy so the endless scroll has no visible seam.
function buildTrackLoop(){trackLoop=document.createElement('canvas');trackLoop.width=W*2;trackLoop.height=H;const g=trackLoop.getContext('2d');g.drawImage(track,0,0,W,H);g.translate(W*2,0);g.scale(-1,1);g.drawImage(track,0,0,W,H);}
function drawScenery(offset,y0,y1){const tile=W*2,x=-(((offset%tile)+tile)%tile),h=y1-y0;ctx.drawImage(trackLoop,0,y0,tile,h,x,y0,tile,h);ctx.drawImage(trackLoop,0,y0,tile,h,x+tile,y0,tile,h);}
function drawFinishPost(x,y,front){ctx.save();ctx.fillStyle='#f3efdf';ctx.fillRect(x-8,y-(front?270:200),16,front?270:200);ctx.fillStyle='#133e2b';ctx.fillRect(x-8,y-(front?270:200),16,22);if(!front){ctx.fillStyle='#103625';ctx.fillRect(x-59,y-245,118,45);ctx.strokeStyle='#dfbd7d';ctx.strokeRect(x-59,y-245,118,45);ctx.fillStyle='#f4ecd7';ctx.font='600 16px sans-serif';ctx.textAlign='center';ctx.fillText('FINISH',x,y-217);}ctx.restore();}
function drawRunner(r,nose,foot,t,isFinish){const i=r.i;const width=470+i*7,height=width*320/520;let frame=t===0?3:Math.floor(t*15+r.phase*2)%8;const source=frames[i]?.[frame];if(!source)return;const drawX=nose-width+14,drawY=foot-height+35;
 ctx.save();ctx.fillStyle='#28170b38';ctx.beginPath();ctx.ellipse(nose-width*.46,foot-5,width*.36,10,0,0,Math.PI*2);ctx.fill();
 if(t>0){ctx.fillStyle=condition.key==='muddy'?'#62492f3b':'#d3b48938';for(let d=0;d<7;d++){const phase=(t*4+d*.173+r.phase)%1;ctx.beginPath();ctx.ellipse(nose-width*.75-phase*95,foot-10-phase*28,8+phase*15,3+phase*5,0,0,Math.PI*2);ctx.fill();}}
 ctx.drawImage(source,drawX,drawY,width,height);
 const clothX=drawX+width*.515,clothY=drawY+height*.39+Math.sin(t*18+r.phase)*2;
 ctx.fillStyle=horses[i].color;ctx.beginPath();ctx.roundRect(clothX-30,clothY,65,53,4);ctx.fill();ctx.strokeStyle='#f4e2bb88';ctx.lineWidth=1;ctx.stroke();ctx.fillStyle='#fff9e8';ctx.font='bold 34px Georgia';ctx.textAlign='center';ctx.fillText(String(i+1),clothX+3,clothY+39);
 if(i===selected){ctx.fillStyle='#e4c182';ctx.beginPath();ctx.moveTo(clothX-7,clothY-15);ctx.lineTo(clothX+13,clothY-15);ctx.lineTo(clothX+3,clothY-5);ctx.fill();}
 ctx.restore();
}
function captureFinish(){const photo=document.createElement('canvas');photo.width=1920;photo.height=650;photo.getContext('2d').drawImage(canvas,0,325,1920,650,0,0,1920,650);$('finish-photo').src=photo.toDataURL('image/jpeg',.94);$('finish-photo').alt=`${horses[race.winner.i].name}, number ${race.winner.i+1}, first across the finish line ahead of the other four horses`;}
function formatTime(t){let minutes=Math.floor(t/60),seconds=(t%60).toFixed(2).padStart(5,'0');return`${minutes}:${seconds}`;}
function showResults(){const winner=horses[race.winner.i],myPlace=race.order.findIndex(r=>r.i===selected)+1,runnerUp=race.order[1],margin=(runnerUp.finish-race.finish).toFixed(2);$('winner-title').textContent=`${winner.name} wins.`;$('winner-subtitle').textContent=`A ${margin}s victory at Cashill Downs. A finish worth watching.`;$('winning-time').textContent=`1,200 M · ${formatTime(race.finish)}`;$('result-order').innerHTML=race.order.map((r,j)=>`<div class="result"><span class="place">${ordinal(j+1)}</span><span class="cloth" style="background:${horses[r.i].color}">${r.i+1}</span><div><strong>${horses[r.i].name}</strong><small>${j===0?formatTime(r.finish):'+'+(r.finish-race.finish).toFixed(2)+'s'}${r.i===selected?' · YOUR PICK':''}</small></div></div>`).join('');$('pick-result').innerHTML=myPlace===1?`<b>You picked the winner.</b> ${winner.name} brought it home.`:`Your pick, <b>${horses[selected].name}</b>, finished ${ordinal(myPlace)}. There’s always the next race.`;$('pause').disabled=false;show('win');}
})();
