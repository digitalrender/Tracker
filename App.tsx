
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Instrument, Pattern, Track, SynthConfig } from './types';
import { DEFAULT_INSTRUMENTS, INITIAL_BPM, createEmptyTrack } from './constants';
import { audioEngine } from './services/AudioEngine';
import TrackRow from './components/TrackRow';
import Visualizer from './components/Visualizer';
import SynthEditor from './components/SynthEditor';

const App: React.FC = () => {
  const [instruments, setInstruments] = useState<Instrument[]>(DEFAULT_INSTRUMENTS);
  const [patterns, setPatterns] = useState<Pattern[]>([
    {
      id: 'pattern-1',
      name: 'VERSE A',
      tracks: DEFAULT_INSTRUMENTS.map(inst => createEmptyTrack(inst.id)),
      bpm: INITIAL_BPM
    },
    {
      id: 'pattern-2',
      name: 'CHORUS',
      tracks: DEFAULT_INSTRUMENTS.map(inst => createEmptyTrack(inst.id)),
      bpm: INITIAL_BPM
    }
  ]);
  const [activePatternIndex, setActivePatternIndex] = useState(0);
  const [selectedInstrumentId, setSelectedInstrumentId] = useState(DEFAULT_INSTRUMENTS[3].id);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [globalTick, setGlobalTick] = useState(-1);
  const [masterVolume, setMasterVolume] = useState(0.7);
  const [isExporting, setIsExporting] = useState(false);
  const [isMidiConnected, setIsMidiConnected] = useState(false);

  const patternRef = useRef(patterns[activePatternIndex]);
  const tickRef = useRef(0);
  const selectedInstrumentIdRef = useRef(selectedInstrumentId);
  const instrumentsRef = useRef(instruments);

  useEffect(() => {
    patternRef.current = patterns[activePatternIndex];
  }, [patterns, activePatternIndex]);

  useEffect(() => {
    selectedInstrumentIdRef.current = selectedInstrumentId;
  }, [selectedInstrumentId]);

  useEffect(() => {
    instrumentsRef.current = instruments;
  }, [instruments]);

  // MIDI Setup
  useEffect(() => {
    if (navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
    } else {
      console.warn('WebMIDI is not supported in this browser.');
    }

    function onMIDISuccess(midiAccess: any) {
      const inputs = midiAccess.inputs.values();
      let hasInputs = false;
      for (let input = inputs.next(); input && !input.done; input = inputs.next()) {
        input.value.onmidimessage = handleMIDIMessage;
        hasInputs = true;
      }
      setIsMidiConnected(hasInputs);

      midiAccess.onstatechange = (e: any) => {
        setIsMidiConnected(midiAccess.inputs.size > 0);
      };
    }

    function onMIDIFailure() {
      console.error('Could not access your MIDI devices.');
    }

    function handleMIDIMessage(message: any) {
      const [command, data1, data2] = message.data;
      const type = command & 0xf0; 
      const currentInst = instrumentsRef.current.find(i => i.id === selectedInstrumentIdRef.current);
      if (!currentInst) return;

      switch (type) {
        case 0x90: // Note On
          if (data2 > 0) {
            audioEngine.noteOn(currentInst, data1, data2);
          } else {
            audioEngine.noteOff(data1);
          }
          break;
        case 0x80: // Note Off
          audioEngine.noteOff(data1);
          break;
        case 0xB0: // Control Change
          audioEngine.handleControlChange(currentInst, data1, data2);
          break;
        case 0xE0: // Pitch Bend
          // MIDI pitch bend is 14-bit: data1 is LSB, data2 is MSB. Center is 8192.
          const bend = ((data2 << 7) | data1);
          const normalizedBend = (bend - 8192) / 8192; // -1 to 1
          audioEngine.handlePitchBend(currentInst, normalizedBend);
          break;
      }
    }
  }, []);

  const handleTick = useCallback(() => {
    const p = patternRef.current;
    const currentTick = tickRef.current;
    
    setGlobalTick(currentTick);

    const anySoloed = p.tracks.some(t => t.soloed);

    p.tracks.forEach(track => {
      const stepIdx = currentTick % track.stepCount;
      const step = track.steps[stepIdx];
      
      const isAudible = anySoloed ? track.soloed : !track.muted;

      if (step.active && isAudible) {
        const inst = instruments.find(i => i.id === track.instrumentId);
        if (inst) {
          audioEngine.playInstrument(
            inst, 
            audioEngine.context.currentTime, 
            step.velocity * track.volume,
            step.note || 60
          );
        }
      }
    });

    tickRef.current = (currentTick + 1);
  }, [instruments]);

  const togglePlay = () => {
    if (isPlaying) {
      audioEngine.stop();
      setGlobalTick(-1);
      tickRef.current = 0;
    } else {
      audioEngine.setBPM(patterns[activePatternIndex].bpm);
      audioEngine.start(handleTick);
    }
    setIsPlaying(!isPlaying);
  };

  const updatePattern = (updater: (p: Pattern) => Pattern) => {
    setPatterns(prev => prev.map((p, idx) => idx === activePatternIndex ? updater(p) : p));
  };

  const handleToggleStep = (trackId: string, stepIndex: number) => {
    updatePattern(p => ({
      ...p,
      tracks: p.tracks.map(t => 
        t.id === trackId 
          ? { ...t, steps: t.steps.map((s, idx) => idx === stepIndex ? { ...s, active: !s.active } : s) } 
          : t
      )
    }));
  };

  const handleNoteChange = (trackId: string, stepIndex: number, note: number) => {
    updatePattern(p => ({
      ...p,
      tracks: p.tracks.map(t => 
        t.id === trackId 
          ? { ...t, steps: t.steps.map((s, idx) => idx === stepIndex ? { ...s, note } : s) } 
          : t
      )
    }));
  };

  const handleTrackVolume = (trackId: string, volume: number) => {
    updatePattern(p => ({
      ...p,
      tracks: p.tracks.map(t => t.id === trackId ? { ...t, volume } : t)
    }));
  };

  const handleToggleMute = (trackId: string) => {
    updatePattern(p => ({
      ...p,
      tracks: p.tracks.map(t => t.id === trackId ? { ...t, muted: !t.muted } : t)
    }));
  };

  const handleToggleSolo = (trackId: string) => {
    updatePattern(p => ({
      ...p,
      tracks: p.tracks.map(t => t.id === trackId ? { ...t, soloed: !t.soloed } : t)
    }));
  };

  const handleDeleteTrack = (trackId: string) => {
    if (window.confirm('Are you sure you want to delete this track from all patterns?')) {
      setPatterns(prev => prev.map(p => ({
        ...p,
        tracks: p.tracks.filter(t => t.id !== trackId)
      })));
    }
  };

  const handleDeleteInstrument = (instrumentId: string) => {
    if (window.confirm('Delete this sound from the library? This will also remove all sequencer tracks using this sound.')) {
      setInstruments(prev => {
        const updated = prev.filter(i => i.id !== instrumentId);
        if (selectedInstrumentId === instrumentId) {
          setSelectedInstrumentId(updated[0]?.id || '');
        }
        return updated;
      });
      setPatterns(prev => prev.map(p => ({
        ...p,
        tracks: p.tracks.filter(t => t.instrumentId !== instrumentId)
      })));
    }
  };

  const handleStepCountChange = (trackId: string, stepCount: number) => {
    updatePattern(p => ({
      ...p,
      tracks: p.tracks.map(t => t.id === trackId ? { ...t, stepCount } : t)
    }));
  };

  const updateSynthConfig = (instId: string, config: Partial<SynthConfig>) => {
    setInstruments(prev => prev.map(inst => 
      inst.id === instId && inst.synthConfig 
        ? { ...inst, synthConfig: { ...inst.synthConfig, ...config } } 
        : inst
    ));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const buffer = await audioEngine.loadSample(file);
        const newInst: Instrument = {
          id: `sample-${Date.now()}`,
          name: file.name.toUpperCase().substring(0, 10),
          type: 'SAMPLE',
          color: '#ffffff',
          buffer
        };
        setInstruments(prev => [...prev, newInst]);
        setPatterns(prev => prev.map(p => ({
          ...p,
          tracks: [...p.tracks, createEmptyTrack(newInst.id)]
        })));
        setSelectedInstrumentId(newInst.id);
      } catch (err) {
        alert("Error loading sample. Use WAV or MP3.");
      }
    }
  };

  const handleExport = async (format: 'wav' | 'mp3') => {
    if (isPlaying) togglePlay();
    setIsExporting(true);
    try {
      const currentPattern = patterns[activePatternIndex];
      const renderedBuffer = await audioEngine.renderPattern(currentPattern, instruments);
      const blob = audioEngine.audioBufferToWav(renderedBuffer);
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentPattern.name}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Export failed.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col p-4 md:p-6 overflow-hidden max-h-screen relative">
      {isExporting && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center flex-col gap-4">
          <div className="w-16 h-16 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="retro-font text-pink-500 animate-pulse uppercase tracking-widest">Rendering Audio...</p>
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-purple-700 rounded-lg shadow-[0_0_15px_#ff00ff] animate-pulse" />
          <h1 className="text-2xl font-black retro-font italic text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-cyan-400 to-purple-500">
            ITALOSYNTH PRO 80
          </h1>
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-bold transition-all ${isMidiConnected ? 'border-green-500/50 text-green-500 bg-green-500/10' : 'border-gray-800 text-gray-600 bg-black'}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isMidiConnected ? 'bg-green-500 animate-ping' : 'bg-gray-700'}`} />
            MIDI: {isMidiConnected ? 'CONNECTED' : 'OFFLINE'}
          </div>
        </div>

        <div className="flex items-center gap-4 bg-gray-900/80 p-3 rounded-xl border border-gray-800">
          <div className="flex flex-col items-center">
            <span className="text-[8px] text-gray-500 uppercase">Master</span>
            <input type="range" min="0" max="1" step="0.01" value={masterVolume} onChange={(e) => {
              const v = parseFloat(e.target.value);
              setMasterVolume(v);
              audioEngine.setVolume(v);
            }} className="w-20 h-1 accent-pink-500" />
          </div>
          <div className="h-8 w-px bg-gray-800" />
          <div className="flex gap-2">
            {patterns.map((p, idx) => (
              <button 
                key={p.id}
                onClick={() => setActivePatternIndex(idx)}
                className={`px-3 py-1 rounded text-[10px] font-bold border transition-all ${activePatternIndex === idx ? 'bg-pink-600 border-pink-400' : 'bg-black border-gray-800 text-gray-500'}`}
              >
                {p.name}
              </button>
            ))}
          </div>
          <button 
            onClick={togglePlay}
            className={`px-6 py-1 rounded-lg font-bold transition-all ${isPlaying ? 'bg-red-600 shadow-[0_0_10px_red]' : 'bg-cyan-600'}`}
          >
            {isPlaying ? 'STOP' : 'PLAY'}
          </button>
        </div>
      </header>

      {/* Workspace */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
        
        {/* Tracker Section */}
        <div className="lg:col-span-8 flex flex-col gap-4 overflow-hidden">
          <div className="flex-1 bg-gray-900/40 rounded-2xl border border-gray-800 p-6 overflow-y-auto relative">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xs font-bold text-gray-500 tracking-[0.3em] uppercase">Pattern: {patterns[activePatternIndex].name}</h2>
              <label className="bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-bold py-1 px-3 rounded cursor-pointer transition-colors shadow-[0_0_10px_rgba(8,145,178,0.3)]">
                + ADD SAMPLE
                <input type="file" className="hidden" accept="audio/*" onChange={handleFileUpload} />
              </label>
            </div>
            {patterns[activePatternIndex].tracks.map(track => {
              const instrument = instruments.find(i => i.id === track.instrumentId);
              if (!instrument) return null;
              return (
                <TrackRow 
                  key={track.id}
                  track={track}
                  instrument={instrument}
                  currentStep={globalTick}
                  onToggleStep={handleToggleStep}
                  onVolumeChange={handleTrackVolume}
                  onStepCountChange={handleStepCountChange}
                  onNoteChange={handleNoteChange}
                  onToggleMute={handleToggleMute}
                  onToggleSolo={handleToggleSolo}
                  onDeleteTrack={handleDeleteTrack}
                />
              );
            })}
          </div>
          
          <div className="h-32 bg-gray-900/40 rounded-2xl border border-gray-800 p-4">
             <div className="flex justify-between items-center mb-2">
               <h3 className="text-[10px] text-gray-500 uppercase tracking-widest">Master FX & Spectrum</h3>
               <div className="flex gap-2">
                 <button onClick={() => handleExport('wav')} className="text-[10px] text-pink-500 font-bold border border-pink-500/30 px-2 py-0.5 rounded hover:bg-pink-500/20">WAV</button>
                 <button onClick={() => handleExport('mp3')} className="text-[10px] text-purple-500 font-bold border border-purple-500/30 px-2 py-0.5 rounded hover:bg-purple-500/20">MP3</button>
               </div>
             </div>
             <Visualizer />
          </div>
        </div>

        {/* Sidebar Controls */}
        <div className="lg:col-span-4 flex flex-col gap-6 overflow-y-auto">
          {/* Instrument Selector */}
          <div className="bg-gray-900/80 p-6 rounded-2xl border border-gray-800">
            <h3 className="text-xs font-bold retro-font text-cyan-400 mb-4 uppercase flex justify-between items-center">
              <span>Sound Library</span>
              <span className="text-[8px] text-gray-600 animate-pulse uppercase">Midi Focus: {instruments.find(i => i.id === selectedInstrumentId)?.name || 'None'}</span>
            </h3>
            <div className="grid grid-cols-2 gap-2 mb-6">
              {instruments.map(inst => (
                <div key={inst.id} className="relative group">
                  <button 
                    onClick={() => setSelectedInstrumentId(inst.id)}
                    className={`w-full p-2 text-[10px] font-bold text-left rounded border transition-all ${selectedInstrumentId === inst.id ? 'border-cyan-500 bg-cyan-900/20' : 'border-gray-800 bg-black hover:border-gray-600'}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: inst.color }} />
                      <span className="truncate pr-4">{inst.name}</span>
                    </div>
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteInstrument(inst.id);
                    }}
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-red-900/50 text-red-400 text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-600 hover:text-white transition-opacity border border-red-500/30"
                    title="Delete sound from library"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            {instruments.find(i => i.id === selectedInstrumentId) && (
              <SynthEditor 
                instrument={instruments.find(i => i.id === selectedInstrumentId)!}
                onConfigChange={updateSynthConfig}
              />
            )}
          </div>

          <div className="bg-gray-900/80 p-6 rounded-2xl border border-gray-800">
             <h3 className="text-xs font-bold retro-font text-purple-400 mb-4 uppercase">Global Effects</h3>
             <div className="space-y-4">
               <div className="flex flex-col gap-1">
                 <span className="text-[10px] text-gray-500 uppercase">Reverb Depth</span>
                 <input type="range" className="w-full h-1 bg-gray-800 appearance-none accent-purple-500" defaultValue="0.3" />
               </div>
               <div className="flex flex-col gap-1">
                 <span className="text-[10px] text-gray-500 uppercase">Tape Delay</span>
                 <input type="range" className="w-full h-1 bg-gray-800 appearance-none accent-purple-500" defaultValue="0.2" />
               </div>
               <div className="flex flex-col gap-1">
                 <span className="text-[10px] text-gray-500 uppercase">80s Chorus</span>
                 <input type="range" className="w-full h-1 bg-gray-800 appearance-none accent-purple-500" defaultValue="0.1" />
               </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
