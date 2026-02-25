/* =====================================================
   FILES APP — Sistema de archivos con Firestore
   Centralizado para todas las materias
   Límite: archivos < 900 KB (Firestore 1 MB / doc)
===================================================== */

(function () {
    const filesContainer = document.getElementById("filesContainer");
    const fileInput      = document.getElementById("fileInput");
    const uploadBtn      = document.getElementById("uploadFile");
    const categoryInput  = document.getElementById("fileCategory");

    if (!filesContainer || !uploadBtn) return;

    let files = [];

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
            card.innerHTML = `
                <h4>${file.name}</h4>
                <span>${file.category || ""} — ${file.date || ""}</span>
                <div class="actions">
                    ${file.data ? `<button onclick="FilesApp.download('${file.id}')">
                        <i class="fa-solid fa-download"></i>
                    </button>` : ""}
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

    /* ===== SUBIR ARCHIVO ===== */
    uploadBtn.addEventListener("click", () => {
        const file = fileInput.files[0];
        if (!file) {
            alert("Selecciona un archivo primero");
            return;
        }

        /* Límite de 900 KB para respetar el máximo de 1 MB de Firestore */
        if (file.size > 900 * 1024) {
            alert(
                `Archivo demasiado grande (${(file.size / 1024 / 1024).toFixed(1)} MB).\n` +
                "Límite: 900 KB por archivo (restricción de Firestore)."
            );
            return;
        }

        uploadBtn.disabled = true;
        uploadBtn.textContent = "Subiendo...";

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                await FireDB.addFile({
                    name: file.name,
                    category: categoryInput ? categoryInput.value : "General",
                    date: new Date().toLocaleDateString("es-CO"),
                    data: e.target.result
                });
                fileInput.value = "";
                await load();
            } catch (err) {
                console.error("Error al subir archivo:", err);
                alert("Error al subir. El archivo puede ser demasiado grande.");
            }
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = '<i class="fa-solid fa-upload"></i> Subir archivo';
        };
        reader.readAsDataURL(file);
    });

    /* ===== DESCARGAR / ELIMINAR (global) ===== */
    window.FilesApp = {
        download(id) {
            const file = files.find(f => f.id === id);
            if (!file || !file.data) return;
            const a = document.createElement("a");
            a.href     = file.data;
            a.download = file.name;
            a.click();
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
