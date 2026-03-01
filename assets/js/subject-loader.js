/* =====================================================
   SUBJECT LOADER — Carga dinámica de contenido
   para las páginas plantilla (_template).
   Lee ?subject= y ?sem= de la URL, configura títulos,
   enlaces de módulos y la barra lateral.
===================================================== */

(function () {

    const params = new URLSearchParams(location.search);
    const subjectName = params.get('subject');
    const semNum = params.get('sem') || '1';

    // Si no hay materia, redirigir al semestre
    if (!subjectName) {
        location.href = '../../../semestre' + semNum + '.html';
        return;
    }

    const currentPage = location.pathname.split('/').pop() || 'index.html';

    // ===== Título del documento =====
    const pageTitles = {
        'index.html': subjectName + ' — Portal Física UNAL',
        'notes.html': 'Bloc de Notas — ' + subjectName,
        'files.html': 'Repositorio — ' + subjectName,
        'backups.html': 'Backups — ' + subjectName
    };
    document.title = pageTitles[currentPage] || subjectName;

    // ===== Encabezado h1 =====
    var h1 = document.getElementById('subjectTitle');
    if (h1) {
        var h1Texts = {
            'index.html': subjectName.toUpperCase(),
            'notes.html': 'BLOC DE NOTAS — ' + subjectName.toUpperCase(),
            'files.html': 'REPOSITORIO DE ARCHIVOS',
            'backups.html': 'BACKUPS ACADÉMICOS'
        };
        h1.textContent = h1Texts[currentPage] || subjectName.toUpperCase();
    }

    // ===== Nombre de la materia (tarjeta info en notes) =====
    var nameDisplay = document.getElementById('subjectNameDisplay');
    if (nameDisplay) nameDisplay.textContent = subjectName;

    // ===== Enlaces de módulos (página index) =====
    var qs = '?subject=' + encodeURIComponent(subjectName) + '&sem=' + semNum;
    var linkFiles = document.getElementById('linkFiles');
    var linkNotes = document.getElementById('linkNotes');
    var linkBackups = document.getElementById('linkBackups');
    if (linkFiles) linkFiles.href = 'files.html' + qs;
    if (linkNotes) linkNotes.href = 'notes.html' + qs;
    if (linkBackups) linkBackups.href = 'backups.html' + qs;

    // ===== Barra lateral =====
    var sidebarMenu = document.getElementById('sidebarMenu');
    if (!sidebarMenu) return;

    if (currentPage === 'index.html') {
        buildSemesterSidebar(sidebarMenu, semNum);
    } else {
        buildInternalSidebar(sidebarMenu, subjectName, semNum, currentPage);
    }

    // ----- Sidebar: navegación por semestres -----
    function buildSemesterSidebar(menu, sem) {
        var semesters = [
            { n: 1,  icon: 'fa-solid fa-atom',             label: 'Semestre I — Fundamentos' },
            { n: 2,  icon: 'fa-solid fa-wave-square',      label: 'Semestre II — Ondas y Cálculo' },
            { n: 3,  icon: 'fa-solid fa-bolt',             label: 'Semestre III — Electromagnetismo' },
            { n: 4,  icon: 'fa-solid fa-gears',            label: 'Semestre IV — Mecánica' },
            { n: 5,  icon: 'fa-solid fa-shuffle',          label: 'Semestre V — Cuántica' },
            { n: 6,  icon: 'fa-solid fa-chart-line',       label: 'Semestre VI — Física Estadística' },
            { n: 7,  icon: 'fa-solid fa-clock',            label: 'Semestre VII — Relatividad' },
            { n: 8,  icon: 'fa-solid fa-burst',            label: 'Semestre VIII — Partículas' },
            { n: 9,  icon: 'fa-solid fa-star',             label: 'Semestre IX — Cosmología' },
            { n: 10, icon: 'fa-solid fa-flask-vial',       label: 'Semestre X — Investigación' }
        ];

        var html = '<li><a href="../../../index.html"><i class="fa-solid fa-satellite-dish"></i> Centro de Control</a></li>';
        semesters.forEach(function (s) {
            var active = s.n == sem ? ' class="active"' : '';
            html += '<li' + active + '><a href="../../../semestre' + s.n + '.html"><i class="' + s.icon + '"></i> ' + s.label + '</a></li>';
        });
        menu.innerHTML = html;
    }

    // ----- Sidebar: navegación interna de la materia -----
    function buildInternalSidebar(menu, name, sem, page) {
        var linkQs = '?subject=' + encodeURIComponent(name) + '&sem=' + sem;
        var items = [
            { href: '../../../semestre' + sem + '.html', icon: 'fa-solid fa-arrow-left', label: 'Volver al semestre', id: '' },
            { href: 'index.html' + linkQs,              icon: 'fa-solid fa-house',      label: 'Inicio',      id: '' },
            { href: 'notes.html' + linkQs,              icon: 'fa-solid fa-book',       label: 'Bloc de notas',       id: 'notes.html' },
            { href: 'files.html' + linkQs,              icon: 'fa-solid fa-folder',     label: 'Repositorio',         id: 'files.html' },
            { href: 'backups.html' + linkQs,            icon: 'fa-solid fa-database',   label: 'Backups',             id: 'backups.html' }
        ];

        var html = '';
        items.forEach(function (item) {
            var active = item.id === page ? ' class="active"' : '';
            html += '<li' + active + '><a href="' + item.href + '"><i class="' + item.icon + '"></i> ' + item.label + '</a></li>';
        });
        menu.innerHTML = html;
    }

})();
