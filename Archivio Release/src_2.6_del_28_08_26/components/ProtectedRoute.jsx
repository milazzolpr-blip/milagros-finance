import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { C } from "../theme";

export default function ProtectedRoute({ children }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ backgroundColor: C.bg, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
        <img src="/icon-192.png" alt="F.A.M." style={{ width: 64, height: 64, borderRadius: 18, animation: "fam-pulse 1.6s ease-in-out infinite" }} />
        <style>{`@keyframes fam-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(0.94); } }`}</style>
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;
  return children;
}
