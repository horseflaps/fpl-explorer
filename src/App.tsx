import { useState, useEffect } from 'react';
import { fetchFPLData } from './services/api';
import type { FPLResponse } from './types/fpl';
import HomeView from './components/HomeView';
import PlayersView from './components/PlayersView';
import TeamsView from './components/TeamsView';
import { Loader2, AlertTriangle, ArrowLeft } from 'lucide-react';

type View = 'home' | 'players' | 'teams';

function App() {
  const [data, setData] = useState<FPLResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<View>('home');

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const fplData = await fetchFPLData();
        setData(fplData);
      } catch (err) {
        setError('Failed to load FPL data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-fpl-green animate-spin mx-auto mb-4" />
          <p className="text-fpl-green font-mono animate-pulse">Loading FPL Data...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-red-900/20 border border-red-500/50 p-6 rounded-2xl max-w-md text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-red-400 mb-2">Error Loading Data</h2>
          <p className="text-gray-300">{error || 'Unknown error occurred'}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors font-semibold"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[url('https://resources.premierleague.com/premierleague/photo/2023/12/22/a894560a-0490-449e-8798-7c050a490ca9/pl-background.png')] bg-fixed bg-cover bg-center bg-no-repeat bg-slate-950 attachment-fixed">
      {/* Overlay to darken background */}
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-0 pointer-events-none" />

      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex items-center gap-4">
             {currentView !== 'home' && (
                  <button 
                    onClick={() => setCurrentView('home')}
                    className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full text-white transition-colors"
                  >
                      <ArrowLeft size={24} />
                  </button>
             )}
            <div>
                <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-fpl-green to-fpl-blue mb-2">
                FPL Explorer
                </h1>
                <p className="text-gray-400 max-w-lg">
                    {currentView === 'home' ? 'Manage your fantasy experience.' :
                     currentView === 'players' ? 'Browse and analyze player statistics.' :
                     'Compare team performance and stats.'}
                </p>
            </div>
          </div>
          <div className="text-right hidden md:block">
            <div className="text-sm text-gray-500">Gameweek</div>
            <div className="text-3xl font-bold text-white">
              {data.events.find(e => e.is_current)?.name || 'Pre-Season'}
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="min-h-[60vh]">
            {currentView === 'home' && (
                <HomeView onNavigate={setCurrentView} />
            )}
            {currentView === 'players' && (
                <PlayersView data={data} />
            )}
            {currentView === 'teams' && (
                <TeamsView data={data} />
            )}
        </main>
      </div>
    </div>
  );
}

export default App;
