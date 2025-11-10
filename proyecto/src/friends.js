import { supabase } from './supabase.js';

export async function mostrarAmigos() {
  const app = document.getElementById('app');
  app.innerHTML = `
<section>
  <h2>Amigos — Gestor de solicitudes</h2>

  <div style="display:flex;gap:16px;flex-wrap:wrap">
    <div style="flex:1;min-width:280px">
      <h3>Enviar solicitud</h3>
      <form id="send-request-form">
        <input type="email" id="target-email" placeholder="Correo del usuario" required />
        <button type="submit">Enviar solicitud</button>
      </form>
      <p id="send-msg" style="color:green"></p>
    </div>

    <div style="flex:1;min-width:280px">
      <h3>Solicitudes entrantes</h3>
      <div id="incoming-list">Cargando...</div>
    </div>

    <div style="flex:1;min-width:280px">
      <h3>Solicitudes salientes</h3>
      <div id="outgoing-list">Cargando...</div>
    </div>

    <div style="flex-basis:100%"></div>

    <div style="flex:1;min-width:280px">
      <h3>Mis amigos</h3>
      <div id="friends-list">Cargando...</div>
    </div>
  </div>
</section>
  `;

  const sendForm = document.getElementById('send-request-form');
  const sendMsg = document.getElementById('send-msg');
  const incomingList = document.getElementById('incoming-list');
  const outgoingList = document.getElementById('outgoing-list');
  const friendsList = document.getElementById('friends-list');

  // -------------------------
  // Helpers
  // -------------------------
  async function getCurrentUser() {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data?.user || null;
    } catch (err) {
      console.error('Error obteniendo usuario:', err);
      return null;
    }
  }

  // -------------------------
  // Función enviar solicitud
  // -------------------------
  async function sendFriendRequest(targetId) {
    try {
      const user = await getCurrentUser();
      if (!user) return { error: new Error('No autenticado') };
      if (user.id === targetId) return { error: new Error('No puedes enviarte solicitud a ti mismo') };

      // Verificar relaciones existentes (pendiente o aceptada)
      const check1 = await supabase.from('amistades')
        .select('*')
        .match({ solicitante: user.id, receptor: targetId })
        .in('estado', ['pendiente', 'aceptada'])
        .limit(1);
      if (check1.data.length) return { already: true };

      const check2 = await supabase.from('amistades')
        .select('*')
        .match({ solicitante: targetId, receptor: user.id })
        .in('estado', ['pendiente', 'aceptada'])
        .limit(1);
      if (check2.data.length) return { already: true };

      // Insertar nueva solicitud
      const { data, error } = await supabase.from('amistades').insert([{
        solicitante: user.id,
        receptor: targetId,
        estado: 'pendiente',
        actualizado_en: new Date().toISOString()
      }]);
      return { data, error };
    } catch (err) {
      return { error: err };
    }
  }

  // -------------------------
  // Funciones aceptar / rechazar
  // -------------------------
  async function acceptFriendRequest(requestId) {
    const user = await getCurrentUser();
    if (!user) return { error: new Error('No autenticado') };

    const { data: req, error: reqErr } = await supabase.from('amistades')
      .select('*').eq('id', requestId).maybeSingle();
    if (reqErr) return { error: reqErr };
    if (!req || req.receptor !== user.id) return { error: new Error('No autorizado o no encontrado') };

    return supabase.from('amistades')
      .update({ estado: 'aceptada', actualizado_en: new Date().toISOString() })
      .eq('id', requestId);
  }

  async function rejectOrCancelRequest(requestId) {
    const user = await getCurrentUser();
    if (!user) return { error: new Error('No autenticado') };

    const { data: req, error: reqErr } = await supabase.from('amistades')
      .select('*').eq('id', requestId).maybeSingle();
    if (reqErr) return { error: reqErr };
    if (!req || (req.receptor !== user.id && req.solicitante !== user.id)) return { error: new Error('No autorizado o no encontrado') };

    return supabase.from('amistades')
      .update({ estado: 'rechazada', actualizado_en: new Date().toISOString() })
      .eq('id', requestId);
  }

  // -------------------------
  // Eliminar amigo (borrar la relación aceptada)
  // -------------------------
  async function removeFriend(amistadId) {
    try {
      const user = await getCurrentUser();
      if (!user) throw new Error('No autenticado');

      // asegurarnos que la amistad exista y que el usuario sea parte de ella
      const { data: row, error: rowErr } = await supabase.from('amistades')
        .select('id, solicitante, receptor, estado')
        .eq('id', amistadId)
        .maybeSingle();
      if (rowErr) throw rowErr;
      if (!row) throw new Error('Relación no encontrada');
      if (row.estado !== 'aceptada') throw new Error('Solo se pueden eliminar amigos (estado = aceptada)');

      if (row.solicitante !== user.id && row.receptor !== user.id) {
        throw new Error('No autorizado');
      }

      const { error: delErr } = await supabase.from('amistades').delete().eq('id', amistadId);
      if (delErr) throw delErr;
      return { ok: true };
    } catch (err) {
      console.error('removeFriend error:', err);
      return { error: err };
    }
  }

  // -------------------------
  // Funciones de listas (modificadas para devolver amistad id)
  // -------------------------
  async function getIncomingRequests(user) {
    if (!user) return { data: [] };
    try {
      const { data = [] } = await supabase.from('amistades')
        .select('id, solicitante, receptor, estado, creado_en')
        .eq('receptor', user.id)
        .eq('estado', 'pendiente')
        .order('creado_en', { ascending: false });

      const requesterIds = data.map(r => r.solicitante).filter(Boolean);
      const { data: users = [] } = await supabase.from('usuarios')
        .select('id,nombre,correo,avatar_url')
        .in('id', requesterIds);
      const usersMap = {};
      users.forEach(u => usersMap[u.id] = u);

      return { data: data.map(r => ({ ...r, requester: usersMap[r.solicitante] || null })) };
    } catch (err) {
      console.error('getIncomingRequests error:', err);
      return { data: [] };
    }
  }

  async function getOutgoingRequests(user) {
    if (!user) return { data: [] };
    try {
      const { data = [] } = await supabase.from('amistades')
        .select('id, solicitante, receptor, estado, creado_en')
        .eq('solicitante', user.id)
        .eq('estado', 'pendiente')
        .order('creado_en', { ascending: false });

      const receptorIds = data.map(r => r.receptor).filter(Boolean);
      const { data: users = [] } = await supabase.from('usuarios')
        .select('id,nombre,correo,avatar_url')
        .in('id', receptorIds);
      const usersMap = {};
      users.forEach(u => usersMap[u.id] = u);

      return { data: data.map(r => ({ ...r, receptor_info: usersMap[r.receptor] || null })) };
    } catch (err) {
      console.error('getOutgoingRequests error:', err);
      return { data: [] };
    }
  }

  async function getFriendsList(user) {
    if (!user) return { data: [] };
    try {
      // traemos filas de amistad aceptadas (incluye el id de la relación)
      const { data: rows = [] } = await supabase.from('amistades')
        .select('id, solicitante, receptor, estado, creado_en, actualizado_en')
        .or(`solicitante.eq.${user.id},receptor.eq.${user.id}`)
        .eq('estado', 'aceptada');

      const friendIds = rows.map(r => (r.solicitante === user.id ? r.receptor : r.solicitante)).filter(Boolean);
      if (!friendIds.length) return { data: [] };

      const { data: users = [] } = await supabase.from('usuarios')
        .select('id,nombre,correo,avatar_url')
        .in('id', friendIds);

      // crear mapa de usuarios por id
      const usersMap = {};
      users.forEach(u => usersMap[u.id] = u);

      // Combinar rows + user info y devolver amistadId
      const combined = rows.map(r => {
        const friendId = r.solicitante === user.id ? r.receptor : r.solicitante;
        return {
          amistadId: r.id,
          usuario: usersMap[friendId] || { id: friendId, nombre: friendId },
          creado_en: r.creado_en
        };
      });

      return { data: combined };
    } catch (err) {
      console.error('getFriendsList error:', err);
      return { data: [] };
    }
  }

  // -------------------------
  // Renderers
  // -------------------------
  function renderIncoming(list) {
    if (!list || list.length === 0) { incomingList.innerHTML = '<p>No hay solicitudes entrantes.</p>'; return; }
    incomingList.innerHTML = '';
    list.forEach(item => {
      const div = document.createElement('div');
      const name = item.requester?.nombre || item.solicitante;
      div.innerHTML = `
        <div style="padding:8px;border:1px solid #eee;margin-bottom:8px;border-radius:6px">
          <strong>${escapeHtml(name)}</strong> <small style="color:#666">${new Date(item.creado_en).toLocaleString()}</small>
          <div style="margin-top:8px">
            <button data-id="${item.id}" class="btn-accept">Aceptar</button>
            <button data-id="${item.id}" class="btn-reject">Rechazar</button>
          </div>
        </div>`;
      incomingList.appendChild(div);
    });
    incomingList.querySelectorAll('.btn-accept').forEach(b => {
      b.addEventListener('click', async (ev) => {
        const id = ev.target.dataset.id;
        ev.target.disabled = true;
        await acceptFriendRequest(id);
        await refreshAll();
      });
    });
    incomingList.querySelectorAll('.btn-reject').forEach(b => {
      b.addEventListener('click', async (ev) => {
        const id = ev.target.dataset.id;
        ev.target.disabled = true;
        await rejectOrCancelRequest(id);
        await refreshAll();
      });
    });
  }

  function renderOutgoing(list) {
    if (!list || list.length === 0) { outgoingList.innerHTML = '<p>No hay solicitudes salientes.</p>'; return; }
    outgoingList.innerHTML = '';
    list.forEach(item => {
      const name = item.receptor_info?.nombre || item.receptor;
      const div = document.createElement('div');
      div.innerHTML = `
        <div style="padding:8px;border:1px solid #eee;margin-bottom:8px;border-radius:6px">
          <strong>${escapeHtml(name)}</strong> <small style="color:#666">${new Date(item.creado_en).toLocaleString()}</small>
          <div style="margin-top:8px">
            <button data-id="${item.id}" class="btn-cancel">Cancelar</button>
          </div>
        </div>`;
      outgoingList.appendChild(div);
    });
    outgoingList.querySelectorAll('.btn-cancel').forEach(b => {
      b.addEventListener('click', async (ev) => {
        const id = ev.target.dataset.id;
        ev.target.disabled = true;
        await rejectOrCancelRequest(id);
        await refreshAll();
      });
    });
  }

  function renderFriends(list) {
    if (!list || list.length === 0) { friendsList.innerHTML = '<p>No tienes amigos aún.</p>'; return; }
    friendsList.innerHTML = '';
    list.forEach(item => {
      const u = item.usuario;
      const div = document.createElement('div');
      div.innerHTML = `
        <div style="padding:8px;border:1px solid #eee;margin-bottom:8px;border-radius:6px;display:flex;align-items:center;justify-content:space-between">
          <div>
            <strong>${escapeHtml(u.nombre)}</strong> <small style="color:#666">${escapeHtml(u.correo || '')}</small>
          </div>
          <div>
            <button data-amistad="${item.amistadId}" class="btn-remove-friend">Eliminar</button>
          </div>
        </div>`;
      friendsList.appendChild(div);
    });

    // asociar eventos de eliminar amigo
    friendsList.querySelectorAll('.btn-remove-friend').forEach(btn => {
      btn.addEventListener('click', async (ev) => {
        const amistadId = ev.target.dataset.amistad;
        if (!amistadId) return;
        if (!confirm('¿Eliminar amistad? Esta acción no se puede deshacer.')) return;
        ev.target.disabled = true;
        const { error, ok } = await removeFriend(amistadId);
        if (error) {
          alert('No se pudo eliminar la amistad: ' + (error.message || error));
          ev.target.disabled = false;
          return;
        }
        await refreshAll();
      });
    });
  }

  function escapeHtml(s) {
    if (!s) return '';
    return String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  // -------------------------
  // refreshAll
  // -------------------------
  async function refreshAll() {
    incomingList.innerHTML = 'Cargando...';
    outgoingList.innerHTML = 'Cargando...';
    friendsList.innerHTML = 'Cargando...';

    const user = await getCurrentUser();
    if (!user) {
      incomingList.innerHTML = '<p>Debes iniciar sesión</p>';
      outgoingList.innerHTML = '<p>Debes iniciar sesión</p>';
      friendsList.innerHTML = '<p>Debes iniciar sesión</p>';
      return;
    }

    try {
      const [inc, out, friends] = await Promise.all([
        getIncomingRequests(user).catch(() => ({ data: [] })),
        getOutgoingRequests(user).catch(() => ({ data: [] })),
        getFriendsList(user).catch(() => ({ data: [] }))
      ]);

      renderIncoming(inc.data || []);
      renderOutgoing(out.data || []);
      renderFriends(friends.data || []);
    } catch (err) {
      console.error('Error refreshAll:', err);
      incomingList.innerHTML = '<p>Error cargando entrantes</p>';
      outgoingList.innerHTML = '<p>Error cargando salientes</p>';
      friendsList.innerHTML = '<p>Error cargando amigos</p>';
    }
  }

  // -------------------------
  // Enviar solicitud
  // -------------------------
  sendForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    sendMsg.textContent = '';
    const email = document.getElementById('target-email').value.trim().toLowerCase();
    if (!email) {
      sendMsg.style.color = 'red';
      sendMsg.textContent = 'Introduce un correo válido.';
      return;
    }

    const { data: target, error: userErr } = await supabase.from('usuarios')
      .select('id,nombre,correo').eq('correo', email).maybeSingle();
    if (userErr || !target) {
      sendMsg.style.color = 'red';
      sendMsg.textContent = 'Usuario no encontrado o error.';
      return;
    }

    const { error, already } = await sendFriendRequest(target.id);
    if (error) {
      sendMsg.style.color = 'red';
      sendMsg.textContent = 'Error: ' + error.message;
      return;
    }
    if (already) {
      sendMsg.style.color = 'orange';
      sendMsg.textContent = 'Ya existe una relación con este usuario.';
      await refreshAll();
      return;
    }

    sendMsg.style.color = 'green';
    sendMsg.textContent = 'Solicitud enviada a ' + (target.nombre || target.correo);
    sendForm.reset();
    await refreshAll();
  });

  // -------------------------
  // Inicialización
  // -------------------------
  await refreshAll();
  supabase.auth.onAuthStateChange(() => {
    refreshAll().catch(console.error);
  });
}
