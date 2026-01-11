// Firebase Configuration - REPLACE WITH YOUR ACTUAL CONFIG
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
let app, auth, db;
try {
  if (!firebase.apps.length) {
    app = firebase.initializeApp(firebaseConfig);
  } else {
    app = firebase.app();
  }
  auth = firebase.auth();
  db = firebase.firestore();
  console.log("Firebase initialized successfully");
} catch (error) {
  console.error("Firebase initialization error:", error);
}

// Global variables
let currentUser = null;
let medicines = [];
let scannedMedicines = [];
let currentSort = { field: 'expiryDate', direction: 'asc' };
let isScanning = false;
let editingScannedIndex = null;

// DOM Elements
document.getElementById("imageInput")
document.getElementById("scanBtn")
document.getElementById("ocrResults")

const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const mainApp = document.getElementById('main-app');
const authSection = document.getElementById('auth-section');
const userInfo = document.getElementById('user-info');
const userEmail = document.getElementById('user-email');
const loginPrompt = document.getElementById('login-prompt');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const doLoginBtn = document.getElementById('do-login');
const doSignupBtn = document.getElementById('do-signup');
const showSignup = document.getElementById('show-signup');
const showLogin = document.getElementById('show-login');
const medicineForm = document.getElementById('medicine-form');
const medicineList = document.getElementById('medicine-list');
const emptyState = document.getElementById('empty-state');
const statusFilter = document.getElementById('status-filter');
const categoryFilter = document.getElementById('category-filter');
const searchInput = document.getElementById('search');
const dropZone = document.getElementById('dropZone');
const imageInput = document.getElementById('imageInput');
const scanResults = document.getElementById('scan-results');
const ocrOutput = document.getElementById('ocr-output');
const scanLoading = document.getElementById('scan-loading');
const clearScanBtn = document.getElementById('clearScan');
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

// Debug function
function debugLog(message, data = null) {
  console.log(`[DEBUG] ${message}`, data || '');
}

// Initialize year dropdown
function initYearDropdown() {
  const yearSelect = document.getElementById('expiry-year');
  if (!yearSelect) return;

  yearSelect.innerHTML = '<option value="">Year</option>';
  const currentYear = new Date().getFullYear();
  for (let i = currentYear; i <= currentYear + 10; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = i;
    yearSelect.appendChild(option);
  }
}

// Authentication State Listener
auth.onAuthStateChanged((user) => {
  debugLog('Auth state changed:', user ? `User logged in: ${user.email}` : 'No user');

  if (user) {
    currentUser = user;
    userEmail.textContent = user.email;
    userInfo.classList.remove('hidden');
    loginPrompt.classList.add('hidden');
    loginForm.classList.add('hidden');
    signupForm.classList.add('hidden');
    mainApp.classList.remove('hidden');
    loadMedicines();
  } else {
    currentUser = null;
    userInfo.classList.add('hidden');
    loginPrompt.classList.remove('hidden');
    mainApp.classList.add('hidden');
    medicines = [];
    renderMedicines();
  }
});

// Auth Event Listeners
loginBtn.addEventListener('click', () => {
  loginForm.classList.remove('hidden');
  signupForm.classList.add('hidden');
});

showSignup.addEventListener('click', (e) => {
  e.preventDefault();
  loginForm.classList.add('hidden');
  signupForm.classList.remove('hidden');
});

showLogin.addEventListener('click', (e) => {
  e.preventDefault();
  signupForm.classList.add('hidden');
  loginForm.classList.remove('hidden');
});

doLoginBtn.addEventListener('click', () => {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  if (!email || !password) {
    showNotification('Please fill in all fields', 'error');
    return;
  }

  auth.signInWithEmailAndPassword(email, password)
    .then(() => {
      showNotification('Logged in successfully', 'success');
    })
    .catch((error) => {
      console.error('Login error:', error);
      showNotification(error.message, 'error');
    });
});

doSignupBtn.addEventListener('click', () => {
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;

  if (!email || !password) {
    showNotification('Please fill in all fields', 'error');
    return;
  }

  if (password.length < 6) {
    showNotification('Password must be at least 6 characters', 'error');
    return;
  }

  auth.createUserWithEmailAndPassword(email, password)
    .then(() => {
      showNotification('Account created successfully', 'success');
    })
    .catch((error) => {
      console.error('Signup error:', error);
      showNotification(error.message, 'error');
    });
});

logoutBtn.addEventListener('click', () => {
  auth.signOut()
    .then(() => {
      showNotification('Logged out successfully', 'success');
    })
    .catch((error) => {
      console.error('Logout error:', error);
      showNotification(error.message, 'error');
    });
});

// Tab switching
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const tabId = tab.getAttribute('data-tab');

    // Update active tab
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    // Show corresponding content
    tabContents.forEach(content => {
      content.classList.remove('active');
      if (content.id === `${tabId}-tab`) {
        content.classList.add('active');
      }
    });
  });
});

