// src/mvp.js
import { supabase } from './supabase.js';

export async function mostrarMVP() {
  const app = document.getElementById('app');
  app.innerHTML = `
  <section class="mvp-container">
    <h2>Crear publicación</h2>

    <form id="post-form" class="post-form">
      <textarea
        id="post-contenido"
        placeholder="¿Qué estás pensando?"
        required
      ></textarea>

      <input
        type="text"
        id="post-imagen"
        placeholder="URL de imagen (opcional)"
      />

      <select id="post-privacidad">
        <option value="publico">🌍 Público</option>
        <option value="amigos">👥 Amigos</option>
        <option value="privado">🔒 Privado</option>
      </select>

      <button type="submit">Publicar</button>
    </form>

    <p id="mensaje" class="mensaje"></p>
  </section>

  <style>
    .mvp-container {
      max-width: 600px;
      margin: 1rem auto;
      padding: 1rem;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      font-family: system-ui, sans-serif;
    }

    .mvp-container h2 {
      font-size: 1.2rem;
      margin-bottom: 1rem;
      color: #1877f2;
      text-align: center;
    }

    .post-form {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .post-form textarea {
      resize: none;
      min-height: 90px;
      padding: 10px;
      border-radius: 10px;
      border: 1px solid #ccc;
      font-size: 1rem;
    }

    .post-form input,
    .post-form select {
      padding: 8px;
      border-radius: 8px;
      border: 1px solid #ccc;
      font-size: 0.95rem;
    }

    .post-form button {
      background: #1877f2;
      color: #fff;
      border: none;
      padding: 10px;
      border-radius: 8px;
      font-weight: bold;
      cursor: pointer;
      transition: background 0.2s ease;
    }

    .post-form button:hover {
      background: #145db2;
    }

    .mensaje {
      text-align: center;
      margin-top: 0.5rem;
      font-size: 0.9rem;
    }

    /* 📱 Responsive para móviles */
    @media (max-width: 480px) {
      .mvp-container {
        margin: 0.5rem;
        padding: 0.8rem;
      }

      .post-form textarea {
        font-size: 0.95rem;
      }

      .post-form button {
        font-size: 0.9rem;
        padding: 8px;
      }
    }
  </style>
  `;

  const postForm = document.getElementById('post-form');
  const mensaje = document.getElementById('mensaje');

  // --- Crear publicación
  postForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    mensaje.textContent = '';

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;

    if (!user) {
      mensaje.textContent = '⚠️ Debes iniciar sesión para publicar.';
      mensaje.style.color = 'red';
      return;
    }

    const contenido = document.getElementById('post-contenido').value.trim();
    const imagen_url = document.getElementById('post-imagen').value.trim() || null;
    const privacidad = document.getElementById('post-privacidad').value || 'amigos';

    if (!contenido && !imagen_url) {
      mensaje.textContent = '❗ Escribe algo o añade una imagen.';
      mensaje.style.color = 'red';
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
      mensaje.style.color = 'red';
    } else {
      mensaje.textContent = '✅ Publicación creada';
      mensaje.style.color = 'green';
      postForm.reset();
    }
  });
}
