const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
let now=1000,next=0,timers=new Map(),spoken=[],suspended=0,resumed=0;
function element(){return {dataset:{},style:{setProperty(){}},classList:{add(){},remove(){}},append(){},setAttribute(){},addEventListener(){},checked:false,textContent:''};}
const document={createElement:element,createTextNode:t=>t,body:element()};
const context=vm.createContext({window:{},document,performance:{now:()=>now},Math,setTimeout:(fn,ms)=>{timers.set(++next,{fn,at:now+ms});return next;},clearTimeout:id=>timers.delete(id),SpeechSynthesisUtterance:class {constructor(text){this.text=text;}},speechSynthesis:{cancel(){},getVoices:()=>[{lang:'zh-TW'}],speak:u=>{spoken.push(u);u.onstart();}}});
context.window.speechSynthesis=context.speechSynthesis;
vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../water-voice.js'),'utf8'),context);
const water=new context.window.WaterVoice({subtitle:element(),controls:element(),suspendListening:()=>suspended++,resumeListening:()=>resumed++});
function advance(ms){const end=now+ms;while(true){const job=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!job)break;timers.delete(job[0]);now=job[1].at;job[1].fn();}now=end;}
assert.equal(water.enabled,false);assert.equal(water.consent.checked,false);
const text='先停一下。讓水慢慢流。';assert.equal(water.segments(text).join(''),text);
const long='很長的一句話'.repeat(20);assert.equal(water.segments(long).join(''),long);assert.ok(water.segments(long).every(s=>s.length<=36));
water.beginTurn('普通對話',3000);const p=water.pressure;now+=1000;water.beginTurn('繼續追問',3000);assert.ok(water.pressure>p);water.beginTurn('不要再問',3000);assert.ok(water.pressure<.2);
water.reply({reply:text,intent:'calm'});assert.equal(spoken.length,0,'off must never speak');
water.enabled=true;water.reply({reply:text,intent:'calm'});assert.equal(suspended,1);assert.equal(water.speaking,true);spoken[0].onend();advance(650);assert.equal(spoken.length,2);spoken[1].onend();advance(650);assert.equal(water.speaking,true,'hold through playback tail');advance(1400);assert.equal(water.speaking,false);assert.equal(resumed,1);
water.reply({reply:text,intent:'calm'});const old=spoken.at(-1);water.cancelSpeech();old.onend();advance(3000);assert.equal(water.speaking,false);assert.equal(resumed,2);
const samples=Uint8Array.from({length:1024},(_,i)=>128+Math.sin(2*Math.PI*220*i/48000)*50);water.observe(samples,48000,10000);assert.equal(water.pitchSamples,0,'no consent no prosody analysis');water.consent.checked=true;water.observe(samples,48000,11000);assert.ok(water.pitchSamples>0);
console.log('PASS: silent default, opt-in analysis, bounded phrase splitting, pressure release, playback lock, delayed resume, cancellation');

water.reply({reply:text,intent:'calm',turn:5,closing:'不要再問我了。'});
assert.equal(water.pressure,1);
spoken.at(-1).onend();advance(300);
const regular=spoken.at(-1);
regular.onend();advance(1049);
assert.equal(spoken.at(-1),regular);
advance(1);
assert.equal(spoken.at(-1).text,'不要再問我了。');
assert.ok(spoken.at(-1).rate>regular.rate);
spoken.at(-1).onend();advance(1700);
assert.equal(water.speaking,false);
water.resetVisitor();assert.equal(water.pressure,0);assert.equal(water.consent.checked,false);
console.log('PASS: fifth-turn closing line, escalating delivery, and visitor reset');
