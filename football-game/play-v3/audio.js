export class MatchAudio{
 constructor(){this.enabled=false;this.context=null}
 toggle(){this.enabled=!this.enabled;if(this.enabled){this.context??=new(window.AudioContext||window.webkitAudioContext)();this.context.resume()}return this.enabled}
 tone(freq,duration=.15,type='sine',volume=.08){if(!this.enabled)return;const c=this.context,t=c.currentTime,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g).connect(c.destination);o.start();o.stop(t+duration)}
 kick(){this.tone(110,.12,'triangle',.2)} whistle(){this.tone(2100,.3,'sine',.08);this.tone(2350,.27,'sine',.025)}
 crowd(win){if(!this.enabled)return;const c=this.context,t=c.currentTime,len=win?2.8:1.9,b=c.createBuffer(1,c.sampleRate*len,c.sampleRate),d=b.getChannelData(0);let a=0;for(let i=0;i<d.length;i++){a=.93*a+.07*(Math.random()*2-1);d[i]=a*2}const s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=b;f.type='bandpass';f.frequency.value=win?1000:350;f.Q.value=.6;g.gain.setValueAtTime(.001,t);g.gain.linearRampToValueAtTime(.55,t+.2);g.gain.exponentialRampToValueAtTime(.001,t+len);s.connect(f).connect(g).connect(c.destination);s.start();for(let i=0;i<3;i++)this.tone((win?430:130)+i*37,len,'sine',.015)}
}
