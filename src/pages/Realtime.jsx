import { useEffect, useState } from "react";
import { REALTIME_URL } from "../services/api";
import "../styles/realtime.css";

export default function Realtime() {
  const [modelos, setModelos] = useState([]);
  const [modeloId, setModeloId] = useState("");
  const [activo, setActivo] = useState(false);
  const [iniciando, setIniciando] = useState(false);
  const [streamUrl, setStreamUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const cargar = async () => {
      try {
        const res = await fetch(`${REALTIME_URL}/modelos`);
        const data = await res.json();
        setModelos(data.modelos);
        if (data.modelos.length > 0) {
          const rapido = data.modelos.find((m) => m.rapido);
          setModeloId(rapido?.id || data.modelos[0].id);
        }
      } catch (err) {
        setError(
          "No se pudo conectar con el servidor de Tiempo Real. ¿Está corriendo en localhost:8002?"
        );
      }
    };
    cargar();

    return () => {
      detenerSilencioso();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const detenerSilencioso = async () => {
    try {
      await fetch(`${REALTIME_URL}/detener`, { method: "POST" });
    } catch {}
  };

  const iniciar = async () => {
    if (!modeloId) return;
    setError(null);
    setIniciando(true);
    setStreamUrl(null);

    try {
      await detenerSilencioso();
      await new Promise((r) => setTimeout(r, 300));

      const res = await fetch(`${REALTIME_URL}/iniciar/${modeloId}?camera_id=0`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Error iniciando");

      setStreamUrl(`${REALTIME_URL}/stream?t=${Date.now()}`);
      setActivo(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setIniciando(false);
    }
  };

  const detener = async () => {
    await detenerSilencioso();
    setActivo(false);
    setStreamUrl(null);
  };

  const cambiarModelo = async (nuevoId) => {
    if (activo) {
      await detenerSilencioso();
      setActivo(false);
      setStreamUrl(null);
      setModeloId(nuevoId);
      setTimeout(() => iniciar(), 400);
    } else {
      setModeloId(nuevoId);
    }
  };

  const modeloActual = modelos.find((m) => m.id === modeloId);

  return (
    <>
      <section className="hero">
        <h1>Detección en tiempo real</h1>
        <p>Analiza la webcam en vivo con el modelo de tu elección.</p>
      </section>

      {error && (
        <section className="step">
          <div className="info-box-warning">{error}</div>
        </section>
      )}

      {!error && (
        <section className="step">
          <div className="step-head">
            <span className="step-num">1</span>
            <div>
              <h2>Configuración</h2>
              <p className="step-desc">Elige el modelo y activa la webcam.</p>
            </div>
          </div>

          <div className="step-body">
            <div className="row">
              <select
                className="select-input"
                value={modeloId}
                onChange={(e) => {
                  const nuevo = e.target.value;
                  if (activo) {
                    cambiarModelo(nuevo);
                  } else {
                    setModeloId(nuevo);
                  }
                }}
                disabled={iniciando}
                style={{ flex: 1, minWidth: 260 }}
              >
                {modelos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre} {!m.rapido ? "⚠️ (lento)" : ""}
                  </option>
                ))}
              </select>

              {!activo ? (
                <button
                  className="btn-primary"
                  onClick={iniciar}
                  disabled={iniciando || !modeloId}
                >
                  {iniciando ? "Iniciando..." : "Iniciar webcam"}
                </button>
              ) : (
                <button className="btn-danger-ghost" onClick={detener}>
                  Detener
                </button>
              )}
            </div>

            {modeloActual && !modeloActual.rapido && (
              <div className="info-box-warning">
                Este modelo es más pesado y puede mostrar lag en tiempo real.
                Para mejor rendimiento, usa modelos marcados como rápidos.
              </div>
            )}
          </div>
        </section>
      )}

      {activo && streamUrl && (
        <section className="step">
          <div className="step-head">
            <span className="step-num">★</span>
            <div>
              <h2>Vista en vivo</h2>
              <p className="step-desc">
                Modelo: <strong>{modeloActual?.nombre}</strong>
              </p>
            </div>
          </div>

          <div className="step-body">
            <div className="realtime-stream">
              <img src={streamUrl} alt="Stream en vivo" />
              <div className="realtime-indicator">
                <span className="realtime-dot" />
                EN VIVO
              </div>
            </div>

            <div className="realtime-leyenda">
              <span className="leyenda-item">
                <span className="leyenda-dot" style={{ background: "#00c850" }} />
                Verde: persona normal
              </span>
              <span className="leyenda-item">
                <span className="leyenda-dot" style={{ background: "#dc2626" }} />
                Rojo: persona sospechosa
              </span>
            </div>
          </div>
        </section>
      )}
    </>
  );
}