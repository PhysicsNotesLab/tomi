/* =====================================================
   FIRESTORE SERVICE — Servicio centralizado de datos
   Reemplaza localStorage → Firestore
   Estructura: users/{uid}/subjects/{subjectId}/...
   Sub-colecciones: notes, files, backups
===================================================== */

const FireDB = (() => {
    let _uid = null;
    let _subjectId = null;
    let _readyResolve;
    const _ready = new Promise(r => { _readyResolve = r; });

    // Derivar subjectId del URL
    const pathMatch = location.pathname.match(/\/assets\/subjects\/([^\/]+)\//);
    if (pathMatch) {
        _subjectId = decodeURIComponent(pathMatch[1]);
    }

    // Esperar autenticación
    if (typeof auth !== "undefined") {
        auth.onAuthStateChanged(user => {
            if (user) {
                _uid = user.uid;
                _readyResolve();
            }
        });
    }

    function _subRef() {
        if (!_uid || !_subjectId) return null;
        return db.collection("users").doc(_uid)
            .collection("subjects").doc(_subjectId);
    }

    return {
        ready: _ready,
        getSubjectId: () => _subjectId,
        getUid: () => _uid,

        /* ============ SUBJECT INFO (profesor, periodo) ============ */
        async getInfo() {
            const ref = _subRef();
            if (!ref) return {};
            const doc = await ref.get();
            return doc.exists ? doc.data() : {};
        },

        async saveInfo(data) {
            const ref = _subRef();
            if (!ref) return;
            await ref.set(data, { merge: true });
        },

        /* ============ NOTES CRUD ============ */
        async getNotes() {
            const ref = _subRef();
            if (!ref) return [];
            const snap = await ref.collection("notes")
                .orderBy("createdAt", "desc").get();
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        },

        async addNote(note) {
            const ref = _subRef();
            if (!ref) return null;
            note.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            const docRef = await ref.collection("notes").add(note);
            return docRef.id;
        },

        async updateNote(id, data) {
            const ref = _subRef();
            if (!ref) return;
            await ref.collection("notes").doc(id).update(data);
        },

        async deleteNote(id) {
            const ref = _subRef();
            if (!ref) return;
            await ref.collection("notes").doc(id).delete();
        },

        /* ============ FILES CRUD (Firebase Storage) ============ */
        async getFiles() {
            const ref = _subRef();
            if (!ref) return [];
            const snap = await ref.collection("files")
                .orderBy("uploadedAt", "desc").get();
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        },

        async addFile(fileObj, metadata) {
            const ref = _subRef();
            if (!ref) return null;

            // Subir binario a Firebase Storage
            const storagePath = `users/${_uid}/subjects/${_subjectId}/files/${Date.now()}_${fileObj.name}`;
            const storageRef  = storage.ref(storagePath);
            const snapshot    = await storageRef.put(fileObj);
            const downloadURL = await snapshot.ref.getDownloadURL();

            // Guardar metadatos + URL en Firestore
            const fileData = {
                name:       fileObj.name,
                category:   metadata.category || "General",
                date:       metadata.date || new Date().toLocaleDateString("es-CO"),
                size:       fileObj.size,
                type:       fileObj.type,
                url:        downloadURL,
                storagePath: storagePath,
                uploadedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            const docRef = await ref.collection("files").add(fileData);
            return docRef.id;
        },

        async deleteFile(id) {
            const ref = _subRef();
            if (!ref) return;

            // Obtener doc para saber la ruta en Storage
            const doc = await ref.collection("files").doc(id).get();
            if (doc.exists) {
                const data = doc.data();
                // Eliminar de Storage si tiene ruta
                if (data.storagePath) {
                    try {
                        await storage.ref(data.storagePath).delete();
                    } catch (e) {
                        console.warn("No se pudo borrar de Storage:", e);
                    }
                }
                // Compatibilidad: si era base64 antiguo (data field), no hay Storage que borrar
            }
            await ref.collection("files").doc(id).delete();
        },

        /* ============ BACKUPS CRUD ============ */
        async getBackups() {
            const ref = _subRef();
            if (!ref) return [];
            const snap = await ref.collection("backups")
                .orderBy("createdAt", "desc").get();
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        },

        async createBackup(label) {
            const ref = _subRef();
            if (!ref) return;
            const [notes, files] = await Promise.all([
                this.getNotes(), this.getFiles()
            ]);
            const backup = {
                label,
                date: new Date().toLocaleDateString("es-CO"),
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                notesCount: notes.length,
                filesCount: files.length,
                notes: notes.map(({ id, createdAt, ...rest }) => rest),
                filesMeta: files.map(f => ({
                    name: f.name, category: f.category, date: f.date
                }))
            };
            await ref.collection("backups").add(backup);
        },

        async deleteBackup(id) {
            const ref = _subRef();
            if (!ref) return;
            await ref.collection("backups").doc(id).delete();
        },

        async restoreBackup(id) {
            const ref = _subRef();
            if (!ref) return null;
            const doc = await ref.collection("backups").doc(id).get();
            if (!doc.exists) return null;
            const data = doc.data();
            if (data.notes && data.notes.length) {
                for (const note of data.notes) {
                    await this.addNote({ ...note });
                }
            }
            return data;
        }
    };
})();

console.log("🔗 FireDB inicializado — materia:", FireDB.getSubjectId());
console.log("🔗 FireDB uid:", FireDB.getUid());
FireDB.ready.then(() => console.log("✅ FireDB listo — uid:", FireDB.getUid(), "subject:", FireDB.getSubjectId()));
