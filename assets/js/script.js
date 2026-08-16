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
let studentRatingReadOnly = false;

// Live rubric criteria (single source of truth, loaded from Firestore).
let liveCriteria = [];

// ===== Presentational UX helpers (UI layer only — no business logic) =====
// Button loading state — contract §2.1 / §4.1: spinner + disabled + aria-busy.
function setButtonLoading(btn, loading) {
    if (!btn || !btn.classList) return;
    if (loading) {
        btn.classList.add('btn-loading');
        btn.setAttribute('aria-busy', 'true');
        btn.disabled = true;
    } else {
        btn.classList.remove('btn-loading');
        btn.removeAttribute('aria-busy');
        btn.disabled = false;
    }
}

// Inline field error — contract §2.2 / §4.1: .has-error + aria-invalid + .form-error.
function setFieldError(input, message) {
    if (!input) return;
    const group = input.closest('.form-group');
    if (!group) return;
    group.classList.add('has-error');
    input.setAttribute('aria-invalid', 'true');
    let err = group.querySelector('.form-error');
    if (!err) {
        err = document.createElement('span');
        err.className = 'form-error';
        if (input.id) err.id = 'err_' + input.id;
        group.appendChild(err);
    }
    err.textContent = message;
    if (err.id) input.setAttribute('aria-describedby', err.id);
}

// Clears the inline error state (bound to input events below).
function clearFieldError(input) {
    if (!input) return;
    const group = input.closest('.form-group');
    if (!group) return;
    group.classList.remove('has-error');
    input.removeAttribute('aria-invalid');
    if (input.id) input.removeAttribute('aria-describedby');
    const err = group.querySelector('.form-error');
    if (err) err.textContent = '';
}

async function loadLiveCriteria() {
    try {
        const data = await Api.getCriteria();
        liveCriteria = (Array.isArray(data) && data.length) ? data : [];
    } catch (e) {
        console.error('loadLiveCriteria error:', e);
        liveCriteria = [];
    }
    return liveCriteria;
}

// Max possible rubric score with the current live criteria (4 points each).
function criteriaDenominator() {
    return Math.max(liveCriteria.length, 1) * 4;
}

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

async function addNewSection() {
    const name = document.getElementById('newSectionInput').value.trim().toUpperCase();
    if (!name) { showToast('Enter a section name', 'error'); return; }
    const maxSc = parseInt(document.getElementById('newSectionMaxInput').value) || 1000;
    const addBtn = document.querySelector('#addSectionRow button');
    setButtonLoading(addBtn, true);
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
    } finally {
        setButtonLoading(addBtn, false);
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
    else if (id === 'criteria') loadCriteriaManagement();
}

async function restoreSectionState() {
    const saved = sessionStorage.getItem('currentSection_' + currentInstructor);
    currentSection = saved || '';
    await loadSectionDropdown();
    const sel = document.getElementById('sectionSelect');
    const optionValues = sel ? [...sel.options].map(o => o.value) : [];
    let section = (saved && optionValues.includes(saved)) ? saved : '';
    if (!section && sel && sel.options.length > 0) {
        // Auto-select the FIRST available section (skip any empty placeholder value).
        for (let i = 0; i < sel.options.length; i++) {
            if (sel.options[i].value) { section = sel.options[i].value; break; }
        }
    }
    currentSection = section;
    if (sel) sel.value = section;
    if (section) sessionStorage.setItem('currentSection_' + currentInstructor, section);
    if (section) {
        try {
            const data = await Api.getSectionConfig(currentInstructor, section);
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
    const submitBtn = e.target.querySelector('button[type="submit"]');

    if (role === 'instructor') {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value.trim();

        if (!username || !password) {
            showToast('Please fill in all fields', 'error');
            if (!username) setFieldError(document.getElementById('loginUsername'), 'Username is required');
            if (!password) setFieldError(document.getElementById('loginPassword'), 'Password is required');
            return;
        }
        clearFieldError(document.getElementById('loginUsername'));
        clearFieldError(document.getElementById('loginPassword'));
        setButtonLoading(submitBtn, true);
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
        } finally {
            setButtonLoading(submitBtn, false);
        }
    } else {
        const name = document.getElementById('loginStudentName').value.trim();
        const section = document.getElementById('loginStudentSection').value;
        if (!name) { showToast('Please enter your name', 'error'); setFieldError(document.getElementById('loginStudentName'), 'Rater name is required'); return; }
        if (!section) { showToast('Please select your section', 'error'); setFieldError(document.getElementById('loginStudentSection'), 'Section is required'); return; }
        clearFieldError(document.getElementById('loginStudentName'));
        clearFieldError(document.getElementById('loginStudentSection'));
        setButtonLoading(submitBtn, true);
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
        } finally {
            setButtonLoading(submitBtn, false);
        }
    }
}

