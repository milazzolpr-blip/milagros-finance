import React, { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { C } from "../theme";
import { supabase } from "../lib/supabase";

export default function LoginPage() {
  const { signIn, signUp, session } = useAuth();
  const [mode, setMode] = useState("login"); // "login" | "signup" | "reset"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  if (session) return <Navigate to="/app" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

    if (mode === "reset") {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/login",
      });
      setLoading(false);
      if (resetError) setError(resetError.message);
      else setInfo("Email inviata — controlla la posta (anche lo spam) per il link di reimpostazione.");
      return;
    }

    const { error: authError } =
      mode === "login" ? await signIn(email, password) : await signUp(email, password, fullName);
    setLoading(false);
    if (authError) setError(authError.message);
  };

  const titolo = mode === "login" ? "Accedi al tuo workspace" : mode === "signup" ? "Crea il tuo account" : "Reimposta la password";

  return (
    <div style={{ backgroundColor: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg, #a78bfa, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, margin: "0 auto 12px" }}>🏠</div>
          <h1 style={{ color: C.text, fontSize: 22, fontWeight: 700, margin: 0 }}>Milagros Finance</h1>
          <p style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>{titolo}</p>
        </div>

        <form onSubmit={handleSubmit} style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, borderRadius: 18, padding: 20 }}>
          {mode === "signup" && (
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nome completo"
              required
              style={inputStyle}
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            style={inputStyle}
          />
          {mode !== "reset" && (
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              minLength={6}
              style={inputStyle}
            />
          )}

          {mode === "login" && (
            <button
              type="button"
              onClick={() => { setMode("reset"); setError(""); setInfo(""); }}
              style={{ display: "block", marginBottom: 14, background: "none", border: "none", color: C.muted, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}
            >
              Password dimenticata?
            </button>
          )}

          {error && <div style={{ color: C.red, fontSize: 12, marginBottom: 12 }}>{error}</div>}
          {info && <div style={{ color: C.green, fontSize: 12, marginBottom: 12 }}>{info}</div>}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%", padding: "13px 0", borderRadius: 12, border: "none",
              backgroundColor: C.purple, color: "#0a0b0f", fontWeight: 600, fontSize: 14,
              opacity: loading ? 0.6 : 1, cursor: loading ? "default" : "pointer",
            }}
          >
            {loading ? "Attendere..." : mode === "login" ? "Accedi" : mode === "signup" ? "Registrati" : "Invia link di reset"}
          </button>
        </form>

        {mode === "reset" ? (
          <button
            onClick={() => { setMode("login"); setError(""); setInfo(""); }}
            style={{ display: "block", margin: "16px auto 0", background: "none", border: "none", color: C.muted, fontSize: 12, cursor: "pointer" }}
          >
            Torna al login
          </button>
        ) : (
          <button
            onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); setInfo(""); }}
            style={{ display: "block", margin: "16px auto 0", background: "none", border: "none", color: C.muted, fontSize: 12, cursor: "pointer" }}
          >
            {mode === "login" ? "Non hai un account? Registrati" : "Hai già un account? Accedi"}
          </button>
        )}
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  backgroundColor: C.panel2,
  border: `1px solid ${C.border}`,
  borderRadius: 12,
  padding: "12px 14px",
  fontSize: 13,
  color: C.text,
  outline: "none",
  marginBottom: 10,
  boxSizing: "border-box",
};
