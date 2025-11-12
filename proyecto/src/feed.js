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
      <div id="feed-publicaciones">Cargando publicaciones...</div>
    </section>
  `;
  const feed = document.getElementById('feed-publicaciones');

  // -------------------- Helpers para evitar que el menú tape posts --------------------
  let resizeTimer = null;
  let menuObserver = null;

  // Calcula altura del menu y aplica padding-top AL FEED (idempotente)
  function updateFeedOffset() {
    const menu = document.getElementById('menu');
    if (!menu || !feed) return;
    const rect = menu.getBoundingClientRect();
    const h = Math.max(0, Math.round(rect.height || 0));
    // Establecer variable CSS (opcional) y padding del feed (reemplaza, no suma)
    document.documentElement.style.setProperty('--menu-height', `${h}px`);
    feed.style.paddingTop = `${h + 12}px`; // 12px de espacio extra (ajusta si quieres)
    // asegurar scroll-padding-top para scrollIntoView
    document.documentElement.style.setProperty('scroll-padding-top', `${h}px`);
  }

  // Debounced wrapper para resize
  function scheduleUpdateFeedOffset(ms = 80) {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(updateFeedOffset, ms);
  }

  // Observador del menu para detectar cambios en DOM/clases/estilos que alteren altura
  function observeMenuMutations() {
    const menu = document.getElementById('menu');
    if (!menu) return;
    // Si ya hay un observer local, desconectarlo antes
    if (menuObserver) {
      try { menuObserver.disconnect(); } catch (e) {}
      menuObserver = null;
    }
    menuObserver = new MutationObserver(() => {
      // recalcular cuando haya cambios en DOM del menu
      scheduleUpdateFeedOffset(40);
    });
    menuObserver.observe(menu, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
  }

  // Registrar resize listener (local) — se puede limpiar en el cleanup
  function startResizeListener() {
    window.addEventListener('resize', scheduleUpdateFeedOffset);
  }
  function stopResizeListener() {
    window.removeEventListener('resize', scheduleUpdateFeedOffset);
  }

  // -------------------- Funciones originales de carga de publicaciones --------------------
  async function fetchMyNameOnce(user) {
    if (!user) return null;
    try {
      const { data: me } = await supabase
        .from('usuarios')
        .select('nombre')
        .eq('id', user.id)
        .maybeSingle();
      return me?.nombre || null;
    } catch (err) {
      console.error('fetchMyNameOnce error:', err);
      return null;
    }
  }

  async function cargarPublicaciones() {
    // Asegurar espacio antes de mostrar "Cargando..."
    updateFeedOffset();

    feed.innerHTML = 'Cargando publicaciones...';

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user || null;

    let q = supabase
      .from('publicaciones')
      .select('id, usuario_id, contenido, imagen_url, privacidad, creado_en');

    if (user) {
      q = q.or(`privacidad.eq.publico,usuario_id.eq.${user.id}`);
    } else {
      q = q.eq('privacidad', 'publico');
    }

    const { data: posts = [], error: postsErr } = await q
      .order('creado_en', { ascending: false })
      .limit(100);
    if (postsErr) {
      feed.innerHTML = 'Error al cargar publicaciones.';
      console.error('postsErr:', postsErr);
      return;
    }
    if (!posts || posts.length === 0) {
      feed.innerHTML = '<p>No hay publicaciones aún.</p>';
      // recalcular por si menu cambió mientras no había posts
      updateFeedOffset();
      return;
    }

    // obtener autores con avatar
    const authorIds = Array.from(new Set(posts.map(p => p.usuario_id))).filter(Boolean);
    const { data: authors = [], error: authErr } = await supabase
      .from('usuarios')
      .select('id, nombre, avatar_url')
      .in('id', authorIds);
    if (authErr) console.error('authors error:', authErr);

    const authorMap = {};
    authors.forEach(a => authorMap[a.id] = { nombre: a.nombre || a.id, avatar_url: a.avatar_url || '' });

    const postIds = posts.map(p => p.id);
    const { data: likesData = [], error: likesErr } = await supabase
      .from('likes')
      .select('id, publicacion_id, usuario_id')
      .in('publicacion_id', postIds);
    if (likesErr) console.error('likesErr:', likesErr);

    const { data: commentsData = [], error: commentsErr } = await supabase
      .from('comentarios')
      .select('id, publicacion_id, usuario_id, contenido, creado_en, usuarios(nombre, avatar_url)')
      .in('publicacion_id', postIds);
    if (commentsErr) console.error('commentsErr:', commentsErr);

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

    const myNameCache = await fetchMyNameOnce(user);

    // RENDER de publicaciones (usando clases, no estilos inline excepto mínimos)
    feed.innerHTML = '';
    for (const p of posts) {
      const author = authorMap[p.usuario_id] || { nombre: p.usuario_id, avatar_url: '' };
      const card = document.createElement('div');

      const likesId = `likes-count-${p.id}`;
      const commentsId = `comments-${p.id}`;
      const commentInputId = `comment-input-${p.id}`;
      const sendBtnClass = `btn-send-comment-${p.id}`;
      const likeBtnClass = `btn-like-${p.id}`;

      const userHasLiked = user && likesMap[p.id]?.includes(user.id);
      const likesCount = likesMap[p.id]?.length || 0;
      const postComments = commentsMap[p.id] || [];

      card.innerHTML = `
       <article class="feed-card">
        <div class="post-header">
          ${author.avatar_url ? `<img class="post-avatar" src="${escapeHtml(author.avatar_url)}" alt="avatar">` : `<div class="post-avatar"></div>`}
          <div class="post-meta">
            <span class="post-author user-link" data-id="${p.usuario_id}">${escapeHtml(author.nombre)}</span>
            <span class="post-time">• ${new Date(p.creado_en).toLocaleString()}</span>
          </div>
        </div>

        <div class="post-content">${escapeHtml(p.contenido || '')}</div>

        ${p.imagen_url ? `<img class="post-image" src="${escapeHtml(p.imagen_url)}" alt="imagen">` : ''}

        <div class="post-actions">
          ${user ? `<button class="${likeBtnClass}" data-id="${p.id}">${userHasLiked ? '💔 Unlike' : '👍 Like'}</button> <span class="likes-count" id="${likesId}">${likesCount}</span>` : ''}
        </div>

        <div class="comments-list" id="${commentsId}">
          ${postComments.map(c => `
            <div class="comment-item">
              ${c.usuarios?.avatar_url ? `<img class="comment-avatar" src="${escapeHtml(c.usuarios.avatar_url)}" alt="avatar">` : `<div class="comment-avatar"></div>`}
              <div class="comment-body">
                <span class="comment-author user-link" data-id="${c.usuario_id}">${escapeHtml(c.usuarios?.nombre || c.usuario_id)}</span>
                <span class="comment-text">${escapeHtml(c.contenido)}</span>
              </div>
            </div>
          `).join('')}
        </div>

        ${user ? `
          <div class="add-comment">
            <input id="${commentInputId}" type="text" placeholder="Escribe un comentario...">
            <button class="${sendBtnClass}" data-id="${p.id}">Enviar</button>
          </div>
        ` : ''}
      </article>
      `;

      feed.appendChild(card);

      // CLICK EN NOMBRE DE USUARIO
      card.querySelectorAll('.user-link').forEach(link => {
        link.addEventListener('click', async (e) => {
          const userId = e.target.dataset.id;
          const mod = await import('./perfilUsuario.js');
          mod.mostrarPerfilUsuario(userId);
        });
      });

      if (!user) continue;

      const likeBtn = card.querySelector(`.${likeBtnClass}`);
      const likesSpan = document.getElementById(likesId);
      const commentsListEl = document.getElementById(commentsId);
      const inputEl = document.getElementById(commentInputId);
      const sendBtn = card.querySelector(`.${sendBtnClass}`);

      const setButtonLoading = (btn, loading) => {
        if (!btn) return;
        btn.disabled = loading;
        btn.style.opacity = loading ? '0.6' : '1';
      };

      likeBtn?.addEventListener('click', async () => {
        setButtonLoading(likeBtn, true);
        try {
          const currentlyLiked = likesMap[p.id]?.includes(user.id);
          if (currentlyLiked) {
            likesMap[p.id] = (likesMap[p.id] || []).filter(id => id !== user.id);
            likeBtn.textContent = '👍 Like';
          } else {
            likesMap[p.id] = (likesMap[p.id] || []).concat([user.id]);
            likeBtn.textContent = '💔 Unlike';
          }
          likesSpan.textContent = (likesMap[p.id] || []).length;

          const { data: existingLike } = await supabase.from('likes')
            .select('id')
            .eq('publicacion_id', p.id)
            .eq('usuario_id', user.id)
            .maybeSingle();

          if (existingLike) {
            const { error } = await supabase.from('likes').delete().eq('id', existingLike.id);
            if (error) throw error;
          } else {
            const { error } = await supabase.from('likes').insert([{ publicacion_id: p.id, usuario_id: user.id }]);
            if (error) throw error;
          }
        } catch (err) {
          console.error('Error toggle like:', err);
          alert('No se pudo procesar el like, inténtalo de nuevo.');
        } finally {
          setButtonLoading(likeBtn, false);
        }
      });

      sendBtn?.addEventListener('click', async () => {
        if (!inputEl) return;
        const text = inputEl.value.trim();
        if (!text) return;
        setButtonLoading(sendBtn, true);
        inputEl.value = '';
        try {
          const { data: inserted, error: insertErr } = await supabase.from('comentarios')
            .insert([{ publicacion_id: p.id, usuario_id: user.id, contenido: text }])
            .select('id, publicacion_id, usuario_id, contenido, creado_en, usuarios(nombre, avatar_url)')
            .single();
          if (insertErr) throw insertErr;

          const myName = myNameCache || await fetchMyNameOnce(user) || user.email || user.id;
          const myAvatar = inserted.usuarios?.avatar_url || '';

          const html = `
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
              ${myAvatar ? `<img src="${escapeHtml(myAvatar)}" alt="avatar" style="width:30px;height:30px;border-radius:50%">` : ''}
              <p style="margin:0"><strong>${escapeHtml(myName)}</strong>: ${escapeHtml(inserted.contenido)}</p>
            </div>
          `;
          commentsListEl.insertAdjacentHTML('beforeend', html);
        } catch (err) {
          console.error('Error insert comentario:', err);
          alert('No se pudo guardar el comentario. Inténtalo de nuevo.');
        } finally {
          setButtonLoading(sendBtn, false);
        }
      });

      inputEl?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          sendBtn?.click();
        }
      });
    }

    // Después de renderizar posts, recalcular offset del feed (importante)
    updateFeedOffset();
  } // end cargarPublicaciones

  await cargarPublicaciones();

  // Observers/listeners: observar menu y resize para recalcular cuando cambie
  observeMenuMutations();
  startResizeListener();

  const { data: sub } = supabase.auth.onAuthStateChange(() => {
    cargarPublicaciones().catch(console.error);
  });

  // cleanup al desmontar la pantalla (si quien llamó lo usa)
  return () => {
    try {
      if (menuObserver) {
        try { menuObserver.disconnect(); } catch (e) {}
        menuObserver = null;
      }
      stopResizeListener();
      if (sub?.subscription) sub.subscription.unsubscribe();
    } catch (err) {
      console.warn('Error unsubscribing:', err);
    }
  };
}
