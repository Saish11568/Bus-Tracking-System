// ===== USER DATABASE =====

// Admin
const ADMIN_EMAIL = "admin@jcer.edu";

// Driver Access Codes
const DRIVER_CODES = [
    "DRV001",
    "DRV002",
    "DRV003",
    "DRV004"
];

// Example student USN format validator
function validateUSN(usn) {
    return /^[0-9A-Z]{8,15}$/i.test(usn);
}  


/**
 * College Bus Tracking System — Login Page Script
 * Handles: carousel/swipe navigation, touch/swipe gestures,
 *          password toggle, form validation, toast messages.
 */

/* ───────────────────────────────────────────
   STATE
─────────────────────────────────────────── */
const ROLES = ['student', 'driver', 'admin'];
let currentIndex = 0;         // Active card index (0 = student, 1 = driver, 2 = admin)
let isAnimating = false;     // Guard against rapid clicks

/* ───────────────────────────────────────────
   DOM REFERENCES
─────────────────────────────────────────── */
const cards = document.querySelectorAll('.login-card');      // NodeList of 3 cards
const roleTabs = document.querySelectorAll('.role-tab');        // Tab buttons
const dots = document.querySelectorAll('.dot');             // Dot indicators
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const toastEl = document.getElementById('toast');

/* ───────────────────────────────────────────
   CAROUSEL NAVIGATION
─────────────────────────────────────────── */

/**
 * Navigate to a specific card by index.
 * @param {number} targetIndex  - 0, 1, or 2
 * @param {number} direction    - +1 for right→left, -1 for left→right
 */
function goTo(targetIndex) {

    if (isAnimating || targetIndex === currentIndex) return;

    isAnimating = true;

    const currentCard = cards[currentIndex];
    const nextCard = cards[targetIndex];

    // remove active from current card
    currentCard.classList.remove("active");

    // add active to next card
    nextCard.classList.add("active");

    currentIndex = targetIndex;

    updateUI();

    setTimeout(() => {
        isAnimating = false;
    }, 350); // match CSS animation time
}


/** Sync role-tabs, dots, arrow states */
function updateUI() {
    // Role tabs
    roleTabs.forEach((tab, i) => {
        tab.classList.toggle('active', i === currentIndex);
    });

    // Dot indicators
    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === currentIndex);
    });

    // Arrow disabled states
    prevBtn.disabled = currentIndex === 0;
    nextBtn.disabled = currentIndex === ROLES.length - 1;
}

// Initialise UI state
updateUI();

// Arrow buttons
prevBtn.addEventListener('click', () => {
    if (currentIndex > 0) goTo(currentIndex - 1, -1);
});
nextBtn.addEventListener('click', () => {
    if (currentIndex < ROLES.length - 1) goTo(currentIndex + 1, 1);
});

// Role tabs
roleTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const idx = parseInt(tab.dataset.index, 10);
        goTo(idx, idx > currentIndex ? 1 : -1);
    });
});

// Dot indicators
dots.forEach(dot => {
    dot.addEventListener('click', () => {
        const idx = parseInt(dot.dataset.index, 10);
        goTo(idx, idx > currentIndex ? 1 : -1);
    });
});

/* ───────────────────────────────────────
   TOUCH / SWIPE SUPPORT
─────────────────────────────────────── */
let touchStartX = 0;
let touchStartY = 0;

const carousel = document.getElementById('carouselContainer');

carousel.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].clientX;
    touchStartY = e.changedTouches[0].clientY;
}, { passive: true });

carousel.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;

    // Only horizontal swipes (dx > dy ensures it's not a vertical scroll)
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0 && currentIndex < ROLES.length - 1) {
            goTo(currentIndex + 1, 1);   // swipe left  → next
        } else if (dx > 0 && currentIndex > 0) {
            goTo(currentIndex - 1, -1);  // swipe right → prev
        }
    }
}, { passive: true });



/* ───────────────────────────────────────────
   PASSWORD VISIBILITY TOGGLE
─────────────────────────────────────────── */
document.querySelectorAll('.toggle-pw').forEach(btn => {
    btn.addEventListener('click', () => {
        const input = btn.closest('.input-group').querySelector('input');
        const icon = btn.querySelector('i');

        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.replace('ph-eye', 'ph-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.replace('ph-eye-slash', 'ph-eye');
        }
    });
});

/* ───────────────────────────────────────────
   FORM VALIDATION & SUBMISSION
─────────────────────────────────────────── */

/**
 * Simple email regex check
 */
function isValidEmail(val) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
}

/**
 * Shake an input-group to indicate validation error
 */
function shakeInput(inputEl) {
    const group = inputEl.closest('.input-group');
    group.classList.add('shake');
    setTimeout(() => group.classList.remove('shake'), 500);
}

