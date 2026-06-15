import { useEffect, useRef, useState } from "react";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL;
const BENCHMARK_URL = import.meta.env.VITE_BENCHMARK_URL;
const REALTIME_URL = import.meta.env.VITE_REALTIME_URL;

function App() {
  const [tab, setTab] = useState("aglomeraciones");

  return (
    <div className="app">
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
        </div>
      </header>

      <main className="main">
        {tab === "aglomeraciones" && <Aglomeraciones />}
        {tab === "benchmark" && <Benchmark />}
        {tab === "realtime" && <Realtime />}
      </main>
    </div>
  );
}

// ============================================================
// AGLOMERACIONES (lo que ya tenías, sin cambios)
// ============================================================
function Aglomeraciones() {
  const [pasillos, setPasillos] = useState([]);
  const [pasilloEditando, setPasilloEditando] = useState(null);
  const [zonasEditadas, setZonasEditadas] = useState([]);
  const [creandoNuevo, setCreandoNuevo] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [archivoNuevo, setArchivoNuevo] = useState(null);
  const [subiendoNuevo, setSubiendoNuevo] = useState(false);
  const [dibujando, setDibujando] = useState(false);
  const [inicio, setInicio] = useState(null);
  const imagenRef = useRef(null);
  const [archivoAnalisis, setArchivoAnalisis] = useState(null);
  const [pasilloSeleccionado, setPasilloSeleccionado] = useState("");
  const [cargandoAnalisis, setCargandoAnalisis] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [historial, setHistorial] = useState([]);

  useEffect(() => { cargarPasillos(); }, []);

  const cargarPasillos = async () => {
    try {
      const res = await fetch(`${API_URL}/presets`);
      const data = await res.json();
      setPasillos(data.presets);
    } catch (err) { console.error(err); }
  };

  const crearPasillo = async () => {
    if (!nombreNuevo.trim()) return alert("Pon un nombre");
    if (!archivoNuevo) return alert("Selecciona un video");
    setSubiendoNuevo(true);
    const formData = new FormData();
    formData.append("nombre", nombreNuevo);
    formData.append("file", archivoNuevo);
    try {
      const res = await fetch(`${API_URL}/presets`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) return alert(data.detail || "Error");
      await cargarPasillos();
      setPasilloEditando(data);
      setZonasEditadas([]);
      setCreandoNuevo(false);
      setNombreNuevo("");
      setArchivoNuevo(null);
    } finally { setSubiendoNuevo(false); }
  };

  const abrirEditor = (p) => { setPasilloEditando(p); setZonasEditadas(p.zonas || []); setCreandoNuevo(false); };
  const cerrarEditor = () => { setPasilloEditando(null); setZonasEditadas([]); };

  const guardarZonas = async () => {
    const res = await fetch(`${API_URL}/presets/${pasilloEditando.id}/zonas`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ zonas: zonasEditadas }),
    });
    if (!res.ok) return alert("Error al guardar zonas");
    alert("Zonas guardadas");
    await cargarPasillos();
    cerrarEditor();
  };

  const eliminarPasillo = async (id, nombre) => {
    if (!confirm(`¿Eliminar "${nombre}"?`)) return;
    await fetch(`${API_URL}/presets/${id}`, { method: "DELETE" });
    await cargarPasillos();
    if (pasilloEditando?.id === id) cerrarEditor();
  };

  const obtenerCoordenadas = (e) => {
    const rect = imagenRef.current.getBoundingClientRect();
    const scaleX = imagenRef.current.naturalWidth / rect.width;
    const scaleY = imagenRef.current.naturalHeight / rect.height;
    return {
      x: Math.round((e.clientX - rect.left) * scaleX),
      y: Math.round((e.clientY - rect.top) * scaleY),
    };
  };

  const iniciarDibujo = (e) => { setInicio(obtenerCoordenadas(e)); setDibujando(true); };
  const terminarDibujo = (e) => {
    if (!dibujando || !inicio) return;
    const fin = obtenerCoordenadas(e);
    const zona = [
      Math.min(inicio.x, fin.x), Math.min(inicio.y, fin.y),
      Math.max(inicio.x, fin.x), Math.max(inicio.y, fin.y),
    ];
    if (zona[2] - zona[0] > 5 && zona[3] - zona[1] > 5) {
      setZonasEditadas([...zonasEditadas, zona]);
    }
    setDibujando(false); setInicio(null);
  };

  const quitarZona = (idx) => setZonasEditadas(zonasEditadas.filter((_, i) => i !== idx));
  const limpiarZonas = () => setZonasEditadas([]);

  const iniciarAnalisis = async () => {
    if (!archivoAnalisis) return alert("Selecciona un video");
    if (!pasilloSeleccionado) return alert("Selecciona un pasillo");
    setCargandoAnalisis(true);
    setResultado(null);
    const formData = new FormData();
    formData.append("preset_id", pasilloSeleccionado);
    formData.append("file", archivoAnalisis);
    try {
      const res = await fetch(`${API_URL}/analisis`, { method: "POST", body: formData });
      const data = await res.json();
      setResultado(data);
    } finally { setCargandoAnalisis(false); }
  };

  const cargarHistorial = async () => {
    const res = await fetch(`${API_URL}/analisis`);
    const data = await res.json();
    setHistorial(data.analisis);
  };

  return (
    <>
      <section className="hero">
        <h1>Monitoreo de aglomeraciones</h1>
        <p>Configura los pasillos una sola vez, luego analiza videos eligiendo el pasillo correspondiente.</p>
      </section>

      <section className="step">
        <div className="step-head">
          <span className="step-num">1</span>
          <div>
            <h2>Mis pasillos</h2>
            <p className="step-desc">Crea un pasillo subiendo un video de referencia y dibujando las zonas a ignorar.</p>
          </div>
        </div>
        <div className="step-body">
          {pasillos.length === 0 && !creandoNuevo && (
            <div className="empty-state">
              <p>Aún no tienes pasillos configurados.</p>
              <button className="btn-primary" onClick={() => setCreandoNuevo(true)}>+ Crear primer pasillo</button>
            </div>
          )}

          {pasillos.length > 0 && (
            <div className="pasillos-grid">
              {pasillos.map((p) => (
                <div key={p.id} className={`pasillo-card ${pasilloEditando?.id === p.id ? "activo" : ""}`}>
                  <div className="pasillo-info">
                    <h3>{p.nombre}</h3>
                    <span className="pasillo-meta">{p.zonas.length} {p.zonas.length === 1 ? "zona" : "zonas"}</span>
                  </div>
                  <div className="pasillo-actions">
                    <button className="btn-ghost btn-sm" onClick={() => abrirEditor(p)}>Editar zonas</button>
                    <button className="btn-danger-ghost btn-sm" onClick={() => eliminarPasillo(p.id, p.nombre)}>Eliminar</button>
                  </div>
                </div>
              ))}
              {!creandoNuevo && (
                <button className="pasillo-add" onClick={() => setCreandoNuevo(true)}>+ Agregar pasillo</button>
              )}
            </div>
          )}

          {creandoNuevo && (
            <div className="form-crear">
              <h4>Nuevo pasillo</h4>
              <div className="row">
                <input type="text" className="text-input" placeholder="Nombre (ej. Pasillo A)" value={nombreNuevo} onChange={(e) => setNombreNuevo(e.target.value)} />
                <label className="file-input">
                  <input type="file" accept="video/mp4,video/avi" onChange={(e) => setArchivoNuevo(e.target.files[0])} />
                  <span>{archivoNuevo ? archivoNuevo.name : "Video de referencia"}</span>
                </label>
                <button className="btn-primary" onClick={crearPasillo} disabled={subiendoNuevo}>
                  {subiendoNuevo ? "Procesando..." : "Crear y dibujar zonas"}
                </button>
                <button className="btn-ghost" onClick={() => { setCreandoNuevo(false); setNombreNuevo(""); setArchivoNuevo(null); }}>Cancelar</button>
              </div>
            </div>
          )}

          {pasilloEditando && (
            <div className="editor-wrap">
              <div className="editor-header">
                <div>
                  <h4>Editando: {pasilloEditando.nombre}</h4>
                  <p className="editor-hint">Clic y arrastra para dibujar zonas. Clic en una zona para eliminarla.</p>
                </div>
                <div className="editor-actions">
                  <button className="btn-ghost btn-sm" onClick={limpiarZonas}>Limpiar todo</button>
                  <button className="btn-primary btn-sm" onClick={guardarZonas}>Guardar zonas ({zonasEditadas.length})</button>
                  <button className="btn-ghost btn-sm" onClick={cerrarEditor}>Cerrar</button>
                </div>
              </div>
              <div className="zona-editor">
                <img ref={imagenRef} src={`${API_URL}${pasilloEditando.frame_url}`} alt="Frame" draggable="false"
                  onDragStart={(e) => e.preventDefault()} onMouseDown={iniciarDibujo} onMouseUp={terminarDibujo} />
                {zonasEditadas.map((zona, idx) => {
                  const img = imagenRef.current;
                  if (!img) return null;
                  const rect = img.getBoundingClientRect();
                  const scaleX = rect.width / img.naturalWidth;
                  const scaleY = rect.height / img.naturalHeight;
                  return (
                    <div key={idx} className="zona-rect"
                      style={{ left: zona[0] * scaleX, top: zona[1] * scaleY, width: (zona[2] - zona[0]) * scaleX, height: (zona[3] - zona[1]) * scaleY }}
                      onClick={() => quitarZona(idx)} title="Clic para eliminar" />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="step">
        <div className="step-head">
          <span className="step-num">2</span>
          <div>
            <h2>Analizar video</h2>
            <p className="step-desc">Sube el video, elige a qué pasillo pertenece e inicia el monitoreo.</p>
          </div>
        </div>
        <div className="step-body">
          <div className="row">
            <label className="file-input">
              <input type="file" accept="video/mp4,video/avi" onChange={(e) => { setArchivoAnalisis(e.target.files[0]); setResultado(null); }} />
              <span>{archivoAnalisis ? archivoAnalisis.name : "Seleccionar video a analizar"}</span>
            </label>
            <select className="select-input" value={pasilloSeleccionado} onChange={(e) => setPasilloSeleccionado(e.target.value)}>
              <option value="">Elegir pasillo...</option>
              {pasillos.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre} ({p.zonas.length} zonas)</option>
              ))}
            </select>
            <button className="btn-primary" onClick={iniciarAnalisis} disabled={cargandoAnalisis || pasillos.length === 0}>
              {cargandoAnalisis ? "Subiendo..." : "Iniciar monitoreo"}
            </button>
          </div>
          {pasillos.length === 0 && <div className="info-box-warning">Primero crea al menos un pasillo en el paso 1.</div>}
          {cargandoAnalisis && <div className="info-box">Subiendo video al servidor...</div>}
          {resultado && (
            <div className="video-stream">
              <img src={`${API_URL}${resultado.stream_url}`} alt="Procesamiento en vivo" />
            </div>
          )}
        </div>
      </section>

      <section className="step">
        <div className="step-head">
          <span className="step-num">3</span>
          <div>
            <h2>Historial de análisis</h2>
            <p className="step-desc">Consulta los análisis previos almacenados.</p>
          </div>
        </div>
        <div className="step-body">
          <button className="btn-ghost" onClick={cargarHistorial}>Cargar historial</button>
          {historial.length > 0 && (
            <div className="tabla-contenedor">
              <table>
                <thead>
                  <tr>
                    <th>Video</th><th>Pasillo</th><th>Personas máx.</th><th>Grupo mayor</th><th>Nivel</th><th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map((item) => (
                    <tr key={item.id}>
                      <td>{item.nombre_video}</td>
                      <td>{item.preset_nombre || "—"}</td>
                      <td>{item.personas_maximas}</td>
                      <td>{item.grupo_mayor_maximo}</td>
                      <td><span className={`badge ${item.nivel_final.toLowerCase()}`}>{item.nivel_final}</span></td>
                      <td>{new Date(item.fecha).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

// ============================================================
// BENCHMARK
// ============================================================

const MODELOS = [
  { id: "videomae", nombre: "VideoMAE", desc: "Clasificador temporal de secuencias de 16 frames", tag: "Video" },
  { id: "exp5", nombre: "YOLOv8 Exp5", desc: "Fine-tuning de YOLOv8s con dataset original", tag: "Frame" },
  { id: "exp8", nombre: "YOLOv8 Exp8", desc: "Fine-tuning de YOLOv8s con data augmentation", tag: "Frame" },
  { id: "pose_xgb_booster", nombre: "Pose + XGBoost Booster", desc: "YOLO Pose entrenado + XGBoost Booster", tag: "Pose" },
  { id: "pose_svm", nombre: "Pose + SVM", desc: "YOLO Pose genérico + SVM normalizado", tag: "Pose" },
  { id: "pose_xgb_norm", nombre: "Pose + XGBoost Norm", desc: "YOLO Pose genérico + XGBoost normalizado", tag: "Pose" },
];

function Benchmark() {
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

  // Crear URL del preview cuando se sube un archivo
  useEffect(() => {
    if (!archivo) {
      setVideoPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(archivo);
    setVideoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [archivo]);

  // Cronómetro
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
    setIntervalos([{ inicio_seg: 0, fin_seg: Math.min(15, dur) }]);
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
      if (iv.fin_seg > duracionVideo + 0.5) {
        alert(`El intervalo se sale del video (duración: ${duracionVideo.toFixed(1)}s)`);
        return null;
      }
    }
    return intervalos;
  };

  const iniciarBenchmark = async () => {
    if (!archivo) return alert("Sube un video primero");
    if (seleccionados.length === 0) return alert("Selecciona al menos un modelo");

    const intervalosValidos = validarIntervalos();
    if (intervalosValidos === null) return;

    setEjecutando(true);
    setResultados({});
    setTiempoTranscurrido(0);
    const estadoInicial = {};
    seleccionados.forEach((id) => { estadoInicial[id] = "pendiente"; });
    setProgreso(estadoInicial);

    // Subir video una sola vez
    let sid;
    try {
      const formData = new FormData();
      formData.append("file", archivo);
      const res = await fetch(`${BENCHMARK_URL}/sesion/iniciar`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Error subiendo video");
      sid = data.session_id;
      setSessionId(sid);
      setVideoUrl(`${BENCHMARK_URL}${data.video_url}`);
    } catch (err) {
      alert("Error subiendo video: " + err.message);
      setEjecutando(false);
      return;
    }

    // Correr modelos en serie
    for (const modeloId of seleccionados) {
      setModeloActual(modeloId);
      setProgreso((p) => ({ ...p, [modeloId]: "corriendo" }));

      try {
        const res = await fetch(
          `${BENCHMARK_URL}/sesion/${sid}/correr/${modeloId}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ intervalos_robo: intervalosValidos }),
          }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Error");
        setResultados((r) => ({ ...r, [modeloId]: data }));
        setProgreso((p) => ({ ...p, [modeloId]: "ok" }));
      } catch (err) {
        console.error(`Error en ${modeloId}:`, err);
        setProgreso((p) => ({ ...p, [modeloId]: "error" }));
      }
    }

    try {
      await fetch(`${BENCHMARK_URL}/sesion/${sid}`, { method: "DELETE" });
    } catch {}

    setModeloActual(null);
    setEjecutando(false);
  };

  const reiniciar = async () => {
    if (sessionId) {
      try {
        await fetch(`${BENCHMARK_URL}/sesion/${sessionId}`, { method: "DELETE" });
      } catch {}
    }
    setResultados({});
    setProgreso({});
    setArchivo(null);
    setVideoUrl(null);
    setSessionId(null);
    setTiempoTranscurrido(0);
    setIntervalos([{ inicio_seg: 0, fin_seg: 0 }]);
    setTieneRobo(true);
  };

  const formatearTiempo = (segs) => {
    const m = Math.floor(segs / 60);
    const s = segs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Ordenar por F1 para el ranking
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

  return (
    <>
      <section className="hero">
        <h1>Benchmark de modelos</h1>
        <p>Compara el rendimiento de los modelos de detección de robos sobre un mismo video.</p>
      </section>

      {/* PANTALLA DE EJECUCIÓN */}
      {ejecutando && videoUrl && (
        <section className="step running-view">
          <div className="running-grid">
            <div className="running-video">
              <video src={videoUrl} controls autoPlay loop muted />
              <div className="running-video-label">Video en análisis</div>
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

      {/* CONFIGURACIÓN */}
      {!ejecutando && (
        <>
          <section className="step">
            <div className="step-head">
              <span className="step-num">1</span>
              <div>
                <h2>Subir video</h2>
                <p className="step-desc">Sube el video que quieres analizar.</p>
              </div>
            </div>

            <div className="step-body">
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
            </div>
          </section>

          {videoPreviewUrl && (
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
                              max={duracionVideo}
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
                              max={duracionVideo}
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

          {videoPreviewUrl && (
            <section className="step">
              <div className="step-head">
                <span className="step-num">3</span>
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
                    disabled={!archivo || seleccionados.length === 0}
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

      {/* RESULTADOS */}
      {modelosCompletados > 0 && !ejecutando && (
        <>
          {/* RANKING */}
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

          {/* TABLA COMPLETA */}
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

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span className="metric-value">{value}</span>
      <span className="metric-label">{label}</span>
    </div>
  );
}

function Check() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// ============================================================
// TIEMPO REAL
// ============================================================
function Realtime() {
  const [modelos, setModelos] = useState([]);
  const [modeloId, setModeloId] = useState("");
  const [activo, setActivo] = useState(false);
  const [iniciando, setIniciando] = useState(false);
  const [streamUrl, setStreamUrl] = useState(null);
  const [error, setError] = useState(null);

  // Cargar lista de modelos al entrar
  useEffect(() => {
    const cargar = async () => {
      try {
        const res = await fetch(`${REALTIME_URL}/modelos`);
        const data = await res.json();
        setModelos(data.modelos);
        if (data.modelos.length > 0) {
          // Selecciona el primer modelo rápido por defecto
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

    // Cleanup al salir de la pestaña
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
      // Por si hay una sesión activa colgada
      await detenerSilencioso();
      await new Promise((r) => setTimeout(r, 300));

      const res = await fetch(`${REALTIME_URL}/iniciar/${modeloId}?camera_id=0`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Error iniciando");

      // Forzar refresh con timestamp para evitar cacheo
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
      // Si está activo, detener primero y arrancar con el nuevo modelo
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

export default App;