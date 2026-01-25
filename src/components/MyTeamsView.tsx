import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2, Trash2, ArrowRight } from 'lucide-react';

interface SavedTeam {
    id: number;
    name: string;
    team_data: string; // JSON string
    created_at: string;
}

const MyTeamsView: React.FC = () => {
    const { user, token } = useAuth();
    const navigate = useNavigate();
    const [teams, setTeams] = useState<SavedTeam[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [teamToDelete, setTeamToDelete] = useState<number | null>(null);

    const fetchTeams = async () => {
        if (!user || !token) {
            setLoading(false);
            return;
        }

        try {
            const res = await fetch('/api/user/teams', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                setTeams(data);
            } else {
                setError('Failed to fetch teams');
            }
        } catch (e) {
            console.error(e);
            setError('Error loading teams');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTeams();
    }, [user, token]);

    const requestDelete = (id: number) => {
        setTeamToDelete(id);
    };

    const confirmDelete = async () => {
        if (teamToDelete === null) return;
        const id = teamToDelete;

        try {
            const res = await fetch(`/api/user/teams/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                setTeams(prev => prev.filter(t => t.id !== id));
            } else {
                alert('Failed to delete team');
            }
        } catch (e) {
            console.error(e);
            alert('Error deleting team');
        } finally {
            setTeamToDelete(null);
        }
    };

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center h-96 text-gray-400">
                <p>Please login to view your saved teams.</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center h-96">
                <Loader2 className="w-8 h-8 text-fpl-green animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in zoom-in duration-500 py-8 relative">
            <h2 className="text-3xl font-black text-white tracking-tight">My Teams</h2>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl">
                    {error}
                </div>
            )}

            {teams.length === 0 ? (
                <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-8 text-center text-gray-400">
                    <p className="text-xl font-bold mb-2">No Saved Teams</p>
                    <p>Go to the Analyse page and click "Save Team" to add one here.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {teams.map((team) => {
                        const data = JSON.parse(team.team_data);
                        return (
                            <div
                                key={team.id}
                                onClick={() => navigate(`/analyse?entry=${data.entry_id}`)}
                                className="bg-slate-900/50 border border-slate-700 rounded-xl p-4 flex items-center justify-between hover:bg-slate-800 hover:border-fpl-green/50 transition-all cursor-pointer group"
                            >
                                <div>
                                    <div className="font-bold text-white text-lg group-hover:text-fpl-green transition-colors">{team.name.replace(/\s*\(GW\d+\)$/, '')}</div>
                                    <div className="text-xs text-gray-500">
                                        Saved on {new Date(team.created_at).toLocaleDateString()}
                                    </div>
                                    <div className="text-xs text-gray-400 mt-1">
                                        Manager: {data.manager || 'Unknown'}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            requestDelete(team.id);
                                        }}
                                        className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                        title="Remove Team"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                    <ArrowRight className="text-gray-600 group-hover:text-fpl-green transition-colors" />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Custom Delete Confirmation Modal */}
            {teamToDelete !== null && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-sm w-full p-6 shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
                        <div className="mb-4">
                            <h3 className="text-xl font-bold text-white mb-2">Remove Team?</h3>
                            <p className="text-gray-400 text-sm">
                                Are you sure you want to remove this team from your saved list?
                            </p>
                        </div>
                        <div className="flex items-center justify-end gap-3">
                            <button
                                onClick={() => setTeamToDelete(null)}
                                className="px-4 py-2 text-sm font-bold text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors shadow-lg shadow-red-600/20"
                            >
                                Remove
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyTeamsView;
