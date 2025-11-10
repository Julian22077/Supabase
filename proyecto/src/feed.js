// src/feed.js
import { supabase } from './supabase.js';

function escapeHtml(s) {
  if (!s) return '';
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export async function mostrarFeed() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <section>
      <h2>Feed</h2>
      <div id="feed-publicaciones">Cargando publicaciones...</div>
    </section>
  `;
  const feed = document.getElementById('feed-publicaciones');

  async function cargarPublicaciones() {
    feed.innerHTML = 'Cargando publicaciones...';

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;

    let q = supabase
      .from('publicaciones')
      .select('id, usuario_id, contenido, imagen_url, privacidad, creado_en');

    if (user) {
      q = q.or(`privacidad.eq.publico,usuario_id.eq.${user.id}`);
    } else {
      q = q.eq('privacidad', 'publico');
    }

    const { data: posts, error } = await q.order('creado_en', { ascending: false }).limit(100);

    if (error) {
      feed.innerHTML = 'Error al cargar publicaciones.';
      console.error(error);
      return;
    }
    if (!posts || posts.length === 0) {
      feed.innerHTML = '<p>No hay publicaciones aún.</p>';
      return;
    }

    // Obtener nombres de autores
    const authorIds = Array.from(new Set(posts.map(p => p.usuario_id))).filter(Boolean);
    const { data: authors = [] } = await supabase.from('usuarios').select('id, nombre').in('id', authorIds);
    const authorMap = {};
    authors.forEach(a => authorMap[a.id] = a.nombre || a.id);

    // Likes y comentarios
    const postIds = posts.map(p => p.id);
    const { data: likesData = [] } = await supabase.from('likes').select('*').in('publicacion_id', postIds);
    const { data: commentsData = [] } = await supabase.from('comentarios')
      .select('id, publicacion_id, usuario_id, contenido, creado_en, usuarios(nombre)')
      .in('publicacion_id', postIds);

    const likesMap = {};
    likesData.forEach(l => {
      if (!likesMap[l.publicacion_id]) likesMap[l.publicacion_id] = [];
      likesMap[l.publicacion_id].push(l.usuario_id);
    });

    const commentsMap = {};
    commentsData.forEach(c => {
      if (!commentsMap[c.publicacion_id]) commentsMap[c.publicacion_id] = [];
      commentsMap[c.publicacion_id].push(c);
    });

    // Render
    feed.innerHTML = '';
    for (const p of posts) {
      const authorName = authorMap[p.usuario_id] || p.usuario_id;
      const card = document.createElement('div');

      const userHasLiked = user && likesMap[p.id]?.includes(user.id);
      const likesCount = likesMap[p.id]?.length || 0;
      const postComments = commentsMap[p.id] || [];

      card.innerHTML = `
        <article style="padding:8px;border-radius:6px;margin-bottom:12px;border:1px solid #eee">
          <p style="margin:0 0 6px 0"><strong>${escapeHtml(authorName)}</strong> 
          <small style="color:#666">• ${new Date(p.creado_en).toLocaleString()}</small></p>
          <p style="white-space:pre-wrap;margin:6px 0">${escapeHtml(p.contenido || '')}</p>
          ${p.imagen_url ? `<p><img src="${escapeHtml(p.imagen_url)}" alt="imagen" style="max-width:100%;height:auto;border-radius:4px"></p>` : ''}
          <div style="margin-top:6px">
            ${user ? `<button class="btn-like" data-id="${p.id}">${userHasLiked ? '💔 Unlike' : '👍 Like'}</button> <span>${likesCount}</span>` : ''}
          </div>
          <div class="comments-list" style="margin-top:6px">
            ${postComments.map(c => `<p><strong>${escapeHtml(c.usuarios?.nombre || c.usuario_id)}</strong>: ${escapeHtml(c.contenido)}</p>`).join('')}
          </div>
          ${user ? `
            <div class="add-comment" style="margin-top:6px">
              <input type="text" placeholder="Escribe un comentario..." style="width:80%;padding:4px"/>
              <button style="padding:4px">Enviar</button>
            </div>
          ` : ''}
        </article>
      `;

      // Likes
      if (user) {
        card.querySelector('.btn-like')?.addEventListener('click', async () => {
          const { data: existing } = await supabase.from('likes')
            .select('*')
            .eq('publicacion_id', p.id)
            .eq('usuario_id', user.id)
            .maybeSingle();

          if (existing) {
            await supabase.from('likes').delete().eq('id', existing.id);
          } else {
            await supabase.from('likes').insert([{ publicacion_id: p.id, usuario_id: user.id }]);
          }
          await cargarPublicaciones();
        });

        // Comentarios con input
        const commentDiv = card.querySelector('.add-comment');
        if (commentDiv) {
          const input = commentDiv.querySelector('input');
          const button = commentDiv.querySelector('button');

          button.addEventListener('click', async () => {
            if (!input.value.trim()) return;
            await supabase.from('comentarios').insert([{ publicacion_id: p.id, usuario_id: user.id, contenido: input.value }]);
            await cargarPublicaciones();
          });

          // También enviar con Enter
          input.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              button.click();
            }
          });
        }
      }

      feed.appendChild(card);
    }
  }

  // Inicializar y listener auth
  await cargarPublicaciones();
  supabase.auth.onAuthStateChange(() => {
    cargarPublicaciones();
  });
}
