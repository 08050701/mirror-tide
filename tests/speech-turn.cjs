const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8');
const code=html.slice(html.indexOf('    function markSpeechActivity(){'),html.indexOf('    function readAudio(ms){'));
const event=html.slice(html.indexOf('      recognition.onresult=e=>{'),html.indexOf('      recognition.onspeechstart='));
let now=0,id=0,timers=new Map(),sent=[];
const ctx=vm.createContext({performance:{now:()=>now},setTimeout:(fn,delay)=>{timers.set(++id,{fn,at:now+delay});return id;},clearTimeout:i=>timers.delete(i),askMirror:s=>sent.push(s),showSubtitle:()=>{},recognition:{},waterVoice:{speaking:false}});
vm.runInContext("let sessionClosed=false,responseInFlight=false,speechTurnStartedAt=0;let pendingFinalText='',pendingInterimText='',lastSpeechActivityAt=0,finalSpeechTimer=0,awake=true;const TURN_PAUSE_MS=2800,exhibitionMode=true;"+code+event,ctx);
function advance(ms){now+=ms;for(const [i,t] of [...timers])if(t.at<=now){timers.delete(i);t.fn();}}
function result(text,final){ctx.recognition.onresult({resultIndex:0,results:[Object.assign([{transcript:text}],{isFinal:final})]});}
result('我想說',true);advance(1000);result('還沒講完',false);advance(5000);assert.equal(sent.length,0,'interim must block submission');
result('還沒講完',true);advance(2000);assert.equal(sent.length,0,'short thinking pause must not submit');result('還有下一段',true);advance(2799);assert.equal(sent.length,0);advance(1);assert.deepEqual(sent,['我想說 還沒講完 還有下一段']);advance(5000);assert.equal(sent.length,1,'send only once');
const js=html.slice(html.indexOf('<script>')+8,html.indexOf('</script>',html.indexOf('<script>')));new vm.Script(js);console.log('PASS: interim blocks, pauses extend, segments combine, single submission, JS parses');
