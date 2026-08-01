let currentUserRole = null;
let currentUserName = null;
let currentInstructor = null;
let currentStudentGroup = null;
let currentStudentSection = '';
let currentSection = '';
let currentMaxScore = 1000;
let studentRatings = {};
let studentCurrentGroup = null;
let studentGroupStatus = {};

async function loadSectionDropdown() {
    if (!currentInstructor) return;
    const sel = document.getElementById('sectionSelect');
    if (!sel) return;
    const prevVal = sel.value || currentSection;
    try {
        const data = await Api.getSections(currentInstructor);
        sel.innerHTML = '';
        if (data.status === 'success') {
            data.sections.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.section_name;
                opt.textContent = s.section_name;
                sel.appendChild(opt);
            });
            if (prevVal && [...sel.options].some(o => o.value === prevVal)) {
                sel.value = prevVal;
            }
        }
    } catch (e) {
        console.error('loadSectionDropdown error:', e);
        showToast('Failed to load sections. Check database connection.', 'error');
    }
}

async function onSectionSelect() {
    const sel = document.getElementById('sectionSelect');
    const sec = sel ? sel.value : '';
    currentSection = sec;
    if (sec) {
        try {
            const data = await Api.getSectionConfig(currentInstructor, sec);
            if (data.status === 'success') currentMaxScore = data.max_score || 1000;
        } catch (e) {
            console.error('onSectionSelect config error:', e);
        }
    } else {
        currentMaxScore = 1000;
    }
    sessionStorage.setItem('currentSection_' + currentInstructor, sec);
    reloadCurrentView();
}

const debouncedAddSection = debounce(() => {
    addNewSection();
}, 800);

const debouncedSaveSectionRow = (oldName) => {
    const _debounceMap = window._sectionSaveDebounce || (window._sectionSaveDebounce = debounceByKey(600));
    _debounceMap(oldName, () => saveSectionRow(oldName));
};

async function addNewSection() {
    const name = document.getElementById('newSectionInput').value.trim().toUpperCase();
    if (!name) { showToast('Enter a section name', 'error'); return; }
    const maxSc = parseInt(document.getElementById('newSectionMaxInput').value) || 1000;
    try {
        const data = await Api.saveSectionConfig(currentInstructor, name, '', maxSc);
        if (data.status === 'success') {
            showToast('Section "' + name + '" created', 'success');
            document.getElementById('newSectionInput').value = '';
            document.getElementById('newSectionMaxInput').value = '1000';
            currentSection = name;
            currentMaxScore = maxSc;
            sessionStorage.setItem('currentSection_' + currentInstructor, name);
            await loadSectionDropdown();
            const sel = document.getElementById('sectionSelect');
            if (sel) sel.value = name;
            loadSectionsManagement();
            reloadCurrentView();
        } else {
            showToast(data.message || 'Error creating section', 'error');
        }
    } catch (e) {
        showToast('Network error', 'error');
    }
}

function reloadCurrentView() {
    const active = document.querySelector('.content-section.active');
    if (!active) return;
    const id = active.id.replace('Section', '');
    if (id === 'studentList') loadStudentRatingsTable();
    else if (id === 'raterList') loadRaterList();
    else if (id === 'groupResults') loadAdminGroupResults();
    else if (id === 'sections') loadSectionsManagement();
}

async function restoreSectionState() {
    const saved = sessionStorage.getItem('currentSection_' + currentInstructor);
    currentSection = saved || '';
    await loadSectionDropdown();
    if (currentSection) {
        const sel = document.getElementById('sectionSelect');
        if (sel && [...sel.options].some(o => o.value === currentSection)) {
            sel.value = currentSection;
        }
        try {
            const data = await Api.getSectionConfig(currentInstructor, currentSection);
            if (data.status === 'success') {
                currentMaxScore = data.max_score || 1000;
            }
        } catch (e) {
            console.error('restoreSectionState config error:', e);
        }
        reloadCurrentView();
    }
}

const RUBRIC_CRITERIA = [
    { id: 'content_accuracy', name: 'Content Accuracy', maxScore: 4 },
    { id: 'understanding_topic', name: 'Understanding of Topic', maxScore: 4 },
    { id: 'organization_structure', name: 'Organization & Structure', maxScore: 4 },
    { id: 'delivery_communication', name: 'Delivery & Communication', maxScore: 4 },
    { id: 'audience_engagement', name: 'Audience Engagement', maxScore: 4 },
    { id: 'visual_aids', name: 'Visual Aids/Materials', maxScore: 4 },
    { id: 'professional_appearance', name: 'Professional Appearance', maxScore: 4 },
    { id: 'teamwork_collaboration', name: 'Teamwork/Collaboration', maxScore: 4 },
    { id: 'time_allocation', name: 'Time Allocation: 30 mins', maxScore: 4 },
    { id: 'strategies', name: 'Strategies & Enjoyment', maxScore: 4 }
];

const GROUPS = ['GROUP 1','GROUP 2','GROUP 3','GROUP 4','GROUP 5','GROUP 6','GROUP 7','GROUP 8','GROUP 9','GROUP 10'];

// ========== INIT ==========
window.addEventListener('DOMContentLoaded', function() {
    initAuth();
});

function initAuth() {
    const savedRole = sessionStorage.getItem('userRole');
    const savedName = sessionStorage.getItem('userName');
    const savedInstructor = sessionStorage.getItem('instructorName');
    const savedGroup = sessionStorage.getItem('studentGroup');

    if (savedRole && savedName) {
        currentUserRole = savedRole;
        currentUserName = savedName;
        currentInstructor = savedInstructor || savedName;
        currentStudentGroup = savedGroup;
        currentStudentSection = sessionStorage.getItem('studentSection') || '';

        if (currentUserRole === 'student') {
            showStudentDashboard();
        } else {
            showInstructorDashboard();
        }
    } else {
        document.getElementById('authContainer').style.display = 'flex';
        document.getElementById('signupContainer').style.display = 'none';
    }
}

