// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCELDzEeIftr_-P70YyAqXC8Xv1SxbL9HI",
    authDomain: "expirymanage.firebaseapp.com",
    projectId: "expirymanage",
    storageBucket: "expirymanage.firebasestorage.app",
    messagingSenderId: "535617582285",
    appId: "1:535617582285:web:777014d41760c0173d2584",
    measurementId: "G-EHKNGLE1B3"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// DOM elements
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const mainApp = document.getElementById('main-app');
const authSection = document.getElementById('auth-section');
const userInfo = document.getElementById('user-info');
const loginPrompt = document.getElementById('login-prompt');
const userEmail = document.getElementById('user-email');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const doLogin = document.getElementById('do-login');
const doSignup = document.getElementById('do-signup');
const showSignup = document.getElementById('show-signup');
const showLogin = document.getElementById('show-login');
const medicineForm = document.getElementById('medicine-form');
const medicineNameInput = document.getElementById('medicine-name');
const medicineList = document.getElementById('medicine-list');
const emptyState = document.getElementById('empty-state');
const statusFilter = document.getElementById('status-filter');
const categoryFilter = document.getElementById('category-filter');
const searchInput = document.getElementById('search');
const totalMedicinesEl = document.getElementById('total-medicines');
const expiringSoonEl = document.getElementById('expiring-soon');
const expiredCountEl = document.getElementById('expired-count');

// Calendar elements
const expiryMonth = document.getElementById('expiry-month');
const expiryYear = document.getElementById('expiry-year');
const expiryDate = document.getElementById('expiry-date');

// App state
let medicines = [];
let currentUser = null;
let currentSort = { field: 'status', direction: 'asc' };

// Mobile action state
let longPressTimer = null;
let longPressTarget = null;

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    // Auth state observer
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            showApp();
        } else {
            currentUser = null;
            showAuth();
        }
    });

    // Auth event listeners
    loginBtn.addEventListener('click', () => showLoginForm());
    logoutBtn.addEventListener('click', () => auth.signOut());
    doLogin.addEventListener('click', handleLogin);
    doSignup.addEventListener('click', handleSignup);
    showSignup.addEventListener('click', (e) => {
        e.preventDefault();
        showSignupForm();
    });
    showLogin.addEventListener('click', (e) => {
        e.preventDefault();
        showLoginForm();
    });

    // Medicine form submission
    medicineForm.addEventListener('submit', function(e) {
        e.preventDefault();
        addMedicine();
    });
    
    // Convert medicine name to uppercase as user types
    medicineNameInput.addEventListener('input', function() {
        this.value = this.value.toUpperCase();
    });
    
    // Filter and search
    statusFilter.addEventListener('change', renderMedicines);
    categoryFilter.addEventListener('change', renderMedicines);
    searchInput.addEventListener('input', renderMedicines);
    
    // Initialize calendar dropdowns
    initializeCalendarDropdowns();
    
    // Initialize table sorting after the main app is shown
    setTimeout(initializeTableSorting, 100);
});

// Calendar dropdown functionality
function initializeCalendarDropdowns() {
    // Populate years (current year to 10 years in future)
    const currentYear = new Date().getFullYear();
    for (let i = currentYear; i <= currentYear + 10; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = i;
        expiryYear.appendChild(option);
    }
    
    // Add event listeners
    expiryMonth.addEventListener('change', updateHiddenDate);
    expiryYear.addEventListener('change', updateHiddenDate);
    
    // Set current date as default (first day of next month for better UX)
    setDefaultDate();
}

function updateHiddenDate() {
    const month = expiryMonth.value;
    const year = expiryYear.value;
    
    if (month && year) {
        // Set to first day of the month for consistency
        expiryDate.value = `${year}-${month}-01`;
    } else {
        expiryDate.value = '';
    }
}

