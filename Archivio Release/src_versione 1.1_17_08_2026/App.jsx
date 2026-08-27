import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import { C } from "./theme";

const LoginPage = lazy(() => import("./pages/LoginPage"));
const HomePage = lazy(() => import("./pages/HomePage"));
const MesiPage = lazy(() => import("./pages/MesiPage"));
const CapitoliPage = lazy(() => import("./pages/CapitoliPage"));
const StoricoPage = lazy(() => import("./pages/StoricoPage"));
const AltroPage = lazy(() => import("./pages/AltroPage"));
const RisparmiPage = lazy(() => import("./pages/RisparmiPage"));

function PageFallback() {
  return <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: "60px 0" }}>Caricamento...</div>;
}

export default function App() {
  return (
    <AuthProvider>
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
              <Route index element={<HomePage />} />
              <Route path="mesi" element={<MesiPage />} />
              <Route path="capitoli" element={<CapitoliPage />} />
              <Route path="storico" element={<StoricoPage />} />
              <Route path="altro" element={<AltroPage />} />
              <Route path="risparmi" element={<RisparmiPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