// Load medicines from Firestore
function loadMedicines() {
  if (!currentUser) {
    debugLog('No current user, cannot load medicines');
    return;
  }

  debugLog('Loading medicines for user:', currentUser.uid);

  // Clear current medicines
  medicines = [];
  renderMedicines();

  // Set up real-time listener
  db.collection('medicines')
    .where('userId', '==', currentUser.uid)
    .orderBy('addedDate', 'desc')
    .onSnapshot((snapshot) => {
      debugLog('Firestore snapshot received, documents:', snapshot.size);

      medicines = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        const medicine = {
          id: doc.id,
          ...data
        };

        // Ensure status is calculated
        if (!medicine.status || medicine.status === 'undefined') {
          medicine.status = getExpiryStatus(medicine.expiryDate);
        }

        // Convert Firestore timestamp to Date if needed
        if (medicine.addedDate && medicine.addedDate.toDate) {
          medicine.addedDate = medicine.addedDate.toDate().toISOString();
        }

        medicines.push(medicine);
        debugLog('Loaded medicine:', medicine.name);
      });

      debugLog('Total medicines loaded:', medicines.length);
      renderMedicines();
      updateStats();

      // Check for empty state
      if (medicines.length === 0) {
        debugLog('No medicines found in database');
      }
    }, (error) => {
      console.error('Error loading medicines:', error);
      showNotification('Error loading medicines: ' + error.message, 'error');
    });
}

