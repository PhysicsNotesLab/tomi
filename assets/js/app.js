/**
 * FÍSICA UNAL — SPA PRINCIPAL
 * Características: CRUD materias + CRUD semestres + bottom nav + PowerPoint + átomo
 */
"use strict";

/* ================================================================ CONSTANTES */
const SHARED_UID   = "shared_admin_data";
const ADMIN_EMAILS = [
  "pgalvisg8156@universidadean.edu.co",
  "tomassantiagogalvisbarrera3@gmail.com"
];

/* FILE_ICONS, getFileIcon, formatBytes, formatDate — definidos en data.js */
/* PowerPoint agregado al FILE_ICONS de data.js (ver instrucciones) */

/* ================================================================ DB */
const DB = {

  uid() { return SHARED_UID; },

  _subRef(semId, subId) {
    return db.collection("users").doc(this.uid())
             .collection("subjects").doc(subKey(semId, subId));
  },

  /* ── Custom subjects per semester ── */
  async getSubjects(semId) {
    try {
      const snap = await db.collection("users").doc(this.uid())
                           .collection("semSubjects").doc(String(semId)).get();
      if (snap.exists && snap.data().subjects?.length) {
        return snap.data().subjects;
      }
    } catch(e) { console.warn("getSubjects fallback:", e); }
    const sem = getStaticSemester(semId);
    return sem ? JSON.parse(JSON.stringify(sem.subjects)) : [];
  },

  async saveSubjects(semId, subjects) {
    await db.collection("users").doc(this.uid())
            .collection("semSubjects").doc(String(semId))
            .set({ subjects, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
  },

  /* ── Custom semesters (XI, XII…) ── */
  async getCustomSemesters() {
    try {
      const snap = await db.collection("users").doc(this.uid())
                           .collection("customSemesters").doc("index").get();
      if (snap.exists && snap.data().semesters) return snap.data().semesters;
    } catch(e) { console.warn("getCustomSemesters:", e); }
    return [];
  },

  async saveCustomSemesters(semesters) {
    await db.collection("users").doc(this.uid())
            .collection("customSemesters").doc("index")
            .set({ semesters, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
  },

  /* ── Subject meta ── */
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
    try {
      const snap = await db.collection("users").doc(this.uid())
                           .collection("subjects").get();
      const map = {};
      snap.forEach(d => { map[d.id] = d.data(); });
      return map;
    } catch(e) {
      console.error("getAllSubjectsMeta falló:", e.code, e.message);
      throw e;
    }
  },

  /* ── Notes ── */
  async getNotes(semId, subId) {
    const snap = await this._subRef(semId, subId).collection("notes")
                           .orderBy("createdAt","desc").get();
    return snap.docs.map(d => ({ id:d.id, ...d.data() }));
  },
  async addNote(semId, subId, note) {
    await this._subRef(semId, subId).collection("notes").add({
      ...note, createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  },
  async deleteNote(semId, subId, noteId) {
    await this._subRef(semId, subId).collection("notes").doc(noteId).delete();
  },

  /* ── Files ── */
  async getFiles(semId, subId) {
    const snap = await this._subRef(semId, subId).collection("files")
                           .orderBy("uploadedAt","desc").get();
    return snap.docs.map(d => ({ id:d.id, ...d.data() }));
  },

  async getAllFiles() {
    const allDocs = [];
    try {
      const subSnap = await db.collection("users").doc(this.uid())
                              .collection("subjects").get();
      const arrays = await Promise.all(subSnap.docs.map(d =>
        d.ref.collection("files").orderBy("uploadedAt","desc").get()
          .then(fs => fs.docs.map(f => ({ id:f.id, subjectDocId:d.id, ...f.data() })))
      ));
      arrays.forEach(arr => allDocs.push(...arr));
      allDocs.sort((a,b) => (b.uploadedAt?.toMillis?.() || 0) - (a.uploadedAt?.toMillis?.() || 0));
    } catch(e) { console.warn("getAllFiles:", e); }
    return allDocs;
  },

  uploadFile(semId, subId, file, category, onProgress) {
    return new Promise((resolve, reject) => {
      const safeName = file.name.replace(/[#\[\]*?]/g, "_");
      const path = `users/${this.uid()}/${semId}/${subId}/${Date.now()}_${safeName}`;
      const task = storage.ref(path).put(file);
      task.on("state_changed",
        s => onProgress && onProgress(Math.round((s.bytesTransferred / s.totalBytes) * 100)),
        reject,
        async () => {
          const url = await task.snapshot.ref.getDownloadURL();
          const meta = {
            name: file.name, category: category||"General",
            date: new Date().toLocaleDateString("es-CO"),
            size: file.size, type: file.type, url,
            storagePath: path,
            uploadedAt: firebase.firestore.FieldValue.serverTimestamp()
          };
          await this._subRef(semId, subId).collection("files").add(meta);
          resolve(meta);
        }
      );
    });
  },

  async deleteFile(semId, subId, fileId, storagePath) {
    await this._subRef(semId, subId).collection("files").doc(fileId).delete();
    if (storagePath) try { await storage.ref(storagePath).delete(); } catch(e) {}
  }
};

/* ================================================================ STATE */
const State = {
  user:             null,
  route:            { view:"dashboard", semId:null, subId:null },
  subjectsMeta:     {},
  sidebarOpen:      false,
  semAccordionOpen: false,
};

window._semSubjects    = {};   // cache materias por semestre
window._customSemesters = [];  // semestres personalizados cargados desde Firestore

/* ================================================================ HELPERS */

/** Semestre estático de data.js */
function getStaticSemester(id) { return CURRICULUM.find(s => s.id === id); }

/** Todos los semestres: estáticos + personalizados */
function getAllSemesters() { return [...CURRICULUM, ...window._customSemesters]; }

/** Buscar semestre en ambas listas */
function getAnySemester(id) { return getAllSemesters().find(s => s.id === id); }

/** Buscar materia en cache o en data.js */
function resolveSubject(semId, subId) {
  if (window._semSubjects?.[semId])
    return window._semSubjects[semId].find(s => s.id === subId) || null;
  return getSubject(semId, subId);
}

/* ================================================================ ROUTER */
const Router = {
  parse(hash) {
    const h = (hash || location.hash).replace("#","");
    const p = h.split("/");
    return { view: p[0]||"dashboard", semId: p[1] ? parseInt(p[1]) : null, subId: p[2]||null };
  },
  go(path) { location.hash = path; },
  init() {
    window.addEventListener("hashchange", () => { State.route = this.parse(); App.applyRoute(); });
  }
};

/* ================================================================ TOAST */
function toast(msg, type="ok") {
  const icons = { ok:"fa-check-circle", err:"fa-circle-xmark", info:"fa-circle-info" };
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.innerHTML = `<i class="fa-solid ${icons[type]||icons.info}"></i><span>${msg}</span>`;
  document.getElementById("toastContainer").appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

/* ================================================================ VIEW HELPERS */
function setContent(html) { document.getElementById("appContent").innerHTML = html; }
function loading() { return `<div class="loading-wrap"><div class="spinner"></div></div>`; }
function emptyState(icon,title,sub) {
  return `<div class="empty-state"><i class="fa-solid ${icon}"></i><h3>${title}</h3><p>${sub}</p></div>`;
}
function fileItemHTML(f) {
  const ft = getFileIcon(f.type||"");
  return `
    <div class="file-item">
      <div class="file-icon-wrap"><i class="fa-solid ${ft.icon}" style="color:${ft.color}"></i></div>
      <div class="file-info">
        <div class="file-name">${f.name}</div>
        <div class="file-meta">${f.category||""} · ${formatBytes(f.size)} · ${formatDate(f.uploadedAt)}</div>
      </div>
      <div class="file-actions">
        ${f.url?`<button class="btn-icon" onclick="window.open('${f.url}','_blank')" title="Abrir">
          <i class="fa-solid fa-arrow-up-right-from-square"></i></button>`:""}
        <button class="btn-icon danger" data-del-file="${f.id}"
          data-sem="${f._semId||''}" data-sub="${f._subId||''}"
          data-path="${f.storagePath||''}" title="Eliminar">
          <i class="fa-solid fa-trash"></i></button>
      </div>
    </div>`;
}

/* ================================================================ ICON OPTIONS */
const ICON_OPTIONS = [
  { value:"fa-atom",                  label:"⚛ Átomo"              },
  { value:"fa-flask",                 label:"🧪 Frasco / Lab"       },
  { value:"fa-flask-vial",            label:"🧫 Vial Lab"           },
  { value:"fa-wave-square",           label:"〰 Ondas"              },
  { value:"fa-bolt",                  label:"⚡ Electricidad"       },
  { value:"fa-magnet",                label:"🧲 Magnetismo"         },
  { value:"fa-infinity",              label:"∞ Integral"            },
  { value:"fa-square-root-variable",  label:"√ Ecuaciones"         },
  { value:"fa-superscript",           label:"Xⁿ Matemáticas"       },
  { value:"fa-gears",                 label:"⚙ Mecánica"            },
  { value:"fa-temperature-high",      label:"🌡 Termodinámica"      },
  { value:"fa-chart-line",            label:"📈 Estadística"        },
  { value:"fa-chart-bar",             label:"📊 Est. básica"        },
  { value:"fa-code",                  label:"💻 Programación"       },
  { value:"fa-laptop-code",           label:"🖥 Comp. Tools"        },
  { value:"fa-microchip",             label:"🔌 Electrónica"        },
  { value:"fa-eye",                   label:"👁 Óptica"             },
  { value:"fa-lightbulb",             label:"💡 Fluidos/Óptica"    },
  { value:"fa-clock",                 label:"⏱ Relatividad"        },
  { value:"fa-shuffle",               label:"🔀 Cuántica"           },
  { value:"fa-burst",                 label:"💥 Partículas"         },
  { value:"fa-cube",                  label:"🧊 Estado Sólido"      },
  { value:"fa-star",                  label:"⭐ Cosmología"         },
  { value:"fa-microscope",            label:"🔬 Investigación"      },
  { value:"fa-scroll",                label:"📜 Tesis"              },
  { value:"fa-circle-plus",           label:"➕ Electiva"           },
  { value:"fa-ruler-combined",        label:"📐 Mediciones"         },
  { value:"fa-arrows-spin",           label:"🔄 Cálculo Vectorial"  },
  { value:"fa-brain",                 label:"🧠 Taller"             },
  { value:"fa-book-open",             label:"📖 Humanidades"        },
  { value:"fa-language",              label:"🌐 Idiomas"            },
  { value:"fa-apple-whole",           label:"🍎 Newtoniana"         },
  { value:"fa-newspaper",             label:"📰 Seminario"          },
  { value:"fa-layer-group",           label:"🗂 General"            },
  { value:"fa-satellite-dish",        label:"📡 Control"            },
  { value:"fa-rocket",                label:"🚀 Aplicaciones"       },
];

/* ================================================================ SemCRUD — CRUD de materias dentro de un semestre */
const SemCRUD = {
  _semId: null, _editId: null,

  openAdd(semId) {
    this._semId = semId; this._editId = null;
    document.getElementById("modalTitle").textContent = "Agregar materia";
    document.getElementById("modalName").value        = "";
    document.getElementById("modalDesc").value        = "";
    document.getElementById("modalCredits").value     = "3";
    document.getElementById("modalIcon").value        = "fa-atom";
    document.getElementById("modalTag").value         = "Teoría";
    this._refreshIconPreview();
    document.getElementById("subjectModal").classList.add("open");
    setTimeout(() => document.getElementById("modalName").focus(), 120);
  },

  async openEdit(semId, subId, e) {
    e && e.stopPropagation();
    this._semId = semId; this._editId = subId;
    const subjects = window._semSubjects[semId] || await DB.getSubjects(semId);
    const sub = subjects.find(s => s.id === subId);
    if (!sub) return;
    document.getElementById("modalTitle").textContent = "Editar materia";
    document.getElementById("modalName").value        = sub.name;
    document.getElementById("modalDesc").value        = sub.description || "";
    document.getElementById("modalCredits").value     = sub.credits;
    document.getElementById("modalIcon").value        = sub.icon || "fa-atom";
    document.getElementById("modalTag").value         = sub.tag  || "Teoría";
    this._refreshIconPreview();
    document.getElementById("subjectModal").classList.add("open");
    setTimeout(() => document.getElementById("modalName").focus(), 120);
  },

  close() { document.getElementById("subjectModal").classList.remove("open"); },

  _refreshIconPreview() {
    document.getElementById("modalIconPreview").className =
      `fa-solid ${document.getElementById("modalIcon").value}`;
  },

  async save() {
    const name    = document.getElementById("modalName").value.trim();
    const desc    = document.getElementById("modalDesc").value.trim();
    const credits = parseInt(document.getElementById("modalCredits").value) || 3;
    const icon    = document.getElementById("modalIcon").value;
    const tag     = document.getElementById("modalTag").value;
    if (!name) { toast("El nombre es obligatorio", "info"); return; }

    const semId = this._semId;
    const btn   = document.getElementById("btnModalSave");
    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando…';

    try {
      const subjects = await DB.getSubjects(semId);
      if (this._editId) {
        const idx = subjects.findIndex(s => s.id === this._editId);
        if (idx !== -1) subjects[idx] = { ...subjects[idx], name, description:desc, credits, icon, tag };
      } else {
        subjects.push({ id:`s${semId}_c${Date.now()}`, name, description:desc, credits, icon, tag });
      }
      await DB.saveSubjects(semId, subjects);
      window._semSubjects[semId] = subjects;
      this.close();
      toast(this._editId ? "Materia actualizada ✓" : "Materia agregada ✓");
      await Views.semester(semId);
    } catch(err) { toast("Error: " + err.message, "err"); }
    btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar';
  },

  async deleteSub(semId, subId, e) {
    e && e.stopPropagation();
    if (!confirm("¿Eliminar esta materia?\nLas notas y archivos en Firestore no se borran, pero dejarán de aparecer.")) return;
    try {
      const subjects = await DB.getSubjects(semId);
      await DB.saveSubjects(semId, subjects.filter(s => s.id !== subId));
      window._semSubjects[semId] = subjects.filter(s => s.id !== subId);
      toast("Materia eliminada");
      await Views.semester(semId);
    } catch(err) { toast("Error: " + err.message, "err"); }
  }
};

/* ================================================================ SemesterCRUD — CRUD de semestres completos */
const SemesterCRUD = {
  _editId: null,

  openAdd() {
    this._editId = null;
    document.getElementById("semModalTitle").textContent = "Nuevo Semestre";
    document.getElementById("semModalName").value        = "";
    document.getElementById("semModalSubtitle").value    = "";
    document.getElementById("semModalIcon").value        = "fa-star";
    document.getElementById("semModalDeleteWrap").style.display = "none";
    this._refreshIconPreview();
    document.getElementById("semesterModal").classList.add("open");
    setTimeout(() => document.getElementById("semModalName").focus(), 120);
  },

  openEdit(semId, e) {
    e && e.stopPropagation();
    const sem = window._customSemesters.find(s => s.id === semId);
    if (!sem) return;
    this._editId = semId;
    document.getElementById("semModalTitle").textContent = "Editar Semestre";
    document.getElementById("semModalName").value        = sem.name;
    document.getElementById("semModalSubtitle").value    = sem.subtitle || "";
    document.getElementById("semModalIcon").value        = sem.icon || "fa-star";
    document.getElementById("semModalDeleteWrap").style.display = "block";
    this._refreshIconPreview();
    document.getElementById("semesterModal").classList.add("open");
  },

  close() { document.getElementById("semesterModal").classList.remove("open"); },

  _refreshIconPreview() {
    document.getElementById("semModalIconPreview").className =
      `fa-solid ${document.getElementById("semModalIcon").value}`;
  },

  async save() {
    const name     = document.getElementById("semModalName").value.trim();
    const subtitle = document.getElementById("semModalSubtitle").value.trim();
    const icon     = document.getElementById("semModalIcon").value;
    if (!name) { toast("El nombre es obligatorio", "info"); return; }

    const btn = document.getElementById("btnSemModalSave");
    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando…';

    try {
      const list = [...window._customSemesters];
      if (this._editId) {
        const idx = list.findIndex(s => s.id === this._editId);
        if (idx !== -1) list[idx] = { ...list[idx], name, subtitle, icon };
      } else {
        // Next ID after max
        const allIds = getAllSemesters().map(s => s.id);
        const nextId = Math.max(...allIds, 10) + 1;
        list.push({ id: nextId, name, subtitle, icon, credits: 0, subjects: [] });
      }
      await DB.saveCustomSemesters(list);
      window._customSemesters = list;
      App.buildSidebar();
      this.close();
      toast(this._editId ? "Semestre actualizado ✓" : "Semestre creado ✓");
      if (!this._editId) {
        const newSem = list[list.length - 1];
        Router.go(`semester/${newSem.id}`);
      } else {
        await Views.semester(this._editId);
      }
    } catch(err) { toast("Error: " + err.message, "err"); }
    btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar';
  },

  async deleteSem(semId) {
    if (!confirm("¿Eliminar este semestre?\nSus notas y archivos en Firestore no se borran, pero el semestre desaparecerá de la lista.")) return;
    try {
      const list = window._customSemesters.filter(s => s.id !== semId);
      await DB.saveCustomSemesters(list);
      window._customSemesters = list;
      App.buildSidebar();
      this.close();
      toast("Semestre eliminado");
      Router.go("dashboard");
    } catch(err) { toast("Error: " + err.message, "err"); }
  }
};

/* ================================================================ VIEWS */
const Views = {

  /* ─── DASHBOARD ─── */
  async dashboard() {
    setContent(loading());
    const meta = await DB.getAllSubjectsMeta();
    State.subjectsMeta = meta;

    // Cargar materias reales de todos los semestres (en paralelo, con caché)
    await Promise.all(getAllSemesters().map(async sem => {
      if (!window._semSubjects[sem.id]) {
        window._semSubjects[sem.id] = await DB.getSubjects(sem.id);
      }
    }));

    let passedCr=0, passedCount=0, activeCount=0, totalSubs=0, dynamicTotal=0;
    getAllSemesters().forEach(sem => {
      const subs = window._semSubjects[sem.id] || sem.subjects || [];
      subs.forEach(sub => {
        totalSubs++;
        dynamicTotal += (sub.credits || 0);
        const st = meta[subKey(sem.id, sub.id)]?.status || "pending";
        if (st==="passed") { passedCr += sub.credits; passedCount++; }
        if (st==="active") activeCount++;
      });
    });
    const pct = dynamicTotal > 0 ? Math.round((passedCr / dynamicTotal) * 100) : 0;

    let recentHtml = "";
    try {
      const allFiles = await DB.getAllFiles();
      recentHtml = allFiles.length === 0
        ? emptyState("folder-open","Sin documentos","Sube tus primeros archivos")
        : allFiles.slice(0,6).map(f => fileItemHTML(f)).join("");
    } catch(e) { recentHtml = emptyState("folder-open","Sin documentos",""); }

    const semGrid = getAllSemesters().map(sem => {
      const subs   = window._semSubjects[sem.id] || sem.subjects || [];
      const total  = subs.length;
      const passed = subs.filter(s => meta[subKey(sem.id,s.id)]?.status==="passed").length;
      const pctSem = total ? Math.round((passed/total)*100) : 0;
      const isCustom = !CURRICULUM.find(c => c.id === sem.id);
      return `
        <div class="semester-card" onclick="Router.go('semester/${sem.id}')">
          ${isCustom ? `<button class="sem-edit-btn" onclick="SemesterCRUD.openEdit(${sem.id},event)" title="Editar semestre">
            <i class="fa-solid fa-pen"></i></button>` : ""}
          <i class="fa-solid ${sem.icon}"></i>
          <h3>${sem.name}</h3><p>${sem.subtitle}</p>
          <span class="sem-cr-badge">${subs.reduce((a,s)=>a+(s.credits||0),0)} cr</span>
          <div class="sem-mini-bar"><div class="sem-mini-fill" style="width:${pctSem}%"></div></div>
        </div>`;
    }).join("");

    setContent(`
      <div class="page-title" style="margin-bottom:4px">CENTRO DE CONTROL</div>
      <p class="page-sub" style="margin-bottom:20px">Carrera de Física — Universidad Nacional de Colombia</p>
      <div class="stats-row">
        <div class="stat-card"><i class="fa-solid fa-graduation-cap"></i>
          <span class="stat-label">Créditos aprobados</span>
          <span class="stat-value">${passedCr}</span>
          <span class="stat-sub">de ${dynamicTotal} totales</span></div>
        <div class="stat-card"><i class="fa-solid fa-circle-check"></i>
          <span class="stat-label">Materias aprobadas</span>
          <span class="stat-value">${passedCount}</span>
          <span class="stat-sub">de ${totalSubs} materias</span></div>
        <div class="stat-card"><i class="fa-solid fa-circle-dot" style="color:var(--accent-teal)"></i>
          <span class="stat-label">En curso</span>
          <span class="stat-value">${activeCount}</span>
          <span class="stat-sub">actualmente</span></div>
        <div class="stat-card"><i class="fa-solid fa-layer-group" style="color:var(--accent-yellow)"></i>
          <span class="stat-label">Semestres</span>
          <span class="stat-value">${getAllSemesters().length}</span>
          <span class="stat-sub">en total</span></div>
      </div>
      <div class="progress-section">
        <div class="progress-header"><span>PROGRESO DE LA CARRERA</span><strong>${pct}%</strong></div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      </div>
      <div class="section-heading" style="margin-bottom:14px">
        <i class="fa-solid fa-layer-group"></i> SEMESTRES
      </div>
      <div class="semester-grid" style="margin-bottom:0">${semGrid}</div>
      <div class="recent-box">
        <div class="recent-box-head"><i class="fa-solid fa-clock-rotate-left"></i> DOCUMENTOS RECIENTES</div>
        <div class="files-list" style="border:none;border-radius:0">${recentHtml}</div>
      </div>
    `);
  },

  /* ─── SEMESTER ─── */
  async semester(semId) {
    setContent(loading());
    const sem = getAnySemester(semId);
    if (!sem) { setContent(`<p style="padding:20px">Semestre no encontrado</p>`); return; }
    if (!Object.keys(State.subjectsMeta).length) State.subjectsMeta = await DB.getAllSubjectsMeta();

    const subjects = await DB.getSubjects(semId);
    window._semSubjects[semId] = subjects;

    const cards = subjects.map(sub => {
      const k   = subKey(semId, sub.id);
      const st  = State.subjectsMeta[k]?.status || "pending";
      const cfg = SUBJECT_STATUS[st];
      return `
        <div class="subject-card">
          <div class="card-actions">
            <button class="card-btn" onclick="SemCRUD.openEdit(${semId},'${sub.id}',event)" title="Editar">
              <i class="fa-solid fa-pen"></i></button>
            <button class="card-btn card-delete" onclick="SemCRUD.deleteSub(${semId},'${sub.id}',event)" title="Eliminar">
              <i class="fa-solid fa-trash"></i></button>
          </div>
          <div class="sub-click" onclick="Router.go('subject/${semId}/${sub.id}')">
            <div class="sub-icon"><i class="fa-solid ${sub.icon||'fa-atom'}"></i></div>
            <div class="sub-body">
              <h3>${sub.name}</h3>
              ${sub.description?`<p class="sub-desc">${sub.description}</p>`:""}
              <div class="sub-meta">
                <span class="sub-tag">${sub.tag||"General"}</span>
                <span class="sub-cr">${sub.credits} cr</span>
                <span class="status-badge ${cfg.cls}">
                  <i class="fa-solid ${cfg.icon}"></i>${cfg.label}
                </span>
              </div>
            </div>
          </div>
        </div>`;
    }).join("");

    const isCustom   = !CURRICULUM.find(c => c.id === semId);
    const totalCr    = subjects.reduce((s,sub) => s+sub.credits, 0);
    const editSemBtn = isCustom
      ? `<button class="btn-edit-sem" onclick="SemesterCRUD.openEdit(${semId},event)">
           <i class="fa-solid fa-pen"></i> Editar semestre
         </button>` : "";

    // Progress stats for this semester
    const meta = Object.keys(State.subjectsMeta).length
      ? State.subjectsMeta
      : await DB.getAllSubjectsMeta();
    State.subjectsMeta = meta;

    const passedSubs  = subjects.filter(s => meta[subKey(semId,s.id)]?.status === "passed");
    const activeSubs  = subjects.filter(s => meta[subKey(semId,s.id)]?.status === "active");
    const failedSubs  = subjects.filter(s => meta[subKey(semId,s.id)]?.status === "failed");
    const passedCrSem = passedSubs.reduce((a,s) => a+s.credits, 0);
    const pctSem      = totalCr > 0 ? Math.round((passedCrSem/totalCr)*100) : 0;
    const pctActive   = totalCr > 0 ? Math.round((activeSubs.reduce((a,s)=>a+s.credits,0)/totalCr)*100) : 0;

    setContent(`
      <button class="btn-back" onclick="Router.go('dashboard')">
        <i class="fa-solid fa-arrow-left"></i> Centro de Control
      </button>
      <div class="page-title" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        ${sem.name.toUpperCase()} — ${sem.subtitle?.toUpperCase()||""}
        ${editSemBtn}
      </div>
      <p class="page-sub" style="margin-bottom:16px">
        ${totalCr} créditos · ${subjects.length} materias
        <span style="color:var(--text-dim);font-size:11px;margin-left:8px">(✏️ editar · + agregar)</span>
      </p>

      <!-- Barra de progreso del semestre -->
      <div class="sem-progress-box">
        <div class="sem-progress-header">
          <div class="sem-progress-stats">
            <span class="sem-stat-item">
              <i class="fa-solid fa-circle-check" style="color:#66bb6a"></i>
              <strong>${passedSubs.length}</strong> aprobadas
              <span class="sem-cr-hint">(${passedCrSem} cr)</span>
            </span>
            <span class="sem-stat-item">
              <i class="fa-solid fa-circle-dot" style="color:var(--accent-teal)"></i>
              <strong>${activeSubs.length}</strong> en curso
            </span>
            <span class="sem-stat-item">
              <i class="fa-solid fa-circle-xmark" style="color:#ef5350"></i>
              <strong>${failedSubs.length}</strong> reprobadas
            </span>
            <span class="sem-stat-item">
              <i class="fa-solid fa-circle" style="color:var(--text-dim)"></i>
              <strong>${subjects.length - passedSubs.length - activeSubs.length - failedSubs.length}</strong> pendientes
            </span>
          </div>
          <span class="sem-pct-label">${pctSem}%</span>
        </div>
        <div class="sem-progress-track">
          <div class="sem-progress-fill sem-fill-passed"  style="width:${pctSem}%"></div>
          <div class="sem-progress-fill sem-fill-active"  style="width:${pctActive}%;left:${pctSem}%"></div>
        </div>
        <div class="sem-progress-legend">
          <span><span class="leg-dot" style="background:#66bb6a"></span>Aprobadas</span>
          <span><span class="leg-dot" style="background:var(--accent-teal)"></span>En curso</span>
          <span><span class="leg-dot" style="background:var(--border-2)"></span>Pendientes</span>
        </div>
      </div>

      <div class="subjects-grid">
        ${cards}
        <div class="subject-card add-card" onclick="SemCRUD.openAdd(${semId})">
          <i class="fa-solid fa-circle-plus"></i>
          <h3>Agregar materia</h3><span>Nueva asignatura</span>
        </div>
      </div>
    `);
  },

  /* ─── SUBJECT DETAIL ─── */
  async subject(semId, subId) {
    setContent(loading());
    const sem = getAnySemester(semId);
    if (!sem) { setContent(`<p style="padding:20px">Semestre no encontrado</p>`); return; }
    if (!window._semSubjects[semId]) window._semSubjects[semId] = await DB.getSubjects(semId);
    const sub = resolveSubject(semId, subId);
    if (!sub) { setContent(`<p style="padding:20px">Materia no encontrada</p>`); return; }

    const meta  = await DB.getSubjectMeta(semId, subId);
    const notes = await DB.getNotes(semId, subId);
    const files = await DB.getFiles(semId, subId);
    const status   = meta.status    || "pending";
    const grade    = meta.grade     || "";
    const profName = meta.professor || "";
    const period   = meta.period    || "";

    const statusOpts = Object.entries(SUBJECT_STATUS).map(([k,v]) =>
      `<option value="${k}" ${status===k?"selected":""}>${v.label}</option>`).join("");

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
      ? emptyState("folder-open","Sin archivos","Sube documentos, PDFs, PPT, imágenes o archivos Excel")
      : `<div class="files-list">${files.map(f => {
          const ft = getFileIcon(f.type||"");
          return `
            <div class="file-item">
              <div class="file-icon-wrap"><i class="fa-solid ${ft.icon}" style="color:${ft.color}"></i></div>
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
      <div class="subject-hero">
        <div class="hero-icon"><i class="fa-solid ${sub.icon||'fa-atom'}"></i></div>
        <div class="hero-info">
          <h2>${sub.name}</h2>
          ${sub.description?`<p style="color:var(--text-muted);font-size:13px;margin-bottom:6px">${sub.description}</p>`:""}
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <span class="sub-cr">${sub.credits} créditos</span>
            <span class="sub-tag">${sub.tag||"General"}</span>
            <span class="status-badge ${SUBJECT_STATUS[status].cls}">
              <i class="fa-solid ${SUBJECT_STATUS[status].icon}"></i>${SUBJECT_STATUS[status].label}
            </span>
          </div>
          <div class="hero-controls">
            <div class="ctrl-group"><span class="ctrl-label">Estado</span>
              <select class="ctrl-select" id="subStatus">${statusOpts}</select></div>
            <div class="ctrl-group"><span class="ctrl-label">Nota final</span>
              <input type="number" class="ctrl-input" id="subGrade"
                value="${grade}" min="0" max="5" step="0.1" placeholder="0.0–5.0"></div>
            <div class="ctrl-group"><span class="ctrl-label">Profesor</span>
              <input type="text" class="ctrl-text" id="subProf"
                value="${profName}" placeholder="Por asignar"></div>
            <div class="ctrl-group"><span class="ctrl-label">Periodo</span>
              <input type="text" class="ctrl-text" id="subPeriod"
                value="${period}" placeholder="2025-1"></div>
            <button class="btn-primary" id="btnSaveMeta" style="align-self:flex-end">
              <i class="fa-solid fa-floppy-disk"></i> Guardar</button>
          </div>
        </div>
      </div>
      <div class="tabs">
        <button class="tab-btn active" data-tab="notes">
          <i class="fa-solid fa-book"></i> Notas (${notes.length})</button>
        <button class="tab-btn" data-tab="files">
          <i class="fa-solid fa-folder"></i> Archivos (${files.length})</button>
        <button class="tab-btn" data-tab="pomodoro">
          <i class="fa-solid fa-stopwatch"></i> Pomodoro</button>
      </div>
      <div class="tab-panel active" id="tab-notes">
        <div class="notes-form">
          <div class="section-heading" style="margin-bottom:12px">
            <i class="fa-solid fa-pen-nib"></i> NUEVA NOTA</div>
          <div class="form-row">
            <input type="text" class="form-input" id="noteTitle" placeholder="Título de la nota">
            <select class="form-select" id="noteTag">
              <option>Clase</option><option>Parcial</option>
              <option>Taller</option><option>Proyecto</option>
              <option>Laboratorio</option><option>Observación</option>
            </select>
          </div>
          <textarea class="form-textarea" id="noteContent" placeholder="Contenido de la nota..."></textarea>
          <div style="margin-top:10px;text-align:right">
            <button class="btn-primary" id="btnSaveNote">
              <i class="fa-solid fa-floppy-disk"></i> Guardar nota</button>
          </div>
        </div>
        <div class="notes-grid" id="notesList">${notesHTML}</div>
      </div>
      <div class="tab-panel" id="tab-files">
        <div class="upload-zone" id="uploadZone">
          <i class="fa-solid fa-cloud-arrow-up"></i>
          <p>Arrastra archivos aquí o haz clic para seleccionar</p>
          <small>PDF · Word · Excel · PowerPoint · Imágenes · Texto</small>
          <input type="file" id="fileInput" multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.webp,.gif,.bmp">
        </div>
        <div class="upload-controls">
          <select class="form-select" id="fileCategory" style="min-width:140px">
            <option>Clase</option><option>Laboratorio</option>
            <option>Parcial</option><option>Taller</option>
            <option>Proyecto</option><option>Apunte</option><option>Otro</option>
          </select>
          <button class="btn-primary" id="btnUpload">
            <i class="fa-solid fa-cloud-arrow-up"></i> Subir seleccionados</button>
        </div>
        <div id="uploadProgressList"></div>
        <div id="filesList">${filesHTML}</div>
      </div>

      <!-- TAB: POMODORO -->
      <div class="tab-panel" id="tab-pomodoro">
        <div class="pomo-wrap" id="pomoWrap">
          <!-- rendered by Pomodoro.render() after DOM ready -->
        </div>
      </div>
    `);

    window._curSemId = semId; window._curSubId = subId;
    window._notes = notes;    window._files    = files;

    document.querySelectorAll(".tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
        btn.classList.add("active");
        const panel = document.getElementById(`tab-${btn.dataset.tab}`);
        if (panel) panel.classList.add("active");
        if (btn.dataset.tab === "pomodoro") Pomodoro.init(semId, subId);
      });
    });

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
        document.querySelector(".status-badge").innerHTML = `<i class="fa-solid ${cfg.icon}"></i>${cfg.label}`;
        App.updateSidebarActive();
        toast("Datos guardados");
      } catch(e) { toast("Error: " + e.message, "err"); }
      btn.disabled = false;
    });

    document.getElementById("btnSaveNote").addEventListener("click", async () => {
      const title = document.getElementById("noteTitle").value.trim();
      if (!title) { toast("El título es obligatorio","info"); return; }
      const btn = document.getElementById("btnSaveNote"); btn.disabled = true;
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
    document.getElementById("notesList").innerHTML = notes.length === 0
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
    document.querySelector("[data-tab='notes']").innerHTML =
      `<i class="fa-solid fa-book"></i> Notas (${notes.length})`;
  },

  async refreshFiles(semId, subId) {
    const files = await DB.getFiles(semId, subId);
    window._files = files;
    document.getElementById("filesList").innerHTML = files.length === 0
      ? emptyState("folder-open","Sin archivos","Sube documentos, PDFs, PPT, imágenes o archivos Excel")
      : `<div class="files-list">${files.map(f => {
          const ft = getFileIcon(f.type||"");
          return `
            <div class="file-item">
              <div class="file-icon-wrap"><i class="fa-solid ${ft.icon}" style="color:${ft.color}"></i></div>
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
    document.querySelector("[data-tab='files']").innerHTML =
      `<i class="fa-solid fa-folder"></i> Archivos (${files.length})`;
  },

  /* ─── ALL DOCUMENTS ─── */
  async documents() {
    setContent(loading());
    const allFiles = await DB.getAllFiles();
    const subjectNames = {};
    getAllSemesters().forEach(sem => {
      (window._semSubjects[sem.id] || sem.subjects || []).forEach(sub => {
        const k = subKey(sem.id, sub.id);
        subjectNames[k] = `${sem.name} · ${sub.name}`;
      });
    });
    const semOptions = getAllSemesters().map(s => `<option value="${s.id}">${s.name}</option>`).join("");
    const listHTML = (files) => files.length === 0
      ? emptyState("folder-open","Sin documentos","Sube archivos desde cada materia")
      : `<div class="files-list">${files.map(f => {
          const ft    = getFileIcon(f.type||"");
          const label = subjectNames[f.subjectDocId] || f.subjectDocId || "—";
          return `
            <div class="file-item">
              <div class="file-icon-wrap"><i class="fa-solid ${ft.icon}" style="color:${ft.color}"></i></div>
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
          <option value="">Todos los semestres</option>${semOptions}
        </select>
        <select class="filter-select" id="docsTypeFilter">
          <option value="">Todos los tipos</option>
          <option value="pdf">PDF</option><option value="word">Word</option>
          <option value="excel">Excel</option><option value="ppt">PowerPoint</option>
          <option value="image">Imágenes</option><option value="text">Texto</option>
        </select>
      </div>
      <div id="docsList">${listHTML(allFiles)}</div>
    `);

    const applyFilters = () => {
      const q    = document.getElementById("docsSearch").value.toLowerCase();
      const sem  = document.getElementById("docsSemFilter").value;
      const type = document.getElementById("docsTypeFilter").value;
      document.getElementById("docsList").innerHTML = listHTML(
        allFiles.filter(f => {
          const nameOk = !q    || f.name.toLowerCase().includes(q);
          const semOk  = !sem  || (f.subjectDocId||"").startsWith(sem+"_");
          const typeOk = !type || Views._matchType(f.type||"", type);
          return nameOk && semOk && typeOk;
        })
      );
    };
    ["docsSearch","docsSemFilter","docsTypeFilter"].forEach(id =>
      document.getElementById(id).addEventListener("input", applyFilters));
  },

  _matchType(mime, filter) {
    const map = {
      pdf:   m => m.includes("pdf"),
      word:  m => m.includes("word") || m.includes("msword"),
      excel: m => m.includes("sheet") || m.includes("excel"),
      ppt:   m => m.includes("presentation") || m.includes("powerpoint"),
      image: m => m.startsWith("image/"),
      text:  m => m.includes("text"),
    };
    return map[filter] ? map[filter](mime) : true;
  },

  /* ─── STATS ─── */
  async stats() {
    setContent(loading());
    const meta = await DB.getAllSubjectsMeta();
    State.subjectsMeta = meta;

    // Cargar materias reales (con caché)
    await Promise.all(getAllSemesters().map(async sem => {
      if (!window._semSubjects[sem.id]) {
        window._semSubjects[sem.id] = await DB.getSubjects(sem.id);
      }
    }));

    let totalPassed=0, totalActive=0, totalPending=0, totalFailed=0;
    const rows = getAllSemesters().map(sem => {
      const subs    = window._semSubjects[sem.id] || sem.subjects || [];
      const total   = subs.length;
      const passed  = subs.filter(s => meta[subKey(sem.id,s.id)]?.status==="passed").length;
      const pctSem  = total ? Math.round((passed/total)*100) : 0;
      const passedCr= subs.filter(s => meta[subKey(sem.id,s.id)]?.status==="passed")
                         .reduce((a,s) => a+s.credits, 0);
      const totalCr = subs.reduce((a,s)=>a+s.credits,0);
      subs.forEach(sub => {
        const st = meta[subKey(sem.id,sub.id)]?.status || "pending";
        if(st==="passed")  totalPassed++;
        else if(st==="active") totalActive++;
        else if(st==="failed") totalFailed++;
        else totalPending++;
      });
      return `
        <div class="stats-bar-item">
          <div class="stats-bar-label">
            <span>${sem.name} — ${sem.subtitle||""}</span>
            <span>${passedCr}/${totalCr} cr · ${passed}/${total} materias</span>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${pctSem}%"></div></div>
        </div>`;
    }).join("");

    setContent(`
      <div class="page-title" style="margin-bottom:4px">ESTADÍSTICAS</div>
      <p class="page-sub" style="margin-bottom:20px">Progreso de la carrera</p>
      <div class="stats-row" style="margin-bottom:20px">
        <div class="stat-card"><i class="fa-solid fa-circle-check" style="color:#66bb6a"></i>
          <span class="stat-label">Aprobadas</span><span class="stat-value">${totalPassed}</span></div>
        <div class="stat-card"><i class="fa-solid fa-circle-dot" style="color:var(--accent-teal)"></i>
          <span class="stat-label">En curso</span><span class="stat-value">${totalActive}</span></div>
        <div class="stat-card"><i class="fa-solid fa-circle-xmark" style="color:#ef5350"></i>
          <span class="stat-label">Reprobadas</span><span class="stat-value">${totalFailed}</span></div>
        <div class="stat-card"><i class="fa-solid fa-circle" style="color:var(--text-dim)"></i>
          <span class="stat-label">Pendientes</span><span class="stat-value">${totalPending}</span></div>
      </div>
      <div class="stats-card">
        <div class="section-heading" style="margin-bottom:14px">
          <i class="fa-solid fa-bars-progress"></i> PROGRESO POR SEMESTRE
        </div>${rows}
      </div>
    `);
  },
};

/* ================================================================ SUBJECT ACTIONS */
const SubjectActions = {

  setupUpload(semId, subId) {
    const zone  = document.getElementById("uploadZone");
    const input = document.getElementById("fileInput");
    const btn   = document.getElementById("btnUpload");
    const prog  = document.getElementById("uploadProgressList");
    if (!zone || !btn) return;
    ["dragenter","dragover"].forEach(ev =>
      zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add("dragover"); }));
    ["dragleave","drop"].forEach(ev =>
      zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.remove("dragover"); }));
    zone.addEventListener("drop", e => {
      if (e.dataTransfer.files.length) this.uploadFiles(semId, subId, e.dataTransfer.files, prog);
    });
    btn.addEventListener("click", () => {
      if (!input.files.length) { toast("Selecciona al menos un archivo","info"); return; }
      this.uploadFiles(semId, subId, input.files, prog);
    });
  },

  async uploadFiles(semId, subId, files, progList) {
    const category = document.getElementById("fileCategory")?.value || "General";
    for (const file of files) {
      const safeId  = file.name.replace(/\W/g,"_");
      const progDiv = document.createElement("div");
      progDiv.className = "upload-progress";
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
          if (pctEl) pctEl.textContent = pct + "%";
        });
        progDiv.remove();
        toast(`✓ ${file.name} subido`);
      } catch(e) {
        progDiv.style.borderLeft = "3px solid #f44336";
        toast(`Error: ${e.code==="storage/unauthorized"?"Permiso denegado":e.message}`, "err");
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
    window.scrollTo({ top:0, behavior:"smooth" });
  },

  async deleteNote(noteId) {
    if (!confirm("¿Eliminar esta nota?")) return;
    try {
      await DB.deleteNote(window._curSemId, window._curSubId, noteId);
      await Views.refreshNotes(window._curSemId, window._curSubId);
      toast("Nota eliminada");
    } catch(e) { toast("Error al eliminar","err"); }
  },

  async deleteFile(fileId, storagePath) {
    if (!confirm("¿Eliminar este archivo?")) return;
    try {
      await DB.deleteFile(window._curSemId, window._curSubId, fileId, storagePath);
      await Views.refreshFiles(window._curSemId, window._curSubId);
      toast("Archivo eliminado");
    } catch(e) { toast("Error al eliminar","err"); }
  }
};

/* ================================================================ APP */
const App = {

  async init() {
    await new Promise(resolve => {
      const guard = setTimeout(() => { location.href = "login.html"; }, 10000);
      auth.onAuthStateChanged(user => {
        clearTimeout(guard);
        if (user) { State.user = user; resolve(); }
        else       { location.href = "login.html"; }
      });
    });

    document.documentElement.style.visibility = "visible";

    // Load custom semesters FIRST
    window._customSemesters = await DB.getCustomSemesters();

    const email = State.user.email || "";
    document.getElementById("userAvatar").textContent = email.charAt(0).toUpperCase();
    document.getElementById("userEmail").textContent  = email;

    this.buildSidebar();
    this.initModals();
    this.initBottomNav();
    await Notif.load();

    Router.init();
    State.route = Router.parse();
    await this.applyRoute();

    const hamBtn  = document.getElementById("hamburgerBtn");
    const overlay = document.getElementById("sidebarOverlay");
    hamBtn  && hamBtn.addEventListener("click",  () => this.toggleSidebar());
    overlay && overlay.addEventListener("click", () => this.closeSidebar());

    document.getElementById("logoutBtn").addEventListener("click", async () => {
      await auth.signOut(); location.href = "login.html";
    });
  },

  /* ── Modals init ── */
  initModals() {
    // Populate icon selects
    const iconHtml = ICON_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join("");
    const modalIcon    = document.getElementById("modalIcon");
    const semModalIcon = document.getElementById("semModalIcon");
    if (modalIcon)    modalIcon.innerHTML    = iconHtml;
    if (semModalIcon) semModalIcon.innerHTML = iconHtml;

    // Subject modal
    modalIcon?.addEventListener("change", () => SemCRUD._refreshIconPreview());
    document.getElementById("btnModalSave")?.addEventListener("click",   () => SemCRUD.save());
    document.getElementById("btnModalCancel")?.addEventListener("click", () => SemCRUD.close());
    document.getElementById("subjectModal")?.addEventListener("click", e => {
      if (e.target.id === "subjectModal") SemCRUD.close();
    });

    // Semester modal
    semModalIcon?.addEventListener("change", () => SemesterCRUD._refreshIconPreview());
    document.getElementById("btnSemModalSave")?.addEventListener("click",   () => SemesterCRUD.save());
    document.getElementById("btnSemModalCancel")?.addEventListener("click", () => SemesterCRUD.close());
    document.getElementById("btnSemModalDelete")?.addEventListener("click", () => {
      SemesterCRUD.deleteSem(SemesterCRUD._editId);
    });
    document.getElementById("semesterModal")?.addEventListener("click", e => {
      if (e.target.id === "semesterModal") SemesterCRUD.close();
    });

    // New semester buttons
    document.getElementById("btnNewSemester")?.addEventListener("click", () => {
      SemesterCRUD.openAdd();
      this.closeSidebar();
    });

    // Calendar modal
    document.getElementById("calModalType")?.addEventListener("change", () => CalendarCRUD._refreshTypeColor());
    document.getElementById("btnCalModalSave")?.addEventListener("click",   () => CalendarCRUD.save());
    document.getElementById("btnCalModalCancel")?.addEventListener("click", () => CalendarCRUD.close());
    document.getElementById("calModalDeleteBtn")?.addEventListener("click", () => CalendarCRUD.deleteEv());
    document.getElementById("calendarModal")?.addEventListener("click", e => {
      if (e.target.id === "calendarModal") CalendarCRUD.close();
    });
    // Notification bell
    document.getElementById("notifBell")?.addEventListener("click", () => Notif.toggle());

    // Escape key closes any open modal
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") { SemCRUD.close(); SemesterCRUD.close(); CalendarCRUD.close(); Notif.hide(); }
    });
  },

  /* ── Bottom nav ── */
  initBottomNav() {
    const nav = document.getElementById("bottomNav");
    if (!nav) return;

    // Route buttons
    nav.querySelectorAll("[data-route]").forEach(btn => {
      btn.addEventListener("click", () => {
        Router.go(btn.dataset.route);
        this.closeSidebar();
      });
    });

    // Calendario
    document.getElementById("bnavCalendar")?.addEventListener("click", () => {
      Router.go("calendar"); this.closeSidebar();
    });

    // Semestres: toggle accordion + go to first sem
    document.getElementById("bnavSemestres")?.addEventListener("click", () => {
      const { view, semId } = State.route;
      if (view === "semester" && semId) {
        // Already in a semester — open sidebar accordion
        this.toggleSidebar();
        if (!State.semAccordionOpen) {
          State.semAccordionOpen = true;
          document.getElementById("semAccordionToggle").classList.add("expanded");
          document.getElementById("sidebarAccordionBody").classList.add("open");
        }
      } else {
        Router.go("semester/1");
      }
    });

    // Nuevo semestre
    document.getElementById("bnavNewSem")?.addEventListener("click", () => {
      SemesterCRUD.openAdd();
    });

    this.updateBottomNav();
  },

  updateBottomNav() {
    const nav = document.getElementById("bottomNav");
    if (!nav) return;
    const { view } = State.route;
    nav.querySelectorAll(".bnav-btn").forEach(btn => btn.classList.remove("active"));
    const active = nav.querySelector(`[data-route="${view}"]`);
    if (active) active.classList.add("active");
    if (view === "semester" || view === "subject")
      document.getElementById("bnavSemestres")?.classList.add("active");
    if (view === "calendar")
      document.getElementById("bnavCalendar")?.classList.add("active");
  },

  /* ── Sidebar ── */
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
    const staticItems = CURRICULUM.map(sem => navSemItem(sem)).join("");
    const customItems = window._customSemesters.map(sem => navSemItem(sem, true)).join("");
    document.getElementById("sidebarAccordionBody").innerHTML = staticItems + customItems;

    // Usar onclick (siempre reemplaza el listener anterior, sin cloneNode)
    const toggle = document.getElementById("semAccordionToggle");
    const body   = document.getElementById("sidebarAccordionBody");
    toggle.onclick = () => {
      State.semAccordionOpen = !State.semAccordionOpen;
      toggle.classList.toggle("expanded", State.semAccordionOpen);
      body.classList.toggle("open", State.semAccordionOpen);
    };

    // Delegación de clics en todo el nav (una sola asignación)
    const self = this;
    document.getElementById("sidebarNav").onclick = function(e) {
      const btn = e.target.closest("[data-route]");
      if (btn) { Router.go(btn.dataset.route); self.closeSidebar(); }
    };

    const btnNew = document.getElementById("btnNewSemester");
    if (btnNew) btnNew.onclick = () => { SemesterCRUD.openAdd(); this.closeSidebar(); };
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
    this.updateBottomNav();
  },

  updateTopbar() {
    const { view, semId, subId } = State.route;
    const titleEl = document.getElementById("topbarTitle");
    const subEl   = document.getElementById("topbarSub");
    if (view === "dashboard") {
      titleEl.textContent = "CENTRO DE CONTROL";
      subEl.textContent   = "Portal personal — Carrera de Física";
    } else if (view === "semester" && semId) {
      const sem = getAnySemester(semId);
      titleEl.textContent = sem ? `${sem.name.toUpperCase()}` : "Semestre";
      subEl.textContent   = sem ? `${sem.subtitle||""} · ${sem.credits || ""} créditos` : "";
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
    } else if (view === "calendar") {
      const now = new Date();
      titleEl.textContent = "CALENDARIO ACADÉMICO";
      subEl.textContent   = `${now.toLocaleString("es-CO",{month:"long",year:"numeric"})}`;
    }
  },

  async applyRoute() {
    const { view, semId, subId } = State.route;
    if ((view==="semester"||view==="subject") && !State.semAccordionOpen) {
      State.semAccordionOpen = true;
      document.getElementById("semAccordionToggle")?.classList.add("expanded");
      document.getElementById("sidebarAccordionBody")?.classList.add("open");
    }
    this.updateSidebarActive();
    try {
      if (view==="dashboard")                     await Views.dashboard();
      else if (view==="semester" && semId)         await Views.semester(semId);
      else if (view==="subject" && semId && subId) await Views.subject(semId, subId);
      else if (view==="documents")                 await Views.documents();
      else if (view==="stats")                     await Views.stats();
      else if (view==="calendar")                  await Views.calendar();
      else                                         await Views.dashboard();
    } catch(err) {
      console.error("❌ applyRoute error:", err);
      setContent(`
        <div style="padding:32px;max-width:520px;margin:0 auto">
          <div style="background:#0e1f26;border:1px solid #f44336;border-radius:12px;padding:24px">
            <h3 style="color:#f44336;margin-bottom:10px">
              <i class="fa-solid fa-circle-xmark"></i> Error al cargar
            </h3>
            <p style="color:#ccc;font-size:14px;margin-bottom:8px"><strong>${err.message || err}</strong></p>
            <p style="color:#8aa;font-size:12px">Código: ${err.code || "—"}</p>
            <hr style="border-color:#1a3a44;margin:16px 0">
            <p style="color:#8aa;font-size:12px">
              Abre la consola del navegador (F12 → Console) para ver el detalle completo.
            </p>
            <button onclick="App.applyRoute()" style="
              margin-top:14px;padding:9px 18px;
              background:linear-gradient(135deg,#d4a017,#c25b12);
              border:none;border-radius:8px;color:#020b10;
              font-weight:700;cursor:pointer;font-size:13px">
              <i class="fa-solid fa-rotate-right"></i> Reintentar
            </button>
          </div>
        </div>
      `);
    }
  }
};

/* Helper para item de semestre en sidebar */
function navSemItem(sem, isCustom=false) {
  return `<button class="nav-sub-item" data-route="semester/${sem.id}" id="navSem${sem.id}">
    <i class="fa-solid ${sem.icon}"></i> ${sem.name}
    ${isCustom?`<i class="fa-solid fa-pen nav-edit-sem" onclick="event.stopPropagation();SemesterCRUD.openEdit(${sem.id},event)" title="Editar"></i>`:""}
  </button>`;
}

/* ================================================================ BOOT */
document.addEventListener("DOMContentLoaded", () => {
  document.documentElement.style.visibility = "hidden";
  App.init().catch(err => {
    console.error("App init error:", err);
    document.documentElement.style.visibility = "visible";
  });
});

/* ================================================================
   📅 CALENDAR — Tipos de evento
================================================================ */
const EVENT_TYPES = {
  parcial:     { label:"Parcial / Examen",   color:"#ef5350", bg:"rgba(239,83,80,.18)",  icon:"fa-file-pen"       },
  trabajo:     { label:"Trabajo / Proyecto", color:"#3498db", bg:"rgba(52,152,219,.18)", icon:"fa-laptop-code"    },
  laboratorio: { label:"Laboratorio",        color:"#00ccaa", bg:"rgba(0,204,170,.18)",  icon:"fa-flask"          },
  taller:      { label:"Taller",             color:"#ff7a00", bg:"rgba(255,122,0,.18)",  icon:"fa-pen-ruler"      },
  entrega:     { label:"Entrega",            color:"#f1c40f", bg:"rgba(241,196,15,.18)", icon:"fa-paper-plane"    },
  clase:       { label:"Clase especial",     color:"#66bb6a", bg:"rgba(102,187,106,.18)",icon:"fa-chalkboard"     },
  otro:        { label:"Otro",               color:"#ab47bc", bg:"rgba(171,71,188,.18)", icon:"fa-calendar-day"   },
};

/* ================================================================
   📅 DB — Eventos de calendario
================================================================ */
Object.assign(DB, {
  async getEvents() {
    try {
      const snap = await db.collection("users").doc(this.uid())
                           .collection("events")
                           .orderBy("date","asc").get();
      return snap.docs.map(d => ({ id:d.id, ...d.data() }));
    } catch(e) { console.warn("getEvents:", e); return []; }
  },

  async saveEvent(ev) {
    const data = {
      title:       ev.title,
      type:        ev.type,
      date:        ev.date,
      description: ev.description || "",
      subject:     ev.subject     || "",
      updatedAt:   firebase.firestore.FieldValue.serverTimestamp(),
    };
    if (ev.id) {
      await db.collection("users").doc(this.uid())
              .collection("events").doc(ev.id).set(data, { merge:true });
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection("users").doc(this.uid())
              .collection("events").add(data);
    }
  },

  async deleteEvent(id) {
    await db.collection("users").doc(this.uid())
            .collection("events").doc(id).delete();
  }
});

/* ================================================================
   📅 CALENDAR CRUD — Modal agregar/editar evento
================================================================ */
const CalendarCRUD = {
  _editId:   null,
  _allEvents: [],

  openAdd(dateStr) {
    this._editId = null;
    document.getElementById("calModalTitle").textContent  = "Nuevo evento";
    document.getElementById("calModalEvTitle").value      = "";
    document.getElementById("calModalDate").value         = dateStr || _today();
    document.getElementById("calModalType").value         = "parcial";
    document.getElementById("calModalDesc").value         = "";
    document.getElementById("calModalSubject").value      = "";
    document.getElementById("calModalDeleteBtn").style.display = "none";
    this._refreshTypeColor();
    document.getElementById("calendarModal").classList.add("open");
    setTimeout(() => document.getElementById("calModalEvTitle").focus(), 120);
  },

  openEdit(id) {
    const ev = this._allEvents.find(e => e.id === id);
    if (!ev) return;
    this._editId = id;
    document.getElementById("calModalTitle").textContent  = "Editar evento";
    document.getElementById("calModalEvTitle").value      = ev.title;
    document.getElementById("calModalDate").value         = ev.date;
    document.getElementById("calModalType").value         = ev.type;
    document.getElementById("calModalDesc").value         = ev.description || "";
    document.getElementById("calModalSubject").value      = ev.subject     || "";
    document.getElementById("calModalDeleteBtn").style.display = "block";
    this._refreshTypeColor();
    document.getElementById("calendarModal").classList.add("open");
  },

  close() { document.getElementById("calendarModal").classList.remove("open"); },

  _refreshTypeColor() {
    const type   = document.getElementById("calModalType").value;
    const cfg    = EVENT_TYPES[type] || EVENT_TYPES.otro;
    const dot    = document.getElementById("calTypeDot");
    if (dot) dot.style.background = cfg.color;
  },

  async save() {
    const title = document.getElementById("calModalEvTitle").value.trim();
    const date  = document.getElementById("calModalDate").value;
    const type  = document.getElementById("calModalType").value;
    if (!title) { toast("El título es obligatorio","info"); return; }
    if (!date)  { toast("Selecciona una fecha","info");    return; }

    const btn = document.getElementById("btnCalModalSave");
    btn.disabled = true;
    try {
      await DB.saveEvent({
        id:          this._editId,
        title, date, type,
        description: document.getElementById("calModalDesc").value.trim(),
        subject:     document.getElementById("calModalSubject").value.trim(),
      });
      this.close();
      toast(this._editId ? "Evento actualizado ✓" : "Evento guardado ✓");
      // Reload calendar to current month
      const [y, m] = date.split("-").map(Number);
      await Views.calendar(y, m);
      await Notif.load();
    } catch(e) { toast("Error: "+e.message,"err"); }
    btn.disabled = false;
  },

  async deleteEv() {
    if (!this._editId) return;
    if (!confirm("¿Eliminar este evento?")) return;
    try {
      await DB.deleteEvent(this._editId);
      this.close();
      toast("Evento eliminado");
      const dateVal = document.getElementById("calModalDate").value;
      const [y, m]  = dateVal.split("-").map(Number);
      await Views.calendar(y, m);
      await Notif.load();
    } catch(e) { toast("Error: "+e.message,"err"); }
  }
};

/* ================================================================
   🔔 NOTIF — Notificaciones de eventos próximos
================================================================ */
const Notif = {
  _events: [],

  async load() {
    const all    = await DB.getEvents();
    const today  = _today();
    const limit  = _addDays(today, 7);
    this._events = all.filter(e => e.date >= today && e.date <= limit)
                      .sort((a,b) => a.date.localeCompare(b.date));
    this._updateBadge();
  },

  _updateBadge() {
    const badge = document.getElementById("notifBadge");
    if (!badge) return;
    const n = this._events.length;
    badge.textContent  = n > 9 ? "9+" : n;
    badge.style.display = n > 0 ? "flex" : "none";
  },

  toggle() {
    const panel = document.getElementById("notifPanel");
    const isOpen = panel.classList.contains("open");
    isOpen ? this.hide() : this.show();
  },

  show() {
    this._render();
    document.getElementById("notifPanel").classList.add("open");
    // Close on outside click
    setTimeout(() => {
      document.addEventListener("click", Notif._outsideClick, { once:true });
    }, 0);
  },

  hide() { document.getElementById("notifPanel").classList.remove("open"); },

  _outsideClick(e) {
    const panel = document.getElementById("notifPanel");
    const bell  = document.getElementById("notifBell");
    if (!panel.contains(e.target) && !bell.contains(e.target)) Notif.hide();
  },

  _render() {
    const list = document.getElementById("notifList");
    if (!list) return;
    if (!this._events.length) {
      list.innerHTML = `
        <div class="notif-empty">
          <i class="fa-solid fa-circle-check"></i>
          <p>Sin eventos próximos</p>
          <small>Los próximos 7 días están libres</small>
        </div>`;
      return;
    }
    list.innerHTML = this._events.map(ev => {
      const cfg  = EVENT_TYPES[ev.type] || EVENT_TYPES.otro;
      const days = _daysUntil(ev.date);
      const when = days === 0 ? "Hoy" : days === 1 ? "Mañana" : `En ${days} días`;
      return `
        <div class="notif-item" onclick="CalendarCRUD.openEdit('${ev.id}');Notif.hide()">
          <div class="notif-dot" style="background:${cfg.color}"></div>
          <div class="notif-info">
            <div class="notif-title">${ev.title}</div>
            <div class="notif-meta">
              <span>${cfg.label}</span>
              ${ev.subject ? `· <span>${ev.subject}</span>` : ""}
            </div>
          </div>
          <div class="notif-when" style="color:${cfg.color}">${when}</div>
        </div>`;
    }).join("");
  }
};

/* ================================================================
   📅 VIEWS.calendar — Vista de calendario mensual
================================================================ */
Views.calendar = async function(year, month) {
  // Defaults: current month
  const now = new Date();
  year  = year  || now.getFullYear();
  month = month || (now.getMonth() + 1);

  setContent(loading());

  const allEvents = await DB.getEvents();
  CalendarCRUD._allEvents = allEvents;

  // Filter events for this month
  const monthStr = `${year}-${String(month).padStart(2,"0")}`;
  const monthEvents = allEvents.filter(e => e.date.startsWith(monthStr));

  // Build a map: day → events[]
  const dayMap = {};
  monthEvents.forEach(ev => {
    const d = parseInt(ev.date.split("-")[2]);
    if (!dayMap[d]) dayMap[d] = [];
    dayMap[d].push(ev);
  });

  // Calendar grid math
  const firstDay    = new Date(year, month-1, 1).getDay(); // 0=Dom
  const daysInMonth = new Date(year, month, 0).getDate();
  const prevDays    = new Date(year, month-1, 0).getDate();
  const todayStr    = _today();
  const todayNum    = todayStr.startsWith(monthStr) ? parseInt(todayStr.split("-")[2]) : -1;

  const MONTHS_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
                     "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const DAYS_ES   = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

  // Prev / next month
  const prevM = month === 1 ? { y:year-1, m:12 } : { y:year, m:month-1 };
  const nextM = month === 12 ? { y:year+1, m:1 } : { y:year, m:month+1 };

  // Build grid cells
  let cells = "";
  let total = firstDay + daysInMonth;
  total = total % 7 !== 0 ? total + (7 - total%7) : total;

  for (let i = 0; i < total; i++) {
    const col = i % 7;
    if (i < firstDay) {
      const d = prevDays - firstDay + i + 1;
      cells += `<div class="cal-cell cal-other"><span class="cal-day-num">${d}</span></div>`;
    } else if (i >= firstDay + daysInMonth) {
      const d = i - firstDay - daysInMonth + 1;
      cells += `<div class="cal-cell cal-other"><span class="cal-day-num">${d}</span></div>`;
    } else {
      const d     = i - firstDay + 1;
      const dStr  = `${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      const isToday = d === todayNum;
      const evs   = dayMap[d] || [];
      const pills = evs.slice(0,3).map(ev => {
        const cfg = EVENT_TYPES[ev.type] || EVENT_TYPES.otro;
        return `<div class="cal-pill" style="background:${cfg.bg};color:${cfg.color};border-left:3px solid ${cfg.color}"
          onclick="event.stopPropagation();CalendarCRUD.openEdit('${ev.id}')">${ev.title}</div>`;
      }).join("");
      const more = evs.length > 3
        ? `<div class="cal-more">+${evs.length-3} más</div>` : "";
      cells += `
        <div class="cal-cell${isToday?" cal-today":""}" onclick="CalendarCRUD.openAdd('${dStr}')">
          <span class="cal-day-num${isToday?" today-num":""}">${d}</span>
          ${pills}${more}
        </div>`;
    }
  }

  // Legend
  const legend = Object.entries(EVENT_TYPES).map(([k,v]) =>
    `<span class="cal-legend-item"><span style="background:${v.color};width:12px;height:12px;border-radius:3px;display:inline-block"></span>${v.label}</span>`
  ).join("");

  // Count upcoming events this month from today
  const upcoming = monthEvents.filter(e => e.date >= todayStr).length;

  setContent(`
    <div class="cal-header-bar">
      <button class="cal-nav-btn" onclick="Views.calendar(${prevM.y},${prevM.m})">
        <i class="fa-solid fa-chevron-left"></i> Anterior
      </button>
      <h2 class="cal-month-title">${MONTHS_ES[month-1]} ${year}</h2>
      <button class="cal-nav-btn" onclick="Views.calendar(${nextM.y},${nextM.m})">
        Siguiente <i class="fa-solid fa-chevron-right"></i>
      </button>
      <div class="cal-header-actions">
        <button class="cal-today-btn" onclick="Views.calendar(${now.getFullYear()},${now.getMonth()+1})">
          <i class="fa-solid fa-calendar-day"></i> Hoy
        </button>
        <button class="btn-primary cal-add-btn" onclick="CalendarCRUD.openAdd('${todayStr}')">
          <i class="fa-solid fa-plus"></i> Nuevo evento
        </button>
      </div>
    </div>

    ${upcoming > 0 ? `<div class="cal-upcoming-bar">
      <i class="fa-solid fa-bell"></i>
      Tienes <strong>${upcoming}</strong> evento${upcoming>1?"s":""} este mes por venir
    </div>` : ""}

    <div class="cal-grid-wrap">
      <div class="cal-grid">
        ${DAYS_ES.map(d=>`<div class="cal-weekday">${d}</div>`).join("")}
        ${cells}
      </div>
    </div>

    <div class="cal-legend">${legend}</div>
  `);

  App.updateSidebarActive();
};

/* ================================================================
   HELPERS de fecha
================================================================ */
function _today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function _addDays(dateStr, n) {
  const d = new Date(dateStr); d.setDate(d.getDate()+n);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function _daysUntil(dateStr) {
  const today = new Date(_today()); today.setHours(0,0,0,0);
  const ev    = new Date(dateStr);  ev.setHours(0,0,0,0);
  return Math.round((ev-today)/(1000*60*60*24));
}

/* ================================================================
   ⏱ POMODORO — Engine completo
================================================================ */

/* ── DB: sesiones de estudio ── */
Object.assign(DB, {
  async getStudyStats(semId, subId) {
    try {
      const snap = await this._subRef(semId, subId).get();
      return snap.exists ? (snap.data().studyStats || { totalMin:0, sessions:0 }) : { totalMin:0, sessions:0 };
    } catch(e) { return { totalMin:0, sessions:0 }; }
  },
  async addStudySession(semId, subId, minutes) {
    const cur = await this.getStudyStats(semId, subId);
    await this._subRef(semId, subId).set({
      studyStats: {
        totalMin: (cur.totalMin || 0) + minutes,
        sessions: (cur.sessions  || 0) + 1,
        lastAt:   firebase.firestore.FieldValue.serverTimestamp(),
      }
    }, { merge: true });
  }
});

/* ── Presets ── */
const POMO_PRESETS = [
  { id:"baby",     label:"Paso de bebé", work:10, rest:5,  long:10  },
  { id:"popular",  label:"Popular",      work:20, rest:5,  long:15  },
  { id:"medio",    label:"Medio",        work:40, rest:8,  long:20  },
  { id:"extended", label:"Extendido",    work:60, rest:10, long:25  },
  { id:"custom",   label:"Personalizado",work:25, rest:5,  long:15  },
];

/* ── Pomodoro state ── */
const Pomodoro = {
  semId: null, subId: null,
  preset: "popular",
  custom: { work:25, rest:5, long:15 },
  phase: "work",   // work | rest | long
  round: 0,        // completed pomodoros this session
  totalMin: 0,     // total accumulated minutes (from DB)
  sessions: 0,
  timer: null,
  remaining: 0,    // seconds remaining
  running: false,
  showConfig: false,
  _notifGranted: false,

  /* Call once when Pomodoro tab is activated */
  async init(semId, subId) {
    if (this.semId === semId && this.subId === subId) {
      this.render(); return; // already init for this subject — just re-render
    }
    // Stop any running timer from previous subject
    this.stop();
    this.semId  = semId;
    this.subId  = subId;
    this.round  = 0;
    this.phase  = "work";
    this.running = false;
    this.showConfig = false;

    const stats = await DB.getStudyStats(semId, subId);
    this.totalMin = stats.totalMin || 0;
    this.sessions = stats.sessions || 0;
    this._resetTimer();

    // Request browser notification permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().then(p => { this._notifGranted = p === "granted"; });
    } else {
      this._notifGranted = Notification.permission === "granted";
    }
    this.render();
  },

  _cfg() {
    const p = POMO_PRESETS.find(p => p.id === this.preset);
    return this.preset === "custom" ? this.custom : p;
  },

  _phaseDuration() {
    const cfg = this._cfg();
    if (this.phase === "work") return cfg.work * 60;
    if (this.phase === "rest") return cfg.rest * 60;
    return cfg.long * 60;
  },

  _resetTimer() {
    clearInterval(this.timer);
    this.timer   = null;
    this.running = false;
    this.remaining = this._phaseDuration();
  },

  start() {
    if (this.running) return;
    this.running = true;
    this._updateBtn();
    this.timer = setInterval(() => {
      if (!this.running) { clearInterval(this.timer); return; }
      this.remaining--;
      this._updateDisplay();
      if (this.remaining <= 0) this._onFinish();
    }, 1000);
  },

  pause() {
    this.running = false;
    clearInterval(this.timer);
    this._updateBtn();
  },

  stop() {
    clearInterval(this.timer);
    this.timer   = null;
    this.running = false;
    this._resetTimer();
    this.render();
  },

  async _onFinish() {
    clearInterval(this.timer);
    this.running = false;
    this._playSound();

    if (this.phase === "work") {
      const worked = this._cfg().work;
      this.round++;
      this.totalMin  += worked;
      this.sessions  += 1;
      try { await DB.addStudySession(this.semId, this.subId, worked); } catch(e) {}
      this._notify("🍅 ¡Pomodoro completado!", `Has estudiado ${worked} min. Tiempo de descansar.`);
      this.phase = (this.round % 4 === 0) ? "long" : "rest";
    } else {
      this._notify("⚡ ¡Descanso terminado!", "Hora de volver a estudiar.");
      this.phase = "work";
    }
    this._resetTimer();
    this.render();
  },

  _notify(title, body) {
    if (this._notifGranted) {
      try { new Notification(title, { body, icon: "/tomi/assets/favicon.svg" }); } catch(e) {}
    }
  },

  _playSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const sequences = this.phase === "work"
        ? [{ f:523, t:0 },{ f:659, t:0.15 },{ f:784, t:0.3 }]
        : [{ f:784, t:0 },{ f:659, t:0.2  },{ f:523, t:0.4 }];
      sequences.forEach(({ f, t }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = f;
        osc.type = "sine";
        gain.gain.setValueAtTime(0.5, ctx.currentTime + t);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.4);
        osc.start(ctx.currentTime + t);
        osc.stop(ctx.currentTime + t + 0.5);
      });
    } catch(e) {}
  },

  _updateDisplay() {
    const el = document.getElementById("pomoTime");
    const ring = document.getElementById("pomoRing");
    if (!el) return;
    const total = this._phaseDuration();
    const pct   = (this.remaining / total);
    const r = 88, circ = 2 * Math.PI * r;
    if (ring) ring.style.strokeDashoffset = circ * (1 - pct);
    el.textContent = this._fmt(this.remaining);
  },

  _updateBtn() {
    const btn = document.getElementById("pomoBtnMain");
    if (!btn) return;
    if (this.running) {
      btn.innerHTML = '<i class="fa-solid fa-pause"></i> PAUSAR';
      btn.className = "pomo-btn-main pomo-btn-pause";
      btn.onclick = () => Pomodoro.pause();
    } else {
      btn.innerHTML = '<i class="fa-solid fa-play"></i> INICIAR';
      btn.className = "pomo-btn-main pomo-btn-start";
      btn.onclick = () => Pomodoro.start();
    }
  },

  _fmt(sec) {
    const m = String(Math.floor(sec/60)).padStart(2,"0");
    const s = String(sec%60).padStart(2,"0");
    return `${m}:${s}`;
  },

  _phaseLabel() {
    if (this.phase === "work") return "Pomodoro";
    if (this.phase === "rest") return "Descanso";
    return "Descanso largo";
  },

  _phaseColor() {
    if (this.phase === "work") return "#d4a017";
    if (this.phase === "rest") return "#00ccaa";
    return "#3498db";
  },

  _fmtTotal() {
    const h = Math.floor(this.totalMin / 60);
    const m = this.totalMin % 60;
    return h > 0 ? `${h}h ${m}m` : `${m} min`;
  },

  setPreset(id) {
    this.stop();
    this.preset = id;
    this.phase  = "work";
    this._resetTimer();
    this.render();
  },

  setCustom(key, val) {
    this.custom[key] = Math.max(1, Math.min(90, parseInt(val) || 1));
    if (this.preset === "custom") {
      this.stop();
      this._resetTimer();
      this._updateDisplay();
      this.render();
    }
  },

  toggleConfig() {
    this.showConfig = !this.showConfig;
    this.render();
  },

  render() {
    const wrap = document.getElementById("pomoWrap");
    if (!wrap) return;

    const cfg    = this._cfg();
    const color  = this._phaseColor();
    const r      = 88;
    const circ   = 2 * Math.PI * r;
    const total  = this._phaseDuration();
    const pct    = this.remaining / total;
    const offset = circ * (1 - pct);

    // Phase tab indicators
    const phases = [
      { id:"work", label:"Pomodoro", count:this.round },
      { id:"rest", label:"Descanso", count:0 },
      { id:"long", label:"Descanso largo", count:0 },
    ];

    const phaseTabs = phases.map(p => `
      <button class="pomo-phase-tab${this.phase===p.id?" active":""}"
        onclick="Pomodoro.phase='${p.id}';Pomodoro.stop();Pomodoro.render()">
        ${p.label}${p.id==="work"&&this.round>0?` <span class="pomo-badge">${this.round}</span>`:""}
      </button>`).join("");

    // Preset list
    const presetList = POMO_PRESETS.map(p => `
      <label class="pomo-preset-row${this.preset===p.id?" selected":""}">
        <input type="radio" name="pomoPreset" value="${p.id}"
          ${this.preset===p.id?"checked":""}
          onchange="Pomodoro.setPreset('${p.id}')">
        <div class="pomo-preset-info">
          <span class="pomo-preset-name">${p.label}</span>
          ${p.id !== "custom"
            ? `<span class="pomo-preset-times">${p.work} min · ${p.rest} min · ${p.long} min</span>`
            : `<div class="pomo-custom-sliders">
                <div class="pomo-slider-row">
                  <span id="lblWork">${this.custom.work} min</span>
                  <input type="range" min="5" max="90" step="5" value="${this.custom.work}"
                    oninput="document.getElementById('lblWork').textContent=this.value+' min'"
                    onchange="Pomodoro.setCustom('work',this.value)" class="pomo-slider">
                  <span class="pomo-slider-label">Pomodoro</span>
                </div>
                <div class="pomo-slider-row">
                  <span id="lblRest">${this.custom.rest} min</span>
                  <input type="range" min="1" max="30" step="1" value="${this.custom.rest}"
                    oninput="document.getElementById('lblRest').textContent=this.value+' min'"
                    onchange="Pomodoro.setCustom('rest',this.value)" class="pomo-slider">
                  <span class="pomo-slider-label">Descanso</span>
                </div>
                <div class="pomo-slider-row">
                  <span id="lblLong">${this.custom.long} min</span>
                  <input type="range" min="5" max="45" step="5" value="${this.custom.long}"
                    oninput="document.getElementById('lblLong').textContent=this.value+' min'"
                    onchange="Pomodoro.setCustom('long',this.value)" class="pomo-slider">
                  <span class="pomo-slider-label">Descanso largo</span>
                </div>
              </div>`
          }
        </div>
      </label>`).join("");

    wrap.innerHTML = `
      <div class="pomo-root">

        <!-- Phase tabs -->
        <div class="pomo-phase-tabs">${phaseTabs}</div>

        <!-- Main card -->
        <div class="pomo-card">

          <!-- Config toggle -->
          <button class="pomo-cfg-btn" onclick="Pomodoro.toggleConfig()" title="Configurar">
            <i class="fa-solid fa-sliders"></i>
          </button>

          ${this.showConfig ? `
          <!-- Config panel -->
          <div class="pomo-config-panel">
            <div class="pomo-config-header">
              <button onclick="Pomodoro.toggleConfig()" class="pomo-back-btn">
                <i class="fa-solid fa-arrow-left"></i>
              </button>
              <h3>Nivel de concentración</h3>
            </div>
            <div class="pomo-preset-list">${presetList}</div>
          </div>` : `

          <!-- Timer display -->
          <div class="pomo-timer-area">
            <div class="pomo-circle-wrap">
              <svg class="pomo-svg" viewBox="0 0 200 200">
                <!-- Glow filter -->
                <defs>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="3" result="blur"/>
                    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                  </filter>
                </defs>
                <!-- Background track -->
                <circle cx="100" cy="100" r="${r}" fill="none"
                  stroke="rgba(255,255,255,0.06)" stroke-width="8"/>
                <!-- Progress ring -->
                <circle id="pomoRing" cx="100" cy="100" r="${r}" fill="none"
                  stroke="${color}" stroke-width="8"
                  stroke-linecap="round"
                  stroke-dasharray="${circ}"
                  stroke-dashoffset="${offset}"
                  transform="rotate(-90 100 100)"
                  filter="url(#glow)"
                  style="transition:stroke-dashoffset 1s linear,stroke .3s"/>
                <!-- Inner glow circle -->
                <circle cx="100" cy="100" r="76" fill="rgba(255,255,255,0.02)"/>
              </svg>
              <!-- Time text overlay -->
              <div class="pomo-time-overlay">
                <div class="pomo-time" id="pomoTime">${this._fmt(this.remaining)}</div>
                <div class="pomo-phase-label" style="color:${color}">${this._phaseLabel()}</div>
                <div class="pomo-preset-badge">${this._cfg().label}</div>
              </div>
            </div>
          </div>

          <!-- Controls -->
          <div class="pomo-controls">
            <button class="pomo-btn-icon" onclick="Pomodoro.stop()" title="Reiniciar">
              <i class="fa-solid fa-rotate-left"></i>
            </button>
            <button id="pomoBtnMain"
              class="pomo-btn-main ${this.running?"pomo-btn-pause":"pomo-btn-start"}"
              onclick="${this.running?"Pomodoro.pause()":"Pomodoro.start()"}">
              <i class="fa-solid ${this.running?"fa-pause":"fa-play"}"></i>
              ${this.running?"PAUSAR":"INICIAR"}
            </button>
            <button class="pomo-btn-icon" onclick="Pomodoro.phase=Pomodoro.phase==='work'?'rest':'work';Pomodoro.stop();Pomodoro.render()" title="Saltar">
              <i class="fa-solid fa-forward-step"></i>
            </button>
          </div>`}

          <!-- Stats bar -->
          <div class="pomo-stats-bar">
            <div class="pomo-stat">
              <i class="fa-solid fa-fire-flame-curved" style="color:#ff7043"></i>
              <span>${this.round} pomodoro${this.round!==1?"s":""} hoy</span>
            </div>
            <div class="pomo-stat-divider"></div>
            <div class="pomo-stat">
              <i class="fa-solid fa-clock-rotate-left" style="color:var(--accent-teal)"></i>
              <span>${this._fmtTotal()} acumulado</span>
            </div>
            <div class="pomo-stat-divider"></div>
            <div class="pomo-stat">
              <i class="fa-solid fa-calendar-check" style="color:var(--accent-yellow)"></i>
              <span>${this.sessions} sesiones totales</span>
            </div>
          </div>
        </div>

        <!-- Tip -->
        <p class="pomo-tip">
          <i class="fa-solid fa-lightbulb"></i>
          Cada 4 pomodoros, tómate un descanso largo. El tiempo se guarda automáticamente.
        </p>
      </div>`;

    // Wire buttons via JS after innerHTML set (avoids template-literal quote escaping)
    const mainBtn = document.getElementById("pomoBtnMain");
    if (mainBtn) mainBtn.onclick = () => Pomodoro.running ? Pomodoro.pause() : Pomodoro.start();
    const skipBtn = document.getElementById("pomoSkipBtn");
    if (skipBtn) skipBtn.onclick = () => {
      Pomodoro.phase = Pomodoro.phase === "work" ? "rest" : "work";
      Pomodoro.stop();
    };
  }
};