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

    /* ===== TOAST NOTIFICATION ===== */
    function showToast(msg, isError) {
        var t = document.createElement("div");
        t.textContent = msg;
        t.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);" +
            "background:" + (isError ? "#e74c3c" : "#1a5c2a") + ";color:#fff;padding:14px 28px;" +
            "border-radius:10px;font-size:15px;z-index:9999;box-shadow:0 8px 32px rgba(0,0,0,.4);" +
            "animation:fadeIn .3s ease";
        document.body.appendChild(t);
        setTimeout(function () { t.remove(); }, 4000);
    }

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
        uploadBtn.textContent = "Subiendo 0%...";

        try {
            await FireDB.addFile(file, {
                category: categoryInput ? categoryInput.value : "General",
                date: new Date().toLocaleDateString("es-CO")
            }, function (pct) {
                uploadBtn.textContent = "Subiendo " + pct + "%...";
            });
            fileInput.value = "";
            await load();
            showToast("✅ Archivo subido correctamente: " + file.name);
        } catch (err) {
            console.error("Error al subir archivo:", err);
            var msg = err.code === "storage/unauthorized"
                ? "❌ Permiso denegado. Actualiza las Storage Rules en Firebase Console."
                : "❌ Error: " + (err.message || "Intenta de nuevo");
            showToast(msg, true);
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
                showToast("🗑️ Archivo eliminado");
            } catch (err) {
                console.error("Error al eliminar:", err);
                showToast("❌ Error al eliminar archivo", true);
            }
        }
    };

    /* ===== INICIALIZAR ===== */
    FireDB.ready.then(load);

})();
