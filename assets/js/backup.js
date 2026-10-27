/**
 * BACKUP.JS — Copia de seguridad local (ZIP ordenado)
 * ---------------------------------------------------------------
 * Estructura del ZIP:
 *   Respaldo_FisicaUNAL_AAAA-MM-DD/
 *     01 - Semestre I - Fundamentos/
 *       01 - Fundamentos de física experimental/
 *         Talleres/            <- carpeta creada en la plataforma
 *           archivo.pdf
 *         archivo-sin-carpeta.pdf
 *     LEEME.txt · INDICE.csv · ERRORES.txt (solo si algo falló)
 *
 * SOLO LECTURA: no escribe, mueve ni borra nada en Firestore/Storage.
 * Requiere (ya cargados antes): firebase-config.js (db, storage, auth),
 * app.js (DB, toast, App). JSZip se carga solo si falta (ver ensureJSZip).
 */
"use strict";

const Backup = (() => {

  /* ============================================================ CONFIG */
  const MAX_ZIP_BYTES = 1.5 * 1024 ** 3;  // sobre esto → un ZIP por semestre
  const CONCURRENCY   = 4;                // descargas en paralelo
  const RETRIES       = 2;                // reintentos por archivo
  const ROOT_PREFIX   = "Respaldo_FisicaUNAL";

  /* ============================================================ HELPERS */
  const esc  = s => String(s ?? "").replace(/[&<>"']/g,
    c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const pad2 = n => String(n).padStart(2, "0");
  const keyOf = (semId, subId) => `${semId}_${subId}`;   // igual que subKey() de data.js
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function fmtBytes(b) {
    b = Number(b) || 0;
    if (b < 1024) return `${b} B`;
    const u = ["KB", "MB", "GB", "TB"];
    let i = -1;
    do { b /= 1024; i++; } while (b >= 1024 && i < u.length - 1);
    return `${b.toFixed(b >= 100 ? 0 : 1)} ${u[i]}`;
  }
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  function toDate(ts) {
    try {
      const d = ts?.toDate ? ts.toDate() : (ts ? new Date(ts) : null);
      return d && !isNaN(d) ? d : null;
    } catch { return null; }
  }
  function fmtDateTime(d) {
    return d ? `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}` : "";
  }

  /* Nombres válidos en Windows / macOS / Linux */
  const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;
  function safeName(str, fallback = "sin_nombre", max = 100) {
    let s = String(str ?? "").normalize("NFC")
      .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, "_")
      .replace(/\s+/g, " ").trim()
      .replace(/[. ]+$/g, "");
    if (!s) s = fallback;
    if (RESERVED.test(s)) s = "_" + s;
    return s.length > max ? s.slice(0, max).trim() : s;
  }
  function safeFileName(name, max = 140) {
    const clean = safeName(name, "archivo", 500);
    if (clean.length <= max) return clean;
    const dot = clean.lastIndexOf(".");
    const ext = dot > 0 && clean.length - dot <= 10 ? clean.slice(dot) : "";
    return clean.slice(0, max - ext.length).trim() + ext;
  }
  /* Evita colisiones dentro del mismo ZIP: "a.pdf", "a (2).pdf"… */
  function makeUniquePath() {
    const used = new Set();
    return (dir, fileName) => {
      let candidate = `${dir}/${fileName}`;
      if (!used.has(candidate.toLowerCase())) { used.add(candidate.toLowerCase()); return candidate; }
      const dot  = fileName.lastIndexOf(".");
      const base = dot > 0 ? fileName.slice(0, dot) : fileName;
      const ext  = dot > 0 ? fileName.slice(dot) : "";
      for (let n = 2; ; n++) {
        candidate = `${dir}/${base} (${n})${ext}`;
        if (!used.has(candidate.toLowerCase())) { used.add(candidate.toLowerCase()); return candidate; }
      }
    };
  }
  const csvCell = v => {
    let s = String(v ?? "");
    if (/^[=+\-@]/.test(s)) s = "'" + s;              // evita fórmulas al abrir en Excel
    return `"${s.replace(/"/g, '""')}"`;
  };

  /* ============================================================ CARGA DE JSZip */
  // Orden: copia local → cdnjs → jsDelivr. Así no depende de la etiqueta <script> del HTML.
  const JSZIP_SOURCES = [
    "assets/js/vendor/jszip.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
    "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"
  ];
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const el = document.createElement("script");
      el.src = src;
      el.onload = resolve;
      el.onerror = () => { el.remove(); reject(new Error(`No se pudo cargar ${src}`)); };
      document.head.appendChild(el);
    });
  }
  async function ensureJSZip() {
    if (typeof JSZip !== "undefined") return true;
    for (const src of JSZIP_SOURCES) {
      try { await loadScript(src); if (typeof JSZip !== "undefined") return true; }
      catch (e) { console.warn("Backup:", e.message); }
    }
    return false;
  }

  /* ============================================================ ESTADO */
  const S = {
    tree: null,            // [{ id, order, name, subtitle, subjects:[{key,name,order,files,bytes}] }]
    mode: "all",           // all | sem | sub
    selected: new Set(),   // keys de asignaturas seleccionadas
    split: false,          // un ZIP por semestre (elegido por el usuario)
    view: "loading",       // loading | select | confirm | running | done | error
    cancel: false,
    result: null,
    plan: null,
    progress: { files: 0, total: 0, bytes: 0, totalBytes: 0, current: "", phase: "" }
  };
  let modalEl = null;

  /* ============================================================ LECTURA DE DATOS */
  async function readSubject(ref, semId, subId, name, order) {
    const [fSnap, dSnap] = await Promise.all([
      ref.collection("files").get(),      // sin orderBy: no excluye docs sin 'uploadedAt'
      ref.collection("folders").get()
    ]);
    const folders = {};
    dSnap.docs.forEach(d => { folders[d.id] = d.data().name || "Carpeta"; });
    const files = fSnap.docs.map(d => {
      const x = d.data();
      return {
        id: d.id,
        name: x.name || d.id,
        size: Number(x.size) || 0,
        type: x.type || "",
        url: x.url || "",
        storagePath: x.storagePath || "",
        folder: x.folderId && folders[x.folderId] ? folders[x.folderId] : null,
        uploadedAt: toDate(x.uploadedAt)
      };
    });
    return {
      key: keyOf(semId, subId), semId, subId,
      name: name || String(subId), order,
      files, bytes: files.reduce((a, f) => a + f.size, 0)
    };
  }

  async function loadTree() {
    const base   = typeof CURRICULUM !== "undefined" ? CURRICULUM : [];
    const custom = await DB.getCustomSemesters();                    // [] si falla
    const sems   = [...base, ...custom.filter(c => !base.some(b => b.id === c.id))]
                     .sort((a, b) => a.id - b.id);

    const known = new Set();
    const tree  = [];
    for (const sem of sems) {
      const subjects = await DB.getSubjects(sem.id);
      const subs = await Promise.all(subjects.map((s, i) => {
        known.add(keyOf(sem.id, s.id));
        return readSubject(DB._subRef(sem.id, s.id), sem.id, s.id, s.name, i + 1);
      }));
      tree.push({ id: sem.id, order: Number(sem.id) || 0, name: sem.name,
                  subtitle: sem.subtitle || "", subjects: subs });
    }

    /* Archivos "huérfanos": materia o semestre eliminados que aún conservan archivos */
    try {
      const snap = await db.collection("users").doc(DB.uid()).collection("subjects").get();
      let lost = null;
      for (const d of snap.docs.filter(d => !known.has(d.id))) {
        const [semPart, ...rest] = d.id.split("_");
        const subId = rest.join("_") || d.id;
        const sub = await readSubject(d.ref, semPart, subId, `${subId} (materia no vigente)`, 90);
        if (!sub.files.length) continue;
        let host = tree.find(t => String(t.id) === semPart);
        if (!host) {
          lost = lost || { id: "x", order: 999, name: "Sin clasificar",
                           subtitle: "semestres eliminados", subjects: [] };
          host = lost;
        }
        sub.order = host.subjects.length + 1;
        host.subjects.push(sub);
      }
      if (lost) tree.push(lost);
    } catch (e) { console.warn("Backup: búsqueda de huérfanos omitida:", e); }

    return tree;
  }

  /* ============================================================ SELECCIÓN */
  const allSubjects = () => S.tree.flatMap(s => s.subjects.filter(x => x.files.length));

  function picked() {
    return S.tree
      .map(sem => ({ sem, subs: sem.subjects.filter(s => s.files.length && S.selected.has(s.key)) }))
      .filter(p => p.subs.length);
  }
  function totals(list = picked()) {
    let files = 0, bytes = 0, subjects = 0;
    list.forEach(p => p.subs.forEach(s => { files += s.files.length; bytes += s.bytes; subjects++; }));
    return { files, bytes, subjects, semesters: list.length };
  }
  const effectiveSplit = () => {
    const t = totals();
    return S.split || (t.bytes > MAX_ZIP_BYTES && t.semesters > 1);
  };
  function setMode(mode) {
    S.mode = mode;
    if (mode === "all") allSubjects().forEach(s => S.selected.add(s.key));
    else S.selected.clear();
  }
  function scopeLabel() {
    const t = totals();
    if (S.mode === "all") return "Copia completa";
    if (S.mode === "sem") return `${plural(t.semesters, "semestre", "semestres")} seleccionado${t.semesters === 1 ? "" : "s"}`;
    return `${plural(t.subjects, "asignatura", "asignaturas")} seleccionada${t.subjects === 1 ? "" : "s"}`;
  }

  /* ============================================================ PLAN (rutas dentro del ZIP) */
  const semDirName = sem => {
    const sub = sem.subtitle ? ` - ${safeName(sem.subtitle, "", 60)}` : "";
    return `${pad2(Math.min(sem.order, 99))} - ${safeName(sem.name, "Semestre")}${sub}`;
  };

  function buildPlan(list, split, stamp, mode) {
    const root = `${ROOT_PREFIX}_${stamp}`;
    const makeGroup = (picks, suffix) => {
      const unique = makeUniquePath();
      const entries = [];
      picks.forEach(p => {
        const semDir = `${root}/${semDirName(p.sem)}`;
        p.subs.forEach(s => {
          const subDir = `${semDir}/${pad2(s.order)} - ${safeName(s.name, "Asignatura")}`;
          const sorted = [...s.files].sort((a, b) =>
            (a.folder || "").localeCompare(b.folder || "", "es") || a.name.localeCompare(b.name, "es"));
          sorted.forEach(f => {
            const dir  = f.folder ? `${subDir}/${safeName(f.folder, "Carpeta", 80)}` : subDir;
            const path = unique(dir, safeFileName(f.name));
            entries.push({ path, file: f, sem: p.sem, sub: s });
          });
        });
      });
      return {
        root, entries,
        zipName: `${root}_${suffix}.zip`,
        files: entries.length,
        bytes: entries.reduce((a, e) => a + e.file.size, 0)
      };
    };
    if (split) {
      return list.map(p => makeGroup([p], `${pad2(Math.min(p.sem.order, 99))}_${safeName(p.sem.name, "semestre", 40)}`));
    }
    return [makeGroup(list, mode === "all" ? "completo" : "seleccion")];
  }

  /* ============================================================ DESCARGA */
  async function fetchBlob(f) {
    let lastErr = new Error("El archivo no tiene ruta de almacenamiento");
    for (let attempt = 0; attempt <= RETRIES; attempt++) {
      if (S.cancel) throw new Error("Cancelado");
      try {
        if (f.storagePath) {
          try { return await storage.ref(f.storagePath).getBlob(); }
          catch (e) { lastErr = e; if (!f.url) throw e; }
        }
        if (f.url) {
          const r = await fetch(f.url);
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return await r.blob();
        }
      } catch (e) { lastErr = e; }
      await sleep(400 * (attempt + 1));
    }
    throw lastErr;
  }

  async function pool(items, n, worker) {
    let i = 0;
    const run = async () => { while (i < items.length && !S.cancel) await worker(items[i++]); };
    await Promise.all(Array.from({ length: Math.min(n, items.length) }, run));
  }

  function saveBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 120000);
  }

  function readme(group, errors, scope) {
    const lines = [
      "RESPALDO — Repositorio Física UNAL",
      "=".repeat(40),
      `Generado:  ${fmtDateTime(new Date())}`,
      `Cuenta:    ${auth.currentUser?.email || "—"}`,
      `Alcance:   ${scope}`,
      `Archivos:  ${group.files - errors.length} de ${group.files} (${fmtBytes(group.bytes)})`,
      "",
      "Estructura:",
      "  Semestre / Asignatura / Carpeta (si existe) / Archivo",
      "",
      "INDICE.csv lista cada archivo con su ruta, tamaño y fecha de subida.",
      "Esta copia es de solo lectura: no modifica nada en la plataforma."
    ];
    if (errors.length) lines.push("", `ATENCIÓN: ${errors.length} archivo(s) no se pudieron descargar. Ver ERRORES.txt.`);
    return lines.join("\r\n");
  }
  function indexCsv(entries, failed) {
    const rows = [["Semestre", "Asignatura", "Carpeta", "Archivo", "Tamaño (bytes)", "Subido", "Ruta en el ZIP", "Estado"]];
    entries.forEach(e => rows.push([
      e.sem.name, e.sub.name, e.file.folder || "", e.file.name, e.file.size,
      fmtDateTime(e.file.uploadedAt), e.path, failed.has(e.path) ? "ERROR" : "OK"
    ]));
    return "\ufeff" + rows.map(r => r.map(csvCell).join(",")).join("\r\n");
  }

  async function execute(plan, scope) {
    S.cancel = false;
    S.view = "running";
    S.progress = {
      files: 0, bytes: 0, current: "", phase: "Preparando…",
      total: plan.reduce((a, g) => a + g.files, 0),
      totalBytes: plan.reduce((a, g) => a + g.bytes, 0)
    };
    render();
    const guard = e => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", guard);

    const allErrors = [];
    let zipsDone = 0;
    try {
      for (let gi = 0; gi < plan.length; gi++) {
        if (S.cancel) break;
        const group = plan[gi];
        const zip = new JSZip();
        const errors = [];

        await pool(group.entries, CONCURRENCY, async e => {
          if (S.cancel) return;
          S.progress.current = e.file.name;
          S.progress.phase = plan.length > 1
            ? `Descargando ${gi + 1}/${plan.length} · ${e.sem.name}` : "Descargando archivos…";
          try {
            const blob = await fetchBlob(e.file);
            zip.file(e.path, blob, { binary: true, date: e.file.uploadedAt || new Date() });
          } catch (err) {
            if (!S.cancel) errors.push({ path: e.path, reason: err?.message || String(err) });
          }
          S.progress.files++;
          S.progress.bytes += e.file.size;
          paintProgress();
        });
        if (S.cancel) break;

        const failed = new Set(errors.map(x => x.path));
        zip.file(`${group.root}/LEEME.txt`, readme(group, errors, scope));
        zip.file(`${group.root}/INDICE.csv`, indexCsv(group.entries, failed));
        if (errors.length) {
          zip.file(`${group.root}/ERRORES.txt`,
            errors.map(x => `${x.path}\r\n   → ${x.reason}`).join("\r\n\r\n"));
        }

        S.progress.phase = "Empaquetando ZIP…";
        paintProgress();
        // STORE: los PDF/imagenes ya vienen comprimidos; es mucho más rápido y usa menos memoria
        const out = await zip.generateAsync(
          { type: "blob", compression: "STORE", streamFiles: true },
          m => { S.progress.phase = `Empaquetando ZIP… ${Math.round(m.percent)}%`; paintProgress(); }
        );
        saveBlob(out, group.zipName);
        zipsDone++;
        allErrors.push(...errors);
        if (gi < plan.length - 1) await sleep(800);       // evita bloqueo de descargas múltiples
      }
      S.result = {
        cancelled: S.cancel, zips: zipsDone, errors: allErrors,
        files: S.progress.files - allErrors.length, names: plan.slice(0, zipsDone).map(g => g.zipName)
      };
      S.view = "done";
    } catch (err) {
      console.error("Backup:", err);
      S.result = { fatal: err?.message || String(err), zips: zipsDone, errors: allErrors };
      S.view = "done";
    } finally {
      window.removeEventListener("beforeunload", guard);
    }
    render();
  }

  /* ============================================================ UI */
  function ensureModal() {
    if (modalEl) return modalEl;
    modalEl = document.createElement("div");
    modalEl.className = "modal-overlay";
    modalEl.id = "backupModal";
    modalEl.innerHTML = `<div class="modal-content bk-modal" role="dialog" aria-modal="true"
                              aria-labelledby="bkTitle"><div id="bkBody"></div></div>`;
    document.body.appendChild(modalEl);

    modalEl.addEventListener("click", e => {
      if (e.target === modalEl && S.view !== "running") close();
      const act = e.target.closest("[data-bk]")?.dataset.bk;
      if (act) handleAction(act);
    });
    modalEl.addEventListener("change", e => {
      const t = e.target;
      if (t.name === "bkMode")       { setMode(t.value); renderSelect(); }
      else if (t.dataset.sem != null) {
        const sem = S.tree.find(s => String(s.id) === t.dataset.sem);
        sem?.subjects.filter(s => s.files.length)
           .forEach(s => t.checked ? S.selected.add(s.key) : S.selected.delete(s.key));
        syncSelection();
      } else if (t.dataset.sub != null) {
        t.checked ? S.selected.add(t.dataset.sub) : S.selected.delete(t.dataset.sub);
        syncSelection();
      } else if (t.id === "bkSplit") { S.split = t.checked; syncSelection(); }
    });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && modalEl.classList.contains("open") && S.view !== "running") close();
    });
    return modalEl;
  }

  function handleAction(act) {
    if (act === "close") close();
    else if (act === "next") { S.view = "confirm"; render(); }
    else if (act === "back") { S.view = "select"; render(); }
    else if (act === "retry") open();
    else if (act === "go") {
      const scope = scopeLabel();
      S.plan = buildPlan(picked(), effectiveSplit(), today(), S.mode);
      execute(S.plan, scope);
    } else if (act === "cancel") {
      S.cancel = true;
      const b = modalEl.querySelector('[data-bk="cancel"]');
      if (b) { b.disabled = true; b.textContent = "Cancelando…"; }
    } else if (act === "again") { S.view = "select"; render(); }
  }

  const body = () => modalEl.querySelector("#bkBody");

  function render() {
    ensureModal();
    ({ loading: renderLoading, select: renderSelect, confirm: renderConfirm,
       running: renderRunning, done: renderDone, error: renderError }[S.view] || renderLoading)();
  }

  function renderLoading() {
    body().innerHTML = `
      <h2 id="bkTitle"><i class="fa-solid fa-box-archive"></i> Copia de seguridad</h2>
      <div class="bk-center"><div class="spinner"></div>
        <p class="bk-muted">Leyendo tus archivos…</p></div>`;
  }

  function renderError() {
    body().innerHTML = `
      <h2 id="bkTitle"><i class="fa-solid fa-triangle-exclamation"></i> No se pudo leer</h2>
      <p class="bk-muted bk-center">${esc(S.result?.fatal || "Error desconocido")}</p>
      <div class="modal-actions">
        <button class="btn-secondary" data-bk="close">Cerrar</button>
        <button class="btn-primary" data-bk="retry"><i class="fa-solid fa-rotate"></i> Reintentar</button>
      </div>`;
  }

  function modeCard(value, icon, title, sub) {
    return `<label class="bk-mode${S.mode === value ? " is-on" : ""}">
      <input type="radio" name="bkMode" value="${value}" ${S.mode === value ? "checked" : ""}>
      <i class="fa-solid ${icon}"></i>
      <span><b>${title}</b><small>${sub}</small></span></label>`;
  }

  function treeHTML() {
    if (S.mode === "all") return "";
    const rows = S.tree.map(sem => {
      const subs = sem.subjects.filter(s => s.files.length);
      if (!subs.length) return "";
      const files = subs.reduce((a, s) => a + s.files.length, 0);
      const bytes = subs.reduce((a, s) => a + s.bytes, 0);
      const subRows = S.mode === "sub" ? subs.map(s => `
        <label class="bk-row bk-row-sub">
          <input type="checkbox" data-sub="${esc(s.key)}">
          <span class="bk-name">${esc(s.name)}</span>
          <span class="bk-meta">${plural(s.files.length, "archivo", "archivos")} · ${fmtBytes(s.bytes)}</span>
        </label>`).join("") : "";
      return `<div class="bk-sem">
        <label class="bk-row bk-row-sem">
          <input type="checkbox" data-sem="${esc(sem.id)}">
          <span class="bk-name">${esc(sem.name)}${sem.subtitle ? ` <em>${esc(sem.subtitle)}</em>` : ""}</span>
          <span class="bk-meta">${plural(files, "archivo", "archivos")} · ${fmtBytes(bytes)}</span>
        </label>${subRows}</div>`;
    }).join("");
    return `<div class="bk-tree" id="bkTree">${rows}</div>`;
  }

  function renderSelect() {
    const all = allSubjects();
    const totalFiles = all.reduce((a, s) => a + s.files.length, 0);
    if (!totalFiles) {
      body().innerHTML = `
        <h2 id="bkTitle"><i class="fa-solid fa-box-archive"></i> Copia de seguridad</h2>
        <div class="bk-center bk-muted"><i class="fa-solid fa-folder-open bk-big"></i>
          <p>Aún no hay archivos subidos para respaldar.</p></div>
        <div class="modal-actions"><button class="btn-secondary" data-bk="close">Cerrar</button></div>`;
      return;
    }
    const allBytes = all.reduce((a, s) => a + s.bytes, 0);
    body().innerHTML = `
      <h2 id="bkTitle"><i class="fa-solid fa-box-archive"></i> Copia de seguridad</h2>
      <p class="bk-lead">Descarga a tu PC una copia ordenada por semestre y asignatura.
        Es de solo lectura: no se modifica ni elimina nada de lo ya subido.</p>
      <div class="bk-modes" role="radiogroup" aria-label="Qué descargar">
        ${modeCard("all", "fa-boxes-stacked", "Copia completa",
          `${plural(totalFiles, "archivo", "archivos")} · ${fmtBytes(allBytes)}`)}
        ${modeCard("sem", "fa-layer-group", "Elegir semestres", "Marca uno o varios semestres")}
        ${modeCard("sub", "fa-book", "Elegir asignaturas", "Selección puntual por materia")}
      </div>
      ${treeHTML()}
      <label class="bk-check"><input type="checkbox" id="bkSplit" ${S.split ? "checked" : ""}>
        <span>Un ZIP por semestre <small>(recomendado si el total es grande)</small></span></label>
      <div class="bk-summary" id="bkSummary"></div>
      <div class="modal-actions">
        <button class="btn-secondary" data-bk="close">Cancelar</button>
        <button class="btn-primary" data-bk="next" id="bkNext">Continuar <i class="fa-solid fa-arrow-right"></i></button>
      </div>`;
    syncSelection();
  }

  /* Actualiza checks (incl. estado intermedio), resumen y botón sin re-renderizar */
  function syncSelection() {
    if (S.view !== "select" || !modalEl) return;
    modalEl.querySelectorAll("[data-sub]").forEach(i => { i.checked = S.selected.has(i.dataset.sub); });
    modalEl.querySelectorAll("[data-sem]").forEach(i => {
      const sem  = S.tree.find(s => String(s.id) === i.dataset.sem);
      const subs = sem.subjects.filter(s => s.files.length);
      const n    = subs.filter(s => S.selected.has(s.key)).length;
      i.checked = n === subs.length;
      i.indeterminate = n > 0 && n < subs.length;
    });
    const t = totals();
    const auto = !S.split && effectiveSplit();
    const splitInput = modalEl.querySelector("#bkSplit");
    if (splitInput) { splitInput.checked = S.split || auto; splitInput.disabled = auto; }
    const big = list => list.some(p => p.subs.reduce((a, s) => a + s.bytes, 0) > MAX_ZIP_BYTES);
    const warn =
      (auto ? `<div class="bk-warn bk-info"><i class="fa-solid fa-circle-info"></i> Por el tamaño se generará un ZIP por semestre.</div>` : "") +
      (big(picked()) ? `<div class="bk-warn"><i class="fa-solid fa-triangle-exclamation"></i> Un semestre supera ${fmtBytes(MAX_ZIP_BYTES)}. Si el navegador falla por memoria, elige asignaturas.</div>` : "");
    modalEl.querySelector("#bkSummary").innerHTML = t.files
      ? `<b>${plural(t.files, "archivo", "archivos")}</b> · ${fmtBytes(t.bytes)} · ${plural(t.semesters, "semestre", "semestres")} · ${plural(t.subjects, "asignatura", "asignaturas")}${warn}`
      : `<span class="bk-muted">Nada seleccionado todavía</span>`;
    const next = modalEl.querySelector("#bkNext");
    if (next) next.disabled = !t.files;
  }

  function structurePreview(list, root) {
    const lines = [`${root}/`];
    let budget = 11;
    outer:
    for (const p of list) {
      lines.push(` ├─ ${semDirName(p.sem)}/`);
      if (--budget <= 0) break;
      for (const s of p.subs) {
        if (budget <= 0) break outer;
        lines.push(` │   ├─ ${pad2(s.order)} - ${safeName(s.name, "Asignatura")}/  (${plural(s.files.length, "archivo", "archivos")})`);
        budget--;
      }
    }
    if (budget <= 0) lines.push(" └─ …");
    lines.push(" └─ LEEME.txt · INDICE.csv");
    return lines.join("\n");
  }

  function renderConfirm() {
    const list = picked();
    const t = totals(list);
    const split = effectiveSplit();
    const zips = split ? t.semesters : 1;
    const root = `${ROOT_PREFIX}_${today()}`;
    body().innerHTML = `
      <h2 id="bkTitle"><i class="fa-solid fa-circle-question"></i> ¿Descargar esta copia?</h2>
      <ul class="bk-confirm">
        <li><i class="fa-solid fa-bullseye"></i><span><b>Alcance:</b> ${esc(scopeLabel())}</span></li>
        <li><i class="fa-solid fa-file-lines"></i><span><b>Contenido:</b> ${plural(t.files, "archivo", "archivos")} · ${fmtBytes(t.bytes)}</span></li>
        <li><i class="fa-solid fa-file-zipper"></i><span><b>Formato:</b> ${zips === 1 ? "1 archivo ZIP" : `${zips} archivos ZIP (uno por semestre)`}</span></li>
      </ul>
      <pre class="bk-preview">${esc(structurePreview(list, root))}</pre>
      <p class="bk-note"><i class="fa-solid fa-circle-info"></i>
        Mantén esta pestaña abierta hasta que termine.${zips > 1 ? " Tu navegador puede pedir permiso para descargar varios archivos." : ""}</p>
      <div class="modal-actions">
        <button class="btn-secondary" data-bk="back"><i class="fa-solid fa-arrow-left"></i> Volver</button>
        <button class="btn-primary" data-bk="go"><i class="fa-solid fa-download"></i> Descargar ahora</button>
      </div>`;
  }

  function renderRunning() {
    body().innerHTML = `
      <h2 id="bkTitle"><i class="fa-solid fa-spinner fa-spin"></i> Preparando tu copia…</h2>
      <div class="bk-bar"><div class="bk-bar-fill" id="bkFill"></div></div>
      <div class="bk-prog-line"><span id="bkCount"></span><span id="bkPct"></span></div>
      <p class="bk-muted bk-phase" id="bkPhase"></p>
      <p class="bk-muted bk-current" id="bkCurrent"></p>
      <div class="modal-actions"><button class="btn-secondary" data-bk="cancel">Cancelar</button></div>`;
    paintProgress();
  }

  function paintProgress() {
    if (S.view !== "running" || !modalEl) return;
    const p = S.progress;
    const pct = p.total ? Math.min(100, Math.round((p.files / p.total) * 100)) : 0;
    const set = (id, v, prop = "textContent") => { const el = modalEl.querySelector(id); if (el) el[prop] = v; };
    const fill = modalEl.querySelector("#bkFill");
    if (fill) fill.style.width = pct + "%";
    set("#bkCount", `${p.files} / ${p.total} archivos`);
    set("#bkPct", pct + "%");
    set("#bkPhase", p.phase);
    set("#bkCurrent", p.current);
  }

  function renderDone() {
    const r = S.result || {};
    const errs = r.errors || [];
    let icon = "fa-circle-check", title = "Copia lista", msg;
    if (r.fatal) {
      icon = "fa-circle-xmark"; title = "Se interrumpió";
      msg = `Ocurrió un error: ${esc(r.fatal)}`;
    } else if (r.cancelled) {
      icon = "fa-ban"; title = "Cancelado";
      msg = r.zips ? `Se alcanzó a descargar ${plural(r.zips, "ZIP", "ZIPs")}.` : "No se descargó nada.";
    } else {
      msg = `${plural(r.zips, "ZIP descargado", "ZIPs descargados")} con ${plural(r.files, "archivo", "archivos")}. Búscalo en tu carpeta de Descargas.`;
    }
    const list = errs.length ? `
      <div class="bk-warn"><i class="fa-solid fa-triangle-exclamation"></i>
        ${plural(errs.length, "archivo no se pudo descargar", "archivos no se pudieron descargar")} (detalle en ERRORES.txt dentro del ZIP).
        <ul class="bk-errlist">${errs.slice(0, 6).map(e => `<li>${esc(e.path.split("/").pop())}</li>`).join("")}
        ${errs.length > 6 ? `<li>…y ${errs.length - 6} más</li>` : ""}</ul></div>` : "";
    body().innerHTML = `
      <h2 id="bkTitle"><i class="fa-solid ${icon}"></i> ${title}</h2>
      <p class="bk-center bk-muted">${msg}</p>${list}
      <div class="modal-actions">
        <button class="btn-secondary" data-bk="again">Hacer otra copia</button>
        <button class="btn-primary" data-bk="close">Cerrar</button>
      </div>`;
  }

  /* ============================================================ API */
  async function open() {
    if (!(await ensureJSZip())) {
      toast("No se pudo cargar JSZip. Sube assets/js/vendor/jszip.min.js o revisa tu conexión.", "err"); return;
    }
    if (!auth.currentUser) { toast("Inicia sesión para crear una copia.", "info"); return; }
    ensureModal().classList.add("open");
    if (S.view === "running") { render(); return; }      // reabrir durante una descarga
    S.view = "loading"; S.result = null; S.mode = "all"; S.split = false; S.selected.clear();
    render();
    try {
      S.tree = await loadTree();
      setMode("all");
      S.view = "select";
    } catch (err) {
      console.error("Backup.loadTree:", err);
      S.result = { fatal: err?.code === "permission-denied"
        ? "Tu cuenta no tiene permiso para leer estos archivos."
        : (err?.message || String(err)) };
      S.view = "error";
    }
    render();
  }

  function close() {
    if (S.view === "running") return;
    modalEl?.classList.remove("open");
  }

  function init() {
    document.getElementById("btnBackup")?.addEventListener("click", () => {
      if (typeof App !== "undefined" && App.closeSidebar) App.closeSidebar();
      open();
    });
  }
  init();

  return { open, close, _t: { ensureJSZip, JSZIP_SOURCES, safeName, safeFileName, buildPlan, loadTree, fmtBytes, S } };
})();
