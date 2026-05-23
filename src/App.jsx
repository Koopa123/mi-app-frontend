import { useRef, useState } from "react";
import "./App.css";

const API_URL = "http://127.0.0.1:8000";

function App() {
  const [archivo, setArchivo] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [historial, setHistorial] = useState([]);

  const [archivoReferencia, setArchivoReferencia] = useState(null);
  const [frameUrl, setFrameUrl] = useState(null);
  const [zonas, setZonas] = useState([]);
  const [dibujando, setDibujando] = useState(false);
  const [inicio, setInicio] = useState(null);

  const imagenRef = useRef(null);

  const subirReferencia = async () => {
    if (!archivoReferencia) {
      alert("Selecciona un video de referencia");
      return;
    }

    const formData = new FormData();
    formData.append("file", archivoReferencia);

    const response = await fetch(`${API_URL}/subir-video-referencia`, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    setFrameUrl(`${API_URL}${data.frame_url}`);
    setZonas([]);
  };

  const obtenerCoordenadas = (e) => {
    const rect = imagenRef.current.getBoundingClientRect();

    const scaleX = imagenRef.current.naturalWidth / rect.width;
    const scaleY = imagenRef.current.naturalHeight / rect.height;

    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);

    return { x, y };
  };

  const iniciarDibujo = (e) => {
    if (!frameUrl) return;

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

    setZonas([...zonas, zona]);
    setDibujando(false);
    setInicio(null);
  };

  const guardarZonas = async () => {
    await fetch(`${API_URL}/guardar-zonas`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ zonas }),
    });

    alert("Zonas guardadas correctamente");
  };

  const borrarZonas = async () => {
    await fetch(`${API_URL}/zonas`, {
      method: "DELETE",
    });

    setZonas([]);
    alert("Zonas eliminadas");
  };

  const procesarVideo = async () => {
    if (!archivo) {
      alert("Selecciona un video primero");
      return;
    }

    setCargando(true);
    setResultado(null);

    const formData = new FormData();
    formData.append("file", archivo);

    try {
      const response = await fetch(`${API_URL}/subir-video`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      setResultado(data);
    } catch (error) {
      alert("Error al subir el video");
      console.error(error);
    } finally {
      setCargando(false);
    }
  };

  const cargarHistorial = async () => {
  const response = await fetch(`${API_URL}/analisis`);
  const data = await response.json();
  setHistorial(data.analisis);
  };

  return (
    <div className="contenedor">
      <div className="card">
        <h1>Sistema de Monitoreo de Aglomeraciones</h1>

        <p className="subtitulo">
          Configura zonas ignoradas y monitorea aglomeraciones con YOLO.
        </p>

        <h2>1. Configurar zonas ignoradas</h2>

        <div className="upload">
          <input
            type="file"
            accept="video/mp4,video/avi"
            onChange={(e) => setArchivoReferencia(e.target.files[0])}
          />

          <button onClick={subirReferencia}>
            Cargar video de referencia
          </button>

          <button onClick={guardarZonas}>
            Guardar zonas
          </button>

          <button onClick={borrarZonas}>
            Borrar zonas
          </button>
        </div>

        {frameUrl && (
          <div className="zona-editor">
            <img
              ref={imagenRef}
              src={frameUrl}
              alt="Frame de referencia"
              draggable="false"
              onDragStart={(e) => e.preventDefault()}
              onMouseDown={iniciarDibujo}
              onMouseUp={terminarDibujo}
            />

            {zonas.map((zona, index) => {
              const img = imagenRef.current;
              if (!img) return null;

              const rect = img.getBoundingClientRect();
              const scaleX = rect.width / img.naturalWidth;
              const scaleY = rect.height / img.naturalHeight;

              return (
                <div
                  key={index}
                  className="zona-rect"
                  style={{
                    left: zona[0] * scaleX,
                    top: zona[1] * scaleY,
                    width: (zona[2] - zona[0]) * scaleX,
                    height: (zona[3] - zona[1]) * scaleY,
                  }}
                />
              );
            })}
          </div>
        )}

        <hr />

        <h2>2. Procesar video</h2>

        <div className="upload">
          <input
            type="file"
            accept="video/mp4,video/avi"
            onChange={(e) => {
              setArchivo(e.target.files[0]);
              setResultado(null);
            }}
          />

          <button onClick={procesarVideo} disabled={cargando}>
            {cargando ? "Subiendo..." : "Iniciar monitoreo"}
          </button>
        </div>

        {archivo && (
          <p className="archivo">
            Video seleccionado: <strong>{archivo.name}</strong>
          </p>
        )}

        {cargando && (
          <div className="loader">
            Subiendo video al servidor...
          </div>
        )}

        {resultado && (
          <div className="resultado">
            <h2>Monitoreo en curso</h2>

            <div className="video-stream">
              <img
                src={`${API_URL}${resultado.stream_url}`}
                alt="Procesamiento en vivo"
                width="100%"
              />
            </div>
          </div>
        )}

        <hr />

        <h2>3. Historial de análisis</h2>

        <button onClick={cargarHistorial}>
          Cargar historial
        </button>

        {historial.length > 0 && (
          <div className="tabla-contenedor">
            <table>
              <thead>
                <tr>
                  <th>Video</th>
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
                    <td>{item.personas_maximas}</td>
                    <td>{item.grupo_mayor_maximo}</td>

                    <td>
                      <span className={`badge ${item.nivel_final.toLowerCase()}`}>
                        {item.nivel_final}
                      </span>
                    </td>

                    <td>
                      {new Date(item.fecha).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
      </div>
    </div>
  );
}

export default App;