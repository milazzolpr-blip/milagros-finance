import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import MesiPage from "./pages/MesiPage";
import CapitoliPage from "./pages/CapitoliPage";
import StoricoPage from "./pages/StoricoPage";
import AltroPage from "./pages/AltroPage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
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
          </Route>
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