/**
 * Show a toast message
 * @param {string} msg     - Message text
 * @param {'success'|'error'|''} type
 * @param {number} duration - ms
 */
function showToast(msg, type = '', duration = 2800) {
    toastEl.textContent = msg;
    toastEl.className = 'toast'; // reset
    if (type) toastEl.classList.add(type);
    toastEl.classList.add('show');

    setTimeout(() => {
        toastEl.classList.remove('show');
    }, duration);
}

/**
 * Simulate login API call (replace with your real fetch)
 */
/**
 * Generic form submit handler factory
 */
function makeSubmitHandler(role, idField) {
    return async function (e) {

        e.preventDefault();

        const form = e.currentTarget;
        const idInput = form.querySelector(`#${idField}`);
        const pwInput = form.querySelector(`[type="password"]`);
        const btn = form.querySelector('.login-btn');

        const idVal = idInput.value.trim();
        const password = pwInput.value.trim();

        if (!idVal) {
            shakeInput(idInput);
            showToast("Please enter required field.", "error");
            return;
        }

        if (!password) {
            shakeInput(pwInput);
            showToast("Please enter password.", "error");
            return;
        }

        btn.classList.add('loading');
        btn.querySelector('span').textContent = 'Signing in';

        try {

            // 🌐 Internet check
            if (!navigator.onLine) {
                throw new Error("No internet connection");
            }

            // 🔒 Validations
            if (role === "student" && !validateUSN(idVal)) {
                throw new Error("Invalid USN");
            }

            if (role === "driver" && !DRIVER_CODES.includes(idVal.toUpperCase())) {
                throw new Error("Invalid Driver ID");
            }

            if (role === "admin" && idVal !== ADMIN_EMAIL) {
                throw new Error("Unauthorized Admin");
            }

            // 🔥 SINGLE API CALL
            const res = await fetch("http://localhost:5000/api/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email: idVal,
                    password: password,
                    role: role
                })
            });

            let data;
            try {
                data = await res.json();
            } catch {
                throw new Error("Server error");
            }

            if (!res.ok) {
                throw new Error(data.message || "Login failed");
            }

            // ✅ Store data
            localStorage.setItem("token", data.token);
            localStorage.setItem("role", data.role);

            if (role === "student") localStorage.setItem("studentUSN", idVal);
            if (role === "driver") localStorage.setItem("driverCode", idVal);
            if (role === "admin") localStorage.setItem("adminEmail", idVal);

            showToast("✓ Login successful", "success");

            // 🔁 Redirect
            setTimeout(() => {
                if (data.role === "admin") window.location.href = "admin.html";
                else if (data.role === "driver") window.location.href = "driver.html";
                else window.location.href = "index.html";
            }, 1000);

        } catch (err) {

            showToast(err.message || "Login failed", "error");

            btn.classList.remove('loading');
            btn.querySelector('span').textContent = 'Sign In';
        }
    };
}   
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Bind handlers
document.getElementById('form-student')
    .addEventListener('submit', makeSubmitHandler('student', 'student-email'));

document.getElementById('form-driver')
    .addEventListener('submit', makeSubmitHandler('driver', 'driver-id'));

document.getElementById('form-admin')
    .addEventListener('submit', makeSubmitHandler('admin', 'admin-user'));

/* ───────────────────────────────────────────
   SUBTLE PARALLAX on mouse-move (desktop)
─────────────────────────────────────────── */
document.addEventListener('mousemove', e => {
    const { innerWidth: W, innerHeight: H } = window;
    const x = (e.clientX / W - 0.5) * 14;
    const y = (e.clientY / H - 0.5) * 10;

    // Parallax geo lines
    document.querySelectorAll('.geo-line').forEach((el, i) => {
        const f = (i + 1) * 0.3;
        el.style.transform = `translateX(${x * f}px) translateY(${y * f}px) rotate(${el.dataset.rot || 0}deg)`;
    });
});

/* ═══════════════════════════════════════════════════
   REGISTER MODAL
═══════════════════════════════════════════════════ */

const regModal = document.getElementById('regModal');
const regForm = document.getElementById('reg-form');
const regSubmitBtn = document.getElementById('reg-submit-btn');
const regModalIcon = document.getElementById('regModalIcon');

