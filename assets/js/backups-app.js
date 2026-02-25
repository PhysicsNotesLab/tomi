/* =====================================================
   BACKUPS APP — Sistema de backups con Firestore
   Centralizado para todas las materias
   Guarda copia de notas + metadata de archivos
===================================================== */

(function () {
    const createBtn  = document.getElementById("createBackup");
    const backupList = document.getElementById("backupList");

    if (!backupList || !createBtn) return;

    let backups = [];

    /* ===== RENDERIZAR ===== */
    function render() {
        backupList.innerHTML = "";

        if (!backups.length) {
            backupList.innerHTML =
                '<p style="color:var(--text-muted);text-align:center;padding:2rem;">No hay backups registrados</p>';
            return;
        }

        backups.forEach(b => {
            const card = document.createElement("div");
            card.className = "backup-item";
            card.innerHTML = `
                <h4>${b.label}</h4>
                <span>${b.date || ""} — ${b.notesCount || 0} notas, ${b.filesCount || 0} archivos</span>
                <div class="actions">
                    <button onclick="BackupsApp.restore('${b.id}')">
                        <i class="fa-solid fa-rotate-left"></i> Restaurar notas
                    </button>
                    <button onclick="BackupsApp.remove('${b.id}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `;
            backupList.appendChild(card);
        });
    }

    /* ===== CARGAR DESDE FIRESTORE ===== */
    async function load() {
        try {
            backups = await FireDB.getBackups();
            render();
        } catch (err) {
            console.error("Error cargando backups:", err);
        }
    }

    /* ===== CREAR BACKUP ===== */
    createBtn.addEventListener("click", async () => {
        const label = prompt(
            "Nombre del backup:",
            "Backup " + new Date().toLocaleDateString("es-CO")
        );
        if (!label) return;

        createBtn.disabled = true;
        createBtn.textContent = "Creando backup...";

        try {
            await FireDB.createBackup(label);
            await load();
            alert("Backup creado correctamente");
        } catch (err) {
            console.error("Error al crear backup:", err);
            alert("Error al crear backup. Intenta de nuevo.");
        }

        createBtn.disabled = false;
        createBtn.innerHTML = '<i class="fa-solid fa-shield"></i> Crear backup';
    });

    /* ===== RESTAURAR / ELIMINAR (global) ===== */
    window.BackupsApp = {
        async restore(id) {
            if (!confirm(
                "¿Restaurar notas de este backup?\n" +
                "Las notas del backup se agregarán a las actuales."
            )) return;

            try {
                const data = await FireDB.restoreBackup(id);
                if (data) {
                    alert(
                        `Restauradas ${data.notes ? data.notes.length : 0} notas.\n` +
                        "Recarga la página de Notas para verlas."
                    );
                }
            } catch (err) {
                console.error("Error al restaurar:", err);
                alert("Error al restaurar backup.");
            }
        },

        async remove(id) {
            if (!confirm("¿Eliminar este backup permanentemente?")) return;
            try {
                await FireDB.deleteBackup(id);
                await load();
            } catch (err) {
                console.error("Error al eliminar:", err);
                alert("Error al eliminar backup.");
            }
        }
    };

    /* ===== INICIALIZAR ===== */
    FireDB.ready.then(load);

})();
