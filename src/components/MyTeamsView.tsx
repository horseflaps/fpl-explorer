import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2, Trash2, ArrowRight, Shirt, Activity, Search, X, Wifi, Brain } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface SavedTeam {
    id: number;
    name: string;
    team_data: string;
    created_at: string;
    last_connected_at: string | null;
}

interface SavedAnalysis {
    id: number;
    team_name: string;
    entry_id: number;
    gameweek: number;
    analysis_text: string;
    ai_provider: string | null;
    created_at: string;
}

const MyTeamsView: React.FC = () => {
    const { user, token, fplEntryId, fplConnected } = useAuth();
    const navigate = useNavigate();
    const [tab, setTab] = useState<'teams' | 'analyses'>('teams');

    // Teams state
    const [teams, setTeams] = useState<SavedTeam[]>([]);
    const [teamsLoading, setTeamsLoading] = useState(true);
    const [teamsError, setTeamsError] = useState<string | null>(null);
    const [teamToDelete, setTeamToDelete] = useState<number | null>(null);

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<{ team_id: number; team_name: string; manager_name: string }[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchPage, setSearchPage] = useState(1);
    const [searchHasMore, setSearchHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    useEffect(() => {
        if (searchQuery.length < 2) { setSearchResults([]); setSearchPage(1); setSearchHasMore(false); return; }
        const t = setTimeout(async () => {
            setSearchLoading(true);
            setSearchPage(1);
            try {
                const res = await fetch(`/api/team-search?q=${encodeURIComponent(searchQuery)}&page=1`);
                if (res.ok) {
                    const rows = await res.json();
                    setSearchResults(rows);
                    setSearchHasMore(rows.length === 20);
                }
            } catch {}
            finally { setSearchLoading(false); }
        }, 300);
        return () => clearTimeout(t);
    }, [searchQuery]);

    const loadMoreResults = async () => {
        const nextPage = searchPage + 1;
        setLoadingMore(true);
        try {
            const res = await fetch(`/api/team-search?q=${encodeURIComponent(searchQuery)}&page=${nextPage}`);
            if (res.ok) {
                const rows = await res.json();
                setSearchResults(prev => [...prev, ...rows]);
                setSearchPage(nextPage);
                setSearchHasMore(rows.length === 20);
            }
        } catch {}
        finally { setLoadingMore(false); }
    };

    // Analyses state
    const [analyses, setAnalyses] = useState<SavedAnalysis[]>([]);
    const [analysesLoading, setAnalysesLoading] = useState(true);
    const [analysesError, setAnalysesError] = useState<string | null>(null);
    const [expandedAnalysis, setExpandedAnalysis] = useState<number | null>(null);
    const [analysisToDelete, setAnalysisToDelete] = useState<number | null>(null);

    const fetchTeams = async () => {
        if (!user || !token) { setTeamsLoading(false); return; }
        try {
            const res = await fetch('/api/user/teams', { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) setTeams(await res.json());
            else setTeamsError('Failed to fetch teams');
        } catch { setTeamsError('Error loading teams'); }
        finally { setTeamsLoading(false); }
    };

    const fetchAnalyses = async () => {
        if (!user || !token) { setAnalysesLoading(false); return; }
        try {
            const res = await fetch('/api/user/analyses', { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) setAnalyses(await res.json());
            else setAnalysesError('Failed to fetch analyses');
        } catch { setAnalysesError('Error loading analyses'); }
        finally { setAnalysesLoading(false); }
    };

    useEffect(() => {
        fetchTeams();
        fetchAnalyses();
    }, [user, token]);

    useEffect(() => {
        if (fplConnected) fetchTeams();
    }, [fplConnected]);

    const confirmDeleteTeam = async () => {
        if (teamToDelete === null) return;
        try {
            const res = await fetch(`/api/user/teams/${teamToDelete}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) setTeams(prev => prev.filter(t => t.id !== teamToDelete));
            else alert('Failed to delete team');
        } catch { alert('Error deleting team'); }
        finally { setTeamToDelete(null); }
    };

    const confirmDeleteAnalysis = async () => {
        if (analysisToDelete === null) return;
        try {
            const res = await fetch(`/api/user/analyses/${analysisToDelete}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) setAnalyses(prev => prev.filter(a => a.id !== analysisToDelete));
            else alert('Failed to delete analysis');
        } catch { alert('Error deleting analysis'); }
        finally { setAnalysisToDelete(null); }
    };

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center py-32 text-center space-y-6 animate-in fade-in zoom-in duration-500">
                <div className="w-20 h-20 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                    <Shirt size={36} className="text-gray-500" />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-white mb-2">Login Required</h2>
                    <p className="text-gray-400">Please log in to view your saved teams and past analyses.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in zoom-in duration-500 py-8 relative">
            {/* Tabs */}
            <div className="flex gap-1 bg-[#37003c]/60 border border-white/10 rounded-xl p-1 w-fit">
                <button
                    onClick={() => setTab('teams')}
                    className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold uppercase tracking-wide transition-all ${tab === 'teams' ? 'bg-[#00ff87] text-[#37003c]' : 'text-white/50 hover:text-white'}`}
                >
                    <Shirt size={15} /> My Teams
                </button>
                <button
                    onClick={() => setTab('analyses')}
                    className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold uppercase tracking-wide transition-all ${tab === 'analyses' ? 'bg-[#00ff87] text-[#37003c]' : 'text-white/50 hover:text-white'}`}
                >
                    <Activity size={15} /> Past Analysis
                </button>
            </div>

            {/* My Teams Tab */}
            {tab === 'teams' && (
                <>
                    <h2 className="text-3xl font-black text-white tracking-tight">My Teams</h2>

                    {/* Team Search */}
                    <div className="relative">
                        <div className="flex items-center gap-3 bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 focus-within:border-[#00ff87]/50 transition-colors">
                            <Search size={18} className="text-gray-500 flex-shrink-0" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search any FPL team by name..."
                                className="bg-transparent text-white placeholder-gray-500 flex-1 outline-none text-sm"
                            />
                            {searchQuery && (
                                <button onClick={() => { setSearchQuery(''); setSearchResults([]); }} className="text-gray-500 hover:text-white">
                                    <X size={16} />
                                </button>
                            )}
                            {searchLoading && <Loader2 size={16} className="animate-spin text-[#00ff87]" />}
                        </div>
                        {searchResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-xl overflow-hidden z-20 shadow-xl max-h-96 overflow-y-auto">
                                {searchResults.map(r => (
                                    <button
                                        key={r.team_id}
                                        onClick={() => { navigate(`/analyse?entry=${r.team_id}`); setSearchQuery(''); setSearchResults([]); }}
                                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800 transition-colors text-left border-b border-slate-800 last:border-0"
                                    >
                                        <div>
                                            <div className="text-white font-semibold text-sm">{r.team_name}</div>
                                            <div className="text-gray-500 text-xs">{r.manager_name}</div>
                                        </div>
                                        <ArrowRight size={16} className="text-gray-600" />
                                    </button>
                                ))}
                                {searchHasMore && (
                                    <button
                                        onClick={loadMoreResults}
                                        disabled={loadingMore}
                                        className="w-full px-4 py-3 text-[#00ff87] text-xs font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                                    >
                                        {loadingMore ? <Loader2 size={13} className="animate-spin" /> : null}
                                        {loadingMore ? 'Loading...' : 'Load more results'}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                    {teamsError && <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl">{teamsError}</div>}
                    {teamsLoading ? (
                        <div className="flex justify-center items-center h-48"><Loader2 className="w-8 h-8 text-[#00ff87] animate-spin" /></div>
                    ) : teams.length === 0 ? (
                        <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-8 text-center text-gray-400">
                            <p className="text-xl font-bold mb-2">No Saved Teams</p>
                            <p>Go to the Analyse page and click "Save Team" to add one here.</p>
                        </div>
                    ) : (() => {
                        const lastLoadedId = Number(localStorage.getItem('last_analysed_entry')) || null;
                        const connectedTeams = teams.filter(t => { try { return JSON.parse(t.team_data).entry_id === fplEntryId; } catch { return false; } });
                        const otherTeams = teams.filter(t => { try { return JSON.parse(t.team_data).entry_id !== fplEntryId; } catch { return true; } });
                        const prevConnectedTeams = otherTeams.filter(t => !!t.last_connected_at);
                        const neverConnectedTeams = otherTeams.filter(t => !t.last_connected_at);
                        const currentlyLoadedTeam = lastLoadedId && lastLoadedId !== fplEntryId
                            ? otherTeams.find(t => { try { return JSON.parse(t.team_data).entry_id === lastLoadedId; } catch { return false; } }) ?? null
                            : null;

                        const formatDate = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

                        const renderTeamCard = (team: typeof teams[0]) => {
                            const data = JSON.parse(team.team_data);
                            const isConnected = fplConnected && fplEntryId !== null && data.entry_id === fplEntryId;
                            const isAutopilot = isConnected && user?.autopilot_enabled;
                            const connectedAtStr = isConnected && user?.fpl_connected_at
                                ? formatDate(user.fpl_connected_at)
                                : team.last_connected_at ? formatDate(team.last_connected_at) : null;
                            return (
                                <div
                                    key={team.id}
                                    onClick={() => navigate(`/analyse?entry=${data.entry_id}`)}
                                    className={`bg-slate-900/50 border rounded-xl p-4 flex items-center justify-between hover:bg-slate-800 transition-all cursor-pointer group ${isConnected ? 'border-[#00ff87]/50 hover:border-[#00ff87]' : 'border-slate-700 hover:border-[#00ff87]/50'}`}
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <div className="font-bold text-white text-lg group-hover:text-[#00ff87] transition-colors">{team.name.replace(/\s*\(GW\d+\)$/, '')}</div>
                                            {isConnected && (
                                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#00ff87]/10 border border-[#00ff87]/30 text-[#00ff87] text-xs font-bold">
                                                    <Wifi size={10} /> Connected
                                                </span>
                                            )}
                                            {isAutopilot && (
                                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#02efff]/10 border border-[#02efff]/30 text-[#02efff] text-xs font-bold">
                                                    <Brain size={10} /> Auto-Pilot
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-gray-400 mt-1">Manager: {data.manager || 'Unknown'}</div>
                                        {connectedAtStr && (
                                            <div className="text-xs text-gray-500 mt-0.5">{isConnected ? 'Last connected:' : 'Previously connected:'} {connectedAtStr}</div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3 ml-3">
                                        <button onClick={(e) => { e.stopPropagation(); setTeamToDelete(team.id); }} className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all" title="Remove Team">
                                            <Trash2 size={18} />
                                        </button>
                                        <ArrowRight className="text-gray-600 group-hover:text-[#00ff87] transition-colors" />
                                    </div>
                                </div>
                            );
                        };

                        return (
                            <div className="space-y-8">
                                {connectedTeams.length > 0 && (
                                    <div>
                                        <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">Current Connected Team</h3>
                                        <div className="grid gap-4">{connectedTeams.map(renderTeamCard)}</div>
                                    </div>
                                )}
                                {currentlyLoadedTeam && (
                                    <div>
                                        <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">Currently Loaded</h3>
                                        <div className="grid gap-4">{renderTeamCard(currentlyLoadedTeam)}</div>
                                    </div>
                                )}
                                {prevConnectedTeams.filter(t => t.id !== currentlyLoadedTeam?.id).length > 0 && (
                                    <div>
                                        <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">Previously Connected</h3>
                                        <div className="grid gap-4">{prevConnectedTeams.filter(t => t.id !== currentlyLoadedTeam?.id).map(renderTeamCard)}</div>
                                    </div>
                                )}
                                {neverConnectedTeams.filter(t => t.id !== currentlyLoadedTeam?.id).length > 0 && (
                                    <div>
                                        <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">Never Connected</h3>
                                        <div className="grid gap-4">{neverConnectedTeams.filter(t => t.id !== currentlyLoadedTeam?.id).map(renderTeamCard)}</div>
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </>
            )}

            {/* Past Analysis Tab */}
            {tab === 'analyses' && (
                <>
                    <h2 className="text-3xl font-black text-white tracking-tight">Past Analysis</h2>
                    {analysesError && <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl">{analysesError}</div>}
                    {analysesLoading ? (
                        <div className="flex justify-center items-center h-48"><Loader2 className="w-8 h-8 text-[#00ff87] animate-spin" /></div>
                    ) : analyses.length === 0 ? (
                        <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-8 text-center text-gray-400">
                            <p className="text-xl font-bold mb-2">No Saved Analyses</p>
                            <p>Run the Wolf's analysis on your team and it will be saved here automatically.</p>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {analyses.map((a) => (
                                <div key={a.id} className="bg-slate-900/50 border border-slate-700 rounded-xl overflow-hidden">
                                    <div
                                        className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-800 transition-all group"
                                        onClick={() => setExpandedAnalysis(expandedAnalysis === a.id ? null : a.id)}
                                    >
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <div className="font-bold text-white group-hover:text-[#00ff87] transition-colors">
                                                    {a.team_name} {a.gameweek ? `— GW${a.gameweek}` : ''}
                                                </div>
                                                {a.ai_provider && (
                                                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${a.ai_provider === 'gemini' ? 'text-blue-300 border-blue-500/40 bg-blue-500/10' : 'text-orange-300 border-orange-500/40 bg-orange-500/10'}`}>
                                                        {a.ai_provider === 'gemini' ? 'Gemini' : 'Claude'}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-gray-500">{new Date(a.created_at).toLocaleString()}</div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button onClick={(e) => { e.stopPropagation(); setAnalysisToDelete(a.id); }} className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all">
                                                <Trash2 size={18} />
                                            </button>
                                            <span className={`text-gray-400 text-lg transition-transform ${expandedAnalysis === a.id ? 'rotate-90' : ''}`}>›</span>
                                        </div>
                                    </div>
                                    {expandedAnalysis === a.id && (
                                        <div className="border-t border-white/10 p-6 bg-[#220025]/50">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    h1: ({ node, ...props }: any) => <h1 className="text-xl font-black text-[#02efff] mb-3 uppercase tracking-tight border-b border-white/10 pb-2" {...props} />,
                                                    h2: ({ node, ...props }: any) => <h2 className="text-lg font-bold text-[#00ff87] mt-5 mb-2 uppercase tracking-wide" {...props} />,
                                                    h3: ({ node, ...props }: any) => <h3 className="text-base font-bold text-white mt-3 mb-1" {...props} />,
                                                    p: ({ node, ...props }: any) => <p className="text-white/80 text-sm leading-relaxed mb-3" {...props} />,
                                                    ul: ({ node, ...props }: any) => <ul className="list-disc list-inside space-y-1 mb-3 text-white/80 text-sm" {...props} />,
                                                    ol: ({ node, ...props }: any) => <ol className="list-decimal list-inside space-y-1 mb-3 text-white/80 text-sm" {...props} />,
                                                    li: ({ node, ...props }: any) => <li className="pl-2" {...props} />,
                                                    strong: ({ node, ...props }: any) => <strong className="text-[#02efff] font-bold" {...props} />,
                                                    table: ({ node, ...props }: any) => <div className="overflow-x-auto mb-4 rounded-lg border border-white/10"><table className="min-w-full divide-y divide-white/10 text-sm" {...props} /></div>,
                                                    thead: ({ node, ...props }: any) => <thead className="bg-white/10" {...props} />,
                                                    th: ({ node, ...props }: any) => <th className="px-3 py-2 text-left text-xs font-black text-[#00ff87] uppercase tracking-wider" {...props} />,
                                                    td: ({ node, ...props }: any) => <td className="px-3 py-2 text-white/80 whitespace-normal break-words border-t border-white/5" {...props} />,
                                                    blockquote: ({ node, ...props }: any) => <blockquote className="border-l-4 border-[#02efff] pl-4 italic text-white/60 my-3" {...props} />,
                                                }}
                                            >
                                                {a.analysis_text}
                                            </ReactMarkdown>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Delete Team Confirmation */}
            {teamToDelete !== null && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-sm w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-bold text-white mb-2">Remove Team?</h3>
                        <p className="text-gray-400 text-sm mb-4">Are you sure you want to remove this team from your saved list?</p>
                        <div className="flex items-center justify-end gap-3">
                            <button onClick={() => setTeamToDelete(null)} className="px-4 py-2 text-sm font-bold text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700">Cancel</button>
                            <button onClick={confirmDeleteTeam} className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-500 rounded-lg">Remove</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Analysis Confirmation */}
            {analysisToDelete !== null && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-sm w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-bold text-white mb-2">Delete Analysis?</h3>
                        <p className="text-gray-400 text-sm mb-4">This will permanently delete this saved analysis.</p>
                        <div className="flex items-center justify-end gap-3">
                            <button onClick={() => setAnalysisToDelete(null)} className="px-4 py-2 text-sm font-bold text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700">Cancel</button>
                            <button onClick={confirmDeleteAnalysis} className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-500 rounded-lg">Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyTeamsView;
