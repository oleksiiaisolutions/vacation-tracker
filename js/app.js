
/**
 * VACATION TRACKER - Bundle
 * Combined Logic, Data, and App to run locally without CORS issues.
 */

/* --- LOGIC --- */

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

// Helper to get {year, month} (0-indexed) from "DD-MM-YYYY"
function parseDateStr(dateStr) {
    if (!dateStr) return { year: 0, month: 0 };
    const [d, m, y] = dateStr.split('-'); // Changed to match DD-MM-YYYY input
    return { year: parseInt(y), month: parseInt(m) - 1 };
}

// Format "YYYY-MM-DD" (from storage/default) to "DD-MM-YYYY" (for display/input)
function toDisplayDate(isoDate) {
    if (!isoDate) return '';
    const [y, m, d] = isoDate.split('-');
    return `${d}-${m}-${y}`;
}

// Format "DD-MM-YYYY" (from input) to "YYYY-MM-DD" (for storage)
function toIsoDate(displayDate) {
    if (!displayDate) return '';
    const [d, m, y] = displayDate.split('-');
    return `${y}-${m}-${d}`;
}

function calculateVacationStats(employee, currentDateStr) {
    const { year: currentYear, month: currentMonthIdx } = parseDateStr(currentDateStr);

    // 1. Regular Accrued: 2 days/month
    const regularAccrued = (currentMonthIdx + 1) * 2;

    // 2. Usage & Bonus Logic
    let regularUsed = 0;
    let bonusUsed = false;

    // Birthday stored as DD-MM
    const birthPart = employee.birthday.split('-');
    const birthMonthIdx = parseInt(birthPart[1]) - 1; // [1] is Month in DD-MM

    // Filter requests for current year
    const requestsThisYear = (employee.requests || []).filter(r => {
        // r.date is stored as YYYY-MM-DD. Convert to check year.
        return parseInt(r.date.split('-')[0]) === currentYear;
    });

    for (const req of requestsThisYear) {
        // req.date is "YYYY-MM-DD". Get month (0-indexed)
        const reqMonth = parseInt(req.date.split('-')[1]) - 1;

        let daysToDeduct = req.days;

        // Check if this request falls in birthday month
        if (reqMonth === birthMonthIdx) {
            if (!bonusUsed && daysToDeduct > 0) {
                daysToDeduct -= 1; // Used bonus
                bonusUsed = true;
            }
        }

        regularUsed += daysToDeduct;
    }

    // 3. Current Bonus Interaction
    const isBirthdayMonthNow = (currentMonthIdx === birthMonthIdx);
    const bonusAvailable = (isBirthdayMonthNow && !bonusUsed) ? 1 : 0;

    // 4. Balances
    const regularBalance = regularAccrued - regularUsed;
    const totalBalance = regularBalance + bonusAvailable;

    return {
        regularAccrued,
        regularUsed,
        regularBalance,
        bonusUsed,
        bonusAvailable,
        totalBalance,
        isBirthdayMonthNow
    };
}

function formatBalance(num) {
    return num > 0 ? `+${num}` : `${num}`;
}


/* --- DATA (API) --- */

const API_BASE = '/api';

let _employees = []; // Local cache

async function fetchEmployees() {
    try {
        const res = await fetch(`${API_BASE}/employees`);
        _employees = await res.json();
        return _employees;
    } catch (err) {
        console.error("Failed to fetch employees", err);
        return [];
    }
}

function getEmployees() {
    return _employees;
}

async function addRequest(employeeId, request) {
    await fetch(`${API_BASE}/employees/${employeeId}/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
    });
}

async function addEmployee(name, birthday, startDate) {
    const newEmp = {
        id: 'emp-' + Date.now(),
        name,
        birthday,   // DD-MM
        startDate,  // YYYY-MM-DD
        requests: []
    };

    const res = await fetch(`${API_BASE}/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEmp)
    });
    return await res.json();
}

async function deleteEmployee(id) {
    await fetch(`${API_BASE}/employees/${id}`, {
        method: 'DELETE'
    });
}


/* --- UI / APP --- */

// State
let currentDateStr = toDisplayDate(new Date().toISOString().split('T')[0]); // "DD-MM-YYYY"
let selectedEmployeeId = null;

