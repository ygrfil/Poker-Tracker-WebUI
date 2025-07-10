class PokerTracker {
    constructor() {
        this.currentPeriod = 'month';
        this.currentDate = new Date().toISOString().split('T')[0];
        this.settings = this.loadSettings();
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setCurrentDateTime();
        this.setFilterDate();
        this.updatePeriodDisplay();
        this.loadData();
        this.loadPreviousEntries();
    }

    setupEventListeners() {
        document.getElementById('resultForm').addEventListener('submit', this.handleAddResult.bind(this));
        document.getElementById('editForm').addEventListener('submit', this.handleEditResult.bind(this));
        document.getElementById('filterDate').addEventListener('change', this.handleDateFilter.bind(this));
        
        document.querySelectorAll('.btn-filter').forEach(btn => {
            btn.addEventListener('click', this.handlePeriodFilter.bind(this));
        });

        document.querySelector('.close').addEventListener('click', this.closeModal.bind(this));
        
        // Settings modal
        document.getElementById('settingsBtn').addEventListener('click', this.openSettingsModal.bind(this));
        document.getElementById('settingsClose').addEventListener('click', this.closeSettingsModal.bind(this));
        document.getElementById('settingsForm').addEventListener('submit', this.handleSettingsSubmit.bind(this));
        document.getElementById('resetSettings').addEventListener('click', this.resetSettings.bind(this));
        
        // Backup/Restore functionality
        document.getElementById('backupBtn').addEventListener('click', this.downloadBackup.bind(this));
        document.getElementById('restoreBtn').addEventListener('click', this.chooseRestoreFile.bind(this));
        document.getElementById('restoreFile').addEventListener('change', this.handleRestoreFileSelect.bind(this));
        document.getElementById('confirmRestoreBtn').addEventListener('click', this.confirmRestore.bind(this));
        
        // Period navigation
        document.getElementById('prevPeriod').addEventListener('click', this.navigatePeriod.bind(this, -1));
        document.getElementById('nextPeriod').addEventListener('click', this.navigatePeriod.bind(this, 1));
        
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal();
                this.closeSettingsModal();
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

        console.log('Submitting form data:', data);

        if (!data.club_name || !data.account_name || isNaN(data.result) || !data.date_time) {
            this.showNotification('Please fill in all fields correctly', 'error');
            return;
        }

        try {
            const response = await fetch('/api/results', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            console.log('Response status:', response.status);

            if (response.ok) {
                const result = await response.json();
                console.log('Success response:', result);
                
                // Preserve club and account values, only reset result and update datetime
                const clubName = document.getElementById('clubName').value;
                const accountName = document.getElementById('accountName').value;
                
                e.target.reset();
                
                // Restore club and account values
                document.getElementById('clubName').value = clubName;
                document.getElementById('accountName').value = accountName;
                
                this.setCurrentDateTime();
                this.saveToLocalStorage(data.club_name, data.account_name);
                this.loadData();
                this.showNotification('Result added successfully!', 'success');
            } else {
                const error = await response.json();
                console.error('Error response:', error);
                this.showNotification(error.error || 'Failed to add result', 'error');
            }
        } catch (error) {
            console.error('Network error:', error);
            this.showNotification('Network error: ' + error.message, 'error');
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
        this.updatePeriodDisplay();
        this.loadData();
    }

    async loadData() {
        await Promise.all([
            this.loadResults(),
            this.loadSummary(),
            this.loadPeriodSpecificEntries()
        ]);
    }

    async loadResults() {
        try {
            const params = new URLSearchParams({
                period: this.currentPeriod,
                date: this.currentDate,
                dayStartTime: this.settings.dayStartTime,
                weekStartDay: this.settings.weekStartDay
            });
            const response = await fetch(`/api/results?${params}`);
            const results = await response.json();
            this.renderResults(results);
        } catch (error) {
            console.error('Error loading results:', error);
        }
    }

    async loadSummary() {
        try {
            const params = new URLSearchParams({
                period: this.currentPeriod,
                date: this.currentDate,
                dayStartTime: this.settings.dayStartTime,
                weekStartDay: this.settings.weekStartDay
            });
            const response = await fetch(`/api/summary?${params}`);
            const summary = await response.json();
            this.renderSummary(summary);
        } catch (error) {
            console.error('Error loading summary:', error);
        }
    }

    async loadPeriodSpecificEntries() {
        try {
            const params = new URLSearchParams({
                period: this.currentPeriod,
                date: this.currentDate,
                dayStartTime: this.settings.dayStartTime,
                weekStartDay: this.settings.weekStartDay
            });
            const response = await fetch(`/api/results?${params}`);
            const results = await response.json();
            this.updatePeriodSpecificAutocomplete(results);
        } catch (error) {
            console.error('Error loading period-specific entries:', error);
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

        container.innerHTML = results.slice(0, 12).map(result => `
            <div class="result-row clickable" onclick="pokerTracker.fillFromPreviousResult({id: ${result.id}, club_name: '${result.club_name}', account_name: '${result.account_name}'})">
                <div class="result-club">${result.club_name}</div>
                <div class="result-account">${result.account_name}</div>
                <div class="result-date">${new Date(result.date_time).toLocaleDateString()}</div>
                <div class="result-amount ${result.result >= 0 ? 'positive' : 'negative'}">
                    ${result.result >= 0 ? '+' : ''}${this.settings.currencySymbol}${Math.abs(result.result).toFixed(2)}
                </div>
                <div class="result-actions">
                    <button class="btn-edit" onclick="pokerTracker.editResult(${result.id}); event.stopPropagation();">Edit</button>
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

        // Calculate overall totals
        const overallTotal = summary.reduce((sum, club) => sum + club.total_result, 0);
        const overallSessions = summary.reduce((sum, club) => sum + club.sessions, 0);

        // Create overall summary card + individual club cards
        const overallCard = `
            <div class="summary-card overall-summary">
                <h3>Overall Total</h3>
                <div class="summary-stats">
                    <div class="stat">
                        <div class="stat-label">Total</div>
                        <div class="stat-value ${overallTotal >= 0 ? 'positive' : 'negative'}">
                            ${overallTotal >= 0 ? '+' : ''}${this.settings.currencySymbol}${Math.abs(overallTotal).toFixed(0)}
                        </div>
                    </div>
                    <div class="stat">
                        <div class="stat-label">Sessions</div>
                        <div class="stat-value">${overallSessions}</div>
                    </div>
                </div>
            </div>
        `;

        const clubCards = summary.map(club => `
            <div class="summary-card">
                <h3>${club.club_name}</h3>
                <div class="summary-stats">
                    <div class="stat">
                        <div class="stat-label">Total</div>
                        <div class="stat-value ${club.total_result >= 0 ? 'positive' : 'negative'}">
                            ${club.total_result >= 0 ? '+' : ''}${this.settings.currencySymbol}${Math.abs(club.total_result).toFixed(0)}
                        </div>
                    </div>
                    <div class="stat">
                        <div class="stat-label">Sessions</div>
                        <div class="stat-value">${club.sessions}</div>
                    </div>
                </div>
            </div>
        `).join('');

        container.innerHTML = overallCard + clubCards;
    }

    updatePeriodSpecificAutocomplete(results) {
        // Create maps to track most recent usage
        const clubUsage = new Map();
        const accountUsage = new Map();
        
        // Sort results by date (most recent first) and track usage
        results.sort((a, b) => new Date(b.date_time) - new Date(a.date_time));
        
        results.forEach((result, index) => {
            if (!clubUsage.has(result.club_name)) {
                clubUsage.set(result.club_name, index); // Lower index = more recent
            }
            if (!accountUsage.has(result.account_name)) {
                accountUsage.set(result.account_name, index);
            }
        });
        
        // Get existing clubs/accounts from localStorage (all time)
        const allClubs = JSON.parse(localStorage.getItem('poker_clubs') || '[]');
        const allAccounts = JSON.parse(localStorage.getItem('poker_accounts') || '[]');
        
        // Sort period clubs by most recent usage
        const periodClubs = Array.from(clubUsage.keys()).sort((a, b) => {
            return clubUsage.get(a) - clubUsage.get(b);
        });
        
        // Sort period accounts by most recent usage
        const periodAccounts = Array.from(accountUsage.keys()).sort((a, b) => {
            return accountUsage.get(a) - accountUsage.get(b);
        });
        
        // Add localStorage entries that aren't in current period (alphabetically sorted)
        const extraClubs = allClubs.filter(club => !clubUsage.has(club)).sort();
        const extraAccounts = allAccounts.filter(acc => !accountUsage.has(acc)).sort();
        
        // Combine: period entries first (by recency), then extras (alphabetically)
        const combinedClubs = [...periodClubs, ...extraClubs];
        const combinedAccounts = [...periodAccounts, ...extraAccounts];
        
        // Update autocomplete with combined data
        this.updateAutocomplete('clubName', combinedClubs);
        this.updateAutocomplete('accountName', combinedAccounts);
        this.updateAutocomplete('editClubName', combinedClubs);
        this.updateAutocomplete('editAccountName', combinedAccounts);
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

    saveToLocalStorage(clubName, accountName) {
        let clubs = JSON.parse(localStorage.getItem('poker_clubs') || '[]');
        let accounts = JSON.parse(localStorage.getItem('poker_accounts') || '[]');
        
        if (!clubs.includes(clubName)) {
            clubs.push(clubName);
            localStorage.setItem('poker_clubs', JSON.stringify(clubs));
        }
        
        if (!accounts.includes(accountName)) {
            accounts.push(accountName);
            localStorage.setItem('poker_accounts', JSON.stringify(accounts));
        }
    }

    loadPreviousEntries() {
        const clubs = JSON.parse(localStorage.getItem('poker_clubs') || '[]');
        const accounts = JSON.parse(localStorage.getItem('poker_accounts') || '[]');
        
        this.updateAutocomplete('clubName', clubs);
        this.updateAutocomplete('accountName', accounts);
        this.updateAutocomplete('editClubName', clubs);
        this.updateAutocomplete('editAccountName', accounts);
    }

    updateAutocomplete(inputId, options) {
        const input = document.getElementById(inputId);
        if (!input) return;
        
        let datalist = document.getElementById(inputId + '_datalist');
        if (!datalist) {
            datalist = document.createElement('datalist');
            datalist.id = inputId + '_datalist';
            input.parentNode.appendChild(datalist);
            input.setAttribute('list', datalist.id);
        }
        
        datalist.innerHTML = '';
        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option;
            datalist.appendChild(optionElement);
        });
    }

    fillFromPreviousResult(result) {
        document.getElementById('clubName').value = result.club_name;
        document.getElementById('accountName').value = result.account_name;
        document.getElementById('result').focus();
    }


    loadSettings() {
        const defaultSettings = {
            dayStartTime: 0, // 12 AM
            weekStartDay: 1, // Monday
            dateFormat: 'default',
            currencySymbol: '$'
        };
        return JSON.parse(localStorage.getItem('poker_settings') || JSON.stringify(defaultSettings));
    }

    saveSettings(settings) {
        this.settings = settings;
        localStorage.setItem('poker_settings', JSON.stringify(settings));
    }

    openSettingsModal() {
        // Populate form with current settings
        document.getElementById('dayStartTime').value = this.settings.dayStartTime;
        document.getElementById('weekStartDay').value = this.settings.weekStartDay;
        document.getElementById('dateFormat').value = this.settings.dateFormat;
        document.getElementById('currencySymbol').value = this.settings.currencySymbol;
        
        document.getElementById('settingsModal').style.display = 'block';
    }

    closeSettingsModal() {
        document.getElementById('settingsModal').style.display = 'none';
    }

    handleSettingsSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const settings = {
            dayStartTime: parseInt(formData.get('dayStartTime')),
            weekStartDay: parseInt(formData.get('weekStartDay')),
            dateFormat: formData.get('dateFormat'),
            currencySymbol: formData.get('currencySymbol')
        };
        
        this.saveSettings(settings);
        this.closeSettingsModal();
        this.loadData(); // Refresh data with new settings
        this.updatePeriodDisplay();
        this.showNotification('Settings saved successfully!', 'success');
    }

    resetSettings() {
        const defaultSettings = {
            dayStartTime: 0,
            weekStartDay: 1,
            dateFormat: 'default',
            currencySymbol: '$'
        };
        this.saveSettings(defaultSettings);
        this.openSettingsModal(); // Refresh the form
        this.loadData();
        this.updatePeriodDisplay();
        this.showNotification('Settings reset to default', 'success');
    }

    navigatePeriod(direction) {
        const currentDate = new Date(this.currentDate);
        
        switch (this.currentPeriod) {
            case 'day':
                currentDate.setDate(currentDate.getDate() + direction);
                break;
            case 'week':
                currentDate.setDate(currentDate.getDate() + (7 * direction));
                break;
            case 'month':
                currentDate.setMonth(currentDate.getMonth() + direction);
                break;
            case 'year':
                currentDate.setFullYear(currentDate.getFullYear() + direction);
                break;
        }
        
        this.currentDate = currentDate.toISOString().split('T')[0];
        document.getElementById('filterDate').value = this.currentDate;
        this.loadData();
        this.updatePeriodDisplay();
    }

    updatePeriodDisplay() {
        const currentDate = new Date(this.currentDate);
        const displayElement = document.getElementById('currentPeriodRange');
        
        let displayText = '';
        switch (this.currentPeriod) {
            case 'day':
                displayText = this.formatDate(currentDate);
                break;
            case 'week':
                const weekStart = this.getWeekStart(currentDate);
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekEnd.getDate() + 6);
                displayText = `${this.formatDate(weekStart)} - ${this.formatDate(weekEnd)}`;
                break;
            case 'month':
                displayText = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                break;
            case 'year':
                displayText = currentDate.getFullYear().toString();
                break;
        }
        
        displayElement.textContent = displayText;
    }

    getWeekStart(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + this.settings.weekStartDay;
        return new Date(d.setDate(diff));
    }

    formatDate(date) {
        switch (this.settings.dateFormat) {
            case 'iso':
                return date.toISOString().split('T')[0];
            case 'european':
                return date.toLocaleDateString('en-GB');
            default:
                return date.toLocaleDateString('en-US');
        }
    }

    getDayStart(date) {
        const d = new Date(date);
        d.setHours(this.settings.dayStartTime, 0, 0, 0);
        return d;
    }

    async downloadBackup() {
        try {
            const response = await fetch('/api/backup');
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `poker-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                this.showNotification('Backup downloaded successfully!', 'success');
            } else {
                const error = await response.json();
                this.showNotification(error.error || 'Failed to create backup', 'error');
            }
        } catch (error) {
            this.showNotification('Network error occurred', 'error');
        }
    }

    chooseRestoreFile() {
        document.getElementById('restoreFile').click();
    }

    handleRestoreFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            document.getElementById('confirmRestoreBtn').style.display = 'inline-block';
            document.getElementById('confirmRestoreBtn').textContent = `Restore from ${file.name}`;
        }
    }

    async confirmRestore() {
        const fileInput = document.getElementById('restoreFile');
        const file = fileInput.files[0];
        
        if (!file) {
            this.showNotification('Please select a backup file first', 'error');
            return;
        }

        if (!confirm('Are you sure you want to restore from backup? This will replace ALL current data and cannot be undone!')) {
            return;
        }

        try {
            const formData = new FormData();
            formData.append('backup', file);
            
            const response = await fetch('/api/restore', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const result = await response.json();
                this.showNotification(`Database restored successfully! ${result.restored_records} records restored.`, 'success');
                
                // Reset UI and reload data
                fileInput.value = '';
                document.getElementById('confirmRestoreBtn').style.display = 'none';
                this.closeSettingsModal();
                this.loadData();
            } else {
                const error = await response.json();
                this.showNotification(error.error || 'Failed to restore backup', 'error');
            }
        } catch (error) {
            this.showNotification('Network error occurred', 'error');
        }
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