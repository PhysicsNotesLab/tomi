/* =====================================================
   FILES APP — Sistema de archivos con Firebase Storage
   Centralizado para todas las materias
   Sin límite práctico de tamaño (usa Storage, no Firestore)
===================================================== */

(function () {
    const filesContainer = document.getElementById("filesContainer");
    const fileInput      = document.getElementById("fileInput");
    const uploadBtn      = document.getElementById("uploadFile");
    const categoryInput  = document.getElementById("fileCategory");

    if (!filesContainer || !uploadBtn) return;

    let files = [];

    /* ===== FORMATEAR TAMAÑO ===== */
    function formatSize(bytes) {
        if (!bytes) return "";
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
        return (bytes / 1024 / 1024).toFixed(1) + " MB";
    }

    /* ===== RENDERIZAR ===== */
    function render() {
        filesContainer.innerHTML = "";

        if (!files.length) {
            filesContainer.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem;">No hay archivos subidos</p>';
            return;
        }

        files.forEach(file => {
            const card = document.createElement("div");
            card.className = "file-card";

            const sizeStr = file.size ? ` — ${formatSize(file.size)}` : "";

            card.innerHTML = `
                <h4>${file.name}</h4>
                <span>${file.category || ""}${sizeStr} — ${file.date || ""}</span>
                <div class="actions">
                    <button onclick="FilesApp.download('${file.id}')">
                        <i class="fa-solid fa-download"></i>
                    </button>
                    <button onclick="FilesApp.remove('${file.id}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `;
            filesContainer.appendChild(card);
        });
    }

    /* ===== CARGAR DESDE FIRESTORE ===== */
    async function load() {
        try {
            files = await FireDB.getFiles();
            render();
        } catch (err) {
            console.error("Error cargando archivos:", err);
        }
    }

    /* ===== SUBIR ARCHIVO (Firebase Storage) ===== */
    uploadBtn.addEventListener("click", async () => {
        const file = fileInput.files[0];
        if (!file) {
            alert("Selecciona un archivo primero");
            return;
        }

        uploadBtn.disabled = true;
        uploadBtn.textContent = "Subiendo...";

        try {
            await FireDB.addFile(file, {
                category: categoryInput ? categoryInput.value : "General",
                date: new Date().toLocaleDateString("es-CO")
            });
            fileInput.value = "";
            await load();
        } catch (err) {
            console.error("Error al subir archivo:", err);
            alert("Error al subir archivo. Intenta de nuevo.");
        }

        uploadBtn.disabled = false;
        uploadBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Guardar archivo';
    });

    /* ===== DESCARGAR / ELIMINAR (global) ===== */
    window.FilesApp = {
        download(id) {
            const file = files.find(f => f.id === id);
            if (!file) return;

            // Archivos nuevos (Storage) → abrir URL
            if (file.url) {
                window.open(file.url, "_blank");
                return;
            }

            // Compatibilidad: archivos antiguos (base64 en Firestore)
            if (file.data) {
                const a = document.createElement("a");
                a.href     = file.data;
                a.download = file.name;
                a.click();
            }
        },

        async remove(id) {
            if (!confirm("¿Eliminar este archivo?")) return;
            try {
                await FireDB.deleteFile(id);
                await load();
            } catch (err) {
                console.error("Error al eliminar:", err);
                alert("Error al eliminar archivo.");
            }
        }
    };

    /* ===== INICIALIZAR ===== */
    FireDB.ready.then(load);

})();
