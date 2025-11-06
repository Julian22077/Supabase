import { supabase } from "./supabase.js";
export async function mostrarUser() {
const app = document.getElementById("app");
app.innerHTML = `
<section>
<h2>Perfil del Estudiante</h2>
<form id="user-form">
<label>Nombre</label>
<input type="text" id="nombre" required />
<label>Correo (solo lectura)</label>

<input type="email" id="correo" disabled />
<label>Teléfono</label>
<input type="text" id="telefono" />
<button type="submit">Actualizar datos</button>
</form>
<p id="mensaje"></p>
</section>
`;
const form = document.getElementById("user-form");
const mensaje = document.getElementById("mensaje");
// 🔹 Obtener usuario actual
const {
data: { user },
error: userError,
} = await supabase.auth.getUser();
const correo = user.email;
// 🔹 Cargar datos del estudiante
const { data, error } = await supabase
.from("estudiantes")
.select("*")
.eq("correo", correo)
.single();
if (error) {
mensaje.textContent = "❌ Error cargando datos: " + error.message;
return;
}
document.getElementById("nombre").value = data.nombre || "";
document.getElementById("correo").value = data.correo || "";
document.getElementById("telefono").value = data.telefono || "";
// 🔹 Actualizar datos
form.addEventListener("submit", async (e) => {
e.preventDefault();
const nombre = document.getElementById("nombre").value.trim();
const telefono = document.getElementById("telefono").value.trim();

const { error: updateError } = await supabase
.from("estudiantes")
.update({ nombre, telefono })
.eq("correo", correo);
if (updateError) {
mensaje.textContent = "❌ Error al actualizar: " +
updateError.message;
} else {
mensaje.textContent = "✅ Datos actualizados correctamente";
}
});
}