import { supabase } from './supabase.js';
export function mostrarRegistro() {
const app = document.getElementById('app');
app.innerHTML = `
<section>
<h2>Registro de Estudiante</h2>
<form id="registro-form">
<input type="text" name="nombre" placeholder="Nombre" required
/>
<input type="email" name="correo" placeholder="Correo" required
/>
<input type="password" name="password" placeholder="Contraseña"
required />
<button type="submit">Registrarse</button>
</form>
<p id="error" style="color:red;"></p>
</section>

`;
const form = document.getElementById('registro-form');
const errorMsg = document.getElementById('error');
form.addEventListener('submit', async (e) => {
e.preventDefault();
errorMsg.textContent = '';
const nombre = form.nombre.value.trim();
const correo = form.correo.value.trim();
const password = form.password.value.trim();
if (!nombre || !correo || !password) {
errorMsg.textContent = 'Por favor completa todos los campos.';
return;
}
// 1️⃣Crear usuario en Auth
const { data: dataAuth, error: errorAuth } = await
supabase.auth.signUp({
email: correo,
password: password,
});
if (errorAuth) {
errorMsg.textContent = `Error en autenticación:
${errorAuth.message}`;
return;
}
const uid = dataAuth.user?.id;
if (!uid) {
errorMsg.textContent = 'No se pudo obtener el ID del usuario.';
return;
}
// 2️⃣Insertar en tabla "estudiantes"
const { error: errorInsert } = await
supabase.from('usuarios').insert([
{ id: uid, nombre, correo },
]);

if (errorInsert) {
errorMsg.textContent =
'Error guardando datos del estudiante: ' + errorInsert.message;
return;
}
alert('✅ Registro exitoso. Ahora puedes iniciar sesión.');
});
}