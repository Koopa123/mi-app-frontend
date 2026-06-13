import { useEffect, useRef, useState } from "react";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL;

function App() {
  // PASILLOS
  const [pasillos, setPasillos] = useState([]);
  const [pasilloEditando, setPasilloEditando] = useState(null); // preset que se está editando
  const [zonasEditadas, setZonasEditadas] = useState([]);
  const [creandoNuevo, setCreandoNuevo] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [archivoNuevo, setArchivoNuevo] = useState(null);
  const [subiendoNuevo, setSubiendoNuevo] = useState(false);

  // DIBUJO
  const [dibujando, setDibujando] = useState(false);
  const [inicio, setInicio] = useState(null);
  const imagenRef = useRef(null);

  // ANÁLISIS
  const [archivoAnalisis, setArchivoAnalisis] = useState(null);
  const [pasilloSeleccionado, setPasilloSeleccionado] = useState("");
  const [cargandoAnalisis, setCargandoAnalisis] = useState(false);
  const [resultado, setResultado] = useState(null);

  // HISTORIAL
  const [historial, setHistorial] = useState([]);

  // ============================================================
  // CARGAR PASILLOS AL INICIO
  // ============================================================
  useEffect(() => {
    cargarPasillos();
  }, []);

  const cargarPasillos = async () => {
    try {
      const res = await fetch(`${API_URL}/presets`);
      const data = await res.json();
      setPasillos(data.presets);
    } catch (err) {
      console.error("Error cargando pasillos:", err);
    }
  };

  // ============================================================
  // CREAR NUEVO PASILLO
  // ============================================================
  const crearPasillo = async () => {
    if (!nombreNuevo.trim()) {
      alert("Pon un nombre al pasillo (ej. 'Pasillo A')");
      return;
    }
    if (!archivoNuevo) {
      alert("Selecciona un video de referencia");
      return;
    }

    setSubiendoNuevo(true);
    const formData = new FormData();
    formData.append("nombre", nombreNuevo);
    formData.append("file", archivoNuevo);

    try {
      const res = await fetch(`${API_URL}/presets`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.detail || "Error al crear pasillo");
        return;
      }

      // Refrescar lista y abrir editor para dibujar zonas
      await cargarPasillos();
      setPasilloEditando(data);
      setZonasEditadas([]);
      setCreandoNuevo(false);
      setNombreNuevo("");
      setArchivoNuevo(null);
    } catch (err) {
      console.error(err);
      alert("Error al crear pasillo");
    } finally {
      setSubiendoNuevo(false);
    }
  };

  // ============================================================
  // EDITAR PASILLO EXISTENTE
  // ============================================================
  const abrirEditor = (pasillo) => {
    setPasilloEditando(pasillo);
    setZonasEditadas(pasillo.zonas || []);
    setCreandoNuevo(false);
  };

  const cerrarEditor = () => {
    setPasilloEditando(null);
    setZonasEditadas([]);
  };

  const guardarZonas = async () => {
    try {
      const res = await fetch(`${API_URL}/presets/${pasilloEditando.id}/zonas`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zonas: zonasEditadas }),
      });
      if (!res.ok) throw new Error();
      alert("Zonas guardadas");
      await cargarPasillos();
      cerrarEditor();
    } catch {
      alert("Error al guardar zonas");
    }
  };

  const eliminarPasillo = async (id, nombre) => {
    if (!confirm(`¿Eliminar "${nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await fetch(`${API_URL}/presets/${id}`, { method: "DELETE" });
      await cargarPasillos();
      if (pasilloEditando?.id === id) cerrarEditor();
    } catch {
      alert("Error al eliminar");
    }
  };

  // ============================================================
  // DIBUJO DE ZONAS
  // ============================================================
  const obtenerCoordenadas = (e) => {
    const rect = imagenRef.current.getBoundingClientRect();
    const scaleX = imagenRef.current.naturalWidth / rect.width;
    const scaleY = imagenRef.current.naturalHeight / rect.height;
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);
    return { x, y };
  };

  const iniciarDibujo = (e) => {
    const punto = obtenerCoordenadas(e);
    setInicio(punto);
    setDibujando(true);
  };

  const terminarDibujo = (e) => {
    if (!dibujando || !inicio) return;
    const fin = obtenerCoordenadas(e);
    const zona = [
      Math.min(inicio.x, fin.x),
      Math.min(inicio.y, fin.y),
      Math.max(inicio.x, fin.x),
      Math.max(inicio.y, fin.y),
    ];
    // Ignorar clicks accidentales (muy pequeños)
    if (zona[2] - zona[0] > 5 && zona[3] - zona[1] > 5) {
      setZonasEditadas([...zonasEditadas, zona]);
    }
    setDibujando(false);
    setInicio(null);
  };

  const quitarZona = (idx) => {
    setZonasEditadas(zonasEditadas.filter((_, i) => i !== idx));
  };

  const limpiarZonas = () => setZonasEditadas([]);

  // ============================================================
  // ANÁLISIS
  // ============================================================
  const iniciarAnalisis = async () => {
    if (!archivoAnalisis) {
      alert("Selecciona un video a analizar");
      return;
    }
    if (!pasilloSeleccionado) {
      alert("Selecciona qué pasillo es");
      return;
    }

    setCargandoAnalisis(true);
    setResultado(null);

    const formData = new FormData();
    formData.append("preset_id", pasilloSeleccionado);
    formData.append("file", archivoAnalisis);

    try {
      const res = await fetch(`${API_URL}/analisis`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setResultado(data);
    } catch (err) {
      console.error(err);
      alert("Error al subir el video");
    } finally {
      setCargandoAnalisis(false);
    }
  };

  // ============================================================
  // HISTORIAL
  // ============================================================
  const cargarHistorial = async () => {
    const res = await fetch(`${API_URL}/analisis`);
    const data = await res.json();
    setHistorial(data.analisis);
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-dot" />
            <span className="logo-text">CrowdMonitor</span>
          </div>
          <span className="badge-soft">Sistema de monitoreo inteligente</span>
        </div>
      </header>

      <main className="main">
        <section className="hero">
          <h1>Monitoreo de aglomeraciones</h1>
          <p>Configura los pasillos una sola vez, luego analiza videos eligiendo el pasillo correspondiente.</p>
        </section>

        {/* ============================ PASO 1 ============================ */}
        <section className="step">
          <div className="step-head">
            <span className="step-num">1</span>
            <div>
              <h2>Mis pasillos</h2>
              <p className="step-desc">
                Crea un pasillo subiendo un video de referencia y dibujando las zonas a ignorar (maniquíes, estantes, etc.).
              </p>
            </div>
          </div>

          <div className="step-body">
            {/* LISTA DE PASILLOS */}
            {pasillos.length === 0 && !creandoNuevo && (
              <div className="empty-state">
                <p>Aún no tienes pasillos configurados.</p>
                <button className="btn-primary" onClick={() => setCreandoNuevo(true)}>
                  + Crear primer pasillo
                </button>
              </div>
            )}

            {pasillos.length > 0 && (
              <div className="pasillos-grid">
                {pasillos.map((p) => (
                  <div
                    key={p.id}
                    className={`pasillo-card ${pasilloEditando?.id === p.id ? "activo" : ""}`}
                  >
                    <div className="pasillo-info">
                      <h3>{p.nombre}</h3>
                      <span className="pasillo-meta">
                        {p.zonas.length} {p.zonas.length === 1 ? "zona" : "zonas"}
                      </span>
                    </div>
                    <div className="pasillo-actions">
                      <button className="btn-ghost btn-sm" onClick={() => abrirEditor(p)}>
                        Editar zonas
                      </button>
                      <button
                        className="btn-danger-ghost btn-sm"
                        onClick={() => eliminarPasillo(p.id, p.nombre)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}

                {!creandoNuevo && (
                  <button className="pasillo-add" onClick={() => setCreandoNuevo(true)}>
                    + Agregar pasillo
                  </button>
                )}
              </div>
            )}

            {/* FORMULARIO CREAR NUEVO */}
            {creandoNuevo && (
              <div className="form-crear">
                <h4>Nuevo pasillo</h4>
                <div className="row">
                  <input
                    type="text"
                    className="text-input"
                    placeholder="Nombre (ej. Pasillo A)"
                    value={nombreNuevo}
                    onChange={(e) => setNombreNuevo(e.target.value)}
                  />
                  <label className="file-input">
                    <input
                      type="file"
                      accept="video/mp4,video/avi"
                      onChange={(e) => setArchivoNuevo(e.target.files[0])}
                    />
                    <span>{archivoNuevo ? archivoNuevo.name : "Video de referencia"}</span>
                  </label>
                  <button className="btn-primary" onClick={crearPasillo} disabled={subiendoNuevo}>
                    {subiendoNuevo ? "Procesando..." : "Crear y dibujar zonas"}
                  </button>
                  <button
                    className="btn-ghost"
                    onClick={() => {
                      setCreandoNuevo(false);
                      setNombreNuevo("");
                      setArchivoNuevo(null);
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* EDITOR DE ZONAS */}
            {pasilloEditando && (
              <div className="editor-wrap">
                <div className="editor-header">
                  <div>
                    <h4>Editando: {pasilloEditando.nombre}</h4>
                    <p className="editor-hint">
                      Haz clic y arrastra sobre la imagen para dibujar zonas. Clic en una zona para eliminarla.
                    </p>
                  </div>
                  <div className="editor-actions">
                    <button className="btn-ghost btn-sm" onClick={limpiarZonas}>Limpiar todo</button>
                    <button className="btn-primary btn-sm" onClick={guardarZonas}>
                      Guardar zonas ({zonasEditadas.length})
                    </button>
                    <button className="btn-ghost btn-sm" onClick={cerrarEditor}>Cerrar</button>
                  </div>
                </div>

                <div className="zona-editor">
                  <img
                    ref={imagenRef}
                    src={`${API_URL}${pasilloEditando.frame_url}`}
                    alt="Frame de referencia"
                    draggable="false"
                    onDragStart={(e) => e.preventDefault()}
                    onMouseDown={iniciarDibujo}
                    onMouseUp={terminarDibujo}
                  />
                  {zonasEditadas.map((zona, idx) => {
                    const img = imagenRef.current;
                    if (!img) return null;
                    const rect = img.getBoundingClientRect();
                    const scaleX = rect.width / img.naturalWidth;
                    const scaleY = rect.height / img.naturalHeight;
                    return (
                      <div
                        key={idx}
                        className="zona-rect"
                        style={{
                          left: zona[0] * scaleX,
                          top: zona[1] * scaleY,
                          width: (zona[2] - zona[0]) * scaleX,
                          height: (zona[3] - zona[1]) * scaleY,
                        }}
                        onClick={() => quitarZona(idx)}
                        title="Clic para eliminar"
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ============================ PASO 2 ============================ */}
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
                <input
                  type="file"
                  accept="video/mp4,video/avi"
                  onChange={(e) => {
                    setArchivoAnalisis(e.target.files[0]);
                    setResultado(null);
                  }}
                />
                <span>{archivoAnalisis ? archivoAnalisis.name : "Seleccionar video a analizar"}</span>
              </label>

              <select
                className="select-input"
                value={pasilloSeleccionado}
                onChange={(e) => setPasilloSeleccionado(e.target.value)}
              >
                <option value="">Elegir pasillo...</option>
                {pasillos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} ({p.zonas.length} zonas)
                  </option>
                ))}
              </select>

              <button
                className="btn-primary"
                onClick={iniciarAnalisis}
                disabled={cargandoAnalisis || pasillos.length === 0}
              >
                {cargandoAnalisis ? "Subiendo..." : "Iniciar monitoreo"}
              </button>
            </div>

            {pasillos.length === 0 && (
              <div className="info-box-warning">
                Primero crea al menos un pasillo en el paso 1.
              </div>
            )}

            {cargandoAnalisis && <div className="info-box">Subiendo video al servidor...</div>}

            {resultado && (
              <div className="video-stream">
                <img src={`${API_URL}${resultado.stream_url}`} alt="Procesamiento en vivo" />
              </div>
            )}
          </div>
        </section>

        {/* ============================ PASO 3 ============================ */}
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
                      <th>Video</th>
                      <th>Pasillo</th>
                      <th>Personas máx.</th>
                      <th>Grupo mayor</th>
                      <th>Nivel</th>
                      <th>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historial.map((item) => (
                      <tr key={item.id}>
                        <td>{item.nombre_video}</td>
                        <td>{item.preset_nombre || "—"}</td>
                        <td>{item.personas_maximas}</td>
                        <td>{item.grupo_mayor_maximo}</td>
                        <td>
                          <span className={`badge ${item.nivel_final.toLowerCase()}`}>
                            {item.nivel_final}
                          </span>
                        </td>
                        <td>{new Date(item.fecha).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;