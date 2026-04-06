import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Mail, LogIn } from 'lucide-react';

const VerifiedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isAuthenticated, isVerified, setIsLoginOpen } = useAuth();

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-start justify-center pt-16 p-6">
                <div className="bg-slate-900/50 border border-white/10 rounded-3xl p-10 max-w-sm w-full text-center space-y-5">
                    <div className="w-14 h-14 bg-fpl-green/10 border border-fpl-green/30 rounded-2xl flex items-center justify-center mx-auto">
                        <LogIn className="text-fpl-green w-7 h-7" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-white">Sign in required</h2>
                        <p className="text-gray-400 text-sm mt-2">You need an account to access this page.</p>
                    </div>
                    <button
                        onClick={() => setIsLoginOpen(true)}
                        className="w-full py-3 bg-fpl-green text-slate-900 font-black text-sm uppercase tracking-wider rounded-xl hover:bg-fpl-green/90 transition-all"
                    >
                        Sign In / Sign Up
                    </button>
                </div>
            </div>
        );
    }

    if (!isVerified) {
        return (
            <div className="min-h-screen flex items-start justify-center pt-16 p-6">
                <div className="bg-[#160020] border border-[#e90052]/30 rounded-3xl p-10 max-w-sm w-full text-center space-y-5 shadow-[0_0_40px_rgba(233,0,82,0.1)]">
                    <div className="w-14 h-14 bg-[#e90052]/10 border border-[#e90052]/30 rounded-2xl flex items-center justify-center mx-auto">
                        <Mail className="text-[#e90052] w-7 h-7" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-white">Activate your account</h2>
                        <p className="text-gray-400 text-sm mt-2 leading-relaxed">
                            Check your inbox for the activation email and click the link to unlock full access.
                        </p>
                    </div>
                    <p className="text-gray-600 text-xs">Didn't receive it? Check your spam folder.</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};

export default VerifiedRoute;
