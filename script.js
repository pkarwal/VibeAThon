// Gemini API Configuration
const GEMINI_API_KEY = 'AIzaSyAqjBVapgDOPFZwFGRGNs7kpBg5tJ4xaQU'; // Replace with your actual key
const GEMINI_MODEL = 'gemini-2.5-flash';

// Application State
let tasks = JSON.parse(localStorage.getItem('roommateTasks')) || [];
let members = JSON.parse(localStorage.getItem('roommateMembers')) || [];
let expenses = JSON.parse(localStorage.getItem('roommateExpenses')) || [];
let completedPayments = JSON.parse(localStorage.getItem('completedPayments')) || [];
let currentVerificationTask = null;
let uploadedFiles = [];
let deadlineCheckInterval = null;
let activeNotifications = new Set(); // Track active notifications to avoid duplicates

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    // Clear localStorage once to ensure clean slate for deployment
    // Remove or comment out these lines after first deployment if you want to preserve user data
    if (!localStorage.getItem('appInitialized')) {
        localStorage.removeItem('roommateTasks');
        localStorage.removeItem('roommateMembers');
        localStorage.removeItem('roommateExpenses');
        localStorage.removeItem('completedPayments');
        localStorage.setItem('appInitialized', 'true');
    }
    
    initializeApp();
    checkOverdueTasks();
    setInterval(checkOverdueTasks, 60000); // Check every minute
    setInterval(showOverdueNotifications, 300000); // Show notifications every 5 minutes
    // Check for tasks that need photo submission when deadline arrives
    deadlineCheckInterval = setInterval(checkDeadlineTasks, 30000); // Check every 30 seconds
});

function initializeApp() {
    setupNavigation();
    setupTaskForm();
    setupRoommateForm();
    setupExpenseForm();
    populateMemberSelects();
    renderDashboard();
    renderAllTasks();
    renderMembers();
    renderExpenses();
    setupModal();
}

// Navigation
function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = link.getAttribute('data-page');
            switchPage(pageId);
            
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        });
    });
}

function switchPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageId).classList.add('active');
    
    // Refresh page content
    if (pageId === 'dashboard') {
        renderDashboard();
    } else if (pageId === 'tasks') {
        renderAllTasks();
    } else if (pageId === 'members') {
        renderMembers();
    } else if (pageId === 'expenses') {
        renderExpenses();
        renderSettlements();
    }
}

// Task Form
function setupTaskForm() {
    const form = document.getElementById('task-form');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        createTask();
    });
}

function setupRoommateForm() {
    const form = document.getElementById('roommate-form');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            addRoommate();
        });
    }
}

function addRoommate() {
    const nameInput = document.getElementById('roommate-name');
    const name = nameInput.value.trim();
    
    if (!name) {
        alert('Please enter a roommate name');
        return;
    }
    
    // Check if name already exists
    if (members.some(m => m.name.toLowerCase() === name.toLowerCase())) {
        alert('A roommate with this name already exists');
        return;
    }
    
    // Get next ID
    const nextId = members.length > 0 ? Math.max(...members.map(m => m.id)) + 1 : 1;
    
    // Get first letter for avatar
    const avatar = name.charAt(0).toUpperCase();
    
    const newRoommate = {
        id: nextId,
        name: name,
        avatar: avatar
    };
    
    members.push(newRoommate);
    saveTasks();
    nameInput.value = '';
    
    // Refresh UI
    populateMemberSelects();
    renderMembers();
    renderExpenses();
    renderSettlements();
    
    alert(`Roommate "${name}" added successfully!`);
}

function deleteRoommate(roommateId) {
    // Check if roommate has any tasks
    const hasTasks = tasks.some(t => t.assignedTo === roommateId || t.assignedBy === roommateId);
    
    if (hasTasks) {
        if (!confirm('This roommate has tasks assigned. Are you sure you want to delete them? This will not delete the tasks.')) {
            return;
        }
    } else {
        if (!confirm('Are you sure you want to delete this roommate?')) {
            return;
        }
    }
    
    members = members.filter(m => m.id !== roommateId);
    saveTasks();
    
    // Refresh UI
    populateMemberSelects();
    renderMembers();
    renderDashboard();
    renderAllTasks();
    renderExpenses();
    renderSettlements();
}

function populateMemberSelects() {
    const assignedToSelect = document.getElementById('task-assigned-to');
    const assignedBySelect = document.getElementById('task-assigned-by');
    const expensePaidBySelect = document.getElementById('expense-paid-by');
    
    [assignedToSelect, assignedBySelect, expensePaidBySelect].forEach(select => {
        if (select) {
            select.innerHTML = '<option value="">Select a roommate...</option>';
            members.forEach(member => {
                const option = document.createElement('option');
                option.value = member.id;
                option.textContent = member.name;
                select.appendChild(option);
            });
        }
    });
    
    // Update expense split checkboxes
    updateExpenseSplitCheckboxes();
}

function setupExpenseForm() {
    const form = document.getElementById('expense-form');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            createExpense();
        });
    }
}

function updateExpenseSplitCheckboxes() {
    const container = document.getElementById('expense-split-checkboxes');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (members.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary);">Add roommates first to split expenses.</p>';
        return;
    }
    
    members.forEach(member => {
        const checkboxDiv = document.createElement('div');
        checkboxDiv.style.marginBottom = '0.5rem';
        checkboxDiv.innerHTML = `
            <label style="display: flex; align-items: center; cursor: pointer;">
                <input type="checkbox" value="${member.id}" class="expense-split-checkbox" style="margin-right: 0.5rem; width: 18px; height: 18px; cursor: pointer;">
                <span>${escapeHtml(member.name)}</span>
            </label>
        `;
        container.appendChild(checkboxDiv);
    });
}

