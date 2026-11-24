/* Locally generated sound and temporary prosody. No voice recording or cloning. */
class WaterVoice {
  constructor({subtitle, controls, suspendListening, resumeListening}) {
    Object.assign(this,{subtitle,controls,suspendListening,resumeListening});
    this.enabled=false; this.speaking=false; this.pressure=0; this.pitchHz=180;
    this.pitchSamples=0; this.lastPitchAt=0; this.lastTurnAt=0; this.rate=.9;
    this.timers=[]; this.generation=0; this.captionMode=false; this.motif=0;
    this.button=document.createElement('button');
    this.button.textContent='啟用水聲與朗讀';
    this.button.addEventListener('click',()=>this.toggle());
    this.captionButton=document.createElement('button');
    this.captionButton.textContent='完整字幕：關';
    this.captionButton.setAttribute('aria-pressed','false');
    this.captionButton.addEventListener('click',()=>{
      this.captionMode=!this.captionMode;
      this.captionButton.textContent='完整字幕：'+(this.captionMode?'開':'關');
      this.captionButton.setAttribute('aria-pressed',String(this.captionMode));
      if(this.currentReply)this.present(this.currentReply);
    });
    this.note=document.createElement('p');
    this.note.className='sound-note';
    this.note.textContent='聲音需啟用一次。朗讀使用裝置聲線；勾選後才參考你的語速與音高，不複製音色。';
    const label=document.createElement('label'); label.className='voice-consent';
    this.consent=document.createElement('input');this.consent.type='checkbox';
    this.consent.addEventListener('change',()=>{this.pitchHz=180;this.pitchSamples=0;this.rate=.9;});
    label.append(this.consent,document.createTextNode('讓水呼應我的語速與音高（本次體驗）'));
    controls.append(this.button,this.captionButton,label,this.note);
  }
  async toggle() {
    if(this.enabled){
      this.enabled=false;this.cancelSpeech();
      this.master?.gain.setTargetAtTime(0,this.ctx.currentTime,.3);
      this.button.textContent='啟用水聲與朗讀';
      this.button.setAttribute('aria-pressed','false');return;
    }
    try {
      if(!this.ctx)this.build();
      await this.ctx.resume();
      this.enabled=true;this.button.textContent='關閉水聲與朗讀';
      this.button.setAttribute('aria-pressed','true');
      this.note.textContent='水聲已啟用 · 裝置合成聲線，非本人音色；朗讀時暫停辨識，尾音結束後再聽。';
      this.nextNote=this.ctx.currentTime+.5;
    } catch(e){this.note.textContent='聲音未能啟用：'+e.message;}
  }
  build() {
    this.ctx=new (window.AudioContext||window.webkitAudioContext)();
    const c=this.ctx;
    this.master=c.createGain();this.master.gain.value=0;
    const compressor=c.createDynamicsCompressor();
    compressor.threshold.value=-22;compressor.ratio.value=5;
    this.master.connect(compressor).connect(c.destination);
    this.pad=c.createGain();this.pad.gain.value=.11;this.pad.connect(this.master);
    this.voices=[55,110,164.81,220].map((f,i)=>{
      const osc=c.createOscillator(), gain=c.createGain(), pan=c.createStereoPanner();
      osc.type=i<2?'sine':'triangle';osc.frequency.value=f;
      gain.gain.value=i<2?.17:.035;pan.pan.value=(i-1.5)*.42;
      const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=650;
      osc.connect(filter).connect(gain).connect(pan).connect(this.pad);osc.start();
      return {osc,gain,pan,base:f};
    });
    // Filtered noise is the water bed, generated once locally.
    const buffer=c.createBuffer(1,c.sampleRate*3,c.sampleRate), data=buffer.getChannelData(0);
    let previous=0;for(let i=0;i<data.length;i++){previous=(previous+Math.random()*.04-.02)*.98;data[i]=previous;}
    const source=c.createBufferSource();source.buffer=buffer;source.loop=true;
    const filter=c.createBiquadFilter();filter.type='bandpass';filter.frequency.value=600;filter.Q.value=.45;
    this.waterGain=c.createGain();this.waterGain.gain.value=.1;
    source.connect(filter).connect(this.waterGain).connect(this.master);source.start();
    this.waterFilter=filter;
    this.delay=c.createDelay(2);this.delay.delayTime.value=.43;
    const feedback=c.createGain();feedback.gain.value=.25;
    this.delay.connect(feedback).connect(this.delay);this.delay.connect(this.master);
  }
  noteAt(frequency, intensity=.1) {
    if(!this.ctx||!this.enabled)return;
    const c=this.ctx,t=c.currentTime, osc=c.createOscillator(), gain=c.createGain(), pan=c.createStereoPanner();
    osc.type='sine';osc.frequency.setValueAtTime(frequency,t);
    osc.frequency.exponentialRampToValueAtTime(frequency*.995,t+2.8);
    gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(intensity,t+.035);
    gain.gain.exponentialRampToValueAtTime(.0001,t+3.8);
    pan.pan.value=Math.sin(this.motif*1.7)*.7;
    osc.connect(gain).connect(pan);pan.connect(this.master);pan.connect(this.delay);
    osc.start(t);osc.stop(t+4);
    osc.onended=()=>{osc.disconnect();gain.disconnect();pan.disconnect();};
  }
  update(dt,{voice=0,wind=0,rain=0,response=0}) {
    this.pressure=Math.max(0,this.pressure-dt*.006);
    document.body.style.setProperty('--water-pressure',this.pressure.toFixed(3));
    if(!this.ctx||!this.enabled)return;
    const t=this.ctx.currentTime;
    // Density and harmonic beating carry pressure, not increasing loudness.
    const duck=this.speaking?.18:voice>.13?.24:1;
    this.master.gain.setTargetAtTime(.34*duck,t,.55);
    this.waterGain.gain.setTargetAtTime(.09+rain*.12,t,1.8);
    this.waterFilter.frequency.setTargetAtTime(380+wind*700,t,2);
    this.voices.forEach((v,i)=>{
      v.osc.detune.setTargetAtTime(Math.sin(t*.13+i)*3+this.pressure*(i%2?15:-15),t,1.7);
      v.pan.pan.setTargetAtTime(Math.sin(t*.065+i)*.65,t,1);
    });
    if(t>=this.nextNote){
      const scale=[220,293.66,329.63,440,493.88,587.33];
      this.noteAt(scale[this.motif++%scale.length]*(response>.2?1.5:1),.035);
      this.nextNote=t+4.8-this.pressure*2.7+Math.random()*1.8;
    }
  }
  observe(samples,sampleRate,ms) {
    if(!this.consent.checked||this.speaking||ms-this.lastPitchAt<150)return;
    this.lastPitchAt=ms;
    let energy=0;for(const v of samples)energy+=((v-128)/128)**2;
    if(Math.sqrt(energy/samples.length)<.018)return;
    let best=.65,bestLag=0;
    const maxLag=Math.min(Math.floor(sampleRate/80),Math.floor(samples.length/2));
    for(let lag=Math.floor(sampleRate/350);lag<=maxLag;lag++){
      let cross=0,a=0,b=0;
      for(let i=0;i<samples.length-maxLag;i+=2){
        const x=samples[i]-128,y=samples[i+lag]-128;cross+=x*y;a+=x*x;b+=y*y;
      }
      const score=cross/Math.sqrt(a*b||1);
      if(score>best){best=score;bestLag=lag;}
    }
    if(bestLag){this.pitchHz=this.pitchHz*.85+(sampleRate/bestLag)*.15;this.pitchSamples++;}
  }
  beginTurn(text,duration) {
    const now=performance.now();
    this.pressure=Math.min(1,this.pressure+(this.lastTurnAt&&now-this.lastTurnAt<18000?.16:.055));
    this.lastTurnAt=now;
    if(/不要.*問|別.*問|先停|太急|慢一點/.test(text))this.pressure*=.35;
    if(this.consent.checked&&duration>800)this.rate=Math.max(.72,Math.min(1.08,text.length/(duration/1000)/4));
  }
  settle(intent) {
    if(intent==='calm'||intent==='comfort')this.pressure*=.76;
    if(intent==='joy')this.motif=(this.motif+2)%6;
  }
  segments(text) {
    const sentences=text.match(/[^。！？!?；;]+[。！？!?；;]?/g)||[text];
    const result=[];
    for(const sentence of sentences){
      if(sentence.length<=36){result.push(sentence.trim());continue;}
      const clauses=sentence.match(/[^，,、]+[，,、]?/g)||[sentence];
      for(const clause of clauses)for(let i=0;i<clause.length;i+=36)result.push(clause.slice(i,i+36).trim());
    }
    return result.filter(Boolean);
  }
  clearCaptions(){this.timers.forEach(clearTimeout);this.timers=[];}
  floatText(text) {
    this.subtitle.classList.remove('show');
    this.timers.push(setTimeout(()=>{
      this.subtitle.textContent=text;this.subtitle.dataset.reflection=text;
      this.subtitle.dataset.state='reply';this.subtitle.classList.add('show');
    },750));
  }
  present(text) {
    this.currentReply=text;this.clearCaptions();clearTimeout(this.subtitle._timer);
    if(this.captionMode){this.floatText(text);return;}
    let elapsed=0;
    for(const part of this.segments(text)){
      this.timers.push(setTimeout(()=>this.floatText(part),elapsed));
      elapsed+=Math.max(4200,part.length*270)+1200;
    }
    this.timers.push(setTimeout(()=>this.subtitle.classList.remove('show'),elapsed));
  }
  cancelSpeech(){
    this.generation++;clearTimeout(this.speechGuard);clearTimeout(this.resumeTimer);
    if('speechSynthesis'in window)speechSynthesis.cancel();
    if(this.speaking){this.speaking=false;this.resumeListening();}
    document.body.dataset.waterSpeaking='false';
  }
  reply(data) {
    this.settle(data.intent);this.present(data.reply);
    if(!this.enabled||!('speechSynthesis'in window))return;
    this.cancelSpeech();
    const generation=++this.generation;
    this.speaking=true;document.body.dataset.waterSpeaking='true';this.suspendListening();
    const parts=this.segments(data.reply);let index=0;
    const finish=(errorText='')=>{
      if(generation!==this.generation)return;
      clearTimeout(this.speechGuard);
      this.currentUtterance=null;
      this.note.textContent=errorText||'朗讀完成 · 水聲持續流動；尾音消散後恢復聆聽。';
      this.timers.push(setTimeout(()=>this.subtitle.classList.remove('show'),4500));
      this.resumeTimer=setTimeout(()=>{if(generation!==this.generation)return;this.speaking=false;document.body.dataset.waterSpeaking='false';this.resumeListening();},1400);
    };
    const next=()=>{
      if(generation!==this.generation)return;
      if(index>=parts.length){finish();return;}
      const part=parts[index++], utterance=new SpeechSynthesisUtterance(part);
      this.currentUtterance=utterance;
      utterance.lang='zh-TW';
      const voices=speechSynthesis.getVoices();
      const selected=voices.find(v=>v.lang==='zh-TW')||voices.find(v=>v.lang.startsWith('zh'));
      if(selected)utterance.voice=selected;
      utterance.rate=this.consent.checked?this.rate:.86;
      utterance.pitch=this.consent.checked&&this.pitchSamples>3?Math.max(.8,Math.min(1.2,this.pitchHz/180)):1;
      utterance.volume=.8;
      utterance.onstart=()=>{
        if(generation!==this.generation)return;
        this.note.textContent='朗讀中 · '+index+' / '+parts.length+' 段 · 裝置合成聲線';
        this.clearCaptions();if(!this.captionMode)this.floatText(part);
      };
      utterance.onend=()=>{if(generation===this.generation)this.resumeTimer=setTimeout(next,600);};
      utterance.onerror=()=>{
        if(generation!==this.generation)return;
        this.present(data.reply);finish('裝置朗讀未能完成；已保留文字回答。');
      };
      speechSynthesis.speak(utterance);
    };
    this.speechGuard=setTimeout(()=>{if(generation===this.generation){this.cancelSpeech();this.present(data.reply);this.note.textContent='朗讀逾時，已恢復聆聽並保留文字。';}},90000);
    next();
  }
  dispose(){this.cancelSpeech();this.clearCaptions();this.ctx?.close();}
}
window.WaterVoice=WaterVoice;
