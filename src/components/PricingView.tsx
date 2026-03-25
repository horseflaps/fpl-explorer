import React from 'react';
import { Zap, Bot, Brain, Check } from 'lucide-react';

const analysisTiers = [
    { qty: 1,  total: '£2.00',  perUnit: '£2.00',  saving: null },
    { qty: 3,  total: '£5.00',  perUnit: '£1.67',  saving: 'Save £1.00 (16% off)' },
    { qty: 5,  total: '£7.50',  perUnit: '£1.50',  saving: 'Save £2.50 (25% off)' },
    { qty: 10, total: '£12.50', perUnit: '£1.25',  saving: 'Save £7.50 (37% off)' },
    { qty: 50, total: '£50.00', perUnit: '£1.00',  saving: 'Save £50.00 (50% off)' },
];

const membershipTiers = [
    {
        icon: Zap,
        name: 'Scout',
        price: 'Free',
        sub: 'Forever',
        color: 'text-gray-400',
        border: 'border-slate-700',
        bg: 'bg-slate-900/50',
        badge: null,
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
        icon: Bot,
        name: 'Co-Pilot',
        price: '£5',
        sub: 'per month',
        color: 'text-[#02efff]',
        border: 'border-[#02efff]/40',
        bg: 'bg-[#02efff]/5',
        badge: 'Popular',
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
        icon: Brain,
        name: 'Autopilot',
        price: '£10',
        sub: 'per month',
        alt: '£90 / season',
        color: 'text-[#00ff87]',
        border: 'border-[#00ff87]/40',
        bg: 'bg-[#00ff87]/5',
        badge: 'Best Value',
        description: 'Fully hands-off FPL. The Wolf analyses your squad before every gameweek deadline, makes the optimal changes automatically, and sends you a detailed email log of every decision taken. Just check your inbox on matchday.',
        features: [
            'Everything in Co-Pilot',
            'Automatic analysis before every GW deadline',
            'Transfers applied without you lifting a finger',
            'Email summary of every change made',
            'Season pass saves you £30 vs monthly',
        ],
    },
];

const PricingView: React.FC = () => {
    return (
        <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in zoom-in duration-500 py-8">

            {/* Analysis Credits */}
            <div>
                <h2 className="text-3xl font-black text-white tracking-tight mb-1">Analyse Team</h2>
                <p className="text-gray-400 text-sm mb-6">Buy analysis credits in bulk and save. Credits never expire.</p>

                <div className="bg-slate-900/50 border border-slate-700 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-white/5">
                            <tr>
                                <th className="px-5 py-3 text-left text-xs font-black text-[#00ff87] uppercase tracking-wider">Credits</th>
                                <th className="px-5 py-3 text-left text-xs font-black text-[#00ff87] uppercase tracking-wider">Total Price</th>
                                <th className="px-5 py-3 text-left text-xs font-black text-[#00ff87] uppercase tracking-wider">Per Analysis</th>
                                <th className="px-5 py-3 text-left text-xs font-black text-[#00ff87] uppercase tracking-wider">Saving</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {analysisTiers.map((tier) => (
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
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Membership Tiers */}
            <div>
                <h2 className="text-3xl font-black text-white tracking-tight mb-1">Membership</h2>
                <p className="text-gray-400 text-sm mb-6">Choose how much of the work you want the Wolf to handle.</p>

                <div className="grid md:grid-cols-3 gap-5">
                    {membershipTiers.map((tier) => (
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

                            <button className={`mt-2 w-full py-2.5 rounded-lg font-black text-sm uppercase tracking-wide border ${tier.border} ${tier.color} hover:bg-white/5 transition-all`}>
                                Get Started
                            </button>
                        </div>
                    ))}
                </div>
            </div>

        </div>
    );
};

export default PricingView;