function createExpense() {
    const description = document.getElementById('expense-description').value.trim();
    const amount = parseFloat(document.getElementById('expense-amount').value);
    const paidBy = parseInt(document.getElementById('expense-paid-by').value);
    
    const checkboxes = document.querySelectorAll('.expense-split-checkbox:checked');
    const splitAmong = Array.from(checkboxes).map(cb => parseInt(cb.value));
    
    if (!description || !amount || amount <= 0) {
        alert('Please fill in all fields with valid values.');
        return;
    }
    
    if (!paidBy) {
        alert('Please select who paid for this expense.');
        return;
    }
    
    if (splitAmong.length === 0) {
        alert('Please select at least one person to split the expense among.');
        return;
    }
    
    if (!splitAmong.includes(paidBy)) {
        if (!confirm('The person who paid is not included in the split. Add them to the split?')) {
            splitAmong.push(paidBy);
        }
    }
    
    const expense = {
        id: Date.now(),
        description,
        amount,
        paidBy,
        splitAmong,
        createdAt: Date.now()
    };
    
    expenses.push(expense);
    saveExpenses();
    
    document.getElementById('expense-form').reset();
    updateExpenseSplitCheckboxes();
    
    renderExpenses();
    renderSettlements();
    renderDashboard();
    
    alert('Expense added successfully!');
}

function renderExpenses() {
    const container = document.getElementById('expenses-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (expenses.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No expenses yet. Add your first expense above!</p>';
        return;
    }
    
    // Sort by most recent first
    const sortedExpenses = [...expenses].sort((a, b) => b.createdAt - a.createdAt);
    
    sortedExpenses.forEach(expense => {
        const expenseCard = createExpenseCard(expense);
        container.appendChild(expenseCard);
    });
}

function createExpenseCard(expense) {
    const paidByMember = members.find(m => m.id === expense.paidBy);
    const splitCount = expense.splitAmong.length;
    const amountPerPerson = expense.amount / splitCount;
    
    const card = document.createElement('div');
    card.className = 'task-card';
    card.innerHTML = `
        <div class="task-header">
            <div>
                <h3 class="task-title">${escapeHtml(expense.description)}</h3>
                <p style="color: var(--text-secondary); margin-top: 0.25rem;">
                    Paid by: ${paidByMember ? paidByMember.name : 'Unknown'}
                </p>
            </div>
            <div style="text-align: right;">
                <div style="font-size: 1.5rem; font-weight: 700; color: var(--primary-color);">
                    $${expense.amount.toFixed(2)}
                </div>
                <div style="font-size: 0.875rem; color: var(--text-secondary);">
                    $${amountPerPerson.toFixed(2)} per person
                </div>
            </div>
        </div>
        <div class="task-info">
            <div><strong>Split among:</strong> ${expense.splitAmong.map(id => {
                const member = members.find(m => m.id === id);
                return member ? member.name : 'Unknown';
            }).join(', ')}</div>
            <div><strong>Date:</strong> ${formatDateTime(new Date(expense.createdAt))}</div>
        </div>
        <div class="task-actions">
            <button class="btn btn-danger btn-small delete-expense-btn" data-expense-id="${expense.id}">Delete</button>
        </div>
    `;
    
    const deleteBtn = card.querySelector('.delete-expense-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to delete this expense?')) {
                deleteExpense(expense.id);
            }
        });
    }
    
    return card;
}

function deleteExpense(expenseId) {
    expenses = expenses.filter(e => e.id !== expenseId);
    saveExpenses();
    renderExpenses();
    renderSettlements();
    renderDashboard();
}

function calculateSettlements() {
    // Calculate net balance for each person
    const balances = {};
    
    // Initialize balances
    members.forEach(member => {
        balances[member.id] = 0;
    });
    
    // Process each expense
    expenses.forEach(expense => {
        const amountPerPerson = expense.amount / expense.splitAmong.length;
        
        // Person who paid gets credited
        balances[expense.paidBy] = (balances[expense.paidBy] || 0) + expense.amount;
        
        // People who should contribute get debited
        expense.splitAmong.forEach(personId => {
            balances[personId] = (balances[personId] || 0) - amountPerPerson;
        });
    });
    
    // Calculate who owes whom
    const settlements = [];
    const sortedBalances = Object.entries(balances)
        .map(([id, balance]) => ({ id: parseInt(id), balance }))
        .sort((a, b) => b.balance - a.balance);
    
    let i = 0;
    let j = sortedBalances.length - 1;
    
    while (i < j) {
        const debtor = sortedBalances[j];
        const creditor = sortedBalances[i];
        
        if (Math.abs(debtor.balance) < 0.01 && creditor.balance < 0.01) {
            break;
        }
        
        const amount = Math.min(-debtor.balance, creditor.balance);
        
        if (amount > 0.01) {
            settlements.push({
                from: debtor.id,
                to: creditor.id,
                amount: amount
            });
            
            debtor.balance += amount;
            creditor.balance -= amount;
        }
        
        if (Math.abs(debtor.balance) < 0.01) {
            j--;
        }
        if (creditor.balance < 0.01) {
            i++;
        }
    }
    
    return settlements;
}

