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

    useEffect(() => {
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

        fetchTeams();
    }, [user, token]);

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
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in zoom-in duration-500 py-8">
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
                                    <div className="font-bold text-white text-lg group-hover:text-fpl-green transition-colors">{team.name}</div>
                                    <div className="text-xs text-gray-500">
                                        Saved on {new Date(team.created_at).toLocaleDateString()}
                                    </div>
                                    <div className="text-xs text-gray-400 mt-1">
                                        Manager: {data.manager || 'Unknown'}
                                    </div>
                                </div>
                                <ArrowRight className="text-gray-600 group-hover:text-fpl-green transition-colors" />
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default MyTeamsView;
