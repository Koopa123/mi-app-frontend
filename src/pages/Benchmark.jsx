import { useEffect, useState } from "react";
import { BENCHMARK_URL } from "../services/api";
import Check from "../components/Check";
import "../styles/benchmark.css";

const MODELOS = [
  { id: "videomae", nombre: "VideoMAE", desc: "Clasificador temporal de secuencias de 16 frames", tag: "Video" },
  { id: "exp5", nombre: "YOLOv8 Exp5", desc: "Fine-tuning de YOLOv8s con dataset original", tag: "Frame" },
  { id: "exp8", nombre: "YOLOv8 Exp8", desc: "Fine-tuning de YOLOv8s con data augmentation", tag: "Frame" },
  { id: "pose_xgb_booster", nombre: "Pose + XGBoost Booster", desc: "YOLO Pose entrenado + XGBoost Booster", tag: "Pose" },
  { id: "pose_svm", nombre: "Pose + SVM", desc: "YOLO Pose genérico + SVM normalizado", tag: "Pose" },
  { id: "pose_xgb_norm", nombre: "Pose + XGBoost Norm", desc: "YOLO Pose genérico + XGBoost normalizado", tag: "Pose" },
];

const MODELOS_VISUALES = new Set([
  "pose_xgb_booster",
  "pose_xgb_norm",
  "pose_svm",
]);

