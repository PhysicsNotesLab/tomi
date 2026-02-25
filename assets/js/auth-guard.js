/* =====================================================
   AUTH GUARD — Protege todas las páginas
   Si el usuario NO está autenticado → redirige a login
   Requiere: firebase-config.js cargado antes
===================================================== */

(function () {

    // No proteger la página de login (evita loop infinito)
    const currentPage = window.location.pathname;
    if (currentPage.endsWith("login.html") || currentPage.endsWith("/login")) return;

    // Ocultar contenido hasta verificar auth
    document.documentElement.style.visibility = "hidden";

    auth.onAuthStateChanged(user => {
        if (user) {
            // ✅ Usuario autenticado — mostrar página
            document.documentElement.style.visibility = "visible";
            console.log("🔐 Sesión activa:", user.email);
        } else {
            // ❌ No autenticado — redirigir a login (ruta relativa)
            if (currentPage.includes("/assets/subjects/")) {
                // Estamos dentro de una materia (3 niveles de profundidad)
                window.location.href = "../../../login.html";
            } else if (currentPage.includes("/assets/")) {
                // Estamos en assets/ (2 niveles)
                window.location.href = "../../login.html";
            } else {
                // Estamos en la raíz
                window.location.href = "login.html";
            }
        }
    });

})();
