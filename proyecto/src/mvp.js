import { supabase } from './supabase.js';

export async function mostrarMVP() {
  const app = document.getElementById('app');
  app.innerHTML = `
<section>
  <h2>Mini Facebook — Publicaciones (MVP)</h2>

  <form id="post-form">
    <textarea name="contenido" id="post-contenido" placeholder="¿Qué estás pensando?" required></textarea>
    <input type="text" name="imagen_post" id="post-imagen" placeholder="URL de imagen (opcional)" />
    <select name="privacidad" id="post-privacidad">
      <option value="publico">Público</option>
      <option value="amigos">Amigos</option>
      <option value="privado">Privado</option>
    </select>
    <button type="submit">Publicar</button>
  </form>

  <p id="mensaje" style="text-align:center;"></p>

</section>
  `;

  const postForm = document.getElementById('post-form');
  const mensaje = document.getElementById('mensaje');
  const feed = document.getElementById('feed-publicaciones');

  // --- Util: escapar HTML básico
  function escapeHtml(s) {
    if (!s) return '';
    return String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  // --- Crear publicación
  postForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    mensaje.textContent = '';
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      mensaje.textContent = '⚠️ Debes iniciar sesión para publicar.';
      return;
    }

    const contenido = document.getElementById('post-contenido').value.trim();
    const imagen_url = document.getElementById('post-imagen').value.trim() || null;
    const privacidad = document.getElementById('post-privacidad').value || 'amigos';

    if (!contenido && !imagen_url) {
      mensaje.textContent = '❗ Escribe algo o añade una imagen.';
      return;
    }

    const { error } = await supabase.from('publicaciones').insert([
      {
        usuario_id: user.id,
        contenido,
        imagen_url,
        privacidad,
      },
    ]);

    if (error) {
      mensaje.textContent = '❌ Error al crear la publicación: ' + error.message;
    } else {
      mensaje.textContent = '✅ Publicación creada';
      postForm.reset();
      cargarPublicaciones();
    }
  });

  // --- Cargar publicaciones (públicas + propias)
  
}