export default function Benchmark() {
  // FUENTE DEL VIDEO: "demo" o "upload"
  const [fuenteVideo, setFuenteVideo] = useState("demo");
  const [videosDemo, setVideosDemo] = useState([]);
  const [demoSeleccionadoId, setDemoSeleccionadoId] = useState("");
  const [streamUrl, setStreamUrl] = useState(null);

  // VIDEO SUBIDO
  const [archivo, setArchivo] = useState(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState(null);

  const [duracionVideo, setDuracionVideo] = useState(0);
  const [intervalos, setIntervalos] = useState([{ inicio_seg: 0, fin_seg: 0 }]);
  const [tieneRobo, setTieneRobo] = useState(true);

  const [seleccionados, setSeleccionados] = useState(MODELOS.map((m) => m.id));
  const [ejecutando, setEjecutando] = useState(false);
  const [progreso, setProgreso] = useState({});
  const [resultados, setResultados] = useState({});
  const [modeloActual, setModeloActual] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [tiempoTranscurrido, setTiempoTranscurrido] = useState(0);

  // Cargar los videos demo al entrar
  useEffect(() => {
    const cargar = async () => {
      try {
        const res = await fetch(`${BENCHMARK_URL}/videos-demo`);
        const data = await res.json();
        setVideosDemo(data.videos || []);
        if (data.videos && data.videos.length > 0) {
          setDemoSeleccionadoId(data.videos[0].id);
        }
      } catch (err) {
        console.error("Error cargando videos demo:", err);
      }
    };
    cargar();
  }, []);

  // Preview cuando subes un archivo
  useEffect(() => {
    if (!archivo) {
      setVideoPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(archivo);
    setVideoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [archivo]);

  // Preview cuando eliges un demo
  useEffect(() => {
    if (fuenteVideo !== "demo" || !demoSeleccionadoId) {
      return;
    }
    const demo = videosDemo.find((d) => d.id === demoSeleccionadoId);
    if (!demo) return;
    // Cargar intervalos del demo automáticamente
    if (demo.intervalos_robo && demo.intervalos_robo.length > 0) {
      setIntervalos(demo.intervalos_robo);
      setTieneRobo(true);
    } else {
      setIntervalos([{ inicio_seg: 0, fin_seg: 0 }]);
      setTieneRobo(false);
    }
  }, [demoSeleccionadoId, fuenteVideo, videosDemo]);

  useEffect(() => {
    if (!ejecutando) return;
    const inicio = Date.now();
    const intervalo = setInterval(() => {
      setTiempoTranscurrido(Math.floor((Date.now() - inicio) / 1000));
    }, 1000);
    return () => clearInterval(intervalo);
  }, [ejecutando]);

  const onMetadataVideo = (e) => {
    const dur = e.target.duration;
    setDuracionVideo(dur);
    if (fuenteVideo === "upload") {
      setIntervalos([{ inicio_seg: 0, fin_seg: Math.min(15, dur) }]);
    }
  };

  const actualizarIntervalo = (idx, campo, valor) => {
    const nuevos = [...intervalos];
    nuevos[idx] = { ...nuevos[idx], [campo]: parseFloat(valor) || 0 };
    setIntervalos(nuevos);
  };

  const agregarIntervalo = () => {
    setIntervalos([...intervalos, { inicio_seg: 0, fin_seg: 0 }]);
  };

  const quitarIntervalo = (idx) => {
    if (intervalos.length === 1) return;
    setIntervalos(intervalos.filter((_, i) => i !== idx));
  };

  const toggleModelo = (id) => {
    if (ejecutando) return;
    setSeleccionados(
      seleccionados.includes(id)
        ? seleccionados.filter((m) => m !== id)
        : [...seleccionados, id]
    );
  };

  const seleccionarTodos = () => setSeleccionados(MODELOS.map((m) => m.id));
  const limpiarSeleccion = () => setSeleccionados([]);

  const validarIntervalos = () => {
    if (!tieneRobo) return [];
    for (const iv of intervalos) {
      if (iv.fin_seg <= iv.inicio_seg) {
        alert("Cada intervalo debe tener fin > inicio");
        return null;
      }
    }
    return intervalos;
  };

  // ¿Estamos listos para iniciar?
  const fuenteLista =
    (fuenteVideo === "demo" && demoSeleccionadoId) ||
    (fuenteVideo === "upload" && archivo);

  const iniciarBenchmark = async () => {
    if (!fuenteLista) return alert("Selecciona o sube un video");
    if (seleccionados.length === 0) return alert("Selecciona al menos un modelo");

    const intervalosValidos = validarIntervalos();
    if (intervalosValidos === null) return;

    setEjecutando(true);
    setResultados({});
    setTiempoTranscurrido(0);
    const estadoInicial = {};
    seleccionados.forEach((id) => { estadoInicial[id] = "pendiente"; });
    setProgreso(estadoInicial);

    let sid;
    try {
      let res;
      if (fuenteVideo === "demo") {
        // Usar un video demo
        res = await fetch(`${BENCHMARK_URL}/sesion/iniciar-demo`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ demo_id: demoSeleccionadoId }),
        });
      } else {
        // Subir el video
        const formData = new FormData();
        formData.append("file", archivo);
        res = await fetch(`${BENCHMARK_URL}/sesion/iniciar`, {
          method: "POST",
          body: formData,
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Error iniciando sesión");
      sid = data.session_id;
      setSessionId(sid);
      setVideoUrl(`${BENCHMARK_URL}${data.video_url}`);
    } catch (err) {
      alert("Error iniciando sesión: " + err.message);
      setEjecutando(false);
      return;
    }

    for (const modeloId of seleccionados) {
      setModeloActual(modeloId);
      setProgreso((p) => ({ ...p, [modeloId]: "corriendo" }));

      try {
        let data;

        if (MODELOS_VISUALES.has(modeloId)) {
          const urlVisual = `${BENCHMARK_URL}/sesion/${sid}/stream/${modeloId}?t=${Date.now()}`;
          setStreamUrl(urlVisual);

          await sleep(500);

          data = await esperarResultadoStream(
            sid,
            modeloId,
            intervalosValidos
          );
        } else {
          const res = await fetch(
            `${BENCHMARK_URL}/sesion/${sid}/correr/${modeloId}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ intervalos_robo: intervalosValidos }),
            }
          );

          data = await res.json();

          if (!res.ok) {
            throw new Error(data.detail || "Error");
          }
        }

        setResultados((r) => ({ ...r, [modeloId]: data }));
        setProgreso((p) => ({ ...p, [modeloId]: "ok" }));
      } catch (err) {
        console.error(`Error en ${modeloId}:`, err);
        setProgreso((p) => ({ ...p, [modeloId]: "error" }));
      }
    }

    setStreamUrl(null);

    try {
      await fetch(`${BENCHMARK_URL}/sesion/${sid}`, { method: "DELETE" });
    } catch { }

    setModeloActual(null);
    setEjecutando(false);
  };

  const reiniciar = async () => {
    if (sessionId) {
      try {
        await fetch(`${BENCHMARK_URL}/sesion/${sessionId}`, { method: "DELETE" });
      } catch { }
    }

    setResultados({});
    setProgreso({});
    setArchivo(null);
    setVideoUrl(null);
    setStreamUrl(null);
    setSessionId(null);
    setTiempoTranscurrido(0);

    if (fuenteVideo === "upload") {
      setIntervalos([{ inicio_seg: 0, fin_seg: 0 }]);
      setTieneRobo(true);
    }
  };

  const formatearTiempo = (segs) => {
    const m = Math.floor(segs / 60);
    const s = segs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const esperarResultadoStream = async (sid, modeloId, intervalosValidos) => {
    const maxIntentos = 720;

    for (let intento = 0; intento < maxIntentos; intento++) {
      const res = await fetch(
        `${BENCHMARK_URL}/sesion/${sid}/resultado-stream/${modeloId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ intervalos_robo: intervalosValidos }),
        }
      );

      if (res.status === 202) {
        await sleep(1000);
        continue;
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Error obteniendo resultado visual");
      }

      return data;
    }

    throw new Error("El procesamiento visual tardó demasiado o no devolvió resultado.");
  };

  const resultadosOrdenados = Object.entries(resultados)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => {
      const f1A = a.metricas?.f1_score || 0;
      const f1B = b.metricas?.f1_score || 0;
      return f1B - f1A;
    });

  const modelosCompletados = resultadosOrdenados.length;
  const totalModelos = seleccionados.length;
  const completados = Object.values(progreso).filter((e) => e === "ok" || e === "error").length;
  const porcentaje = totalModelos > 0 ? Math.round((completados / totalModelos) * 100) : 0;

  // Para la preview cuando es demo
  const demoActual = videosDemo.find((d) => d.id === demoSeleccionadoId);
  const previewDemoUrl = demoActual
    ? `${BENCHMARK_URL}/videos-demo-preview/${demoSeleccionadoId}`
    : null;

  return (
    <>
      <section className="hero">
        <h1>Benchmark de modelos</h1>
        <p>Compara el rendimiento de los modelos de detección de robos sobre un mismo video.</p>
      </section>

      {ejecutando && videoUrl && (
        <section className="step running-view">
          <div className="running-grid">
            <div className="running-video">
              {streamUrl ? (
                <img
                  key={streamUrl}
                  src={streamUrl}
                  alt="Detección visual del modelo"
                  className="stream-img"
                />
              ) : (
                <video src={videoUrl} controls autoPlay loop muted />
              )}

              <div className="running-video-label">
                {streamUrl ? "Detección visual en vivo" : "Video en análisis"}
              </div>
            </div>

            <div className="running-info">
              <div className="running-stat">
                <span className="running-stat-label">Progreso</span>
                <span className="running-stat-value">{completados}/{totalModelos}</span>
              </div>
              <div className="running-stat">
                <span className="running-stat-label">Tiempo transcurrido</span>
                <span className="running-stat-value">{formatearTiempo(tiempoTranscurrido)}</span>
              </div>

              <div className="progress-bar">
                <div className="progress-bar-fill" style={{ width: `${porcentaje}%` }} />
              </div>

              <div className="running-actual">
                {modeloActual && (
                  <>
                    <span className="spinner" />
                    <div>
                      <span className="running-actual-label">Procesando ahora</span>
                      <span className="running-actual-name">
                        {MODELOS.find((m) => m.id === modeloActual)?.nombre}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="running-queue">
                {seleccionados.map((id) => {
                  const m = MODELOS.find((mm) => mm.id === id);
                  const estado = progreso[id];
                  return (
                    <div key={id} className={`queue-item estado-${estado || "pendiente"}`}>
                      <span className="queue-icon">
                        {estado === "ok" && "✓"}
                        {estado === "error" && "✗"}
                        {estado === "corriendo" && <span className="spinner-sm" />}
                        {estado === "pendiente" && "○"}
                      </span>
                      <span className="queue-name">{m.nombre}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {!ejecutando && (
        <>
          <section className="step">
            <div className="step-head">
              <span className="step-num">1</span>
              <div>
                <h2>Elegir video</h2>
                <p className="step-desc">
                  Usa un video pre-cargado del sistema o sube uno propio.
                </p>
              </div>
            </div>

            <div className="step-body">
              <div className="radio-group">
                <label className={`radio-option ${fuenteVideo === "demo" ? "activa" : ""}`}>
                  <input
                    type="radio"
                    checked={fuenteVideo === "demo"}
                    onChange={() => setFuenteVideo("demo")}
                  />
                  <span>Usar video demo precargado</span>
                </label>
                <label className={`radio-option ${fuenteVideo === "upload" ? "activa" : ""}`}>
                  <input
                    type="radio"
                    checked={fuenteVideo === "upload"}
                    onChange={() => setFuenteVideo("upload")}
                  />
                  <span>Subir mi propio video</span>
                </label>
              </div>

              {fuenteVideo === "demo" && (
                <>
                  {videosDemo.length === 0 ? (
                    <div className="info-box-warning">
                      No hay videos demo disponibles en el servidor.
                    </div>
                  ) : (
                    <>
                      <div className="field-group">
                        <label>Video disponible</label>
                        <select
                          className="select-input"
                          value={demoSeleccionadoId}
                          onChange={(e) => setDemoSeleccionadoId(e.target.value)}
                          style={{ width: "100%" }}
                        >
                          {videosDemo.map((d) => (
                            <option key={d.id} value={d.id}>{d.nombre}</option>
                          ))}
                        </select>
                      </div>

                      {demoActual && demoActual.descripcion && (
                        <div className="info-box">{demoActual.descripcion}</div>
                      )}

                      {demoActual && (
                        <div className="video-preview">
                          <video
                            src={`${BENCHMARK_URL}/sesion-preview-demo?demo_id=${demoActual.id}`}
                            controls
                            onLoadedMetadata={onMetadataVideo}
                          />
                          <div className="video-preview-info">
                            Intervalos de robo: <strong>
                              {demoActual.intervalos_robo.length === 0
                                ? "Ninguno (video normal)"
                                : demoActual.intervalos_robo
                                  .map((iv) => `${iv.inicio_seg}s - ${iv.fin_seg}s`)
                                  .join(", ")
                              }
                            </strong>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {fuenteVideo === "upload" && (
                <>
                  <div className="row">
                    <label className="file-input">
                      <input
                        type="file"
                        accept="video/mp4,video/avi"
                        onChange={(e) => setArchivo(e.target.files[0])}
                      />
                      <span>{archivo ? archivo.name : "Seleccionar video"}</span>
                    </label>
                  </div>

                  {videoPreviewUrl && (
                    <div className="video-preview">
                      <video
                        src={videoPreviewUrl}
                        controls
                        onLoadedMetadata={onMetadataVideo}
                      />
                      <div className="video-preview-info">
                        Duración: <strong>{duracionVideo.toFixed(1)}s</strong>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          {fuenteLista && fuenteVideo === "upload" && (
            <section className="step">
              <div className="step-head">
                <span className="step-num">2</span>
                <div>
                  <h2>Etiquetar intervalos de robo</h2>
                  <p className="step-desc">
                    Marca los segundos del video donde ocurre el robo. Sin esto no podemos calcular las métricas.
                  </p>
                </div>
              </div>

              <div className="step-body">
                <div className="radio-group">
                  <label className={`radio-option ${tieneRobo ? "activa" : ""}`}>
                    <input
                      type="radio"
                      checked={tieneRobo}
                      onChange={() => setTieneRobo(true)}
                    />
                    <span>El video contiene robo</span>
                  </label>
                  <label className={`radio-option ${!tieneRobo ? "activa" : ""}`}>
                    <input
                      type="radio"
                      checked={!tieneRobo}
                      onChange={() => setTieneRobo(false)}
                    />
                    <span>Video totalmente normal (sin robo)</span>
                  </label>
                </div>

                {tieneRobo && (
                  <div className="intervalos-list">
                    {intervalos.map((iv, idx) => (
                      <div key={idx} className="intervalo-row">
                        <span className="intervalo-label">Intervalo {idx + 1}</span>
                        <div className="intervalo-fields">
                          <div className="intervalo-field">
                            <label>Inicio (s)</label>
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={iv.inicio_seg}
                              onChange={(e) => actualizarIntervalo(idx, "inicio_seg", e.target.value)}
                              className="text-input"
                            />
                          </div>
                          <div className="intervalo-field">
                            <label>Fin (s)</label>
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={iv.fin_seg}
                              onChange={(e) => actualizarIntervalo(idx, "fin_seg", e.target.value)}
                              className="text-input"
                            />
                          </div>
                          {intervalos.length > 1 && (
                            <button
                              className="btn-danger-ghost btn-sm"
                              onClick={() => quitarIntervalo(idx)}
                            >
                              Quitar
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    <button className="btn-ghost btn-sm" onClick={agregarIntervalo}>
                      + Agregar otro intervalo
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}

          {fuenteLista && (
            <section className="step">
              <div className="step-head">
                <span className="step-num">{fuenteVideo === "upload" ? "3" : "2"}</span>
                <div>
                  <h2>Elegir modelos</h2>
                  <p className="step-desc">Selecciona qué modelos quieres evaluar.</p>
                </div>
              </div>

              <div className="step-body">
                <div className="modelos-header">
                  <span className="modelos-titulo">
                    Modelos a evaluar ({seleccionados.length}/{MODELOS.length})
                  </span>
                  <div className="modelos-acciones">
                    <button className="btn-ghost btn-sm" onClick={seleccionarTodos}>Todos</button>
                    <button className="btn-ghost btn-sm" onClick={limpiarSeleccion}>Ninguno</button>
                  </div>
                </div>

                <div className="modelos-grid">
                  {MODELOS.map((m) => {
                    const sel = seleccionados.includes(m.id);
                    return (
                      <div
                        key={m.id}
                        className={`modelo-card ${sel ? "seleccionado" : ""}`}
                        onClick={() => toggleModelo(m.id)}
                      >
                        <div className="modelo-card-top">
                          <span className={`modelo-checkbox ${sel ? "marcado" : ""}`}>
                            {sel && <Check />}
                          </span>
                          <span className={`modelo-tag tag-${m.tag.toLowerCase()}`}>{m.tag}</span>
                        </div>
                        <h4>{m.nombre}</h4>
                        <p>{m.desc}</p>
                      </div>
                    );
                  })}
                </div>

                <div className="row" style={{ marginTop: 8 }}>
                  <button
                    className="btn-primary"
                    onClick={iniciarBenchmark}
                    disabled={!fuenteLista || seleccionados.length === 0}
                  >
                    Iniciar benchmark ({seleccionados.length} {seleccionados.length === 1 ? "modelo" : "modelos"})
                  </button>
                  {modelosCompletados > 0 && (
                    <button className="btn-ghost" onClick={reiniciar}>Reiniciar</button>
                  )}
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {modelosCompletados > 0 && !ejecutando && (
        <>
          <section className="step">
            <div className="step-head">
              <span className="step-num">★</span>
              <div>
                <h2>Ranking de modelos</h2>
                <p className="step-desc">Ordenados por F1-Score (balance entre precision y recall).</p>
              </div>
            </div>

            <div className="step-body">
              <div className="ranking-list">
                {resultadosOrdenados.map((r, idx) => {
                  const f1 = r.metricas?.f1_score ?? 0;
                  const medallaClase =
                    idx === 0 ? "medalla-oro" :
                      idx === 1 ? "medalla-plata" :
                        idx === 2 ? "medalla-bronce" : "medalla-otro";
                  return (
                    <div key={r.id} className={`ranking-item ${idx === 0 ? "lider" : ""}`}>
                      <div className={`ranking-medalla ${medallaClase}`}>
                        #{idx + 1}
                      </div>
                      <div className="ranking-info">
                        <h4>{r.nombre_modelo}</h4>
                        <div className="ranking-metricas-small">
                          <span>Precision: <strong>{r.metricas?.precision ?? 0}%</strong></span>
                          <span>Recall: <strong>{r.metricas?.recall ?? 0}%</strong></span>
                          <span>Accuracy: <strong>{r.metricas?.accuracy ?? 0}%</strong></span>
                        </div>
                      </div>
                      <div className="ranking-f1">
                        <span className="ranking-f1-value">{f1}%</span>
                        <span className="ranking-f1-label">F1</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="step">
            <div className="step-head">
              <span className="step-num">∑</span>
              <div>
                <h2>Comparativa detallada</h2>
                <p className="step-desc">Métricas completas y matriz de confusión por modelo.</p>
              </div>
            </div>

            <div className="step-body">
              <div className="tabla-contenedor">
                <table>
                  <thead>
                    <tr>
                      <th>Modelo</th>
                      <th>Accuracy</th>
                      <th>Precision</th>
                      <th>Recall</th>
                      <th>F1</th>
                      <th>TP</th>
                      <th>TN</th>
                      <th>FP</th>
                      <th>FN</th>
                      <th>Tiempo</th>
                      <th>FPS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultadosOrdenados.map((r) => {
                      const m = r.metricas || {};
                      const cm = m.matriz_confusion || {};
                      return (
                        <tr key={r.id}>
                          <td><strong>{r.nombre_modelo}</strong></td>
                          <td><span className="metric-pill">{m.accuracy ?? 0}%</span></td>
                          <td><span className="metric-pill">{m.precision ?? 0}%</span></td>
                          <td><span className="metric-pill">{m.recall ?? 0}%</span></td>
                          <td><span className="metric-pill metric-pill-strong">{m.f1_score ?? 0}%</span></td>
                          <td className="cell-tp">{cm.TP ?? 0}</td>
                          <td className="cell-tn">{cm.TN ?? 0}</td>
                          <td className="cell-fp">{cm.FP ?? 0}</td>
                          <td className="cell-fn">{cm.FN ?? 0}</td>
                          <td>{r.tiempo_total_s}s</td>
                          <td>{r.fps_efectivo}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="leyenda-cm">
                <span className="leyenda-item"><span className="leyenda-dot dot-tp" /> TP: Predijo robo y SÍ era robo</span>
                <span className="leyenda-item"><span className="leyenda-dot dot-tn" /> TN: Predijo normal y SÍ era normal</span>
                <span className="leyenda-item"><span className="leyenda-dot dot-fp" /> FP: Predijo robo pero NO era robo (falso positivo)</span>
                <span className="leyenda-item"><span className="leyenda-dot dot-fn" /> FN: Predijo normal pero SÍ era robo (falso negativo)</span>
              </div>
            </div>
          </section>
        </>
      )}
    </>
  );
}