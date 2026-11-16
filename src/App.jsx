import { useEffect, useRef, useState } from "react";
import { Client } from "@stomp/stompjs";

export const SERVER = "http://localhost:8080";
const WS_URL = "ws://localhost:8080/ws";

export default function App() {
  const [usuario, setUsuario] = useState("");
  const [rolGamer, setRolGamer] = useState("ASSAULT");
  const [conectado, setConectado] = useState(false);
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState("");
  const [subiendo, setSubiendo] = useState(false);

  const clientRef = useRef(null);
  const finRef = useRef(null);
  const fileInputRef = useRef(null);

  function conectar(e) {
    e.preventDefault();
    if (!usuario.trim()) return;

    const client = new Client({
      brokerURL: WS_URL,
      reconnectDelay: 3000,
      onConnect: () => {
        setConectado(true);
        client.subscribe("/topic/sala", (frame) => {
          try {
            const data = JSON.parse(frame.body);
            setMensajes((prev) => [...prev, data]);
          } catch (err) {
            console.error("Error parseando mensaje STOMP:", err);
          }
        });
        client.publish({
          destination: "/app/chat.unirse",
          body: JSON.stringify({ tipo: "UNION", autor: usuario.trim() }),
        });
      },
      onWebSocketClose: () => setConectado(false),
    });

    client.activate();
    clientRef.current = client;
  }

  function enviar(tipo, contenido) {
    if (!clientRef.current?.connected) return;
    clientRef.current.publish({
      destination: "/app/chat.enviar",
      body: JSON.stringify({ tipo, autor: usuario.trim(), contenido }),
    });
  }

  function enviarTexto(e) {
    e.preventDefault();
    if (!texto.trim()) return;
    enviar("TEXTO", texto.trim());
    setTexto("");
  }

  async function subirArchivo(archivo) {
    setSubiendo(true);
    try {
      const datos = new FormData();
      datos.append("archivo", archivo);
      const r = await fetch(SERVER + "/api/archivos", {
        method: "POST",
        body: datos,
      });
      if (!r.ok) throw new Error("Error en la subida");
      const resp = await r.json();
      return resp.url;
    } finally {
      setSubiendo(false);
    }
  }

  async function manejarSeleccionImagen(e) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    try {
      const url = await subirArchivo(archivo);
      enviar("IMAGEN", url);
    } catch (err) {
      console.error("Fallo al subir captura:", err);
      alert("Error al subir la imagen. Verifica que chat-server esté activo.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  useEffect(() => {
    return () => {
      clientRef.current?.deactivate();
    };
  }, []);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  // Pantalla de Login / Matchmaking Lobby
  if (!conectado) {
    return (
      <div className="gamer-viewport">
        <div className="login-card">
          <div className="gamer-brand">
            <span className="brand-badge">MATCHMAKING ONLINE · 128 TICK</span>
            <h1>🎮 LOBBY GAMER</h1>
            <p className="subtitle">SALA DE OPERACIONES MULTIPLAYER</p>
          </div>

          <form onSubmit={conectar} className="login-form">
            <div className="field-group">
              <label>GAMERTAG / ALIAS</label>
              <input
                type="text"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="Ej: CyberGhost_99"
                maxLength={20}
                required
                autoFocus
              />
            </div>

            <div className="field-group">
              <label>CLASE / ROL TÁCTICO</label>
              <div className="role-selector">
                {["ASSAULT", "SNIPER", "MEDIC", "SUPPORT"].map((rol) => (
                  <button
                    key={rol}
                    type="button"
                    className={`role-btn ${rolGamer === rol ? "active" : ""}`}
                    onClick={() => setRolGamer(rol)}
                  >
                    {rol === "ASSAULT" && "⚔️ "}
                    {rol === "SNIPER" && "🎯 "}
                    {rol === "MEDIC" && "💉 "}
                    {rol === "SUPPORT" && "🛡️ "}
                    {rol}
                  </button>
                ))}
              </div>
            </div>

            <div className="server-status-pill">
              <span className="pulse-indicator"></span>
              <span>BROKER STOMP: ws://localhost:8080/ws (READY)</span>
            </div>

            <button type="submit" className="btn-join">
              <span>INGRESAR A LA PARTIDA</span>
              <span className="btn-arrow">▶</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Pantalla Principal de la Sala Gamer
  return (
    <div className="gamer-viewport">
      <main className="gamer-chat-terminal">
        {/* Cabecera del Lobby */}
        <header className="terminal-header">
          <div className="header-left">
            <div className="live-status">
              <span className="pulse-indicator"></span>
              <span className="live-text">EN VIVO</span>
            </div>
            <div className="lobby-titles">
              <h2>🎮 LOBBY #01 · SQUAD ARENA</h2>
              <span className="dest-tag">CANAL: /topic/sala | 15ms</span>
            </div>
          </div>

          <div className="header-right">
            <div className="player-badge">
              <span className="role-tag">{rolGamer}</span>
              <span className="player-name">{usuario}</span>
            </div>
            <button
              className="btn-disconnect"
              onClick={() => {
                clientRef.current?.deactivate();
                setConectado(false);
              }}
              title="Salir de la sala"
            >
              SALIR ✕
            </button>
          </div>
        </header>

        {/* Zona de Mensajes */}
        <ul className="terminal-feed">
          {mensajes.map((m, i) => {
            const esMio = m.autor === usuario;
            const esSistema = m.tipo === "UNION" || m.tipo === "SALIDA";

            if (esSistema) {
              const esUnion = m.tipo === "UNION";
              return (
                <li key={i} className={`feed-item system-alert ${esUnion ? "joined" : "left"}`}>
                  <div className="alert-content">
                    <span className="alert-icon">{esUnion ? "⚡" : "🔌"}</span>
                    <span className="alert-label">
                      {esUnion ? "[PLAYER CONNECTED]" : "[PLAYER DISCONNECTED]"}
                    </span>
                    <span className="alert-msg">{m.contenido}</span>
                    <span className="feed-time">{m.fecha}</span>
                  </div>
                </li>
              );
            }

            return (
              <li key={i} className={`feed-item message-bubble ${esMio ? "mine" : "theirs"}`}>
                <div className="message-header">
                  <span className="author-rank">{esMio ? "⭐ TÚ" : "🕹️ JUGADOR"}</span>
                  <strong className="author-name">{m.autor}</strong>
                  <span className="feed-time">{m.fecha}</span>
                </div>

                <div className="message-body">
                  {m.tipo === "TEXTO" && (
                    <p className="text-payload">{m.contenido}</p>
                  )}

                  {m.tipo === "IMAGEN" && (
                    <div className="screenshot-card">
                      <div className="screenshot-badge">
                        <span>📸 SCREENSHOT / CLIP TÁCTICO</span>
                      </div>
                      <img
                        src={SERVER + m.contenido}
                        alt="Screenshot compartido"
                        className="screenshot-img"
                        onClick={() => window.open(SERVER + m.contenido, "_blank")}
                        title="Haz clic para abrir imagen en grande"
                      />
                    </div>
                  )}

                  {m.tipo === "AUDIO" && (
                    <div className="audio-card">
                      <span>🎙️ TRANSMISIÓN DE VOZ</span>
                      <audio controls src={SERVER + m.contenido} />
                    </div>
                  )}
                </div>
              </li>
            );
          })}
          <li ref={finRef} />
        </ul>

        {/* Indicador de subida si está procesando una imagen */}
        {subiendo && (
          <div className="upload-indicator">
            <span className="upload-spinner"></span>
            <span>SUBIENDO SCREENSHOT AL SERVIDOR HTTP (POST /api/archivos)...</span>
          </div>
        )}

        {/* Barra de Controles y Envío */}
        <footer className="terminal-controls">
          <form onSubmit={enviarTexto} className="send-form">
            {/* Input oculto para subir imágenes */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              style={{ display: "none" }}
              onChange={manejarSeleccionImagen}
            />

            <button
              type="button"
              className="btn-media"
              onClick={() => fileInputRef.current?.click()}
              disabled={subiendo}
              title="Compartir Captura / Imagen con el Lobby"
            >
              📸 <span>IMAGEN</span>
            </button>

            <input
              type="text"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Escribe táctica o mensaje para el escuadrón..."
              className="text-input"
              disabled={subiendo}
            />

            <button type="submit" className="btn-send" disabled={!texto.trim() || subiendo}>
              ENVIAR 🕹️
            </button>
          </form>
        </footer>
      </main>
    </div>
  );
}
