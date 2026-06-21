import { useEffect, useRef, useState } from "react";
import { REALTIME_URL, REALTIME_WS_URL } from "../services/api";
import "../styles/realtime.css";

const FRAME_TIMEOUT_MS = 5000;
const DEBOUNCE_SOSPECHOSA_MS = 2000;   // No dispara nueva alerta sospechosa si hubo una hace menos de 2s
const TOAST_DURATION_MS = 5000;
const MAX_HISTORIAL = 5;

// Límite de FPS para no saturar el WebSocket / GPU.
// Con CPU, el modelo era el cuello de botella; con GPU rápida el cliente
// dispararía cientos de FPS si no se le pone freno. 30 FPS es lo que da
// la mayoría de webcams y es más que suficiente para detección.
const FPS_OBJETIVO = 30;
const INTERVALO_MIN_MS = 1000 / FPS_OBJETIVO;

export default function Realtime() {
  const [modos, setModos] = useState([]);
  const [modoId, setModoId] = useState("");
  const [activo, setActivo] = useState(false);
  const [iniciando, setIniciando] = useState(false);
  const [error, setError] = useState(null);

  const [fps, setFps] = useState(0);
  const [totalPersonas, setTotalPersonas] = useState(0);
  const [sospechosos, setSospechosos] = useState(0);
  const [grupoMayor, setGrupoMayor] = useState(0);
  const [nivel, setNivel] = useState("BAJO");

  const [frameProcesado, setFrameProcesado] = useState(null);

  // Alertas
  const [alertaActiva, setAlertaActiva] = useState(null);  // banner persistente
  const [toasts, setToasts] = useState([]);                // toasts efímeros
  const [historial, setHistorial] = useState([]);          // lista de eventos

  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const streamRef = useRef(null);
  const esperandoRespuestaRef = useRef(false);
  const ultimoEnvioRef = useRef(0);          // timestamp del último frame enviado (throttle)
  const timeoutThrottleRef = useRef(null);   // para limpiar setTimeout pendiente al detener

  // Refs para debounce
  const nivelAnteriorRef = useRef("BAJO");
  const ultimaAlertaSospechosaRef = useRef(0);

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

    return () => {
      detener();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================================
  // HELPERS DE ALERTAS
  // ============================================================
  const obtenerHora = () => {
    const ahora = new Date();
    return ahora.toLocaleTimeString("es-PE", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const obtenerZona = (bbox, frameWidth, frameHeight) => {
    // bbox = [x1, y1, x2, y2] -> calcula la posición del centro en términos de zona
    const cx = (bbox[0] + bbox[2]) / 2;
    const cy = (bbox[1] + bbox[3]) / 2;

    const vertical =
      cy < frameHeight / 3
        ? "superior"
        : cy < (frameHeight * 2) / 3
        ? "centro"
        : "inferior";
    const horizontal =
      cx < frameWidth / 3
        ? "izquierda"
        : cx < (frameWidth * 2) / 3
        ? "centro"
        : "derecha";

    if (vertical === "centro" && horizontal === "centro") return "Centro";
    if (vertical === "centro") return `Centro ${horizontal}`;
    if (horizontal === "centro") return `${vertical} centro`;
    return `${vertical} ${horizontal}`;
  };

  const obtenerZonaPromedio = (detecciones, frameWidth, frameHeight) => {
    if (!detecciones || detecciones.length === 0) return "Vista actual";
    // Promedio de centros
    let sumX = 0,
      sumY = 0;
    detecciones.forEach((d) => {
      sumX += (d.bbox[0] + d.bbox[2]) / 2;
      sumY += (d.bbox[1] + d.bbox[3]) / 2;
    });
    const cx = sumX / detecciones.length;
    const cy = sumY / detecciones.length;
    return obtenerZona([cx, cy, cx, cy], frameWidth, frameHeight);
  };

  const agregarToast = (titulo, descripcion, tipo) => {
    const id = Date.now() + Math.random();
    const hora = obtenerHora();
    const nuevoToast = { id, titulo, descripcion, tipo, hora };

    setToasts((prev) => [...prev, nuevoToast]);
    setHistorial((prev) =>
      [{ id, titulo, descripcion, tipo, hora }, ...prev].slice(0, MAX_HISTORIAL)
    );

    // Auto-remover después de TOAST_DURATION_MS
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_DURATION_MS);
  };

  const limpiarToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // ============================================================
  // INICIAR
  // ============================================================
  const iniciar = async () => {
    if (!modoId) return;
    setError(null);
    setIniciando(true);

    // Reset de alertas al iniciar
    setAlertaActiva(null);
    setToasts([]);
    setHistorial([]);
    nivelAnteriorRef.current = "BAJO";
    ultimaAlertaSospechosaRef.current = 0;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const ws = new WebSocket(`${REALTIME_WS_URL}?modo=${modoId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setActivo(true);
        setIniciando(false);
        enviarSiguienteFrame();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.error) {
            setError(data.error);
            return;
          }

          if (data.frame_jpeg_base64) {
            setFrameProcesado(
              `data:image/jpeg;base64,${data.frame_jpeg_base64}`
            );
          }
          setFps(data.fps || 0);
          setTotalPersonas(data.total_personas || 0);

          // Procesar según modo
          if (data.modo === "aglomeraciones") {
            const nuevoNivel = data.nivel || "BAJO";
            const grupo = data.grupo_mayor || 0;
            setGrupoMayor(grupo);
            setNivel(nuevoNivel);
            setSospechosos(0);

            procesarAlertaAglomeracion(nuevoNivel, grupo, data.detecciones);
          } else {
            const susp = data.sospechosos || 0;
            setSospechosos(susp);
            setGrupoMayor(0);
            setNivel("BAJO");

            procesarAlertaSospechosa(susp, data.detecciones);
          }

          esperandoRespuestaRef.current = false;
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
  // LÓGICA DE ALERTAS POR MODO
  // ============================================================
  const procesarAlertaAglomeracion = (nuevoNivel, grupo, detecciones) => {
    const frameW = canvasRef.current?.width || 640;
    const frameH = canvasRef.current?.height || 480;

    if (nuevoNivel === "ALTO") {
      const zona = obtenerZonaPromedio(detecciones, frameW, frameH);
      setAlertaActiva({
        tipo: "aglomeracion",
        titulo: "Aglomeración alta",
        descripcion: `${grupo} personas agrupadas en ${zona.toLowerCase()}`,
      });

      // Toast solo si el nivel CAMBIÓ a ALTO (no si ya estaba en ALTO)
      if (nivelAnteriorRef.current !== "ALTO") {
        agregarToast(
          "Aglomeración detectada",
          `Grupo de ${grupo} personas — Zona: ${zona}`,
          "alto"
        );
      }
    } else {
      // Si bajó de ALTO a algo menor, quitar el banner
      if (nivelAnteriorRef.current === "ALTO") {
        setAlertaActiva(null);
      }
    }

    nivelAnteriorRef.current = nuevoNivel;
  };

  const procesarAlertaSospechosa = (susp, detecciones) => {
    const frameW = canvasRef.current?.width || 640;
    const frameH = canvasRef.current?.height || 480;

    if (susp > 0) {
      const sospechososDetectados = (detecciones || []).filter(
        (d) => d.es_sospechoso
      );
      const zona = obtenerZonaPromedio(sospechososDetectados, frameW, frameH);

      setAlertaActiva({
        tipo: "sospechosa",
        titulo: "Actividad sospechosa",
        descripcion: `${susp} persona${susp > 1 ? "s" : ""} sospechosa${
          susp > 1 ? "s" : ""
        } en ${zona.toLowerCase()}`,
      });

      // Debounce: solo dispara toast si pasaron al menos 2 segundos desde el último
      const ahora = Date.now();
      if (ahora - ultimaAlertaSospechosaRef.current > DEBOUNCE_SOSPECHOSA_MS) {
        agregarToast(
          "Actividad sospechosa detectada",
          `${susp} persona${susp > 1 ? "s" : ""} — Zona: ${zona}`,
          "sospechosa"
        );
        ultimaAlertaSospechosaRef.current = ahora;
      }
    } else {
      // Si dejó de haber sospechosos, quitar el banner
      setAlertaActiva(null);
    }
  };

  // ============================================================
  // ENVIAR FRAMES
  // ============================================================
  const enviarSiguienteFrame = () => {
    if (
      !wsRef.current ||
      wsRef.current.readyState !== WebSocket.OPEN ||
      esperandoRespuestaRef.current
    ) {
      return;
    }

    // Throttle: si la GPU respondió muy rápido, no spammear el WS.
    // Esperamos hasta completar 1000/FPS_OBJETIVO ms desde el último envío.
    const ahora = Date.now();
    const desdeUltimo = ahora - ultimoEnvioRef.current;
    if (desdeUltimo < INTERVALO_MIN_MS) {
      const restante = INTERVALO_MIN_MS - desdeUltimo;
      timeoutThrottleRef.current = setTimeout(() => {
        timeoutThrottleRef.current = null;
        enviarSiguienteFrame();
      }, restante);
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

    canvas.toBlob(
      (blob) => {
        if (
          blob &&
          wsRef.current &&
          wsRef.current.readyState === WebSocket.OPEN
        ) {
          esperandoRespuestaRef.current = true;
          ultimoEnvioRef.current = Date.now();
          wsRef.current.send(blob);

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
    // Limpiar throttle pendiente para no disparar un envío después de cerrar
    if (timeoutThrottleRef.current) {
      clearTimeout(timeoutThrottleRef.current);
      timeoutThrottleRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    esperandoRespuestaRef.current = false;
    ultimoEnvioRef.current = 0;
  };

  const detener = () => {
    cerrarTodo();
    setActivo(false);
    setFrameProcesado(null);
    setFps(0);
    setTotalPersonas(0);
    setSospechosos(0);
    setGrupoMayor(0);
    setNivel("BAJO");
    setAlertaActiva(null);
    setToasts([]);
  };

  const cambiarModo = (nuevoId) => {
    setModoId(nuevoId);
    if (activo) {
      detener();
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
            <div className="realtime-layout">
              {/* Columna principal: video + stats + leyenda */}
              <div className="realtime-main">
                <div className="realtime-stream">
                  {/* Banner de alerta persistente */}
                  {alertaActiva && (
                    <div className={`realtime-banner banner-${alertaActiva.tipo}`}>
                      <div className="banner-icon">⚠</div>
                      <div className="banner-content">
                        <div className="banner-titulo">{alertaActiva.titulo}</div>
                        <div className="banner-desc">{alertaActiva.descripcion}</div>
                      </div>
                    </div>
                  )}

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

                  {modoId === "aglomeraciones" ? (
                    <>
                      <div className="stat-card">
                        <div className="stat-label">Grupo mayor</div>
                        <div className="stat-value">{grupoMayor}</div>
                      </div>
                      <div
                        className={`stat-card ${
                          nivel === "ALTO"
                            ? "stat-alerta"
                            : nivel === "MEDIO"
                            ? "stat-medio"
                            : ""
                        }`}
                      >
                        <div className="stat-label">Nivel</div>
                        <div className="stat-value">{nivel}</div>
                      </div>
                    </>
                  ) : (
                    <div
                      className={`stat-card ${
                        sospechosos > 0 ? "stat-alerta" : ""
                      }`}
                    >
                      <div className="stat-label">Sospechosos</div>
                      <div className="stat-value">{sospechosos}</div>
                    </div>
                  )}
                </div>

                <div className="realtime-leyenda">
                  {modoId === "aglomeraciones" ? (
                    <>
                      <span className="leyenda-item">
                        <span
                          className="leyenda-dot"
                          style={{ background: "#00c850" }}
                        />
                        Verde: persona detectada
                      </span>
                      <span className="leyenda-item">
                        <span
                          className="leyenda-dot"
                          style={{ background: "#ffeb3b" }}
                        />
                        Líneas amarillas: personas agrupadas
                      </span>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>
              </div>

              {/* Columna lateral: historial de eventos */}
              <aside className="realtime-historial">
                <h3 className="historial-titulo">Historial de eventos</h3>
                {historial.length === 0 ? (
                  <p className="historial-vacio">
                    Sin eventos detectados todavía.
                  </p>
                ) : (
                  <ul className="historial-lista">
                    {historial.map((ev) => (
                      <li
                        key={ev.id}
                        className={`historial-item historial-${ev.tipo}`}
                      >
                        <div className="historial-hora">{ev.hora}</div>
                        <div className="historial-titulo-ev">{ev.titulo}</div>
                        <div className="historial-desc">{ev.descripcion}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </aside>
            </div>
          </div>
        </section>
      )}

      {/* Toasts flotantes */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tipo}`}>
            <div className="toast-icon">⚠</div>
            <div className="toast-content">
              <div className="toast-titulo">{t.titulo}</div>
              <div className="toast-desc">{t.descripcion}</div>
              <div className="toast-hora">{t.hora}</div>
            </div>
            <button
              className="toast-cerrar"
              onClick={() => limpiarToast(t.id)}
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </>
  );
}