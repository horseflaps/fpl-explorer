import React, { useState, useEffect } from 'react';
import { Zap, Bot, Brain, Check, Loader2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { track } from '../utils/analytics';

const analysisTiers = [
    { qty: 1,  total: '£2.00',  perUnit: '£2.00',  saving: null },
    { qty: 3,  total: '£5.00',  perUnit: '£1.67',  saving: 'Save £1.00 (16% off)' },
    { qty: 5,  total: '£7.50',  perUnit: '£1.50',  saving: 'Save £2.50 (25% off)' },
    { qty: 10, total: '£12.50', perUnit: '£1.25',  saving: 'Save £7.50 (37% off)' },
    { qty: 50, total: '£50.00', perUnit: '£1.00',  saving: 'Save £50.00 (50% off)' },
];

const membershipTiersMeta = [
    {
        id: 1,
        icon: Zap,
        name: 'Scout',
        price: 'Free',
        sub: 'Forever',
        color: 'text-gray-400',
        border: 'border-slate-700',
        bg: 'bg-slate-900/50',
        badge: null,
        plan: null,
        description: 'Get Wolf-grade insights on demand. You run the analysis, review the recommendations, and make changes yourself on the FPL website. The perfect starting point for data-driven team management.',
        features: [
            'Full Wolf analysis on demand',
            'Transfer recommendations & captaincy picks',
            'Market sentiment & fixture analysis',
            'You apply changes manually on FPL',
            'Full fixture list',
            'Player Stats',
        ],
    },
    {
        id: 2,
        icon: Bot,
        name: 'Co-Pilot',
        sub: 'per month',
        color: 'text-[#02efff]',
        border: 'border-[#02efff]/40',
        bg: 'bg-[#02efff]/5',
        badge: 'Popular',
        plan: 'copilot',
        description: 'You decide when to strike — the Wolf executes. Trigger the analysis whenever you\'re ready and the Wolf applies the optimal transfers directly to your FPL team. All the control, none of the admin.',
        features: [
            'Everything in Scout',
            'Wolf applies transfers to your FPL team',
            'You control when analysis runs',
            'Transfer confirmation before execution',
            'PDF of Wolf analysis sent to your email',
        ],
    },
    {
        id: 3,
        icon: Brain,
        name: 'Autopilot',
        sub: 'per month',
        color: 'text-[#00ff87]',
        border: 'border-[#00ff87]/40',
        bg: 'bg-[#00ff87]/5',
        badge: 'Best Value',
        plan: 'autopilot',
        description: 'Fully hands-off FPL. The Wolf analyses your squad before every gameweek deadline, makes the optimal changes automatically, and sends you a detailed email log of every decision taken. Just check your inbox on matchday.',
        features: [
            'Everything in Co-Pilot',
            'Automatic analysis before every GW deadline',
            'Transfers applied without you lifting a finger',
            'Email summary of every change made',
        ],
    },
];

const PricingView: React.FC = () => {
    const { user, token, refreshUser } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const userTier = user?.membership_tier ?? 0;
    const [activeSection, setActiveSection] = useState<'membership' | 'credits'>(
        searchParams.get('tab') === 'credits' ? 'credits' : 'membership'
    );

    const [tierPrices, setTierPrices] = useState<Record<number, number>>({});
    useEffect(() => {
        fetch('/api/tiers')
            .then(r => r.json())
            .then((rows: { id: number; price_gbp: number }[]) => {
                const map: Record<number, number> = {};
                rows.forEach(r => { map[r.id] = r.price_gbp; });
                setTierPrices(map);
            })
            .catch(() => {});
    }, []);

    const membershipTiers = membershipTiersMeta.map(t => ({
        ...t,
        price: t.id === 1 ? 'Free' : tierPrices[t.id] != null ? `£${tierPrices[t.id].toFixed(2)}` : '...',
    }));

    const [loadingItem, setLoadingItem] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'error' } | null>(null);
    const [successModal, setSuccessModal] = useState<{
        type: 'credits' | 'subscription';
        qty?: number;
        plan?: string;
    } | null>(null);

    // Handle return from Stripe Checkout
    useEffect(() => {
        const success = searchParams.get('success');
        const cancelled = searchParams.get('cancelled');

        if (success === 'credits') {
            const qty = Number(searchParams.get('qty'));
            setSearchParams({}, { replace: true });
            refreshUser().then(() => {
                setSuccessModal({ type: 'credits', qty });
            }).catch(() => {
                setSuccessModal({ type: 'credits', qty });
            });
        } else if (success === 'subscription') {
            const plan = searchParams.get('plan') ?? '';
            setSearchParams({}, { replace: true });
            refreshUser().then(() => {
                setSuccessModal({ type: 'subscription', plan });
            }).catch(() => {
                setSuccessModal({ type: 'subscription', plan });
            });
        } else if (cancelled) {
            setToast({ message: 'Payment cancelled — no charge was made.', type: 'error' });
            setSearchParams({}, { replace: true });
        }
    }, []);

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 6000);
        return () => clearTimeout(t);
    }, [toast]);

    const startCheckout = async (type: 'credits' | 'subscription', payload: { qty?: number; plan?: string }) => {
        if (!user || !token) {
            setToast({ message: 'Sign in to purchase.', type: 'error' });
            return;
        }
        const key = type === 'credits' ? `credits-${payload.qty}` : `sub-${payload.plan}`;
        track('Checkout Started', { type, plan: payload.plan ?? null, qty: payload.qty ?? null });
        setLoadingItem(key);
        try {
            const res = await fetch('/api/stripe/create-checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ type, ...payload }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to start checkout.');
            window.location.href = data.url;
        } catch (err: any) {
            setToast({ message: err.message, type: 'error' });
            setLoadingItem(null);
        }
    };

    const getTierButton = (cardIndex: number, plan: string | null) => {
        const cardTier = cardIndex + 1;
        if (!user) return { label: 'Get Started', style: 'border-white/20 text-gray-300 hover:bg-white/5', action: null };
        if (cardTier === userTier) return { label: 'Current Plan', style: 'border-white/10 text-gray-500 cursor-default', action: null, disabled: true };
        if (cardTier > userTier && plan) return { label: 'Upgrade', style: 'bg-fpl-green text-slate-900 border-fpl-green hover:bg-fpl-green/90 shadow-[0_0_15px_rgba(0,255,135,0.2)]', action: () => startCheckout('subscription', { plan }) };
        if (cardTier < userTier) return { label: 'Downgrade', style: 'border-slate-700 text-gray-500 hover:bg-white/5', action: null };
        return { label: 'Get Started', style: 'border-white/20 text-gray-300 hover:bg-white/5', action: null };
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in zoom-in duration-500 py-8">

            {/* Inner section tabs */}
            <div className="flex gap-1 bg-slate-900/60 border border-white/10 rounded-xl p-1 w-fit">
                <button
                    onClick={() => setActiveSection('membership')}
                    className={`px-5 py-2 rounded-lg text-sm font-black uppercase tracking-wide transition-all ${activeSection === 'membership' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    Membership Tiers
                </button>
                <button
                    onClick={() => setActiveSection('credits')}
                    className={`px-5 py-2 rounded-lg text-sm font-black uppercase tracking-wide transition-all ${activeSection === 'credits' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    Analysis Credits
                </button>
            </div>

            {/* Error toast */}
            {toast && (
                <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl border bg-red-950/90 border-red-500/30 text-red-400 text-sm font-semibold shadow-xl backdrop-blur-sm">
                    {toast.message}
                </div>
            )}

            {/* Purchase success modal */}
            {successModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl p-8 max-w-sm w-full shadow-2xl relative">
                        <button onClick={() => setSuccessModal(null)} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">
                            <X size={18} />
                        </button>

                        {/* Icon */}
                        <div className="w-14 h-14 rounded-full bg-[#00ff87]/10 border border-[#00ff87]/30 flex items-center justify-center mx-auto mb-5">
                            <Check size={28} className="text-[#00ff87]" />
                        </div>

                        <h2 className="text-2xl font-black text-white text-center mb-1">Payment Successful</h2>

                        {successModal.type === 'credits' && (
                            <>
                                <p className="text-gray-400 text-sm text-center mb-6">
                                    {successModal.qty} analysis credit{successModal.qty !== 1 ? 's' : ''} added to your account.
                                </p>
                                <div className="bg-slate-800/50 border border-white/5 rounded-xl p-4 text-center mb-6">
                                    <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-1">Credits remaining</p>
                                    <p className="text-4xl font-black text-[#00ff87]">{user?.credits ?? 0}</p>
                                </div>
                                <p className="text-xs text-gray-600 text-center">Credits never expire — use them whenever you're ready.</p>
                            </>
                        )}

                        {successModal.type === 'subscription' && (() => {
                            const planName = successModal.plan === 'autopilot' ? 'Autopilot' : 'Co-Pilot';
                            const planColor = successModal.plan === 'autopilot' ? 'text-[#00ff87]' : 'text-[#02efff]';
                            const planIcon = successModal.plan === 'autopilot' ? Brain : Bot;
                            const PlanIcon = planIcon;
                            return (
                                <>
                                    <p className="text-gray-400 text-sm text-center mb-6">
                                        Your membership has been activated.
                                    </p>
                                    <div className="bg-slate-800/50 border border-white/5 rounded-xl p-4 text-center mb-6">
                                        <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-2">Active plan</p>
                                        <div className={`flex items-center justify-center gap-2 ${planColor}`}>
                                            <PlanIcon size={20} />
                                            <span className="text-xl font-black uppercase tracking-wide">{planName}</span>
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-600 text-center">You can manage your membership at any time from My Account.</p>
                                </>
                            );
                        })()}

                        <button
                            onClick={() => setSuccessModal(null)}
                            className="mt-6 w-full py-3 rounded-xl bg-[#00ff87] text-slate-900 font-black text-sm uppercase tracking-wide hover:bg-[#00ff87]/90 transition-all"
                        >
                            Let's Go
                        </button>
                    </div>
                </div>
            )}

            {/* Membership Tiers */}
            {activeSection === 'membership' && <div>
                <h2 className="text-3xl font-black text-white tracking-tight mb-1">Membership Tiers</h2>
                <p className="text-gray-400 text-sm mb-6">Choose how much of the work you want the Wolf to handle.</p>

                <div className="grid md:grid-cols-3 gap-5">
                    {membershipTiers.map((tier, i) => {
                        const btn = getTierButton(i, tier.plan);
                        const isLoading = loadingItem === `sub-${tier.plan}`;
                        return (
                        <div key={tier.name} className={`relative rounded-xl border ${tier.border} ${tier.bg} p-6 flex flex-col gap-4`}>
                            {tier.badge && (
                                <span className={`absolute top-4 right-4 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${tier.color} border ${tier.border}`}>
                                    {tier.badge}
                                </span>
                            )}

                            <div className="flex items-center gap-3">
                                <tier.icon size={22} className={tier.color} />
                                <span className={`text-lg font-black uppercase tracking-wide ${tier.color}`}>{tier.name}</span>
                            </div>

                            <div>
                                <span className="text-3xl font-black text-white">{tier.price}</span>
                                <span className="text-gray-400 text-sm ml-1">{tier.sub}</span>
                                {tier.alt && (
                                    <div className="text-xs text-[#00ff87] font-semibold mt-0.5">{tier.alt}</div>
                                )}
                            </div>

                            <p className="text-gray-400 text-sm leading-relaxed">{tier.description}</p>

                            <ul className="space-y-2 mt-auto">
                                {tier.features.map((f) => (
                                    <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                                        <Check size={14} className={`${tier.color} shrink-0 mt-0.5`} />
                                        {f}
                                    </li>
                                ))}
                            </ul>

                            <button
                                disabled={btn.disabled || isLoading || !btn.action}
                                onClick={() => btn.action?.()}
                                className={`mt-2 w-full py-2.5 rounded-lg font-black text-sm uppercase tracking-wide border transition-all flex items-center justify-center gap-2 ${btn.style}`}
                            >
                                {isLoading && <Loader2 size={14} className="animate-spin" />}
                                {isLoading ? 'Redirecting...' : btn.label}
                            </button>
                        </div>
                        );
                    })}
                </div>
            </div>}

            {/* Analysis Credits */}
            {activeSection === 'credits' && <div>
                <h2 className="text-3xl font-black text-white tracking-tight mb-1">Analysis Credits</h2>
                <p className="text-gray-400 text-sm mb-6">Buy analysis credits in bulk and save. Credits never expire.</p>

                <div className="bg-slate-900/50 border border-slate-700 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-white/5">
                            <tr>
                                <th className="px-5 py-3 text-left text-xs font-black text-[#00ff87] uppercase tracking-wider">Credits</th>
                                <th className="px-5 py-3 text-left text-xs font-black text-[#00ff87] uppercase tracking-wider">Total Price</th>
                                <th className="px-5 py-3 text-left text-xs font-black text-[#00ff87] uppercase tracking-wider">Per Analysis</th>
                                <th className="px-5 py-3 text-left text-xs font-black text-[#00ff87] uppercase tracking-wider">Saving</th>
                                <th className="px-5 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {analysisTiers.map((tier) => {
                                const isLoading = loadingItem === `credits-${tier.qty}`;
                                return (
                                <tr key={tier.qty} className="hover:bg-white/5 transition-colors">
                                    <td className="px-5 py-3 font-bold text-white">{tier.qty}</td>
                                    <td className="px-5 py-3 text-white">{tier.total}</td>
                                    <td className="px-5 py-3 text-gray-300">{tier.perUnit}</td>
                                    <td className="px-5 py-3">
                                        {tier.saving
                                            ? <span className="text-[#00ff87] font-semibold">{tier.saving}</span>
                                            : <span className="text-gray-600">—</span>
                                        }
                                    </td>
                                    <td className="px-5 py-3 text-right">
                                        <button
                                            disabled={isLoading || !user}
                                            onClick={() => startCheckout('credits', { qty: tier.qty })}
                                            className="flex items-center gap-1.5 ml-auto px-4 py-1.5 rounded-lg bg-[#00ff87] text-slate-900 font-black text-xs uppercase tracking-wide hover:bg-[#00ff87]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                        >
                                            {isLoading && <Loader2 size={11} className="animate-spin" />}
                                            {isLoading ? 'Loading...' : 'Buy'}
                                        </button>
                                    </td>
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {!user && (
                        <p className="text-center text-xs text-gray-600 py-3">Sign in to purchase credits.</p>
                    )}
                </div>
            </div>}

        </div>
    );
};

export default PricingView;