// DOM Elements
let dateInput, employeeListEl, nameEl, metaEl, statEarnedEl, statUsedEl, statBalanceEl, bonusIndicatorEl, vacationForm, historyPanel, historyList;
let addEmployeeBtn, addEmployeeModal, closeModalBtn, addEmployeeForm, deleteEmployeeBtn;

async function init() {
    // Grab Elements inside init to be sure DOM is ready if script is at bottom
    dateInput = document.getElementById('simulationDate');
    employeeListEl = document.getElementById('employeeList');
    nameEl = document.getElementById('empName');
    metaEl = document.getElementById('empMeta');
    statEarnedEl = document.getElementById('statEarned');
    statUsedEl = document.getElementById('statUsed');
    statBalanceEl = document.getElementById('statBalance');
    bonusIndicatorEl = document.getElementById('bonusIndicator');
    vacationForm = document.getElementById('vacationForm');
    historyPanel = document.getElementById('requestsLog');
    historyList = document.getElementById('historyList');

    deleteEmployeeBtn = document.getElementById('deleteEmployeeBtn');
    addEmployeeBtn = document.getElementById('addEmployeeBtn');
    addEmployeeModal = document.getElementById('addEmployeeModal');
    closeModalBtn = document.getElementById('closeModalBtn');
    addEmployeeForm = document.getElementById('addEmployeeForm');

    // Set default date to today
    dateInput.value = currentDateStr;
    dateInput.placeholder = "DD-MM-YYYY";

    // Initial Load
    await fetchEmployees();
    renderEmployeeList();

    // Select first eployee check
    const employees = getEmployees();
    if (employees.length > 0) {
        selectEmployee(employees[0].id);
    } else {
        showEmptyState();
    }

    // Listeners
    dateInput.addEventListener('change', (e) => {
        if (e.target.value) {
            currentDateStr = e.target.value; // Store as string
            refreshView();
        }
    });

    vacationForm.addEventListener('submit', handleVacationSubmit);

    // Delete Button
    if (deleteEmployeeBtn) {
        deleteEmployeeBtn.addEventListener('click', handleDeleteEmployee);
    }

    // Modal
    if (addEmployeeBtn) {
        addEmployeeBtn.addEventListener('click', () => {
            addEmployeeModal.style.display = 'flex';
        });
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            addEmployeeModal.style.display = 'none';
        });
    }

    window.addEventListener('click', (e) => {
        if (e.target === addEmployeeModal) {
            addEmployeeModal.style.display = 'none';
        }
    });

    if (addEmployeeForm) {
        addEmployeeForm.addEventListener('submit', handleAddEmployee);
    }
}

function showEmptyState() {
    nameEl.textContent = 'No Employees';
    metaEl.textContent = '';
    statEarnedEl.textContent = '-';
    statUsedEl.textContent = '-';
    statBalanceEl.textContent = '-';
    if (bonusIndicatorEl) bonusIndicatorEl.innerHTML = '';
    if (deleteEmployeeBtn) deleteEmployeeBtn.style.display = 'none';
}

function renderEmployeeList() {
    const employees = getEmployees();
    employeeListEl.innerHTML = '';

    employees.forEach(emp => {
        const li = document.createElement('li');
        li.className = `employee-item ${emp.id === selectedEmployeeId ? 'active' : ''}`;
        li.onclick = () => selectEmployee(emp.id);

        // Avatar Initials
        const initials = emp.name.split(' ').map(n => n[0]).join('').substring(0, 2);

        li.innerHTML = `
      <div class="avatar-placeholder">${initials}</div>
      <span>${emp.name}</span>
    `;
        employeeListEl.appendChild(li);
    });
}

function selectEmployee(id) {
    selectedEmployeeId = id;
    renderEmployeeList();
    refreshView();
}

