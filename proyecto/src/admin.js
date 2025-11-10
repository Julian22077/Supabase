// ...existing code...
import { supabase } from "./supabase.js";
/**
* Panel administrativo: muestra estudiantes y actividades.
* - Muestra nombre del estudiante y nombre del curso (joins).
* - Permite editar notas de actividades.
* - Permite eliminar estudiantes.
*/
export async function mostrarAdmin() {
const app = document.getElementById("app");
app.innerHTML = `<h2>Panel Administrativo</h2>
<section id="panel">
<div id="estudiantes"></div>
<div id="actividades"></div>
<p id="mensaje"></p>
</section>`;
const mensaje = document.getElementById("mensaje");
const estudiantesDiv = document.getElementById("estudiantes");
const actividadesDiv = document.getElementById("actividades");
// ----- Verificar admin (simple, por correo) -----
const {
data: { user },
error: userError,
} = await supabase.auth.getUser();
if (userError || !user) {
app.innerHTML = "<p>⚠️ Debes iniciar sesión como administrador.</p>";

return;
}
// ----- Cargar estudiantes -----
const { data: estudiantes, error: errorEst } = await supabase
.from("estudiantes")
.select("id, nombre, correo, telefono")
.order("nombre", { ascending: true });
if (errorEst) {
estudiantesDiv.innerHTML = `<p>Error cargando estudiantes:
${errorEst.message}</p>`;
return;
}
if (user.email !== "julianhernandez2207@gmail.com") {
app.innerHTML = "<p>⛔ No tienes permisos para acceder a este panel.</p>";
return;
}
estudiantesDiv.innerHTML = `
<h3>‍ Lista de Estudiantes</h3>
${
estudiantes.length === 0
? "<p>No hay estudiantes registrados.</p>"
: `<ul>
${estudiantes
.map(
(est) => `
<li style="margin-bottom:8px;">
<strong>${escapeHtml(est.nombre)}</strong>
(${escapeHtml(est.correo)}) - ${escapeHtml(est.telefono || "Sin teléfono")}
<button data-id="${est.id}" class="borrar-estudiante"
style="margin-left:8px;">️ Eliminar</button>
</li>`
)
.join("")}
</ul>`
}
`;
// ----- Cargar actividades con joins para traer estudiante y curso -----
// Nota: dependiendo de cómo estén definidas las relaciones en Supabase,
// la propiedad puede llamarse 'estudiantes' o 'estudiante' y venir como array o como objeto.

// Hacemos la consulta de forma simple y normalizamos luego.
const { data: actividades, error: errorAct } = await supabase
.from("actividades")
.select(`
id,
titulo,
descripcion,
tipo,
nota,
imagen,
creado_en,
estudiantes(id,nombre,correo),
cursos(id,nombre)
`)
.order("creado_en", { ascending: false });
if (errorAct) {
actividadesDiv.innerHTML = `<p>Error cargando actividades:
${errorAct.message}</p>`;
return;
}
// Helper para normalizar relaciones (busca varios posibles nombres y devuelve objeto o null)
function getRelated(entity, possibleNames) {
for (const name of possibleNames) {
if (entity[name] == null) continue;
const val = entity[name];
if (Array.isArray(val)) return val[0] || null;
if (typeof val === "object") return val;
}
return null;
}
actividadesDiv.innerHTML = `
<h3>📚 Actividades Registradas</h3>
${
(!actividades || actividades.length === 0)
? "<p>No hay actividades registradas.</p>"
: `<ul>
${actividades
.map((act) => {

// Normalizamos: puede venir como 'estudiantes'/'estudiante' o 'cursos'/'curso'
const est = getRelated(act, ["estudiante", "estudiantes",
"student", "students"]);
const cur = getRelated(act, ["curso", "cursos", "course",
"courses"]);
const estNombre = est ? escapeHtml(est.nombre) :
"Estudiante no encontrado";
const curNombre = cur ? escapeHtml(cur.nombre) : "Curso no encontrado";
const descripcion = act.descripcion ?
escapeHtml(act.descripcion) : "";
const imagenHtml = act.imagen
? `<div style="margin-top:6px;"><img
src="${escapeAttr(act.imagen)}" alt="${escapeAttr(act.titulo)}"
style="max-width:160px;max-height:120px;object-fit:cover;"></div>`
: "";
return `
<li style="margin-bottom:12px;border-bottom:1px solid
#eee;padding-bottom:8px;">
<div><strong>${escapeHtml(act.titulo)}</strong>
(${escapeHtml(act.tipo)})</div>
<div style="font-size:0.9em;color:#555;">Estudiante:
${estNombre} — Curso: ${curNombre}</div>
<div style="margin-top:6px;">${descripcion}</div>
${imagenHtml}
<div style="margin-top:6px;">
Nota: <input type="number" min="0" max="5"
step="0.1" value="${act.nota ?? ""}" data-id="${act.id}"
class="nota-input" style="width:70px;">
</div>
</li>
`;
})
.join("")}
</ul>
<button id="guardar-notas" style="margin-top:8px;">💾 Guardar
cambios</button>`
}
`;
// ----- Event: borrar estudiante -----
document.querySelectorAll(".borrar-estudiante").forEach((btn) => {

btn.addEventListener("click", async (e) => {
const id = e.target.getAttribute("data-id");
if (!id) return;
if (!confirm("¿Eliminar este estudiante? Esta acción también eliminará sus actividades (si la FK es cascade).")) return;
const { error: delError } = await
supabase.from("estudiantes").delete().eq("id", id);
if (delError) {
mensaje.textContent = "❌ Error eliminando estudiante: " +
delError.message;
mensaje.style.color = "red";
} else {
mensaje.textContent = "✅ Estudiante eliminado correctamente.";
mensaje.style.color = "green";
// recargar panel
setTimeout(() => mostrarAdmin(), 700);
}
});
});
// ----- Event: guardar notas -----
const guardarBtn = document.getElementById("guardar-notas");
if (guardarBtn) {
guardarBtn.addEventListener("click", async () => {
const inputs = document.querySelectorAll(".nota-input");
let errores = 0;
for (const input of inputs) {
const id = input.getAttribute("data-id");
const raw = input.value;
// permitir vacíos (no actualizar) o números
if (raw === "") continue;
const nota = parseFloat(raw);
if (isNaN(nota)) {
errores++;
continue;
}
const { error } = await supabase.from("actividades").update({
nota }).eq("id", id);
if (error) errores++;
}
if (errores > 0) {

mensaje.textContent = "⚠️ Algunas notas no se actualizaron correctamente.";
mensaje.style.color = "orange";
} else {
mensaje.textContent = "✅ Notas actualizadas correctamente.";
mensaje.style.color = "green";
}
// opcional: refrescar datos
setTimeout(() => mostrarAdmin(), 800);
});
}
}
/** Helpers para escapar texto y atributos (seguridad básica HTML) */
function escapeHtml(str) {
if (str == null) return "";
return String(str)
.replace(/&/g, "&amp;")
.replace(/</g, "&lt;")
.replace(/>/g, "&gt;")
.replace(/"/g, "&quot;")
.replace(/'/g, "&#039;");
}
function escapeAttr(str) {
if (str == null) return "";
return String(str).replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}