class PokerTracker {
    constructor() {
        this.currentPeriod = 'month';
        this.currentDate = new Date().toISOString().split('T')[0];
        this.settings = this.loadSettings();
        this.autocompleteCache = null; // Cache for autocomplete optimization
        this.lastResultsHash = null; // Cache for DOM rendering optimization
        this.lastSummaryHash = null; // Cache for summary rendering optimization
        this.domCache = {}; // Cache for DOM elements
        this.pendingDOMUpdates = []; // Batch DOM updates
        this.layoutStrategyCache = new Map(); // Cache for layout strategy optimization
        this.showAllClubsMode = false; // State for show all clubs mode
        this.init();
    }

    init() {
        this.cacheDOMElements();
        this.setupEventListeners();
        this.setCurrentDateTime();
        this.setFilterDate();
        this.updatePeriodDisplay();
        this.initializeViewMode(); // Initialize view mode state
        this.loadData();
        this.loadPreviousEntries();
        this.setupAutoTimeRefresh(); // Setup automatic time refresh every 30 minutes
    }

    cacheDOMElements() {
        // Cache frequently accessed DOM elements
        this.domCache = {
            resultsList: document.getElementById('resultsList'),
            summaryCards: document.getElementById('summaryCards'),
            resultForm: document.getElementById('resultForm'),
            editForm: document.getElementById('editForm'),
            clubName: document.getElementById('clubName'),
            accountName: document.getElementById('accountName'),
            result: document.getElementById('result'),
            editModal: document.getElementById('editModal'),
            settingsModal: document.getElementById('settingsModal'),
            commissionModal: document.getElementById('commissionModal'),
            filterDate: document.getElementById('filterDate'),
            summaryLoadingOverlay: document.getElementById('summaryLoadingOverlay'),
            resultsLoadingOverlay: document.getElementById('resultsLoadingOverlay')
        };
    }

