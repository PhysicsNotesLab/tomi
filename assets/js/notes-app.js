/* =====================================================
   NOTES APP — Sistema de notas con Firestore
   Centralizado para todas las materias
   Reemplaza los notes.js individuales por materia
===================================================== */

(function () {
    const notesList   = document.getElementById("notesList");
    const notesCount  = document.getElementById("notesCount");
    const saveBtn     = document.getElementById("saveNote");
    const titleInput  = document.getElementById("noteTitle");
    const tagInput    = document.getElementById("noteTag");
    const contentInput = document.getElementById("noteContent");

    if (!notesList || !saveBtn) return;

    let notes = [];

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
        notesList.innerHTML = "";
        if (notesCount) notesCount.textContent = notes.length;

        if (!notes.length) {
            notesList.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem;">No hay notas registradas</p>';
            return;
        }

        notes.forEach(note => {
            const card = document.createElement("div");
            card.className = "note-card";
            card.innerHTML = `
                <span class="tag">${note.tag || ""}</span>
                <h4>${note.title}</h4>
                <p>${note.content}</p>
                <span>${note.date || ""}</span>
                <div class="actions">
                    <button onclick="NotesApp.edit('${note.id}')">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button onclick="NotesApp.remove('${note.id}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `;
            notesList.appendChild(card);
        });
    }

    /* ===== CARGAR DESDE FIRESTORE ===== */
    async function load() {
        try {
            notes = await FireDB.getNotes();
            render();
        } catch (err) {
            console.error("Error cargando notas:", err);
        }
    }

    /* ===== GUARDAR NOTA ===== */
    saveBtn.addEventListener("click", async () => {
        const title   = titleInput.value.trim();
        const content = contentInput.value.trim();
        const tag     = tagInput.value;

        if (!title) {
            alert("El título es obligatorio");
            return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = "Guardando...";

        try {
            await FireDB.addNote({
                title,
                content,
                tag,
                date: new Date().toLocaleDateString("es-CO")
            });
            titleInput.value   = "";
            contentInput.value = "";
            await load();
            showToast("✅ Nota guardada correctamente");
        } catch (err) {
            console.error("Error al guardar nota:", err);
            showToast("❌ Error al guardar nota", true);
        }

        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar nota';
    });

    /* ===== EDITAR / ELIMINAR (global) ===== */
    window.NotesApp = {
        async edit(id) {
            const note = notes.find(n => n.id === id);
            if (!note) return;
            titleInput.value   = note.title;
            contentInput.value = note.content;
            tagInput.value     = note.tag || "Clase";
            await FireDB.deleteNote(id);
            await load();
            window.scrollTo({ top: 0, behavior: "smooth" });
        },

        async remove(id) {
            if (!confirm("¿Eliminar esta nota?")) return;
            try {
                await FireDB.deleteNote(id);
                await load();
                showToast("🗑️ Nota eliminada");
            } catch (err) {
                console.error("Error al eliminar:", err);
                showToast("❌ Error al eliminar nota", true);
            }
        }
    };

    /* ===== INICIALIZAR ===== */
    FireDB.ready.then(load);

})();
