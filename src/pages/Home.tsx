import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, Sparkles, Book, Code2, Archive, FileText, RefreshCw, X, Brain } from 'lucide-react';
import { fetchReadyNotes, getCachedReadyNotes, cacheReadyNotes, type ReadyNote } from '../utils/googleSheets';
import { cn } from '../components/DocumentRenderer';

const CHARS = '!<>-_\\/[]{}—=+*^?#________';

const ScrambleText = ({ texts }: { texts: string[] }) => {
  const [text, setText] = useState(texts[0]);

  useEffect(() => {
    let currentTextIndex = 0;
    let isCancelled = false;
    let frameRequest: number;
    let timeout: NodeJS.Timeout;

    const animate = () => {
      if (isCancelled) return;
      
      const from = texts[currentTextIndex];
      const to = texts[(currentTextIndex + 1) % texts.length];
      const length = Math.max(from.length, to.length);
      
      let frame = 0;
      const maxFrames = 40;

      const step = () => {
        if (isCancelled) return;
        frame++;
        let result = '';
        for (let i = 0; i < length; i++) {
          const resolveFrame = (i / length) * (maxFrames * 0.5) + (maxFrames * 0.5);
          if (frame >= resolveFrame) {
            result += to[i] || '';
          } else {
            result += CHARS[Math.floor(Math.random() * CHARS.length)];
          }
        }
        setText(result);

        if (frame < maxFrames) {
          frameRequest = requestAnimationFrame(step);
        } else {
          currentTextIndex = (currentTextIndex + 1) % texts.length;
          timeout = setTimeout(animate, 3000);
        }
      };

      frameRequest = requestAnimationFrame(step);
    };

    timeout = setTimeout(animate, 3000);

    return () => {
      isCancelled = true;
      clearTimeout(timeout);
      cancelAnimationFrame(frameRequest);
    };
  }, [texts]);

  return <>{text}</>;
};

