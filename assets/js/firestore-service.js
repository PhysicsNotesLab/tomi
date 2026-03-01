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

    // UID compartido: ambos correos admin leen/escriben en la misma
    // ruta de Firestore, así ven exactamente los mismos datos.
    const SHARED_UID = 'shared_admin_data';
    const ADMIN_EMAILS = [
        'pgalvisg8156@universidadean.edu.co',
        'tomassantiagogalvisbarrera3@gmail.com'
    ];

    // Derivar subjectId: prioridad → ?subject= > URL path > meta tag
    // 1. Query param ?subject=...
    try {
        const params = new URLSearchParams(location.search);
        if (params.has('subject')) {
            _subjectId = decodeURIComponent(params.get('subject'));
        }
    } catch (e) {}

    // 2. URL path /assets/subjects/{name}/
    if (!_subjectId) {
        const pathMatch = location.pathname.match(/\/assets\/subjects\/([^\/]+)(?:\/|$)/);
        if (pathMatch) {
            _subjectId = decodeURIComponent(pathMatch[1]);
        }
    }

    // 3. Meta tag <meta name="subject-id" content="...">
    if (!_subjectId) {
        const m = document.querySelector('meta[name="subject-id"]');
        if (m && m.content) _subjectId = m.content;
    }

    // Esperar autenticación
    if (typeof auth !== "undefined") {
        auth.onAuthStateChanged(user => {
            if (user) {
                // Si es uno de los admin, usar UID compartido
                const email = (user.email || '').toLowerCase();
                _uid = ADMIN_EMAILS.includes(email) ? SHARED_UID : user.uid;
                _readyResolve();
            }
        });
    }

    function _subRef() {
        if (!_uid) {
            console.warn('FireDB: uid no está disponible aún');
            return null;
        }
        if (!_subjectId) {
            console.warn('FireDB: subjectId no pudo derivarse desde la URL. Usa ?subject=ID o añade <meta name="subject-id"> en la página.');
            return null;
        }
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

        async addFile(fileObj, metadata, onProgress) {
            const ref = _subRef();
            if (!ref) throw new Error("No hay referencia de materia. Recarga la página.");

            // Sanitizar nombre para Storage (sin caracteres problemáticos)
            const safeName = fileObj.name.replace(/[#\[\]\*\?]/g, '_');
            const safeSubject = (_subjectId || 'unknown').replace(/[#\[\]\*\?]/g, '_');

            // Subir binario a Firebase Storage
            const storagePath = 'users/' + _uid + '/subjects/' + safeSubject + '/files/' + Date.now() + '_' + safeName;
            console.log('📤 Storage upload path:', storagePath);
            console.log('📤 UID:', _uid, '| SubjectId:', _subjectId);

            var storageRef, uploadTask;
            try {
                storageRef = storage.ref(storagePath);
                uploadTask = storageRef.put(fileObj);
            } catch (initErr) {
                console.error('Error iniciando upload:', initErr);
                throw initErr;
            }

            // Esperar subida con progreso y timeout
            const downloadURL = await new Promise(function (resolve, reject) {
                var timeoutId = setTimeout(function () {
                    uploadTask.cancel();
                    reject(new Error("Timeout: la subida tardó más de 2 minutos."));
                }, 120000);

                uploadTask.on("state_changed",
                    function (snap) {
                        var pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
                        console.log('📤 Progreso:', pct + '%');
                        if (onProgress) onProgress(pct);
                    },
                    function (err) {
                        clearTimeout(timeoutId);
                        console.error('📤 Error en upload:', err.code, err.message);
                        reject(err);
                    },
                    function () {
                        clearTimeout(timeoutId);
                        uploadTask.snapshot.ref.getDownloadURL().then(function (url) {
                            console.log('📤 Upload completo, URL:', url);
                            resolve(url);
                        }).catch(function (e) {
                            reject(e);
                        });
                    }
                );
            });

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
        },

        /* ============ SEMESTER SUBJECTS CRUD ============ */
        async getSemesterSubjects(semNum) {
            if (!_uid) return [];
            const snap = await db.collection("users").doc(_uid)
                .collection("semesters").doc("sem" + semNum)
                .collection("subjects")
                .orderBy("order")
                .get();
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        },

        async addSemesterSubject(semNum, data) {
            if (!_uid) return null;
            const ref = db.collection("users").doc(_uid)
                .collection("semesters").doc("sem" + semNum)
                .collection("subjects");
            const docRef = await ref.add(data);
            return docRef.id;
        },

        async updateSemesterSubject(semNum, docId, data) {
            if (!_uid) return;
            await db.collection("users").doc(_uid)
                .collection("semesters").doc("sem" + semNum)
                .collection("subjects").doc(docId)
                .update(data);
        },

        async deleteSemesterSubject(semNum, docId) {
            if (!_uid) return;
            await db.collection("users").doc(_uid)
                .collection("semesters").doc("sem" + semNum)
                .collection("subjects").doc(docId)
                .delete();
        },

        async seedSemesterSubjects(semNum, subjects) {
            if (!_uid) return;
            const ref = db.collection("users").doc(_uid)
                .collection("semesters").doc("sem" + semNum)
                .collection("subjects");
            const batch = db.batch();
            subjects.forEach(s => {
                const docRef = ref.doc();
                batch.set(docRef, s);
            });
            await batch.commit();
        }
    };
})();

console.log("🔗 FireDB inicializado — materia:", FireDB.getSubjectId());
console.log("🔗 FireDB uid:", FireDB.getUid());
FireDB.ready.then(() => console.log("✅ FireDB listo — uid:", FireDB.getUid(), "subject:", FireDB.getSubjectId()));