async function handleSignup(e) {
    e.preventDefault();
    const name = document.getElementById('signupName').value.trim();
    const username = document.getElementById('signupUsername').value.trim();
    const password = document.getElementById('signupPassword').value.trim();

    if (!name || !username || !password) {
        showToast('Please fill in all fields', 'error');
        if (!name) setFieldError(document.getElementById('signupName'), 'Full name is required');
        if (!username) setFieldError(document.getElementById('signupUsername'), 'Username is required');
        if (!password) setFieldError(document.getElementById('signupPassword'), 'Password is required');
        return;
    }
    clearFieldError(document.getElementById('signupName'));
    clearFieldError(document.getElementById('signupUsername'));
    clearFieldError(document.getElementById('signupPassword'));
    const submitBtn = e.target.querySelector('button[type="submit"]');
    setButtonLoading(submitBtn, true);
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
    } finally {
        setButtonLoading(submitBtn, false);
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

async function showInstructorDashboard() {
    document.getElementById('authContainer').style.display = 'none';
    document.getElementById('studentDashboard').style.display = 'none';
    document.getElementById('dashboard').style.display = 'flex';
    document.getElementById('headerUserName').textContent = currentUserName;
    document.getElementById('accountName').textContent = currentUserName;
    document.getElementById('accountUsernameView').textContent = sessionStorage.getItem('accountUsername') || '';
    document.getElementById('dropdownUserName').textContent = currentUserName;

    // Profile avatar initials
    const avatar = document.getElementById('profileAvatar');
    if (avatar && currentUserName) {
        const parts = currentUserName.trim().split(/\s+/);
        const initials = parts.length >= 2
            ? (parts[0][0] + parts[parts.length - 1][0])
            : currentUserName.substring(0, 2);
        avatar.textContent = initials.toUpperCase();
    }
    // Mirror name in detail grid
    const nameVal = document.getElementById('accountNameValue');
    if (nameVal && currentUserName) nameVal.textContent = currentUserName;

    await restoreSectionState();
    showSection('studentList', document.querySelector('.nav-link[data-section="studentList"]'), { preventDefault: () => {}, stopPropagation: () => {} });
    loadPendingCount(); // fire-and-forget
    loadApprovedCount(); // fire-and-forget
}

// ========== SIDEBAR TOGGLE ==========
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const hamburger = document.querySelector('.hamburger-btn');
    const isMobile = window.matchMedia('(max-width: 768px)').matches || window.innerWidth <= 768;
    if (isMobile) {
        const opening = !sidebar.classList.contains('open');
        sidebar.classList.toggle('open');
        overlay.classList.toggle('show');
        sidebar.style.transform = opening ? 'translateX(0)' : 'translateX(-100%)';
        if (hamburger) hamburger.setAttribute('aria-expanded', sidebar.classList.contains('open') ? 'true' : 'false');
        // Move focus into the sidebar when it opens on mobile — contract §4.3
        if (opening) {
            const firstNav = sidebar.querySelector('.nav-link');
            if (firstNav) setTimeout(function () { firstNav.focus(); }, 40);
        }
    } else {
        sidebar.classList.toggle('collapsed');
        sidebar.style.transform = '';
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

    const titles = { account: 'ACCOUNT', studentList: 'STUDENT LIST', raterList: 'RATER LIST', groupResults: 'GROUP RESULTS', criteria: 'RUBRIC CRITERIA', sections: 'SECTIONS' };
    document.getElementById('sectionTitle').textContent = titles[section] || section.toUpperCase();

    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    if (el) el.classList.add('active');

    if (section === 'studentList') loadStudentRatingsTable();
    if (section === 'raterList') loadRaterList();
    if (section === 'groupResults') loadAdminGroupResults();
    if (section === 'criteria') loadCriteriaManagement();
    if (section === 'sections') loadSectionsManagement();
 
    if (window.matchMedia('(max-width: 768px)').matches || window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebar').style.transform = '';
        document.getElementById('sidebarOverlay').classList.remove('show');
    }
}

// ========== STUDENT DASHBOARD (GROUP CARDS) ==========
async function initStudentDashboard() {
    document.getElementById('studentGroupsView').style.display = 'block';
    document.getElementById('studentRatingView').style.display = 'none';
    studentCurrentGroup = null;
    studentRatingReadOnly = false;
    document.querySelectorAll('.student-radio').forEach(r => { r.disabled = false; });

    await loadLiveCriteria();

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
        } else if (isClosed && hasRated) {
            statusHtml = `<span class="closed-badge"><i class="fas fa-lock"></i> CLOSED</span> <span class="score-badge">${displayScore}/${criteriaDenominator()}</span>`;
        } else if (isClosed) {
            statusHtml = '<span class="closed-badge"><i class="fas fa-lock"></i> CLOSED</span>';
        } else if (hasRated) {
            statusHtml = `<span class="score-badge">${displayScore}/${criteriaDenominator()}</span>`;
        } else {
            statusHtml = '<span class="rate-badge-inline">RATE HERE</span>';
        }

        let btnHtml = '';
        if (isOwnGroup) {
            btnHtml = `<button class="btn btn-rate-card btn-disabled" disabled><i class="fas fa-ban"></i> Cannot Rate Own Group</button>`;
        } else if (isClosed && hasRated) {
            btnHtml = `<button class="btn btn-view-card" onclick="openStudentGroupRating('${gn}')"><i class="fas fa-eye"></i> View My Score</button>`;
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

async function openStudentGroupRating(groupName) {
    const isClosed = studentGroupStatus[groupName] === 1;
    const existing = studentRatings[groupName];
    const hasRating = existing && existing.total_score > 0;

    if (isClosed && !hasRating) {
        showToast('This group is closed for rating', 'error');
        return;
    }

    if (currentStudentGroup && currentStudentGroup === groupName) {
        showToast('You cannot rate your own group', 'error');
        return;
    }

    studentCurrentGroup = groupName;
    studentRatingReadOnly = isClosed && hasRating;
    document.getElementById('studentGroupsView').style.display = 'none';
    document.getElementById('studentRatingView').style.display = 'block';
    document.getElementById('studentRatingTitle').textContent = groupName;

    const criteria = await loadLiveCriteria();
    renderStudentRubric(criteria, existing);
    document.getElementById('studentTotalScore').textContent = 'TOTAL SCORE: 0';

    const readonlyNote = document.getElementById('studentRatingReadonlyNote');
    if (readonlyNote) readonlyNote.style.display = studentRatingReadOnly ? 'block' : 'none';
    document.querySelectorAll('.student-radio').forEach(r => { r.disabled = studentRatingReadOnly; });

    const emptyMsg = document.getElementById('noRubricCriteria');
    const submitBtn = document.getElementById('submitStudentBtn');
    if (criteria.length === 0) {
        if (emptyMsg) emptyMsg.style.display = 'block';
        if (submitBtn) submitBtn.disabled = true;
    } else {
        if (emptyMsg) emptyMsg.style.display = 'none';
        if (submitBtn) submitBtn.disabled = false;
    }
    updateStudentScore();
}

// Renders the student rating rows dynamically from the LIVE criteria list.
function renderStudentRubric(criteria, existing) {
    const tbody = document.getElementById('studentRubricBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!criteria || criteria.length === 0) return;

    const levels = [
        { v: 4, label: 'Excellent (4)', key: 'desc4' },
        { v: 3, label: 'Good (3)', key: 'desc3' },
        { v: 2, label: 'Fair (2)', key: 'desc2' },
        { v: 1, label: 'Needs Improvement (1)', key: 'desc1' }
    ];

    const prev = existing && existing.total_score > 0 ? existing : {};
    const disabled = studentRatingReadOnly ? ' disabled' : '';
    criteria.forEach(c => {
        const rname = 'rubric_' + c.id;
        let cells = '';
        levels.forEach(lv => {
            const checked = (prev[c.id] === lv.v) ? ' checked' : '';
            cells += `<td><label class="radio-label-cell"><input type="radio" name="${rname}" value="${lv.v}" class="student-radio" data-criteria="${c.id}" onchange="updateStudentScore()"${checked}${disabled}><span class="radio-circle"></span><span class="radio-text"><span class="radio-score-label">${lv.label}</span><span class="radio-desc">${escHtml(c[lv.key] || '')}</span></span></label></td>`;
        });
        tbody.innerHTML += `<tr><td class="criteria-name">${escHtml(c.name)}</td>${cells}<td class="score-cell"><span class="radio-score" id="score_${c.id}">0</span></td></tr>`;
    });
}

function closeStudentRating() {
    studentCurrentGroup = null;
    studentRatingReadOnly = false;
    document.querySelectorAll('.student-radio').forEach(r => { r.disabled = false; });
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
    if (studentRatingReadOnly) {
        showToast('This group is closed for rating', 'error');
        return;
    }

    if (liveCriteria.length === 0) { showToast('No criteria configured yet.', 'error'); return; }

    const scores = {};
    let total = 0;
    const checkedCount = document.querySelectorAll('.student-radio:checked').length;
    if (checkedCount < liveCriteria.length) { showToast('Please select a score for all criteria', 'error'); return; }
    document.querySelectorAll('.student-radio:checked').forEach(r => {
        const val = parseInt(r.value) || 0;
        scores[r.getAttribute('data-criteria')] = val;
        total += val;
    });

    const submitBtn = document.getElementById('submitStudentBtn');
    setButtonLoading(submitBtn, true);
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
    } finally {
        setButtonLoading(submitBtn, false);
    }
}

// ========== ADMIN: STUDENT RATINGS TABLE ==========
async function loadStudentRatingsTable() {
    await loadLiveCriteria();
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

let studentRatingsData = [];

function renderStudentRatingsTable(ratings) {
    studentRatingsData = ratings || [];
    const thead = document.getElementById('studentRatingsHead');
    const tbody = document.getElementById('studentRatingsBody');
    const tfoot = document.getElementById('studentRatingsFoot');
    const noData = document.getElementById('noStudentRatings');
    const searchInput = document.getElementById('studentRatingsSearchInput');
    if (!thead || !tbody) return;
    if (searchInput) searchInput.value = '';

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
    renderStudentRatingsRows(tbody, tfoot, ratings);
}

function renderStudentRatingsRows(tbody, tfoot, ratings) {
    let bodyHtml = '';
    let colTotals = {};
    for (let i = 1; i <= 10; i++) colTotals['GROUP ' + i] = 0;

    ratings.forEach((r, i) => {
        bodyHtml += `<tr><td class="num-cell">${i + 1}</td><td class="name-cell"><a href="#" onclick="openStudentDetail('${r.name.replace(/'/g, "\\'")}', event)">${r.name}</a></td>`;
        for (let g = 1; g <= 10; g++) {
            const gn = 'GROUP ' + g;
            const score = r[gn];
            if (score !== null && score !== undefined) {
                bodyHtml += `<td class="score-cell"><span class="score-badge">${score}/${criteriaDenominator()}</span></td>`;
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

function filterStudentRatings() {
    const query = (document.getElementById('studentRatingsSearchInput').value || '').toLowerCase();
    const tbody = document.getElementById('studentRatingsBody');
    const tfoot = document.getElementById('studentRatingsFoot');
    const noData = document.getElementById('noStudentRatings');
    if (!tbody) return;

    const filtered = studentRatingsData.filter(r => r.name.toLowerCase().includes(query));
    if (filtered.length === 0) {
        tbody.innerHTML = '';
        if (tfoot) tfoot.innerHTML = '';
        if (noData) noData.style.display = 'block';
    } else {
        if (noData) noData.style.display = 'none';
        renderStudentRatingsRows(tbody, tfoot, filtered);
    }
}

// ========== EXPORT PDF (Bond Paper Print) ==========
function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function buildStudentRatingsHTML(ratings) {
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
        <span><b>MAX SCORE:</b> ${currentMaxScore} pts</span>
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
                html += `<td>${score}/${criteriaDenominator()}</td>`;
                colTotals[gn] += score;
            } else {
                html += '<td>&ndash;</td>';
            }
        }
        html += '</tr>';
    });
    html += '</tbody><tfoot><tr class="total"><td></td><td class="name">TOTAL SCORE: ' + currentMaxScore + '</td>';
    for (let g = 1; g <= 10; g++) html += `<td>${colTotals['GROUP ' + g]}/${currentMaxScore}</td>`;
    html += '</tr></tfoot></table>';
    html += `<div class="signatures">
        <div class="sig-block"><span class="sig-line">${escHtml(currentInstructor)}</span><div class="sig-label">PREPARED BY</div></div>
        <div class="sig-block"><span class="sig-line">&nbsp;</span><div class="sig-label">NOTED BY</div></div>
    </div>`;
    html += '<div class="doc-footer">' + SYSTEM_URL + '</div>';
    html += '</body></html>';
    return html;
}

async function exportStudentPDF() {
    if (!currentInstructor) { await showAlertDialog({ title: 'PDF Export', message: 'No instructor selected. Select an instructor first.', type: 'warning' }); return; }
    await loadLiveCriteria();
    const data = await Api.getStudentRatingsTable(currentInstructor, currentSection);
    if (data.status !== 'success') { showToast('Error loading ratings', 'error'); return; }
    const ratings = data.ratings || [];

    const html = buildStudentRatingsHTML(ratings);

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

function buildRaterListHTML(raters) {
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Rater List</title>
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
            <h1>RATER LIST</h1>
        </div>
        <div class="date">Date of Issuance<br><b>${escHtml(today)}</b></div>
    </div>`;
    html += `<div class="meta">
        <span><b>INSTRUCTOR:</b> ${escHtml(currentInstructor)}</span>
        <span><b>SECTION:</b> ${escHtml(currentSection || 'N/A')}</span>
        <span><b>STUDENTS:</b> ${raters.length}</span>
    </div>`;
    html += '<table><thead><tr><th style="width:26px;">#</th><th style="text-align:left;">NAME OF THE RATER</th>';
    for (let i = 1; i <= 10; i++) html += `<th>GROUP ${i}</th>`;
    html += '</tr></thead><tbody>';

    raters.forEach((r, idx) => {
        html += `<tr class="${(idx % 2) ? 'alt' : ''}"><td>${idx + 1}</td><td class="name">${escHtml(r.name)}</td>`;
        for (let g = 1; g <= 10; g++) {
            const voted = r['GROUP ' + g];
            if (voted) {
                html += '<td style="color:#16a34a;font-weight:bold;">&#10003;</td>';
            } else {
                html += '<td style="color:#dc2626;font-weight:bold;">&#10007;</td>';
            }
        }
        html += '</tr>';
    });
    html += '</tbody></table>';
    html += `<div class="table-note">RATED: &#10003;  MISSED: &#10007;</div>`;
    html += `<div class="signatures">
        <div class="sig-block"><span class="sig-line">${escHtml(currentInstructor)}</span><div class="sig-label">PREPARED BY</div></div>
        <div class="sig-block"><span class="sig-line">&nbsp;</span><div class="sig-label">NOTED BY</div></div>
    </div>`;
    html += '<div class="doc-footer">' + SYSTEM_URL + '</div>';
    html += '</body></html>';
    return html;
}

async function exportRaterListPDF() {
    if (!currentInstructor) { await showAlertDialog({ title: 'PDF Export', message: 'No instructor selected. Select an instructor first.', type: 'warning' }); return; }
    await loadLiveCriteria();
    const data = await Api.getRaterList(currentInstructor, currentSection);
    if (data.status !== 'success') { showToast('Error loading rater list', 'error'); return; }
    const raters = data.raters || [];

    const html = buildRaterListHTML(raters);

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

// ========== EXPORT PDF (Download — native vector render) ==========
let pdfBusy = false;

function localDateStamp() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// Loads the logo once and returns { url, w, h } (PNG data URL + natural dims) for embedding (same origin).
let _logo = null;
function getLogoURL() {
    if (_logo) return Promise.resolve(_logo);
    return new Promise(function (resolve) {
        var img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function () {
            try {
                var cv = document.createElement('canvas');
                cv.width = img.naturalWidth || 80;
                cv.height = img.naturalHeight || 80;
                var ctx = cv.getContext('2d');
                ctx.drawImage(img, 0, 0);
                _logo = { url: cv.toDataURL('image/png'), w: cv.width, h: cv.height };
                resolve(_logo);
            } catch (e) { resolve(null); }
        };
        img.onerror = function () { resolve(null); };
        img.src = 'assets/images/logo-toggle.png';
    });
}

// ---------- page geometry (legal landscape, mm) ----------
const PDF_PAGE_W = 355.6, PDF_PAGE_H = 215.9, PDF_TOP = 12, PDF_BOTTOM = 14, PDF_MARGIN = 14;
const PDF_CONTENT_W = PDF_PAGE_W - (PDF_MARGIN * 2); // 327.6
const SYSTEM_URL = 'https://rubric-system-tcgc.vercel.app/';

function pdfSetDocFonts(doc, size, style) {
    doc.setFont('helvetica', style || 'normal');
    doc.setFontSize(size);
}

// Letterhead: logo left, brand center block, issuance date, double rule. Returns next usable y.
function drawLetterhead(doc, title, logoURL, today) {
    if (logoURL && logoURL.url) {
        var lh = 15.3;
        var lw = (logoURL.w && logoURL.h) ? (lh * logoURL.w / logoURL.h) : 26;
        if (lw > 80) { lw = 80; lh = 80 * logoURL.h / logoURL.w; }
        doc.addImage(logoURL.url, 'PNG', PDF_MARGIN, PDF_TOP - 3, lw, lh);
    }
    pdfSetDocFonts(doc, 16, 'bold');
    doc.setTextColor('#0e5e2e');
    doc.text(title, PDF_PAGE_W / 2, PDF_TOP, { align: 'center', baseline: 'middle' });
    pdfSetDocFonts(doc, 8, 'normal');
    doc.setTextColor('#334155');
    doc.text('Date of Issuance', PDF_PAGE_W - PDF_MARGIN, PDF_TOP, { align: 'right' });
    pdfSetDocFonts(doc, 8.5, 'bold');
    doc.setTextColor('#14202e');
    doc.text(today, PDF_PAGE_W - PDF_MARGIN, PDF_TOP + 4.5, { align: 'right' });
    // double rule under the letterhead
    doc.setDrawColor('#0e5e2e');
    doc.setLineWidth(0.9);
    doc.line(PDF_MARGIN, PDF_TOP + 15.5, PDF_PAGE_W - PDF_MARGIN, PDF_TOP + 15.5);
    doc.setLineWidth(0.3);
    doc.line(PDF_MARGIN, PDF_TOP + 16.6, PDF_PAGE_W - PDF_MARGIN, PDF_TOP + 16.6);
    return PDF_TOP + 22;
}

// Meta bar: items [{label, value}] in equal slots. Returns next usable y.
function drawMetaBar(doc, items, y) {
    const h = 17;
    doc.setFillColor('#f0f7f2');
    doc.setDrawColor('#cfe3d6');
    doc.setLineWidth(0.3);
    doc.roundedRect(PDF_MARGIN, y, PDF_CONTENT_W, h, 1.5, 1.5, 'FD');
    const slotW = PDF_CONTENT_W / items.length;
    items.forEach(function (it, i) {
        const x0 = PDF_MARGIN + (slotW * i) + 3;
        pdfSetDocFonts(doc, 8, 'normal');
        doc.setTextColor('#0e5e2e');
        doc.text(it.label + ':', x0, y + 6, { baseline: 'top' });
        pdfSetDocFonts(doc, 8.5, 'bold');
        doc.setTextColor('#14202e');
        doc.text(String(it.value), x0, y + 11.5, { baseline: 'top' });
    });
    return y + h + 5;
}

// Deterministic vector table with page breaks (header drawn once on the first page only), zebra and totals row.
// opts: { zebra, markFn(doc,cx,cy,ci,cell), totalRow }.
function drawTable(doc, x, y, colWidths, headers, rows, opts) {
    opts = opts || {};
    const rowH = 7.2, headH = 8.2;
    const totalW = colWidths.reduce(function (a, b) { return a + b; }, 0);
    let cy = y;
    const cumW = [];
    let acc = 0;
    for (let i = 0; i < colWidths.length; i++) { acc += colWidths[i]; cumW.push(acc); }
    const limitY = PDF_PAGE_H - PDF_BOTTOM;

    const drawHeaderBlock = function () {
        doc.setFillColor('#0e5e2e');
        doc.rect(x, cy, totalW, headH, 'F');
        pdfSetDocFonts(doc, 8, 'bold');
        doc.setTextColor('#ffffff');
        let hx = x;
        headers.forEach(function (h, i) {
            doc.text(String(h), hx + colWidths[i] / 2, cy + headH / 2, { align: 'center', baseline: 'middle' });
            hx += colWidths[i];
        });
        cy += headH;
    };

    drawHeaderBlock();

    rows.forEach(function (row, ri) {
        if (cy + rowH > limitY) {
            doc.addPage();
            cy = PDF_TOP;
        }
        if (opts.zebra && (ri % 2 === 1)) {
            doc.setFillColor('#f3f7f4');
            doc.rect(x, cy, totalW, rowH, 'F');
        }
        // single bordered box per row + vertical cell separators
        doc.setDrawColor('#b9c6bd');
        doc.setLineWidth(0.15);
        doc.rect(x, cy, totalW, rowH, 'S');
        for (let v = 1; v < colWidths.length; v++) {
            doc.line(x + cumW[v - 1], cy, x + cumW[v - 1], cy + rowH);
        }
        let cx = x;
        row.forEach(function (cell, ci) {
            if (ci >= 2 && opts.markFn) {
                opts.markFn(doc, cx + colWidths[ci] / 2, cy + rowH / 2, ci, cell);
            } else if (cell !== null && cell !== undefined) {
                const isLeft = (ci === 0 || ci === opts.leftIdx);
                pdfSetDocFonts(doc, 7.5, isLeft ? 'bold' : 'normal');
                doc.setTextColor('#1c2b3a');
                if (isLeft) {
                    doc.text(String(cell), cx + 1.5, cy + rowH / 2, { align: 'left', baseline: 'middle' });
                } else {
                    doc.text(String(cell), cx + colWidths[ci] / 2, cy + rowH / 2, { align: 'center', baseline: 'middle' });
                }
            }
            cx += colWidths[ci];
        });
        cy += rowH;
    });

    if (opts.totalRow) {
        if (cy + rowH > limitY) {
            doc.addPage();
            cy = PDF_TOP;
        }
        doc.setFillColor('#0e5e2e');
        doc.rect(x, cy, totalW, rowH, 'F');
        doc.setDrawColor('#b9c6bd');
        doc.setLineWidth(0.15);
        doc.rect(x, cy, totalW, rowH, 'S');
        let cx2 = x;
        opts.totalRow.forEach(function (tc, ci) {
            if (tc !== null && tc !== undefined) {
                pdfSetDocFonts(doc, 8, 'bold');
                doc.setTextColor('#ffffff');
                if (ci === 1) {
                    doc.text(String(tc), cx2 + 1.5, cy + rowH / 2, { align: 'left', baseline: 'middle' });
                } else if (ci > 1) {
                    doc.text(String(tc), cx2 + colWidths[ci] / 2, cy + rowH / 2, { align: 'center', baseline: 'middle' });
                }
            }
            cx2 += colWidths[ci];
        });
        cy += rowH;
    }
    return cy;
}

// Checkmark "voted" mark (green) and cross "missed" mark (red).
function drawMarks(doc, cx, cy) {
    doc.setDrawColor('#16a34a');
    doc.setLineWidth(0.6);
    doc.line(cx - 1.6, cy + 0.6, cx - 0.4, cy + 1.8);
    doc.line(cx - 0.4, cy + 1.8, cx + 1.8, cy - 1.6);
}
function drawMiss(doc, cx, cy) {
    doc.setDrawColor('#dc2626');
    doc.setLineWidth(0.5);
    doc.line(cx - 1.4, cy - 1.4, cx + 1.4, cy + 1.4);
    doc.line(cx + 1.4, cy - 1.4, cx - 1.4, cy + 1.4);
}

// Signature blocks: left PREPARED BY (instructor), right NOTED BY.
function drawSignatures(doc, y, instructor) {
    const leftCx = PDF_PAGE_W * 0.28;
    const rightCx = PDF_PAGE_W * 0.72;
    doc.setDrawColor('#14202e');
    doc.setLineWidth(0.5);
    doc.line(leftCx - 11, y, leftCx + 11, y);
    doc.line(rightCx - 11, y, rightCx + 11, y);
    pdfSetDocFonts(doc, 8.5, 'bold');
    doc.setTextColor('#14202e');
    doc.text(String(instructor || ''), leftCx, y + 3.5, { align: 'center' });
    pdfSetDocFonts(doc, 8, 'normal');
    doc.setTextColor('#475569');
    doc.text('PREPARED BY', leftCx, y + 8.5, { align: 'center' });
    doc.text('NOTED BY', rightCx, y + 8.5, { align: 'center' });
}

function drawFooter(doc, y, text) {
    pdfSetDocFonts(doc, 7.5, 'normal');
    doc.setTextColor('#64748b');
    if (typeof doc.textWithLink === 'function') {
        doc.textWithLink(text, (PDF_PAGE_W - doc.getTextWidth(text)) / 2, y, { url: text });
    } else {
        doc.text(text, (PDF_PAGE_W - doc.getTextWidth(text)) / 2, y);
    }
}

// Shared PDF "busy" guard: prevents overlapping exports.
async function withPdfLock(task) {
    if (pdfBusy) { showToast('A PDF is already being generated. Please wait.', 'error'); return; }
    pdfBusy = true;
    try { await task(); } finally { pdfBusy = false; }
}

async function drawStudentRatingsPDF(doc, ratings) {
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const logo = await getLogoURL();

    let y = drawLetterhead(doc, 'STUDENT RATING RECORDS', logo, today);
    y = drawMetaBar(doc, [
        { label: 'INSTRUCTOR', value: currentInstructor },
        { label: 'SECTION', value: currentSection || 'N/A' },
        { label: 'MAX SCORE', value: currentMaxScore + ' pts' },
        { label: 'RATERS', value: (ratings || []).length }
    ], y);

    const groupW = (PDF_CONTENT_W - 83) / 10;
    const colWidths = [8, 75];
    for (let g = 1; g <= 10; g++) colWidths.push(groupW);
    const headers = ['#', 'NAME OF THE RATER'];
    for (let g = 1; g <= 10; g++) headers.push('GROUP ' + g);

    const colTotals = {};
    for (let g = 1; g <= 10; g++) colTotals['GROUP ' + g] = 0;
    const rows = (ratings || []).map(function (r, idx) {
        const row = [idx + 1, r.name];
        for (let g = 1; g <= 10; g++) {
            const gn = 'GROUP ' + g;
            const score = r[gn];
            if (score !== null && score !== undefined) {
                row.push(score + '/' + criteriaDenominator());
                colTotals[gn] += score;
            } else {
                row.push(null);
            }
        }
        return row;
    });
    const totalRow = [null, 'TOTAL SCORE: ' + currentMaxScore];
    for (let g = 1; g <= 10; g++) totalRow.push(colTotals['GROUP ' + g] + '/' + currentMaxScore);

    y = drawTable(doc, PDF_MARGIN, y, colWidths, headers, rows, { zebra: true, leftIdx: 1, totalRow: totalRow });

    if (y + 22 > PDF_PAGE_H - PDF_BOTTOM) { doc.addPage(); y = PDF_TOP; }

    const sigY = y + 12;
    drawSignatures(doc, sigY, currentInstructor);
    drawFooter(doc, sigY + 15, SYSTEM_URL);
}

async function drawRaterListPDF(doc, raters) {
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const logo = await getLogoURL();

    let y = drawLetterhead(doc, 'RATER LIST', logo, today);
    y = drawMetaBar(doc, [
        { label: 'INSTRUCTOR', value: currentInstructor },
        { label: 'SECTION', value: currentSection || 'N/A' },
        { label: 'STUDENTS', value: (raters || []).length },
        { label: 'STATUS', value: '10 GROUPS' }
    ], y);

    const groupW = (PDF_CONTENT_W - 83) / 10;
    const colWidths = [8, 75];
    for (let g = 1; g <= 10; g++) colWidths.push(groupW);
    const headers = ['#', 'NAME OF THE RATER'];
    for (let g = 1; g <= 10; g++) headers.push('GROUP ' + g);

    const rows = (raters || []).map(function (r, idx) {
        const row = [idx + 1, r.name];
        for (let g = 1; g <= 10; g++) row.push(r);
        return row;
    });

    y = drawTable(doc, PDF_MARGIN, y, colWidths, headers, rows, {
        zebra: true,
        leftIdx: 1,
        markFn: function (doc, cx, cy, ci, cell) {
            const g = ci - 1;
            if (cell && cell['GROUP ' + g]) drawMarks(doc, cx, cy);
            else drawMiss(doc, cx, cy);
        }
    });

    if (y + 22 > PDF_PAGE_H - PDF_BOTTOM) { doc.addPage(); y = PDF_TOP; }

    // table note with tiny sample marks
    const noteY = y + 4;
    pdfSetDocFonts(doc, 8.5, 'normal');
    doc.setTextColor('#475569');
    doc.text('RATED:', PDF_MARGIN + 2, noteY, { baseline: 'middle' });
    drawMarks(doc, PDF_MARGIN + 18, noteY);
    doc.text('MISSED:', PDF_MARGIN + 30, noteY, { baseline: 'middle' });
    drawMiss(doc, PDF_MARGIN + 48, noteY);

    const sigY = y + 13;
    drawSignatures(doc, sigY, currentInstructor);
    drawFooter(doc, sigY + 15, SYSTEM_URL);
}

async function downloadStudentPDF() {
    if (!currentInstructor) { await showAlertDialog({ title: 'PDF Export', message: 'No instructor selected. Select an instructor first.', type: 'warning' }); return; }
    if (!window.jspdf) { showToast('PDF library not loaded yet. Check your connection and try again.', 'error'); return; }
    const { jsPDF } = window.jspdf;
    await withPdfLock(async function () {
        const loading = showLoadingDialog('Generating PDF...');
        try {
            await loadLiveCriteria();
            const data = await Api.getStudentRatingsTable(currentInstructor, currentSection);
            if (data.status !== 'success') { showToast('Error loading ratings', 'error'); return; }
            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'legal' });
            await drawStudentRatingsPDF(doc, data.ratings || []);
            doc.save('Student_Ratings_' + localDateStamp() + '.pdf');
            showToast('PDF downloaded!', 'success');
        } catch (e) {
            console.error('PDF download error:', e);
            showToast('Failed to generate PDF. Try again.', 'error');
        } finally {
            loading.close();
        }
    });
}

async function downloadRaterListPDF() {
    if (!currentInstructor) { await showAlertDialog({ title: 'PDF Export', message: 'No instructor selected. Select an instructor first.', type: 'warning' }); return; }
    if (!window.jspdf) { showToast('PDF library not loaded yet. Check your connection and try again.', 'error'); return; }
    const { jsPDF } = window.jspdf;
    await withPdfLock(async function () {
        const loading = showLoadingDialog('Generating PDF...');
        try {
            await loadLiveCriteria();
            const data = await Api.getRaterList(currentInstructor, currentSection);
            if (data.status !== 'success') { showToast('Error loading rater list', 'error'); return; }
            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'legal' });
            await drawRaterListPDF(doc, data.raters || []);
            doc.save('Rater_List_' + localDateStamp() + '.pdf');
            showToast('PDF downloaded!', 'success');
        } catch (e) {
            console.error('PDF download error:', e);
            showToast('Failed to generate PDF. Try again.', 'error');
        } finally {
            loading.close();
        }
    });
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
    openModalOverlay(document.getElementById('studentDetailModal'));
    document.getElementById('studentDetailContent').innerHTML = '<div class="detail-loading"><i class="fas fa-spinner fa-spin"></i></div>';
    document.getElementById('noStudentDetail').style.display = 'none';
    loadStudentDetail(name);
}

function closeStudentDetail(e) {
    if (e && e.target !== e.currentTarget) return;
    closeModalOverlay(document.getElementById('studentDetailModal'));
}

async function loadStudentDetail(name) {
    await loadLiveCriteria();
    try {
        const data = await Api.getStudentDetail(name, currentInstructor, currentSection);
        if (data.status === 'success') {
            renderStudentDetail(data.ratings);
        } else {
            document.getElementById('studentDetailContent').innerHTML = '<p class="no-data show">Error loading details.</p>';
        }
    } catch (err) {
        document.getElementById('studentDetailContent').innerHTML = '<p class="no-data show">Network error.</p>';
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
                <span class="detail-total-score">${r.total_score}/${criteriaDenominator()}</span>
            </div>
            <div class="detail-group-body">`;

        liveCriteria.forEach(c => {
            const score = parseInt(r[c.id]) || 0;
            html += `<div class="detail-criteria-row">
                <span class="detail-criteria-name">${escHtml(c.name)}</span>
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
                    <td><input type="text" id="sec_name_${sid}" value="${s.section_name}" class="section-edit-input" aria-label="Section name"></td>
                    <td><input type="number" id="sec_max_${sid}" value="${s.max_score || 1000}" class="section-edit-input section-number-input" aria-label="Maximum score"></td>
                    <td>
                        <button class="btn btn-success btn-sm" onclick="saveSectionRow('${s.section_name}')" aria-label="Save section"><i class="fas fa-save"></i></button>
                        <button class="btn btn-danger btn-sm" onclick="deleteSectionRow('${s.section_name}')" aria-label="Delete section"><i class="fas fa-trash"></i></button>
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
    const confirmed = await showConfirmDialog({ title: 'Delete Section', message: 'Delete section "' + sectionName + '" and all its data? This cannot be undone.', type: 'warning', confirmText: 'Delete', cancelText: 'Cancel', danger: true });
    if (!confirmed) return;
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

// Auto-grows a text input's width to fit its content (with a small padding).
function autoGrowInput(el) {
    if (!el) return;
    el.style.width = 'auto';
    el.style.minWidth = '140px';
    el.style.width = (el.scrollWidth + 6) + 'px';
}

// Resets an input back to its normal full-width (called on blur).
function resetInputWidth(el) {
    if (!el) return;
    el.style.width = '100%';
    el.style.minWidth = '';
}

// ========== CRITERIA MANAGEMENT ==========
async function loadCriteriaManagement() {
    try {
        const criteria = await loadLiveCriteria();
        const tbody = document.getElementById('criteriaTableBody');
        const noData = document.getElementById('noCriteria');
        if (!tbody) return;

        if (criteria.length === 0) {
            tbody.innerHTML = '';
            if (noData) noData.style.display = 'block';
            return;
        }
        if (noData) noData.style.display = 'none';

        tbody.innerHTML = criteria.map((c, i) => {
            const rid = c.id;
            const n = criteria.length;
            const upBtn = i > 0
                ? `<button class="btn btn-sm" onclick="moveCriterion('${rid}', -1)" aria-label="Move criterion up"><i class="fas fa-arrow-up"></i></button>`
                : `<button class="btn btn-sm" disabled aria-label="Move criterion up"><i class="fas fa-arrow-up"></i></button>`;
            const downBtn = i < n - 1
                ? `<button class="btn btn-sm" onclick="moveCriterion('${rid}', 1)" aria-label="Move criterion down"><i class="fas fa-arrow-down"></i></button>`
                : `<button class="btn btn-sm" disabled aria-label="Move criterion down"><i class="fas fa-arrow-down"></i></button>`;
            return `<tr>
                <td>${i + 1}</td>
                <td><input type="text" id="crit_name_${rid}" value="${escHtml(c.name)}" class="section-edit-input u-full" onfocus="autoGrowInput(this)" oninput="autoGrowInput(this)" onblur="resetInputWidth(this)" aria-label="Criterion name"></td>
                <td><input type="text" id="crit_desc4_${rid}" value="${escHtml(c.desc4 || '')}" class="section-edit-input u-full" onfocus="autoGrowInput(this)" oninput="autoGrowInput(this)" onblur="resetInputWidth(this)" aria-label="Excellent (4) description"></td>
                <td><input type="text" id="crit_desc3_${rid}" value="${escHtml(c.desc3 || '')}" class="section-edit-input u-full" onfocus="autoGrowInput(this)" oninput="autoGrowInput(this)" onblur="resetInputWidth(this)" aria-label="Good (3) description"></td>
                <td><input type="text" id="crit_desc2_${rid}" value="${escHtml(c.desc2 || '')}" class="section-edit-input u-full" onfocus="autoGrowInput(this)" oninput="autoGrowInput(this)" onblur="resetInputWidth(this)" aria-label="Fair (2) description"></td>
                <td><input type="text" id="crit_desc1_${rid}" value="${escHtml(c.desc1 || '')}" class="section-edit-input u-full" onfocus="autoGrowInput(this)" oninput="autoGrowInput(this)" onblur="resetInputWidth(this)" aria-label="Needs improvement (1) description"></td>
                <td class="action-buttons">
                    ${upBtn} ${downBtn}
                    <button class="btn btn-success btn-sm" onclick="saveCriterionRow('${rid}')" aria-label="Save criterion"><i class="fas fa-save"></i></button>
                    <button class="btn btn-danger btn-sm" onclick="deleteCriterionRow('${rid}')" aria-label="Delete criterion"><i class="fas fa-trash"></i></button>
                </td>
            </tr>`;
        }).join('');
    } catch (e) {
        console.error('loadCriteriaManagement error:', e);
    }
}

// Generates a stable snake_case slug id for a NEW criterion (never changed on rename).
function slugifyCriterion(name) {
    const slug = String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    return slug || 'criterion';
}

async function addNewCriterion() {
    const name = document.getElementById('newCriterionName').value.trim();
    if (!name) { showToast('Enter a criterion name', 'error'); return; }
    if (liveCriteria.length >= 20) { showToast('Maximum of 20 criteria reached.', 'error'); return; }

    const slug = slugifyCriterion(name);
    if (liveCriteria.some(c => c.id === 'criteria_' + slug)) { showToast('A criterion with this name already exists.', 'error'); return; }
    const id = 'criteria_' + slug;
    const rec = {
        id: id,
        name: name,
        desc4: document.getElementById('newCriterionDesc4').value.trim(),
        desc3: document.getElementById('newCriterionDesc3').value.trim(),
        desc2: document.getElementById('newCriterionDesc2').value.trim(),
        desc1: document.getElementById('newCriterionDesc1').value.trim(),
        position: liveCriteria.length
    };

    const addBtn = document.querySelector('#addCriterionRow button');
    setButtonLoading(addBtn, true);
    try {
        const data = await Api.saveCriterion(rec);
        if (data.status === 'success') {
            showToast('Criterion "' + name + '" added', 'success');
            document.getElementById('newCriterionName').value = '';
            document.getElementById('newCriterionDesc4').value = '';
            document.getElementById('newCriterionDesc3').value = '';
            document.getElementById('newCriterionDesc2').value = '';
            document.getElementById('newCriterionDesc1').value = '';
            loadCriteriaManagement();
        } else {
            showToast(data.message || 'Error adding criterion', 'error');
        }
    } catch (e) {
        showToast('Network error', 'error');
    } finally {
        setButtonLoading(addBtn, false);
    }
}

async function saveCriterionRow(id) {
    const name = document.getElementById('crit_name_' + id).value.trim();
    if (!name) { showToast('Criterion name cannot be empty', 'error'); return; }
    const idx = liveCriteria.findIndex(c => c.id === id);
    const rec = {
        id: id,
        name: name,
        desc4: document.getElementById('crit_desc4_' + id).value.trim(),
        desc3: document.getElementById('crit_desc3_' + id).value.trim(),
        desc2: document.getElementById('crit_desc2_' + id).value.trim(),
        desc1: document.getElementById('crit_desc1_' + id).value.trim(),
        position: idx >= 0 ? liveCriteria[idx].position : liveCriteria.length
    };
    try {
        const data = await Api.saveCriterion(rec);
        if (data.status === 'success') {
            showToast('Criterion saved', 'success');
            loadCriteriaManagement();
        } else {
            showToast(data.message || 'Error saving criterion', 'error');
        }
    } catch (e) {
        showToast('Network error', 'error');
    }
}

async function deleteCriterionRow(id) {
    if (liveCriteria.length <= 1) { showToast('At least one criterion is required.', 'error'); return; }
    const c = liveCriteria.find(x => x.id === id);
    const confirmed = await showConfirmDialog({ title: 'Delete Criterion', message: 'Delete criterion "' + (c ? c.name : id) + '"? This cannot be undone.', type: 'warning', confirmText: 'Delete', cancelText: 'Cancel', danger: true });
    if (!confirmed) return;
    try {
        const data = await Api.deleteCriterion(id);
        if (data.status === 'success') {
            showToast('Criterion deleted', 'success');
            loadCriteriaManagement();
        } else {
            showToast(data.message || 'Error deleting criterion', 'error');
        }
    } catch (e) {
        showToast('Network error', 'error');
    }
}

async function moveCriterion(id, dir) {
    const idx = liveCriteria.findIndex(c => c.id === id);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= liveCriteria.length) return;

    const arr = liveCriteria.slice();
    const moved = arr.splice(idx, 1)[0];
    arr.splice(newIdx, 0, moved);
    const orderedIds = arr.map(c => c.id);

    try {
        const data = await Api.reorderCriteria(orderedIds);
        if (data.status === 'success') {
            showToast('Criteria reordered', 'success');
            loadCriteriaManagement();
        } else {
            showToast(data.message || 'Error reordering criteria', 'error');
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

        let hasSections = false;
        try {
            const sectionsRes = await Api.getSections(currentInstructor);
            hasSections = ((sectionsRes && sectionsRes.sections) || []).length > 0;
        } catch (e) {
            hasSections = false;
        }

        if (data.status === 'success') {
            renderAdminGroupResults(data.groups, hasSections);
        } else {
            renderAdminGroupResults({}, hasSections);
        }
    } catch (err) {
        renderAdminGroupResults({}, false);
    }
}

function renderAdminGroupResults(groups, hasSections) {
    const grid = document.getElementById('adminGroupResults');
    if (!grid) return;

    const canAddMembers = hasSections === true;
    const memberInputDisabled = canAddMembers ? '' : ' disabled';

    let html = '';
    if (!canAddMembers) {
        html += '<div class="no-sections-banner">Create a section first to add members.</div>';
    }
    GROUPS.forEach(gn => {
        const grp = groups[gn] || { member1_name: '', member2_name: '', member3_name: '', member4_name: '', member5_name: '', member6_name: '', is_closed: 0, total_score: 0, num_ratings: 0 };

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
                    <input type="text" class="admin-member-input u-text-upper" id="member1_${gn.replace(' ', '_')}" placeholder="Member 1" aria-label="Member 1" value="${grp.member1_name}" oninput="debouncedSaveMembers('${gn}')"${memberInputDisabled}>
                    <input type="text" class="admin-member-input u-text-upper" id="member2_${gn.replace(' ', '_')}" placeholder="Member 2" aria-label="Member 2" value="${grp.member2_name}" oninput="debouncedSaveMembers('${gn}')"${memberInputDisabled}>
                    <input type="text" class="admin-member-input u-text-upper" id="member3_${gn.replace(' ', '_')}" placeholder="Member 3" aria-label="Member 3" value="${grp.member3_name}" oninput="debouncedSaveMembers('${gn}')"${memberInputDisabled}>
                    <input type="text" class="admin-member-input u-text-upper" id="member4_${gn.replace(' ', '_')}" placeholder="Member 4" aria-label="Member 4" value="${grp.member4_name}" oninput="debouncedSaveMembers('${gn}')"${memberInputDisabled}>
                    <input type="text" class="admin-member-input u-text-upper" id="member5_${gn.replace(' ', '_')}" placeholder="Member 5" aria-label="Member 5" value="${grp.member5_name}" oninput="debouncedSaveMembers('${gn}')"${memberInputDisabled}>
                    <input type="text" class="admin-member-input u-text-upper" id="member6_${gn.replace(' ', '_')}" placeholder="Member 6" aria-label="Member 6" value="${grp.member6_name}" oninput="debouncedSaveMembers('${gn}')"${memberInputDisabled}>
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

const debouncedSaveMembers = debounce(async (groupName) => {
    if (!currentSection) { showToast('Create a section first to add members', 'warning'); return; }
    const key = groupName.replace(' ', '_');
    const m1 = document.getElementById(`member1_${key}`).value.trim();
    const m2 = document.getElementById(`member2_${key}`).value.trim();
    const m3 = document.getElementById(`member3_${key}`).value.trim();
    const m4 = document.getElementById(`member4_${key}`).value.trim();
    const m5 = document.getElementById(`member5_${key}`).value.trim();
    const m6 = document.getElementById(`member6_${key}`).value.trim();

    try {
        const data = await Api.saveGroupMembers(currentInstructor, groupName, currentSection, m1, m2, m3, m4, m5, m6);

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
    openModalOverlay(document.getElementById('pendingModal'));
    loadPendingAccounts();
}

function closePendingModal(e) {
    if (e && e.target !== e.currentTarget) return;
    closeModalOverlay(document.getElementById('pendingModal'));
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

async function loadPendingCount() {
    try {
        const data = await Api.getPendingAccounts();
        const badge = document.getElementById('pendingCount');
        if (data.status === 'success' && data.accounts && data.accounts.length > 0) {
            if (badge) {
                badge.textContent = data.accounts.length;
                badge.style.display = 'inline-block';
            }
        } else {
            if (badge) badge.style.display = 'none';
        }
    } catch (e) {
        const badge = document.getElementById('pendingCount');
        if (badge) badge.style.display = 'none';
    }
}

async function approveAccount(id) {
    const confirmed = await showConfirmDialog({ title: 'Approve Account', message: 'Approve this pending instructor account? They will be able to log in immediately.', type: 'info', confirmText: 'Approve', cancelText: 'Cancel' });
    if (!confirmed) return;
    try {
        const data = await Api.approveAccount(id);
        if (data.status === 'success') {
            showToast(data.message, 'success');
            loadPendingAccounts();
            loadPendingCount();
        } else {
            showToast(data.message, 'error');
        }
    } catch (e) {
        showToast('Network error', 'error');
    }
}

async function deletePendingAccount(id) {
    const confirmed = await showConfirmDialog({ title: 'Delete Account', message: 'Delete this pending account? This cannot be undone.', type: 'warning', confirmText: 'Delete', cancelText: 'Cancel', danger: true });
    if (!confirmed) return;
    try {
        const data = await Api.deleteAccount(id, undefined);
        if (data.status === 'success') {
            showToast(data.message, 'success');
            loadPendingAccounts();
            loadPendingCount();
        } else {
            showToast(data.message, 'error');
        }
    } catch (e) {
        showToast('Network error', 'error');
    }
}

// ========== APPROVED ACCOUNTS ==========
function openApprovedModal() {
    openModalOverlay(document.getElementById('approvedModal'));
    loadApprovedAccounts();
}

function closeApprovedModal(e) {
    if (e && e.target !== e.currentTarget) return;
    closeModalOverlay(document.getElementById('approvedModal'));
}

async function loadApprovedAccounts() {
    try {
        const data = await Api.getApprovedAccounts();
        const tbody = document.getElementById('approvedAccountsBody');
        const table = document.getElementById('approvedAccountsTable');
        const noData = document.getElementById('noApprovedAccounts');

        if (data.status === 'success' && data.accounts && data.accounts.length > 0) {
            table.style.display = 'table';
            noData.style.display = 'none';
            tbody.innerHTML = '';
            data.accounts.forEach(a => {
                const tr = document.createElement('tr');

                const tdInstructor = document.createElement('td');
                tdInstructor.textContent = a.instructor_name;

                const tdUsername = document.createElement('td');
                tdUsername.textContent = a.username;

                const tdAction = document.createElement('td');
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'btn-delete-icon';
                btn.setAttribute('aria-label', 'Delete ' + a.username);
                btn.setAttribute('title', 'Delete account');
                btn.innerHTML = '<i class="fas fa-trash" aria-hidden="true"></i>';
                btn.addEventListener('click', () => deleteApprovedAccount(a.id, a.username));
                const isOwn = a.username === sessionStorage.getItem('accountUsername');
                if (isOwn) { btn.disabled = true; btn.setAttribute('disabled', ''); btn.title = 'Cannot delete your own account'; btn.setAttribute('aria-label', 'Cannot delete your own account'); }
                tdAction.appendChild(btn);

                tr.appendChild(tdInstructor);
                tr.appendChild(tdUsername);
                tr.appendChild(tdAction);
                tbody.appendChild(tr);
            });
        } else {
            table.style.display = 'none';
            noData.style.display = 'block';
        }
    } catch (e) {
        console.error('Error loading approved accounts:', e);
    }
}

async function loadApprovedCount() {
    try {
        const data = await Api.getApprovedAccounts();
        const badge = document.getElementById('approvedCount');
        if (data.status === 'success' && data.accounts && data.accounts.length > 0) {
            if (badge) {
                badge.textContent = data.accounts.length;
                badge.style.display = 'inline-block';
            }
        } else {
            if (badge) badge.style.display = 'none';
        }
    } catch (e) {
        const badge = document.getElementById('approvedCount');
        if (badge) badge.style.display = 'none';
    }
}

async function deleteApprovedAccount(id, username) {
    if (username && username === sessionStorage.getItem('accountUsername')) { showToast('You cannot delete your own account.', 'warning'); return; }
    const confirmed = await showConfirmDialog({ title: 'Delete Account', message: 'Delete this approved instructor account and ALL of its data (groups, ratings, sections)? This cannot be undone.', type: 'warning', confirmText: 'Delete', cancelText: 'Cancel', danger: true });
    if (!confirmed) return;
    try {
        const data = await Api.deleteAccount(id, sessionStorage.getItem('accountUsername'));
        if (data.status === 'success') {
            showToast(data.message, 'success');
            loadApprovedAccounts();
            loadApprovedCount();
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
    openModalOverlay(document.getElementById('resetModal'), '#resetConfirmName');
}

function closeResetModal(e) {
    if (e && e.target !== e.currentTarget) return;
    closeModalOverlay(document.getElementById('resetModal'));
}

// ========== DEVELOPER DETAILS MODAL ==========
function openDeveloperModal(e) {
    if (e) e.preventDefault();
    rememberFocus();
    const el = document.getElementById('developerModal');
    el.classList.add('dev-open');
    const closeBtn = el.querySelector('.modal-close');
    if (closeBtn) setTimeout(() => closeBtn.focus(), 40);
}

function closeDeveloperModal(e) {
    if (e && e.target !== e.currentTarget) return;
    document.getElementById('developerModal').classList.remove('dev-open');
    restoreFocus();
}

async function confirmResetRatings() {
    const typedName = document.getElementById('resetConfirmName').value.trim().toUpperCase();
    if (!typedName) {
        showToast('Please type your full name to confirm', 'error');
        setFieldError(document.getElementById('resetConfirmName'), 'Type your full name to confirm');
        return;
    }
    clearFieldError(document.getElementById('resetConfirmName'));

    const loading = showLoadingDialog('Deleting all ratings...');
    const confirmBtn = document.querySelector('#resetModal .modal-actions .btn-danger');
    setButtonLoading(confirmBtn, true);
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
    } finally {
        loading.close();
        setButtonLoading(confirmBtn, false);
    }
}

// ========== PASSWORD TOGGLE (Auth Forms) ==========
function toggleLoginPassword() {
    const el = document.getElementById('loginPassword');
    const btn = el.parentElement.querySelector('.btn-toggle-pass');
    const icon = btn.querySelector('i');
    if (el.type === 'password') {
        el.type = 'text';
        icon.className = 'fas fa-eye-slash';
        btn.setAttribute('aria-label', 'Hide password');
    } else {
        el.type = 'password';
        icon.className = 'fas fa-eye';
        btn.setAttribute('aria-label', 'Toggle password visibility');
    }
}

function toggleSignupPassword() {
    const el = document.getElementById('signupPassword');
    const btn = el.parentElement.querySelector('.btn-toggle-pass');
    const icon = btn.querySelector('i');
    if (el.type === 'password') {
        el.type = 'text';
        icon.className = 'fas fa-eye-slash';
        btn.setAttribute('aria-label', 'Hide password');
    } else {
        el.type = 'password';
        icon.className = 'fas fa-eye';
        btn.setAttribute('aria-label', 'Toggle password visibility');
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
        <input type="text" id="editUsernameInput" class="inline-edit-input" value="${current}" aria-label="Edit username" />
        <button class="btn-inline-save" onclick="saveEditUsername()" aria-label="Save username"><i class="fas fa-check"></i></button>
        <button class="btn-inline-cancel" onclick="cancelEditUsername()" aria-label="Cancel username edit"><i class="fas fa-times"></i></button>
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
    const td = document.querySelector('#passwordRow .profile-detail-value');
    td.innerHTML = `<div class="inline-edit-group">
        <input type="text" id="editPasswordInput" class="inline-edit-input" placeholder="New password" aria-label="New password" />
        <button class="btn-inline-save" onclick="saveEditPassword()" aria-label="Save password"><i class="fas fa-check"></i></button>
        <button class="btn-inline-cancel" onclick="cancelEditPassword()" aria-label="Cancel password edit"><i class="fas fa-times"></i></button>
    </div>`;
    document.getElementById('editPasswordInput').focus();
}

function cancelEditPassword() {
    const td = document.querySelector('#passwordRow .profile-detail-value');
    passwordVisible = false;
    td.innerHTML = `<div class="password-field">
        <span id="accountPassword" class="password-hidden">********</span>
        <button type="button" class="btn-toggle-password" onclick="togglePasswordVisibility()" aria-label="Toggle password visibility"><i class="fas fa-eye"></i></button>
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

// ========== UNIFIED POPUP / MESSAGE SYSTEM ==========
const UI_ICONS = {
    success: 'fa-check-circle',
    error: 'fa-times-circle',
    warning: 'fa-exclamation-triangle',
    info: 'fa-info-circle',
    confirm: 'fa-question-circle',
    loading: 'fa-spinner'
};

let _lastFocusedElement = null;
let _activeLoadingToast = null;

function rememberFocus() {
    _lastFocusedElement = document.activeElement;
}

function restoreFocus() {
    if (_lastFocusedElement && typeof _lastFocusedElement.focus === 'function') {
        try { _lastFocusedElement.focus(); } catch (e) {}
    }
    _lastFocusedElement = null;
}

function getToastContainer() {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('aria-atomic', 'false');
        document.body.appendChild(container);
    }
    return container;
}

function showToast(message, type = 'info', duration = 3800) {
    const container = getToastContainer();
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    const icon = UI_ICONS[type] || UI_ICONS.info;
    toast.innerHTML =
        '<div class="toast-icon"><i class="fas ' + icon + (type === 'loading' ? ' fa-spin' : '') + '"></i></div>' +
        '<div class="toast-content"><span class="toast-message"></span></div>' +
        '<button type="button" class="toast-close" aria-label="Dismiss notification"><i class="fas fa-times"></i></button>' +
        (type === 'loading' ? '' : '<div class="toast-progress"></div>');
    toast.querySelector('.toast-message').textContent = String(message == null ? '' : message);

    container.appendChild(toast);
    while (container.children.length > 5) container.removeChild(container.firstChild);

    let timer = null;
    const dismiss = () => {
        if (toast.classList.contains('toast-hide')) return;
        toast.classList.add('toast-hide');
        setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
    };

    toast.querySelector('.toast-close').addEventListener('click', dismiss);

    if (type !== 'loading') {
        toast.style.setProperty('--toast-duration', duration + 'ms');
        const progress = toast.querySelector('.toast-progress');
        const startTimer = () => { clearTimeout(timer); timer = setTimeout(dismiss, duration); };
        startTimer();
        toast.addEventListener('mouseenter', () => {
            clearTimeout(timer);
            if (progress) progress.style.animationPlayState = 'paused';
        });
        toast.addEventListener('mouseleave', () => {
            if (progress) progress.style.animationPlayState = 'running';
            startTimer();
        });
    }

    return { toast: toast, close: dismiss };
}

// Persistent "loading" toast for background operations.
function showLoadingToast(message) {
    if (_activeLoadingToast) _activeLoadingToast.close();
    _activeLoadingToast = showToast(message, 'loading');
    return _activeLoadingToast;
}

function hideLoadingToast() {
    if (_activeLoadingToast) {
        _activeLoadingToast.close();
        _activeLoadingToast = null;
    }
}

// --- Shared modal-overlay helpers (static modals) ---
function openModalOverlay(el, focusSelector) {
    if (!el) return;
    if (el._closeTimer) { clearTimeout(el._closeTimer); el._closeTimer = null; }
    rememberFocus();
    el.classList.remove('closing');
    el.style.display = 'flex';
    // Focus trap: keep Tab cycling inside the modal — contract §2.5 / §4.3
    if (!el._trapFn) {
        el._trapFn = function (e) { _trapFocus(el, e); };
        el.addEventListener('keydown', el._trapFn);
    }
    const target = focusSelector
        ? el.querySelector(focusSelector)
        : el.querySelector('.modal-close, input:not([type="hidden"]), select, button');
    if (target) setTimeout(() => target.focus(), 40);
}

function closeModalOverlay(el) {
    if (!el) return;
    if (el.classList.contains('closing')) return;
    // Play the scale-out exit animation, then hide — contract §2.5
    el.classList.add('closing');
    const hide = function () {
        el._closeTimer = null;
        el.style.display = 'none';
        el.classList.remove('closing');
        if (el._trapFn) {
            el.removeEventListener('keydown', el._trapFn);
            el._trapFn = null;
        }
        restoreFocus();
    };
    // Skip the exit-animation delay under prefers-reduced-motion — a11y
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        hide();
        return;
    }
    el._closeTimer = setTimeout(hide, 200);
}

// --- UI Dialog engine (alert / confirm / loading) ---
function _buildUiDialog(type, title, message, buttons) {
    const overlay = document.createElement('div');
    overlay.className = 'ui-dialog-overlay';
    const icon = UI_ICONS[type] || UI_ICONS.info;
    overlay.innerHTML =
        '<div class="ui-dialog" role="dialog" aria-modal="true" aria-label="' + escHtml(title || 'Dialog') + '">' +
            '<div class="ui-dialog-icon ui-dialog-icon-' + type + '"><i class="fas ' + icon + (type === 'loading' ? ' fa-spin' : '') + '"></i></div>' +
            '<h3 class="ui-dialog-title"></h3>' +
            '<p class="ui-dialog-message"></p>' +
            '<div class="ui-dialog-actions"></div>' +
        '</div>';
    overlay.querySelector('.ui-dialog-title').textContent = title;
    overlay.querySelector('.ui-dialog-message').textContent = message;
    const actions = overlay.querySelector('.ui-dialog-actions');
    buttons.forEach(btn => actions.appendChild(btn));
    document.body.appendChild(overlay);
    return overlay;
}

function _dialogButton(label, className, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn ' + className;
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    return btn;
}

function _trapFocus(overlay, e) {
    if (e.key !== 'Tab') return;
    const focusables = Array.from(overlay.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'));
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

function _closeDialog(overlay, onClosed) {
    overlay.classList.add('ui-dialog-closing');
    setTimeout(() => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        if (onClosed) onClosed();
    }, 200);
}

function showAlertDialog({ title = '', message = '', type = 'info', confirmText = 'OK', dismissible = true } = {}) {
    return new Promise(resolve => {
        rememberFocus();
        let closed = false;
        const okBtn = _dialogButton(confirmText, 'btn-success', () => close());
        const overlay = _buildUiDialog(type, title, message, [okBtn]);
        const close = () => {
            if (closed) return;
            closed = true;
            document.removeEventListener('keydown', onKey);
            _closeDialog(overlay, () => { restoreFocus(); resolve(); });
        };
        const onKey = e => {
            if (e.key === 'Escape') { e.preventDefault(); close(); }
            else _trapFocus(overlay, e);
        };
        overlay.addEventListener('click', e => { if (dismissible && e.target === overlay) close(); });
        document.addEventListener('keydown', onKey);
        setTimeout(() => okBtn.focus(), 30);
    });
}

function showConfirmDialog({ title = 'Are you sure?', message = '', type = 'warning', confirmText = 'Confirm', cancelText = 'Cancel', danger = false, dismissible = false } = {}) {
    return new Promise(resolve => {
        rememberFocus();
        let closed = false;
        const confirmBtn = _dialogButton(confirmText, danger ? 'btn-danger' : 'btn-success', () => close(true));
        const cancelBtn = _dialogButton(cancelText, 'ui-dialog-cancel', () => close(false));
        const overlay = _buildUiDialog(type, title, message, [cancelBtn, confirmBtn]);
        const close = result => {
            if (closed) return;
            closed = true;
            document.removeEventListener('keydown', onKey);
            _closeDialog(overlay, () => { restoreFocus(); resolve(result); });
        };
        const onKey = e => {
            if (e.key === 'Escape') { e.preventDefault(); close(false); }
            else _trapFocus(overlay, e);
        };
        overlay.addEventListener('click', e => { if (dismissible && e.target === overlay) close(false); });
        document.addEventListener('keydown', onKey);
        setTimeout(() => confirmBtn.focus(), 30);
    });
}

function showLoadingDialog(message = 'Please wait...') {
    const overlay = _buildUiDialog('loading', '', message, []);
    overlay.querySelector('.ui-dialog-title').style.display = 'none';
    overlay.querySelector('.ui-dialog-actions').style.display = 'none';
    return {
        close() {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        }
    };
}

// --- Escape key: closes dropdown → mobile sidebar → topmost static modal ---
document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    // Profile dropdown first — contract §4.4
    const dropdown = document.getElementById('profileDropdown');
    if (dropdown && dropdown.classList.contains('show')) {
        dropdown.classList.remove('show');
        return;
    }
    // Mobile sidebar next — contract §4.4
    const sidebar = document.getElementById('sidebar');
    const isMobile = window.matchMedia('(max-width: 768px)').matches || window.innerWidth <= 768;
    if (isMobile && sidebar && sidebar.classList.contains('open')) {
        toggleSidebar();
        return;
    }
    if (document.querySelector('.ui-dialog-overlay')) return; // ui-dialog handles its own Esc
    const overlays = Array.from(document.querySelectorAll('.modal-overlay')).filter(el => {
        const st = window.getComputedStyle(el);
        return st.display !== 'none' && st.visibility !== 'hidden';
    });
    if (!overlays.length) return;
    const top = overlays[overlays.length - 1];
    const closeBtn = top.querySelector('.modal-close');
    if (closeBtn) closeBtn.click();
});

// --- Inline validation: clear the error state as the user types — contract §2.2
document.addEventListener('input', function (e) {
    if (e.target && e.target.closest && e.target.closest('.form-group')) clearFieldError(e.target);
});
