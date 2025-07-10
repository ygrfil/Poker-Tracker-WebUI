class PokerTracker {
    constructor() {
        this.currentPeriod = 'day';
        this.currentDate = new Date().toISOString().split('T')[0];
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setCurrentDateTime();
        this.setFilterDate();
        this.loadData();
    }

    setupEventListeners() {
        document.getElementById('resultForm').addEventListener('submit', this.handleAddResult.bind(this));
        document.getElementById('editForm').addEventListener('submit', this.handleEditResult.bind(this));
        document.getElementById('filterDate').addEventListener('change', this.handleDateFilter.bind(this));
        
        document.querySelectorAll('.btn-filter').forEach(btn => {
            btn.addEventListener('click', this.handlePeriodFilter.bind(this));
        });

        document.querySelector('.close').addEventListener('click', this.closeModal.bind(this));
        
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal();
            }
        });
    }

    setCurrentDateTime() {
        const now = new Date();
        const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
        document.getElementById('dateTime').value = localDateTime.toISOString().slice(0, 16);
    }

    setFilterDate() {
        document.getElementById('filterDate').value = this.currentDate;
    }

    async handleAddResult(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const data = {
            club_name: formData.get('clubName'),
            account_name: formData.get('accountName'),
            result: parseFloat(formData.get('result')),
            date_time: new Date(formData.get('dateTime')).toISOString()
        };

        try {
            const response = await fetch('/api/results', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                e.target.reset();
                this.setCurrentDateTime();
                this.loadData();
                this.showNotification('Result added successfully!', 'success');
            } else {
                const error = await response.json();
                this.showNotification(error.error || 'Failed to add result', 'error');
            }
        } catch (error) {
            this.showNotification('Network error occurred', 'error');
        }
    }

    async handleEditResult(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const id = formData.get('editId');
        const data = {
            club_name: formData.get('editClubName'),
            account_name: formData.get('editAccountName'),
            result: parseFloat(formData.get('editResult')),
            date_time: new Date(formData.get('editDateTime')).toISOString()
        };

        try {
            const response = await fetch(`/api/results/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                this.closeModal();
                this.loadData();
                this.showNotification('Result updated successfully!', 'success');
            } else {
                const error = await response.json();
                this.showNotification(error.error || 'Failed to update result', 'error');
            }
        } catch (error) {
            this.showNotification('Network error occurred', 'error');
        }
    }

    handleDateFilter(e) {
        this.currentDate = e.target.value;
        this.loadData();
    }

    handlePeriodFilter(e) {
        document.querySelectorAll('.btn-filter').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        this.currentPeriod = e.target.dataset.period;
        this.loadData();
    }

    async loadData() {
        await Promise.all([
            this.loadResults(),
            this.loadSummary()
        ]);
    }

    async loadResults() {
        try {
            const response = await fetch(`/api/results?period=${this.currentPeriod}&date=${this.currentDate}`);
            const results = await response.json();
            this.renderResults(results);
        } catch (error) {
            console.error('Error loading results:', error);
        }
    }

    async loadSummary() {
        try {
            const response = await fetch(`/api/summary?period=${this.currentPeriod}&date=${this.currentDate}`);
            const summary = await response.json();
            this.renderSummary(summary);
        } catch (error) {
            console.error('Error loading summary:', error);
        }
    }

    renderResults(results) {
        const container = document.getElementById('resultsList');
        
        if (results.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No results found</h3>
                    <p>Add your first poker result to get started</p>
                </div>
            `;
            return;
        }

        container.innerHTML = results.map(result => `
            <div class="result-item ${result.result >= 0 ? 'positive' : 'negative'}">
                <div class="result-details">
                    <h4>${result.club_name} - ${result.account_name}</h4>
                    <p>${new Date(result.date_time).toLocaleString()}</p>
                </div>
                <div class="result-value ${result.result >= 0 ? 'positive' : 'negative'}">
                    ${result.result >= 0 ? '+' : ''}${result.result.toFixed(2)}
                </div>
                <div class="result-actions">
                    <button class="btn-edit" onclick="pokerTracker.editResult(${result.id})">Edit</button>
                </div>
            </div>
        `).join('');
    }

    renderSummary(summary) {
        const container = document.getElementById('summaryCards');
        
        if (summary.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No data available</h3>
                    <p>Add some results to see your summary</p>
                </div>
            `;
            return;
        }

        container.innerHTML = summary.map(club => `
            <div class="summary-card">
                <h3>${club.club_name}</h3>
                <div class="summary-stats">
                    <div class="stat">
                        <div class="stat-label">Total</div>
                        <div class="stat-value ${club.total_result >= 0 ? 'positive' : 'negative'}">
                            ${club.total_result >= 0 ? '+' : ''}${club.total_result.toFixed(2)}
                        </div>
                    </div>
                    <div class="stat">
                        <div class="stat-label">Sessions</div>
                        <div class="stat-value">${club.sessions}</div>
                    </div>
                    <div class="stat">
                        <div class="stat-label">Average</div>
                        <div class="stat-value ${club.avg_result >= 0 ? 'positive' : 'negative'}">
                            ${club.avg_result >= 0 ? '+' : ''}${club.avg_result.toFixed(2)}
                        </div>
                    </div>
                    <div class="stat">
                        <div class="stat-label">Best</div>
                        <div class="stat-value ${club.best_session >= 0 ? 'positive' : 'negative'}">
                            ${club.best_session >= 0 ? '+' : ''}${club.best_session.toFixed(2)}
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    async editResult(id) {
        try {
            const response = await fetch(`/api/results`);
            const results = await response.json();
            const result = results.find(r => r.id === id);
            
            if (result) {
                document.getElementById('editId').value = result.id;
                document.getElementById('editClubName').value = result.club_name;
                document.getElementById('editAccountName').value = result.account_name;
                document.getElementById('editResult').value = result.result;
                
                const localDateTime = new Date(result.date_time);
                localDateTime.setMinutes(localDateTime.getMinutes() - localDateTime.getTimezoneOffset());
                document.getElementById('editDateTime').value = localDateTime.toISOString().slice(0, 16);
                
                document.getElementById('editModal').style.display = 'block';
            }
        } catch (error) {
            this.showNotification('Error loading result for editing', 'error');
        }
    }

    async deleteResult() {
        const id = document.getElementById('editId').value;
        
        if (confirm('Are you sure you want to delete this result?')) {
            try {
                const response = await fetch(`/api/results/${id}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    this.closeModal();
                    this.loadData();
                    this.showNotification('Result deleted successfully!', 'success');
                } else {
                    const error = await response.json();
                    this.showNotification(error.error || 'Failed to delete result', 'error');
                }
            } catch (error) {
                this.showNotification('Network error occurred', 'error');
            }
        }
    }

    closeModal() {
        document.getElementById('editModal').style.display = 'none';
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            z-index: 1001;
            animation: slideIn 0.3s ease;
            background: ${type === 'success' ? '#38a169' : type === 'error' ? '#e53e3e' : '#4299e1'};
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

window.pokerTracker = new PokerTracker();

function closeModal() {
    window.pokerTracker.closeModal();
}

function deleteResult() {
    window.pokerTracker.deleteResult();
}