export default function Home() {
  const [isReadyNotesOpen, setIsReadyNotesOpen] = useState(false);
  const [readyNotes, setReadyNotes] = useState<ReadyNote[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const cached = getCachedReadyNotes();
    if (cached) setReadyNotes(cached);
  }, []);

  const handleFetchNotes = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const notes = await fetchReadyNotes();
      setReadyNotes(notes);
      cacheReadyNotes(notes);
    } catch (err) {
      setError('Failed to fetch notes. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectNote = (note: ReadyNote) => {
    localStorage.setItem('arcane-notes-input', note.content);
    // Clear previous parsed data to force re-generation
    localStorage.removeItem('arcane-notes-parsed-data');
    localStorage.removeItem('arcane-notes-current-note-id');
    navigate('/parser?generate=true');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-400/20 blur-[120px] rounded-full" />
        <div className="absolute top-[20%] right-[10%] w-[20%] h-[20%] bg-emerald-400/10 blur-[80px] rounded-full" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="max-w-4xl text-center relative z-10"
      >
        <h1 className="text-7xl md:text-9xl font-black tracking-tighter mb-12 bg-clip-text text-transparent bg-gradient-to-b from-slate-900 to-slate-500 leading-none">
          Arcane Notes
        </h1>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
          <div className="flex flex-col items-center gap-4 w-full sm:w-auto">
            <Link 
              to="/parser" 
              className="group relative inline-flex items-center justify-center px-12 py-6 bg-blue-600 rounded-2xl shadow-[0_10px_30px_-10px_rgba(37,99,235,0.5)] hover:bg-blue-700 hover:shadow-[0_10px_40px_-10px_rgba(37,99,235,0.6)] hover:-translate-y-1 transition-all duration-300 w-full sm:w-auto overflow-hidden"
            >
              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              <span className="text-4xl md:text-5xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-white to-white/40">
                Start
              </span>
              <ArrowRight className="ml-4 w-8 h-8 md:w-10 md:h-10 text-white/70 group-hover:translate-x-2 transition-transform" />
            </Link>
            
            <Link 
              to="/saved" 
              className="flex items-center gap-2 text-slate-500 hover:text-blue-600 font-bold transition-colors px-4 py-2 rounded-lg hover:bg-blue-50"
            >
              <Archive className="w-5 h-5" />
              Saved Notes
            </Link>

            <button 
              onClick={() => {
                setIsReadyNotesOpen(true);
                if (readyNotes.length === 0) handleFetchNotes();
              }}
              className="flex items-center gap-2 text-slate-500 hover:text-emerald-600 font-bold transition-colors px-4 py-2 rounded-lg hover:bg-emerald-50"
            >
              <FileText className="w-5 h-5" />
              Ready Notes
            </button>
          </div>
          
          <div className="flex items-center gap-4 px-6 py-4 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow h-fit">
            <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
              <Code2 className="w-6 h-6 text-slate-700" />
            </div>
            <div className="text-left min-w-[140px]">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Designed By</p>
              <p className="text-sm font-black text-slate-800 tracking-tight uppercase">
                <ScrambleText texts={['AHMED FAYED', 'ARCANE PLOTTER']} />
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Ready Notes Modal */}
      <AnimatePresence>
        {isReadyNotesOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsReadyNotesOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-emerald-100 rounded-2xl text-emerald-600">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black tracking-tight text-slate-900">Ready Notes</h2>
                    <p className="text-slate-500 text-sm font-medium">Pre-formatted notes from Google Sheets</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleFetchNotes}
                    disabled={isLoading}
                    className={cn(
                      "p-3 rounded-2xl text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all",
                      isLoading && "animate-spin"
                    )}
                  >
                    <RefreshCw className="w-6 h-6" />
                  </button>
                  <button 
                    onClick={() => setIsReadyNotesOpen(false)}
                    className="p-3 rounded-2xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <div className="w-12 h-12 border-4 border-emerald-100 border-t-emerald-600 rounded-full animate-spin" />
                    <p className="text-slate-500 font-bold animate-pulse">Fetching notes...</p>
                  </div>
                ) : error ? (
                  <div className="text-center py-20">
                    <div className="inline-flex p-4 bg-rose-50 text-rose-600 rounded-3xl mb-4">
                      <X className="w-8 h-8" />
                    </div>
                    <p className="text-slate-900 font-bold text-lg mb-2">{error}</p>
                    <button 
                      onClick={handleFetchNotes}
                      className="text-emerald-600 font-bold hover:underline"
                    >
                      Try again
                    </button>
                  </div>
                ) : readyNotes.length === 0 ? (
                  <div className="text-center py-20">
                    <div className="inline-flex p-4 bg-slate-50 text-slate-400 rounded-3xl mb-4">
                      <Brain className="w-8 h-8" />
                    </div>
                    <p className="text-slate-900 font-bold text-lg">No notes found.</p>
                    <p className="text-slate-500">The sheet might be empty or inaccessible.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {readyNotes.map((note, idx) => (
                      <motion.button
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        onClick={() => handleSelectNote(note)}
                        className="group flex flex-col items-start p-6 bg-slate-50 hover:bg-emerald-50 border border-slate-100 hover:border-emerald-200 rounded-3xl transition-all text-left"
                      >
                        <div className="flex items-center justify-between w-full mb-3">
                          <h3 className="text-lg font-black tracking-tight text-slate-900 group-hover:text-emerald-700 transition-colors">
                            {note.name}
                          </h3>
                          <div className="p-2 bg-white rounded-xl text-slate-400 group-hover:text-emerald-500 shadow-sm transition-colors">
                            <ArrowRight className="w-4 h-4" />
                          </div>
                        </div>
                        <p className="text-slate-500 text-sm line-clamp-2 font-medium">
                          {note.content.substring(0, 100)}...
                        </p>
                      </motion.button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <motion.div
        animate={{ 
          y: [0, -20, 0],
          rotate: [0, 5, 0]
        }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[15%] left-[15%] opacity-40 hidden lg:block"
      >
        <Book className="w-16 h-16 text-blue-300" />
      </motion.div>

      <motion.div
        animate={{ 
          y: [0, 20, 0],
          rotate: [0, -5, 0]
        }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute bottom-[20%] right-[15%] opacity-40 hidden lg:block"
      >
        <Sparkles className="w-20 h-20 text-purple-300" />
      </motion.div>

      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none mix-blend-multiply" />
    </div>
  );
}