    setupEventListeners() {
        // Use cached DOM elements for better performance
        this.domCache.resultForm.addEventListener('submit', this.handleAddResult.bind(this));
        this.domCache.editForm.addEventListener('submit', this.handleEditResult.bind(this));
        this.domCache.filterDate.addEventListener('change', this.handleDateFilter.bind(this));
        
        // Form auto-focus flow
        this.setupFormAutoFocus();
        
        // Text formatting for inputs
        this.setupTextFormatting();
        
        // Event delegation for filter buttons
        document.querySelector('.period-filters').addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-filter')) {
                this.handlePeriodFilter(e);
            }
        });

        // Event delegation for modal close buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('close')) {
                if (e.target.closest('#editModal')) this.closeModal();
                if (e.target.closest('#settingsModal')) this.closeSettingsModal();
                if (e.target.closest('#commissionModal')) this.closeCommissionModal();
            }
        });
        
        // Event delegation for results list
        this.domCache.resultsList.addEventListener('click', (e) => {
            const resultRow = e.target.closest('.result-row');
            if (resultRow && !e.target.classList.contains('btn-edit')) {
                const data = JSON.parse(resultRow.dataset.result || '{}');
                if (data.id) this.fillFromPreviousResult(data);
            }
            
            if (e.target.classList.contains('btn-edit')) {
                e.stopPropagation();
                const resultId = parseInt(e.target.dataset.resultId);
                if (resultId) this.editResult(resultId);
            }
        });
        
        // Event delegation for summary cards
        this.domCache.summaryCards.addEventListener('click', (e) => {
            // Handle overall summary toggle
            const overallSummary = e.target.closest('.overall-summary.toggle-button');
            if (overallSummary) {
                this.toggleShowAllClubs();
                return;
            }
            
            const clubCard = e.target.closest('.club-card.clickable');
            if (clubCard) {
                const clubName = clubCard.dataset.clubName;
                const commission = parseFloat(clubCard.dataset.commission || 0);
                this.openCommissionModal(clubName, commission);
            }
            
            // Handle overflow toggle button
            if (e.target.classList.contains('toggle-overflow')) {
                this.toggleOverflowSection(e.target);
            }
        });
        
        // Cache and bind other elements
        document.getElementById('settingsBtn').addEventListener('click', this.openSettingsModal.bind(this));
        document.getElementById('settingsForm').addEventListener('submit', this.handleSettingsSubmit.bind(this));
        document.getElementById('resetSettings').addEventListener('click', this.resetSettings.bind(this));
        
        document.getElementById('commissionForm').addEventListener('submit', this.handleCommissionSubmit.bind(this));
        document.getElementById('commissionPercentage').addEventListener('input', this.updateCommissionPreview.bind(this));
        
        document.getElementById('backupBtn').addEventListener('click', this.downloadBackup.bind(this));
        document.getElementById('restoreBtn').addEventListener('click', this.chooseRestoreFile.bind(this));
        document.getElementById('restoreFile').addEventListener('change', this.handleRestoreFileSelect.bind(this));
        document.getElementById('confirmRestoreBtn').addEventListener('click', this.confirmRestore.bind(this));
        
        document.getElementById('prevPeriod').addEventListener('click', () => this.navigatePeriod(-1));
        document.getElementById('nextPeriod').addEventListener('click', () => this.navigatePeriod(1));
        
        // Modal backdrop clicks
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal();
                this.closeSettingsModal();
                this.closeCommissionModal();
            }
        });

        // Keyboard navigation
        this.setupKeyboardNavigation();
        
        // Window resize optimization
        this.setupResizeHandler();
    }

    setupKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            // Global keyboard shortcuts
            switch (e.key) {
                case 'Escape':
                    // Close any open modals
                    if (this.domCache.editModal.style.display === 'block') {
                        this.closeModal();
                    } else if (this.domCache.settingsModal.style.display === 'block') {
                        this.closeSettingsModal();
                    } else if (this.domCache.commissionModal.style.display === 'block') {
                        this.closeCommissionModal();
                    }
                    break;

                case 'ArrowLeft':
                    if (!this.isInputFocused()) {
                        e.preventDefault();
                        this.navigatePeriod(-1);
                    }
                    break;

                case 'ArrowRight':
                    if (!this.isInputFocused()) {
                        e.preventDefault();
                        this.navigatePeriod(1);
                    }
                    break;

                case 'Enter':
                    // Submit forms when Enter is pressed from any form field
                    if (e.target.form) {
                        e.preventDefault();
                        e.target.form.dispatchEvent(new Event('submit', { cancelable: true }));
                    }
                    break;

                case '1':
                case '2':
                case '3':
                case '4':
                    // Quick period switching with number keys (if not in input)
                    if (!this.isInputFocused() && !e.ctrlKey && !e.metaKey) {
                        e.preventDefault();
                        const periods = ['day', 'week', 'month', 'year'];
                        const periodIndex = parseInt(e.key) - 1;
                        if (periods[periodIndex]) {
                            this.switchToPeriod(periods[periodIndex]);
                        }
                    }
                    break;
            }
        });

        // Tab navigation enhancement
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                this.handleTabNavigation(e);
            }
        });
    }

    isInputFocused() {
        const activeElement = document.activeElement;
        return activeElement && (
            activeElement.tagName === 'INPUT' || 
            activeElement.tagName === 'TEXTAREA' || 
            activeElement.tagName === 'SELECT' ||
            activeElement.contentEditable === 'true'
        );
    }

    switchToPeriod(period) {
        // Find and click the appropriate period button
        const periodBtn = document.querySelector(`[data-period="${period}"]`);
        if (periodBtn && !periodBtn.classList.contains('active')) {
            periodBtn.click();
        }
    }

    handleTabNavigation(e) {
        // Enhanced tab navigation - could add custom tab order here if needed
        // For now, let browser handle default tab order
    }

    // Utility functions for text formatting
    capitalizeWords(text) {
        if (!text) return text;
        return text.split(' ')
                  .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                  .join(' ');
    }

    normalizeText(text) {
        // Normalize text for storage (trim and basic cleanup)
        return text ? text.trim() : '';
    }

    setupFormAutoFocus() {
        // Auto-focus flow for main form - only on Tab or Enter, not on every keystroke
        this.domCache.clubName.addEventListener('keydown', (e) => {
            if ((e.key === 'Tab' || e.key === 'Enter') && e.target.value.trim().length > 0) {
                // Let Tab work naturally, only override Enter
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.domCache.accountName.focus();
                }
            }
        });

        this.domCache.accountName.addEventListener('keydown', (e) => {
            if ((e.key === 'Tab' || e.key === 'Enter') && e.target.value.trim().length > 0) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.domCache.result.focus();
                }
            }
        });

        // Smart cursor positioning for number fields
        this.domCache.result.addEventListener('focus', (e) => {
            // Select all text for easy replacement
            setTimeout(() => e.target.select(), 0);
        });

        // Commission percentage field
        const commissionPercentage = document.getElementById('commissionPercentage');
        if (commissionPercentage) {
            commissionPercentage.addEventListener('focus', (e) => {
                setTimeout(() => e.target.select(), 0);
            });
        }

        // Auto-focus to club name when form is reset
        this.domCache.resultForm.addEventListener('reset', () => {
            setTimeout(() => this.domCache.clubName.focus(), 0);
        });
    }

    setupTextFormatting() {
        // Format club and account names with proper capitalization
        const formatTextInput = (input) => {
            input.addEventListener('blur', (e) => {
                const formattedText = this.capitalizeWords(this.normalizeText(e.target.value));
                e.target.value = formattedText;
            });
        };

        // Apply formatting to main form inputs
        formatTextInput(this.domCache.clubName);
        formatTextInput(this.domCache.accountName);

        // Apply formatting to edit form inputs
        const editClubName = document.getElementById('editClubName');
        const editAccountName = document.getElementById('editAccountName');
        if (editClubName) formatTextInput(editClubName);
        if (editAccountName) formatTextInput(editAccountName);
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
            club_name: this.capitalizeWords(this.normalizeText(formData.get('clubName'))),
            account_name: this.capitalizeWords(this.normalizeText(formData.get('accountName'))),
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
                const clubName = this.domCache.clubName.value;
                const accountName = this.domCache.accountName.value;
                
                e.target.reset();
                
                // Batch DOM updates to prevent layout thrashing
                this.batchDOMUpdate(() => {
                    this.domCache.clubName.value = clubName;
                    this.domCache.accountName.value = accountName;
                    this.setCurrentDateTime();
                    // Auto-focus to result field for quick next entry
                    setTimeout(() => this.domCache.result.focus(), 100);
                });
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
            club_name: this.capitalizeWords(this.normalizeText(formData.get('editClubName'))),
            account_name: this.capitalizeWords(this.normalizeText(formData.get('editAccountName'))),
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
        this.autocompleteCache = null; // Invalidate cache on date change
        this.lastResultsHash = null; // Invalidate DOM cache
        this.lastSummaryHash = null; // Invalidate DOM cache
        this.loadData();
    }

    handlePeriodFilter(e) {
        document.querySelectorAll('.btn-filter').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        this.currentPeriod = e.target.dataset.period;
        this.autocompleteCache = null; // Invalidate cache on period change
        this.lastResultsHash = null; // Invalidate DOM cache
        this.lastSummaryHash = null; // Invalidate DOM cache
        this.updatePeriodDisplay();
        this.loadData();
    }

    async loadData() {
        // Show loading states without DOM restructuring
        this.setLoadingState(true);
        
        try {
            const params = new URLSearchParams({
                period: this.currentPeriod,
                date: this.currentDate,
                dayStartTime: this.settings.dayStartTime,
                weekStartDay: this.settings.weekStartDay
            });
            
            // Consolidate to 2 API calls instead of 3
            const [results, summary] = await Promise.all([
                fetch(`/api/results?${params}`).then(r => r.json()),
                fetch(`/api/summary?${params}`).then(r => r.json())
            ]);
            
            // Render data
            this.renderResults(results);
            this.renderSummary(summary);
            
            // Reuse results data for autocomplete (eliminates 3rd API call)
            this.updatePeriodSpecificAutocomplete(results);
            
        } catch (error) {
            console.error('Error loading data:', error);
            this.showNotification('Error loading data', 'error');
        } finally {
            // Hide loading with smooth transition
            this.setLoadingState(false);
        }
    }

    setLoadingState(isLoading) {
        // Use cached DOM elements for better performance
        const summaryOverlay = this.domCache.summaryLoadingOverlay;
        const resultsOverlay = this.domCache.resultsLoadingOverlay;
        const summaryContent = this.domCache.summaryCards;
        const resultsContent = this.domCache.resultsList;
        
        if (isLoading) {
            summaryOverlay.classList.add('active');
            resultsOverlay.classList.add('active');
            summaryContent.classList.add('loading');
            resultsContent.classList.add('loading');
        } else {
            summaryOverlay.classList.remove('active');
            resultsOverlay.classList.remove('active');
            summaryContent.classList.remove('loading');
            resultsContent.classList.remove('loading');
        }
    }


    renderResults(results) {
        const container = this.domCache.resultsList;
        const newResults = results.slice(0, 12);
        
        // Create hash for change detection
        const newHash = this.hashResults(newResults);
        if (this.lastResultsHash === newHash) {
            return; // No changes, skip DOM update
        }
        
        if (newResults.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No results found</h3>
                    <p>Add your first poker result to get started</p>
                </div>
            `;
            this.lastResultsHash = newHash;
            return;
        }

        // Use DocumentFragment for efficient batch DOM updates
        const fragment = document.createDocumentFragment();
        newResults.forEach(result => {
            const row = this.createResultRow(result);
            fragment.appendChild(row);
        });
        
        container.replaceChildren(fragment);
        this.lastResultsHash = newHash;
    }

    createResultRow(result) {
        const row = document.createElement('div');
        row.className = 'result-row clickable';
        
        // Use data attributes instead of inline event handlers
        row.dataset.result = JSON.stringify({
            id: result.id, 
            club_name: result.club_name, 
            account_name: result.account_name
        });
        
        row.innerHTML = `
            <div class="result-club">${result.club_name}</div>
            <div class="result-account">${result.account_name}</div>
            <div class="result-date">${new Date(result.date_time).toLocaleDateString()}</div>
            <div class="result-amount ${result.result >= 0 ? 'positive' : 'negative'}">
                ${result.result >= 0 ? '+' : ''}${this.settings.currencySymbol}${Math.abs(result.result).toFixed(2)}
            </div>
            <div class="result-actions">
                <button class="btn-edit" data-result-id="${result.id}">Edit</button>
            </div>
        `;
        
        return row;
    }

    hashResults(results) {
        // Simple hash function for change detection
        return results.map(r => `${r.id}-${r.result}-${r.date_time}`).join('|');
    }

    renderSummary(summary) {
        const container = this.domCache.summaryCards;
        
        // Create hash for change detection
        const newHash = this.hashSummary(summary);
        if (this.lastSummaryHash === newHash) {
            return; // No changes, skip DOM update
        }
        
        if (summary.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No data available</h3>
                    <p>Add some results to see your summary</p>
                </div>
            `;
            // Set data attributes even for empty state
            container.setAttribute('data-period', this.currentPeriod);
            container.setAttribute('data-club-count', 0);
            this.lastSummaryHash = newHash;
            return;
        }

        // Calculate overall total using commission-adjusted amounts
        const overallTotal = summary.reduce((sum, club) => sum + club.adjusted_total, 0);

        // Use DocumentFragment for efficient batch DOM updates
        const fragment = document.createDocumentFragment();
        
        // Create overall summary card
        const overallCard = this.createOverallSummaryCard(overallTotal);
        fragment.appendChild(overallCard);
        
        // Sort clubs based on current period and proximity to overall result
        const sortedSummary = this.smartSortClubs(summary, overallTotal);
        
        // Use consistent grid layout for all periods, with smart overflow for 19+ clubs
        const layoutStrategy = this.determineLayoutStrategy(summary.length);
        let overflowSection = null;
        
        // Single loop for optimal DOM operations
        sortedSummary.forEach((club, index) => {
            if (layoutStrategy.name === 'hybrid-overflow' && index >= layoutStrategy.maxVisibleClubs) {
                // Create overflow section on first overflow club
                if (!overflowSection) {
                    overflowSection = this.createOverflowSection(sortedSummary.slice(layoutStrategy.maxVisibleClubs));
                    fragment.appendChild(overflowSection);
                }
                // Skip creating cards here - they'll be lazy loaded
                return;
            }
            
            // Create primary club cards
            const clubCard = this.createClubCard(club);
            fragment.appendChild(clubCard);
        });

        container.replaceChildren(fragment);
        
        // Set data attributes for responsive CSS
        container.setAttribute('data-period', this.currentPeriod);
        container.setAttribute('data-club-count', Math.min(summary.length, 6));
        
        // Optimize layout for all views with smart club management
        this.optimizeLayoutForPeriod(container, summary.length);
        
        this.lastSummaryHash = newHash;
    }

    createOverallSummaryCard(overallTotal) {
        const card = document.createElement('div');
        card.className = `summary-card overall-summary toggle-button ${this.showAllClubsMode ? 'active' : ''}`;
        card.innerHTML = `
            <h3>Overall Total</h3>
            <div class="summary-stats">
                <div class="stat">
                    <div class="stat-value ${overallTotal >= 0 ? 'positive' : 'negative'}">
                        ${overallTotal >= 0 ? '+' : ''}${this.settings.currencySymbol}${Math.abs(overallTotal).toFixed(0)}
                    </div>
                </div>
            </div>
        `;
        return card;
    }

    createClubCard(club) {
        const card = document.createElement('div');
        card.className = 'summary-card club-card clickable';
        
        // Use data attributes instead of inline event handlers
        card.dataset.clubName = club.club_name;
        card.dataset.commission = club.commission_percentage || 0;
        
        card.innerHTML = `
            <h3>${club.club_name} ${club.commission_percentage > 0 ? `(${club.commission_percentage}%)` : ''}</h3>
            <div class="summary-stats">
                <div class="stat">
                    <div class="stat-value ${club.adjusted_total >= 0 ? 'positive' : 'negative'}">
                        ${club.adjusted_total >= 0 ? '+' : ''}${this.settings.currencySymbol}${Math.abs(club.adjusted_total).toFixed(0)}
                    </div>
                </div>
            </div>
        `;
        return card;
    }

    createOverflowSection(overflowClubs) {
        // Create overflow section with header and container
        const overflowSection = document.createElement('div');
        overflowSection.className = 'overflow-clubs-section';
        
        const overflowHeader = document.createElement('div');
        overflowHeader.className = 'overflow-header';
        overflowHeader.innerHTML = `
            <h4>Additional Clubs (${overflowClubs.length})</h4>
            <button class="toggle-overflow" data-expanded="false">Show All</button>
        `;
        overflowSection.appendChild(overflowHeader);
        
        const overflowContainer = document.createElement('div');
        overflowContainer.className = 'overflow-container collapsed';
        
        // Store overflow clubs data for lazy rendering
        overflowContainer.dataset.overflowClubs = JSON.stringify(overflowClubs);
        overflowContainer.dataset.lazyLoaded = 'false';
        
        overflowSection.appendChild(overflowContainer);
        return overflowSection;
    }

    hashSummary(summary) {
        // Simple hash function for change detection
        return summary.map(s => `${s.club_name}-${s.adjusted_total}-${s.commission_percentage}`).join('|');
    }

    smartSortClubs(summary, overallTotal) {
        // Smart sorting based on period and proximity to overall result
        if (this.currentPeriod === 'day' || this.currentPeriod === 'week') {
            // For day/week views: sort by proximity to overall average
            const averageResult = summary.length > 0 ? overallTotal / summary.length : 0;
            
            return summary.sort((a, b) => {
                // Calculate distance from average (closer = more interesting)
                const distanceA = Math.abs(a.adjusted_total - averageResult);
                const distanceB = Math.abs(b.adjusted_total - averageResult);
                
                // Secondary sort by absolute value (higher impact first)
                if (Math.abs(distanceA - distanceB) < 0.01) {
                    return Math.abs(b.adjusted_total) - Math.abs(a.adjusted_total);
                }
                
                return distanceA - distanceB;
            });
        } else {
            // For month/year views: keep original sorting by total (highest first)
            return summary.sort((a, b) => b.adjusted_total - a.adjusted_total);
        }
    }

    optimizeLayoutForPeriod(container, clubCount) {
        // Dynamic layout optimization for all views with smart club management
        const viewport = {
            width: window.innerWidth,
            height: window.innerHeight
        };
        
        // Special handling for show all clubs mode
        if (this.showAllClubsMode) {
            const showAllStrategy = this.calculateShowAllClubsLayout(viewport, clubCount);
            container.style.setProperty('--optimal-columns', showAllStrategy.columns);
            container.classList.add('optimized-layout');
            container.setAttribute('data-layout-mode', 'show-all-clubs');
            return;
        }
        
        // Determine layout strategy based on club count and period
        const layoutStrategy = this.determineLayoutStrategy(clubCount);
        
        // Calculate optimal columns based on strategy
        let optimalColumns = this.calculateOptimalColumns(viewport.width, clubCount, layoutStrategy);
        
        // For periods with potential for many clubs, optimize for screen space
        if (layoutStrategy.showAllWithoutScrolling) {
            const availableHeight = this.getAvailableHeight();
            const cardHeight = this.estimateCardHeight(layoutStrategy.compactMode);
            const maxRows = Math.floor(availableHeight / cardHeight);
            const maxColumnsForHeight = Math.ceil(clubCount / maxRows);
            
            // Use the more restrictive constraint
            optimalColumns = Math.max(optimalColumns, maxColumnsForHeight);
        }
        
        // Apply dynamic styling based on strategy - use consistent grid for all
        container.style.setProperty('--optimal-columns', optimalColumns);
        container.classList.add('optimized-layout')
        
        container.style.setProperty('--layout-strategy', layoutStrategy.name);
        
        // Set layout mode for CSS targeting
        container.setAttribute('data-layout-mode', layoutStrategy.name);
    }

    calculateShowAllClubsLayout(viewport, clubCount) {
        // Calculate optimal layout for show all clubs mode
        const minCardWidth = 120; // Reduced minimum card width
        const gap = 12; // Reduced gap between cards
        const containerPadding = 40; // Main page padding
        const summaryBarPadding = 16; // Summary bar internal padding
        const safetyMargin = 20; // Extra margin to ensure cards don't touch borders
        
        const availableWidth = viewport.width - containerPadding - summaryBarPadding - safetyMargin;
        const maxColumns = Math.floor(availableWidth / (minCardWidth + gap));
        
        // For show all clubs mode, we want to show as many as possible without scrolling
        const availableHeight = this.getShowAllAvailableHeight();
        const cardHeight = 80; // Card height in show all mode
        const maxRows = Math.floor(availableHeight / (cardHeight + gap));
        
        // Calculate optimal columns that fit both width and height constraints
        const maxColumnsForHeight = Math.ceil(clubCount / maxRows);
        const optimalColumns = Math.min(maxColumns, maxColumnsForHeight, 6); // Max 6 columns (reduced)
        
        return {
            columns: Math.max(optimalColumns, 1),
            maxRows: maxRows
        };
    }

    getShowAllAvailableHeight() {
        // Calculate available height for show all clubs mode (excludes results table)
        const headerHeight = document.querySelector('.header')?.offsetHeight || 0;
        const periodBarHeight = document.querySelector('.period-bar')?.offsetHeight || 0;
        const overallCardHeight = 80; // Height of overall summary card
        const padding = 60;
        
        return window.innerHeight - headerHeight - periodBarHeight - overallCardHeight - padding;
    }

    determineLayoutStrategy(clubCount) {
        // Check cache first to avoid recalculation
        const cacheKey = `${clubCount}-${this.currentPeriod}`;
        if (this.layoutStrategyCache.has(cacheKey)) {
            return this.layoutStrategyCache.get(cacheKey);
        }

        // Smart layout strategy based on club count and period
        let strategy;
        if (clubCount <= 12) {
            strategy = {
                name: 'show-all',
                showAllWithoutScrolling: true,
                compactMode: false,
                maxVisibleClubs: clubCount
            };
        } else if (clubCount <= 18) {
            strategy = {
                name: 'compact-all',
                showAllWithoutScrolling: true,
                compactMode: true,
                maxVisibleClubs: clubCount
            };
        } else {
            // 19+ clubs: Show top clubs + scrollable overflow
            const maxPrimaryClubs = this.currentPeriod === 'day' || this.currentPeriod === 'week' ? 12 : 15;
            strategy = {
                name: 'hybrid-overflow',
                showAllWithoutScrolling: false,
                compactMode: true,
                maxVisibleClubs: maxPrimaryClubs,
                overflowClubs: clubCount - maxPrimaryClubs
            };
        }

        // Cache the strategy and clean old entries if cache grows too large
        this.layoutStrategyCache.set(cacheKey, strategy);
        if (this.layoutStrategyCache.size > 20) {
            const firstKey = this.layoutStrategyCache.keys().next().value;
            this.layoutStrategyCache.delete(firstKey);
        }

        return strategy;
    }

    calculateOptimalColumns(viewportWidth, clubCount, layoutStrategy) {
        // Calculate optimal number of columns based on viewport width and layout strategy
        const minCardWidth = layoutStrategy?.compactMode ? 90 : 100;
        const gap = layoutStrategy?.compactMode ? 6 : 8;
        const containerPadding = 40; // Main page padding
        const summaryBarPadding = 16; // Summary bar internal padding (8px * 2)
        const safetyMargin = 20; // Extra margin to ensure cards don't touch borders
        
        const availableWidth = viewportWidth - containerPadding - summaryBarPadding - safetyMargin;
        const maxColumns = Math.floor(availableWidth / (minCardWidth + gap));
        
        // Adjust max columns based on layout strategy
        let maxColumnLimit = 5; // More conservative
        if (layoutStrategy?.name === 'compact-all') {
            maxColumnLimit = 6; // Reduced from 8
        } else if (layoutStrategy?.name === 'hybrid-overflow') {
            maxColumnLimit = 5; // Keep reasonable for hybrid mode
        }
        
        // Don't exceed the number of clubs or column limit
        return Math.min(maxColumns, clubCount, maxColumnLimit);
    }

    getAvailableHeight() {
        // Calculate available height for club cards
        const headerHeight = document.querySelector('.header')?.offsetHeight || 0;
        const periodBarHeight = document.querySelector('.period-bar')?.offsetHeight || 0;
        const overallCardHeight = 80; // Estimated height of overall summary card
        const padding = 40;
        
        return window.innerHeight - headerHeight - periodBarHeight - overallCardHeight - padding;
    }

    estimateCardHeight(compactMode = false) {
        // Estimate card height based on layout mode
        if (compactMode) {
            return 55; // Compact cards for all compact layouts
        } else if (this.currentPeriod === 'day' || this.currentPeriod === 'week') {
            return 60; // Slightly compact for day/week
        }
        return 80; // Normal cards for standard layouts
    }

    toggleOverflowSection(toggleButton) {
        // Toggle the overflow section visibility with lazy loading
        const overflowContainer = toggleButton.closest('.overflow-clubs-section').querySelector('.overflow-container');
        const isExpanded = toggleButton.dataset.expanded === 'true';
        
        if (isExpanded) {
            // Collapse
            overflowContainer.classList.remove('expanded');
            overflowContainer.classList.add('collapsed');
            toggleButton.textContent = 'Show All';
            toggleButton.dataset.expanded = 'false';
        } else {
            // Lazy load overflow clubs on first expand
            if (overflowContainer.dataset.lazyLoaded === 'false') {
                this.lazyLoadOverflowClubs(overflowContainer);
            }
            
            // Expand
            overflowContainer.classList.remove('collapsed');
            overflowContainer.classList.add('expanded');
            toggleButton.textContent = 'Show Less';
            toggleButton.dataset.expanded = 'true';
        }
    }

    lazyLoadOverflowClubs(overflowContainer) {
        // Lazy load overflow club cards
        const overflowClubs = JSON.parse(overflowContainer.dataset.overflowClubs || '[]');
        const fragment = document.createDocumentFragment();
        
        overflowClubs.forEach(club => {
            const clubCard = this.createClubCard(club);
            clubCard.classList.add('overflow-club');
            fragment.appendChild(clubCard);
        });
        
        overflowContainer.appendChild(fragment);
        overflowContainer.dataset.lazyLoaded = 'true';
    }

    toggleShowAllClubs() {
        // Toggle the show all clubs mode
        this.showAllClubsMode = !this.showAllClubsMode;
        
        const rightPanel = document.querySelector('.right-panel');
        const overallSummary = document.querySelector('.overall-summary.toggle-button');
        const summaryBar = document.querySelector('.summary-bar');
        const resultsContainer = document.querySelector('.results-table-container');
        const summaryCards = this.domCache.summaryCards;
        
        if (this.showAllClubsMode) {
            rightPanel.classList.add('show-all-clubs-mode');
            if (overallSummary) {
                overallSummary.classList.add('active');
            }
        } else {
            rightPanel.classList.remove('show-all-clubs-mode');
            if (overallSummary) {
                overallSummary.classList.remove('active');
            }
            
            // Force reset all inline styles to ensure CSS takes over
            if (summaryBar) {
                summaryBar.style.flex = '';
                summaryBar.style.height = '';
                summaryBar.style.maxHeight = '';
                summaryBar.style.overflow = '';
            }
            if (resultsContainer) {
                resultsContainer.style.display = '';
                resultsContainer.style.opacity = '';
            }
            if (summaryCards) {
                summaryCards.style.display = '';
                summaryCards.style.gridTemplateColumns = '';
                summaryCards.style.gap = '';
                summaryCards.style.height = '';
                summaryCards.style.maxHeight = '';
                summaryCards.style.overflow = '';
            }
        }
        
        // Save the new state
        this.saveViewModeState();
        
        // Force a layout refresh
        setTimeout(() => {
            this.updateLayoutForCurrentMode();
        }, 50); // Small delay to ensure CSS has been applied
    }

    updateLayoutForCurrentMode() {
        // Re-optimize layout for current mode without reloading data
        const container = this.domCache.summaryCards;
        const clubCount = parseInt(container.getAttribute('data-club-count') || 0);
        
        if (clubCount > 0) {
            // Update layout mode attribute for CSS targeting
            if (this.showAllClubsMode) {
                container.setAttribute('data-layout-mode', 'show-all-clubs');
            } else {
                // Restore previous layout mode based on club count
                const layoutStrategy = this.determineLayoutStrategy(clubCount);
                container.setAttribute('data-layout-mode', layoutStrategy.name);
            }
            
            this.optimizeLayoutForPeriod(container, clubCount);
        }
    }

    setupResizeHandler() {
        // Debounced resize handler for layout optimization
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                // Re-optimize layout for all periods
                const container = this.domCache.summaryCards;
                const clubCount = parseInt(container.getAttribute('data-club-count') || 0);
                if (clubCount > 0) {
                    this.optimizeLayoutForPeriod(container, clubCount);
                }
            }, 250); // 250ms debounce
        });
    }

    updatePeriodSpecificAutocomplete(results) {
        // Create cache key to avoid reprocessing same data
        const cacheKey = `${this.currentPeriod}-${this.currentDate}-${results.length}`;
        if (this.autocompleteCache?.key === cacheKey) {
            return; // Skip if same data already processed
        }
        
        // Create maps to track most recent usage
        const clubUsage = new Map();
        const accountUsage = new Map();
        
        // Results are already sorted by date DESC from SQL query - no need to re-sort
        // Single pass through results to track usage
        results.forEach((result, index) => {
            if (!clubUsage.has(result.club_name)) {
                clubUsage.set(result.club_name, index); // Lower index = more recent
            }
            if (!accountUsage.has(result.account_name)) {
                accountUsage.set(result.account_name, index);
            }
        });
        
        // Get existing clubs/accounts from localStorage (all time) with proper formatting
        const allClubs = JSON.parse(localStorage.getItem('poker_clubs') || '[]')
                           .map(club => this.capitalizeWords(club));
        const allAccounts = JSON.parse(localStorage.getItem('poker_accounts') || '[]')
                             .map(account => this.capitalizeWords(account));
        
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
        
        // Cache the result
        this.autocompleteCache = { 
            key: cacheKey, 
            clubs: combinedClubs, 
            accounts: combinedAccounts 
        };
        
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
            background: ${type === 'success' ? '#38a169' : type === 'error' ? '#e53e3e' : '#4299e1'};
        `;

        document.body.appendChild(notification);

        // Add micro-interaction feedback to related elements
        this.addFeedbackAnimation(type);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    addFeedbackAnimation(type) {
        // Add visual feedback to the form or relevant element
        const targetElement = this.domCache.resultForm;
        if (targetElement) {
            const feedbackClass = type === 'success' ? 'success-feedback' : 'error-feedback';
            targetElement.classList.add(feedbackClass);
            
            // Remove class after animation completes
            setTimeout(() => {
                targetElement.classList.remove(feedbackClass);
            }, type === 'success' ? 600 : 500);
        }
    }

    saveToLocalStorage(clubName, accountName) {
        // Normalize names for consistent storage
        const normalizedClubName = this.capitalizeWords(this.normalizeText(clubName));
        const normalizedAccountName = this.capitalizeWords(this.normalizeText(accountName));
        
        let clubs = JSON.parse(localStorage.getItem('poker_clubs') || '[]');
        let accounts = JSON.parse(localStorage.getItem('poker_accounts') || '[]');
        
        // Check case-insensitive to avoid duplicates
        const existingClub = clubs.find(club => club.toLowerCase() === normalizedClubName.toLowerCase());
        const existingAccount = accounts.find(account => account.toLowerCase() === normalizedAccountName.toLowerCase());
        
        if (!existingClub) {
            clubs.push(normalizedClubName);
            localStorage.setItem('poker_clubs', JSON.stringify(clubs));
        }
        
        if (!existingAccount) {
            accounts.push(normalizedAccountName);
            localStorage.setItem('poker_accounts', JSON.stringify(accounts));
        }
    }

    loadPreviousEntries() {
        // Load and format stored entries
        const clubs = JSON.parse(localStorage.getItem('poker_clubs') || '[]')
                       .map(club => this.capitalizeWords(club));
        const accounts = JSON.parse(localStorage.getItem('poker_accounts') || '[]')
                          .map(account => this.capitalizeWords(account));
        
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
        // Batch DOM updates to prevent layout thrashing
        this.batchDOMUpdate(() => {
            this.domCache.clubName.value = result.club_name;
            this.domCache.accountName.value = result.account_name;
            this.domCache.result.focus();
        });
    }

    batchDOMUpdate(updateCallback) {
        // Add update to pending queue
        this.pendingDOMUpdates.push(updateCallback);
        
        // Schedule batch execution if not already scheduled
        if (this.pendingDOMUpdates.length === 1) {
            requestAnimationFrame(() => {
                // Execute all pending updates in a single frame
                const updates = this.pendingDOMUpdates.splice(0);
                updates.forEach(update => update());
            });
        }
    }


    loadSettings() {
        const defaultSettings = {
            dayStartTime: 0, // 12 AM
            weekStartDay: 1, // Monday
            dateFormat: 'default',
            currencySymbol: '$',
            showAllClubsMode: false // Persist show all clubs mode preference
        };
        const settings = JSON.parse(localStorage.getItem('poker_settings') || JSON.stringify(defaultSettings));
        
        // Load show all clubs mode state
        this.showAllClubsMode = settings.showAllClubsMode || false;
        
        return settings;
    }

    saveSettings(settings) {
        this.settings = settings;
        localStorage.setItem('poker_settings', JSON.stringify(settings));
    }

    saveViewModeState() {
        // Save current view mode to settings
        const currentSettings = this.loadSettings();
        currentSettings.showAllClubsMode = this.showAllClubsMode;
        this.saveSettings(currentSettings);
    }

    initializeViewMode() {
        // Initialize view mode from saved settings
        const rightPanel = document.querySelector('.right-panel');
        
        if (this.showAllClubsMode) {
            rightPanel.classList.add('show-all-clubs-mode');
        } else {
            rightPanel.classList.remove('show-all-clubs-mode');
        }
    }

    setupAutoTimeRefresh() {
        // Refresh datetime input every 30 minutes to keep time current
        const refreshInterval = 30 * 60 * 1000; // 30 minutes in milliseconds
        
        setInterval(() => {
            // Only update if the datetime input hasn't been manually modified recently
            const dateTimeInput = document.getElementById('dateTime');
            if (dateTimeInput) {
                const now = new Date();
                const inputTime = new Date(dateTimeInput.value);
                const timeDiff = Math.abs(now - inputTime);
                
                // Only auto-update if the current value is more than 2 minutes old
                // This prevents overwriting user's manual time entries
                if (timeDiff > 2 * 60 * 1000) {
                    this.setCurrentDateTime();
                }
            }
        }, refreshInterval);
        
        // Also set up a more frequent check every 5 minutes for users who stay on the page long
        setInterval(() => {
            const dateTimeInput = document.getElementById('dateTime');
            if (dateTimeInput) {
                const now = new Date();
                const inputTime = new Date(dateTimeInput.value);
                const timeDiff = Math.abs(now - inputTime);
                
                // Auto-update if time is more than 10 minutes old
                if (timeDiff > 10 * 60 * 1000) {
                    this.setCurrentDateTime();
                }
            }
        }, 5 * 60 * 1000); // 5 minutes
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
        this.autocompleteCache = null; // Invalidate cache on navigation
        this.lastResultsHash = null; // Invalidate DOM cache
        this.lastSummaryHash = null; // Invalidate DOM cache
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

    openCommissionModal(clubName, currentPercentage) {
        document.getElementById('commissionClubName').value = clubName;
        document.getElementById('commissionPercentage').value = currentPercentage;
        document.getElementById('commissionModal').style.display = 'block';
        this.updateCommissionPreview();
    }

    closeCommissionModal() {
        document.getElementById('commissionModal').style.display = 'none';
    }

    async handleCommissionSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const data = {
            club_name: formData.get('commissionClubName'),
            commission_percentage: parseFloat(formData.get('commissionPercentage'))
        };

        try {
            const response = await fetch('/api/commissions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                this.closeCommissionModal();
                this.loadData();
                this.showNotification(`Commission rate updated for ${data.club_name}!`, 'success');
            } else {
                const error = await response.json();
                this.showNotification(error.error || 'Failed to update commission', 'error');
            }
        } catch (error) {
            this.showNotification('Network error occurred', 'error');
        }
    }

    updateCommissionPreview() {
        const percentage = parseFloat(document.getElementById('commissionPercentage').value) || 0;
        const previewText = document.getElementById('previewText');
        
        if (percentage === 0) {
            previewText.textContent = 'No commission will be applied';
        } else {
            const winExample = 100 * (1 - percentage / 100);
            const loseExample = -100 * (1 - percentage / 100);
            previewText.innerHTML = `
                Examples:<br>
                Win ${this.settings.currencySymbol}100 → You get ${this.settings.currencySymbol}${winExample.toFixed(2)}<br>
                Lose ${this.settings.currencySymbol}100 → You lose ${this.settings.currencySymbol}${Math.abs(loseExample).toFixed(2)}
            `;
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