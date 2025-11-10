// src/admin.js
import { supabase } from "./supabase.js";

export async function mostrarAdmin() {
  const app = document.getElementById("app");
  app.innerHTML = `
    <h2>⚙️ Panel Administrativo</h2>
    <section id="panel">
      <div id="usuarios"></div>
      <div id="publicaciones"></div>
      <p id="mensaje"></p>
    </section>
  `;

  const mensaje = document.getElementById("mensaje");
  const usuariosDiv = document.getElementById("usuarios");
  const publicacionesDiv = document.getElementById("publicaciones");

  // 🧩 Verificar si el usuario es admin
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    app.innerHTML = "<p>⚠️ Debes iniciar sesión como administrador.</p>";
    return;
  }
  if (user.email !== "julianhernandez2207@gmail.com") {
    app.innerHTML = "<p>⛔ No tienes permisos para acceder a este panel.</p>";
    return;
  }

  // 🧱 Cargar usuarios
  const { data: usuarios, error: errorUsr } = await supabase
    .from("usuarios")
    .select("id, nombre, correo, avatar_url, creado_en")
    .order("creado_en", { ascending: false });

  if (errorUsr) {
    usuariosDiv.innerHTML = `<p>Error cargando usuarios: ${errorUsr.message}</p>`;
    return;
  }

  usuariosDiv.innerHTML = `
    <h3>👥 Lista de Usuarios</h3>
    ${
      usuarios.length === 0
        ? "<p>No hay usuarios registrados.</p>"
        : `<ul>
            ${usuarios
              .map(
                (u) => `
              <li style="margin-bottom:10px;">
                <strong>${escapeHtml(u.nombre || "Sin nombre")}</strong> 
                (${escapeHtml(u.correo || "Sin correo")})
                <div style="font-size:0.9em;color:#555;">
                  Registrado: ${new Date(u.creado_en).toLocaleString()}
                </div>
                ${
                  u.avatar_url
                    ? `<img src="${escapeAttr(u.avatar_url)}" alt="avatar" 
                       style="width:50px;height:50px;border-radius:50%;object-fit:cover;margin-top:4px;">`
                    : ""
                }
                <br>
                <button data-id="${u.id}" class="borrar-usuario" style="margin-top:5px;">
                  🗑️ Eliminar
                </button>
              </li>`
              )
              .join("")}
          </ul>`
    }
  `;

  // 🧩 Cargar publicaciones
  const { data: publicaciones, error: errorPub } = await supabase
    .from("publicaciones")
    .select(`
      id,
      contenido,
      imagen_url,
      creado_en,
      usuario_id,
      usuarios(nombre, correo)
    `)
    .order("creado_en", { ascending: false });

  if (errorPub) {
    publicacionesDiv.innerHTML = `<p>Error cargando publicaciones: ${errorPub.message}</p>`;
    return;
  }

  publicacionesDiv.innerHTML = `
    <h3>📝 Publicaciones</h3>
    ${
      publicaciones.length === 0
        ? "<p>No hay publicaciones registradas.</p>"
        : `<ul>
            ${publicaciones
              .map((pub) => {
                const user = pub.usuarios || {};
                return `
                  <li style="margin-bottom:12px;border-bottom:1px solid #ccc;padding-bottom:8px;">
                    <div><strong>${escapeHtml(user.nombre || "Usuario desconocido")}</strong></div>
                    <p>${escapeHtml(pub.contenido || "")}</p>
                    ${
                      pub.imagen_url
                        ? `<img src="${escapeAttr(pub.imagen_url)}" 
                          alt="imagen" 
                          style="max-width:200px;border-radius:8px;">`
                        : ""
                    }
                    <div style="font-size:0.8em;color:#555;">${new Date(pub.creado_en).toLocaleString()}</div>
                    <button data-id="${pub.id}" class="borrar-publicacion" style="margin-top:5px;">
                      🗑️ Eliminar publicación
                    </button>
                  </li>`;
              })
              .join("")}
          </ul>`
    }
  `;

  // 🗑️ Eliminar usuario
  document.querySelectorAll(".borrar-usuario").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const id = e.target.getAttribute("data-id");
      if (!id) return;
      if (!confirm("¿Seguro que deseas eliminar este usuario?")) return;

      const { error } = await supabase.from("usuarios").delete().eq("id", id);
      if (error) {
        mensaje.textContent = "❌ Error eliminando usuario: " + error.message;
        mensaje.style.color = "red";
      } else {
        mensaje.textContent = "✅ Usuario eliminado correctamente.";
        mensaje.style.color = "green";
        setTimeout(mostrarAdmin, 800);
      }
    });
  });

  // 🗑️ Eliminar publicación
  document.querySelectorAll(".borrar-publicacion").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const id = e.target.getAttribute("data-id");
      if (!id) return;
      if (!confirm("¿Eliminar esta publicación?")) return;

      const { error } = await supabase
        .from("publicaciones")
        .delete()
        .eq("id", id);

      if (error) {
        mensaje.textContent = "❌ Error eliminando publicación: " + error.message;
        mensaje.style.color = "red";
      } else {
        mensaje.textContent = "✅ Publicación eliminada correctamente.";
        mensaje.style.color = "green";
        setTimeout(mostrarAdmin, 800);
      }
    });
  });
}

// 🔒 Helpers de seguridad
function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
function escapeAttr(str) {
  if (str == null) return "";
  return String(str).replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
