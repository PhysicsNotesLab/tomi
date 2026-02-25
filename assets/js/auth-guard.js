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
            // ❌ No autenticado — redirigir a login
            const basePath = currentPage.includes("/assets/subjects/")
                ? "/login.html"
                : "login.html";

            // Calcular ruta relativa al login
            const depth = currentPage.split("/assets/subjects/");
            if (depth.length > 1) {
                // Estamos dentro de una materia
                window.location.href = "/login.html";
            } else {
                window.location.href = "login.html";
            }
        }
    });

})();