function toggleStudentNameField() {
    const role = document.getElementById('loginRole').value;
    document.getElementById('instructorFields').style.display = role === 'instructor' ? 'block' : 'none';
    document.getElementById('studentFields').style.display = role === 'student' ? 'block' : 'none';
    if (role === 'student') loadStudentSections();
}

async function loadStudentSections() {
    try {
        const data = await Api.getAllSections();
        const sel = document.getElementById('loginStudentSection');
        if (!sel) return;
        sel.innerHTML = '<option value="">-- Select Section --</option>';
        if (data.status === 'success' && data.sections) {
            data.sections.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s;
                opt.textContent = s;
                sel.appendChild(opt);
            });
        }
    } catch (e) {
        console.error('loadStudentSections error:', e);
        showToast('Failed to load sections. Check database connection.', 'error');
    }
}

function showLogin(e) {
    if (e) e.preventDefault();
    document.getElementById('signupContainer').style.display = 'none';
    document.getElementById('authContainer').style.display = 'flex';
}

function showSignup(e) {
    if (e) e.preventDefault();
    document.getElementById('authContainer').style.display = 'none';
    document.getElementById('signupContainer').style.display = 'flex';
}

// ========== AUTH HANDLERS ==========
async function handleLogin(e) {
    e.preventDefault();
    const role = document.getElementById('loginRole').value;

    if (role === 'instructor') {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value.trim();

        if (!username || !password) {
            showToast('Please fill in all fields', 'error');
            return;
        }

        try {
            const data = await Api.login(username, password);

            if (data.status === 'success') {
                sessionStorage.setItem('userRole', 'instructor');
                sessionStorage.setItem('userName', data.name);
                sessionStorage.setItem('instructorName', data.name);
                sessionStorage.setItem('accountUsername', username);
                sessionStorage.setItem('accountPassword', password);
                currentUserRole = 'instructor';
                currentUserName = data.name;
                currentInstructor = data.name;
                showToast('Login successful!', 'success');
                showInstructorDashboard();
            } else {
                showToast(data.message, 'error');
            }
        } catch (err) {
            console.error('Login error:', err.message, err);
            showToast('Error: ' + err.message, 'error');
        }
    } else {
        const name = document.getElementById('loginStudentName').value.trim();
        const section = document.getElementById('loginStudentSection').value;
        if (!name) { showToast('Please enter your name', 'error'); return; }
        if (!section) { showToast('Please select your section', 'error'); return; }

        try {
            const data = await Api.studentLogin(name, section);

            if (data.status === 'success') {
                sessionStorage.setItem('userRole', 'student');
                sessionStorage.setItem('userName', name);
                sessionStorage.setItem('instructorName', data.instructor);
                sessionStorage.setItem('studentGroup', data.group);
                sessionStorage.setItem('studentSection', data.section || '');
                currentUserRole = 'student';
                currentUserName = name.toUpperCase();
                currentInstructor = data.instructor;
                currentStudentGroup = data.group;
                currentStudentSection = data.section || '';
                showToast('Welcome ' + name + '!', 'success');
                showStudentDashboard();
            } else {
                showToast(data.message, 'error');
            }
        } catch (err) {
            console.error('Student login error:', err.message, err);
            showToast('Error: ' + err.message, 'error');
        }
    }
}

async function handleSignup(e) {
    e.preventDefault();
    const name = document.getElementById('signupName').value.trim();
    const username = document.getElementById('signupUsername').value.trim();
    const password = document.getElementById('signupPassword').value.trim();

    if (!name || !username || !password) { showToast('Please fill in all fields', 'error'); return; }

    try {
        const data = await Api.signup(name, username, password);

        if (data.status === 'success') {
            showToast('Account created! Awaiting instructor approval.', 'success');
            showLogin();
            document.getElementById('loginRole').value = 'instructor';
            toggleStudentNameField();
            document.getElementById('loginUsername').value = username;
        } else {
            showToast(data.message, 'error');
        }
    } catch (err) {
        console.error('Signup error:', err);
        showToast('Network error. Please try again.', 'error');
    }
}

// ========== DASHBOARDS ==========
function showStudentDashboard() {
    document.getElementById('authContainer').style.display = 'none';
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('studentDashboard').style.display = 'block';
    document.getElementById('studentProfileName').textContent = currentUserName;
    initStudentDashboard();
}

function showInstructorDashboard() {
    document.getElementById('authContainer').style.display = 'none';
    document.getElementById('studentDashboard').style.display = 'none';
    document.getElementById('dashboard').style.display = 'flex';
    document.getElementById('headerUserName').textContent = currentUserName;
    document.getElementById('accountName').textContent = currentUserName;
    document.getElementById('accountUsernameView').textContent = sessionStorage.getItem('accountUsername') || '';
    document.getElementById('dropdownUserName').textContent = currentUserName;
    restoreSectionState();
    showSection('account', document.querySelector('.nav-link[data-section="account"]'), { preventDefault: () => {}, stopPropagation: () => {} });
}

// ========== SIDEBAR TOGGLE ==========
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('show');
    } else {
        sidebar.classList.toggle('collapsed');
    }
}

function toggleDropdown(event) {
    event.stopPropagation();
    document.getElementById('profileDropdown').classList.toggle('show');
}

document.addEventListener('click', function(e) {
    if (!e.target.closest('#profileDropdownContainer')) {
        document.getElementById('profileDropdown').classList.remove('show');
    }
});

// ========== SECTIONS ==========
function showSection(section, el, e) {
    if (e && e.preventDefault) e.preventDefault();
    if (e && e.stopPropagation) e.stopPropagation();

    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    const sectionEl = document.getElementById(section + 'Section');
    if (sectionEl) sectionEl.classList.add('active');

    const titles = { account: 'ACCOUNT', studentList: 'STUDENT LIST', raterList: 'RATER LIST', groupResults: 'GROUP RESULTS', sections: 'SECTIONS' };
    document.getElementById('sectionTitle').textContent = titles[section] || section.toUpperCase();

    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    if (el) el.classList.add('active');

    if (section === 'studentList') loadStudentRatingsTable();
    if (section === 'raterList') loadRaterList();
    if (section === 'groupResults') loadAdminGroupResults();
    if (section === 'sections') loadSectionsManagement();
 
    if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebarOverlay').classList.remove('show');
    }
}

