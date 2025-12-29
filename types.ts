
export type InstrumentType = 'DRUM' | 'SYNTH' | 'SAMPLE';
export type WaveformType = 'sawtooth' | 'square' | 'triangle' | 'sine';

export interface SynthConfig {
  waveform: WaveformType;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  filterCutoff: number;
  filterResonance: number;
  lfoRate: number;
  lfoDepth: number;
  pitchBend: number; // Current bend value (-1 to 1)
  pitchBendRange: number; // Range in semitones (e.g., 2 or 12)
}

export interface Instrument {
  id: string;
  name: string;
  type: InstrumentType;
  color: string;
  buffer?: AudioBuffer;
  synthConfig?: SynthConfig;
}

export interface Step {
  active: boolean;
  velocity: number;
  note?: number; // MIDI note for synth
}

export interface Track {
  id: string;
  instrumentId: string;
  steps: Step[];
  volume: number;
  muted: boolean;
  soloed: boolean;
  stepCount: number; // For polyrhythms
  delaySend: number;
  reverbSend: number;
}

export interface Pattern {
  id: string;
  name: string;
  tracks: Track[];
  bpm: number;
}

export interface Song {
  patterns: string[]; // Order of pattern IDs to play
}
