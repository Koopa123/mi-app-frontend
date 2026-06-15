import { useAuth } from "../context/AuthContext";

export default function Header({ tab, setTab }) {
  const { usuario, logout } = useAuth();

  return (
    <header className="header">
      <div className="header-inner">
        <div className="logo">
          <span className="logo-dot" />
          <span className="logo-text">CrowdMonitor</span>
        </div>

        <nav className="tabs">
          <button
            className={`tab ${tab === "aglomeraciones" ? "active" : ""}`}
            onClick={() => setTab("aglomeraciones")}
          >
            Aglomeraciones
          </button>
          <button
            className={`tab ${tab === "benchmark" ? "active" : ""}`}
            onClick={() => setTab("benchmark")}
          >
            Benchmark
          </button>
          <button
            className={`tab ${tab === "realtime" ? "active" : ""}`}
            onClick={() => setTab("realtime")}
          >
            Tiempo Real
          </button>
        </nav>

        <div className="header-user">
          <span className="header-user-name">
            Hola, <strong>{usuario?.email}</strong>
          </span>
          <button className="btn-ghost btn-sm" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </div>
    </header>
  );
}