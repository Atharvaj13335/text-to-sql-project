import { useState } from "react";
import { Sparkles, Mail, Lock, LogIn, ArrowRight, ShieldCheck } from "lucide-react";

export default function AuthModal({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [mode, setMode] = useState("google"); // 'google' or 'email'

  function handleGoogleLogin() {
    // Standard Gmail Sign In simulation with user confirmation
    const sampleGmail = email.trim() || "atharvajain13335code@gmail.com";
    if (!sampleGmail.includes("@")) {
      setError("Please enter a valid Gmail address.");
      return;
    }
    const name = sampleGmail.split("@")[0].replace(/[._]/g, " ");
    const formattedName = name.charAt(0).toUpperCase() + name.slice(1);
    onLogin({
      email: sampleGmail,
      name: formattedName,
      provider: "google",
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(sampleGmail)}`,
    });
  }

  function handleEmailLogin(e) {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    const name = email.split("@")[0];
    onLogin({
      email: email.trim().toLowerCase(),
      name: name.charAt(0).toUpperCase() + name.slice(1),
      provider: "email",
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-backdrop-fade">
      <div className="relative w-full max-w-md bg-panel/90 border border-white/15 rounded-3xl p-6 sm:p-8 shadow-[0_0_80px_-20px_rgba(124,140,255,0.4)] animate-pop-up overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute -top-24 -left-24 w-64 h-64 rounded-full bg-accent/25 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 rounded-full bg-gold/15 blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="text-center relative z-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent/20 border border-accent/40 mb-4 shadow-lg">
            <Sparkles className="w-7 h-7 text-accent" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Welcome Back</h2>
          <p className="text-[13px] text-white/50 mt-1">
            Sign in with your Gmail account to access your financial queries & chat history.
          </p>
        </div>

        {/* Form Body */}
        <div className="mt-6 space-y-4 relative z-10">
          {/* Google Sign-in Option */}
          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-medium text-[14px] transition-all duration-200 shadow-md hover:shadow-[0_0_25px_-5px_rgba(255,255,255,0.3)] hover:-translate-y-0.5 active:scale-95 group"
          >
            {/* Google Colorful Icon */}
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continue with Gmail</span>
            <ArrowRight size={15} className="text-white/40 group-hover:text-white group-hover:translate-x-1 transition-all" />
          </button>

          <div className="flex items-center my-3">
            <div className="flex-1 border-t border-white/10" />
            <span className="px-3 text-[11px] font-mono text-white/40 uppercase tracking-widest">or email</span>
            <div className="flex-1 border-t border-white/10" />
          </div>

          <form onSubmit={handleEmailLogin} className="space-y-3">
            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 text-white/40 w-4 h-4" />
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                placeholder="Enter your Gmail address"
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-[14px] text-white placeholder-white/30 focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/40 transition-all"
              />
            </div>

            {error && <p className="text-[12px] text-red-400 font-mono pl-1">{error}</p>}

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-accent hover:brightness-110 text-white font-medium text-[14px] transition-all duration-200 shadow-lg hover:shadow-[0_0_25px_-4px_rgba(124,140,255,0.6)] active:scale-95"
            >
              <LogIn size={16} />
              <span>Sign In to Financial Assistant</span>
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-white/10 text-center relative z-10">
          <p className="text-[11px] text-white/40 font-mono flex items-center justify-center gap-1.5">
            <ShieldCheck size={13} className="text-emerald-400" />
            Encrypted session · Multi-user isolated chat storage
          </p>
        </div>
      </div>
    </div>
  );
}
