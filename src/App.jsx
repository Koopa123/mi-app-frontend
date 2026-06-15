import { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Header from "./components/Header";
import Login from "./pages/Login";
import Aglomeraciones from "./pages/Aglomeraciones";
import Benchmark from "./pages/Benchmark";
import Realtime from "./pages/Realtime";

function AppContent() {
  const { usuario, cargando } = useAuth();
  const [tab, setTab] = useState("aglomeraciones");

  if (cargando) {
    return (
      <div className="loading-screen">
        <span className="spinner" />
      </div>
    );
  }

  if (!usuario) {
    return <Login />;
  }

  return (
    <div className="app">
      <Header tab={tab} setTab={setTab} />
      <main className="main">
        {tab === "aglomeraciones" && <Aglomeraciones />}
        {tab === "benchmark" && <Benchmark />}
        {tab === "realtime" && <Realtime />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}