
import React from 'react';
import { Instrument, SynthConfig, WaveformType } from '../types';

interface SynthEditorProps {
  instrument: Instrument;
  onConfigChange: (id: string, config: Partial<SynthConfig>) => void;
}

const SynthEditor: React.FC<SynthEditorProps> = ({ instrument, onConfigChange }) => {
  if (instrument.type !== 'SYNTH' || !instrument.synthConfig) return null;

  const config = instrument.synthConfig;

  const Control = ({ label, value, min, max, step, onChange }: any) => (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-[10px] text-gray-500 uppercase tracking-tighter">
        <span>{label}</span>
        <span className="text-pink-500">{typeof value === 'number' ? value.toFixed(2) : value}</span>
      </div>
      <input 
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-pink-500"
      />
    </div>
  );

  return (
    <div className="bg-gray-900/80 p-6 rounded-2xl border border-pink-500/30 shadow-[0_0_20px_rgba(236,72,153,0.1)]">
      <h3 className="text-sm font-bold retro-font text-pink-400 mb-6 flex items-center gap-2">
        <span className="text-xl">🎛️</span> SYNTH ENGINE: {instrument.name}
      </h3>

      <div className="grid grid-cols-2 gap-x-8 gap-y-6">
        {/* Oscillator Section */}
        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-gray-500 uppercase">Waveform</label>
            <select 
              value={config.waveform}
              onChange={(e) => onConfigChange(instrument.id, { waveform: e.target.value as WaveformType })}
              className="bg-black text-pink-500 border border-gray-800 rounded p-1 text-xs outline-none focus:border-pink-500"
            >
              <option value="sawtooth">SAW</option>
              <option value="square">SQUARE</option>
              <option value="triangle">TRIANGLE</option>
              <option value="sine">SINE</option>
            </select>
          </div>
          <Control label="Cutoff" value={config.filterCutoff} min={0} max={1} step={0.01} onChange={(v:any) => onConfigChange(instrument.id, { filterCutoff: v })} />
          <Control label="Resonance" value={config.filterResonance} min={0} max={1} step={0.01} onChange={(v:any) => onConfigChange(instrument.id, { filterResonance: v })} />
        </div>

        {/* Envelope Section */}
        <div className="space-y-4">
          <Control label="Attack" value={config.attack} min={0.01} max={1} step={0.01} onChange={(v:any) => onConfigChange(instrument.id, { attack: v })} />
          <Control label="Decay" value={config.decay} min={0.01} max={1} step={0.01} onChange={(v:any) => onConfigChange(instrument.id, { decay: v })} />
          <Control label="Sustain" value={config.sustain} min={0} max={1} step={0.01} onChange={(v:any) => onConfigChange(instrument.id, { sustain: v })} />
          <Control label="Release" value={config.release} min={0.01} max={1} step={0.01} onChange={(v:any) => onConfigChange(instrument.id, { release: v })} />
        </div>

        {/* Pitch Bend Section */}
        <div className="col-span-2 grid grid-cols-2 gap-8 border-t border-gray-800 pt-6">
          <Control label="Pitch Bend" value={config.pitchBend} min={-1} max={1} step={0.01} onChange={(v:any) => onConfigChange(instrument.id, { pitchBend: v })} />
          <Control label="Bend Range (ST)" value={config.pitchBendRange} min={0} max={12} step={1} onChange={(v:any) => onConfigChange(instrument.id, { pitchBendRange: v })} />
        </div>

        {/* LFO Section */}
        <div className="col-span-2 grid grid-cols-2 gap-8 border-t border-gray-800 pt-6">
          <Control label="LFO Rate" value={config.lfoRate} min={0} max={20} step={0.1} onChange={(v:any) => onConfigChange(instrument.id, { lfoRate: v })} />
          <Control label="LFO Depth" value={config.lfoDepth} min={0} max={1} step={0.01} onChange={(v:any) => onConfigChange(instrument.id, { lfoDepth: v })} />
        </div>
      </div>
    </div>
  );
};

export default SynthEditor;
