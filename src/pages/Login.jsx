import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import "../styles/login.css";

export default function Login() {
  const { login, registro } = useAuth();
  const [modo, setModo] = useState("login"); // "login" | "registro"
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      if (modo === "login") {
        await login(email, password);
      } else {
        await registro(nombre, email, password);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <span className="logo-dot" />
          <span className="logo-text">CrowdMonitor</span>
        </div>

        <h1 className="login-title">
          {modo === "login" ? "Iniciar sesión" : "Crear cuenta"}
        </h1>
        <p className="login-subtitle">
          {modo === "login"
            ? "Ingresa tus credenciales para acceder al sistema."
            : "Crea una cuenta para comenzar a monitorear."}
        </p>

        <div className="login-tabs">
          <button
            type="button"
            className={`login-tab ${modo === "login" ? "active" : ""}`}
            onClick={() => { setModo("login"); setError(null); }}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            className={`login-tab ${modo === "registro" ? "active" : ""}`}
            onClick={() => { setModo("registro"); setError(null); }}
          >
            Registrarse
          </button>
        </div>

        <form className="login-form" onSubmit={submit}>
          {modo === "registro" && (
            <div className="field-group">
              <label>Nombre</label>
              <input
                type="text"
                className="text-input"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                placeholder="Tu nombre"
              />
            </div>
          )}

          <div className="field-group">
            <label>Email</label>
            <input
              type="email"
              className="text-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="[email protected]"
            />
          </div>

          <div className="field-group">
            <label>Contraseña</label>
            <input
              type="password"
              className="text-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Mínimo 6 caracteres"
              minLength={6}
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="btn-primary login-submit" disabled={cargando}>
            {cargando
              ? "Cargando..."
              : modo === "login"
              ? "Iniciar sesión"
              : "Crear cuenta"}
          </button>
        </form>
      </div>
    </div>
  );
}