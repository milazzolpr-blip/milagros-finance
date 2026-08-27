import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ToastProvider } from "./contexts/ToastContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import FinanzaLayout from "./components/FinanzaLayout";
import { C } from "./theme";

const LoginPage = lazy(() => import("./pages/LoginPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const CalendarioPage = lazy(() => import("./pages/CalendarioPage"));
const AttivitaPage = lazy(() => import("./pages/AttivitaPage"));
const ImpostazioniPage = lazy(() => import("./pages/ImpostazioniPage"));
const HomePage = lazy(() => import("./pages/HomePage"));
const MesiPage = lazy(() => import("./pages/MesiPage"));
const CapitoliPage = lazy(() => import("./pages/CapitoliPage"));
const StoricoPage = lazy(() => import("./pages/StoricoPage"));
const FinanzaCategorieTab = lazy(() => import("./pages/FinanzaCategorieTab"));
const RisparmiPage = lazy(() => import("./pages/RisparmiPage"));
const ScadenzePage = lazy(() => import("./pages/ScadenzePage"));

function PageFallback() {
  return <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: "60px 0" }}>Caricamento...</div>;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="calendario" element={<CalendarioPage />} />
              <Route path="attivita" element={<AttivitaPage />} />
              <Route path="impostazioni" element={<ImpostazioniPage />} />
              <Route path="risparmi" element={<RisparmiPage />} />
              <Route path="scadenze" element={<ScadenzePage />} />

              <Route path="finanza" element={<FinanzaLayout />}>
                <Route index element={<HomePage />} />
                <Route path="mesi" element={<MesiPage />} />
                <Route path="capitoli" element={<CapitoliPage />} />
                <Route path="storico" element={<StoricoPage />} />
                <Route path="categorie" element={<FinanzaCategorieTab />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
