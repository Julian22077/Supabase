// perfilUsuario.js
import { supabase } from './supabase.js';
import { mostrarFeed } from './feed.js';

export async function mostrarPerfilUsuario(userId) {
  const app = document.getElementById('app');
  app.innerHTML = `<p>Cargando perfil...</p>`;

  try {
    // 1️⃣ Obtener datos del usuario a ver
    const { data: usuario, error: userErr } = await supabase
      .from('usuarios')
      .select('id, nombre, correo, avatar_url, bio, creado_en')
      .eq('id', userId)
      .single();

    if (userErr || !usuario) {
      app.innerHTML = `<p>No se encontró el usuario.</p>`;
      return;
    }

    // 2️⃣ Obtener viewer (usuario que visita)
    const { data: authData } = await supabase.auth.getUser();
    const viewer = authData?.user || null;

    // 3️⃣ Obtener relación (si existe) entre viewer y usuario
    let relation = null;
    if (viewer) {
      try {
        const { data: relRows = [], error: relErr } = await supabase
          .from('amistades')
          .select('id, solicitante, receptor, estado, creado_en, actualizado_en')
          .or(`and(solicitante.eq.${viewer.id},receptor.eq.${userId}),and(solicitante.eq.${userId},receptor.eq.${viewer.id})`);

        if (relErr) {
          console.error('Error al obtener relaciones (relRows):', relErr);
        } else {
          relation = relRows.find(r =>
            (r.solicitante === viewer.id && r.receptor === userId) ||
            (r.solicitante === userId && r.receptor === viewer.id)
          ) || null;
          console.debug('relRows', relRows, 'relation selected', relation);
        }
      } catch (err) {
        console.error('Error fetching relations fallback:', err);
      }
    }

    // 4️⃣ Preparar filtro de privacidad para publicaciones
    let publicacionesQuery = supabase
      .from('publicaciones')
      .select('id, contenido, imagen_url, creado_en, privacidad')
      .eq('usuario_id', userId)
      .order('creado_en', { ascending: false });

    const viewerIsOwner = viewer && viewer.id === userId;
    const isFriend = relation && relation.estado === 'aceptada';

    if (!viewerIsOwner) {
      if (isFriend) {
        publicacionesQuery = publicacionesQuery.in('privacidad', ['publico', 'amigos']);
      } else {
        publicacionesQuery = publicacionesQuery.eq('privacidad', 'publico');
      }
    }

    const { data: publicaciones = [], error: postsErr } = await publicacionesQuery;
    if (postsErr) {
      console.error('Error cargando publicaciones del usuario:', postsErr);
      app.innerHTML = `<p>Error al cargar publicaciones.</p>`;
      return;
    }

    // 5️⃣ Construir la sección de acciones
    let actionsHtml = '';
    if (!viewer) {
      actionsHtml = `<p><small>Inicia sesión para interactuar</small></p>`;
    } else if (viewerIsOwner) {
      actionsHtml = `<p>Este es tu perfil.</p>`;
    } else if (relation) {
      if (relation.estado === 'aceptada') {
        actionsHtml = `<p><strong>Ya son amigos</strong></p>`;
      } else if (relation.estado === 'pendiente') {
        if (relation.solicitante === viewer.id) {
          actionsHtml = `<p>Solicitud pendiente (la solicitaste).</p><button id="btn-cancel-request">Cancelar solicitud</button>`;
        } else if (relation.receptor === viewer.id) {
          actionsHtml = `<p>Solicitud pendiente (te la enviaron).</p><button id="btn-accept-request">Aceptar</button> <button id="btn-reject-request">Rechazar</button>`;
        } else {
          actionsHtml = `<p>Solicitud pendiente.</p>`;
        }
      } else if (relation.estado === 'rechazada') {
        // Si fue rechazada, permitir reintento: mostrar botón para enviar solicitud nuevamente
        actionsHtml = `<p>La solicitud anterior fue rechazada.</p><button id="btn-add-friend">Volver a enviar solicitud</button>`;
      } else {
        actionsHtml = `<button id="btn-add-friend">Enviar solicitud</button>`;
      }
    } else {
      actionsHtml = `<button id="btn-add-friend">Agregar amigo</button>`;
    }

    // 6️⃣ Render final del perfil
    app.innerHTML = `
      <button id="btn-volver-feed" style="margin-bottom:10px;">⬅ Volver al feed</button>

      <section style="border-bottom:1px solid #ccc;padding-bottom:10px;margin-bottom:10px;">
        ${usuario.avatar_url ? `<img src="${escapeHtml(usuario.avatar_url)}" alt="avatar" style="width:80px;height:80px;border-radius:50%">` : ''}
        <h2>${escapeHtml(usuario.nombre)}</h2>
        <p>${escapeHtml(usuario.bio || '')}</p>
        <p><small>Miembro desde: ${new Date(usuario.creado_en).toLocaleDateString()}</small></p>
        <div id="profile-actions" style="margin-top:8px;">
          ${actionsHtml}
        </div>
      </section>

      <section>
        <h3>Publicaciones</h3>
        ${publicaciones.length === 0
          ? '<p>No hay publicaciones visibles para este perfil.</p>'
          : publicaciones.map(p => `
              <article style="border:1px solid #eee;padding:8px;border-radius:6px;margin-bottom:10px;">
                <p>${escapeHtml(p.contenido || '')}</p>
                ${p.imagen_url ? `<p><img src="${escapeHtml(p.imagen_url)}" style="max-width:100%;border-radius:4px;"></p>` : ''}
                <small>${new Date(p.creado_en).toLocaleString()}</small>
              </article>
            `).join('')
        }
      </section>
    `;

    // 7️⃣ Volver al feed
    document.getElementById('btn-volver-feed')?.addEventListener('click', () => {
      mostrarFeed();
    });

    // -------------------------
    // 8️⃣ Funciones para acciones sobre amistad
    // -------------------------
    async function sendFriendRequest(targetId) {
      try {
        const { data: meData } = await supabase.auth.getUser();
        const me = meData?.user;
        if (!me) throw new Error('No autenticado');
        if (me.id === targetId) throw new Error('No puedes enviarte solicitud a ti mismo');

        // 1) Re-check en DB para ambas direcciones (robusto)
        const { data: relRows = [], error: relErr } = await supabase
          .from('amistades')
          .select('id, estado, solicitante, receptor')
          .or(`and(solicitante.eq.${me.id},receptor.eq.${targetId}),and(solicitante.eq.${targetId},receptor.eq.${me.id})`);

        if (relErr) throw relErr;

        const existing = relRows.find(r =>
          (r.solicitante === me.id && r.receptor === targetId) ||
          (r.solicitante === targetId && r.receptor === me.id)
        );

        if (existing) {
          // Si ya son amigos -> bloquear envío
          if (existing.estado === 'aceptada') {
            return { already: true, reason: 'aceptada', record: existing };
          }
          // Si ya hay pendiente -> bloquear envío
          if (existing.estado === 'pendiente') {
            return { already: true, reason: 'pendiente', record: existing };
          }
          // Si fue rechazada -> permitimos reintento actualizando la fila existente
          if (existing.estado === 'rechazada') {
            try {
              const { data: updated, error: updateErr } = await supabase
                .from('amistades')
                .update({
                  solicitante: me.id,
                  receptor: targetId,
                  estado: 'pendiente',
                  actualizado_en: new Date().toISOString()
                })
                .eq('id', existing.id)
                .select();
              if (updateErr) throw updateErr;
              return { data: updated };
            } catch (updateErr) {
              // Si por alguna razón el update falla por duplicado u otro issue, lo manejamos abajo
              console.error('Error actualizando amistad rechazada para reintento:', updateErr);
              // seguir para intentar insertar de nuevo (fallback)
            }
          }
          // otros estados -> tratar como existente
          return { already: true, reason: existing.estado || 'exists', record: existing };
        }

        // 2) Intentar insertar la solicitud. Manejar duplicado por índice único si existe.
        const { data, error } = await supabase.from('amistades').insert([{
          solicitante: me.id,
          receptor: targetId,
          estado: 'pendiente',
          actualizado_en: new Date().toISOString()
        }]);

        if (error) {
          // Manejo explícito de duplicado (Postgres 23505) o texto duplicate
          const dbCode = error?.code || '';
          if (dbCode === '23505' || (typeof error.message === 'string' && error.message.toLowerCase().includes('duplicate'))) {
            // obtener la relación existente y devolver already
            const { data: relAgain = [] } = await supabase
              .from('amistades')
              .select('id, estado, solicitante, receptor')
              .or(`and(solicitante.eq.${me.id},receptor.eq.${targetId}),and(solicitante.eq.${targetId},receptor.eq.${me.id})`);
            const existing2 = relAgain[0] || null;
            return { already: true, reason: 'db_duplicate', record: existing2 };
          }
          throw error;
        }

        return { data };
      } catch (err) {
        return { error: err };
      }
    }

    async function cancelRequestBetween(meId, otherId) {
      try {
        const { error } = await supabase.from('amistades')
          .delete()
          .match({ solicitante: meId, receptor: otherId, estado: 'pendiente' });
        if (error) throw error;
        return { ok: true };
      } catch (err) {
        return { error: err };
      }
    }

    async function acceptRequest(amistadId) {
      try {
        const { data: meData } = await supabase.auth.getUser();
        const me = meData?.user;
        if (!me) throw new Error('No autenticado');

        const { error } = await supabase.from('amistades')
          .update({ estado: 'aceptada', actualizado_en: new Date().toISOString() })
          .eq('id', amistadId);
        if (error) throw error;
        return { ok: true };
      } catch (err) {
        return { error: err };
      }
    }

    async function rejectRequest(amistadId) {
      try {
        const { error } = await supabase.from('amistades')
          .update({ estado: 'rechazada', actualizado_en: new Date().toISOString() })
          .eq('id', amistadId);
        if (error) throw error;
        return { ok: true };
      } catch (err) {
        return { error: err };
      }
    }

    // -------------------------
    // 9️⃣ Asociar eventos a botones según lo que haya en pantalla
    // -------------------------
    const actionsDiv = document.getElementById('profile-actions');

    // Agregar amigo
    const btnAdd = actionsDiv.querySelector('#btn-add-friend');
    if (btnAdd) {
      btnAdd.addEventListener('click', async () => {
        btnAdd.disabled = true;
        const res = await sendFriendRequest(userId);
        if (res?.error) {
          alert('Error enviando solicitud: ' + (res.error.message || res.error));
          btnAdd.disabled = false;
          return;
        }
        if (res?.already) {
          const estado = res.record?.estado ? ` (${res.record.estado})` : '';
          if (res.reason === 'aceptada') {
            alert('No se pudo enviar: ya son amigos.');
          } else if (res.reason === 'pendiente' && res.record?.solicitante === userId) {
            alert('No se pudo enviar: ya existe una solicitud pendiente enviada por esa persona.');
          } else {
            alert('No se pudo enviar: ya existe una relación' + estado + '.');
          }
          mostrarPerfilUsuario(userId);
          return;
        }
        // Si la acción devolvió data (inserción o update), recargamos el perfil
        mostrarPerfilUsuario(userId);
      });
    }

    // Cancelar solicitud (si yo la envié)
    const btnCancel = actionsDiv.querySelector('#btn-cancel-request');
    if (btnCancel) {
      btnCancel.addEventListener('click', async () => {
        if (!confirm('¿Cancelar la solicitud?')) return;
        btnCancel.disabled = true;
        const { data: meData } = await supabase.auth.getUser();
        const me = meData?.user;
        const res = await cancelRequestBetween(me.id, userId);
        if (res?.error) {
          alert('Error cancelando: ' + (res.error.message || res.error));
          btnCancel.disabled = false;
          return;
        }
        mostrarPerfilUsuario(userId);
      });
    }

    // Aceptar / Rechazar (si yo soy receptor)
    const btnAccept = actionsDiv.querySelector('#btn-accept-request');
    const btnReject = actionsDiv.querySelector('#btn-reject-request');
    if (btnAccept || btnReject) {
      const amistadId = relation?.id;
      if (btnAccept) {
        btnAccept.addEventListener('click', async () => {
          btnAccept.disabled = true;
          const res = await acceptRequest(amistadId);
          if (res?.error) {
            alert('Error aceptando: ' + (res.error.message || res.error));
            btnAccept.disabled = false;
            return;
          }
          mostrarPerfilUsuario(userId);
        });
      }
      if (btnReject) {
        btnReject.addEventListener('click', async () => {
          if (!confirm('¿Rechazar la solicitud?')) return;
          btnReject.disabled = true;
          const res = await rejectRequest(relation.id);
          if (res?.error) {
            alert('Error rechazando: ' + (res.error.message || res.error));
            btnReject.disabled = false;
            return;
          }
          mostrarPerfilUsuario(userId);
        });
      }
    }

  } catch (err) {
    console.error('Error al cargar perfil:', err);
    app.innerHTML = `<p>Error al mostrar el perfil.</p>`;
  }
}

/* helper local para escapar (puedes moverlo a un util si ya tienes uno) */
function escapeHtml(s) {
  if (!s) return '';
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