// ========== STUDENT DASHBOARD (GROUP CARDS) ==========
async function initStudentDashboard() {
    document.getElementById('studentGroupsView').style.display = 'block';
    document.getElementById('studentRatingView').style.display = 'none';
    studentCurrentGroup = null;

    try {
        const data = await Api.getMyRatings(currentUserName, currentStudentSection);
        studentRatings = data.status === 'success' ? data.ratings : {};
    } catch (e) {
        studentRatings = {};
    }

    try {
        const data = await Api.getGroupStatus(currentInstructor, currentStudentSection);
        studentGroupStatus = data.status === 'success' ? data.groups : {};
    } catch (e) {
        studentGroupStatus = {};
    }

    renderStudentGroups();
}

function renderStudentGroups() {
    const container = document.getElementById('studentGroupsGrid');
    container.innerHTML = '';
    container.style.display = 'grid';

    GROUPS.forEach((gn) => {
        let hasRated = false;
        let displayScore = 0;
        const rating = studentRatings[gn];
        if (rating && rating.total_score > 0) {
            hasRated = true;
            displayScore = rating.total_score;
        }
        const isClosed = studentGroupStatus[gn] === 1;
        const isOwnGroup = currentStudentGroup === gn;

        const card = document.createElement('div');
        card.className = `student-group-card ${hasRated ? 'rated' : ''} ${isClosed ? 'closed' : ''} ${isOwnGroup ? 'own-group' : ''}`;

        let statusHtml = '';
        if (isOwnGroup) {
            statusHtml = '<span class="own-group-badge"><i class="fas fa-home"></i> YOUR GROUP</span>';
        } else if (isClosed) {
            statusHtml = '<span class="closed-badge"><i class="fas fa-lock"></i> CLOSED</span>';
        } else if (hasRated) {
            statusHtml = `<span class="score-badge">${displayScore}/40</span>`;
        } else {
            statusHtml = '<span class="rate-badge-inline">RATE HERE</span>';
        }

        let btnHtml = '';
        if (isOwnGroup) {
            btnHtml = `<button class="btn btn-rate-card btn-disabled" disabled><i class="fas fa-ban"></i> Cannot Rate Own Group</button>`;
        } else if (isClosed) {
            btnHtml = `<button class="btn btn-rate-card btn-disabled" disabled><i class="fas fa-lock"></i> Group Closed</button>`;
        } else if (hasRated) {
            btnHtml = `<button class="btn btn-rate-card" onclick="openStudentGroupRating('${gn}')"><i class="fas fa-edit"></i> Update Rating</button>`;
        } else {
            btnHtml = `<button class="btn btn-rate-card" onclick="openStudentGroupRating('${gn}')"><i class="fas fa-star"></i> Rate Now</button>`;
        }

        card.innerHTML = `
            <div class="group-card-icon"><i class="fas fa-users"></i></div>
            <div class="group-card-name">${gn}</div>
            <div class="group-card-status">${statusHtml}</div>
            ${btnHtml}
        `;
        container.appendChild(card);
    });
}

function openStudentGroupRating(groupName) {
    const isClosed = studentGroupStatus[groupName] === 1;
    if (isClosed) {
        showToast('This group is closed for rating', 'error');
        return;
    }

    if (currentStudentGroup && currentStudentGroup === groupName) {
        showToast('You cannot rate your own group', 'error');
        return;
    }

    studentCurrentGroup = groupName;
    document.getElementById('studentGroupsView').style.display = 'none';
    document.getElementById('studentRatingView').style.display = 'block';
    document.getElementById('studentRatingTitle').textContent = groupName;

    const existing = studentRatings[groupName];
    document.querySelectorAll('.student-radio').forEach(r => { r.checked = false; });
    if (existing && existing.total_score > 0) {
        const criteriaFields = ['content_accuracy','understanding_topic','organization_structure','delivery_communication','audience_engagement','visual_aids','professional_appearance','teamwork_collaboration','time_allocation','strategies'];
        criteriaFields.forEach(field => {
            const val = existing[field];
            if (val && val > 0) {
                const radio = document.querySelector(`.student-radio[data-criteria="${field}"][value="${val}"]`);
                if (radio) radio.checked = true;
            }
        });
    }
    document.querySelectorAll('.radio-score').forEach(el => { el.textContent = '0'; });
    updateStudentScore();
}

function closeStudentRating() {
    studentCurrentGroup = null;
    document.getElementById('studentGroupsView').style.display = 'block';
    document.getElementById('studentRatingView').style.display = 'none';
}



function updateStudentScore() {
    let total = 0;
    document.querySelectorAll('.student-radio:checked').forEach(r => {
        const val = parseInt(r.value) || 0;
        total += val;
        const criteria = r.getAttribute('data-criteria');
        const scoreEl = document.getElementById('score_' + criteria);
        if (scoreEl) scoreEl.textContent = val;
    });
    document.getElementById('studentTotalScore').textContent = 'TOTAL SCORE: ' + total;
}

async function handleSaveStudentRating() {
    if (!studentCurrentGroup) return;

    const scores = {};
    let total = 0;
    const checkedCount = document.querySelectorAll('.student-radio:checked').length;
    if (checkedCount < 10) { showToast('Please select a score for all criteria', 'error'); return; }
    document.querySelectorAll('.student-radio:checked').forEach(r => {
        const val = parseInt(r.value) || 0;
        scores[r.getAttribute('data-criteria')] = val;
        total += val;
    });

    try {
        const data = await Api.saveGroupRating({
            rater_name: currentUserName,
            group_name: studentCurrentGroup,
            scores: scores,
            total_score: total,
            instructor: currentInstructor,
            section: currentStudentSection || ''
        });

        if (data.status === 'success') {
            showToast('Rating saved!', 'success');
            await initStudentDashboard();
        } else {
            showToast(data.message || 'Error saving rating', 'error');
        }
    } catch (err) {
        showToast('Network error', 'error');
    }
}

