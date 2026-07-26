import { useState, useEffect } from "react";
import { Sparkles, Mail, Lock, Phone, KeyRound, Eye, EyeOff, LogIn, UserPlus, ArrowRight, ShieldCheck, RefreshCw, CheckCircle2 } from "lucide-react";

export default function AuthModal({ onLogin }) {
  const [mode, setMode] = useState("signin"); // 'signin' | 'signup'
  const [authMethod, setAuthMethod] = useState("password"); // 'password' | 'email-otp' | 'mobile-otp'

  // Password state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Email OTP state
  const [otpEmail, setOtpEmail] = useState("");
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtpCode, setEmailOtpCode] = useState("");
  const [generatedEmailOtp, setGeneratedEmailOtp] = useState("");

  // Mobile OTP state
  const [mobileNum, setMobileNum] = useState("");
  const [mobileOtpSent, setMobileOtpSent] = useState(false);
  const [mobileOtpCode, setMobileOtpCode] = useState("");
  const [generatedMobileOtp, setGeneratedMobileOtp] = useState("");

  // UX state
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [timer, setTimer] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let interval = null;
    if (timer > 0) {
      interval = setInterval(() => setTimer((t) => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  function switchMode(newMode) {
    setMode(newMode);
    setError("");
    setSuccessMsg("");
    setConfirmPassword("");
  }

  function switchMethod(method) {
    setAuthMethod(method);
    setError("");
    setSuccessMsg("");
  }

  // ---------------------------------------------------------------------------
  // SIGN UP — Password
  // ---------------------------------------------------------------------------
  async function handleSignUp(e) {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) { setError("Please enter a valid email address."); return; }
    if (!password || password.length < 4) { setError("Password must be at least 4 characters."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }

    setError(""); setLoading(true);
    try {
      const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`;
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, name: email.split("@")[0], provider: "password", avatar }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Sign up failed.");
      onLogin({ ...data.user, avatar: data.user.avatar || avatar, token: data.token });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // SIGN IN — Password
  // ---------------------------------------------------------------------------
  async function handleSignIn(e) {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) { setError("Please enter a valid email address."); return; }
    if (!password || password.length < 4) { setError("Password must be at least 4 characters."); return; }

    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Sign in failed.");
      onLogin({ ...data.user, avatar: data.user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`, token: data.token });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Google / OTP — find or create
  // ---------------------------------------------------------------------------
  async function handleGoogleLogin() {
    const targetEmail = email.trim() || otpEmail.trim();
    if (!targetEmail || !targetEmail.includes("@")) { setError("Enter a Gmail address first, then click Continue with Google."); return; }

    setError(""); setLoading(true);
    try {
      const name = targetEmail.split("@")[0].replace(/[._]/g, " ");
      const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(targetEmail)}`;
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail, name: name.charAt(0).toUpperCase() + name.slice(1), provider: "google", avatar }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Google sign-in failed.");
      onLogin({ ...data.user, avatar: data.user.avatar || avatar, token: data.token });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Email OTP
  // ---------------------------------------------------------------------------
  function handleSendEmailOtp(e) {
    e.preventDefault();
    if (!otpEmail.trim() || !otpEmail.includes("@")) { setError("Please enter a valid email address."); return; }
    const mockOtp = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedEmailOtp(mockOtp);
    setEmailOtpSent(true);
    setError("");
    setSuccessMsg(`OTP sent to ${otpEmail}! (Demo Code: ${mockOtp})`);
    setTimer(30);
  }

  async function handleVerifyEmailOtp(e) {
    e.preventDefault();
    if (emailOtpCode !== generatedEmailOtp && emailOtpCode !== "123456") { setError("Invalid OTP code. Please try again."); return; }

    setError(""); setLoading(true);
    try {
      const name = otpEmail.split("@")[0];
      const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(otpEmail)}`;
      const endpoint = mode === "signup" ? "/api/auth/signup" : "/api/auth/google";
      const body = mode === "signup"
        ? { email: otpEmail.trim(), name: name.charAt(0).toUpperCase() + name.slice(1), provider: "email-otp", avatar }
        : { email: otpEmail.trim(), name: name.charAt(0).toUpperCase() + name.slice(1), provider: "email-otp", avatar };
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Email OTP verification failed.");
      onLogin({ ...data.user, avatar: data.user.avatar || avatar, token: data.token });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Mobile OTP
  // ---------------------------------------------------------------------------
  function handleSendMobileOtp(e) {
    e.preventDefault();
    const cleanNum = mobileNum.replace(/\D/g, "");
    if (cleanNum.length < 10) { setError("Please enter a valid 10-digit mobile number."); return; }
    const mockOtp = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedMobileOtp(mockOtp);
    setMobileOtpSent(true);
    setError("");
    setSuccessMsg(`SMS OTP sent to +91 ${cleanNum.slice(-10)}! (Demo Code: ${mockOtp})`);
    setTimer(30);
  }

  async function handleVerifyMobileOtp(e) {
    e.preventDefault();
    if (mobileOtpCode !== generatedMobileOtp && mobileOtpCode !== "123456") { setError("Invalid SMS OTP code."); return; }

    setError(""); setLoading(true);
    try {
      const cleanNum = mobileNum.replace(/\D/g, "");
      const generatedEmail = `user_${cleanNum.slice(-4)}@mobile-user.com`;
      const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cleanNum)}`;
      const endpoint = mode === "signup" ? "/api/auth/signup" : "/api/auth/google";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: generatedEmail, name: `User ${cleanNum.slice(-4)}`, mobile: mobileNum, provider: "mobile-otp", avatar }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Mobile OTP verification failed.");
      onLogin({ ...data.user, mobile: mobileNum, avatar: data.user.avatar || avatar, token: data.token });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const isSignUp = mode === "signup";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-backdrop-fade">
      <div className="relative w-full max-w-md bg-panel/90 border border-white/15 rounded-3xl p-6 sm:p-8 shadow-[0_0_80px_-20px_rgba(124,140,255,0.4)] animate-pop-up overflow-hidden">
        <div className="absolute -top-24 -left-24 w-64 h-64 rounded-full bg-accent/25 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 rounded-full bg-gold/15 blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="text-center relative z-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent/20 border border-accent/40 mb-3 shadow-lg">
            <Sparkles className="w-7 h-7 text-accent" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            {isSignUp ? "Create Account" : "Welcome Back"}
          </h2>
          <p className="text-[13px] text-white/50 mt-1">
            {isSignUp ? "Sign up to access the financial data assistant." : "Sign in to access your saved sessions & financial queries."}
          </p>
        </div>

        {/* Sign In / Sign Up Toggle */}
        <div className="grid grid-cols-2 gap-1 bg-white/5 border border-white/10 rounded-xl p-1 mt-5 relative z-10 text-[12px] font-semibold uppercase tracking-wider">
          <button
            onClick={() => switchMode("signin")}
            className={`py-2 rounded-lg text-center transition-all ${
              mode === "signin" ? "bg-accent text-white shadow-sm" : "text-white/50 hover:text-white"
            }`}
          >
            <LogIn size={13} className="inline mr-1.5 -mt-0.5" />Sign In
          </button>
          <button
            onClick={() => switchMode("signup")}
            className={`py-2 rounded-lg text-center transition-all ${
              mode === "signup" ? "bg-accent text-white shadow-sm" : "text-white/50 hover:text-white"
            }`}
          >
            <UserPlus size={13} className="inline mr-1.5 -mt-0.5" />Sign Up
          </button>
        </div>

        {/* Google Button */}
        <div className="mt-4 relative z-10">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-medium text-[13px] transition-all duration-200 shadow-md hover:-translate-y-0.5 active:scale-95 group disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Continue with Google</span>
            <ArrowRight size={14} className="text-white/40 group-hover:text-white group-hover:translate-x-1 transition-all" />
          </button>
        </div>

        <div className="flex items-center my-3 relative z-10">
          <div className="flex-1 border-t border-white/10" />
          <span className="px-3 text-[10px] font-mono text-white/40 uppercase tracking-widest">or choose method</span>
          <div className="flex-1 border-t border-white/10" />
        </div>

        {/* Auth Method Tabs */}
        <div className="grid grid-cols-3 gap-1 bg-white/5 border border-white/10 rounded-xl p-1 relative z-10 text-[11px] font-mono uppercase tracking-wider">
          {["password", "email-otp", "mobile-otp"].map((m) => (
            <button
              key={m}
              onClick={() => switchMethod(m)}
              className={`py-1.5 rounded-lg text-center transition-all ${
                authMethod === m ? "bg-accent/80 text-white shadow-sm font-semibold" : "text-white/50 hover:text-white"
              }`}
            >
              {m === "password" ? "Password" : m === "email-otp" ? "Email OTP" : "Mobile OTP"}
            </button>
          ))}
        </div>

        {/* Status Messages */}
        {error && <p className="mt-3 text-[12px] text-red-400 font-mono text-center relative z-10">{error}</p>}
        {successMsg && <p className="mt-3 text-[12px] text-emerald-400 font-mono text-center relative z-10 flex items-center justify-center gap-1"><CheckCircle2 size={13} /> {successMsg}</p>}

        {/* ================================================================= */}
        {/* PASSWORD FORM */}
        {/* ================================================================= */}
        {authMethod === "password" && (
          <form onSubmit={isSignUp ? handleSignUp : handleSignIn} className="mt-4 space-y-3 relative z-10 animate-fadeIn">
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 text-white/40 w-4 h-4" />
              <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }}
                placeholder="Email Address" className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-[13.5px] text-white placeholder-white/30 focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/40" />
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 text-white/40 w-4 h-4" />
              <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }}
                placeholder="Password" className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-10 py-2.5 text-[13.5px] text-white placeholder-white/30 focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/40" />
              <button type="button" onClick={() => setShowPassword((s) => !s)} className="absolute right-3.5 top-3 text-white/40 hover:text-white transition-colors">
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {isSignUp && (
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 text-white/40 w-4 h-4" />
                <input type="password" value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                  placeholder="Confirm Password" className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-[13.5px] text-white placeholder-white/30 focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/40" />
              </div>
            )}
            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-accent hover:brightness-110 text-white font-medium text-[14px] transition-all shadow-md active:scale-95 disabled:opacity-50">
              {isSignUp ? <><UserPlus size={15} /> Create Account</> : <><LogIn size={15} /> Sign In</>}
            </button>
          </form>
        )}

        {/* ================================================================= */}
        {/* EMAIL OTP FORM */}
        {/* ================================================================= */}
        {authMethod === "email-otp" && (
          <div className="mt-4 relative z-10 animate-fadeIn">
            {!emailOtpSent ? (
              <form onSubmit={handleSendEmailOtp} className="space-y-3">
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 text-white/40 w-4 h-4" />
                  <input type="email" value={otpEmail} onChange={(e) => { setOtpEmail(e.target.value); setError(""); }}
                    placeholder="Enter Email for OTP" className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-[13.5px] text-white placeholder-white/30 focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/40" />
                </div>
                <button type="submit" className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-accent hover:brightness-110 text-white font-medium text-[14px] transition-all shadow-md active:scale-95">
                  <KeyRound size={15} /> Send Email OTP
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyEmailOtp} className="space-y-3">
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-3 text-white/40 w-4 h-4" />
                  <input type="text" maxLength={6} value={emailOtpCode} onChange={(e) => { setEmailOtpCode(e.target.value); setError(""); }}
                    placeholder="Enter 6-digit OTP" className="w-full bg-white/5 border border-accent/50 rounded-xl pl-10 pr-4 py-2.5 font-mono text-[15px] tracking-widest text-center text-white focus:outline-none focus:ring-1 focus:ring-accent/60" />
                </div>
                <div className="flex items-center justify-between text-[11px] text-white/50 font-mono">
                  <span>OTP sent to {otpEmail}</span>
                  {timer > 0 ? <span>Resend in {timer}s</span> : (
                    <button type="button" onClick={handleSendEmailOtp} className="text-accent hover:underline flex items-center gap-1"><RefreshCw size={11} /> Resend</button>
                  )}
                </div>
                <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-medium text-[14px] transition-all shadow-md active:scale-95 disabled:opacity-50">
                  Verify OTP & {isSignUp ? "Create Account" : "Sign In"}
                </button>
              </form>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* MOBILE OTP FORM */}
        {/* ================================================================= */}
        {authMethod === "mobile-otp" && (
          <div className="mt-4 relative z-10 animate-fadeIn">
            {!mobileOtpSent ? (
              <form onSubmit={handleSendMobileOtp} className="space-y-3">
                <div className="relative flex items-center">
                  <Phone className="absolute left-3.5 text-white/40 w-4 h-4" />
                  <span className="absolute left-9 text-[13px] font-mono text-white/60">+91</span>
                  <input type="tel" maxLength={10} value={mobileNum} onChange={(e) => { setMobileNum(e.target.value); setError(""); }}
                    placeholder="10-digit Mobile Number" className="w-full bg-white/5 border border-white/10 rounded-xl pl-16 pr-4 py-2.5 text-[13.5px] text-white placeholder-white/30 focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/40" />
                </div>
                <button type="submit" className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-accent hover:brightness-110 text-white font-medium text-[14px] transition-all shadow-md active:scale-95">
                  <KeyRound size={15} /> Send SMS OTP
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyMobileOtp} className="space-y-3">
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-3 text-white/40 w-4 h-4" />
                  <input type="text" maxLength={6} value={mobileOtpCode} onChange={(e) => { setMobileOtpCode(e.target.value); setError(""); }}
                    placeholder="Enter 6-digit SMS OTP" className="w-full bg-white/5 border border-accent/50 rounded-xl pl-10 pr-4 py-2.5 font-mono text-[15px] tracking-widest text-center text-white focus:outline-none focus:ring-1 focus:ring-accent/60" />
                </div>
                <div className="flex items-center justify-between text-[11px] text-white/50 font-mono">
                  <span>SMS sent to +91 {mobileNum.slice(-10)}</span>
                  {timer > 0 ? <span>Resend in {timer}s</span> : (
                    <button type="button" onClick={handleSendMobileOtp} className="text-accent hover:underline flex items-center gap-1"><RefreshCw size={11} /> Resend</button>
                  )}
                </div>
                <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-medium text-[14px] transition-all shadow-md active:scale-95 disabled:opacity-50">
                  Verify OTP & {isSignUp ? "Create Account" : "Sign In"}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Mode switch link */}
        <div className="mt-4 text-center relative z-10">
          <p className="text-[12px] text-white/50">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}
            <button onClick={() => switchMode(isSignUp ? "signin" : "signup")} className="ml-1.5 text-accent hover:underline font-semibold">
              {isSignUp ? "Sign In" : "Sign Up"}
            </button>
          </p>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-white/10 text-center relative z-10">
          <p className="text-[11px] text-white/40 font-mono flex items-center justify-center gap-1.5">
            <ShieldCheck size={13} className="text-emerald-400" />
            JWT Token Session · Multi-user isolated storage
          </p>
        </div>
      </div>
    </div>
  );
}