function setDefaultDate() {
    const today = new Date();
    // Set to next month by default for better user experience
    expiryMonth.value = (today.getMonth() + 2).toString().padStart(2, '0');
    expiryYear.value = today.getFullYear();
    
    // If December, adjust year
    if (parseInt(expiryMonth.value) > 12) {
        expiryMonth.value = '01';
        expiryYear.value = today.getFullYear() + 1;
    }
    
    updateHiddenDate();
}

function setQuickDate(monthsToAdd = 0) {
    const date = new Date();
    date.setMonth(date.getMonth() + monthsToAdd);
    
    expiryMonth.value = (date.getMonth() + 1).toString().padStart(2, '0');
    expiryYear.value = date.getFullYear();
    updateHiddenDate();
}

// Initialize table sorting
function initializeTableSorting() {
    const sortableHeaders = document.querySelectorAll('th[data-sort]');
    if (sortableHeaders.length > 0) {
        sortableHeaders.forEach(th => {
            th.addEventListener('click', () => {
                const field = th.getAttribute('data-sort');
                sortMedicines(field);
            });
        });
    }
}

// Auth handlers
function handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    auth.signInWithEmailAndPassword(email, password)
        .then(() => {
            // Login successful
        })
        .catch(error => {
            alert('Login failed: ' + error.message);
        });
}

function handleSignup() {
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    
    auth.createUserWithEmailAndPassword(email, password)
        .then(() => {
            // Signup successful
        })
        .catch(error => {
            alert('Signup failed: ' + error.message);
        });
}

function showApp() {
    loginForm.classList.add('hidden');
    signupForm.classList.add('hidden');
    mainApp.classList.remove('hidden');
    userInfo.classList.remove('hidden');
    loginPrompt.classList.add('hidden');
    userEmail.textContent = currentUser.email;
    
    // Load user's medicines
    loadMedicines();
    
    // Initialize table sorting after a short delay to ensure DOM is ready
    setTimeout(initializeTableSorting, 100);
}

function showAuth() {
    mainApp.classList.add('hidden');
    userInfo.classList.add('hidden');
    loginPrompt.classList.remove('hidden');
    showLoginForm();
}

function showLoginForm() {
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
}

function showSignupForm() {
    signupForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
}

// Load medicines from Firestore
function loadMedicines() {
    if (!currentUser) return;
    
    db.collection('medicines')
        .where('userId', '==', currentUser.uid)
        .onSnapshot(snapshot => {
            medicines = [];
            snapshot.forEach(doc => {
                const medicine = doc.data();
                medicine.id = doc.id;
                medicines.push(medicine);
            });
            
            // Sort by status (expired first, then expiring soon)
            sortMedicines('status');
            updateStats();
        }, error => {
            console.error('Error loading medicines:', error);
        });
}

