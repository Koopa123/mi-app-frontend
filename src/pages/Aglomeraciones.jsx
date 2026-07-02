import { useEffect, useRef, useState } from "react";
import { API_URL, apiFetch } from "../services/api";
import "../styles/aglomeraciones.css";

export default function Aglomeraciones() {
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
      const res = await apiFetch(`${API_URL}/presets`);
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
      const res = await apiFetch(`${API_URL}/presets`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) return alert(data.detail || "Error");
      await cargarPasillos();
      setPasilloEditando(data);
      setZonasEditadas([]);
      setCreandoNuevo(false);
      setNombreNuevo("");
      setArchivoNuevo(null);
    } finally {
      setSubiendoNuevo(false);
    }
  };

  const abrirEditor = (p) => {
    setPasilloEditando(p);
    setZonasEditadas(p.zonas || []);
    setCreandoNuevo(false);
  };
  const cerrarEditor = () => {
    setPasilloEditando(null);
    setZonasEditadas([]);
  };

  const guardarZonas = async () => {
    const res = await apiFetch(`${API_URL}/presets/${pasilloEditando.id}/zonas`, {
      method: "PUT",
      body: JSON.stringify({ zonas: zonasEditadas }),
    });
    if (!res.ok) return alert("Error al guardar zonas");
    alert("Zonas guardadas");
    await cargarPasillos();
    cerrarEditor();
  };

  const eliminarPasillo = async (id, nombre) => {
    if (!confirm(`¿Eliminar "${nombre}"?`)) return;
    await apiFetch(`${API_URL}/presets/${id}`, { method: "DELETE" });
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

  const iniciarDibujo = (e) => {
    setInicio(obtenerCoordenadas(e));
    setDibujando(true);
  };
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
    setDibujando(false);
    setInicio(null);
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
      const res = await apiFetch(`${API_URL}/analisis`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.detail || "Error iniciando el análisis");
        return;
      }
      setResultado(data);
    } finally {
      setCargandoAnalisis(false);
    }
  };

  const cargarHistorial = async () => {
    const res = await apiFetch(`${API_URL}/analisis`);
    const data = await res.json();
    setHistorial(data.analisis);
  };

  return (
    <>
      <section className="hero hero-dashboard">
        <div className="hero-copy">
          <span className="hero-eyebrow">Módulo de aglomeraciones</span>
          <h1>Control visual de pasillos del centro comercial</h1>
          <p>
            Analiza videos de los pasillos, excluye zonas que no deben contarse y obtén
            una lectura clara del nivel de aglomeración para apoyar al personal de seguridad.
          </p>

          <div className="hero-highlights" aria-label="Capacidades principales">
            <div className="hero-highlight">
              <span>01</span>
              <strong>Configura pasillos</strong>
            </div>
            <div className="hero-highlight">
              <span>02</span>
              <strong>Ignora zonas no válidas</strong>
            </div>
            <div className="hero-highlight">
              <span>03</span>
              <strong>Revisa resultados</strong>
            </div>
          </div>
        </div>

        <aside className="hero-flow-card" aria-label="Flujo del módulo">
          <div className="hero-card-top">
            <div>
              <span className="hero-card-label">Estado del módulo</span>
              <h3>{pasillos.length > 0 ? "Preparado para monitoreo" : "Listo para configurar"}</h3>
            </div>
            <span className={`hero-state ${pasillos.length > 0 ? "ready" : "pending"}`}>
              {pasillos.length > 0 ? "Activo" : "Pendiente"}
            </span>
          </div>

          <div className="hero-status-list">
            <div className={`hero-status-item ${pasillos.length > 0 ? "active" : ""}`}>
              <span className="status-dot" />
              <div>
                <strong>Configuración de pasillos</strong>
                <p>Registra el pasillo y define las zonas que no serán tomadas en cuenta.</p>
              </div>
            </div>

            <div className={`hero-status-item ${archivoAnalisis || resultado ? "active" : ""}`}>
              <span className="status-dot" />
              <div>
                <strong>Monitoreo de video</strong>
                <p>Selecciona un pasillo y procesa el video para calcular la aglomeración.</p>
              </div>
            </div>

            <div className={`hero-status-item ${historial.length > 0 || resultado ? "active" : ""}`}>
              <span className="status-dot" />
              <div>
                <strong>Registro de resultados</strong>
                <p>Consulta el nivel final, el máximo de personas y los eventos analizados.</p>
              </div>
            </div>
          </div>

          <div className="hero-flow-note">
            <span>Flujo recomendado</span>
            <strong>Configurar → Monitorear → Revisar</strong>
          </div>
        </aside>
      </section>

      <section className="step pasillos-section">
        <div className="section-toolbar">
          <div className="step-head compact">
            <span className="step-num">1</span>
            <div>
              <h2>Configuración de pasillos</h2>
              <p className="step-desc">
                Administra los pasillos del centro comercial y define las zonas que el sistema debe ignorar durante el conteo.
              </p>
            </div>
          </div>
          <button
            className="btn-primary"
            onClick={() => setCreandoNuevo(true)}
            disabled={creandoNuevo}
          >
            + Agregar pasillo
          </button>
        </div>

        <div className="step-body">
          <div className="pasillos-summary">
            <div className="summary-card">
              <span className="summary-label">Pasillos registrados</span>
              <strong>{pasillos.length}</strong>
              <small>Disponibles para monitoreo</small>
            </div>
            <div className="summary-card">
              <span className="summary-label">Zonas excluidas</span>
              <strong>
                {pasillos.reduce((total, p) => total + (p.zonas?.length || 0), 0)}
              </strong>
              <small>Áreas ignoradas en el análisis</small>
            </div>
            <div className="summary-card">
              <span className="summary-label">Estado</span>
              <strong>{pasillos.length > 0 ? "Listo" : "Pendiente"}</strong>
              <small>
                {pasillos.length > 0 ? "Ya puedes analizar videos" : "Crea tu primer pasillo"}
              </small>
            </div>
          </div>

          {pasillos.length === 0 && !creandoNuevo && (
            <div className="empty-state empty-state-pro">
              <div className="empty-icon">⌁</div>
              <h3>Aún no tienes pasillos configurados</h3>
              <p>
                Crea un pasillo subiendo un video de referencia. Luego podrás dibujar las zonas que no deben contarse.
              </p>
              <button className="btn-primary" onClick={() => setCreandoNuevo(true)}>
                + Crear primer pasillo
              </button>
            </div>
          )}

          {pasillos.length > 0 && (
            <div className="pasillos-grid pasillos-grid-pro">
              {pasillos.map((p) => {
                const zonasCount = p.zonas?.length || 0;
                const activo = pasilloEditando?.id === p.id;
                return (
                  <div key={p.id} className={`pasillo-card pasillo-card-pro ${activo ? "activo" : ""}`}>
                    <div className="pasillo-card-header">
                      <div className="pasillo-icon">{activo ? "✓" : "P"}</div>
                      <div className="pasillo-status">{activo ? "Editando" : "Configurado"}</div>
                    </div>
                    <div className="pasillo-info">
                      <h3>{p.nombre}</h3>
                      <p>Pasillo registrado para análisis de aglomeraciones.</p>
                    </div>
                    <div className="pasillo-details">
                      <div>
                        <span>Zonas ignoradas</span>
                        <strong>{zonasCount}</strong>
                      </div>
                      <div>
                        <span>Tipo</span>
                        <strong>Video</strong>
                      </div>
                    </div>
                    <div className="pasillo-actions">
                      <button className="btn-ghost btn-sm" onClick={() => abrirEditor(p)}>
                        Editar zonas
                      </button>
                      <button className="btn-danger-ghost btn-sm" onClick={() => eliminarPasillo(p.id, p.nombre)}>
                        Eliminar
                      </button>
                    </div>
                  </div>
                );
              })}

              {!creandoNuevo && (
                <button className="pasillo-add pasillo-add-pro" onClick={() => setCreandoNuevo(true)}>
                  <span>+</span>
                  <strong>Nuevo pasillo</strong>
                  <small>Sube un video de referencia</small>
                </button>
              )}
            </div>
          )}

          {creandoNuevo && (
            <div className="form-crear form-crear-pro">
              <div className="form-crear-head">
                <div>
                  <h4>Nuevo pasillo</h4>
                  <p>
                    Usa un video de referencia del pasillo para obtener un frame y dibujar las zonas a ignorar.
                  </p>
                </div>
                <button
                  className="btn-ghost btn-sm"
                  onClick={() => {
                    setCreandoNuevo(false);
                    setNombreNuevo("");
                    setArchivoNuevo(null);
                  }}
                >
                  Cerrar
                </button>
              </div>

              <div className="crear-grid">
                <div className="field-group">
                  <label>Nombre del pasillo</label>
                  <input
                    type="text"
                    className="text-input"
                    placeholder="Ej. Pasillo principal"
                    value={nombreNuevo}
                    onChange={(e) => setNombreNuevo(e.target.value)}
                  />
                </div>
                <div className="field-group">
                  <label>Video de referencia</label>
                  <label className="file-input file-input-pro">
                    <input
                      type="file"
                      accept="video/mp4,video/avi"
                      onChange={(e) => setArchivoNuevo(e.target.files[0])}
                    />
                    <span>{archivoNuevo ? archivoNuevo.name : "Seleccionar video"}</span>
                  </label>
                </div>
                <div className="crear-action">
                  <button className="btn-primary" onClick={crearPasillo} disabled={subiendoNuevo}>
                    {subiendoNuevo ? "Procesando video..." : "Crear y dibujar zonas"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {pasilloEditando && (
            <div className="editor-wrap editor-wrap-pro">
              <div className="editor-header">
                <div>
                  <span className="editor-kicker">Editor de zonas</span>
                  <h4>{pasilloEditando.nombre}</h4>
                  <p className="editor-hint">
                    Haz clic y arrastra sobre el frame para marcar zonas a ignorar. Haz clic en una zona existente para eliminarla.
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
                  alt="Frame"
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

      <section className="step monitor-section">
        <div className="section-toolbar">
          <div className="step-head compact">
            <span className="step-num">2</span>
            <div>
              <h2>Monitoreo de video</h2>
              <p className="step-desc">
                Selecciona un pasillo y sube el video que deseas analizar para obtener el conteo y nivel de aglomeración en vivo.
              </p>
            </div>
          </div>
          <div className={`monitor-status ${resultado ? "success" : cargandoAnalisis ? "running" : "idle"}`}>
            {resultado ? "Análisis activo" : cargandoAnalisis ? "Procesando" : "En espera"}
          </div>
        </div>

        <div className="monitor-grid">
          <div className="upload-panel">
            <label className={`upload-zone ${archivoAnalisis ? "has-file" : ""}`}>
              <input
                type="file"
                accept="video/mp4,video/avi"
                onChange={(e) => {
                  setArchivoAnalisis(e.target.files[0]);
                  setResultado(null);
                }}
              />
              <div className="upload-icon">{archivoAnalisis ? "✓" : "↑"}</div>
              <div>
                <h3>{archivoAnalisis ? "Video seleccionado" : "Seleccionar video"}</h3>
                <p>
                  {archivoAnalisis ? archivoAnalisis.name : "Sube un archivo MP4 o AVI para iniciar el monitoreo."}
                </p>
              </div>
            </label>

            <div className="field-group">
              <label>Pasillo a monitorear</label>
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
            </div>

            {pasillos.length === 0 && (
              <div className="info-box-warning">
                Primero crea al menos un pasillo en el paso 1 para poder analizar videos.
              </div>
            )}

            <button
              className="btn-primary monitor-button"
              onClick={iniciarAnalisis}
              disabled={cargandoAnalisis || pasillos.length === 0 || !archivoAnalisis || !pasilloSeleccionado}
            >
              {cargandoAnalisis ? "Subiendo video..." : "Iniciar monitoreo"}
            </button>
          </div>

          <div className="monitor-panel">
            <div className="monitor-panel-head">
              <div>
                <span>Resumen</span>
                <h3>Configuración actual</h3>
              </div>
            </div>

            <div className="monitor-summary-list">
              <div className="monitor-summary-item">
                <span>Video</span>
                <strong>{archivoAnalisis ? archivoAnalisis.name : "No seleccionado"}</strong>
              </div>
              <div className="monitor-summary-item">
                <span>Pasillo</span>
                <strong>
                  {pasilloSeleccionado
                    ? pasillos.find((p) => String(p.id) === String(pasilloSeleccionado))?.nombre || "Seleccionado"
                    : "No seleccionado"}
                </strong>
              </div>
              <div className="monitor-summary-item">
                <span>Zonas ignoradas</span>
                <strong>
                  {pasilloSeleccionado
                    ? pasillos.find((p) => String(p.id) === String(pasilloSeleccionado))?.zonas?.length || 0
                    : 0}
                </strong>
              </div>
            </div>

            {cargandoAnalisis && (
              <div className="monitor-loading">
                <span className="spinner" />
                <div>
                  <strong>Preparando análisis</strong>
                  <p>El video se está subiendo al servidor para generar el stream procesado.</p>
                </div>
              </div>
            )}

            {!resultado && !cargandoAnalisis && (
              <div className="monitor-empty-preview">
                <span>Vista previa del procesamiento</span>
                <p>Cuando inicies el monitoreo, aquí aparecerá el video procesado en vivo.</p>
              </div>
            )}
          </div>
        </div>

        {resultado && (
          <div className="stream-card">
            <div className="stream-card-head">
              <div>
                <span>Stream procesado</span>
                <h3>Resultado del monitoreo</h3>
              </div>
              <div className="live-pill">
                <span />
                EN VIVO
              </div>
            </div>
            <div className="video-stream">
              <img src={`${API_URL}${resultado.stream_url}`} alt="Procesamiento en vivo" />
            </div>
          </div>
        )}
      </section>

      <section className="step history-section">
        <div className="section-toolbar">
          <div className="step-head compact">
            <span className="step-num">3</span>
            <div>
              <h2>Registro de resultados</h2>
              <p className="step-desc">
                Consulta los análisis realizados, el nivel final detectado y las métricas principales del monitoreo.
              </p>
            </div>
          </div>
          <button className="btn-ghost" onClick={cargarHistorial}>
            Actualizar historial
          </button>
        </div>

        <div className="history-summary">
          <div className="summary-card">
            <span className="summary-label">Análisis cargados</span>
            <strong>{historial.length}</strong>
            <small>Registros disponibles en pantalla</small>
          </div>
          <div className="summary-card">
            <span className="summary-label">Nivel alto</span>
            <strong>
              {historial.filter((item) => String(item.nivel_final || "").toLowerCase() === "alto").length}
            </strong>
            <small>Eventos con mayor prioridad</small>
          </div>
          <div className="summary-card">
            <span className="summary-label">Personas máximas</span>
            <strong>
              {historial.length > 0 ? Math.max(...historial.map((item) => item.personas_maximas || 0)) : 0}
            </strong>
            <small>Mayor conteo registrado</small>
          </div>
        </div>

        {historial.length === 0 ? (
          <div className="history-empty">
            <div className="history-empty-icon">↻</div>
            <h3>No hay historial cargado</h3>
            <p>
              Presiona "Actualizar historial" para consultar los análisis almacenados en el servidor.
            </p>
            <button className="btn-primary" onClick={cargarHistorial}>
              Cargar historial
            </button>
          </div>
        ) : (
          <div className="history-table-card">
            <div className="history-table-head">
              <div>
                <span>Historial</span>
                <h3>Últimos análisis registrados</h3>
              </div>
              <div className="history-count">
                {historial.length} {historial.length === 1 ? "registro" : "registros"}
              </div>
            </div>

            <div className="tabla-contenedor history-table-wrap">
              <table className="history-table">
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
                        <span className={`badge ${String(item.nivel_final || "").toLowerCase()}`}>
                          {item.nivel_final || "—"}
                        </span>
                      </td>
                      <td>{new Date(item.fecha).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </>
  );
}