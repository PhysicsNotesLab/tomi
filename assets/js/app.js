/**
 * FÍSICA UNAL — SPA PRINCIPAL
 * Módulos: DB (Firebase), Router, Views, SemCRUD, App
 * Requiere: firebase-config.js, data.js cargados antes
 */
"use strict";

/* ================================================================
   CONSTANTES
================================================================ */
const SHARED_UID   = "shared_admin_data";
const ADMIN_EMAILS = [
  "pgalvisg8156@universidadean.edu.co",
  "tomassantiagogalvisbarrera3@gmail.com"
];

/* ================================================================
   DB — Todos los accesos a Firestore y Storage
================================================================ */
const DB = {

  uid() { return SHARED_UID; },

  _subRef(semId, subId) {
    return db.collection("users").doc(this.uid())
             .collection("subjects").doc(subKey(semId, subId));
  },

  /* ---- CUSTOM SUBJECTS PER SEMESTER ---- */
  async getSubjects(semId) {
    try {
      const snap = await db.collection("users").doc(this.uid())
                           .collection("semSubjects").doc(String(semId)).get();
      if (snap.exists && snap.data().subjects?.length) {
        return snap.data().subjects;
      }
    } catch(e) { console.warn("getSubjects fallback:", e); }
    // Fallback: use static data.js
    const sem = getSemester(semId);
    return sem ? JSON.parse(JSON.stringify(sem.subjects)) : [];
  },

  async saveSubjects(semId, subjects) {
    await db.collection("users").doc(this.uid())
            .collection("semSubjects").doc(String(semId))
            .set({ subjects, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
  },

  /* ---- SUBJECT META (status, grade, professor, period) ---- */
  async getSubjectMeta(semId, subId) {
    const snap = await this._subRef(semId, subId).get();
    return snap.exists ? snap.data() : {};
  },

  async saveSubjectMeta(semId, subId, data) {
    await this._subRef(semId, subId)
      .set({ ...data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() },
           { merge: true });
  },

  async getAllSubjectsMeta() {
    const snap = await db.collection("users").doc(this.uid())
                         .collection("subjects").get();
    const map = {};
    snap.forEach(d => { map[d.id] = d.data(); });
    return map;
  },

  /* ---- NOTES CRUD ---- */
  async getNotes(semId, subId) {
    const snap = await this._subRef(semId, subId).collection("notes")
                           .orderBy("createdAt", "desc").get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async addNote(semId, subId, note) {
    await this._subRef(semId, subId).collection("notes").add({
      ...note,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  },

  async updateNote(semId, subId, noteId, data) {
    await this._subRef(semId, subId).collection("notes").doc(noteId).update(data);
  },

  async deleteNote(semId, subId, noteId) {
    await this._subRef(semId, subId).collection("notes").doc(noteId).delete();
  },

  /* ---- FILES CRUD ---- */
  async getFiles(semId, subId) {
    const snap = await this._subRef(semId, subId).collection("files")
                           .orderBy("uploadedAt", "desc").get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async getAllFiles() {
    const allDocs = [];
    try {
      const subjectsSnap = await db.collection("users").doc(this.uid())
                                   .collection("subjects").get();
      const promises = subjectsSnap.docs.map(d =>
        d.ref.collection("files").orderBy("uploadedAt","desc").get()
          .then(fs => fs.docs.map(f => ({
            id: f.id, subjectDocId: d.id, ...f.data()
          })))
      );
      const arrays = await Promise.all(promises);
      arrays.forEach(arr => allDocs.push(...arr));
      allDocs.sort((a,b) => {
        const ta = a.uploadedAt?.toMillis?.() || 0;
        const tb = b.uploadedAt?.toMillis?.() || 0;
        return tb - ta;
      });
    } catch(e) { console.warn("getAllFiles error:", e); }
    return allDocs;
  },

  uploadFile(semId, subId, file, category, onProgress) {
    return new Promise((resolve, reject) => {
      const safeName = file.name.replace(/[#\[\]*?]/g, "_");
      const path = `users/${this.uid()}/${semId}/${subId}/${Date.now()}_${safeName}`;
      const task = storage.ref(path).put(file);

      task.on("state_changed",
        snap => onProgress && onProgress(
          Math.round((snap.bytesTransferred / snap.totalBytes) * 100)
        ),
        err  => reject(err),
        async () => {
          const url = await task.snapshot.ref.getDownloadURL();
          const meta = {
            name:        file.name,
            category:    category || "General",
            date:        new Date().toLocaleDateString("es-CO"),
            size:        file.size,
            type:        file.type,
            url,
            storagePath: path,
            uploadedAt:  firebase.firestore.FieldValue.serverTimestamp()
          };
          await this._subRef(semId, subId).collection("files").add(meta);
          resolve(meta);
        }
      );
    });
  },

  async deleteFile(semId, subId, fileId, storagePath) {
    await this._subRef(semId, subId).collection("files").doc(fileId).delete();
    if (storagePath) {
      try { await storage.ref(storagePath).delete(); } catch(e) {}
    }
  }
};

/* ================================================================
   STATE
================================================================ */
const State = {
  user:             null,
  route:            { view: "dashboard", semId: null, subId: null },
  subjectsMeta:     {},
  sidebarOpen:      false,
  semAccordionOpen: false,
};

// Cache de materias personalizadas por semestre
window._semSubjects = {};

/* ================================================================
   ROUTER
================================================================ */
const Router = {
  parse(hash) {
    const h     = (hash || location.hash).replace("#", "");
    const parts = h.split("/");
    return {
      view:  parts[0] || "dashboard",
      semId: parts[1] ? parseInt(parts[1]) : null,
      subId: parts[2] || null,
    };
  },
  go(path) { location.hash = path; },
  init() {
    window.addEventListener("hashchange", () => {
      State.route = this.parse();
      App.applyRoute();
    });
  }
};

/* ================================================================
   TOAST
================================================================ */
function toast(msg, type = "ok") {
  const icons = { ok:"fa-check-circle", err:"fa-circle-xmark", info:"fa-circle-info" };
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.innerHTML = `<i class="fa-solid ${icons[type]||icons.info}"></i><span>${msg}</span>`;
  document.getElementById("toastContainer").appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

/* ================================================================
   HELPERS
================================================================ */
function setContent(html) {
  document.getElementById("appContent").innerHTML = html;
}
function loading() {
  return `<div class="loading-wrap"><div class="spinner"></div></div>`;
}
function emptyState(icon, title, sub) {
  return `<div class="empty-state">
    <i class="fa-solid ${icon}"></i>
    <h3>${title}</h3><p>${sub}</p>
  </div>`;
}
function fileItemHTML(f) {
  const ft = getFileIcon(f.type || "");
  return `
    <div class="file-item">
      <div class="file-icon-wrap">
        <i class="fa-solid ${ft.icon}" style="color:${ft.color}"></i>
      </div>
      <div class="file-info">
        <div class="file-name">${f.name}</div>
        <div class="file-meta">${f.category || ""} · ${formatBytes(f.size)} · ${formatDate(f.uploadedAt)}</div>
      </div>
      <div class="file-actions">
        ${f.url ? `<button class="btn-icon" onclick="window.open('${f.url}','_blank')" title="Abrir">
          <i class="fa-solid fa-arrow-up-right-from-square"></i></button>` : ""}
        <button class="btn-icon danger" data-del-file="${f.id}"
          data-sem="${f._semId||''}" data-sub="${f._subId||''}"
          data-path="${f.storagePath||''}" title="Eliminar">
          <i class="fa-solid fa-trash"></i></button>
      </div>
    </div>`;
}

/* Helper: obtener materia considerando cache de custom subjects */
function resolveSubject(semId, subId) {
  if (window._semSubjects?.[semId]) {
    return window._semSubjects[semId].find(s => s.id === subId) || null;
  }
  return getSubject(semId, subId);
}

/* ================================================================
   SEM CRUD — Modal para agregar / editar / eliminar materias
================================================================ */
const SemCRUD = {
  _semId:  null,
  _editId: null,

  /* Abrir modal para AGREGAR */
  openAdd(semId) {
    this._semId  = semId;
    this._editId = null;
    document.getElementById("modalTitle").textContent   = "Agregar materia";
    document.getElementById("modalName").value          = "";
    document.getElementById("modalDesc").value          = "";
    document.getElementById("modalCredits").value       = "3";
    document.getElementById("modalIcon").value          = "fa-atom";
    document.getElementById("modalTag").value           = "Teoría";
    this._refreshIconPreview();
    document.getElementById("subjectModal").classList.add("open");
    setTimeout(() => document.getElementById("modalName").focus(), 100);
  },

  /* Abrir modal para EDITAR */
  async openEdit(semId, subId, e) {
    e && e.stopPropagation();
    this._semId  = semId;
    this._editId = subId;
    const subjects = window._semSubjects[semId] || await DB.getSubjects(semId);
    const sub = subjects.find(s => s.id === subId);
    if (!sub) return;
    document.getElementById("modalTitle").textContent   = "Editar materia";
    document.getElementById("modalName").value          = sub.name;
    document.getElementById("modalDesc").value          = sub.description || "";
    document.getElementById("modalCredits").value       = sub.credits;
    document.getElementById("modalIcon").value          = sub.icon || "fa-atom";
    document.getElementById("modalTag").value           = sub.tag  || "Teoría";
    this._refreshIconPreview();
    document.getElementById("subjectModal").classList.add("open");
    setTimeout(() => document.getElementById("modalName").focus(), 100);
  },

  close() {
    document.getElementById("subjectModal").classList.remove("open");
  },

  _refreshIconPreview() {
    const icon = document.getElementById("modalIcon").value;
    const prev = document.getElementById("modalIconPreview");
    prev.className = `fa-solid ${icon}`;
  },

  /* Guardar (add o edit) */
  async save() {
    const name    = document.getElementById("modalName").value.trim();
    const desc    = document.getElementById("modalDesc").value.trim();
    const credits = parseInt(document.getElementById("modalCredits").value) || 3;
    const icon    = document.getElementById("modalIcon").value;
    const tag     = document.getElementById("modalTag").value;

    if (!name) { toast("El nombre es obligatorio", "info"); return; }

    const semId   = this._semId;
    const btn     = document.getElementById("btnModalSave");
    btn.disabled  = true;
    btn.textContent = "Guardando...";

    try {
      const subjects = await DB.getSubjects(semId);

      if (this._editId) {
        const idx = subjects.findIndex(s => s.id === this._editId);
        if (idx !== -1) {
          subjects[idx] = { ...subjects[idx], name, description: desc, credits, icon, tag };
        }
      } else {
        const newId = `s${semId}_custom_${Date.now()}`;
        subjects.push({ id: newId, name, description: desc, credits, icon, tag });
      }

      await DB.saveSubjects(semId, subjects);
      window._semSubjects[semId] = subjects;

      this.close();
      toast(this._editId ? "Materia actualizada ✓" : "Materia agregada ✓");
      await Views.semester(semId);
    } catch(err) {
      toast("Error al guardar: " + err.message, "err");
    }
    btn.disabled    = false;
    btn.innerHTML   = '<i class="fa-solid fa-floppy-disk"></i> Guardar';
  },

  /* Eliminar materia */
  async deleteSub(semId, subId, e) {
    e && e.stopPropagation();
    if (!confirm("¿Eliminar esta materia?\nEsto no borrará las notas y archivos ya guardados en Firestore, pero ya no aparecerán en la lista.")) return;
    try {
      const subjects = await DB.getSubjects(semId);
      const filtered = subjects.filter(s => s.id !== subId);
      await DB.saveSubjects(semId, filtered);
      window._semSubjects[semId] = filtered;
      toast("Materia eliminada");
      await Views.semester(semId);
    } catch(err) {
      toast("Error: " + err.message, "err");
    }
  }
};

/* Lista de iconos disponibles para el selector */
const ICON_OPTIONS = [
  { value: "fa-atom",              label: "⚛ Átomo"              },
  { value: "fa-flask",             label: "🧪 Frasco / Lab"       },
  { value: "fa-flask-vial",        label: "🧫 Vial Lab"           },
  { value: "fa-wave-square",       label: "〰 Ondas"              },
  { value: "fa-bolt",              label: "⚡ Electricidad"       },
  { value: "fa-magnet",            label: "🧲 Magnetismo"         },
  { value: "fa-infinity",          label: "∞ Integral"            },
  { value: "fa-square-root-variable", label: "√ Ecuaciones"      },
  { value: "fa-superscript",       label: "Xⁿ Matemáticas esp."  },
  { value: "fa-gears",             label: "⚙ Mecánica"            },
  { value: "fa-temperature-high",  label: "🌡 Termodinámica"      },
  { value: "fa-chart-line",        label: "📈 Estadística"        },
  { value: "fa-chart-bar",         label: "📊 Estadística básica" },
  { value: "fa-code",              label: "💻 Programación"       },
  { value: "fa-laptop-code",       label: "🖥 Comp. Tools"        },
  { value: "fa-microchip",         label: "🔌 Electrónica"        },
  { value: "fa-eye",               label: "👁 Óptica"             },
  { value: "fa-lightbulb",         label: "💡 Óptica/Fluidos"     },
  { value: "fa-clock",             label: "⏱ Relatividad"        },
  { value: "fa-shuffle",           label: "🔀 Cuántica"           },
  { value: "fa-burst",             label: "💥 Partículas"         },
  { value: "fa-cube",              label: "🧊 Estado Sólido"      },
  { value: "fa-star",              label: "⭐ Cosmología"         },
  { value: "fa-microscope",        label: "🔬 Investigación"      },
  { value: "fa-scroll",            label: "📜 Tesis"              },
  { value: "fa-circle-plus",       label: "➕ Electiva"           },
  { value: "fa-ruler-combined",    label: "📐 Mediciones"         },
  { value: "fa-arrows-spin",       label: "🔄 Cálculo Vectorial"  },
  { value: "fa-brain",             label: "🧠 Taller"             },
  { value: "fa-book-open",         label: "📖 Humanidades"        },
  { value: "fa-language",          label: "🌐 Idiomas"            },
  { value: "fa-apple-whole",       label: "🍎 Newtoniana"         },
  { value: "fa-newspaper",         label: "📰 Seminario"          },
  { value: "fa-vector-square",     label: "▦ Álgebra Lineal"     },
  { value: "fa-layer-group",       label: "🗂 General"            },
];

/* ================================================================
   VIEWS
================================================================ */
const Views = {

  /* ---------- DASHBOARD ---------- */
  async dashboard() {
    setContent(loading());
    const meta = await DB.getAllSubjectsMeta();
    State.subjectsMeta = meta;

    let passedCr = 0, passedCount = 0, activeCount = 0, totalSubs = 0;
    CURRICULUM.forEach(sem => {
      sem.subjects.forEach(sub => {
        totalSubs++;
        const k  = subKey(sem.id, sub.id);
        const st = meta[k]?.status || "pending";
        if (st === "passed") { passedCr += sub.credits; passedCount++; }
        if (st === "active") activeCount++;
      });
    });
    const pct = Math.round((passedCr / TOTAL_CREDITS) * 100);

    let recentHtml = "";
    try {
      const allFiles = await DB.getAllFiles();
      recentHtml = allFiles.length === 0
        ? emptyState("folder-open", "Sin documentos", "Sube tus primeros archivos desde una materia")
        : allFiles.slice(0, 6).map(f => fileItemHTML(f)).join("");
    } catch(e) { recentHtml = emptyState("folder-open","Sin documentos",""); }

    const semGrid = CURRICULUM.map(sem => {
      const total  = sem.subjects.length;
      const passed = sem.subjects.filter(s =>
        meta[subKey(sem.id,s.id)]?.status === "passed").length;
      const pctSem = total ? Math.round((passed/total)*100) : 0;
      return `
        <div class="semester-card" onclick="Router.go('semester/${sem.id}')">
          <i class="fa-solid ${sem.icon}"></i>
          <h3>${sem.name}</h3>
          <p>${sem.subtitle}</p>
          <span class="sem-cr-badge">${sem.credits} cr</span>
          <div class="sem-mini-bar">
            <div class="sem-mini-fill" style="width:${pctSem}%"></div>
          </div>
        </div>`;
    }).join("");

    setContent(`
      <div class="page-title" style="margin-bottom:4px">CENTRO DE CONTROL</div>
      <p class="page-sub" style="margin-bottom:20px">Carrera de Física — Universidad Nacional de Colombia</p>

      <div class="stats-row">
        <div class="stat-card">
          <i class="fa-solid fa-graduation-cap"></i>
          <span class="stat-label">Créditos aprobados</span>
          <span class="stat-value">${passedCr}</span>
          <span class="stat-sub">de ${TOTAL_CREDITS} totales</span>
        </div>
        <div class="stat-card">
          <i class="fa-solid fa-circle-check"></i>
          <span class="stat-label">Materias aprobadas</span>
          <span class="stat-value">${passedCount}</span>
          <span class="stat-sub">de ${totalSubs} materias</span>
        </div>
        <div class="stat-card">
          <i class="fa-solid fa-circle-dot" style="color:var(--accent-teal)"></i>
          <span class="stat-label">En curso</span>
          <span class="stat-value">${activeCount}</span>
          <span class="stat-sub">actualmente</span>
        </div>
        <div class="stat-card">
          <i class="fa-solid fa-layer-group" style="color:var(--accent-yellow)"></i>
          <span class="stat-label">Semestres</span>
          <span class="stat-value">10</span>
          <span class="stat-sub">en total</span>
        </div>
      </div>

      <div class="progress-section">
        <div class="progress-header">
          <span>PROGRESO DE LA CARRERA</span>
          <strong>${pct}%</strong>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${pct}%"></div>
        </div>
      </div>

      <div class="section-heading" style="margin-bottom:14px">
        <i class="fa-solid fa-layer-group"></i> SEMESTRES
      </div>
      <div class="semester-grid" style="margin-bottom:0">${semGrid}</div>

      <div class="recent-box">
        <div class="recent-box-head">
          <i class="fa-solid fa-clock-rotate-left"></i> DOCUMENTOS RECIENTES
        </div>
        <div class="files-list" style="border:none;border-radius:0">${recentHtml}</div>
      </div>
    `);
  },

  /* ---------- SEMESTER (con CRUD) ---------- */
  async semester(semId) {
    setContent(loading());
    const sem = getSemester(semId);
    if (!sem) { setContent(`<p>Semestre no encontrado</p>`); return; }

    if (!Object.keys(State.subjectsMeta).length) {
      State.subjectsMeta = await DB.getAllSubjectsMeta();
    }

    // Cargar materias desde Firestore (o data.js como fallback)
    const subjects = await DB.getSubjects(semId);
    window._semSubjects[semId] = subjects;

    const cards = subjects.map(sub => {
      const k   = subKey(semId, sub.id);
      const st  = State.subjectsMeta[k]?.status || "pending";
      const cfg = SUBJECT_STATUS[st];
      return `
        <div class="subject-card">
          <div class="card-actions">
            <button class="card-btn"
              onclick="SemCRUD.openEdit(${semId},'${sub.id}',event)" title="Editar">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="card-btn card-delete"
              onclick="SemCRUD.deleteSub(${semId},'${sub.id}',event)" title="Eliminar">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
          <div class="sub-click" onclick="Router.go('subject/${semId}/${sub.id}')">
            <div class="sub-icon"><i class="fa-solid ${sub.icon || 'fa-atom'}"></i></div>
            <div class="sub-body">
              <h3>${sub.name}</h3>
              ${sub.description ? `<p class="sub-desc">${sub.description}</p>` : ""}
              <div class="sub-meta">
                <span class="sub-tag">${sub.tag || "General"}</span>
                <span class="sub-cr">${sub.credits} cr</span>
                <span class="status-badge ${cfg.cls}">
                  <i class="fa-solid ${cfg.icon}"></i>${cfg.label}
                </span>
              </div>
            </div>
          </div>
        </div>`;
    }).join("");

    const addCard = `
      <div class="subject-card add-card" onclick="SemCRUD.openAdd(${semId})">
        <i class="fa-solid fa-circle-plus"></i>
        <h3>Agregar materia</h3>
        <span>Nueva asignatura</span>
      </div>`;

    const totalCredits = subjects.reduce((s, sub) => s + (sub.credits||0), 0);

    setContent(`
      <button class="btn-back" onclick="Router.go('dashboard')">
        <i class="fa-solid fa-arrow-left"></i> Centro de Control
      </button>
      <div class="page-title">${sem.name.toUpperCase()} — ${sem.subtitle.toUpperCase()}</div>
      <p class="page-sub" style="margin-bottom:20px">
        ${totalCredits} créditos · ${subjects.length} materias
        <span style="color:var(--text-dim);font-size:11px;margin-left:8px">
          (usa ✏️ para editar o + para agregar)
        </span>
      </p>
      <div class="subjects-grid">${cards}${addCard}</div>
    `);
  },

  /* ---------- SUBJECT DETAIL ---------- */
  async subject(semId, subId) {
    setContent(loading());
    const sem = getSemester(semId);
    if (!sem) { setContent(`<p>Semestre no encontrado</p>`); return; }

    // Intentar obtener materia desde cache de custom subjects
    if (!window._semSubjects[semId]) {
      window._semSubjects[semId] = await DB.getSubjects(semId);
    }
    const sub = resolveSubject(semId, subId);
    if (!sub) { setContent(`<p>Materia no encontrada</p>`); return; }

    const meta  = await DB.getSubjectMeta(semId, subId);
    const notes = await DB.getNotes(semId, subId);
    const files = await DB.getFiles(semId, subId);

    const status   = meta.status    || "pending";
    const grade    = meta.grade     || "";
    const profName = meta.professor || "";
    const period   = meta.period    || "";

    const statusOpts = Object.entries(SUBJECT_STATUS).map(([k,v]) =>
      `<option value="${k}" ${status===k?"selected":""}>${v.label}</option>`
    ).join("");

    const notesHTML = notes.length === 0
      ? emptyState("book-open","Sin notas","Agrega tu primera anotación arriba")
      : notes.map(n => `
          <div class="note-card" id="nc-${n.id}">
            <span class="note-tag">${n.tag||"Nota"}</span>
            <div class="note-title">${n.title}</div>
            <div class="note-content">${n.content||""}</div>
            <div class="note-footer">
              <span class="note-date">${n.date||""}</span>
              <div class="note-actions">
                <button class="btn-icon" onclick="SubjectActions.editNote('${n.id}')" title="Editar">
                  <i class="fa-solid fa-pen"></i></button>
                <button class="btn-icon danger" onclick="SubjectActions.deleteNote('${n.id}')" title="Eliminar">
                  <i class="fa-solid fa-trash"></i></button>
              </div>
            </div>
          </div>`).join("");

    const filesHTML = files.length === 0
      ? emptyState("folder-open","Sin archivos","Sube documentos, PDFs, imágenes o archivos Excel")
      : `<div class="files-list">${files.map(f => {
          const ft = getFileIcon(f.type||"");
          return `
            <div class="file-item">
              <div class="file-icon-wrap">
                <i class="fa-solid ${ft.icon}" style="color:${ft.color}"></i>
              </div>
              <div class="file-info">
                <div class="file-name">${f.name}</div>
                <div class="file-meta">${f.category||""} · ${formatBytes(f.size)} · ${formatDate(f.uploadedAt)}</div>
              </div>
              <div class="file-actions">
                ${f.url?`<button class="btn-icon" onclick="window.open('${f.url}','_blank')" title="Abrir">
                  <i class="fa-solid fa-arrow-up-right-from-square"></i></button>`:""}
                <button class="btn-icon danger" onclick="SubjectActions.deleteFile('${f.id}','${f.storagePath||''}')" title="Eliminar">
                  <i class="fa-solid fa-trash"></i></button>
              </div>
            </div>`;
        }).join("")}</div>`;

    setContent(`
      <button class="btn-back" onclick="Router.go('semester/${semId}')">
        <i class="fa-solid fa-arrow-left"></i> ${sem.name}
      </button>

      <!-- Hero -->
      <div class="subject-hero">
        <div class="hero-icon"><i class="fa-solid ${sub.icon || 'fa-atom'}"></i></div>
        <div class="hero-info">
          <h2>${sub.name}</h2>
          ${sub.description ? `<p style="color:var(--text-muted);font-size:13px;margin-bottom:6px">${sub.description}</p>` : ""}
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <span class="sub-cr">${sub.credits} créditos</span>
            <span class="sub-tag">${sub.tag || "General"}</span>
            <span class="status-badge ${SUBJECT_STATUS[status].cls}">
              <i class="fa-solid ${SUBJECT_STATUS[status].icon}"></i>
              ${SUBJECT_STATUS[status].label}
            </span>
          </div>
          <div class="hero-controls">
            <div class="ctrl-group">
              <span class="ctrl-label">Estado</span>
              <select class="ctrl-select" id="subStatus">${statusOpts}</select>
            </div>
            <div class="ctrl-group">
              <span class="ctrl-label">Nota final</span>
              <input type="number" class="ctrl-input" id="subGrade"
                     value="${grade}" min="0" max="5" step="0.1" placeholder="0.0–5.0">
            </div>
            <div class="ctrl-group">
              <span class="ctrl-label">Profesor</span>
              <input type="text" class="ctrl-text" id="subProf"
                     value="${profName}" placeholder="Por asignar">
            </div>
            <div class="ctrl-group">
              <span class="ctrl-label">Periodo</span>
              <input type="text" class="ctrl-text" id="subPeriod"
                     value="${period}" placeholder="2025-1">
            </div>
            <button class="btn-primary" id="btnSaveMeta" style="align-self:flex-end">
              <i class="fa-solid fa-floppy-disk"></i> Guardar
            </button>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="tabs">
        <button class="tab-btn active" data-tab="notes">
          <i class="fa-solid fa-book"></i> Notas (${notes.length})
        </button>
        <button class="tab-btn" data-tab="files">
          <i class="fa-solid fa-folder"></i> Archivos (${files.length})
        </button>
      </div>

      <!-- TAB: NOTES -->
      <div class="tab-panel active" id="tab-notes">
        <div class="notes-form">
          <div class="section-heading" style="margin-bottom:12px">
            <i class="fa-solid fa-pen-nib"></i> NUEVA NOTA
          </div>
          <div class="form-row">
            <input type="text" class="form-input" id="noteTitle" placeholder="Título de la nota">
            <select class="form-select" id="noteTag">
              <option>Clase</option><option>Parcial</option>
              <option>Taller</option><option>Proyecto</option>
              <option>Laboratorio</option><option>Observación</option>
            </select>
          </div>
          <textarea class="form-textarea" id="noteContent"
            placeholder="Contenido de la nota..."></textarea>
          <div style="margin-top:10px;text-align:right">
            <button class="btn-primary" id="btnSaveNote">
              <i class="fa-solid fa-floppy-disk"></i> Guardar nota
            </button>
          </div>
        </div>
        <div class="notes-grid" id="notesList">${notesHTML}</div>
      </div>

      <!-- TAB: FILES -->
      <div class="tab-panel" id="tab-files">
        <div class="upload-zone" id="uploadZone">
          <i class="fa-solid fa-cloud-arrow-up"></i>
          <p>Arrastra archivos aquí o haz clic para seleccionar</p>
          <small>PDF, Word, Excel, imágenes, capturas, texto — Sin límite de tamaño</small>
          <input type="file" id="fileInput" multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.webp,.gif,.bmp">
        </div>
        <div class="upload-controls">
          <select class="form-select" id="fileCategory" style="min-width:140px">
            <option>Clase</option><option>Laboratorio</option>
            <option>Parcial</option><option>Taller</option>
            <option>Proyecto</option><option>Apunte</option><option>Otro</option>
          </select>
          <button class="btn-primary" id="btnUpload">
            <i class="fa-solid fa-cloud-arrow-up"></i> Subir seleccionados
          </button>
        </div>
        <div id="uploadProgressList"></div>
        <div id="filesList">${filesHTML}</div>
      </div>
    `);

    window._curSemId = semId;
    window._curSubId = subId;
    window._notes    = notes;
    window._files    = files;

    /* ---- Tab switching ---- */
    document.querySelectorAll(".tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
      });
    });

    /* ---- Save meta ---- */
    document.getElementById("btnSaveMeta").addEventListener("click", async () => {
      const btn = document.getElementById("btnSaveMeta");
      btn.disabled = true;
      try {
        const data = {
          status:    document.getElementById("subStatus").value,
          grade:     parseFloat(document.getElementById("subGrade").value) || null,
          professor: document.getElementById("subProf").value.trim(),
          period:    document.getElementById("subPeriod").value.trim(),
        };
        await DB.saveSubjectMeta(semId, subId, data);
        const cfg = SUBJECT_STATUS[data.status];
        document.querySelector(".status-badge").className = `status-badge ${cfg.cls}`;
        document.querySelector(".status-badge").innerHTML =
          `<i class="fa-solid ${cfg.icon}"></i>${cfg.label}`;
        App.updateSidebarActive();
        toast("Datos guardados");
      } catch(e) { toast("Error al guardar: " + e.message, "err"); }
      btn.disabled = false;
    });

    /* ---- Save note ---- */
    document.getElementById("btnSaveNote").addEventListener("click", async () => {
      const title = document.getElementById("noteTitle").value.trim();
      if (!title) { toast("El título es obligatorio", "info"); return; }
      const btn = document.getElementById("btnSaveNote");
      btn.disabled = true;
      try {
        await DB.addNote(semId, subId, {
          title,
          content: document.getElementById("noteContent").value.trim(),
          tag:     document.getElementById("noteTag").value,
          date:    new Date().toLocaleDateString("es-CO"),
        });
        document.getElementById("noteTitle").value   = "";
        document.getElementById("noteContent").value = "";
        await Views.refreshNotes(semId, subId);
        toast("Nota guardada");
      } catch(e) { toast("Error: " + e.message, "err"); }
      btn.disabled = false;
    });

    SubjectActions.setupUpload(semId, subId);
  },

  async refreshNotes(semId, subId) {
    const notes = await DB.getNotes(semId, subId);
    window._notes = notes;
    const html = notes.length === 0
      ? emptyState("book-open","Sin notas","Agrega tu primera anotación arriba")
      : notes.map(n => `
          <div class="note-card" id="nc-${n.id}">
            <span class="note-tag">${n.tag||"Nota"}</span>
            <div class="note-title">${n.title}</div>
            <div class="note-content">${n.content||""}</div>
            <div class="note-footer">
              <span class="note-date">${n.date||""}</span>
              <div class="note-actions">
                <button class="btn-icon" onclick="SubjectActions.editNote('${n.id}')" title="Editar">
                  <i class="fa-solid fa-pen"></i></button>
                <button class="btn-icon danger" onclick="SubjectActions.deleteNote('${n.id}')" title="Eliminar">
                  <i class="fa-solid fa-trash"></i></button>
              </div>
            </div>
          </div>`).join("");
    document.getElementById("notesList").innerHTML = html;
    document.querySelector("[data-tab='notes']").innerHTML =
      `<i class="fa-solid fa-book"></i> Notas (${notes.length})`;
  },

  async refreshFiles(semId, subId) {
    const files = await DB.getFiles(semId, subId);
    window._files = files;
    const html = files.length === 0
      ? emptyState("folder-open","Sin archivos","Sube documentos, PDFs, imágenes o archivos Excel")
      : `<div class="files-list">${files.map(f => {
          const ft = getFileIcon(f.type||"");
          return `
            <div class="file-item">
              <div class="file-icon-wrap">
                <i class="fa-solid ${ft.icon}" style="color:${ft.color}"></i>
              </div>
              <div class="file-info">
                <div class="file-name">${f.name}</div>
                <div class="file-meta">${f.category||""} · ${formatBytes(f.size)} · ${formatDate(f.uploadedAt)}</div>
              </div>
              <div class="file-actions">
                ${f.url?`<button class="btn-icon" onclick="window.open('${f.url}','_blank')" title="Abrir">
                  <i class="fa-solid fa-arrow-up-right-from-square"></i></button>`:""}
                <button class="btn-icon danger" onclick="SubjectActions.deleteFile('${f.id}','${f.storagePath||''}')" title="Eliminar">
                  <i class="fa-solid fa-trash"></i></button>
              </div>
            </div>`;
        }).join("")}</div>`;
    document.getElementById("filesList").innerHTML = html;
    document.querySelector("[data-tab='files']").innerHTML =
      `<i class="fa-solid fa-folder"></i> Archivos (${files.length})`;
  },

  /* ---------- ALL DOCUMENTS ---------- */
  async documents() {
    setContent(loading());
    const allFiles = await DB.getAllFiles();

    const subjectNames = {};
    CURRICULUM.forEach(sem => sem.subjects.forEach(sub => {
      subjectNames[subKey(sem.id, sub.id)] = `${sem.name} · ${sub.name}`;
    }));
    // También incluir custom subjects cacheados
    Object.entries(window._semSubjects).forEach(([semId, subs]) => {
      subs.forEach(sub => {
        const k = subKey(semId, sub.id);
        if (!subjectNames[k]) {
          const sem = getSemester(parseInt(semId));
          subjectNames[k] = `${sem?.name || "Sem "+semId} · ${sub.name}`;
        }
      });
    });

    const semOptions = CURRICULUM.map(s =>
      `<option value="${s.id}">${s.name}</option>`).join("");

    const listHTML = (files) => files.length === 0
      ? emptyState("folder-open","Sin documentos","Sube archivos desde cada materia")
      : `<div class="files-list">${files.map(f => {
          const ft    = getFileIcon(f.type||"");
          const label = subjectNames[f.subjectDocId] || f.subjectDocId || "—";
          return `
            <div class="file-item">
              <div class="file-icon-wrap">
                <i class="fa-solid ${ft.icon}" style="color:${ft.color}"></i>
              </div>
              <div class="file-info">
                <div class="file-name">${f.name}</div>
                <div class="file-meta">${label} · ${f.category||""} · ${formatBytes(f.size)} · ${formatDate(f.uploadedAt)}</div>
              </div>
              <div class="file-actions">
                ${f.url?`<button class="btn-icon" onclick="window.open('${f.url}','_blank')">
                  <i class="fa-solid fa-arrow-up-right-from-square"></i></button>`:""}
              </div>
            </div>`;
        }).join("")}</div>`;

    setContent(`
      <div class="page-title" style="margin-bottom:4px">TODOS MIS DOCUMENTOS</div>
      <p class="page-sub" style="margin-bottom:18px">${allFiles.length} archivos en total</p>
      <div class="filter-bar">
        <div class="search-wrap">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input type="text" class="search-input" id="docsSearch" placeholder="Buscar por nombre...">
        </div>
        <select class="filter-select" id="docsSemFilter">
          <option value="">Todos los semestres</option>
          ${semOptions}
        </select>
        <select class="filter-select" id="docsTypeFilter">
          <option value="">Todos los tipos</option>
          <option value="pdf">PDF</option>
          <option value="word">Word</option>
          <option value="excel">Excel</option>
          <option value="image">Imágenes</option>
          <option value="text">Texto</option>
        </select>
      </div>
      <div id="docsList">${listHTML(allFiles)}</div>
    `);

    function applyFilters() {
      const q    = document.getElementById("docsSearch").value.toLowerCase();
      const sem  = document.getElementById("docsSemFilter").value;
      const type = document.getElementById("docsTypeFilter").value;
      const filtered = allFiles.filter(f => {
        const nameOk  = !q    || f.name.toLowerCase().includes(q);
        const semOk   = !sem  || (f.subjectDocId||"").startsWith(sem+"_");
        const typeOk  = !type || Views._matchType(f.type||"", type);
        return nameOk && semOk && typeOk;
      });
      document.getElementById("docsList").innerHTML = listHTML(filtered);
    }

    ["docsSearch","docsSemFilter","docsTypeFilter"].forEach(id =>
      document.getElementById(id).addEventListener("input", applyFilters)
    );
  },

  _matchType(mime, filter) {
    const map = {
      pdf:   m => m.includes("pdf"),
      word:  m => m.includes("word") || m.includes("msword"),
      excel: m => m.includes("sheet") || m.includes("excel"),
      image: m => m.startsWith("image/"),
      text:  m => m.includes("text"),
    };
    return map[filter] ? map[filter](mime) : true;
  },

  /* ---------- STATS ---------- */
  async stats() {
    setContent(loading());
    const meta = await DB.getAllSubjectsMeta();
    State.subjectsMeta = meta;

    const rows = CURRICULUM.map(sem => {
      const total    = sem.subjects.length;
      const passed   = sem.subjects.filter(s =>
        meta[subKey(sem.id,s.id)]?.status === "passed").length;
      const active   = sem.subjects.filter(s =>
        meta[subKey(sem.id,s.id)]?.status === "active").length;
      const pctSem   = total ? Math.round((passed/total)*100) : 0;
      const passedCr = sem.subjects
        .filter(s => meta[subKey(sem.id,s.id)]?.status === "passed")
        .reduce((s,sub) => s + sub.credits, 0);

      return `
        <div class="stats-bar-item">
          <div class="stats-bar-label">
            <span>${sem.name} — ${sem.subtitle}</span>
            <span>${passedCr}/${sem.credits} cr · ${passed}/${total} materias</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width:${pctSem}%"></div>
          </div>
        </div>`;
    }).join("");

    let totalPassed=0, totalActive=0, totalPending=0, totalFailed=0;
    CURRICULUM.forEach(sem => sem.subjects.forEach(sub => {
      const st = meta[subKey(sem.id,sub.id)]?.status || "pending";
      if(st==="passed")  totalPassed++;
      else if(st==="active") totalActive++;
      else if(st==="failed") totalFailed++;
      else totalPending++;
    }));

    setContent(`
      <div class="page-title" style="margin-bottom:4px">ESTADÍSTICAS</div>
      <p class="page-sub" style="margin-bottom:20px">Progreso de la carrera</p>

      <div class="stats-row" style="margin-bottom:20px">
        <div class="stat-card">
          <i class="fa-solid fa-circle-check" style="color:#66bb6a"></i>
          <span class="stat-label">Aprobadas</span>
          <span class="stat-value">${totalPassed}</span>
        </div>
        <div class="stat-card">
          <i class="fa-solid fa-circle-dot" style="color:var(--accent-teal)"></i>
          <span class="stat-label">En curso</span>
          <span class="stat-value">${totalActive}</span>
        </div>
        <div class="stat-card">
          <i class="fa-solid fa-circle-xmark" style="color:#ef5350"></i>
          <span class="stat-label">Reprobadas</span>
          <span class="stat-value">${totalFailed}</span>
        </div>
        <div class="stat-card">
          <i class="fa-solid fa-circle" style="color:var(--text-dim)"></i>
          <span class="stat-label">Pendientes</span>
          <span class="stat-value">${totalPending}</span>
        </div>
      </div>

      <div class="stats-card">
        <div class="section-heading" style="margin-bottom:14px">
          <i class="fa-solid fa-bars-progress"></i> PROGRESO POR SEMESTRE
        </div>
        ${rows}
      </div>
    `);
  },
};

/* ================================================================
   SUBJECT ACTIONS — Handlers for notes/files inside subject view
================================================================ */
const SubjectActions = {

  setupUpload(semId, subId) {
    const zone     = document.getElementById("uploadZone");
    const input    = document.getElementById("fileInput");
    const btn      = document.getElementById("btnUpload");
    const progList = document.getElementById("uploadProgressList");
    if (!zone || !btn) return;

    ["dragenter","dragover"].forEach(ev =>
      zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add("dragover"); }));
    ["dragleave","drop"].forEach(ev =>
      zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.remove("dragover"); }));
    zone.addEventListener("drop", e => {
      if (e.dataTransfer.files.length) this.uploadFiles(semId, subId, e.dataTransfer.files, progList);
    });

    btn.addEventListener("click", () => {
      const files = input.files;
      if (!files.length) { toast("Selecciona al menos un archivo", "info"); return; }
      this.uploadFiles(semId, subId, files, progList);
    });
  },

  async uploadFiles(semId, subId, files, progList) {
    const category = document.getElementById("fileCategory")?.value || "General";

    for (const file of files) {
      const progDiv = document.createElement("div");
      progDiv.className = "upload-progress";
      const safeId = file.name.replace(/\W/g,'_');
      progDiv.innerHTML = `
        <div class="upload-progress-name">
          <span>${file.name}</span><span id="pPct-${safeId}">0%</span>
        </div>
        <div class="upload-progress-bar">
          <div class="upload-progress-fill" id="pBar-${safeId}" style="width:0%"></div>
        </div>`;
      progList.appendChild(progDiv);

      try {
        await DB.uploadFile(semId, subId, file, category, pct => {
          const barEl = document.getElementById(`pBar-${safeId}`);
          const pctEl = document.getElementById(`pPct-${safeId}`);
          if (barEl) barEl.style.width = pct + "%";
          if (pctEl) pctEl.textContent  = pct + "%";
        });
        progDiv.remove();
        toast(`✓ ${file.name} subido`);
      } catch(e) {
        progDiv.style.borderLeft = "3px solid #f44336";
        const errCode = e.code === "storage/unauthorized"
          ? "Permiso denegado — revisa Storage Rules"
          : e.message;
        toast(`Error: ${errCode}`, "err");
      }
    }

    const input = document.getElementById("fileInput");
    if (input) input.value = "";
    await Views.refreshFiles(semId, subId);
  },

  async editNote(noteId) {
    const note = (window._notes||[]).find(n => n.id === noteId);
    if (!note) return;
    document.getElementById("noteTitle").value   = note.title;
    document.getElementById("noteContent").value = note.content || "";
    document.getElementById("noteTag").value     = note.tag || "Clase";
    await DB.deleteNote(window._curSemId, window._curSubId, noteId);
    await Views.refreshNotes(window._curSemId, window._curSubId);
    document.getElementById("noteTitle").focus();
    document.querySelector("[data-tab='notes']").click();
    window.scrollTo({ top: 0, behavior: "smooth" });
  },

  async deleteNote(noteId) {
    if (!confirm("¿Eliminar esta nota?")) return;
    try {
      await DB.deleteNote(window._curSemId, window._curSubId, noteId);
      await Views.refreshNotes(window._curSemId, window._curSubId);
      toast("Nota eliminada");
    } catch(e) { toast("Error al eliminar", "err"); }
  },

  async deleteFile(fileId, storagePath) {
    if (!confirm("¿Eliminar este archivo?")) return;
    try {
      await DB.deleteFile(window._curSemId, window._curSubId, fileId, storagePath);
      await Views.refreshFiles(window._curSemId, window._curSubId);
      toast("Archivo eliminado");
    } catch(e) { toast("Error al eliminar", "err"); }
  }
};

/* ================================================================
   APP
================================================================ */
const App = {

  async init() {
    await new Promise(resolve => {
      const timeout = setTimeout(() => {
        // Timeout de seguridad: si Firebase no responde en 8s, ir a login
        location.href = "login.html";
      }, 8000);

      auth.onAuthStateChanged(user => {
        clearTimeout(timeout);
        if (user) {
          State.user = user;
          resolve();
        } else {
          location.href = "login.html";
        }
      });
    });

    document.documentElement.style.visibility = "visible";

    const email   = State.user.email || "";
    const initial = email.charAt(0).toUpperCase();
    const avatarEl = document.getElementById("userAvatar");
    const emailEl  = document.getElementById("userEmail");
    if (avatarEl) avatarEl.textContent = initial;
    if (emailEl)  emailEl.textContent  = email;

    this.buildSidebar();
    this.initModal();

    Router.init();
    State.route = Router.parse();
    await this.applyRoute();

    const hamBtn  = document.getElementById("hamburgerBtn");
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebarOverlay");

    if (hamBtn && sidebar && overlay) {
      hamBtn.addEventListener("click",    () => this.toggleSidebar());
      overlay.addEventListener("click",   () => this.closeSidebar());
    }

    document.getElementById("logoutBtn").addEventListener("click", async () => {
      await auth.signOut();
      location.href = "login.html";
    });
  },

  /* ---- Modal init ---- */
  initModal() {
    // Poblar select de iconos
    const iconSel = document.getElementById("modalIcon");
    if (iconSel) {
      iconSel.innerHTML = ICON_OPTIONS.map(o =>
        `<option value="${o.value}">${o.label}</option>`
      ).join("");

      // Preview en tiempo real
      iconSel.addEventListener("change", () => SemCRUD._refreshIconPreview());
    }

    // Botones del modal
    const btnSave   = document.getElementById("btnModalSave");
    const btnCancel = document.getElementById("btnModalCancel");
    const overlay   = document.getElementById("subjectModal");

    if (btnSave)   btnSave.addEventListener("click",   () => SemCRUD.save());
    if (btnCancel) btnCancel.addEventListener("click", () => SemCRUD.close());
    if (overlay)   overlay.addEventListener("click", e => {
      if (e.target === overlay) SemCRUD.close();
    });

    // Cerrar con Escape
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") SemCRUD.close();
    });
  },

  toggleSidebar() {
    State.sidebarOpen = !State.sidebarOpen;
    document.getElementById("sidebar").classList.toggle("open", State.sidebarOpen);
    document.getElementById("sidebarOverlay").classList.toggle("show", State.sidebarOpen);
    document.body.style.overflow = State.sidebarOpen ? "hidden" : "";
  },

  closeSidebar() {
    State.sidebarOpen = false;
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("sidebarOverlay").classList.remove("show");
    document.body.style.overflow = "";
  },

  buildSidebar() {
    const semItems = CURRICULUM.map(sem => `
      <button class="nav-sub-item" data-route="semester/${sem.id}" id="navSem${sem.id}">
        <i class="fa-solid ${sem.icon}"></i> ${sem.name}
      </button>`).join("");

    document.getElementById("sidebarAccordionBody").innerHTML = semItems;

    const toggle = document.getElementById("semAccordionToggle");
    const body   = document.getElementById("sidebarAccordionBody");
    toggle.addEventListener("click", () => {
      State.semAccordionOpen = !State.semAccordionOpen;
      toggle.classList.toggle("expanded", State.semAccordionOpen);
      body.classList.toggle("open", State.semAccordionOpen);
    });

    document.getElementById("sidebarNav").addEventListener("click", e => {
      const btn = e.target.closest("[data-route]");
      if (btn) {
        Router.go(btn.dataset.route);
        this.closeSidebar();
      }
    });
  },

  updateSidebarActive() {
    const { view, semId, subId } = State.route;
    const route = subId  ? `subject/${semId}/${subId}`
                : semId  ? `semester/${semId}`
                : view;

    document.querySelectorAll(".nav-item,.nav-sub-item").forEach(el => {
      el.classList.toggle("active", el.dataset.route === route);
    });
    this.updateTopbar();
  },

  updateTopbar() {
    const { view, semId, subId } = State.route;
    const titleEl = document.getElementById("topbarTitle");
    const subEl   = document.getElementById("topbarSub");

    if (view === "dashboard") {
      titleEl.textContent = "CENTRO DE CONTROL";
      subEl.textContent   = "Portal personal — Carrera de Física";
    } else if (view === "semester" && semId) {
      const sem = getSemester(semId);
      titleEl.textContent = sem ? `${sem.name.toUpperCase()} — ${sem.subtitle.toUpperCase()}` : "Semestre";
      subEl.textContent   = sem ? `${sem.credits} créditos` : "";
    } else if (view === "subject" && semId && subId) {
      const sub = resolveSubject(semId, subId);
      titleEl.textContent = sub ? sub.name.toUpperCase() : "Materia";
      subEl.textContent   = sub ? `${sub.credits} créditos · ${sub.tag}` : "";
    } else if (view === "documents") {
      titleEl.textContent = "TODOS MIS DOCUMENTOS";
      subEl.textContent   = "Repositorio global";
    } else if (view === "stats") {
      titleEl.textContent = "ESTADÍSTICAS";
      subEl.textContent   = "Progreso de la carrera";
    }
  },

  async applyRoute() {
    const { view, semId, subId } = State.route;

    if ((view === "semester" || view === "subject") && !State.semAccordionOpen) {
      State.semAccordionOpen = true;
      document.getElementById("semAccordionToggle").classList.add("expanded");
      document.getElementById("sidebarAccordionBody").classList.add("open");
    }

    this.updateSidebarActive();

    if (view === "dashboard")                      await Views.dashboard();
    else if (view === "semester" && semId)          await Views.semester(semId);
    else if (view === "subject" && semId && subId)  await Views.subject(semId, subId);
    else if (view === "documents")                  await Views.documents();
    else if (view === "stats")                      await Views.stats();
    else                                            await Views.dashboard();
  }
};

/* ================================================================
   BOOT
================================================================ */
document.addEventListener("DOMContentLoaded", () => {
  document.documentElement.style.visibility = "hidden";
  App.init().catch(err => {
    console.error("App init error:", err);
    document.documentElement.style.visibility = "visible";
  });
});