// src/main.js
import { mostrarAdmin } from './admin.js';
import { mostrarRegistro } from './register.js';
import { mostrarLogin } from './login.js';
import { mostrarMVP } from './mvp.js';
import { mostrarUser } from './user.js';
import { supabase } from './supabase.js';
import { mostrarAmigos } from './friends.js';
import { mostrarFeed } from './feed.js';
// Funciones de navegación disponibles para ser llamadas
const routes = {
'feed':mostrarFeed,
'registro': mostrarRegistro,
'login': mostrarLogin,
'actividades': mostrarMVP,
'usuarios': mostrarUser,
'admin': mostrarAdmin,
'amigos':mostrarAmigos // Asume que tienes una forma de verificar y mostrar el admin
};
async function CerrarSesion() {
await supabase.auth.signOut();
// Después de cerrar sesión, recargar el menú y mostrar el registro
await cargarMenu();
mostrarRegistro();
}
// 🧩 Control de navegación según el estado del usuario
export async function cargarMenu() {
  const menu = document.getElementById("menu");
  if (!menu) {
    console.warn('No se encontró #menu en el DOM.');
    return;
  }

  // Obtener usuario actual
  const { data: { user } = {} } = await supabase.auth.getUser().catch(()=>({ data: { user: null } }));

  // Plantillas para usuario/no usuario
  const actionsLoggedOut = `
    <div class="actions" id="menu-actions">
      <button class="btn" data-action="registro">Registrarse</button>
      <button class="btn" data-action="login">Iniciar sesión</button>
    </div>
  `;

  const actionsLoggedIn = `
    <div class="actions" id="menu-actions">
      <button class="btn" data-action="feed">Feed</button>
      <button class="btn" data-action="actividades">Actividades</button>
      <button class="btn" data-action="usuarios">Usuarios</button>
      <button class="btn" data-action="amigos">Amigos</button>
      ${user && user.email === 'julianhernandez2207@gmail.com' ? '<button class="btn" data-action="admin">Admin</button>' : ''}
      <button class="btn" data-action="logout" style="background:#e53935;">Cerrar sesión</button>
    </div>
  `;

  // Montar topbar: brand | actions | user-info + hamburger (hamburger visible en mobile)
  menu.innerHTML = `
    <div class="topbar" role="navigation" aria-label="Main navigation">
      <div class="left">
        <div class="brand">Fakebook</div>
      </div>

      <div class="center">
        ${user ? actionsLoggedIn : actionsLoggedOut}
      </div>

      <div class="right">
        <div class="user-info">
          ${user ? `<span class="user-email">${user.email}</span>` : ''}
        </div>
        <button class="menu-toggle" id="menu-toggle" aria-expanded="false" aria-label="Abrir menú">☰</button>
      </div>
    </div>
  `;

  // Referencias
  const menuActions = document.getElementById('menu-actions');
  const toggle = document.getElementById('menu-toggle');

  // Inicialmente en mobile el actions debe estar colapsado para permitir toggle
  // (dejamos colapsado si pantalla pequeña)
  const shouldCollapse = window.innerWidth <= 880;
  if (shouldCollapse) {
    menuActions.classList.add('collapsed');
    // hide pointer events already via css collapsed
  } else {
    menuActions.classList.remove('collapsed');
    menuActions.classList.remove('expanded');
  }

  // Toggle del hamburger: expande/colapsa las acciones en mobile
  if (toggle) {
    toggle.addEventListener('click', (e) => {
      const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
      if (isExpanded) {
        toggle.setAttribute('aria-expanded', 'false');
        menuActions.classList.remove('expanded');
        menuActions.classList.add('collapsed');
      } else {
        toggle.setAttribute('aria-expanded', 'true');
        // en pantallas pequeñas expandimos como columna para dropdown visual
        if (window.innerWidth <= 880) {
          menuActions.classList.remove('collapsed');
          menuActions.classList.add('expanded');
          menuActions.classList.add('dropdown');
        } else {
          menuActions.classList.remove('collapsed');
          menuActions.classList.add('expanded');
          menuActions.classList.remove('dropdown');
        }
      }
    });
  }

  // Si se redimensiona la ventana, ajustamos el estado (para evitar quedar colapsado al rotar)
  window.addEventListener('resize', () => {
    if (!menuActions) return;
    if (window.innerWidth > 880) {
      menuActions.classList.remove('collapsed', 'dropdown');
      menuActions.classList.add('expanded');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    } else {
      // mobile: dejar colapsado por defecto
      menuActions.classList.remove('expanded', 'dropdown');
      menuActions.classList.add('collapsed');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    }
  });

  // === Asignación de listeners a botones (rutas) ===
  menu.querySelectorAll('button').forEach(button => {
    const action = button.getAttribute('data-action');
    if (!action) return;

    if (action === 'logout') {
      button.addEventListener('click', async () => {
        await CerrarSesion();
      });
    } else if (routes[action]) {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        // si estamos en mobile y el menu está desplegado, cerrarlo al navegar
        if (window.innerWidth <= 880 && menuActions) {
          menuActions.classList.remove('expanded');
          menuActions.classList.add('collapsed');
          if (toggle) toggle.setAttribute('aria-expanded', 'false');
        }
        routes[action]();
      });
    }
  });
}
// 🌀 Llamamos la función apenas cargue la página
document.addEventListener("DOMContentLoaded", cargarMenu);
mostrarFeed();