// ========== ADMIN: STUDENT RATINGS TABLE ==========
async function loadStudentRatingsTable() {
    try {
        const data = await Api.getStudentRatingsTable(currentInstructor, currentSection);

        if (data.status === 'success') {
            renderStudentRatingsTable(data.ratings);
        } else {
            renderStudentRatingsTable([]);
        }
    } catch (err) {
        renderStudentRatingsTable([]);
    }
}

function renderStudentRatingsTable(ratings) {
    const thead = document.getElementById('studentRatingsHead');
    const tbody = document.getElementById('studentRatingsBody');
    const tfoot = document.getElementById('studentRatingsFoot');
    const noData = document.getElementById('noStudentRatings');
    if (!thead || !tbody) return;

    let headerHtml = '<tr><th>#</th><th>NAME OF THE RATER</th>';
    for (let i = 1; i <= 10; i++) {
        headerHtml += `<th>GROUP ${i}</th>`;
    }
    headerHtml += '</tr>';
    thead.innerHTML = headerHtml;

    if (!ratings || ratings.length === 0) {
        tbody.innerHTML = '';
        if (tfoot) tfoot.innerHTML = '';
        if (noData) noData.style.display = 'block';
        return;
    }

    if (noData) noData.style.display = 'none';

    let bodyHtml = '';
    let colTotals = {};
    for (let i = 1; i <= 10; i++) colTotals['GROUP ' + i] = 0;

    ratings.forEach((r, i) => {
        bodyHtml += `<tr><td class="num-cell">${i + 1}</td><td class="name-cell"><a href="#" onclick="openStudentDetail('${r.name.replace(/'/g, "\\'")}', event)">${r.name}</a></td>`;
        for (let g = 1; g <= 10; g++) {
            const gn = 'GROUP ' + g;
            const score = r[gn];
            if (score !== null && score !== undefined) {
                bodyHtml += `<td class="score-cell"><span class="score-badge">${score}/40</span></td>`;
                colTotals[gn] += score;
            } else {
                bodyHtml += '<td class="score-cell no-score">-</td>';
            }
        }
        bodyHtml += '</tr>';
    });
    tbody.innerHTML = bodyHtml;

    if (tfoot) {
        let footHtml = '<tr class="total-row"><td></td><td class="name-cell"><strong>TOTAL</strong></td>';
        for (let g = 1; g <= 10; g++) {
            const gn = 'GROUP ' + g;
            footHtml += `<td class="score-cell"><strong>${colTotals[gn]}/${currentMaxScore}</strong></td>`;
        }
        footHtml += '</tr>';
        tfoot.innerHTML = footHtml;
    }
}