// Add a new medicine to Firestore
function addMedicine() {
    if (!currentUser) return;
    
    const name = document.getElementById('medicine-name').value.toUpperCase();
    const category = document.getElementById('medicine-category').value;
    const expiryDateValue = document.getElementById('expiry-date').value;
    
    if (!expiryDateValue) {
        alert('Please select a valid expiry month and year');
        return;
    }
    
    const newMedicine = {
        name,
        category,
        expiryDate: expiryDateValue,
        userId: currentUser.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    db.collection('medicines').add(newMedicine)
        .then(() => {
            medicineForm.reset();
            setDefaultDate(); // Reset to default date
        })
        .catch(error => {
            alert('Error adding medicine: ' + error.message);
        });
}

// Delete a medicine from Firestore
function deleteMedicine(id) {
    if (confirm('Are you sure you want to delete this medicine?')) {
        db.collection('medicines').doc(id).delete()
            .catch(error => {
                alert('Error deleting medicine: ' + error.message);
            });
    }
    hideMobileActionMenu();
}

// Edit a medicine
function editMedicine(id) {
    const medicine = medicines.find(m => m.id === id);
    if (medicine) {
        document.getElementById('medicine-name').value = medicine.name;
        document.getElementById('medicine-category').value = medicine.category;
        
        // Set the calendar dropdowns
        const expiryDate = new Date(medicine.expiryDate);
        expiryMonth.value = (expiryDate.getMonth() + 1).toString().padStart(2, '0');
        expiryYear.value = expiryDate.getFullYear();
        updateHiddenDate();
        
        // Remove the medicine being edited
        deleteMedicine(id);
    }
    hideMobileActionMenu();
}

// Sort medicines
function sortMedicines(field) {
    // Update current sort
    if (currentSort.field === field) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.field = field;
        currentSort.direction = 'asc';
    }
    
    // Update sort indicators - safely check if elements exist
    const sortableHeaders = document.querySelectorAll('th[data-sort]');
    if (sortableHeaders.length > 0) {
        sortableHeaders.forEach(th => {
            let indicator = th.querySelector('.sort-indicator');
            // Create indicator if it doesn't exist
            if (!indicator) {
                indicator = document.createElement('span');
                indicator.className = 'sort-indicator';
                th.appendChild(indicator);
            }
            
            if (th.getAttribute('data-sort') === field) {
                indicator.textContent = currentSort.direction === 'asc' ? '▲' : '▼';
            } else {
                indicator.textContent = '';
            }
        });
    }
    
    // Sort the medicines array
    medicines.sort((a, b) => {
        let aValue = a[field];
        let bValue = b[field];
        
        // Special handling for status sorting
        if (field === 'status') {
            aValue = getStatusPriority(a.expiryDate);
            bValue = getStatusPriority(b.expiryDate);
        }
        
        // Handle different data types
        if (typeof aValue === 'string') {
            aValue = aValue.toLowerCase();
            bValue = bValue.toLowerCase();
        }
        
        if (aValue < bValue) return currentSort.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return currentSort.direction === 'asc' ? 1 : -1;
        return 0;
    });
    
    renderMedicines();
}

// Get status priority for sorting (expired first, then expiring soon)
function getStatusPriority(expiryDate) {
    const daysUntilExpiry = getDaysUntilExpiry(expiryDate);
    if (daysUntilExpiry < 0) return 0; // Expired - highest priority
    if (daysUntilExpiry <= 30) return 1; // Expiring soon
    return 2; // Safe
}

// Render medicines in the table
function renderMedicines() {
    const statusFilterValue = statusFilter.value;
    const categoryFilterValue = categoryFilter.value;
    const searchValue = searchInput.value.toLowerCase();
    
    // Filter medicines based on status, category and search
    let filteredMedicines = medicines.filter(medicine => {
        const matchesStatus = statusFilterValue === 'all' || 
            (statusFilterValue === 'expired' && getDaysUntilExpiry(medicine.expiryDate) < 0) ||
            (statusFilterValue === 'expiring' && getDaysUntilExpiry(medicine.expiryDate) >= 0 && getDaysUntilExpiry(medicine.expiryDate) <= 30) ||
            (statusFilterValue === 'safe' && getDaysUntilExpiry(medicine.expiryDate) > 30);
        
        const matchesCategory = categoryFilterValue === 'all' || medicine.category === categoryFilterValue;
        
        const matchesSearch = medicine.name.toLowerCase().includes(searchValue);
        
        return matchesStatus && matchesCategory && matchesSearch;
    });
    
    // Clear the table
    medicineList.innerHTML = '';
    
    // Show empty state if no medicines
    if (filteredMedicines.length === 0) {
        emptyState.style.display = 'block';
        return;
    } else {
        emptyState.style.display = 'none';
    }
    
    // Add medicines to the table
    filteredMedicines.forEach(medicine => {
        const daysUntilExpiry = getDaysUntilExpiry(medicine.expiryDate);
        let statusClass = '';
        let statusText = '';
        
        if (daysUntilExpiry < 0) {
            statusClass = 'status-expired';
            statusText = 'Expired';
        } else if (daysUntilExpiry <= 30) {
            statusClass = 'status-warning';
            statusText = 'Expiring Soon';
        } else {
            statusClass = 'status-ok';
            statusText = 'Safe';
        }
        
        const row = document.createElement('tr');
        if (daysUntilExpiry < 0) {
            row.classList.add('expired');
        } else if (daysUntilExpiry <= 30) {
            row.classList.add('expiring-soon');
        }
        
        // Check if mobile to hide actions column
        const isMobile = window.innerWidth <= 768;
        
        row.innerHTML = `
            <td>${medicine.name}</td>
            <td>${medicine.category}</td>
            <td>${formatDate(medicine.expiryDate)}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            ${!isMobile ? `
            <td>
                <div class="action-buttons">
                    <button class="action-btn edit-btn" onclick="editMedicine('${medicine.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete-btn" onclick="deleteMedicine('${medicine.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
            ` : ''}
        `;
        
        // Add data attribute and touch events for mobile
        if (isMobile) {
            row.setAttribute('data-medicine-id', medicine.id);
            row.addEventListener('touchstart', handleTouchStart);
            row.addEventListener('touchend', handleTouchEnd);
            row.addEventListener('touchmove', handleTouchMove);
        }
        
        medicineList.appendChild(row);
    });
}