function renderSettlements() {
    const container = document.getElementById('settlements-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (expenses.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No expenses to calculate settlements.</p>';
        return;
    }
    
    if (members.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Add roommates to calculate settlements.</p>';
        return;
    }
    
    const settlements = calculateSettlements();
    
    if (settlements.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--success-color); padding: 2rem; font-weight: 600;">✅ Everyone is settled up! No money needs to be transferred.</p>';
        return;
    }
    
    settlements.forEach(settlement => {
        const fromMember = members.find(m => m.id === settlement.from);
        const toMember = members.find(m => m.id === settlement.to);
        
        if (!fromMember || !toMember) return;
        
        const paymentId = `payment-${settlement.from}-${settlement.to}`;
        const isCompleted = completedPayments.includes(paymentId);
        
        const settlementCard = document.createElement('div');
        settlementCard.className = 'task-card payment-task';
        settlementCard.style.borderLeft = '4px solid var(--primary-color)';
        settlementCard.innerHTML = `
            <div class="task-header">
                <div>
                    <h3 class="task-title">💳 Payment: ${escapeHtml(fromMember.name)} → ${escapeHtml(toMember.name)}</h3>
                    <p style="color: var(--text-secondary); margin-top: 0.25rem;">$${settlement.amount.toFixed(2)} payment needed</p>
                </div>
                <span class="task-status ${isCompleted ? 'completed' : 'pending'}">
                    ${isCompleted ? 'Completed' : 'Pending'}
                </span>
            </div>
            <div class="task-info">
                <div><strong>From:</strong> ${escapeHtml(fromMember.name)}</div>
                <div><strong>To:</strong> ${escapeHtml(toMember.name)}</div>
                <div><strong>Amount:</strong> $${settlement.amount.toFixed(2)}</div>
                ${isCompleted ? `<div><strong>Completed:</strong> ${formatDateTime(new Date())}</div>` : ''}
            </div>
            <div class="task-actions">
                ${!isCompleted ? `
                    <button class="btn btn-success btn-small complete-payment-btn" data-payment-id="${paymentId}">Complete Payment</button>
                ` : ''}
            </div>
        `;
        
        // Add event listener
        const completeBtn = settlementCard.querySelector('.complete-payment-btn');
        if (completeBtn) {
            completeBtn.addEventListener('click', () => {
                completePayment(paymentId);
            });
        }
        
        container.appendChild(settlementCard);
    });
}

function saveExpenses() {
    localStorage.setItem('roommateExpenses', JSON.stringify(expenses));
}

function saveTasks() {
    localStorage.setItem('roommateTasks', JSON.stringify(tasks));
    localStorage.setItem('roommateMembers', JSON.stringify(members));
    saveExpenses();
}

// Note: There may be another saveTasks function later in the file - this is the main one

function createTask() {
    const title = document.getElementById('task-title').value;
    const description = document.getElementById('task-description').value;
    const assignedTo = parseInt(document.getElementById('task-assigned-to').value);
    const assignedBy = parseInt(document.getElementById('task-assigned-by').value);
    const deadline = new Date(document.getElementById('task-deadline').value);
    
    const task = {
        id: Date.now(),
        title,
        description,
        assignedTo,
        assignedBy,
        deadline: deadline.getTime(),
        status: 'pending',
        createdAt: Date.now(),
        completedAt: null,
        verificationPhoto: null
    };
    
    tasks.push(task);
    saveTasks();
    document.getElementById('task-form').reset();
    
    alert('Task created successfully!');
    switchPage('dashboard');
    document.querySelector('[data-page="dashboard"]').classList.add('active');
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.querySelector('[data-page="dashboard"]').classList.add('active');
}

// Dashboard
function renderDashboard() {
    const pendingCount = tasks.filter(t => t.status === 'pending' && !isOverdue(t)).length;
    const completedToday = tasks.filter(t => {
        if (t.status !== 'completed' || !t.completedAt) return false;
        const today = new Date();
        const completed = new Date(t.completedAt);
        return today.toDateString() === completed.toDateString();
    }).length;
    const overdueCount = tasks.filter(t => isOverdue(t) && t.status !== 'completed').length;
    
    document.getElementById('pending-count').textContent = pendingCount;
    document.getElementById('completed-today').textContent = completedToday;
    document.getElementById('overdue-count').textContent = overdueCount;
    
    // Show upcoming tasks
    const upcomingTasks = tasks
        .filter(t => t.status === 'pending' && !isOverdue(t))
        .sort((a, b) => a.deadline - b.deadline)
        .slice(0, 5);
    
    renderTasksList(upcomingTasks, 'upcoming-tasks-list');
    
    // Show pending payments/settlements
    renderDashboardSettlements();
}