/** Per-role config for the register modal */
const ROLE_REG_META = {
    student: {
        title: 'Student Registration',
        sub: 'Create your student account',
        idPlaceholder: 'Student email address',
        idType: 'email',
        idIconClass: 'ph ph-envelope-simple',
        iconClass: '',          // default yellow-orange gradient
        btnClass: 'login-btn',
        phosphorIcon: 'ph-fill ph-student',
    },
    driver: {
        title: 'Driver Registration',
        sub: 'Register as a bus driver',
        idPlaceholder: 'Driver ID or email',
        idType: 'text',
        idIconClass: 'ph ph-identification-card',
        iconClass: 'driver-icon',
        btnClass: 'login-btn driver-btn',
        phosphorIcon: 'ph-fill ph-steering-wheel',
    },
    admin: {
        title: 'Admin Registration',
        sub: 'Request administrative access',
        idPlaceholder: 'Admin username',
        idType: 'text',
        idIconClass: 'ph ph-shield-check',
        iconClass: 'admin-icon',
        btnClass: 'login-btn admin-btn',
        phosphorIcon: 'ph-fill ph-shield-check',
    },
};

let activeRegRole = 'student';

/**
 * Open the register modal configured for the given role.
 * @param {'student'|'driver'|'admin'} role
 */
function openRegisterModal(role) {
    activeRegRole = role;
    const meta = ROLE_REG_META[role];

    // Update title / subtitle
    document.getElementById('regModalTitle').textContent = meta.title;
    document.getElementById('regModalSub').textContent = meta.sub;

    // Update ID field placeholder, type, and icon
    const regIdInput = document.getElementById('reg-id');
    const regIdIcon = document.getElementById('reg-id-icon').querySelector('i');
    regIdInput.placeholder = meta.idPlaceholder;
    regIdInput.type = meta.idType;
    regIdIcon.className = meta.idIconClass;

    // Update the icon badge
    regModalIcon.className = 'reg-modal-icon ' + meta.iconClass;
    regModalIcon.innerHTML = `<i class="${meta.phosphorIcon}"></i>`;

    // Update the submit button style
    regSubmitBtn.className = meta.btnClass;
    regSubmitBtn.querySelector('span').textContent = 'Create Account';

    // Reset form and reveal modal
    regForm.reset();
    regModal.classList.add('open');
}

/** Close the register modal */
function closeRegisterModal() {
    regModal.classList.remove('open');
}

/* Password toggles inside the modal */
regModal.querySelectorAll('.toggle-pw').forEach(btn => {
    btn.addEventListener('click', () => {
        const input = btn.closest('.input-group').querySelector('input');
        const icon = btn.querySelector('i');
        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.replace('ph-eye', 'ph-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.replace('ph-eye-slash', 'ph-eye');
        }
    });
});

/* Register form submission */
regForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const nameEl = document.getElementById('reg-name');
    const idEl = document.getElementById('reg-id');
    const pwEl = document.getElementById('reg-password');
    const confirmEl = document.getElementById('reg-confirm');

    const name = nameEl.value.trim();
    const id = idEl.value.trim();
    const pw = pwEl.value;
    const confirm = confirmEl.value;

    let valid = true;

    // Required field checks
    if (!name) { shakeInput(nameEl); valid = false; }
    if (!id) { shakeInput(idEl); valid = false; }
    if (!pw) { shakeInput(pwEl); valid = false; }
    if (!confirm) { shakeInput(confirmEl); valid = false; }

    if (!valid) {
        showToast('Please fill in all fields.', 'error');
        return;
    }

    // Email validation for student role
    if (activeRegRole === 'student' && !isValidEmail(id)) {
        shakeInput(idEl);
        showToast('Please enter a valid email address.', 'error');
        return;
    }

    // Password match
    if (pw !== confirm) {
        shakeInput(confirmEl);
        showToast('Passwords do not match.', 'error');
        return;
    }

    // Password length
    if (pw.length < 6) {
        shakeInput(pwEl);
        showToast('Password must be at least 6 characters.', 'error');
        return;
    }

    // Loading state
    regSubmitBtn.classList.add('loading');
    regSubmitBtn.querySelector('span').textContent = 'Creating account';

    // Simulate API call
    await new Promise(r => setTimeout(r, 1300));

    // Success
    closeRegisterModal();
    regSubmitBtn.classList.remove('loading');
    regSubmitBtn.querySelector('span').textContent = 'Create Account';
    showToast(`✓ Account created! Welcome, ${name}. Please sign in.`, 'success', 3500);
});

/* Close modal on Escape key */
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeRegisterModal();

    // Also handle left/right arrow carousel navigation (only when modal is closed)
    if (regModal.classList.contains('open')) return;
    if (e.key === 'ArrowRight' && currentIndex < ROLES.length - 1) {
        goTo(currentIndex + 1, 1);
    } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        goTo(currentIndex - 1, -1);
    }
});
window.onload = () => {

    const student = localStorage.getItem("studentUSN");
    const driver = localStorage.getItem("driverCode");

    if (student) {
        document.getElementById("student-email").value = student;
    }

    if (driver) {
        document.getElementById("driver-id").value = driver;
    }

};