// src/login.js
import { supabase } from './supabase.js';
import { mostrarRegistro } from './register.js'; // para poder ir al registro

export function mostrarLogin() {
const app = document.getElementById('app');
app.innerHTML = `
<section class="login-wrapper">
  <div class="login-card">
    <div class="fb-top">
      <div class="fb-logo">fakebook</div>
      <div class="fb-sub">Conecta con amigos y el mundo</div>
    </div>

    <h2>Iniciar Sesión</h2>

    <form id="login-form">
      <input class="input-email" type="email" name="correo" placeholder="Correo" required />
      <input class="input-pass" type="password" name="password" placeholder="Contraseña" required />
      <button type="submit">Ingresar</button>
    </form>

    <p id="error"></p>

    <button id="ir-registro">Crear cuenta</button>

    <div class="login-footer">
      <small>¿Olvidaste tu contraseña? · Política de privacidad</small>
    </div>
  </div>
</section>
`;

const form = document.getElementById('login-form');
const errorMsg = document.getElementById('error');
const irRegistro = document.getElementById('ir-registro');

// Ir al registro
irRegistro.addEventListener('click', () => {
mostrarRegistro();
});

// Enviar login
form.addEventListener('submit', async (e) => {
errorMsg.textContent = '';
e.preventDefault();
const correo = form.correo.value.trim();
const password = form.password.value.trim();

if (!correo || !password) {
errorMsg.textContent = 'Por favor completa todos los campos.';
return;
}

// 🔐 Iniciar sesión en Supabase
const { data, error } = await supabase.auth.signInWithPassword({
email: correo,
password: password,
});

if (error) {
errorMsg.textContent = 'Error al iniciar sesión: ' + error.message;
return;
}

// ✅ Usuario autenticado

const usuario = data.user;
console.log('Usuario logueado:', usuario);
location.reload();
});
}