function refreshView() {
    if (!selectedEmployeeId) return;

    const employees = getEmployees();
    const emp = employees.find(e => e.id === selectedEmployeeId);
    if (!emp) return;

    if (deleteEmployeeBtn) deleteEmployeeBtn.style.display = 'block';

    // Stats
    // Stats
    const stats = calculateVacationStats(emp, currentDateStr);

    // Render
    nameEl.textContent = emp.name;
    metaEl.textContent = `Born: ${emp.birthday} | Started: ${toDisplayDate(emp.startDate)}`;
    statEarnedEl.textContent = stats.regularAccrued;
    statUsedEl.textContent = stats.regularUsed;
    statBalanceEl.textContent = formatBalance(stats.totalBalance);
    statBalanceEl.style.color = stats.totalBalance < 0 ? 'var(--danger)' : '#fff';

    bonusIndicatorEl.innerHTML = '';
    if (stats.isBirthdayMonthNow) {
        if (stats.bonusUsed) {
            bonusIndicatorEl.innerHTML = `<span class="bonus-badge" style="color: #94a3b8; border-color: #94a3b8;">Birthday Bonus Used</span>`;
        } else {
            bonusIndicatorEl.innerHTML = `<span class="bonus-badge">🎉 Birthday Bonus Available!</span>`;
        }
    }

    // History
    updateHistoryList(emp);
    historyPanel.style.display = 'block';
}

function updateHistoryList(emp) {
    historyList.innerHTML = '';
    const { year: currentYear } = parseDateStr(currentDateStr);

    const relevantRequests = (emp.requests || [])
        .filter(r => {
            // r.date is YYYY-MM-DD
            const reqYear = parseInt(r.date.split('-')[0]);
            return reqYear === currentYear;
        })
        .sort((a, b) => new Date(b.date) - new Date(a.date));

    if (relevantRequests.length === 0) {
        historyList.innerHTML = '<li style="color: #64748b; font-style: italic; padding: 1rem;">No vacation taken this year.</li>';
        return;
    }

    relevantRequests.forEach(req => {
        const li = document.createElement('li');
        li.className = 'employee-item';
        li.style.cursor = 'default';
        li.style.justifyContent = 'space-between';
        li.innerHTML = `
            <span>${toDisplayDate(req.date)}</span>
            <span style="color: #fff; font-weight: 600;">${req.days} Day(s)</span>
        `;
        historyList.appendChild(li);
    });
}

async function handleVacationSubmit(e) {
    e.preventDefault();
    if (!selectedEmployeeId) return;

    const dateVal = document.getElementById('vacationDate').value; // DD-MM-YYYY
    const daysVal = parseInt(document.getElementById('vacationDays').value);

    // Basic format validation
    if (!dateVal || !/^\d{2}-\d{2}-\d{4}$/.test(dateVal) || daysVal <= 0) {
        alert("Please enter date as DD-MM-YYYY");
        return;
    }

    const newReq = {
        id: Date.now().toString(),
        date: toIsoDate(dateVal), // Store as ISO
        days: daysVal
    };

    await addRequest(selectedEmployeeId, newReq);
    await fetchEmployees(); // Refresh data

    document.getElementById('vacationDays').value = 1;
    refreshView();
}

async function handleAddEmployee(e) {
    e.preventDefault();
    const name = document.getElementById('newEmpName').value;
    const dob = document.getElementById('newEmpBirthday').value; // DD-MM
    const start = document.getElementById('newEmpStart').value; // DD-MM-YYYY

    if (!name || !dob || !start) return;

    // Simple validation
    if (!/^\d{2}-\d{2}$/.test(dob)) {
        alert("Birthday must be DD-MM");
        return;
    }
    if (!/^\d{2}-\d{2}-\d{4}$/.test(start)) {
        alert("Start Date must be DD-MM-YYYY");
        return;
    }

    // Save start date as ISO YYYY-MM-DD
    const newEmp = await addEmployee(name, dob, toIsoDate(start));
    await fetchEmployees();

    addEmployeeModal.style.display = 'none';
    addEmployeeForm.reset();
    selectEmployee(newEmp.id);
}

async function handleDeleteEmployee() {
    if (!selectedEmployeeId) return;

    if (confirm('Are you sure you want to delete this employee?')) {
        await deleteEmployee(selectedEmployeeId);
        await fetchEmployees();

        const employees = getEmployees();
        if (employees.length > 0) {
            selectEmployee(employees[0].id);
        } else {
            showEmptyState();
        }
    }
}

// Check if DOM is ready, otherwise wait
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
