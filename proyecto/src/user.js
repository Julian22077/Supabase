import { supabase } from "./supabase.js";

export async function mostrarUser() {
  const app = document.getElementById("app");
  app.innerHTML = `
<section class="profile-container">

  <h2 class="page-title">Perfil del Usuario</h2>

  <div class="user-card">
    <div class="user-card-left">
      <div id="preview" class="avatar-preview" aria-live="polite"></div>
      <div class="small-note">Previsualización de avatar</div>
    </div>

    <form id="user-form" class="user-form" novalidate>
      <label for="nombre">Nombre</label>
      <input type="text" id="nombre" required />

      <label for="correo">Correo (solo lectura)</label>
      <input type="email" id="correo" disabled />

      <label for="bio">Biografía</label>
      <input type="text" id="bio" />

      <label for="avatar-url">Avatar (URL)</label>
      <input type="url" id="avatar-url" placeholder="https://example.com/avatar.jpg" />

      <div class="form-actions">
        <button type="submit" class="btn btn-primary">Actualizar datos</button>
      </div>

      <p id="mensaje" class="form-message" role="status" aria-live="polite"></p>
    </form>
  </div>
</section>
  `;

  const form = document.getElementById("user-form");
  const mensaje = document.getElementById("mensaje");
  const inputNombre = document.getElementById("nombre");
  const inputCorreo = document.getElementById("correo");
  const inputBio = document.getElementById("bio");
  const inputAvatarUrl = document.getElementById("avatar-url");
  const preview = document.getElementById("preview");

  // Obtener usuario actual
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    app.innerHTML = "<p>⚠️ Debes iniciar sesión para ver tu perfil.</p>";
    return;
  }

  const user = userData.user;
  const correo = user.email;

  // Cargar datos desde la tabla 'usuarios'
  const { data, error } = await supabase
    .from("usuarios")
    .select("*")
    .eq("correo", correo)
    .single();

  if (error) {
    mensaje.textContent = "❌ Error cargando datos: " + error.message;
    return;
  }

  // Setear valores iniciales
  inputNombre.value = data.nombre || "";
  inputCorreo.value = data.correo || "";
  inputBio.value = data.bio || "";
  inputAvatarUrl.value = data.avatar_url || "";
  renderPreview(data.avatar_url);

  // Actualizar previsualización cuando cambie el campo URL
  inputAvatarUrl.addEventListener("input", (e) => {
    renderPreview(e.target.value);
  });

  function renderPreview(url) {
    if (!url) {
      preview.innerHTML = "<small>No hay avatar</small>";
      return;
    }
    preview.innerHTML = `<img src="${escapeAttr(
      url
    )}" alt="avatar" style="width:96px;height:96px;border-radius:50%;object-fit:cover;">`;
  }

  // Actualizar datos
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nombre = inputNombre.value.trim();
    const bio = inputBio.value.trim();
    const avatar_url = inputAvatarUrl.value.trim();

    const { error: updateError } = await supabase
      .from("usuarios")
      .update({ nombre, bio, avatar_url })
      .eq("correo", correo);

    if (updateError) {
      mensaje.textContent = "❌ Error al actualizar: " + updateError.message;
      mensaje.style.color = "red";
    } else {
      mensaje.textContent = "✅ Datos actualizados correctamente";
      mensaje.style.color = "green";
      renderPreview(avatar_url);
    }
  });

  // Escapar caracteres en HTML
  function escapeAttr(str) {
    if (!str) return "";
    return String(str)
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}
