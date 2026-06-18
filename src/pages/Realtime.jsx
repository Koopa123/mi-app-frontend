import { useEffect, useRef, useState } from "react";
import { REALTIME_URL, REALTIME_WS_URL } from "../services/api";
import "../styles/realtime.css";

// Cada cuántos ms intentar capturar frame si el server tarda mucho
// (es un timeout de seguridad, normalmente el server responde antes)
const FRAME_TIMEOUT_MS = 5000;

export default function Realtime() {
  const [modos, setModos] = useState([]);
  const [modoId, setModoId] = useState("");
  const [activo, setActivo] = useState(false);
  const [iniciando, setIniciando] = useState(false);
  const [error, setError] = useState(null);

  // Stats que vienen del backend
  const [fps, setFps] = useState(0);
  const [totalPersonas, setTotalPersonas] = useState(0);
  const [sospechosos, setSospechosos] = useState(0);

  // El frame procesado que devuelve el server (base64)
  const [frameProcesado, setFrameProcesado] = useState(null);

  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const streamRef = useRef(null); 
  const esperandoRespuestaRef = useRef(false);

  // ============================================================
  // CARGAR MODOS DISPONIBLES
  // ============================================================
  useEffect(() => {
    const cargar = async () => {
      try {
        const res = await fetch(`${REALTIME_URL}/modos`);
        const data = await res.json();
        const disponibles = data.modos.filter((m) => m.disponible);
        setModos(disponibles);
        if (disponibles.length > 0) {
          setModoId(disponibles[0].id);
        }
      } catch (err) {
        setError(
          "No se pudo conectar con el servidor de Tiempo Real. ¿Está corriendo?"
        );
      }
    };
    cargar();

    // Cleanup al desmontar
    return () => {
      detener();
    };
  }, []);

  // ============================================================
  // INICIAR: pedir webcam + abrir WebSocket
  // ============================================================
  const iniciar = async () => {
    if (!modoId) return;
    setError(null);
    setIniciando(true);

    try {
      // 1. Pedir permiso de webcam
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 480, height: 360 },
        audio: false,
      });
      streamRef.current = stream;

      // 2. Conectar el stream al <video>
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // 3. Abrir WebSocket
      const ws = new WebSocket(`${REALTIME_WS_URL}?modo=${modoId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setActivo(true);
        setIniciando(false);
        // Disparar el primer frame
        enviarSiguienteFrame();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.error) {
            setError(data.error);
            return;
          }

          // Pintar el frame procesado
          if (data.frame_jpeg_base64) {
            setFrameProcesado(
              `data:image/jpeg;base64,${data.frame_jpeg_base64}`
            );
          }
          setFps(data.fps || 0);
          setTotalPersonas(data.total_personas || 0);
          setSospechosos(data.sospechosos || 0);

          esperandoRespuestaRef.current = false;
          // Disparar el siguiente frame
          enviarSiguienteFrame();
        } catch (e) {
          console.error("Error procesando mensaje del server:", e);
        }
      };

      ws.onerror = (e) => {
        console.error("WebSocket error:", e);
        setError("Error de conexión con el servidor de visión");
      };

      ws.onclose = () => {
        setActivo(false);
      };
    } catch (err) {
      console.error(err);
      if (err.name === "NotAllowedError") {
        setError("Permiso de cámara denegado. Permite el acceso en tu navegador.");
      } else if (err.name === "NotFoundError") {
        setError("No se encontró ninguna webcam conectada.");
      } else {
        setError(err.message || "Error iniciando la cámara");
      }
      setIniciando(false);
      cerrarTodo();
    }
  };

  // ============================================================
  // ENVIAR SIGUIENTE FRAME
  // ============================================================
  const enviarSiguienteFrame = () => {
    if (
      !wsRef.current ||
      wsRef.current.readyState !== WebSocket.OPEN ||
      esperandoRespuestaRef.current
    ) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    if (
      canvas.width !== video.videoWidth ||
      canvas.height !== video.videoHeight
    ) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convertir a JPEG (calidad 0.7 para balance velocidad/calidad)
    canvas.toBlob(
      (blob) => {
        if (
          blob &&
          wsRef.current &&
          wsRef.current.readyState === WebSocket.OPEN
        ) {
          esperandoRespuestaRef.current = true;
          wsRef.current.send(blob);

          // Timeout de seguridad: si el server no responde, reintentar
          setTimeout(() => {
            if (esperandoRespuestaRef.current) {
              esperandoRespuestaRef.current = false;
              enviarSiguienteFrame();
            }
          }, FRAME_TIMEOUT_MS);
        }
      },
      "image/jpeg",
      0.7
    );
  };

  // ============================================================
  // DETENER
  // ============================================================
  const cerrarTodo = () => {
    // Cerrar WebSocket
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }
    // Cerrar webcam
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    esperandoRespuestaRef.current = false;
  };

  const detener = () => {
    cerrarTodo();
    setActivo(false);
    setFrameProcesado(null);
    setFps(0);
    setTotalPersonas(0);
    setSospechosos(0);
  };

  const cambiarModo = (nuevoId) => {
    setModoId(nuevoId);
    // Si está activo, reiniciar con el nuevo modo
    if (activo) {
      detener();
      // Esperar un tick para que limpie y reiniciar
      setTimeout(() => {
        setModoId(nuevoId);
        iniciar();
      }, 300);
    }
  };

  const modoActual = modos.find((m) => m.id === modoId);

  return (
    <>
      <section className="hero">
        <h1>Detección en tiempo real</h1>
        <p>Analiza la webcam de tu dispositivo en vivo.</p>
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
              <p className="step-desc">
                Elige el tipo de detección y activa tu cámara.
              </p>
            </div>
          </div>

          <div className="step-body">
            <div className="row">
              <select
                className="select-input"
                value={modoId}
                onChange={(e) => cambiarModo(e.target.value)}
                disabled={iniciando}
                style={{ flex: 1, minWidth: 260 }}
              >
                {modos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </select>

              {!activo ? (
                <button
                  className="btn-primary"
                  onClick={iniciar}
                  disabled={iniciando || !modoId}
                >
                  {iniciando ? "Iniciando..." : "Iniciar webcam"}
                </button>
              ) : (
                <button className="btn-danger-ghost" onClick={detener}>
                  Detener
                </button>
              )}
            </div>

            {modoActual && (
              <p
                className="step-desc"
                style={{ marginTop: 8, fontSize: 13 }}
              >
                {modoActual.descripcion}
              </p>
            )}
          </div>
        </section>
      )}

      {/* Video oculto (captura de webcam) y canvas oculto (para encodear frames) */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ display: "none" }}
      />
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {activo && (
        <section className="step">
          <div className="step-head">
            <span className="step-num">★</span>
            <div>
              <h2>Vista en vivo</h2>
              <p className="step-desc">
                Modo: <strong>{modoActual?.nombre}</strong>
              </p>
            </div>
          </div>

          <div className="step-body">
            <div className="realtime-stream">
              {frameProcesado ? (
                <img src={frameProcesado} alt="Detección en vivo" />
              ) : (
                <div className="realtime-placeholder">
                  Esperando primer frame del servidor...
                </div>
              )}
              <div className="realtime-indicator">
                <span className="realtime-dot" />
                EN VIVO
              </div>
            </div>

            <div className="realtime-stats">
              <div className="stat-card">
                <div className="stat-label">FPS</div>
                <div className="stat-value">{fps.toFixed(1)}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Personas</div>
                <div className="stat-value">{totalPersonas}</div>
              </div>
              <div
                className={`stat-card ${
                  sospechosos > 0 ? "stat-alerta" : ""
                }`}
              >
                <div className="stat-label">Sospechosos</div>
                <div className="stat-value">{sospechosos}</div>
              </div>
            </div>

            <div className="realtime-leyenda">
              <span className="leyenda-item">
                <span
                  className="leyenda-dot"
                  style={{ background: "#00c850" }}
                />
                Verde: persona normal
              </span>
              <span className="leyenda-item">
                <span
                  className="leyenda-dot"
                  style={{ background: "#dc2626" }}
                />
                Rojo: persona sospechosa
              </span>
            </div>
          </div>
        </section>
      )}
    </>
  );
}