
import { Instrument, SynthConfig, Pattern, Track } from '../types';

interface ActiveVoice {
  osc: OscillatorNode;
  filter: BiquadFilterNode;
  gain: GainNode;
  lfo: OscillatorNode;
  releaseTime: number;
  baseFreq: number;
}

class AudioEngine {
  public ctx: AudioContext;
  private masterGain: GainNode;
  private analyser: AnalyserNode;
  
  // Global Effects
  private delayNode: DelayNode;
  private delayFeedback: GainNode;
  private reverbNode: ConvolverNode;
  private chorusNode: DelayNode;
  private chorusLFO: OscillatorNode;

  private isRunning: boolean = false;
  private bpm: number = 120;
  private timerId: number | null = null;
  private nextStepTime: number = 0;
  
  private onStepCallback: (trackIndex: number, stepIndex: number) => void = () => {};

  // MIDI Voice Management
  private activeVoices: Map<number, ActiveVoice> = new Map();

  constructor() {
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 256;

    this.setupEffects(this.ctx, this.masterGain);
    
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    this.masterGain.gain.value = 0.5;
  }

  private setupEffects(context: BaseAudioContext, destination: AudioNode) {
    // Delay
    this.delayNode = context.createDelay(1.0);
    this.delayFeedback = context.createGain();
    this.delayNode.delayTime.value = 0.375; 
    this.delayFeedback.gain.value = 0.4;
    this.delayNode.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delayNode);
    this.delayNode.connect(destination);

    // Simple Chorus
    this.chorusNode = context.createDelay(0.1);
    this.chorusLFO = context.createOscillator();
    const lfoGain = context.createGain();
    this.chorusLFO.frequency.value = 1.5;
    lfoGain.gain.value = 0.002;
    this.chorusLFO.connect(lfoGain);
    lfoGain.connect(this.chorusNode.delayTime);
    this.chorusLFO.start();
    this.chorusNode.connect(destination);

