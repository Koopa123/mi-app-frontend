import { createContext, useContext, useEffect, useState } from "react";
import { API_URL, apiFetch } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  // Al montar: si hay token, validar contra el backend
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setCargando(false);
      return;
    }

    apiFetch(`${API_URL}/auth/me`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Token inválido");
        const data = await res.json();
        setUsuario(data);
      })
      .catch(() => {
        localStorage.removeItem("token");
        setUsuario(null);
      })
      .finally(() => setCargando(false));
  }, []);

  // Listener para cuando un fetch devuelva 401
  useEffect(() => {
    const handler = () => {
      localStorage.removeItem("token");
      setUsuario(null);
    };
    window.addEventListener("auth-expired", handler);
    return () => window.removeEventListener("auth-expired", handler);
  }, []);

  const login = async (email, password) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Error al iniciar sesión");
    localStorage.setItem("token", data.token);
    setUsuario(data.usuario);
  };

  const registro = async (nombre, email, password) => {
    const res = await fetch(`${API_URL}/auth/registro`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Error al registrarse");
    localStorage.setItem("token", data.token);
    setUsuario(data.usuario);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUsuario(null);
  };

  return (
    <AuthContext.Provider value={{ usuario, cargando, login, registro, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}