function renderDashboardSettlements() {
    const container = document.getElementById('dashboard-settlements-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (expenses.length === 0 || members.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 1rem;">No pending payments.</p>';
        return;
    }
    
    const settlements = calculateSettlements();
    
    // Filter out completed payments
    const pendingSettlements = settlements.filter(settlement => {
        const paymentId = `payment-${settlement.from}-${settlement.to}`;
        return !completedPayments.includes(paymentId);
    });
    
    if (pendingSettlements.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--success-color); padding: 1rem; font-weight: 600;">✅ Everyone is settled up!</p>';
        return;
    }
    
    // Show first 5 pending settlements
    pendingSettlements.slice(0, 5).forEach(settlement => {
        const fromMember = members.find(m => m.id === settlement.from);
        const toMember = members.find(m => m.id === settlement.to);
        
        if (!fromMember || !toMember) return;
        
        const settlementCard = document.createElement('div');
        settlementCard.className = 'task-card';
        settlementCard.style.borderLeft = '4px solid var(--primary-color)';
        settlementCard.style.padding = '1rem';
        settlementCard.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between;">
                <div>
                    <div style="font-size: 1rem; font-weight: 600; margin-bottom: 0.25rem;">
                        ${escapeHtml(fromMember.name)} → ${escapeHtml(toMember.name)}
                    </div>
                    <div style="color: var(--text-secondary); font-size: 0.875rem;">
                        Payment needed
                    </div>
                </div>
                <div style="font-size: 1.25rem; font-weight: 700; color: var(--primary-color);">
                    $${settlement.amount.toFixed(2)}
                </div>
            </div>
        `;
        
        container.appendChild(settlementCard);
    });
    
    if (pendingSettlements.length > 5) {
        const moreCard = document.createElement('div');
        moreCard.style.textAlign = 'center';
        moreCard.style.padding = '0.5rem';
        moreCard.style.color = 'var(--text-secondary)';
        moreCard.innerHTML = `+ ${pendingSettlements.length - 5} more payment${pendingSettlements.length - 5 > 1 ? 's' : ''}`;
        container.appendChild(moreCard);
    }
}

// All Tasks Page
function renderAllTasks() {
    setupPersonFilter();
    renderTasksList(tasks, 'all-tasks-list');
    setupFilterButtons();
}

function setupPersonFilter() {
    const personFilter = document.getElementById('person-filter');
    if (!personFilter) return;
    
    // Populate person filter
    personFilter.innerHTML = '<option value="">All People</option>';
    members.forEach(member => {
        const option = document.createElement('option');
        option.value = member.id;
        option.textContent = member.name;
        personFilter.appendChild(option);
    });
    
    // Add event listener
    personFilter.addEventListener('change', () => {
        applyFilters();
    });
}

function setupFilterButtons() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            applyFilters();
        });
    });
}

function applyFilters() {
    const activeFilterBtn = document.querySelector('.filter-btn.active');
    const filter = activeFilterBtn ? activeFilterBtn.getAttribute('data-filter') : 'all';
    const personFilter = document.getElementById('person-filter');
    const selectedPersonId = personFilter ? parseInt(personFilter.value) : null;
    
    filterTasks(filter, selectedPersonId);
}

function filterTasks(filter, personId = null) {
    let filteredTasks = [...tasks];
    
    // Add payment tasks
    const paymentTasks = getPaymentTasks();
    filteredTasks = filteredTasks.concat(paymentTasks);
    
    // Apply status filter
    if (filter === 'pending') {
        filteredTasks = filteredTasks.filter(t => t.status === 'pending' && !isOverdue(t));
    } else if (filter === 'completed') {
        filteredTasks = filteredTasks.filter(t => t.status === 'completed');
    } else if (filter === 'overdue') {
        filteredTasks = filteredTasks.filter(t => isOverdue(t) && t.status !== 'completed');
    }
    
    // Apply person filter
    if (personId) {
        filteredTasks = filteredTasks.filter(t => {
            if (t.isPayment) {
                return t.assignedTo === personId;
            }
            return t.assignedTo === personId || t.assignedBy === personId;
        });
    }
    
    renderTasksList(filteredTasks, 'all-tasks-list');
}

function getPaymentTasks() {
    if (expenses.length === 0 || members.length === 0) return [];
    
    const settlements = calculateSettlements();
    const paymentTasks = [];
    
    settlements.forEach(settlement => {
        const paymentId = `payment-${settlement.from}-${settlement.to}`;
        const isCompleted = completedPayments.includes(paymentId);
        
        paymentTasks.push({
            id: paymentId,
            title: `Payment: ${members.find(m => m.id === settlement.from)?.name || 'Unknown'} → ${members.find(m => m.id === settlement.to)?.name || 'Unknown'}`,
            description: `$${settlement.amount.toFixed(2)} payment needed`,
            assignedTo: settlement.from,
            assignedBy: settlement.to,
            deadline: Date.now(),
            status: isCompleted ? 'completed' : 'pending',
            completedAt: isCompleted ? Date.now() : null,
            isPayment: true,
            amount: settlement.amount,
            fromId: settlement.from,
            toId: settlement.to
        });
    });
    
    return paymentTasks;
}

function renderTasksList(taskList, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    if (taskList.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No tasks found.</p>';
        return;
    }
    
    taskList.forEach(task => {
        const taskCard = createTaskCard(task);
        container.appendChild(taskCard);
    });
}

function createTaskCard(task) {
    const card = document.createElement('div');
    const isPayment = task.isPayment || false;
    const cardClass = isPayment ? 'task-card payment-task' : `task-card ${task.status}`;
    card.className = `${cardClass} ${isOverdue(task) && task.status !== 'completed' ? 'overdue' : ''}`;
    
    const assignedToMember = members.find(m => m.id === task.assignedTo);
    const assignedByMember = members.find(m => m.id === task.assignedBy);
    const deadline = new Date(task.deadline);
    const isTaskOverdue = isOverdue(task) && task.status !== 'completed';
    
    if (isPayment) {
        // Payment task card
        const fromMember = members.find(m => m.id === task.fromId);
        const toMember = members.find(m => m.id === task.toId);
        
        card.innerHTML = `
            <div class="task-header">
                <div>
                    <h3 class="task-title">💳 ${escapeHtml(task.title)}</h3>
                    <p style="color: var(--text-secondary); margin-top: 0.25rem;">${escapeHtml(task.description)}</p>
                </div>
                <span class="task-status ${task.status}">
                    ${task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                </span>
            </div>
            <div class="task-info">
                <div><strong>From:</strong> ${fromMember ? fromMember.name : 'Unknown'}</div>
                <div><strong>To:</strong> ${toMember ? toMember.name : 'Unknown'}</div>
                <div><strong>Amount:</strong> $${task.amount ? task.amount.toFixed(2) : '0.00'}</div>
                ${task.status === 'completed' && task.completedAt ? `<div><strong>Completed:</strong> ${formatDateTime(new Date(task.completedAt))}</div>` : ''}
            </div>
            <div class="task-actions">
                ${task.status === 'pending' ? `
                    <button class="btn btn-success btn-small complete-payment-btn" data-payment-id="${task.id}">Complete Payment</button>
                ` : ''}
            </div>
        `;
        
        // Add event listener for payment tasks
        const completeBtn = card.querySelector('.complete-payment-btn');
        if (completeBtn) {
            completeBtn.addEventListener('click', () => {
                completePayment(task.id);
            });
        }
    } else {
        // Regular task card
        card.innerHTML = `
            <div class="task-header">
                <div>
                    <h3 class="task-title">${escapeHtml(task.title)}</h3>
                    ${task.description ? `<p style="color: var(--text-secondary); margin-top: 0.25rem;">${escapeHtml(task.description)}</p>` : ''}
                </div>
                <span class="task-status ${task.status} ${isTaskOverdue ? 'overdue' : ''}">
                    ${isTaskOverdue ? 'Overdue' : task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                </span>
            </div>
            <div class="task-info">
                <div><strong>Assigned To:</strong> ${assignedToMember ? assignedToMember.name : 'Unknown'}</div>
                <div><strong>Assigned By:</strong> ${assignedByMember ? assignedByMember.name : 'Unknown'}</div>
                <div><strong>Deadline:</strong> ${formatDateTime(deadline)}</div>
                ${task.status === 'completed' && task.completedAt ? `<div><strong>Completed:</strong> ${formatDateTime(new Date(task.completedAt))}</div>` : ''}
            </div>
            <div class="task-actions">
                ${task.status === 'pending' ? `
                    <button class="btn btn-primary btn-small verify-task-btn" data-task-id="${task.id}">Verify Completion</button>
                    <button class="btn btn-danger btn-small delete-task-btn" data-task-id="${task.id}">Delete</button>
                ` : ''}
            </div>
        `;
        
        // Add event listeners for regular tasks
        const verifyBtn = card.querySelector('.verify-task-btn');
        if (verifyBtn) {
            verifyBtn.addEventListener('click', () => openVerificationModal(task));
        }
        
        const deleteBtn = card.querySelector('.delete-task-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                if (confirm('Are you sure you want to delete this task?')) {
                    deleteTask(task.id);
                }
            });
        }
    }
    
    return card;
}

function completePayment(paymentId) {
    if (!completedPayments.includes(paymentId)) {
        completedPayments.push(paymentId);
        saveCompletedPayments();
        renderAllTasks();
        renderDashboard();
        renderMembers();
        renderSettlements();
    }
}

function saveCompletedPayments() {
    localStorage.setItem('completedPayments', JSON.stringify(completedPayments));
}

// Members Page
function renderMembers() {
    const container = document.getElementById('members-list');
    container.innerHTML = '';
    
    members.forEach(member => {
        const memberCard = createMemberCard(member);
        container.appendChild(memberCard);
    });
}

function createMemberCard(member) {
    const memberTasks = tasks.filter(t => t.assignedTo === member.id);
    
    // Get payment tasks for this member
    const paymentTasks = getPaymentTasks().filter(pt => pt.assignedTo === member.id);
    const allTasks = [...memberTasks, ...paymentTasks];
    
    const completedTasks = memberTasks.filter(t => t.status === 'completed').length;
    const completedPayments = paymentTasks.filter(pt => pt.status === 'completed').length;
    const totalCompleted = completedTasks + completedPayments;
    
    const pendingTasks = memberTasks.filter(t => t.status === 'pending' && !isOverdue(t)).length;
    const pendingPayments = paymentTasks.filter(pt => pt.status === 'pending').length;
    
    const overdueTasks = memberTasks.filter(t => isOverdue(t) && t.status !== 'completed').length;
    
    // Calculate completion rate including payments
    const completionRate = allTasks.length > 0 
        ? Math.round((totalCompleted / allTasks.length) * 100) 
        : 100;
    
    const card = document.createElement('div');
    card.className = 'member-card';
    card.innerHTML = `
        <div class="member-header">
            <div class="member-avatar">${member.avatar}</div>
            <div style="flex: 1;">
                <h3 class="member-name">${escapeHtml(member.name)}</h3>
            </div>
            <button class="btn btn-danger btn-small delete-roommate-btn" data-roommate-id="${member.id}" title="Delete roommate" style="width: 32px; height: 32px; padding: 0; font-size: 1.5rem; line-height: 1;">×</button>
        </div>
        <div class="member-stats">
            <div class="stat-item">
                <span class="stat-label">Total Tasks</span>
                <span class="stat-value">${memberTasks.length}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Pending Payments</span>
                <span class="stat-value" style="color: var(--primary-color);">${pendingPayments}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Completed</span>
                <span class="stat-value" style="color: var(--success-color);">${totalCompleted} (${completedTasks} tasks${completedPayments > 0 ? `, ${completedPayments} payments` : ''})</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Pending</span>
                <span class="stat-value" style="color: var(--warning-color);">${pendingTasks}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Overdue</span>
                <span class="stat-value" style="color: var(--danger-color);">${overdueTasks}</span>
            </div>
        </div>
        <div class="completion-rate">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <span class="stat-label">Completion Rate</span>
                <span class="stat-value">${completionRate}%</span>
            </div>
            <div class="circular-progress-container">
                <svg class="circular-progress" viewBox="0 0 100 100">
                    <defs>
                        <linearGradient id="progressGradient-${member.id}" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" style="stop-color: var(--success-color); stop-opacity: 1" />
                            <stop offset="100%" style="stop-color: var(--primary-color); stop-opacity: 1" />
                        </linearGradient>
                    </defs>
                    <circle class="circular-progress-bg" cx="50" cy="50" r="45"></circle>
                    <circle class="circular-progress-fill" cx="50" cy="50" r="45" 
                            style="stroke-dasharray: ${283 * completionRate / 100} 283; stroke: url(#progressGradient-${member.id});"
                            transform="rotate(-90 50 50)"></circle>
                </svg>
                <div class="circular-progress-text">${completionRate}%</div>
            </div>
        </div>
    `;
    
    // Add delete button event listener
    const deleteBtn = card.querySelector('.delete-roommate-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            deleteRoommate(member.id);
        });
    }
    
    return card;
}

// Verification Modal
function setupModal() {
    const modal = document.getElementById('verification-modal');
    const closeBtn = document.querySelector('.close-modal');
    const fileInput = document.getElementById('fileInput');
    const uploadArea = document.getElementById('uploadArea');
    const verifyBtn = document.getElementById('verify-btn');
    const clearBtn = document.getElementById('clear-uploads-btn');
    
    closeBtn.addEventListener('click', () => {
        closeVerificationModal();
    });
    
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeVerificationModal();
        }
    });
    
    // File upload handling
    uploadArea.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => addFiles([...e.target.files]));
    
    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        addFiles([...e.dataTransfer.files]);
    });
    
    verifyBtn.addEventListener('click', verifyTask);
    clearBtn.addEventListener('click', clearUploads);
}

function openVerificationModal(task, isDeadlinePrompt = false) {
    currentVerificationTask = task;
    const modal = document.getElementById('verification-modal');
    const taskInfo = document.getElementById('verification-task-info');
    const statusDiv = document.getElementById('verification-status');
    
    const assignedToMember = members.find(m => m.id === task.assignedTo);
    const isOverdue = isDeadlineTask(task);
    
    taskInfo.innerHTML = `
        <div style="background: var(--bg-color); padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem;">
            <h3 style="margin-bottom: 0.5rem;">${escapeHtml(task.title)}</h3>
            ${task.description ? `<p style="color: var(--text-secondary); margin-bottom: 0.5rem;">${escapeHtml(task.description)}</p>` : ''}
            <p><strong>Assigned to:</strong> ${assignedToMember ? assignedToMember.name : 'Unknown'}</p>
            <p><strong>Deadline:</strong> ${formatDateTime(new Date(task.deadline))}</p>
            ${isOverdue ? `<p style="color: var(--danger-color); font-weight: 600; margin-top: 0.5rem;">⚠️ This task is overdue! Please submit a photo to verify completion.</p>` : ''}
        </div>
    `;
    
    statusDiv.innerHTML = '';
    statusDiv.className = 'verification-status';
    
    // Reset upload UI
    clearUploads();
    document.getElementById('verify-btn').style.display = 'none';
    document.getElementById('clear-uploads-btn').style.display = 'none';
    
    // Always show close button - allow users to close
    const closeBtn = document.querySelector('.close-modal');
    closeBtn.style.display = 'block';
    
    modal.classList.add('active');
}

function closeVerificationModal() {
    const modal = document.getElementById('verification-modal');
    const task = currentVerificationTask; // Save before clearing
    
    modal.classList.remove('active');
    clearUploads();
    currentVerificationTask = null;
    const closeBtn = document.querySelector('.close-modal');
    closeBtn.style.display = 'block';
    
    // If it was an overdue task and not completed, show a reminder notification
    if (task && isDeadlineTask(task) && task.status !== 'completed') {
        setTimeout(() => {
            showNotification(
                `Reminder: ${task.title}`,
                `This task still needs to be verified. Please complete it soon!`,
                'overdue',
                task.id
            );
        }, 1000);
    }
}

function addFiles(files) {
    files.forEach(file => {
        if (file.type.startsWith('image/')) {
            uploadedFiles.push(file);
        }
    });
    updatePreview();
}

function updatePreview() {
    const uploadPreview = document.getElementById('uploadPreview');
    uploadPreview.innerHTML = '';
    
    if (uploadedFiles.length === 0) {
        document.getElementById('verify-btn').style.display = 'none';
        document.getElementById('clear-uploads-btn').style.display = 'none';
        return;
    }
    
    uploadedFiles.forEach((file, idx) => {
        const item = document.createElement('div');
        item.className = 'preview-item';
        item.dataset.fileIndex = idx;
        item.innerHTML = `
            <img src="${URL.createObjectURL(file)}" alt="Preview">
            <button class="remove-btn">×</button>
        `;
        
        // Add event listener to remove button
        const removeBtn = item.querySelector('.remove-btn');
        removeBtn.addEventListener('click', () => {
            const fileIndex = parseInt(item.dataset.fileIndex);
            uploadedFiles.splice(fileIndex, 1);
            updatePreview();
        });
        
        uploadPreview.appendChild(item);
    });
    
    document.getElementById('verify-btn').style.display = 'block';
    document.getElementById('clear-uploads-btn').style.display = 'block';
}

function clearUploads() {
    uploadedFiles = [];
    updatePreview();
    document.getElementById('fileInput').value = '';
}

async function verifyTask() {
    if (!currentVerificationTask) return;
    
    if (uploadedFiles.length === 0) {
        alert('Please upload at least one photo to verify task completion.');
        return;
    }
    
    const statusDiv = document.getElementById('verification-status');
    statusDiv.innerHTML = 'Processing verification...';
    statusDiv.className = 'verification-status processing';
    
    const verifyBtn = document.getElementById('verify-btn');
    verifyBtn.disabled = true;
    
    try {
        // Convert images to base64
        const base64Images = await Promise.all(uploadedFiles.map(toBase64));
        
        // Call Gemini API to verify task completion
        const verificationResult = await verifyImageWithGemini(base64Images, currentVerificationTask);
        
        if (verificationResult.isValid) {
            // Mark task as completed
            const task = tasks.find(t => t.id === currentVerificationTask.id);
            if (task) {
                task.status = 'completed';
                task.completedAt = Date.now();
                // Store first image as verification photo
                task.verificationPhoto = `data:image/jpeg;base64,${base64Images[0]}`;
                saveTasks();
                
                // Remove notification for this task if it exists
                activeNotifications.delete(task.id);
                const existingNotification = document.querySelector(`[data-task-id="${task.id}"]`);
                if (existingNotification) {
                    existingNotification.remove();
                }
                
                statusDiv.innerHTML = '✅ Task verified and completed!';
                statusDiv.className = 'verification-status success';
                
                setTimeout(() => {
                    closeVerificationModal();
                    renderDashboard();
                    renderAllTasks();
                    renderMembers();
                }, 2000);
            }
        } else {
            const failureReason = verificationResult.reason || 'The task does not appear to be completed in the provided photos.';
            statusDiv.innerHTML = `❌ Verification failed: ${escapeHtml(failureReason)}`;
            statusDiv.className = 'verification-status failed';
            verifyBtn.disabled = false;
        }
    } catch (error) {
        console.error('Verification error:', error);
        statusDiv.innerHTML = `Error during verification: ${error.message}. Please try again.`;
        statusDiv.className = 'verification-status failed';
        verifyBtn.disabled = false;
    }
}

function toBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function verifyImageWithGemini(base64Images, task) {
    if (GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
        console.log('Gemini API key not set. Using simulated verification.');
        // For demo: randomly approve 70% of verifications
        const isValid = Math.random() > 0.3;
        return {
            isValid: isValid,
            reason: isValid ? null : 'Simulated verification failed (demo mode)'
        };
    }
    
    try {
        // Build prompt for Gemini - ask for reason when rejecting
        const taskDescription = task.description || task.title;
        const verificationPrompt = `You are analyzing photos to verify if a task has been completed.

Task: "${task.title}"
Description: ${taskDescription}

Instructions:
- Look at the provided photos carefully
- Determine if the task appears to be completed based on what you see
- Be reasonable and lenient - if the task seems done, approve it
- Only reject if it's clearly NOT done or the photos are completely unrelated

Respond in this format:
- If the task appears completed, respond with: "YES"
- If the task is NOT completed, respond with: "NO: [brief reason why it's not completed]"

Examples:
- "YES"
- "NO: The kitchen still appears dirty and dishes are not washed"
- "NO: Photos do not show the completed task"
- "NO: Task appears incomplete or unclear"

Your response:`;

        // Prepare messages with images
        const parts = [
            { text: verificationPrompt }
        ];
        
        // Add all images
        base64Images.forEach(imgData => {
            parts.push({
                inline_data: {
                    mime_type: 'image/jpeg',
                    data: imgData
                }
            });
        });

        const messages = [{
            role: 'user',
            parts: parts
        }];

        // Call Gemini API
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ contents: messages })
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'API request failed');
        }

        const data = await response.json();
        const resultText = data.candidates[0]?.content?.parts[0]?.text || '';
        
        console.log('Gemini response:', resultText); // Debug log
        
        // Parse response
        const normalizedResult = resultText.trim().toUpperCase();
        
        // Check for positive responses
        const positiveIndicators = ['YES', 'COMPLETED', 'DONE', 'FINISHED', 'COMPLETE', 'APPROVED', 'PASS', 'ACCEPT'];
        // Check for negative responses (be more strict - only clear negatives)
        const negativeIndicators = ['NO', 'NOT COMPLETED', 'NOT DONE', 'INCOMPLETE', 'UNFINISHED', 'FAILED', 'REJECT'];
        
        // Count positive vs negative indicators
        const hasPositive = positiveIndicators.some(indicator => normalizedResult.includes(indicator));
        const hasStrongNegative = negativeIndicators.some(indicator => {
            // Check for standalone "NO" or clear negative phrases
            if (indicator === 'NO') {
                return normalizedResult === 'NO' || normalizedResult.startsWith('NO ') || normalizedResult.startsWith('NO:') || normalizedResult.match(/\bNO\b/);
            }
            return normalizedResult.includes(indicator);
        });
        
        // Extract reason if it's a NO response
        let reason = null;
        if (hasStrongNegative || normalizedResult.startsWith('NO')) {
            // Try to extract the reason after "NO:" or "NO "
            const noMatch = resultText.match(/^NO[:\s]+(.+)$/i);
            if (noMatch && noMatch[1]) {
                reason = noMatch[1].trim();
            } else {
                // Look for reason in the response
                const lines = resultText.split('\n');
                for (const line of lines) {
                    if (line.toUpperCase().includes('NO') && line.length > 5) {
                        reason = line.replace(/^NO[:\s]+/i, '').trim();
                        break;
                    }
                }
            }
            // Default reason if we couldn't extract one
            if (!reason || reason.length < 10) {
                reason = 'The task does not appear to be completed based on the provided photos.';
            }
        }
        
        // If we have positive indicators, approve
        // If we have a strong negative (like standalone NO), reject
        // Otherwise, default to approving (be lenient)
        const startsWithYes = normalizedResult.startsWith('YES') || normalizedResult.match(/\bYES\b/);
        const isCompleted = startsWithYes || (hasPositive && !hasStrongNegative) || (!hasStrongNegative && normalizedResult.length > 0);
        
        console.log('Verification result:', isCompleted ? 'APPROVED' : 'REJECTED', '- Reason:', reason); // Debug log
        
        return {
            isValid: isCompleted,
            reason: reason
        };
        
    } catch (error) {
        console.error('Gemini API error:', error);
        throw error;
    }
}

// Overdue Tasks & Notifications
function checkOverdueTasks() {
    const overdueTasks = tasks.filter(t => isOverdue(t) && t.status !== 'completed');
    
    if (overdueTasks.length > 0) {
        // Update UI
        renderDashboard();
        renderAllTasks();
        renderMembers();
    }
}

function showOverdueNotifications() {
    const overdueTasks = tasks.filter(t => isOverdue(t) && t.status !== 'completed');
    
    overdueTasks.forEach(task => {
        // Only show notification if task is not completed
        if (task.status === 'completed') {
            return;
        }
        
        // Check if notification already exists for this task
        if (activeNotifications.has(task.id)) {
            return;
        }
        
        const assignedToMember = members.find(m => m.id === task.assignedTo);
        showNotification(
            `Overdue Task: ${task.title}`,
            `This task was due ${formatDateTime(new Date(task.deadline))}. Please complete it soon!`,
            'overdue',
            task.id
        );
    });
}

function showNotification(title, message, type = 'info', taskId = null) {
    // Don't show notifications for completed tasks
    if (taskId) {
        const task = tasks.find(t => t.id === taskId);
        if (task && task.status === 'completed') {
            // Remove from active notifications if it was there
            activeNotifications.delete(taskId);
            // Remove any existing notification for this task
            const existingNotification = document.querySelector(`[data-task-id="${taskId}"]`);
            if (existingNotification) {
                existingNotification.remove();
            }
            return;
        }
    }
    
    // Check if notification already exists for this task
    if (taskId && activeNotifications.has(taskId)) {
        // Update existing notification instead of creating duplicate
        const existingNotification = document.querySelector(`[data-task-id="${taskId}"]`);
        if (existingNotification) {
            return; // Already showing
        }
    }
    
    const container = document.getElementById('notification-container');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.dataset.taskId = taskId;
    
    notification.innerHTML = `
        <div>
            <div class="notification-title">${escapeHtml(title)}</div>
            <div class="notification-message">${escapeHtml(message)}</div>
        </div>
        <span class="notification-close">&times;</span>
    `;
    
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
        if (taskId) {
            activeNotifications.delete(taskId);
        }
        notification.remove();
    });
    
    // Only auto-remove for non-overdue notifications
    // Overdue notifications stay until task is completed or manually closed
    if (type !== 'overdue') {
        setTimeout(() => {
            if (notification.parentNode) {
                if (taskId) {
                    activeNotifications.delete(taskId);
                }
                notification.remove();
            }
        }, 10000);
    } else if (taskId) {
        // Track overdue notifications
        activeNotifications.add(taskId);
    }
    
    container.appendChild(notification);
    
    // If it's an overdue task, add click to verify
    if (type === 'overdue' && taskId) {
        notification.style.cursor = 'pointer';
        notification.addEventListener('click', (e) => {
            // Don't trigger if clicking the close button
            if (e.target.classList.contains('notification-close')) {
                return;
            }
            const task = tasks.find(t => t.id === taskId);
            if (task && task.status !== 'completed') {
                openVerificationModal(task);
            }
        });
    }
    
    // Check periodically if task is completed and remove notification
    if (taskId && type === 'overdue') {
        const checkInterval = setInterval(() => {
            const task = tasks.find(t => t.id === taskId);
            if (!task || task.status === 'completed') {
                activeNotifications.delete(taskId);
                if (notification.parentNode) {
                    notification.remove();
                }
                clearInterval(checkInterval);
            }
        }, 5000); // Check every 5 seconds
    }
}

// Utility Functions
function isOverdue(task) {
    return task.status !== 'completed' && new Date(task.deadline) < new Date();
}

function isDeadlineTask(task) {
    const deadline = new Date(task.deadline);
    const now = new Date();
    return deadline <= now;
}

function deleteTask(taskId) {
    tasks = tasks.filter(t => t.id !== taskId);
    saveTasks();
    renderDashboard();
    renderAllTasks();
    renderMembers();
}

// Duplicate saveTasks removed - using the one above that includes saveExpenses()

function formatDateTime(date) {
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Check for tasks that need photo submission when deadline arrives
function checkDeadlineTasks() {
    const now = new Date();
    const tasksNeedingPhoto = tasks.filter(task => {
        if (task.status !== 'pending' || task.status === 'completed') return false;
        
        const deadline = new Date(task.deadline);
        // Check if deadline has passed (within last 2 minutes to avoid duplicates)
        const timeSinceDeadline = now.getTime() - deadline.getTime();
        return timeSinceDeadline >= 0 && timeSinceDeadline <= 120000; // 2 minutes window
    });
    
    tasksNeedingPhoto.forEach(task => {
        // Don't show if task is completed
        if (task.status === 'completed') {
            return;
        }
        
        // Check if modal is already open for this task
        const modal = document.getElementById('verification-modal');
        if (modal.classList.contains('active') && currentVerificationTask?.id === task.id) {
            return; // Already showing this task
        }
        
        // Automatically open verification modal
        openVerificationModal(task, true);
        
        // Also show notification (will check for completion inside showNotification)
        const assignedToMember = members.find(m => m.id === task.assignedTo);
        showNotification(
            `📸 Photo Required: ${task.title}`,
            `Your task deadline has arrived! Please submit a photo to verify completion.`,
            'overdue',
            task.id
        );
    });
}

// Also check for overdue tasks that need continuous prompting
setInterval(() => {
    const overdueTasks = tasks.filter(t => isOverdue(t) && t.status !== 'completed');
    
    overdueTasks.forEach(task => {
        // Don't show if task is completed
        if (task.status === 'completed') {
            return;
        }
        
        // Check if modal is already open for this task
        const modal = document.getElementById('verification-modal');
        if (!modal.classList.contains('active') || currentVerificationTask?.id !== task.id) {
            // Force open modal for overdue tasks every 2 minutes
            const lastPrompt = task.lastPromptTime || 0;
            const now = Date.now();
            if (now - lastPrompt > 120000) { // 2 minutes
                task.lastPromptTime = now;
                saveTasks();
                openVerificationModal(task, true);
            }
        }
    });
}, 120000); // Check every 2 minutes

