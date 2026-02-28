/* ==========================================
   MAIN.JS — Sistema unificado
   • Marca menú activo en sidebar
   • Toggle sidebar móvil (clase .open)
   • Overlay para cerrar sidebar
   • Profesor/Periodo editable (Firestore)
========================================== */

document.addEventListener("DOMContentLoaded", () => {

    // ===== 1. NORMALIZAR HREFs Y MARCAR MENÚ ACTIVO =====
    const sidebarLinks = document.querySelectorAll(".sidebar a");
    const currentPage = window.location.pathname.split("/").pop();

    sidebarLinks.forEach(link => {
        let href = link.getAttribute("href") || "";

        // Si estamos dentro de /assets/subjects/ y el href es relativo simple
        // como "semestre2.html", convertirlo a ruta desde la raíz del proyecto.
        if (location.pathname.includes('/assets/subjects/') && href && !href.startsWith('.') && !href.startsWith('/') && href.endsWith('.html')) {
            link.setAttribute('href', '../../../' + href);
            href = link.getAttribute('href');
        }

        // Comparar sólo el nombre del archivo
        const linkFile = href.split('/').pop();
        if (linkFile === currentPage) {
            link.parentElement.classList.add("active");
        }
    });

    // ===== 2. TOGGLE SIDEBAR MÓVIL =====
    const toggle  = document.querySelector(".menu-toggle");
    const sidebar = document.querySelector(".sidebar");
    const overlay = document.querySelector(".sidebar-overlay");

    if (toggle && sidebar) {
        toggle.addEventListener("click", () => {
            sidebar.classList.toggle("open");
            if (overlay) overlay.classList.toggle("active");
            document.body.style.overflow =
                sidebar.classList.contains("open") ? "hidden" : "auto";
        });
    }

    // ===== 3. CERRAR CON OVERLAY =====
    if (overlay) {
        overlay.addEventListener("click", () => {
            sidebar.classList.remove("open");
            overlay.classList.remove("active");
            document.body.style.overflow = "auto";
        });
    }

    // ===== 4. PROFESOR EDITABLE (Firestore) =====
    const profEl = document.getElementById("profName");
    if (profEl && typeof FireDB !== "undefined" && FireDB.getSubjectId()) {
        FireDB.ready.then(async () => {
            try {
                const info = await FireDB.getInfo();
                if (info.professor) profEl.textContent = info.professor;
            } catch (e) { console.warn("Error cargando profesor:", e); }

            profEl.addEventListener("focus", () => {
                if (profEl.textContent === "Por asignar") profEl.textContent = "";
            });

            profEl.addEventListener("blur", async () => {
                const val = profEl.textContent.trim();
                if (!val) profEl.textContent = "Por asignar";
                try {
                    await FireDB.saveInfo({ professor: profEl.textContent });
                } catch (e) { console.warn("Error guardando profesor:", e); }
            });

            profEl.addEventListener("keydown", (e) => {
                if (e.key === "Enter") { e.preventDefault(); profEl.blur(); }
            });
        });
    }

    // ===== 5. PERIODO EDITABLE (Firestore) =====
    const periodEl = document.getElementById("periodName");
    if (periodEl && typeof FireDB !== "undefined" && FireDB.getSubjectId()) {
        FireDB.ready.then(async () => {
            try {
                const info = await FireDB.getInfo();
                if (info.period) periodEl.textContent = info.period;
            } catch (e) { console.warn("Error cargando periodo:", e); }

            periodEl.addEventListener("blur", async () => {
                const val = periodEl.textContent.trim();
                if (!val) periodEl.textContent = periodEl.dataset.default || "Por definir";
                try {
                    await FireDB.saveInfo({ period: periodEl.textContent });
                } catch (e) { console.warn("Error guardando periodo:", e); }
            });

            periodEl.addEventListener("keydown", (e) => {
                if (e.key === "Enter") { e.preventDefault(); periodEl.blur(); }
            });
        });
    }

});