// Render medicines to table
function renderMedicines() {
  debugLog('Rendering medicines, count:', medicines.length);

  const statusFilterValue = statusFilter ? statusFilter.value : 'all';
  const categoryFilterValue = categoryFilter ? categoryFilter.value : 'all';
  const searchValue = searchInput ? searchInput.value.toLowerCase() : '';

  let filteredMedicines = medicines.filter(medicine => {
    // Status filter
    if (statusFilterValue !== 'all') {
      if (statusFilterValue === 'expired' && medicine.status !== 'expired') return false;
      if (statusFilterValue === 'expiring' && medicine.status !== 'warning') return false;
      if (statusFilterValue === 'safe' && medicine.status !== 'ok') return false;
    }

    // Category filter
    if (categoryFilterValue !== 'all' && medicine.category !== categoryFilterValue) {
      return false;
    }

    // Search filter
    if (searchValue && !medicine.name.toLowerCase().includes(searchValue)) {
      return false;
    }

    return true;
  });

  // Sort medicines
  filteredMedicines.sort((a, b) => {
    let aValue = a[currentSort.field];
    let bValue = b[currentSort.field];

    if (currentSort.field === 'expiryDate') {
      aValue = parseExpiryDate(aValue);
      bValue = parseExpiryDate(bValue);
    }

    if (currentSort.direction === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  if (!medicineList) {
    console.error('medicineList element not found!');
    return;
  }

  if (filteredMedicines.length === 0) {
    if (emptyState) emptyState.classList.remove('hidden');
    medicineList.innerHTML = '';
    debugLog('No filtered medicines to display');
  } else {
    if (emptyState) emptyState.classList.add('hidden');
    medicineList.innerHTML = '';

    filteredMedicines.forEach(medicine => {
      const row = document.createElement('tr');
      row.className = medicine.status === 'expired' ? 'expired-row' :
        medicine.status === 'warning' ? 'expiring-soon-row' : '';

      const statusText = medicine.status === 'expired' ? 'Expired' :
        medicine.status === 'warning' ? 'Expiring Soon' : 'Safe';
      const statusClass = medicine.status === 'expired' ? 'status-expired' :
        medicine.status === 'warning' ? 'status-warning' : 'status-ok';

      row.innerHTML = `
                <td>${medicine.name || 'Unknown'}</td>
                <td>${medicine.category || 'Other'}</td>
                <td>${formatExpiryDate(medicine.expiryDate)}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
    
                <td class="action-buttons-cell">
                    <button class="action-btn edit-btn" onclick="editMedicine('${medicine.id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete-btn" onclick="deleteMedicine('${medicine.id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
      medicineList.appendChild(row);
    });

    debugLog(`Displayed ${filteredMedicines.length} medicines in table`);
  }
}

// Sort table
document.addEventListener('DOMContentLoaded', () => {
  // Wait for DOM to be fully loaded before adding sort listeners
  setTimeout(() => {
    const sortableHeaders = document.querySelectorAll('th[data-sort]');
    sortableHeaders.forEach(th => {
      th.addEventListener('click', () => {
        const field = th.getAttribute('data-sort');

        if (currentSort.field === field) {
          currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
          currentSort.field = field;
          currentSort.direction = 'asc';
        }

        // Update sort indicators
        document.querySelectorAll('.sort-indicator').forEach(indicator => {
          indicator.textContent = '▼';
        });
        const indicator = th.querySelector('.sort-indicator');
        if (indicator) {
          indicator.textContent = currentSort.direction === 'asc' ? '▼' : '▲';
        }

        renderMedicines();
      });
    });
  }, 1000);
});

// Filter and search event listeners
if (statusFilter) {
  statusFilter.addEventListener('change', renderMedicines);
}
if (categoryFilter) {
  categoryFilter.addEventListener('change', renderMedicines);
}
if (searchInput) {
  searchInput.addEventListener('input', renderMedicines);
}

// Update stats
function updateStats() {
  const total = medicines.length;
  const expired = medicines.filter(m => m.status === 'expired').length;
  const expiring = medicines.filter(m => m.status === 'warning').length;
  const safe = medicines.filter(m => m.status === 'ok').length;

  debugLog('Updating stats:', { total, expired, expiring, safe });

  const totalEl = document.getElementById('total-medicines');
  const expiredEl = document.getElementById('expired-count');
  const expiringEl = document.getElementById('expiring-soon');
  const safeEl = document.getElementById('safe-count');

  if (totalEl) totalEl.textContent = total;
  if (expiredEl) expiredEl.textContent = expired;
  if (expiringEl) expiringEl.textContent = expiring;
  if (safeEl) safeEl.textContent = safe;
}

// Get expiry status
function getExpiryStatus(expiryDate) {
  if (!expiryDate) return 'ok';

  try {
    const [month, year] = expiryDate.split('/').map(Number);
    const expiry = new Date(year, month - 1);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffTime = expiry - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'expired';
    if (diffDays <= 30) return 'warning';
    return 'ok';
  } catch (error) {
    console.error('Error calculating expiry status:', error);
    return 'ok';
  }
}

// Parse expiry date for sorting
function parseExpiryDate(dateStr) {
  if (!dateStr) return new Date();

  try {
    const [month, year] = dateStr.split('/').map(Number);
    return new Date(year, month - 1);
  } catch (error) {
    return new Date();
  }
}

// Format expiry date for display
function formatExpiryDate(dateStr) {
  if (!dateStr) return 'N/A';

  try {
    const [month, year] = dateStr.split('/');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIndex = parseInt(month) - 1;

    if (monthIndex >= 0 && monthIndex < 12) {
      return `${monthNames[monthIndex]} ${year}`;
    }
    return dateStr;
  } catch (error) {
    return dateStr;
  }
}

// Edit medicine from inventory
function editMedicine(id) {
  const medicine = medicines.find(m => m.id === id);
  if (!medicine) {
    showNotification('Medicine not found', 'error');
    return;
  }

  document.getElementById('medicine-name').value = medicine.name;
  document.getElementById('medicine-category').value = medicine.category;

  const [month, year] = medicine.expiryDate.split('/');
  document.getElementById('expiry-month').value = month.padStart(2, '0');
  document.getElementById('expiry-year').value = year;
  document.getElementById('notes').value = medicine.notes || '';

  // Set edit mode on form
  medicineForm.dataset.editingId = id;
  
  // Change button text
  const submitBtn = medicineForm.querySelector('button[type="submit"]');
  submitBtn.innerHTML = '<i class="fas fa-save"></i> Update Medicine';
  submitBtn.className = 'btn btn-warning';

  // Show cancel button
  const cancelBtn = document.getElementById('cancel-edit-btn');
  if (cancelBtn) {
    cancelBtn.style.display = 'inline-block';
  }

  // Switch to manual tab
  switchToTab('manual');

  showNotification('Edit mode activated. Update fields and click "Update Medicine"', 'info');
}

// Medicine Form Submission
medicineForm.addEventListener('submit', function (e) {
  e.preventDefault();

  const name = document.getElementById('medicine-name').value.trim();
  const category = document.getElementById('medicine-category').value;
  const month = document.getElementById('expiry-month').value;
  const year = document.getElementById('expiry-year').value;
  const notes = document.getElementById('notes').value.trim();

  if (!name || !category || !month || !year) {
    showNotification('Please fill in all required fields', 'error');
    return;
  }

  const expiryDate = `${month.padStart(2, '0')}/${year}`;
  const status = getExpiryStatus(expiryDate);

  // Check if we're editing a scanned medicine
  const isEditingScanned = medicineForm.dataset.editingScanned === 'true';
  const scannedIndex = medicineForm.dataset.editingScannedIndex;

  if (isEditingScanned && scannedIndex !== null && scannedIndex !== undefined) {
    // UPDATE scanned medicine
    scannedMedicines[scannedIndex] = {
      name: name.toUpperCase(),
      category,
      expiryDate,
      quantity: 1
    };

    // Return to scan tab
    switchToTab('scan');
    // Refresh scan results
    displayScanResults(scannedMedicines);
    showNotification('Scanned medicine updated successfully', 'success');
    
    // Reset form
    resetForm();
    return;
  }

  // Check if we're in edit mode for inventory medicine
  const isEditMode = medicineForm.dataset.editingId !== undefined;

  if (isEditMode) {
    // UPDATE existing medicine in inventory
    const medicineId = medicineForm.dataset.editingId;
    const updatedMedicine = {
      name: name.toUpperCase(),
      category,
      expiryDate,
      notes,
      status,
      updatedDate: firebase.firestore.FieldValue.serverTimestamp(),
      userId: currentUser.uid
    };

    db.collection('medicines').doc(medicineId).update(updatedMedicine)
      .then(() => {
        showNotification('Medicine updated successfully', 'success');
        resetForm();
      })
      .catch((error) => {
        console.error('Error updating medicine:', error);
        if (error.code === 'permission-denied') {
          showNotification('Permission denied. Make sure you own this medicine.', 'error');
        } else {
          showNotification('Error updating medicine: ' + error.message, 'error');
        }
      });
  } else {
    // ADD new medicine to inventory
    const newMedicine = {
      name: name.toUpperCase(),
      category,
      expiryDate,
      notes,
      status,
      addedDate: firebase.firestore.FieldValue.serverTimestamp(),
      userId: currentUser.uid
    };

    db.collection('medicines').add(newMedicine)
      .then((docRef) => {
        console.log('Medicine added with ID:', docRef.id);
        showNotification('Medicine added successfully', 'success');
        resetForm();
      })
      .catch((error) => {
        console.error('Error adding medicine:', error);
        if (error.code === 'permission-denied') {
          showNotification('Permission denied. Check Firestore rules.', 'error');
        } else {
          showNotification('Error adding medicine: ' + error.message, 'error');
        }
      });
  }
});

// Reset form
function resetForm() {
  medicineForm.reset();
  document.getElementById('expiry-month').value = '';
  document.getElementById('expiry-year').value = '';

  // Clear edit modes
  delete medicineForm.dataset.editingId;
  delete medicineForm.dataset.editingScanned;
  delete medicineForm.dataset.editingScannedIndex;

  // Reset button
  const submitBtn = medicineForm.querySelector('button[type="submit"]');
  submitBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Add Medicine';
  submitBtn.classList.remove('btn-warning');
  submitBtn.classList.add('btn-primary');

  // Hide cancel button
  const cancelBtn = document.getElementById('cancel-edit-btn');
  if (cancelBtn) {
    cancelBtn.style.display = 'none';
  }
}

// Add cancel edit button functionality
function addCancelEditButton() {
  const form = document.getElementById('medicine-form');
  const existingCancelBtn = document.getElementById('cancel-edit-btn');

  if (existingCancelBtn) {
    existingCancelBtn.remove();
  }

  const cancelBtn = document.createElement('button');
  cancelBtn.id = 'cancel-edit-btn';
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn btn-secondary mt-10';
  cancelBtn.innerHTML = '<i class="fas fa-times"></i> Cancel Edit';
  cancelBtn.style.marginLeft = '10px';
  cancelBtn.style.display = 'none';

  cancelBtn.addEventListener('click', () => {
    resetForm();
    showNotification('Edit cancelled', 'info');
  });

  // Insert after the submit button
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.parentNode.insertBefore(cancelBtn, submitBtn.nextSibling);
}

// Delete medicine from inventory
function deleteMedicine(id) {
  if (confirm('Are you sure you want to delete this medicine?')) {
    db.collection('medicines').doc(id).delete()
      .then(() => {
        showNotification('Medicine deleted successfully', 'success');
      })
      .catch((error) => {
        console.error('Error deleting medicine:', error);
        showNotification('Error deleting medicine: ' + error.message, 'error');
      });
  }
}

// Switch to tab
function switchToTab(tabId) {
  tabs.forEach(t => {
    if (t.getAttribute('data-tab') === tabId) {
      t.classList.add('active');
    } else {
      t.classList.remove('active');
    }
  });

  tabContents.forEach(c => {
    if (c.id === `${tabId}-tab`) {
      c.classList.add('active');
    } else {
      c.classList.remove('active');
    }
  });
}

// OCR Bill Scanning - Fixed to prevent double scanning
if (dropZone) {
  dropZone.addEventListener('click', () => {
    if (!isScanning) {
      imageInput.click();
    }
  });

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--primary)';
    dropZone.style.backgroundColor = 'rgba(44, 127, 184, 0.05)';
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.style.borderColor = 'var(--gray)';
    dropZone.style.backgroundColor = '#fafafa';
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--gray)';
    dropZone.style.backgroundColor = '#fafafa';

    if (e.dataTransfer.files.length && !isScanning) {
      imageInput.files = e.dataTransfer.files;
      scanBill();
    }
  });
}

if (imageInput) {
  // Only handle change event, no duplicate triggers
  imageInput.addEventListener('change', () => {
    if (imageInput.files.length && !isScanning) {
      scanBill();
    }
  });
}

// Clear scan button
if (clearScanBtn) {
  clearScanBtn.addEventListener('click', () => {
    clearScanResults();
  });
}

// Clear scan results function
function clearScanResults() {
  // Reset the file input
  if (imageInput) {
    imageInput.value = '';
  }
  
  // Clear scan results
  scannedMedicines = [];
  if (scanResults) scanResults.classList.add('hidden');
  if (ocrOutput) ocrOutput.innerHTML = '';
  if (scanLoading) scanLoading.classList.add('hidden');
  
  // Reset drop zone styling
  if (dropZone) {
    dropZone.style.borderColor = '';
    dropZone.style.backgroundColor = '';
  }
  
  isScanning = false;
  
  showNotification('Ready to scan another image', 'info');
}

// Scan bill function
async function scanBill() {
  const file = imageInput.files[0];
  if (!file) {
    showNotification('Please select an image first', 'error');
    return;
  }

  // Double-check we're not already scanning
  if (isScanning) {
    showNotification('Already scanning an image, please wait...', 'warning');
    return;
  }

  // Check file size (optional but good practice)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    showNotification('Image size should be less than 5MB', 'error');
    return;
  }

  isScanning = true;
  
  // Update UI
  if (scanLoading) scanLoading.classList.remove('hidden');
  if (scanResults) scanResults.classList.add('hidden');
  
  // Disable the drop zone during scan
  if (dropZone) {
    dropZone.style.pointerEvents = 'none';
    dropZone.style.opacity = '0.7';
  }

  try {
    const { data: { text } } = await Tesseract.recognize(
      file,
      'eng',
      {
        logger: m => {
          // Optional: show progress in console
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        },
        tessedit_pageseg_mode: 6 // Assume a single uniform block of text
      }
    );

    const extractedMedicines = extractMedicinesFromText(text);
    scannedMedicines = extractedMedicines;

    displayScanResults(extractedMedicines);
    
    if (scanLoading) scanLoading.classList.add('hidden');
    if (scanResults) scanResults.classList.remove('hidden');

    showNotification(`Found ${extractedMedicines.length} potential medicines`, 'success');

  } catch (error) {
    console.error('OCR Error:', error);
    showNotification('Failed to scan image. Please try again with a clearer image.', 'error');
    if (scanLoading) scanLoading.classList.add('hidden');
  } finally {
    isScanning = false;
    
    // Re-enable the drop zone
    if (dropZone) {
      dropZone.style.pointerEvents = '';
      dropZone.style.opacity = '';
    }
  }
}

function cleanProductName(raw, expiry) {
  let cleaned = raw
    .replace(expiry, ' ')
    .replace(/\b[A-Z]{1,2}\d{1,4}\b/g, ' ')        // batch codes (B13)
    .replace(/[\[\]\(\)\{\}\|\=\>\<\"\'\:\;\_\-]/g, ' ')
    .replace(/\./g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = cleaned.split(' ');
  const result = [];

  for (let token of tokens) {
    const upper = token.toUpperCase();

    // ✅ KEEP quantities like 20ML, 10CAP
    if (/^\d+(ML|CAP)$/.test(upper)) {
      result.push(upper);
      continue;
    }

    // ❌ remove tokens with digits (t1a, x9)
    if (/\d/.test(token)) continue;

    // ❌ remove short garbage
    if (token.length < 3) continue;

    // ❌ remove common OCR junk words
    if (['SEED', 'LOT', 'REF', 'MRP', 'QTY'].includes(upper)) continue;

    // ✅ keep clean alphabetic words
    if (/^[A-Z]+$/.test(upper)) {
      result.push(upper);
    }
  }

  return result.join(' ');
}

function extractMedicinesFromText(text) {
  const lines = text.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  const medicines = [];
  const medicineKeywords = [
    'TAB', 'CAP', 'SYRUP', 'INJ', 'OINT', 'DROP', 'INHALER',
    'MG', 'ML', 'GM', 'G', 'MG/ML', 'IU', 'MCG'
  ];

  lines.forEach(line => {
    if (line.length < 3) return;

    const hasMedicineKeyword = medicineKeywords.some(keyword =>
      line.toUpperCase().includes(keyword));

    const expiryMatch = line.match(/\b(\d{1,2})[\/\-](\d{2,4})\b/);

    if ((hasMedicineKeyword || /^[A-Z][A-Z\s]+$/.test(line.toUpperCase())) && expiryMatch) {
      const productName = cleanProductName(line, expiryMatch[0]);
      const [_, month, year] = expiryMatch;
      const formattedYear = year.length === 2 ? `20${year}` : year;
      const expiryDate = `${month.padStart(2, '0')}/${formattedYear}`;

      if (productName.length > 2) {
        medicines.push({
          name: productName.toUpperCase(),
          expiryDate: expiryDate,
          category: guessCategory(productName),
          quantity: 1
        });
      }
    }
  });

  return medicines;
}

function guessCategory(productName) {
  const name = productName.toUpperCase();
  if (name.includes('TAB') || name.includes('TABLET')) return 'Tablet';
  if (name.includes('CAP') || name.includes('CAPSULE')) return 'Capsule';
  if (name.includes('SYRUP') || name.includes('SYP')) return 'Syrup';
  if (name.includes('INJ') || name.includes('INJECTION')) return 'Injection';
  if (name.includes('OINT') || name.includes('CREAM')) return 'Ointment';
  if (name.includes('DROP')) return 'Drops';
  if (name.includes('INHALER')) return 'Inhaler';
  return 'Other';
}

function displayScanResults(medicines) {
  if (!ocrOutput) return;

  ocrOutput.innerHTML = '';

  if (medicines.length === 0) {
    ocrOutput.innerHTML = `
      <div class="empty-scan-results">
        <i class="fas fa-search" style="font-size: 48px; color: #ccc; margin-bottom: 15px;"></i>
        <h4>No medicines found</h4>
        <p>Try uploading a clearer image or different bill format.</p>
        <button class="btn btn-primary" onclick="clearScanResults()">
          <i class="fas fa-redo"></i> Try Another Image
        </button>
      </div>
    `;
    return;
  }

  medicines.forEach((medicine, index) => {
    const item = document.createElement('div');
    item.className = 'ocr-item';
    item.innerHTML = `
            <div>
                <strong>${medicine.name}</strong><br>
                <small>Expiry: ${formatExpiryDate(medicine.expiryDate)} | Category: ${medicine.category}</small>
            </div>
            <div class="ocr-actions">
                <button class="btn btn-danger btn-sm" onclick="deleteScannedMedicine(${index})" title="Delete this medicine">
                    <i class="fas fa-trash"></i>
                </button>
                <button class="btn btn-warning btn-sm" onclick="editScannedMedicine(${index})" title="Edit this medicine">
                    <i class="fas fa-edit"></i>
                </button>
            </div>
        `;
    ocrOutput.appendChild(item);
  });
}

function deleteScannedMedicine(index) {
  if (confirm('Remove this medicine from scan results?')) {
    scannedMedicines.splice(index, 1);
    displayScanResults(scannedMedicines);
    
    if (scannedMedicines.length === 0) {
      if (scanResults) scanResults.classList.add('hidden');
    }
    
    showNotification('Medicine removed from scan results', 'info');
  }
}

// Edit scanned medicine
function editScannedMedicine(index) {
  editingScannedIndex = index;
  const medicine = scannedMedicines[index];
  
  // Switch to manual tab for editing
  switchToTab('manual');
  
  // Populate form with scanned medicine
  document.getElementById('medicine-name').value = medicine.name;
  document.getElementById('medicine-category').value = medicine.category;
  
  const [month, year] = medicine.expiryDate.split('/');
  document.getElementById('expiry-month').value = month;
  document.getElementById('expiry-year').value = year;
  
  // Set edit mode for scanned medicine
  medicineForm.dataset.editingScanned = 'true';
  medicineForm.dataset.editingScannedIndex = index;
  
  // Change button text and add cancel button
  const submitBtn = medicineForm.querySelector('button[type="submit"]');
  submitBtn.innerHTML = '<i class="fas fa-save"></i> Save & Return to Scan';
  submitBtn.className = 'btn btn-warning';
  
  // Ensure cancel button is visible
  const cancelBtn = document.getElementById('cancel-edit-btn');
  if (cancelBtn) {
    cancelBtn.style.display = 'inline-block';
  } else {
    addCancelEditButton();
    document.getElementById('cancel-edit-btn').style.display = 'inline-block';
  }
  
  showNotification('Edit the medicine details. Click "Save & Return to Scan" when done.', 'info');
}

function addScannedMedicine(index) {
  const medicine = scannedMedicines[index];
  addMedicineToDB(medicine);
}

function addAllScannedMedicines() {
  if (scannedMedicines.length === 0) {
    showNotification('No medicines to add', 'warning');
    return;
  }

  let addedCount = 0;
  scannedMedicines.forEach(medicine => {
    addMedicineToDB(medicine);
    addedCount++;
  });

  showNotification(`Added ${addedCount} medicines to inventory`, 'success');

  // Clear scan results
  scannedMedicines = [];
  if (scanResults) scanResults.classList.add('hidden');
  if (ocrOutput) ocrOutput.innerHTML = '';
  if (imageInput) imageInput.value = '';

  // Switch to inventory tab
  switchToTab('inventory');
}

function addMedicineToDB(medicine) {
  if (!currentUser) {
    showNotification('Please login first', 'error');
    return;
  }

  const status = getExpiryStatus(medicine.expiryDate);
  const medicineData = {
    name: medicine.name,
    category: medicine.category,
    expiryDate: medicine.expiryDate,
    quantity: medicine.quantity || 1,
    notes: 'Added from scanned bill',
    status: status,
    addedDate: firebase.firestore.FieldValue.serverTimestamp(),
    userId: currentUser.uid
  };

  db.collection('medicines').add(medicineData)
    .then(() => {
      debugLog('Scanned medicine added to database');
    })
    .catch(error => {
      console.error('Error adding scanned medicine:', error);
      showNotification('Error adding medicine: ' + error.message, 'error');
    });
}

// Notification system
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;

  // Add styles if not already present
  if (!document.querySelector('#notification-styles')) {
    const styles = document.createElement('style');
    styles.id = 'notification-styles';
    styles.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 20px;
                border-radius: 5px;
                color: white;
                font-weight: 500;
                z-index: 1000;
                animation: slideIn 0.3s ease;
                max-width: 300px;
            }
            .notification.success {
                background-color: var(--success);
            }
            .notification.error {
                background-color: var(--danger);
            }
            .notification.info {
                background-color: var(--primary);
            }
            .notification.warning {
                background-color: var(--warning);
                color: var(--dark);
            }
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
    document.head.appendChild(styles);
  }

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  debugLog('DOM loaded, initializing...');

  // Initialize year dropdown
  initYearDropdown();

  // Add cancel edit button
  addCancelEditButton();

  // Check if Firebase is initialized
  if (!firebase.apps.length) {
    debugLog('Firebase not initialized, trying to initialize...');
    try {
      firebase.initializeApp(firebaseConfig);
    } catch (error) {
      console.error('Firebase initialization error:', error);
      showNotification('Firebase initialization failed. Check console for details.', 'error');
    }
  }

  // Check if user is already logged in
  const user = auth.currentUser;
  if (user) {
    debugLog('User already logged in on page load:', user.email);
    currentUser = user;
    userEmail.textContent = user.email;
    userInfo.classList.remove('hidden');
    loginPrompt.classList.add('hidden');
    mainApp.classList.remove('hidden');
    loadMedicines();
  } else {
    debugLog('No user logged in on page load');
  }
});

// Print functionality
document.getElementById('print-btn').addEventListener('click', () => printInventory('all'));
document.getElementById('print-expiring-btn').addEventListener('click', () => printInventory('expiring'));
document.getElementById('print-expired-btn').addEventListener('click', () => printInventory('expired'));

function printInventory(filterType = 'all') {
  let filtered = medicines;

  if (filterType === 'expiring') {
    filtered = medicines.filter(m => m.status === 'warning');
  } else if (filterType === 'expired') {
    filtered = medicines.filter(m => m.status === 'expired');
  }

  // Sort by expiry date
  filtered.sort((a, b) => {
    const dateA = parseExpiryDate(a.expiryDate);
    const dateB = parseExpiryDate(b.expiryDate);
    return dateA - dateB;
  });

  // Create print window
  const printWindow = window.open('', '_blank');
  const currentDate = new Date().toLocaleDateString();

  let title = 'Medicine Inventory Report';
  if (filterType === 'expiring') {
    title = 'Expiring Soon Medicines Report';
  } else if (filterType === 'expired') {
    title = 'Expired Medicines Report';
  }

  printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${title}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                .print-header { text-align: center; margin-bottom: 30px; }
                .print-header h1 { margin: 0; color: #2c7fb8; }
                .print-header .date { color: #666; margin-top: 5px; }
                .print-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                .print-table th, .print-table td { border: 1px solid #ddd; padding: 10px; text-align: left; }
                .print-table th { background-color: #f5f7fa; font-weight: bold; }
                .print-table tr:nth-child(even) { background-color: #f9f9f9; }
                .print-footer { margin-top: 40px; text-align: center; color: #666; font-size: 12px; }
                @media print {
                    .no-print { display: none; }
                    button { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="print-header">
                <h1>${title}</h1>
                <div class="date">Generated on: ${currentDate}</div>
            </div>
            
            <table class="print-table">
                <thead>
                    <tr>
                        <th>No.</th>
                        <th>Medicine Name</th>
                        <th>Expiry Date</th>
                    </tr>
                </thead>
                <tbody>
                    ${filtered.map((medicine, index) => {
    return `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${medicine.name}</td>
                            <td>${formatExpiryDate(medicine.expiryDate)}</td>
                        </tr>
                        `;
  }).join('')}
                </tbody>
            </table>
            
            <div class="print-footer">
                <p>MediTrack - Medicine Expiry Management System</p>
                <p>Total Items: ${filtered.length}</p>
            </div>
            
            <div class="no-print" style="margin-top: 20px; text-align: center;">
                <button onclick="window.print()" style="padding: 10px 20px; background: #2c7fb8; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    Print Report
                </button>
                <button onclick="window.close()" style="padding: 10px 20px; background: #666; color: white; border: none; border-radius: 5px; cursor: pointer; margin-left: 10px;">
                    Close Window
                </button>
            </div>
            
            <script>
                // Auto-print after loading (optional)
                // window.onload = function() {
                //     window.print();
                // }
            </script>
        </body>
        </html>
    `);

  printWindow.document.close();
}

// Mobile medicine selection
function setupMobileTouchEvents() {
    const medicineRows = document.querySelectorAll('#medicine-table tbody tr');
    
    medicineRows.forEach(row => {
        // Remove any existing click listeners first
        row.removeEventListener('click', handleRowClick);
        
        // Add new click listener
        row.addEventListener('click', handleRowClick);
    });
}

function handleRowClick(event) {
    // Don't trigger if user clicked directly on a button
    if (event.target.tagName === 'BUTTON' || 
        event.target.tagName === 'I' || 
        event.target.closest('button')) {
        return;
    }
    
    const row = event.currentTarget;
    const medicineId = row.querySelector('.edit-btn')?.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
    
    if (medicineId) {
        const medicine = medicines.find(m => m.id === medicineId);
        if (medicine) {
            selectedMedicineId = medicineId;
            selectedMedicineName = medicine.name;
            showMobileActionMenu(medicine.name);
        }
    }
}

function showMobileActionMenu(medicineName) {
    const menu = document.getElementById('mobile-action-menu');
    const nameElement = document.getElementById('mobile-medicine-name');
    
    if (menu && nameElement) {
        nameElement.textContent = medicineName;
        menu.classList.remove('hidden');
        
        // Prevent body scroll when menu is open
        document.body.style.overflow = 'hidden';
    }
}

function closeMobileMenu() {
    const menu = document.getElementById('mobile-action-menu');
    if (menu) {
        menu.classList.add('hidden');
        document.body.style.overflow = '';
    }
    selectedMedicineId = null;
    selectedMedicineName = null;
}

function handleMobileEdit() {
    if (selectedMedicineId) {
        editMedicine(selectedMedicineId);
        closeMobileMenu();
    }
}

function handleMobileDelete() {
    if (selectedMedicineId) {
        if (confirm(`Are you sure you want to delete "${selectedMedicineName}"?`)) {
            deleteMedicine(selectedMedicineId);
            closeMobileMenu();
        }
    }
}

// Update the renderMedicines function to set up mobile events
function renderMedicines() {
  debugLog('Rendering medicines, count:', medicines.length);

  const statusFilterValue = statusFilter ? statusFilter.value : 'all';
  const categoryFilterValue = categoryFilter ? categoryFilter.value : 'all';
  const searchValue = searchInput ? searchInput.value.toLowerCase() : '';

  let filteredMedicines = medicines.filter(medicine => {
    // Status filter
    if (statusFilterValue !== 'all') {
      if (statusFilterValue === 'expired' && medicine.status !== 'expired') return false;
      if (statusFilterValue === 'expiring' && medicine.status !== 'warning') return false;
      if (statusFilterValue === 'safe' && medicine.status !== 'ok') return false;
    }

    // Category filter
    if (categoryFilterValue !== 'all' && medicine.category !== categoryFilterValue) {
      return false;
    }

    // Search filter
    if (searchValue && !medicine.name.toLowerCase().includes(searchValue)) {
      return false;
    }

    return true;
  });

  // Sort medicines
  filteredMedicines.sort((a, b) => {
    let aValue = a[currentSort.field];
    let bValue = b[currentSort.field];

    if (currentSort.field === 'expiryDate') {
      aValue = parseExpiryDate(aValue);
      bValue = parseExpiryDate(bValue);
    }

    if (currentSort.direction === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  if (!medicineList) {
    console.error('medicineList element not found!');
    return;
  }

  if (filteredMedicines.length === 0) {
    if (emptyState) emptyState.classList.remove('hidden');
    medicineList.innerHTML = '';
    debugLog('No filtered medicines to display');
  } else {
    if (emptyState) emptyState.classList.add('hidden');
    medicineList.innerHTML = '';

    filteredMedicines.forEach(medicine => {
      const row = document.createElement('tr');
      row.className = medicine.status === 'expired' ? 'expired-row' :
        medicine.status === 'warning' ? 'expiring-soon-row' : '';
      
      // Add data attribute for mobile touch
      row.setAttribute('data-medicine-id', medicine.id);

      const statusText = medicine.status === 'expired' ? 'Expired' :
        medicine.status === 'warning' ? 'Expiring Soon' : 'Safe';
      const statusClass = medicine.status === 'expired' ? 'status-expired' :
        medicine.status === 'warning' ? 'status-warning' : 'status-ok';

      row.innerHTML = `
                <td>${medicine.name || 'Unknown'}</td>
                <td>${medicine.category || 'Other'}</td>
                <td>${formatExpiryDate(medicine.expiryDate)}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
    
                <td class="action-buttons-cell">
                    <button class="action-btn edit-btn" onclick="editMedicine('${medicine.id}')" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete-btn" onclick="deleteMedicine('${medicine.id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
      medicineList.appendChild(row);
    });

    debugLog(`Displayed ${filteredMedicines.length} medicines in table`);
    
    // Set up mobile touch events
    setupMobileTouchEvents();
  }
}

// Add this to detect mobile devices
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
           (window.innerWidth <= 768);
}

// Update the initialization to check for mobile
document.addEventListener('DOMContentLoaded', () => {
  debugLog('DOM loaded, initializing...');

  // Initialize year dropdown
  initYearDropdown();

  // Add cancel edit button
  addCancelEditButton();

  // Check if Firebase is initialized
  if (!firebase.apps.length) {
    debugLog('Firebase not initialized, trying to initialize...');
    try {
      firebase.initializeApp(firebaseConfig);
    } catch (error) {
      console.error('Firebase initialization error:', error);
      showNotification('Firebase initialization failed. Check console for details.', 'error');
    }
  }

  // Check if user is already logged in
  const user = auth.currentUser;
  if (user) {
    debugLog('User already logged in on page load:', user.email);
    currentUser = user;
    userEmail.textContent = user.email;
    userInfo.classList.remove('hidden');
    loginPrompt.classList.add('hidden');
    mainApp.classList.remove('hidden');
    loadMedicines();
  } else {
    debugLog('No user logged in on page load');
  }
  
  // Set up window resize listener to update mobile detection
  window.addEventListener('resize', () => {
    // Re-setup touch events when window size changes
    if (medicineList.children.length > 0) {
      setTimeout(setupMobileTouchEvents, 100);
    }
  });
});

// Swipe functionality for mobile
function setupSwipeActions() {
    if (!isMobileDevice()) return;
    
    const rows = document.querySelectorAll('#medicine-table tbody tr');
    let startX, startY, currentX;
    let isSwiping = false;
    
    rows.forEach(row => {
        row.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            currentX = startX;
            isSwiping = false;
        }, { passive: true });
        
        row.addEventListener('touchmove', (e) => {
            if (!startX || !startY) return;
            
            const xDiff = e.touches[0].clientX - startX;
            const yDiff = e.touches[0].clientY - startY;
            
            // Only consider it a swipe if horizontal movement is more than vertical
            if (Math.abs(xDiff) > Math.abs(yDiff) && Math.abs(xDiff) > 10) {
                e.preventDefault();
                isSwiping = true;
                
                currentX = e.touches[0].clientX;
                const translateX = Math.min(0, Math.max(-100, xDiff));
                row.style.transform = `translateX(${translateX}px)`;
                
                // Show swipe actions
                row.classList.add('swiping');
            }
        }, { passive: false });
        
        row.addEventListener('touchend', () => {
            if (!isSwiping) return;
            
            const diff = startX - currentX;
            
            // If swiped enough to the left (negative diff), show actions
            if (diff > 50) {
                row.style.transform = 'translateX(-80px)';
            } else {
                // Reset position
                row.style.transform = '';
                row.classList.remove('swiping');
            }
            
            startX = null;
            startY = null;
            isSwiping = false;
        });
    });
}

// Update the renderMedicines function to add swipe action buttons
// In the row.innerHTML, add swipe actions div:
row.innerHTML = `
    <td>${medicine.name || 'Unknown'}</td>
    <td>${medicine.category || 'Other'}</td>
    <td>${formatExpiryDate(medicine.expiryDate)}</td>
    <td><span class="status-badge ${statusClass}">${statusText}</span></td>

    <td class="action-buttons-cell">
        <button class="action-btn edit-btn" onclick="editMedicine('${medicine.id}')" title="Edit">
            <i class="fas fa-edit"></i>
        </button>
        <button class="action-btn delete-btn" onclick="deleteMedicine('${medicine.id}')" title="Delete">
            <i class="fas fa-trash"></i>
        </button>
    </td>
    
    <!-- Swipe actions for mobile -->
    <div class="swipe-actions">
        <button class="swipe-action-btn swipe-edit-btn" onclick="editMedicine('${medicine.id}')">
            <i class="fas fa-edit"></i>
        </button>
        <button class="swipe-action-btn swipe-delete-btn" onclick="deleteMedicine('${medicine.id}')">
            <i class="fas fa-trash"></i>
        </button>
    </div>
`;

// Then call setupSwipeActions() after appending rows
setupSwipeActions();