// Mobile touch handlers
function handleTouchStart(e) {
    if (window.innerWidth > 768) return;
    
    longPressTarget = e.currentTarget;
    longPressTimer = setTimeout(() => {
        showMobileActionMenu(longPressTarget);
    }, 500);
}

function handleTouchEnd() {
    clearTimeout(longPressTimer);
}

function handleTouchMove() {
    clearTimeout(longPressTimer);
}

function showMobileActionMenu(row) {
    const medicineId = row.getAttribute('data-medicine-id');
    if (!medicineId) return;
    
    const actionMenu = document.getElementById('mobile-action-menu');
    actionMenu.innerHTML = `
        <button class="action-menu-btn edit-btn" onclick="editMedicine('${medicineId}')">
            <i class="fas fa-edit"></i> Edit Medicine
        </button>
        <button class="action-menu-btn delete-btn" onclick="deleteMedicine('${medicineId}')">
            <i class="fas fa-trash"></i> Delete Medicine
        </button>
        <button class="action-menu-btn cancel-btn" onclick="hideMobileActionMenu()">
            <i class="fas fa-times"></i> Cancel
        </button>
    `;
    
    actionMenu.classList.remove('hidden');
    
    // Add overlay
    const overlay = document.createElement('div');
    overlay.className = 'action-menu-overlay';
    overlay.onclick = hideMobileActionMenu;
    document.body.appendChild(overlay);
}

function hideMobileActionMenu() {
    const actionMenu = document.getElementById('mobile-action-menu');
    const overlay = document.querySelector('.action-menu-overlay');
    
    if (actionMenu) actionMenu.classList.add('hidden');
    if (overlay) overlay.remove();
}

// Update statistics
function updateStats() {
    totalMedicinesEl.textContent = medicines.length;
    
    const expiredCount = medicines.filter(medicine => 
        getDaysUntilExpiry(medicine.expiryDate) < 0
    ).length;
    
    const expiringSoonCount = medicines.filter(medicine => {
        const days = getDaysUntilExpiry(medicine.expiryDate);
        return days >= 0 && days <= 30;
    }).length;
    
    expiredCountEl.textContent = expiredCount;
    expiringSoonEl.textContent = expiringSoonCount;
}

// Helper function to calculate days until expiry
function getDaysUntilExpiry(expiryDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    const diffTime = expiry - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

// Helper function to format date (shows only month and year)
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'long' };
    return new Date(dateString).toLocaleDateString('en-US', options);
}

// Add resize listener to update table when screen size changes
window.addEventListener('resize', function() {
    renderMedicines();
});

// Quick date functions for buttons
function setNextMonth() { setQuickDate(1); }
function setThreeMonths() { setQuickDate(3); }
function setSixMonths() { setQuickDate(6); }
function setOneYear() { setQuickDate(12); }