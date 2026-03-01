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

    // Eliminar cualquier overlay estático del HTML (puede estar mal posicionado)
    let existingOverlay = document.querySelector(".sidebar-overlay");
    if (existingOverlay) existingOverlay.remove();

    // Crear siempre un overlay limpio en document.body (posición correcta)
    let overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(0,0,0,0.35)';
    overlay.style.backdropFilter = 'blur(2px)';
    overlay.style.transition = 'opacity 0.25s ease';
    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '1100';
    document.body.appendChild(overlay);

    // Función para cerrar el sidebar (quita ambas clases por compatibilidad)
    function closeSidebar() {
        if (!sidebar) return;
        sidebar.classList.remove('open');
        sidebar.classList.remove('active');
        if (overlay) {
            overlay.classList.remove('active');
            overlay.style.opacity = '0';
            overlay.style.pointerEvents = 'none';
        }
        document.body.style.overflow = 'auto';
    }

    // Alternar (abrir/cerrar)
    if (toggle && sidebar) {
        toggle.addEventListener('click', () => {
            // Alternar ambas clases para funcionar con cualquier CSS
            sidebar.classList.toggle('open');
            sidebar.classList.toggle('active');

            const isOpen = sidebar.classList.contains('open') || sidebar.classList.contains('active');

            // asegurar z-index para que sidebar y toggle estén por encima
            try {
                sidebar.style.zIndex = '1200';
                toggle.style.zIndex = '1201';
            } catch (e) {}

            // manejar overlay visualmente con estilos inline (más consistente)
            if (isOpen) {
                overlay.classList.add('active');
                overlay.style.opacity = '1';
                overlay.style.pointerEvents = 'auto';
                document.body.style.overflow = 'hidden';
            } else {
                overlay.classList.remove('active');
                overlay.style.opacity = '0';
                overlay.style.pointerEvents = 'none';
                document.body.style.overflow = 'auto';
            }
        });
    }

    // Cerrar al clicar el overlay
    if (overlay) {
        overlay.addEventListener('click', closeSidebar);
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

    // ===== 6. CRÉDITOS DINÁMICOS (desde semestre en Firestore) =====
    const creditsEl = document.getElementById("creditsValue");
    const _urlParams = new URLSearchParams(location.search);
    const _semParam = _urlParams.get('sem');
    const _subjectParam = _urlParams.get('subject');
    if (creditsEl && _semParam && _subjectParam && typeof FireDB !== "undefined") {
        FireDB.ready.then(async () => {
            try {
                const subInfo = await FireDB.getSubjectInfoFromSemester(
                    parseInt(_semParam), _subjectParam
                );
                if (subInfo && subInfo.credits != null) {
                    creditsEl.textContent = subInfo.credits;
                }
            } catch (e) { console.warn("Error cargando créditos:", e); }
        });
    }

});