// ========== EXPORT PDF (Bond Paper Print) ==========
function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function exportStudentPDF() {
    if (!currentInstructor) { alert('No instructor selected. Select an instructor first.'); return; }
    const data = await Api.getStudentRatingsTable(currentInstructor, currentSection);
    if (data.status !== 'success') { showToast('Error loading ratings', 'error'); return; }
    const ratings = data.ratings || [];

    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Student Ratings</title>
    <style>
        @page { size: legal landscape; margin: 12mm 14mm 14mm 14mm; }
        * { box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Arial, Helvetica, sans-serif; color: #14202e; margin: 0; font-size: 10px; }
        .letterhead { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px double #0e5e2e; padding-bottom: 10px; margin-bottom: 6px; }
        .letterhead .logo { height: 58px; }
        .letterhead .brand { text-align: center; }
        .letterhead .brand h1 { margin: 0; font-size: 21px; letter-spacing: 2px; color: #0e5e2e; font-weight: 800; }
        .letterhead .brand h2 { margin: 2px 0 0; font-size: 11px; font-weight: 600; color: #334155; letter-spacing: 1px; text-transform: uppercase; }
        .letterhead .brand p { margin: 4px 0 0; font-size: 9px; color: #64748b; }
        .letterhead .date { text-align: right; font-size: 9.5px; color: #334155; line-height: 1.6; }
        .letterhead .date b { display: block; font-size: 10px; color: #14202e; }
        .meta { display: flex; justify-content: space-between; gap: 10px; background: #f0f7f2; border: 1px solid #cfe3d6; border-radius: 6px; padding: 6px 12px; margin-bottom: 10px; font-size: 10.5px; color: #1c2b3a; }
        .meta span { white-space: nowrap; }
        .meta b { color: #0e5e2e; }
        table { border-collapse: collapse; width: 100%; }
        thead { display: table-row-group; }
        tfoot { display: table-row-group; }
        tr { page-break-inside: avoid; }
        th, td { border: 1px solid #b9c6bd; padding: 5px 6px; font-size: 9.5px; text-align: center; }
        thead th { background: #0e5e2e; color: #ffffff; font-size: 9.5px; letter-spacing: 0.5px; padding: 7px 4px; }
        thead th:first-child { border-top-left-radius: 0; }
        tbody td { font-variant-numeric: tabular-nums; }
        td.name { text-align: left; font-weight: 600; color: #1c2b3a; white-space: nowrap; }
        tr.alt td { background: #f3f7f4; }
        tbody tr:hover td { background: #e6f2ea; }
        tr.total td { background: #0e5e2e; color: #ffffff; font-weight: bold; font-size: 10px; padding: 7px 6px; }
        tr.total td.name { text-align: left; }
        .signatures { display: flex; justify-content: space-between; margin-top: 34px; padding: 0 10px; }
        .sig-block { text-align: center; }
        .sig-line { display: inline-block; min-width: 220px; border-top: 1.5px solid #14202e; padding-top: 5px; font-weight: 700; font-size: 11px; letter-spacing: 0.5px; }
        .sig-label { font-size: 9.5px; color: #475569; margin-top: 3px; letter-spacing: 1px; }
        .doc-footer { text-align: center; font-size: 8.5px; color: #64748b; margin-top: 14px; }
        .table-note { font-size: 9px; color: #475569; font-style: italic; margin: 6px 2px 0; }
    </style></head><body>`;
    html += `<div class="letterhead">
        <img class="logo" src="assets/images/logo-toggle.png" alt="Logo">
        <div class="brand">
            <h1>STUDENT RATING RECORDS</h1>
        </div>
        <div class="date">Date of Issuance<br><b>${escHtml(today)}</b></div>
    </div>`;
    html += `<div class="meta">
        <span><b>INSTRUCTOR:</b> ${escHtml(currentInstructor)}</span>
        <span><b>SECTION:</b> ${escHtml(currentSection || 'N/A')}</span>
        <span><b>MAX SCORE:</b> 40 pts per group</span>
        <span><b>GROUPS:</b> 10</span>
        <span><b>RATERS:</b> ${ratings.length}</span>
    </div>`;
    html += '<table><thead><tr><th style="width:26px;">#</th><th style="text-align:left;">NAME OF THE RATER</th>';
    for (let i = 1; i <= 10; i++) html += `<th>GROUP ${i}</th>`;
    html += '</tr></thead><tbody>';

    const colTotals = {};
    for (let i = 1; i <= 10; i++) colTotals['GROUP ' + i] = 0;
    ratings.forEach((r, idx) => {
        html += `<tr class="${(idx % 2) ? 'alt' : ''}"><td>${idx + 1}</td><td class="name">${escHtml(r.name)}</td>`;
        for (let g = 1; g <= 10; g++) {
            const gn = 'GROUP ' + g;
            const score = r[gn];
            if (score !== null && score !== undefined) {
                html += `<td>${score}/40</td>`;
                colTotals[gn] += score;
            } else {
                html += '<td>&ndash;</td>';
            }
        }
        html += '</tr>';
    });
    html += '</tbody><tfoot><tr class="total"><td></td><td class="name">TOTAL SCORE PER GROUP (Max ' + currentMaxScore + ' pts)</td>';
    for (let g = 1; g <= 10; g++) html += `<td>${colTotals['GROUP ' + g]}</td>`;
    html += '</tr></tfoot></table>';
    html += `<div class="signatures">
        <div class="sig-block"><span class="sig-line">${escHtml(currentInstructor)}</span><div class="sig-label">PREPARED BY</div></div>
        <div class="sig-block"><span class="sig-line">&nbsp;</span><div class="sig-label">NOTED BY</div></div>
    </div>`;
    html += '<div class="doc-footer">This document was generated automatically by the Rubric System on ' + escHtml(today) + '.</div>';
    html += '</body></html>';

    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
    document.body.appendChild(frame);
    const fdoc = frame.contentWindow.document;
    fdoc.open();
    fdoc.write(html);
    fdoc.close();
    const doPrint = () => {
        frame.contentWindow.focus();
        frame.contentWindow.print();
        setTimeout(() => { if (frame.parentNode) frame.parentNode.removeChild(frame); }, 1500);
    };
    const imgs = fdoc.images;
    if (imgs.length) {
        let pending = imgs.length;
        for (let i = 0; i < imgs.length; i++) {
            const img = imgs[i];
            if (img.complete) { pending--; }
            else {
                img.addEventListener('load', () => { pending--; if (pending === 0) doPrint(); });
                img.addEventListener('error', () => { pending--; if (pending === 0) doPrint(); });
            }
        }
        if (pending === 0) doPrint();
    } else {
        setTimeout(doPrint, 250);
    }
}

// ========== STUDENT DETAIL MODAL ==========
const CRITERIA_LABELS = {
    content_accuracy: 'Content Accuracy',
    understanding_topic: 'Understanding of Topic',
    organization_structure: 'Organization & Structure',
    delivery_communication: 'Delivery & Communication',
    audience_engagement: 'Audience Engagement',
    visual_aids: 'Visual Aids/Materials',
    professional_appearance: 'Professional Appearance',
    teamwork_collaboration: 'Teamwork/Collaboration',
    time_allocation: 'Time Allocation: 30 mins',
    strategies: 'Strategies & Enjoyment'
};

const CRITERIA_KEYS = Object.keys(CRITERIA_LABELS);

function openStudentDetail(name, e) {
    e.preventDefault();
    document.getElementById('detailStudentName').textContent = name;
    document.getElementById('studentDetailModal').style.display = 'flex';
    document.getElementById('studentDetailContent').innerHTML = '<p style="text-align:center;color:var(--neutral-400);padding:40px;"><i class="fas fa-spinner fa-spin" style="font-size:32px;"></i></p>';
    document.getElementById('noStudentDetail').style.display = 'none';
    loadStudentDetail(name);
}

function closeStudentDetail(e) {
    if (e && e.target !== e.currentTarget) return;
    document.getElementById('studentDetailModal').style.display = 'none';
}

async function loadStudentDetail(name) {
    try {
        const data = await Api.getStudentDetail(name, currentInstructor, currentSection);
        if (data.status === 'success') {
            renderStudentDetail(data.ratings);
        } else {
            document.getElementById('studentDetailContent').innerHTML = '<p class="no-data" style="display:block;">Error loading details.</p>';
        }
    } catch (err) {
        document.getElementById('studentDetailContent').innerHTML = '<p class="no-data" style="display:block;">Network error.</p>';
    }
}

function renderStudentDetail(ratings) {
    const container = document.getElementById('studentDetailContent');
    const noData = document.getElementById('noStudentDetail');

    if (!ratings || ratings.length === 0) {
        container.innerHTML = '';
        noData.style.display = 'block';
        return;
    }
    noData.style.display = 'none';

    let html = '';
    ratings.forEach(r => {
        html += `<div class="detail-group-card">
            <div class="detail-group-header">
                <span class="detail-group-name">${r.group_name}</span>
                <span class="detail-total-score">${r.total_score}/40</span>
            </div>
            <div class="detail-group-body">`;

        CRITERIA_KEYS.forEach(key => {
            const score = parseInt(r[key]) || 0;
            html += `<div class="detail-criteria-row">
                <span class="detail-criteria-name">${CRITERIA_LABELS[key]}</span>
                <div class="detail-score-dots">`;

            for (let v = 4; v >= 1; v--) {
                const filled = score >= v;
                html += `<span class="detail-dot ${filled ? 'filled' : ''}">${v}</span>`;
            }

            html += `</div><span class="detail-score-value">${score}/4</span></div>`;
        });

        html += `</div></div>`;
    });
    container.innerHTML = html;
}

// ========== ADMIN: RATER LIST ==========
async function loadRaterList() {
    try {
        const data = await Api.getRaterList(currentInstructor, currentSection);
        if (data.status === 'success') {
            renderRaterList(data.raters);
        } else {
            renderRaterList([]);
        }
    } catch (err) {
        renderRaterList([]);
    }
}

let raterListData = [];

function renderRaterList(raters) {
    raterListData = raters || [];
    const thead = document.getElementById('raterListHead');
    const tbody = document.getElementById('raterListBody');
    const noData = document.getElementById('noRaterList');
    const searchInput = document.getElementById('raterSearchInput');
    if (!thead || !tbody) return;
    if (searchInput) searchInput.value = '';

    let headerHtml = '<tr><th>#</th><th>NAME OF THE RATER</th>';
    for (let i = 1; i <= 10; i++) {
        headerHtml += `<th>GROUP ${i}</th>`;
    }
    headerHtml += '</tr>';
    thead.innerHTML = headerHtml;

    if (!raters || raters.length === 0) {
        tbody.innerHTML = '';
        noData.style.display = 'block';
        return;
    }

    noData.style.display = 'none';
    renderRaterListRows(tbody, raters);
}

function renderRaterListRows(tbody, data) {
    let bodyHtml = '';
    data.forEach((r, i) => {
        bodyHtml += `<tr><td class="num-cell">${i + 1}</td><td class="name-cell">${r.name}</td>`;
        for (let g = 1; g <= 10; g++) {
            const voted = r['GROUP ' + g];
            if (voted) {
                bodyHtml += '<td class="rater-voted"><i class="fas fa-check-circle"></i></td>';
            } else {
                bodyHtml += '<td class="rater-missed"><i class="fas fa-times-circle"></i></td>';
            }
        }
        bodyHtml += '</tr>';
    });
    tbody.innerHTML = bodyHtml;
}

function filterRaterList() {
    const query = (document.getElementById('raterSearchInput').value || '').toLowerCase();
    const tbody = document.getElementById('raterListBody');
    const noData = document.getElementById('noRaterList');
    if (!tbody) return;

    const filtered = raterListData.filter(r => r.name.toLowerCase().includes(query));
    if (filtered.length === 0) {
        tbody.innerHTML = '';
        noData.style.display = 'block';
    } else {
        noData.style.display = 'none';
        renderRaterListRows(tbody, filtered);
    }
}

// ========== SECTIONS MANAGEMENT ==========
async function loadSectionsManagement() {
    try {
        const data = await Api.getSections(currentInstructor);
        const tbody = document.getElementById('sectionsTableBody');
        const noData = document.getElementById('noSections');
        if (!tbody) return;
        if (data.status === 'success' && data.sections && data.sections.length > 0) {
            noData.style.display = 'none';
            tbody.innerHTML = data.sections.map(s => {
                const sid = s.section_name.replace(/[^a-zA-Z0-9_-]/g, '_');
                return `<tr>
                    <td><input type="text" id="sec_name_${sid}" value="${s.section_name}" class="section-edit-input" oninput="debouncedSaveSectionRow('${s.section_name}')"></td>
                    <td><input type="number" id="sec_max_${sid}" value="${s.max_score || 1000}" class="section-edit-input" style="width:100px;" oninput="debouncedSaveSectionRow('${s.section_name}')"></td>
                    <td>
                        <button class="btn btn-danger" style="padding:4px 10px;font-size:11px;" onclick="deleteSectionRow('${s.section_name}')"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>`;
            }).join('');
        } else {
            tbody.innerHTML = '';
            noData.style.display = 'block';
        }
    } catch (e) {}
}

async function saveSectionRow(oldName) {
    const sid = oldName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const newName = document.getElementById('sec_name_' + sid).value.trim().toUpperCase();
    const maxScore = parseInt(document.getElementById('sec_max_' + sid).value) || 1000;
    if (!newName) { showToast('Section name cannot be empty', 'error'); return; }
    try {
        const data = await Api.saveSectionConfig(currentInstructor, oldName, newName, maxScore);
        if (data.status === 'success') {
            showToast('Section saved', 'success');
            if (currentSection === oldName || currentSection === newName) {
                currentSection = newName;
                currentMaxScore = maxScore;
                sessionStorage.setItem('currentSection_' + currentInstructor, newName);
            }
            loadSectionsManagement();
            loadSectionDropdown();
            reloadCurrentView();
        } else {
            showToast(data.message || 'Error saving section', 'error');
        }
    } catch (e) {
        showToast('Network error', 'error');
    }
}

async function deleteSectionRow(sectionName) {
    if (!confirm('Delete section "' + sectionName + '" and all its data? This cannot be undone.')) return;
    try {
        const data = await Api.deleteSection(currentInstructor, sectionName);
        if (data.status === 'success') {
            showToast('Section deleted', 'success');
            if (currentSection === sectionName) {
                currentSection = '';
                sessionStorage.removeItem('currentSection_' + currentInstructor);
            }
            loadSectionsManagement();
            loadSectionDropdown();
            reloadCurrentView();
        } else {
            showToast(data.message || 'Error deleting section', 'error');
        }
    } catch (e) {
        showToast('Network error', 'error');
    }
}

// ========== ADMIN: GROUP RESULTS ==========
async function loadAdminGroupResults() {
    const badge = document.getElementById('groupResultsSectionBadge');
    if (badge) badge.textContent = currentSection ? 'SECTION: ' + currentSection : '';
    try {
        const data = await Api.getGroups(currentInstructor, currentSection);

        if (data.status === 'success') {
            renderAdminGroupResults(data.groups);
        } else {
            renderAdminGroupResults({});
        }
    } catch (err) {
        renderAdminGroupResults({});
    }
}

function renderAdminGroupResults(groups) {
    const grid = document.getElementById('adminGroupResults');
    if (!grid) return;

    let html = '';
    GROUPS.forEach(gn => {
        const grp = groups[gn] || { member1_name: '', member2_name: '', member3_name: '', member4_name: '', member5_name: '', is_closed: 0, total_score: 0, num_ratings: 0 };

        const totalScore = grp.total_score;
        const numRatings = grp.num_ratings;
        const isOpen = grp.is_closed === 0;

        html += `<div class="admin-group-card">
            <div class="admin-card-header">
                <div class="admin-card-title">
                    <h4><i class="fas fa-users"></i> ${gn}</h4>
                    <span class="admin-rating-count">${numRatings} rating${numRatings !== 1 ? 's' : ''}</span>
                </div>
                <div class="admin-card-actions">
                    <span class="admin-total-score">${totalScore}/${currentMaxScore} PTS</span>
                    <button class="btn-toggle-group ${isOpen ? 'btn-open' : 'btn-closed'}" onclick="handleToggleGroupStatus('${gn}')">
                        <i class="fas fa-${isOpen ? 'unlock' : 'lock'}"></i> ${isOpen ? 'OPEN' : 'CLOSED'}
                    </button>
                </div>
            </div>
            <div class="admin-card-body">
                <label class="admin-member-label">Members (Optional)</label>
                <div class="admin-member-inputs">
                    <input type="text" class="admin-member-input" id="member1_${gn.replace(' ', '_')}" placeholder="Member 1" value="${grp.member1_name}" style="text-transform: uppercase;" oninput="debouncedSaveMembers('${gn}')">
                    <input type="text" class="admin-member-input" id="member2_${gn.replace(' ', '_')}" placeholder="Member 2" value="${grp.member2_name}" style="text-transform: uppercase;" oninput="debouncedSaveMembers('${gn}')">
                    <input type="text" class="admin-member-input" id="member3_${gn.replace(' ', '_')}" placeholder="Member 3" value="${grp.member3_name}" style="text-transform: uppercase;" oninput="debouncedSaveMembers('${gn}')">
                    <input type="text" class="admin-member-input" id="member4_${gn.replace(' ', '_')}" placeholder="Member 4" value="${grp.member4_name}" style="text-transform: uppercase;" oninput="debouncedSaveMembers('${gn}')">
                    <input type="text" class="admin-member-input" id="member5_${gn.replace(' ', '_')}" placeholder="Member 5" value="${grp.member5_name}" style="text-transform: uppercase;" oninput="debouncedSaveMembers('${gn}')">
                </div>
            </div>
        </div>`;
    });
    grid.innerHTML = html;
}

function debounce(fn, delay) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

function debounceByKey(delay) {
    const timers = {};
    return function (key, fn) {
        clearTimeout(timers[key]);
        timers[key] = setTimeout(() => { delete timers[key]; fn(); }, delay);
    };
}

const debouncedSaveMembers = debounce(async (groupName) => {
    const key = groupName.replace(' ', '_');
    const m1 = document.getElementById(`member1_${key}`).value.trim();
    const m2 = document.getElementById(`member2_${key}`).value.trim();
    const m3 = document.getElementById(`member3_${key}`).value.trim();
    const m4 = document.getElementById(`member4_${key}`).value.trim();
    const m5 = document.getElementById(`member5_${key}`).value.trim();

    try {
        const data = await Api.saveGroupMembers(currentInstructor, groupName, currentSection, m1, m2, m3, m4, m5);

        if (data.status === 'success') {
            showToast('Members saved for ' + groupName, 'success');
        } else {
            showToast(data.message || 'Error saving members', 'error');
        }
    } catch (err) {
        showToast('Network error', 'error');
    }
}, 600);

async function handleToggleGroupStatus(groupName) {
    try {
        const data = await Api.toggleGroupStatus(currentInstructor, groupName, currentSection);

        if (data.status === 'success') {
            showToast(data.message, 'success');
            loadAdminGroupResults();
        } else {
            showToast(data.message || 'Error toggling group status', 'error');
        }
    } catch (err) {
        showToast('Network error', 'error');
    }
}

// ========== PENDING ACCOUNTS ==========
function openPendingModal() {
    document.getElementById('pendingModal').style.display = 'flex';
    loadPendingAccounts();
}

function closePendingModal(e) {
    if (e && e.target !== e.currentTarget) return;
    document.getElementById('pendingModal').style.display = 'none';
}

async function loadPendingAccounts() {
    try {
        const data = await Api.getPendingAccounts();
        const tbody = document.getElementById('pendingAccountsBody');
        const table = document.getElementById('pendingAccountsTable');
        const noData = document.getElementById('noPendingAccounts');

        if (data.status === 'success' && data.accounts && data.accounts.length > 0) {
            table.style.display = 'table';
            noData.style.display = 'none';
            tbody.innerHTML = data.accounts.map(a => `
                <tr>
                    <td>${a.instructor_name}</td>
                    <td>${a.username}</td>
                    <td>
                        <button class="btn-approve" onclick="approveAccount('${a.id}')"><i class="fas fa-check"></i> Approve</button>
                        <button class="btn-delete" onclick="deletePendingAccount('${a.id}')"><i class="fas fa-trash"></i> Delete</button>
                    </td>
                </tr>
            `).join('');
        } else {
            table.style.display = 'none';
            noData.style.display = 'block';
        }
    } catch (e) {
        console.error('Error loading pending accounts:', e);
    }
}

async function approveAccount(id) {
    try {
        const data = await Api.approveAccount(id);
        if (data.status === 'success') {
            showToast(data.message, 'success');
            loadPendingAccounts();
        } else {
            showToast(data.message, 'error');
        }
    } catch (e) {
        showToast('Network error', 'error');
    }
}

async function deletePendingAccount(id) {
    if (!confirm('Delete this pending account?')) return;
    try {
        const data = await Api.deleteAccount(id);
        if (data.status === 'success') {
            showToast(data.message, 'success');
            loadPendingAccounts();
        } else {
            showToast(data.message, 'error');
        }
    } catch (e) {
        showToast('Network error', 'error');
    }
}

// ========== RESET RATINGS ==========
function handleResetRatings() {
    document.getElementById('resetConfirmName').value = '';
    document.getElementById('resetModal').style.display = 'flex';
}

function closeResetModal(e) {
    if (e && e.target !== e.currentTarget) return;
    document.getElementById('resetModal').style.display = 'none';
}

// ========== DEVELOPER DETAILS MODAL ==========
function openDeveloperModal(e) {
    if (e) e.preventDefault();
    document.getElementById('developerModal').style.display = 'flex';
}

function closeDeveloperModal(e) {
    if (e && e.target !== e.currentTarget) return;
    document.getElementById('developerModal').style.display = 'none';
}

async function confirmResetRatings() {
    const typedName = document.getElementById('resetConfirmName').value.trim().toUpperCase();
    if (!typedName) {
        showToast('Please type your full name to confirm', 'error');
        return;
    }

    try {
        const data = await Api.resetRatings(typedName, sessionStorage.getItem('accountUsername') || '');
        if (data.status === 'success') {
            showToast(data.message, 'success');
            closeResetModal();
            loadAdminGroupResults();
            loadStudentRatingsTable();
        } else {
            showToast(data.message, 'error');
        }
    } catch (e) {
        showToast('Network error', 'error');
    }
}

// ========== PASSWORD TOGGLE (Auth Forms) ==========
function toggleLoginPassword() {
    const el = document.getElementById('loginPassword');
    const icon = document.querySelector('#loginPassword').parentElement.querySelector('.btn-toggle-pass i');
    if (el.type === 'password') {
        el.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        el.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

function toggleSignupPassword() {
    const el = document.getElementById('signupPassword');
    const icon = document.querySelector('#signupPassword').parentElement.querySelector('.btn-toggle-pass i');
    if (el.type === 'password') {
        el.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        el.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

// ========== LOGOUT ==========
function handleLogout(e) {
    if (e) e.preventDefault();
    sessionStorage.clear();
    currentUserRole = null;
    currentUserName = null;
    currentInstructor = null;
    currentStudentGroup = null;
    document.getElementById('authContainer').style.display = 'flex';
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('studentDashboard').style.display = 'none';
    showToast('Logged out.', 'success');
}

// ========== PASSWORD ==========
let passwordVisible = false;

function togglePasswordVisibility() {
    passwordVisible = !passwordVisible;
    const el = document.getElementById('accountPassword');
    const icon = document.querySelector('.btn-toggle-password i');
    if (passwordVisible) {
        el.textContent = sessionStorage.getItem('accountPassword') || '********';
        el.classList.remove('password-hidden');
        el.classList.add('password-visible');
        icon.className = 'fas fa-eye-slash';
    } else {
        el.textContent = '********';
        el.classList.remove('password-visible');
        el.classList.add('password-hidden');
        icon.className = 'fas fa-eye';
    }
}

// ========== INLINE EDIT: USERNAME ==========
function startEditUsername() {
    const td = document.getElementById('accountUsernameView');
    const current = sessionStorage.getItem('accountUsername') || '';
    td.innerHTML = `<div class="inline-edit-group">
        <input type="text" id="editUsernameInput" class="inline-edit-input" value="${current}" />
        <button class="btn-inline-save" onclick="saveEditUsername()"><i class="fas fa-check"></i></button>
        <button class="btn-inline-cancel" onclick="cancelEditUsername()"><i class="fas fa-times"></i></button>
    </div>`;
    document.getElementById('editUsernameInput').focus();
}

function cancelEditUsername() {
    const td = document.getElementById('accountUsernameView');
    td.textContent = sessionStorage.getItem('accountUsername') || '';
}

async function saveEditUsername() {
    const newUsername = document.getElementById('editUsernameInput').value.trim();
    const oldUsername = sessionStorage.getItem('accountUsername');
    if (!newUsername) { showToast('Username cannot be empty', 'error'); return; }
    if (newUsername === oldUsername) { cancelEditUsername(); return; }

    try {
        const data = await Api.updateAccount('update_username', oldUsername, newUsername);
        if (data.status === 'success') {
            sessionStorage.setItem('accountUsername', newUsername);
            document.getElementById('accountUsernameView').textContent = newUsername;
            showToast('Username updated!', 'success');
        } else {
            showToast(data.message, 'error');
            cancelEditUsername();
        }
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
        cancelEditUsername();
    }
}

// ========== INLINE EDIT: PASSWORD ==========
function startEditPassword() {
    const td = document.querySelector('#passwordRow td:nth-child(2)');
    td.innerHTML = `<div class="inline-edit-group">
        <input type="text" id="editPasswordInput" class="inline-edit-input" placeholder="New password" />
        <button class="btn-inline-save" onclick="saveEditPassword()"><i class="fas fa-check"></i></button>
        <button class="btn-inline-cancel" onclick="cancelEditPassword()"><i class="fas fa-times"></i></button>
    </div>`;
    document.getElementById('editPasswordInput').focus();
}

function cancelEditPassword() {
    const td = document.querySelector('#passwordRow td:nth-child(2)');
    passwordVisible = false;
    td.innerHTML = `<div class="password-field">
        <span id="accountPassword" class="password-hidden">********</span>
        <button type="button" class="btn-toggle-password" onclick="togglePasswordVisibility()"><i class="fas fa-eye"></i></button>
    </div>`;
}

async function saveEditPassword() {
    const newPass = document.getElementById('editPasswordInput').value.trim();
    if (!newPass) { showToast('Password cannot be empty', 'error'); return; }

    try {
        const data = await Api.updateAccount('update_password', sessionStorage.getItem('accountUsername'), newPass);
        if (data.status === 'success') {
            sessionStorage.setItem('accountPassword', newPass);
            cancelEditPassword();
            showToast('Password updated!', 'success');
        } else {
            showToast(data.message, 'error');
            cancelEditPassword();
        }
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
        cancelEditPassword();
    }
}

function showToast(message, type = 'info') {
    let toast = document.getElementById('customToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'customToast';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.className = `toast show toast-${type}`;
    toast.innerHTML = `<div class="toast-content"><span class="toast-message">${message}</span></div>`;
    setTimeout(() => { toast.className = 'toast'; }, 3000);
}
