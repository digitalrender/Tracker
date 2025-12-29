
import React from 'react';
import { Track, Instrument } from '../types';

interface TrackRowProps {
  track: Track;
  instrument: Instrument;
  currentStep: number;
  onToggleStep: (trackId: string, stepIndex: number) => void;
  onVolumeChange: (trackId: string, volume: number) => void;
  onStepCountChange: (trackId: string, count: number) => void;
  onNoteChange: (trackId: string, stepIndex: number, note: number) => void;
  onToggleMute: (trackId: string) => void;
  onToggleSolo: (trackId: string) => void;
  onDeleteTrack: (trackId: string) => void;
}

const TrackRow: React.FC<TrackRowProps> = ({ 
  track, 
  instrument, 
  currentStep, 
  onToggleStep, 
  onVolumeChange, 
  onStepCountChange,
  onNoteChange,
  onToggleMute,
  onToggleSolo,
  onDeleteTrack
}) => {
  const steps = track.steps.slice(0, track.stepCount);
  const trackCurrentStep = currentStep % track.stepCount;

  return (
    <div className={`flex flex-col mb-4 p-2 border rounded-lg transition-colors ${track.muted ? 'bg-black/20 opacity-60' : 'bg-black/40'} ${track.soloed ? 'border-pink-500/50 shadow-[0_0_10px_rgba(236,72,153,0.1)]' : 'border-gray-800'}`}>
      <div className="flex items-center gap-4 mb-2">
        <div className="w-32 flex items-center gap-2">
          <span className="text-xs font-bold uppercase truncate" style={{ color: instrument.color }}>
            {instrument.name}
          </span>
        </div>

        {/* Control Buttons */}
        <div className="flex gap-1">
          <button 
            title="Mute"
            onClick={() => onToggleMute(track.id)}
            className={`w-6 h-6 rounded text-[10px] font-bold border transition-all ${track.muted ? 'bg-orange-600 border-orange-400 text-white' : 'bg-gray-900 border-gray-700 text-gray-500 hover:border-orange-500'}`}
          >
            M
          </button>
          <button 
            title="Solo"
            onClick={() => onToggleSolo(track.id)}
            className={`w-6 h-6 rounded text-[10px] font-bold border transition-all ${track.soloed ? 'bg-pink-600 border-pink-400 text-white shadow-[0_0_8px_rgba(236,72,153,0.5)]' : 'bg-gray-900 border-gray-700 text-gray-500 hover:border-pink-500'}`}
          >
            S
          </button>
          <button 
            title="Delete Track"
            onClick={() => onDeleteTrack(track.id)}
            className="w-6 h-6 rounded text-[10px] font-bold border bg-gray-900 border-gray-700 text-red-500 hover:bg-red-600 hover:text-white hover:border-red-400 transition-all"
          >
            ×
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500">LEN:</span>
          <select 
            value={track.stepCount} 
            onChange={(e) => onStepCountChange(track.id, parseInt(e.target.value))}
            className="bg-black text-cyan-400 text-[10px] border border-gray-700 rounded p-1"
          >
            <option value={8}>8</option>
            <option value={16}>16</option>
            <option value={32}>32</option>
          </select>
        </div>

        <input 
          type="range" min="0" max="1" step="0.01" value={track.volume}
          onChange={(e) => onVolumeChange(track.id, parseFloat(e.target.value))}
          className="w-24 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
        />
      </div>

      <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide">
        {steps.map((step, idx) => (
          <div key={idx} className="flex flex-col items-center gap-1">
            <button
              onClick={() => onToggleStep(track.id, idx)}
              className={`
                w-8 h-12 rounded transition-all duration-75 flex items-center justify-center
                ${step.active ? '' : 'bg-gray-800'}
                ${trackCurrentStep === idx ? 'border-2 border-white' : 'border border-gray-700'}
              `}
              style={{ 
                backgroundColor: step.active ? instrument.color : undefined,
                boxShadow: step.active ? `0 0 10px ${instrument.color}` : 'none'
              }}
            >
              {step.active && instrument.type === 'SYNTH' && (
                <span className="text-[8px] text-black font-bold">N</span>
              )}
            </button>
            {step.active && instrument.type === 'SYNTH' && (
              <input 
                type="number" 
                value={step.note || 60} 
                onChange={(e) => onNoteChange(track.id, idx, parseInt(e.target.value))}
                className="w-8 bg-black text-white text-[8px] text-center border border-gray-800 rounded"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TrackRow;
