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
            showToast("✅ Backup creado correctamente");
        } catch (err) {
            console.error("Error al crear backup:", err);
            showToast("❌ Error al crear backup", true);
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
                showToast("🗑️ Backup eliminado");
            } catch (err) {
                console.error("Error al eliminar:", err);
                showToast("❌ Error al eliminar backup", true);
            }
        }
    };

    /* ===== INICIALIZAR ===== */
    FireDB.ready.then(load);

})();
