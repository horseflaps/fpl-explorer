import { useState, useEffect } from 'react';
import { fetchFPLData } from './services/api';
import type { FPLResponse } from './types/fpl';
import HomeView from './components/HomeView';
import PlayersView from './components/PlayersView';
import TeamsView from './components/TeamsView';
import FixturesView from './components/FixturesView';
import GameweekLiveView from './components/GameweekLiveView';
import StandingsView from './components/StandingsView';
import Layout, { type View } from './components/Layout';
import { Loader2, AlertTriangle } from 'lucide-react';

function App() {
  const [data, setData] = useState<FPLResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<View>('home');
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);

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

  const currentGameweek = data.events.find(e => e.is_current) || data.events.find(e => e.is_next);

  return (
    <Layout
      currentView={currentView}
      onNavigate={setCurrentView}
      currentGameweek={currentGameweek}
    >
      {currentView === 'home' && <HomeView onNavigate={(view) => setCurrentView(view as View)} />}
      {currentView === 'players' && <PlayersView data={data} />}
      {currentView === 'teams' && (
        <TeamsView
          data={data}
          selectedTeamId={selectedTeamId}
          onSelectTeam={setSelectedTeamId}
        />
      )}
      {currentView === 'fixtures' && <FixturesView data={data} />}
      {currentView === 'gameweek' && <GameweekLiveView data={data} />}
      {currentView === 'standings' && (
        <StandingsView
          data={data}
          onTeamClick={(teamId) => {
            setSelectedTeamId(teamId);
            setCurrentView('teams');
          }}
        />
      )}
    </Layout>
  );
}

export default App;