    // Reverb
    this.reverbNode = context.createConvolver();
    this.reverbNode.buffer = this.createReverbBuffer(context);
    this.reverbNode.connect(destination);
  }

  private createReverbBuffer(context: BaseAudioContext) {
    const len = context.sampleRate * 2;
    const buf = context.createBuffer(2, len, context.sampleRate);
    for (let i = 0; i < 2; i++) {
      const data = buf.getChannelData(i);
      for (let j = 0; j < len; j++) {
        data[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / len, 2);
      }
    }
    return buf;
  }

  getAnalyser() { return this.analyser; }
  setVolume(val: number) { this.masterGain.gain.setTargetAtTime(val, this.ctx.currentTime, 0.1); }
  setBPM(val: number) { this.bpm = val; }

  start(callback: (trackIndex: number, stepIndex: number) => void) {
    if (this.isRunning) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.isRunning = true;
    this.nextStepTime = this.ctx.currentTime;
    this.onStepCallback = callback;
    this.scheduler();
  }

  stop() {
    this.isRunning = false;
    if (this.timerId) window.clearTimeout(this.timerId);
  }

  private scheduler() {
    while (this.nextStepTime < this.ctx.currentTime + 0.1) {
      this.onStepCallback(-1, -1);
      this.advanceTime();
    }
    this.timerId = window.setTimeout(() => this.scheduler(), 25);
  }

  private advanceTime() {
    const secondsPerStep = 60.0 / this.bpm / 4;
    this.nextStepTime += secondsPerStep;
  }

  // Real-time MIDI Note On
  public noteOn(inst: Instrument, note: number, velocity: number) {
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const time = this.ctx.currentTime;
    const baseFreq = Math.pow(2, (note - 69) / 12) * 440;
    const vol = velocity / 127;

    if (inst.type === 'SYNTH' && inst.synthConfig) {
      const config = inst.synthConfig;
      const bendFactor = Math.pow(2, (config.pitchBend * config.pitchBendRange) / 12);
      const freq = baseFreq * bendFactor;

      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();

      osc.type = config.waveform;
      osc.frequency.setValueAtTime(freq, time);

      lfo.frequency.value = config.lfoRate;
      lfoGain.gain.value = config.lfoDepth * 10;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start(time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(config.filterCutoff * 5000 + 50, time);
      filter.Q.setValueAtTime(config.filterResonance * 20, time);

      const a = config.attack * 2;
      const d = config.decay * 2;
      const s = config.sustain;

      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(vol * 0.3, time + a);
      gain.gain.linearRampToValueAtTime(vol * 0.3 * s, time + a + d);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(time);

      this.activeVoices.set(note, { osc, filter, gain, lfo, releaseTime: config.release * 4, baseFreq });
    } else if (inst.type === 'DRUM') {
      this.renderDrum(inst.id, time, vol, this.ctx, this.masterGain);
    } else if (inst.type === 'SAMPLE' && inst.buffer) {
      this.renderBuffer(inst.buffer, time, vol, this.ctx, this.masterGain);
    }
  }

  // Real-time MIDI Note Off
  public noteOff(note: number) {
    const voice = this.activeVoices.get(note);
    if (voice) {
      const time = this.ctx.currentTime;
      const r = voice.releaseTime;
      
      voice.gain.gain.cancelScheduledValues(time);
      voice.gain.gain.setValueAtTime(voice.gain.gain.value, time);
      voice.gain.gain.exponentialRampToValueAtTime(0.001, time + r);
      
      voice.osc.stop(time + r + 0.1);
      voice.lfo.stop(time + r + 0.1);
      this.activeVoices.delete(note);
    }
  }

  // MIDI Pitch Bend Control
  public handlePitchBend(inst: Instrument, bendValue: number) {
    if (inst.type === 'SYNTH' && inst.synthConfig) {
      const config = inst.synthConfig;
      config.pitchBend = bendValue; // -1 to 1
      
      this.activeVoices.forEach(voice => {
        const bendFactor = Math.pow(2, (config.pitchBend * config.pitchBendRange) / 12);
        const freq = voice.baseFreq * bendFactor;
        voice.osc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.05);
      });
    }
  }

  // MIDI CC Control
  public handleControlChange(inst: Instrument, cc: number, value: number) {
    if (inst.type === 'SYNTH' && inst.synthConfig) {
      const normalized = value / 127;
      if (cc === 74) { // Cutoff
        inst.synthConfig.filterCutoff = normalized;
        this.activeVoices.forEach(voice => {
          voice.filter.frequency.setTargetAtTime(normalized * 5000 + 50, this.ctx.currentTime, 0.05);
        });
      } else if (cc === 1) { // Mod Wheel -> LFO depth
        inst.synthConfig.lfoDepth = normalized;
      }
    }
  }

  playInstrument(inst: Instrument, time: number, velocity: number, note: number = 60, targetContext: BaseAudioContext = this.ctx, targetNode: AudioNode = this.masterGain) {
    const baseFreq = Math.pow(2, (note - 69) / 12) * 440;
    
    if (inst.type === 'SYNTH' && inst.synthConfig) {
      const bendFactor = Math.pow(2, (inst.synthConfig.pitchBend * inst.synthConfig.pitchBendRange) / 12);
      this.renderSynth(inst.synthConfig, time, velocity, baseFreq * bendFactor, targetContext, targetNode);
    } else if (inst.type === 'DRUM') {
      this.renderDrum(inst.id, time, velocity, targetContext, targetNode);
    } else if (inst.type === 'SAMPLE' && inst.buffer) {
      this.renderBuffer(inst.buffer, time, velocity, targetContext, targetNode);
    }
  }

  private renderSynth(config: SynthConfig, time: number, vol: number, freq: number, context: BaseAudioContext, destination: AudioNode) {
    const osc = context.createOscillator();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    const lfo = context.createOscillator();
    const lfoGain = context.createGain();

    osc.type = config.waveform;
    osc.frequency.setValueAtTime(freq, time);

    lfo.frequency.value = config.lfoRate;
    lfoGain.gain.value = config.lfoDepth * 10;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    lfo.start(time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(config.filterCutoff * 5000 + 50, time);
    filter.Q.setValueAtTime(config.filterResonance * 20, time);

    const a = config.attack * 2;
    const d = config.decay * 2;
    const s = config.sustain;
    const r = config.release * 4;

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(vol * 0.3, time + a);
    gain.gain.linearRampToValueAtTime(vol * 0.3 * s, time + a + d);
    gain.gain.setTargetAtTime(0, time + a + d + 0.1, r);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(destination);

    osc.start(time);
    osc.stop(time + a + d + r + 0.5);
    lfo.stop(time + a + d + r + 0.5);
  }

  private renderDrum(id: string, time: number, vol: number, context: BaseAudioContext, destination: AudioNode) {
    const osc = context.createOscillator();
    const gain = context.createGain();
    if (id === 'kick') {
      osc.frequency.setValueAtTime(150, time);
      osc.frequency.exponentialRampToValueAtTime(40, time + 0.1);
      gain.gain.setValueAtTime(vol, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.4);
      osc.connect(gain);
      gain.connect(destination);
      osc.start(time);
      osc.stop(time + 0.5);
    } else if (id === 'snare') {
      const noise = context.createBufferSource();
      noise.buffer = this.createNoiseBuffer(context);
      const noiseGain = context.createGain();
      noiseGain.gain.setValueAtTime(vol, time);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
      noise.connect(noiseGain);
      noiseGain.connect(destination);
      noise.start(time);
    } else {
      osc.frequency.setValueAtTime(8000, time);
      gain.gain.setValueAtTime(vol * 0.2, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
      osc.connect(gain);
      gain.connect(destination);
      osc.start(time);
      osc.stop(time + 0.1);
    }
  }

  private createNoiseBuffer(context: BaseAudioContext) {
    const size = context.sampleRate * 0.5;
    const buf = context.createBuffer(1, size, context.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  private renderBuffer(buffer: AudioBuffer, time: number, vol: number, context: BaseAudioContext, destination: AudioNode) {
    const source = context.createBufferSource();
    source.buffer = buffer;
    const gain = context.createGain();
    gain.gain.setValueAtTime(vol, time);
    source.connect(gain);
    gain.connect(destination);
    source.start(time);
  }

  async loadSample(file: File): Promise<AudioBuffer> {
    const arrayBuffer = await file.arrayBuffer();
    return await this.ctx.decodeAudioData(arrayBuffer);
  }

  async renderPattern(pattern: Pattern, instruments: Instrument[]): Promise<AudioBuffer> {
    const secondsPerStep = 60.0 / pattern.bpm / 4;
    const maxSteps = Math.max(...pattern.tracks.map(t => t.stepCount));
    const duration = maxSteps * secondsPerStep + 2; 
    
    const offlineCtx = new OfflineAudioContext(2, this.ctx.sampleRate * duration, this.ctx.sampleRate);
    const offlineMaster = offlineCtx.createGain();
    offlineMaster.connect(offlineCtx.destination);
    
    this.setupEffects(offlineCtx, offlineMaster);

    pattern.tracks.forEach(track => {
      const inst = instruments.find(i => i.id === track.instrumentId);
      if (!inst || track.muted) return;

      for (let i = 0; i < track.stepCount; i++) {
        const step = track.steps[i];
        if (step.active) {
          const startTime = i * secondsPerStep;
          this.playInstrument(inst, startTime, step.velocity * track.volume, step.note || 60, offlineCtx, offlineMaster);
        }
      }
    });

    return await offlineCtx.startRendering();
  }

  audioBufferToWav(buffer: AudioBuffer): Blob {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    
    const bufferLength = buffer.length;
    const wavBuffer = new ArrayBuffer(44 + bufferLength * blockAlign);
    const view = new DataView(wavBuffer);
    
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + bufferLength * blockAlign, true);
    this.writeString(view, 8, 'WAVE');
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    this.writeString(view, 36, 'data');
    view.setUint32(40, bufferLength * blockAlign, true);
    
    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }
    
    return new Blob([wavBuffer], { type: 'audio/wav' });
  }

  private writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  get context() { return this.ctx; }
}

export const audioEngine = new AudioEngine();
