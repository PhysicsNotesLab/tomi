/* =====================================================
   SEMESTER APP — CRUD de materias por semestre
   Carga materias desde Firestore, permite agregar,
   editar y eliminar. Siembra datos iniciales desde
   las tarjetas hardcoded en el HTML al primer uso.
===================================================== */

(function () {

    // ===== Detectar semestre desde la URL =====
    const semMatch = location.pathname.match(/semestre(\d+)/);
    if (!semMatch) return;
    const semNum = parseInt(semMatch[1]);

    const grid = document.querySelector('.subjects-grid');
    if (!grid) return;

    let subjects = [];
    let editingId = null;

    // ===== Iconos disponibles para el selector =====
    const ICON_OPTIONS = [
        { value: 'fa-solid fa-book', label: '📖 Libro' },
        { value: 'fa-solid fa-atom', label: '⚛️ Átomo' },
        { value: 'fa-solid fa-flask', label: '🧪 Laboratorio' },
        { value: 'fa-solid fa-flask-vial', label: '🧬 Experimento' },
        { value: 'fa-solid fa-calculator', label: '🧮 Calculadora' },
        { value: 'fa-solid fa-code', label: '💻 Código' },
        { value: 'fa-solid fa-wave-square', label: '〰️ Ondas' },
        { value: 'fa-solid fa-bolt', label: '⚡ Electricidad' },
        { value: 'fa-solid fa-magnet', label: '🧲 Magnetismo' },
        { value: 'fa-solid fa-gears', label: '⚙️ Mecánica' },
        { value: 'fa-solid fa-infinity', label: '∞ Infinito' },
        { value: 'fa-solid fa-square-root-variable', label: '√ Matemáticas' },
        { value: 'fa-solid fa-superscript', label: 'x² Superíndice' },
        { value: 'fa-solid fa-chart-line', label: '📈 Estadística' },
        { value: 'fa-solid fa-chart-bar', label: '📊 Gráficos' },
        { value: 'fa-solid fa-language', label: '🌐 Idiomas' },
        { value: 'fa-solid fa-brain', label: '🧠 Ciencia' },
        { value: 'fa-solid fa-vector-square', label: '📐 Vectores' },
        { value: 'fa-solid fa-ruler-combined', label: '📏 Mediciones' },
        { value: 'fa-solid fa-apple-whole', label: '🍎 Newton' },
        { value: 'fa-solid fa-arrows-spin', label: '🔄 Rotación' },
        { value: 'fa-solid fa-book-open', label: '📕 Humanidades' },
        { value: 'fa-solid fa-clock', label: '⏰ Tiempo' },
        { value: 'fa-solid fa-star', label: '⭐ Estrella' },
        { value: 'fa-solid fa-burst', label: '💥 Partículas' },
        { value: 'fa-solid fa-graduation-cap', label: '🎓 Graduación' },
        { value: 'fa-solid fa-shuffle', label: '🔀 Cuántica' },
        { value: 'fa-solid fa-microscope', label: '🔬 Microscopio' },
        { value: 'fa-solid fa-earth-americas', label: '🌎 Geofísica' },
        { value: 'fa-solid fa-fire', label: '🔥 Termodinámica' },
        { value: 'fa-solid fa-music', label: '🎵 Acústica' },
        { value: 'fa-solid fa-eye', label: '👁️ Óptica' },
        { value: 'fa-solid fa-satellite-dish', label: '📡 Señales' },
        { value: 'fa-solid fa-database', label: '🗄️ Datos' },
        { value: 'fa-solid fa-folder', label: '📁 Carpeta' },
        { value: 'fa-solid fa-user', label: '👤 Usuario' }
    ];

    // ===== Extraer datos iniciales del HTML hardcoded =====
    function extractDefaults() {
        const cards = grid.querySelectorAll('.subject-card');
        return Array.from(cards).map((card, i) => ({
            name: card.querySelector('h3')?.textContent?.trim() || 'Materia',
            icon: card.querySelector('i')?.className || 'fa-solid fa-book',
            subtitle: card.querySelector('span')?.textContent?.trim() || '',
            credits: 4,
            order: i
        }));
    }

    // ===== Actualizar total de créditos en el header =====
    function updateCreditsHeader() {
        const el = document.getElementById('semesterCredits');
        if (!el) return;
        const total = subjects.reduce((sum, s) => sum + (parseInt(s.credits) || 0), 0);
        el.textContent = 'Portal personal — Carrera de Física (' + total + ' créditos)';
    }

    // ===== Renderizar la cuadrícula de materias =====
    function render() {
        grid.innerHTML = '';

        subjects.sort((a, b) => (a.order || 0) - (b.order || 0));

        subjects.forEach(sub => {
            const card = document.createElement('a');
            card.href = 'assets/subjects/_template/index.html?subject='
                + encodeURIComponent(sub.name) + '&sem=' + semNum;
            card.className = 'subject-card';
            card.innerHTML = `
                <i class="${sub.icon}"></i>
                <h3>${sub.name}</h3>
                <span>${sub.subtitle}</span>
                <div class="card-actions">
                    <button class="card-btn card-edit" title="Editar materia">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="card-btn card-delete" title="Eliminar materia">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `;

            card.querySelector('.card-edit').addEventListener('click', e => {
                e.preventDefault();
                e.stopPropagation();
                openModal(sub);
            });

            card.querySelector('.card-delete').addEventListener('click', e => {
                e.preventDefault();
                e.stopPropagation();
                deleteSubject(sub);
            });

            grid.appendChild(card);
        });

        // Tarjeta "Agregar materia"
        const addCard = document.createElement('div');
        addCard.className = 'subject-card add-card';
        addCard.innerHTML = '<i class="fa-solid fa-plus"></i><h3>Agregar materia</h3><span>Nueva asignatura</span>';
        addCard.style.cursor = 'pointer';
        addCard.addEventListener('click', () => openModal(null));
        grid.appendChild(addCard);

        // Actualizar total de créditos en el header
        updateCreditsHeader();
    }

    // ===== Modal: abrir =====
    function openModal(subject) {
        editingId = subject ? subject.id : null;
        document.getElementById('modalTitle').textContent = subject ? 'Editar materia' : 'Nueva materia';
        document.getElementById('subjectName').value = subject ? subject.name : '';
        document.getElementById('subjectSubtitle').value = subject ? (subject.subtitle || '') : '';
        document.getElementById('subjectCredits').value = subject ? (subject.credits || 4) : 4;
        document.getElementById('subjectIcon').value = subject ? subject.icon : 'fa-solid fa-book';
        // Actualizar preview
        updateIconPreview();
        document.getElementById('subjectModal').classList.add('open');
    }

    // ===== Modal: cerrar =====
    function closeModal() {
        document.getElementById('subjectModal').classList.remove('open');
        editingId = null;
    }

    // ===== Preview del icono seleccionado =====
    function updateIconPreview() {
        const preview = document.getElementById('iconPreview');
        const select = document.getElementById('subjectIcon');
        if (preview && select) {
            preview.className = select.value;
        }
    }

    // ===== Guardar materia (crear o actualizar) =====
    async function saveSubject() {
        const name = document.getElementById('subjectName').value.trim();
        if (!name) {
            alert('El nombre de la materia es obligatorio');
            return;
        }

        const data = {
            name,
            icon: document.getElementById('subjectIcon').value,
            subtitle: document.getElementById('subjectSubtitle').value.trim(),
            credits: parseInt(document.getElementById('subjectCredits').value) || 4,
            order: editingId
                ? (subjects.find(s => s.id === editingId)?.order || subjects.length)
                : subjects.length
        };

        const saveBtn = document.getElementById('modalSave');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Guardando...';

        try {
            if (editingId) {
                await FireDB.updateSemesterSubject(semNum, editingId, data);
            } else {
                await FireDB.addSemesterSubject(semNum, data);
            }
            await load();
            closeModal();
        } catch (err) {
            console.error('Error guardando materia:', err);
            alert('Error al guardar. Intenta de nuevo.');
        }

        saveBtn.disabled = false;
        saveBtn.textContent = 'Guardar';
    }

    // ===== Eliminar materia =====
    async function deleteSubject(subject) {
        if (!confirm('¿Eliminar "' + subject.name + '" del semestre?\n\nLas notas y archivos de la materia se conservan en Firebase.')) return;
        try {
            await FireDB.deleteSemesterSubject(semNum, subject.id);
            await load();
        } catch (err) {
            console.error('Error eliminando materia:', err);
            alert('Error al eliminar.');
        }
    }

    // ===== Cargar desde Firestore (o sembrar defaults) =====
    async function load() {
        try {
            subjects = await FireDB.getSemesterSubjects(semNum);
            if (subjects.length === 0) {
                // Primera vez: sembrar desde el HTML hardcoded
                const defaults = extractDefaults();
                if (defaults.length > 0) {
                    await FireDB.seedSemesterSubjects(semNum, defaults);
                    subjects = await FireDB.getSemesterSubjects(semNum);
                }
            }
            render();
        } catch (err) {
            console.error('Error cargando materias del semestre:', err);
        }
    }

    // ===== Crear el modal en el DOM =====
    function createModalDOM() {
        const iconOptions = ICON_OPTIONS.map(opt =>
            '<option value="' + opt.value + '">' + opt.label + '</option>'
        ).join('');

        const modal = document.createElement('div');
        modal.id = 'subjectModal';
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <h2 id="modalTitle">Nueva materia</h2>

                <label for="subjectName">Nombre de la materia</label>
                <input type="text" id="subjectName" placeholder="Ej: Cálculo diferencial" maxlength="100"/>

                <label for="subjectSubtitle">Descripción corta</label>
                <input type="text" id="subjectSubtitle" placeholder="Ej: Análisis matemático" maxlength="60"/>

                <label for="subjectCredits">Créditos</label>
                <input type="number" id="subjectCredits" value="4" min="1" max="20"/>

                <label for="subjectIcon">Icono</label>
                <div class="icon-selector">
                    <i id="iconPreview" class="fa-solid fa-book"></i>
                    <select id="subjectIcon">${iconOptions}</select>
                </div>

                <div class="modal-actions">
                    <button id="modalSave" class="btn-primary">
                        <i class="fa-solid fa-floppy-disk"></i> Guardar
                    </button>
                    <button id="modalCancel" class="btn-secondary">
                        Cancelar
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('modalSave').addEventListener('click', saveSubject);
        document.getElementById('modalCancel').addEventListener('click', closeModal);
        document.getElementById('subjectIcon').addEventListener('change', updateIconPreview);

        // Cerrar al clicar fuera del modal
        modal.addEventListener('click', e => {
            if (e.target === modal) closeModal();
        });

        // Cerrar con Escape
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') closeModal();
        });
    }

    // ===== Inicializar =====
    createModalDOM();
    FireDB.ready.then(load);

})();
