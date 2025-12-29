
// Fix: Removed non-existent member STEPS_PER_PATTERN from the './types' import as it is not exported by types.ts
import { Instrument, SynthConfig } from './types';

export const STEPS_PER_PATTERN_MAX = 32;
export const INITIAL_BPM = 120;

const DEFAULT_SYNTH: SynthConfig = {
  waveform: 'sawtooth',
  attack: 0.05,
  decay: 0.2,
  sustain: 0.4,
  release: 0.3,
  filterCutoff: 0.5,
  filterResonance: 0.2,
  lfoRate: 5,
  lfoDepth: 0.1,
  pitchBend: 0,
  pitchBendRange: 2
};

export const DEFAULT_INSTRUMENTS: Instrument[] = [
  { id: 'kick', name: 'LINN KICK', type: 'DRUM', color: '#ff00ff' },
  { id: 'snare', name: 'SIMMONS SNR', type: 'DRUM', color: '#00ffff' },
  { id: 'hihat', name: 'ITALO HH', type: 'DRUM', color: '#ffff00' },
  { id: 'bass', name: 'JUNO BASS', type: 'SYNTH', color: '#ff8800', synthConfig: { ...DEFAULT_SYNTH, waveform: 'sawtooth', filterCutoff: 0.3 } },
  { id: 'lead', name: 'DX7 LEAD', type: 'SYNTH', color: '#ff0088', synthConfig: { ...DEFAULT_SYNTH, waveform: 'square', filterCutoff: 0.7 } },
];

export const createEmptyTrack = (instrumentId: string): any => ({
  id: Math.random().toString(36).substr(2, 9),
  instrumentId,
  steps: Array.from({ length: STEPS_PER_PATTERN_MAX }, () => ({ active: false, velocity: 0.8, note: 60 })),
  volume: 0.7,
  muted: false,
  soloed: false,
  stepCount: 16,
  delaySend: 0,
  reverbSend: 0
});
