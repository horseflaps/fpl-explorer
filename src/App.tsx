import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { track } from './utils/analytics';
import { fetchFPLData } from './services/api';
import type { FPLResponse } from './types/fpl';
import HomeView from './components/HomeView';
import PlayersView from './components/PlayersView';
import TeamsView from './components/TeamsView';
import FixturesView from './components/FixturesView';
import GameweekLiveView from './components/GameweekLiveView';
import StandingsView from './components/StandingsView';
import PitchView from './components/PitchView';
import MyTeamsView from './components/MyTeamsView';
import PricingView from './components/PricingView';
import SetupView from './components/SetupView';
import HowItWorksView from './components/HowItWorksView';
import FAQView from './components/FAQView';
import ContactView from './components/ContactView';
import CarbonView from './components/CarbonView';
import LabView from './components/XGLabView';
import AutopilotView from './components/AutopilotView';
import VerifiedRoute from './components/VerifiedRoute';
import MyAccountView from './components/MyAccountView';
import Layout from './components/Layout';
import { Loader2, AlertTriangle } from 'lucide-react';
import { AuthProvider } from './context/AuthContext';

function RouteTracker() {
    const location = useLocation();
    useEffect(() => {
        track('page_view', { page_path: location.pathname + location.search });
    }, [location]);
    return null;
}

function App() {
  const [data, setData] = useState<FPLResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const fplData = await fetchFPLData();
        setData(fplData);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Failed to load FPL data. Please try again later.');
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

  const nextGameweek = data.events.find(e => e.is_next);
  const currentGameweek = nextGameweek || data.events.find(e => e.is_current);

  return (
    <AuthProvider>
      <BrowserRouter>
        <RouteTracker />
        <Layout currentGameweek={currentGameweek}>
          <Routes>
            <Route path="/" element={<HomeView />} />
            <Route path="/players" element={<PlayersView data={data} />} />
            <Route path="/teams" element={<TeamsView data={data} />} />
            <Route path="/fixtures" element={<FixturesView data={data} />} />
            <Route path="/gameweek" element={<GameweekLiveView data={data} />} />
            <Route path="/standings" element={<StandingsView data={data} />} />
            <Route path="/analyse" element={<VerifiedRoute><PitchView data={data} /></VerifiedRoute>} />
            <Route path="/my-teams" element={<VerifiedRoute><MyTeamsView /></VerifiedRoute>} />
            <Route path="/pricing" element={<PricingView />} />
            <Route path="/setup" element={<SetupView />} />
            <Route path="/my-account" element={<MyAccountView />} />
            <Route path="/how-it-works" element={<HowItWorksView />} />
            <Route path="/faq" element={<FAQView />} />
            <Route path="/contact" element={<ContactView />} />
            <Route path="/carbon" element={<CarbonView />} />
            <Route path="/lab" element={<LabView data={data} />} />
            <Route path="/autopilot" element={<VerifiedRoute><AutopilotView /></VerifiedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
