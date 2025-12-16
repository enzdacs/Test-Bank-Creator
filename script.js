// ============================================
// BoardNotch APPLICATION
// ============================================

class QuizMasterApp {
    constructor() {
        this.testBanks = {};
        this.currentBank = null;
        this.currentQuestions = [];
        this.currentEditingBank = null;
        this.surpriseEnabled = true;
        this.quizState = {
            currentIndex: 0,
            answers: [],
            startTime: null,
            timeLimit: null,
            timerInterval: null,
            immediateMode: true,
            isActive: false
        };
        this.examLocked = false;
        this.gameState = {
            currentIndex: 0,
            score: 0,
            streak: 0,
            maxStreak: 0,
            correctAnswers: 0,
            wrongAnswers: 0,
            timePerQuestion: 15000,
            questionStartTime: null,
            timerInterval: null,
            isActive: false,
            answers: []
        };

        this.init();
    }

    init() {
        this.loadData();
        this.loadDarkMode();
        this.setupEventListeners();
        this.updateTestBankList();
        this.updateSelectOptions();
        this.updateAnalytics();
    }

    setupEventListeners() {
        const timerCheckbox = document.getElementById('timerEnabled');
        if (timerCheckbox) {
            timerCheckbox.addEventListener('change', () => {
                document.getElementById('timerInput').style.display = 
                    timerCheckbox.checked ? 'block' : 'none';
            });
        }

        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
    }

    // ============================================
    // DATA MANAGEMENT
    // ============================================

    loadData() {
        const saved = localStorage.getItem('quizMasterData');
        if (saved) {
            try {
                this.testBanks = JSON.parse(saved);
                console.log('Loaded test banks:', this.testBanks);
            } catch (error) {
                console.error('Failed to load data:', error);
                this.showToast('Failed to load saved data', 'error');
            }
        }
    }

    saveData() {
        try {
            localStorage.setItem('quizMasterData', JSON.stringify(this.testBanks));
            return true;
        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                this.showToast('Storage limit exceeded! Please export and delete old data.', 'error');
            } else {
                this.showToast('Failed to save data', 'error');
            }
            return false;
        }
    }

    // ============================================
    // THEME & BACKGROUND
    // ============================================

    toggleDarkMode() {
        const button = document.querySelector('.theme-toggle');
        const icon = document.getElementById('themeIcon');
        
        // Add rotation animation
        button.classList.add('rotating');
        
        setTimeout(() => {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            
            // Change icon based on mode
            icon.textContent = isDark ? '🌙' : '☀️';
            
            localStorage.setItem('darkMode', isDark);
            button.classList.remove('rotating');
        }, 250);
    }

    loadDarkMode() {
        const isDark = localStorage.getItem('darkMode') === 'true';
        const icon = document.getElementById('themeIcon');
        
        if (isDark) {
            document.body.classList.add('dark-mode');
            if (icon) icon.textContent = '🌙';
        } else {
            if (icon) icon.textContent = '☀️';
        }
    }

    // ============================================
    // UI HELPERS
    // ============================================

    showLoading(message = 'Loading...') {
        const loading = document.createElement('div');
        loading.className = 'loading-overlay';
        loading.id = 'loadingOverlay';
        loading.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <div>${message}</div>
            </div>
        `;
        document.body.appendChild(loading);
    }

    hideLoading() {
        const loading = document.getElementById('loadingOverlay');
        if (loading) loading.remove();
    }

    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ============================================
    // QUESTION PARSING
    // ============================================

    parseQuestions(text) {
        text = text.trim();
        const questions = [];
        const questionBlocks = text.split(/\n\s*\n+/);
        
        questionBlocks.forEach(block => {
            block = block.trim();
            if (!block) return;
            
            const lines = block.split('\n').map(l => l.trim()).filter(l => l);
            if (lines.length === 0) return;
            
            const firstLine = lines[0];
            // Updated regex to handle Q#: format explicitly if present, but focus on content
            const questionMatch = firstLine.match(/^(Q\d+|\d+):\s*(.+)/i) || ['', 0, firstLine];
            
            const id = questionMatch[1] || String(questions.length + 1); // Use Q# or sequential number
            const questionText = questionMatch[2] ? questionMatch[2].trim() : questionMatch[0].trim();
            
            // If we didn't find a Q# prefix, we assume the whole first line is the question, and move options check to line 1
            let startIndex = questionMatch[2] ? 1 : 1; 

            const options = [];
            let correctAnswer = null;
            
            for (let i = startIndex; i < lines.length; i++) {
                const line = lines[i];
                // Regex for options, accommodating *[A-D]. [Option Text]
                const optionMatch = line.match(/^(\*?)([A-D])\.\s*(.+)$/i);
                
                if (optionMatch) {
                    const hasAsterisk = optionMatch[1] === '*';
                    const letter = optionMatch[2].toUpperCase();
                    const optionText = optionMatch[3].trim();
                    
                    options.push(optionText);
                    
                    if (hasAsterisk) {
                        correctAnswer = letter;
                    }
                }
            }
            
            // Validate: Must have exactly 4 options and a correct answer marked
            if (options.length === 4 && correctAnswer) {
                questions.push({
                    // Use a unique ID based on title and question for better analytics/tracking if needed
                    id: `${questions.length + 1}`, 
                    question: questionText,
                    options: options,
                    correct: correctAnswer
                });
            }
        });
        
        return questions;
    }


    // ============================================
    // TEST BANK MANAGEMENT
    // ============================================

    toggleQuestionsInput() {
        const bankTitle = document.getElementById('bankTitle').value.trim();
        const questionsInputGroup = document.getElementById('questionsInputGroup');
        
        if (bankTitle) {
            questionsInputGroup.style.display = 'block';
        } else {
            questionsInputGroup.style.display = 'none';
        }
    }

    bulkAddQuestions() {
        const title = document.getElementById('bankTitle').value.trim();
        const text = document.getElementById('questionsInput').value.trim();

        if (!title) {
            this.showToast('Please enter a Test Bank Title', 'warning');
            document.getElementById('bankTitle').focus();
            return;
        }

        if (!text) {
            this.showToast('Please paste your questions', 'warning');
            document.getElementById('questionsInput').focus();
            return;
        }

        this.showLoading('Parsing questions...');

        setTimeout(() => {
            const questions = this.parseQuestions(text);
            
            if (questions.length === 0) {
                this.hideLoading();
                this.showToast('No valid questions found. Check your format!', 'error');
                return;
            }

            if (!this.testBanks[title]) {
                this.testBanks[title] = {
                    title: title,
                    questions: [],
                    attempts: [],
                    gameAttempts: [],
                    createdAt: new Date().toISOString()
                };
            }

            questions.forEach(q => {
                this.testBanks[title].questions.push(q);
            });

            this.saveData();
            this.updateTestBankList();
            this.updateSelectOptions();
            
            document.getElementById('questionsInput').value = '';
            document.getElementById('bankTitle').value = '';
            document.getElementById('questionsInputGroup').style.display = 'none';
            
            this.hideLoading();
            this.showToast(`✅ ${questions.length} question(s) added! Total: ${this.testBanks[title].questions.length}`, 'success');
        }, 100);
    }

    updateTestBankList() {
        const list = document.getElementById('testBankList');
        if (!list) return;
        
        list.innerHTML = '';

        Object.keys(this.testBanks).forEach(key => {
            const bank = this.testBanks[key];
            const card = document.createElement('div');
            card.className = 'test-bank-card';
            
            let avgScore = 'N/A';
            if (bank.attempts.length > 0) {
                const avg = bank.attempts.reduce((sum, att) => sum + parseFloat(att.percentage), 0) / bank.attempts.length;
                avgScore = avg.toFixed(1) + '%';
            }
            
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
                    <div style="flex: 1;">
                        <h3 style="margin-bottom: 8px;">${bank.title}</h3>
                        <p style="margin: 3px 0;">📝 ${bank.questions.length} questions</p>
                        <p style="margin: 3px 0;">📊 ${bank.attempts.length} attempts</p>
                        <p style="margin: 3px 0;">⭐ Avg: ${avgScore}</p>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; flex-shrink: 0;">
                        <button onclick="app.viewBank('${key.replace(/'/g, "\\'")}');" title="View" style="background: #28a745; border: none; color: white; width: 36px; height: 36px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.3s; font-size: 1.1em;">👁️</button>
                        <button onclick="app.editBank('${key.replace(/'/g, "\\'")}');" title="Edit" style="background: #17a2b8; border: none; color: white; width: 36px; height: 36px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.3s; font-size: 1.1em;">✏️</button>
                        <button onclick="app.shareSingleBank('${key.replace(/'/g, "\\'")}');" title="Share" style="background: #667eea; border: none; color: white; width: 36px; height: 36px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.3s; font-size: 1.1em;">🔗</button>
                        <button onclick="app.deleteBank('${key.replace(/'/g, "\\'")}');" title="Delete" style="background: #dc3545; border: none; color: white; width: 36px; height: 36px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.3s; font-size: 1.1em;">🗑️</button>
                    </div>
                </div>
            `;

            list.appendChild(card);
        });

        if (Object.keys(this.testBanks).length === 0) {
            list.innerHTML = '<p style="text-align: center; padding: 40px; color: #6c757d;">No test banks yet. Create your first one above!</p>';
        }
    }

    async deleteBank(key) {
        const confirmed = confirm(`Are you sure you want to delete "${key}"? This cannot be undone.`);
        if (confirmed) {
            delete this.testBanks[key];
            this.saveData();
            this.updateTestBankList();
            this.updateSelectOptions();
            this.showToast('Test bank deleted', 'info');
        }
    }

    viewBank(key) {
        this.currentViewKey = key;
        const bank = this.testBanks[key];
        
        document.getElementById('viewBankTitle').textContent = bank.title;
        document.getElementById('viewSearchInput').value = '';
        
        this.renderViewQuestions(bank.questions);
        
        document.getElementById('viewModal').classList.add('active');
    }

    renderViewQuestions(questions) {
        const questionsList = document.getElementById('viewQuestionsList');
        const noResults = document.getElementById('viewNoResults');
        
        questionsList.innerHTML = '';
        
        if (questions.length === 0) {
            noResults.style.display = 'block';
            questionsList.style.display = 'none';
            return;
        }
        
        noResults.style.display = 'none';
        questionsList.style.display = 'block';
        
        questions.forEach((q, index) => {
            const questionDiv = document.createElement('div');
            questionDiv.style.cssText = 'background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #28a745;';
            questionDiv.className = 'view-question-item';
            questionDiv.setAttribute('data-question-index', index);
            questionDiv.innerHTML = `
                <strong>Q${index + 1}:</strong> ${q.question}
                <div style="margin-top: 10px;">
                    ${q.options.map((opt, i) => {
                        const letter = String.fromCharCode(65 + i);
                        const isCorrect = letter === q.correct;
                        return `<div style="padding: 5px; color: ${isCorrect ? '#28a745' : '#6c757d'}; font-weight: ${isCorrect ? 'bold' : 'normal'};">
                            ${isCorrect ? '✓' : '•'} ${letter}. ${opt}
                        </div>`;
                    }).join('')}
                </div>
            `;
            questionsList.appendChild(questionDiv);
        });
    }

    filterViewQuestions() {
        const searchTerm = document.getElementById('viewSearchInput').value.toLowerCase().trim();
        const bank = this.testBanks[this.currentViewKey];
        
        if (!searchTerm) {
            this.renderViewQuestions(bank.questions);
            return;
        }
        
        const filteredQuestions = bank.questions.filter((q, index) => {
            if (q.question.toLowerCase().includes(searchTerm)) return true;
            if (q.options.some(opt => opt.toLowerCase().includes(searchTerm))) return true;
            if (String(index + 1).includes(searchTerm)) return true;
            return false;
        });
        
        this.renderViewQuestions(filteredQuestions);
    }

    closeViewModal() {
        document.getElementById('viewModal').classList.remove('active');
    }

    editBank(key) {
        this.currentEditingBank = key;
        const bank = this.testBanks[key];
        
        // Store original state for comparison
        this.originalBankState = {
            title: bank.title,
            questions: JSON.parse(JSON.stringify(bank.questions))
        };
        
        document.getElementById('editBankTitle').textContent = bank.title;
        document.getElementById('editBankName').value = bank.title;
        document.getElementById('editQuestionsInput').value = '';
        document.getElementById('editSearchInput').value = '';
        
        this.renderEditQuestions();
        this.updateSaveButton();

        // Add event listener for title changes
        setTimeout(() => {
            const titleInput = document.getElementById('editBankName');
            const questionsInput = document.getElementById('editQuestionsInput');
            
            titleInput.addEventListener('input', () => this.updateSaveButton());
            questionsInput.addEventListener('input', () => this.updateSaveButton());
        }, 100);
        
        document.getElementById('editModal').classList.add('active');
    }

    renderEditQuestions(filteredIndices = null) {
        const bank = this.testBanks[this.currentEditingBank];
        const questionsList = document.getElementById('editQuestionsList');
        const noResults = document.getElementById('editNoResults');
        
        questionsList.innerHTML = '';
        
        const indicesToRender = filteredIndices !== null ? filteredIndices : 
            bank.questions.map((_, i) => i);
        
        if (indicesToRender.length === 0) {
            noResults.style.display = 'block';
            questionsList.style.display = 'none';
            return;
        }
        
        noResults.style.display = 'none';
        questionsList.style.display = 'block';
        
        indicesToRender.forEach(index => {
            const q = bank.questions[index];
            const questionDiv = document.createElement('div');
            questionDiv.id = `question-${index}`;
            questionDiv.className = 'edit-question-item';
            questionDiv.style.cssText = 'background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #667eea;';
            questionDiv.innerHTML = `
                <div style="margin-bottom: 10px;">
                    <strong style="font-size: 1em;">Q${index + 1}:</strong>
                    <textarea style="width: 100%; margin-top: 5px; padding: 8px; resize: none; font-family: inherit; font-size: 1em;" id="q-text-${index}">${q.question}</textarea>
                </div>
                <div style="margin-top: 10px;">
                    ${q.options.map((opt, i) => {
                        const letter = String.fromCharCode(65 + i);
                        const isCorrect = letter === q.correct;
                        return `
                            <div style="display: flex; align-items: center; margin: 5px 0;">
                                <input type="radio" name="correct-${index}" value="${letter}" ${isCorrect ? 'checked' : ''} style="margin-right: 10px;">
                                <strong>${letter}.</strong>
                                <input type="text" value="${opt}" id="q-opt-${index}-${i}" style="flex: 1; margin-left: 10px; padding: 5px;">
                            </div>
                        `;
                    }).join('')}
                </div>
                <button class="btn btn-danger" onclick="app.deleteQuestion(${index})" style="margin-top: 10px;">
                    🗑️ Delete Question
                </button>
            `;
            
            questionsList.appendChild(questionDiv);
            
            // Add event listeners for change detection
            const qTextarea = questionDiv.querySelector(`#q-text-${index}`);
            if (qTextarea) {
                qTextarea.addEventListener('input', () => this.updateSaveButton());
            }

            for (let i = 0; i < 4; i++) {
                const optInput = questionDiv.querySelector(`#q-opt-${index}-${i}`);
                if (optInput) {
                    optInput.addEventListener('input', () => this.updateSaveButton());
                }
            }

            const radios = questionDiv.querySelectorAll(`input[name="correct-${index}"]`);
            radios.forEach(radio => {
                radio.addEventListener('change', () => this.updateSaveButton());
            });
        });
    }

    updateSaveButton() {
        const saveBtn = document.querySelector('#editModal .btn-success');
        if (!saveBtn) return;
        
        const newTitle = document.getElementById('editBankName').value.trim();
        const hasNewQuestions = document.getElementById('editQuestionsInput').value.trim().length > 0;
        
        // Check if title changed
        const titleChanged = newTitle !== this.originalBankState.title;
        
        // Check if any questions were modified (Simplified check: relies on user interaction/delete, but we'll check content for thoroughness)
        const bank = this.testBanks[this.currentEditingBank];
        let questionsChanged = bank.questions.length !== this.originalBankState.questions.length;
        
        if (!questionsChanged) {
            for (let i = 0; i < bank.questions.length; i++) {
                // If a question was modified on the screen:
                const qTextarea = document.getElementById(`q-text-${i}`);
                if (qTextarea && qTextarea.value !== this.originalBankState.questions[i].question) {
                    questionsChanged = true;
                    break;
                }
                
                for (let j = 0; j < 4; j++) {
                    const optInput = document.getElementById(`q-opt-${i}-${j}`);
                    if (optInput && optInput.value !== this.originalBankState.questions[i].options[j]) {
                        questionsChanged = true;
                        break;
                    }
                }
                
                const correctRadio = document.querySelector(`input[name="correct-${i}"]:checked`);
                if (correctRadio && correctRadio.value !== this.originalBankState.questions[i].correct) {
                    questionsChanged = true;
                    break;
                }
            }
        }
        
        // Enable button only if something changed
        if (titleChanged || questionsChanged || hasNewQuestions) {
            saveBtn.disabled = false;
            saveBtn.style.opacity = '1';
            saveBtn.style.cursor = 'pointer';
        } else {
            saveBtn.disabled = true;
            saveBtn.style.opacity = '0.5';
            saveBtn.style.cursor = 'not-allowed';
        }
    }
    
    filterEditQuestions() {
        const searchTerm = document.getElementById('editSearchInput').value.toLowerCase().trim();
        const bank = this.testBanks[this.currentEditingBank];
        
        if (!searchTerm) {
            this.renderEditQuestions();
            return;
        }
        
        const filteredIndices = [];
        bank.questions.forEach((q, index) => {
            if (q.question.toLowerCase().includes(searchTerm)) {
                filteredIndices.push(index);
                return;
            }
            if (q.options.some(opt => opt.toLowerCase().includes(searchTerm))) {
                filteredIndices.push(index);
                return;
            }
            if (String(index + 1).includes(searchTerm)) {
                filteredIndices.push(index);
            }
        });
        
        this.renderEditQuestions(filteredIndices);
    }

    addQuestionsToBank() {
        const text = document.getElementById('editQuestionsInput').value.trim();
        
        if (!text) {
            this.showToast('Please paste questions to add', 'warning');
            return;
        }

        this.showLoading('Adding questions...');

        setTimeout(() => {
            const questions = this.parseQuestions(text);
            
            if (questions.length === 0) {
                this.hideLoading();
                this.showToast('No valid questions found', 'error');
                return;
            }

            // Check for duplicates
            const existingQuestions = this.testBanks[this.currentEditingBank].questions;
            const duplicates = [];
            const newQuestions = [];

            questions.forEach(newQ => {
                const isDuplicate = existingQuestions.some(existingQ => {
                    return existingQ.question.trim().toLowerCase() === newQ.question.trim().toLowerCase() &&
                        JSON.stringify(existingQ.options) === JSON.stringify(newQ.options);
                });

                if (isDuplicate) {
                    duplicates.push(newQ);
                } else {
                    newQuestions.push(newQ);
                }
            });

            if (duplicates.length > 0) {
                this.hideLoading();
                const overwrite = confirm(`Found ${duplicates.length} potential duplicate question(s) (same question text and options). Do you want to overwrite the existing duplicates?\n\nClick OK to overwrite, Cancel to discard duplicates.`);
                
                if (overwrite) {
                    // Remove old duplicates and add all questions
                    duplicates.forEach(dupQ => {
                        const index = existingQuestions.findIndex(existingQ => 
                            existingQ.question.trim().toLowerCase() === dupQ.question.trim().toLowerCase()
                        );
                        if (index !== -1) {
                            existingQuestions.splice(index, 1);
                        }
                    });
                    questions.forEach(q => existingQuestions.push(q));
                    this.saveData();
                    document.getElementById('editQuestionsInput').value = '';
                    this.renderEditQuestions();
                    this.showToast(`✅ ${questions.length} question(s) added (${duplicates.length} overwritten)!`, 'success');
                } else {
                    // Add only new questions
                    newQuestions.forEach(q => existingQuestions.push(q));
                    this.saveData();
                    document.getElementById('editQuestionsInput').value = '';
                    this.renderEditQuestions();
                    this.showToast(`✅ ${newQuestions.length} question(s) added (${duplicates.length} discarded)!`, 'info');
                }
            } else {
                questions.forEach(q => existingQuestions.push(q));
                this.saveData();
                document.getElementById('editQuestionsInput').value = '';
                this.renderEditQuestions();
                this.hideLoading();
                this.showToast(`✅ ${questions.length} question(s) added!`, 'success');
            }
        }, 100);
    }

    async deleteQuestion(index) {
        const confirmed = confirm('Are you sure you want to delete this question?');
        if (confirmed) {
            this.testBanks[this.currentEditingBank].questions.splice(index, 1);
            this.saveData();
            this.renderEditQuestions();
            this.updateTestBankList();
            this.showToast('Question deleted', 'info');
        }
    }

    saveEditedBank() {
        const newName = document.getElementById('editBankName').value.trim();
        
        if (!newName) {
            this.showToast('Please enter a test bank name', 'warning');
            return;
        }
        
        const oldName = this.currentEditingBank;
        const bank = this.testBanks[oldName];

        // 1. Update existing questions from inputs
        bank.questions.forEach((q, index) => {
            const questionText = document.getElementById(`q-text-${index}`);
            if (questionText) {
                q.question = questionText.value;
            }
            
            const options = [];
            for (let i = 0; i < 4; i++) {
                const optInput = document.getElementById(`q-opt-${index}-${i}`);
                if (optInput) {
                    options.push(optInput.value);
                }
            }
            q.options = options;
            
            const correctRadio = document.querySelector(`input[name="correct-${index}"]:checked`);
            if (correctRadio) {
                q.correct = correctRadio.value;
            }
        });

        // 2. Add new questions from the bulk input (if any) - already handled by addQuestionsToBank
        
        // 3. Rename the bank if the title changed
        if (newName !== oldName) {
            // Check if the new name conflicts with an existing bank
            if (this.testBanks[newName] && newName !== oldName) {
                this.showToast(`Test bank named "${newName}" already exists. Cannot rename.`, 'error');
                return;
            }
            bank.title = newName;
            this.testBanks[newName] = bank;
            delete this.testBanks[oldName];
        }
        
        this.saveData();
        this.updateTestBankList();
        this.updateSelectOptions();
        this.closeEditModal();
        
        this.showToast('✅ Test bank updated successfully!', 'success');
    }

    closeEditModal() {
        document.getElementById('editModal').classList.remove('active');
        this.currentEditingBank = null;
    }

    openRRTResults() {
        // EDIT THIS URL TO YOUR DESIRED LINK
        const rrtResultsURL = "https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExcTR3dG0wMzZldmxibDlqamp3a3h4cmxlcXJyc2c4ZDNyMGNjcHg5eiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/bAKICgYrXZqPlkuHDr/giphy.gif";
        window.open(rrtResultsURL, '_blank');
    }

    showSurprise() {
        // Check if surprise is enabled
        if (!this.surpriseEnabled) {
            this.showToast('This feature is currently disabled', 'info');
            return;
        }

        // Create surprise overlay
        const surpriseDiv = document.createElement('div');
        surpriseDiv.id = 'surpriseOverlay';
        surpriseDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            animation: fadeIn 0.5s;
        `;
        
        surpriseDiv.innerHTML = `
            <div style="text-align: center; color: white; padding: 40px; max-width: 800px; animation: slideUp 0.8s;">
                <div style="font-size: 6em; margin-bottom: 20px; animation: bounce 1s infinite;">🎉</div>
                <h1 style="font-size: 3em; margin-bottom: 20px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">CONGRATULATIONS!</h1>
                <h2 style="font-size: 2em; margin-bottom: 30px; font-weight: normal;">FOR PASSING THE RTLE 2025!</h2>
                <h2 style="font-size: 2.5em; margin-bottom: 40px; font-weight: bold; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">EYMHIE EMERALD T. BAYACAL, RRT</h2>
                <button onclick="app.stopConfetti(); document.getElementById('surpriseOverlay').remove()" style="background: white; color: #667eea; border: none; padding: 15px 40px; border-radius: 30px; font-size: 1.2em; font-weight: bold; cursor: pointer; box-shadow: 0 5px 15px rgba(0,0,0,0.3); transition: all 0.3s;">
                    Close
                </button>
            </div>
        `;
        
        document.body.appendChild(surpriseDiv);
        
        // Add confetti animation
        this.createConfetti();
    }

    createConfetti() {
        const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffa500'];
        
        // Create confetti continuously
        this.confettiInterval = setInterval(() => {
            const confetti = document.createElement('div');
            confetti.style.cssText = `
                position: fixed;
                width: 10px;
                height: 10px;
                background: ${colors[Math.floor(Math.random() * colors.length)]};
                left: ${Math.random() * 100}%;
                top: -10px;
                opacity: 1;
                transform: rotate(${Math.random() * 360}deg);
                animation: confettiFall ${3 + Math.random() * 2}s linear forwards;
                z-index: 10001;
                border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
            `;
            
            const overlay = document.getElementById('surpriseOverlay');
            if (overlay) {
                overlay.appendChild(confetti);
                setTimeout(() => confetti.remove(), 5000);
            } else {
                // Stop confetti if overlay is removed
                clearInterval(this.confettiInterval);
            }
        }, 30);
    }

    stopConfetti() {
        if (this.confettiInterval) {
            clearInterval(this.confettiInterval);
        }
    }

    // ============================================
    // IMPORT/EXPORT
    // ============================================

    exportAllData() {
        if (Object.keys(this.testBanks).length === 0) {
            this.showToast('No test banks to export', 'warning');
            return;
        }

        if (!confirm('Export all test banks as JSON file?')) {
            return;
        }

        const dataStr = JSON.stringify(this.testBanks, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `quiz-master-backup-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);

        this.showToast('✅ Test banks exported successfully!', 'success');
    }

    showImportModal() {
        document.getElementById('importModal').classList.add('active');
        document.getElementById('importCodeInput').value = '';
    }

    closeImportModal() {
        document.getElementById('importModal').classList.remove('active');
    }

    importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.showLoading('Importing data...');

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                
                let importCount = 0;
                Object.keys(importedData).forEach(key => {
                    if (this.testBanks[key]) {
                        if (confirm(`Test bank "${key}" already exists. Overwrite?`)) {
                            this.testBanks[key] = importedData[key];
                            importCount++;
                        }
                    } else {
                        this.testBanks[key] = importedData[key];
                        importCount++;
                    }
                });

                this.saveData();
                this.updateTestBankList();
                this.updateSelectOptions();
                
                this.hideLoading();
                this.showToast(`✅ Imported ${importCount} test bank(s)!`, 'success');
            } catch (error) {
                this.hideLoading();
                this.showToast('❌ Invalid file format', 'error');
                console.error('Import error:', error);
            }
        };
        reader.readAsText(file);

        event.target.value = '';
        this.closeImportModal();
    }

    generateShareCode(data) {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        let code = '';
        for (let i = 0; i < 32; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        const shareData = {
            code: code,
            data: data,
            timestamp: new Date().toISOString()
        };
        
        // Use a different key/method to store the share data to avoid polluting main data
        // NOTE: This uses localStorage, which is limited by browser, but sufficient for the scope of this SPA
        localStorage.setItem(`share_${code}`, JSON.stringify(shareData));
        return code;
    }

    shareSingleBank(key) {
        this.currentShareKey = key;
        const singleBankData = {};
        singleBankData[key] = this.testBanks[key];
        
        // This is a simplification. In a real application, you would send this data 
        // to a server/database and get a short, permanent link back.
        const shareCode = this.generateShareCode(singleBankData);
        const shareLink = `QM-${shareCode}`; // Simple prefix for identification
        
        document.getElementById('shareCodeOutput').value = shareLink;
        document.getElementById('shareModalTitle').textContent = `Share: ${this.testBanks[key].title}`;
        document.getElementById('shareModal').classList.add('active');
    }

    exportSingleBank() {
        const key = this.currentShareKey;
        if (!key) return;
        
        const singleBankData = {};
        singleBankData[key] = this.testBanks[key];
        
        const dataStr = JSON.stringify(singleBankData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${key.replace(/[^a-z0-9]/gi, '_')}-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
        
        this.showToast('✅ Test bank exported!', 'success');
    }

    closeShareModal() {
        document.getElementById('shareModal').classList.remove('active');
    }

    copyShareCode() {
        const textarea = document.getElementById('shareCodeOutput');
        textarea.select();
        textarea.setSelectionRange(0, 99999);

        try {
            document.execCommand('copy');
            this.showToast('✅ Share link copied!', 'success');
        } catch (err) {
            this.showToast('📋 Please manually copy the link', 'info');
        }
    }

    importFromCode() {
        const code = document.getElementById('importCodeInput').value.trim();
        
        if (!code) {
            this.showToast('Please paste a share link first!', 'warning');
            return;
        }

        this.showLoading('Importing...');

        setTimeout(() => {
            try {
                const cleanCode = code.replace('QM-', '');
                const stored = localStorage.getItem(`share_${cleanCode}`);
                
                if (!stored) {
                    this.hideLoading();
                    this.showToast('❌ Invalid or expired share link', 'error');
                    return;
                }

                const shareData = JSON.parse(stored);
                const importedData = shareData.data;
                
                let importCount = 0;
                Object.keys(importedData).forEach(key => {
                    if (this.testBanks[key]) {
                        if (confirm(`Test bank "${key}" already exists. Overwrite?`)) {
                            this.testBanks[key] = importedData[key];
                            importCount++;
                        }
                    } else {
                        this.testBanks[key] = importedData[key];
                        importCount++;
                    }
                });

                this.saveData();
                this.updateTestBankList();
                this.updateSelectOptions();
                this.closeImportModal();
                
                this.hideLoading();
                this.showToast(`✅ Successfully imported ${importCount} test bank(s)!`, 'success');
            } catch (error) {
                this.hideLoading();
                this.showToast('❌ Invalid share link', 'error');
                console.error('Import error:', error);
            }
        }, 500);
    }

    // ============================================
    // QUIZ FUNCTIONALITY
    // ============================================

    updateSelectOptions() {
        const select = document.getElementById('selectBank');
        const studySelect = document.getElementById('studySelectBank');
        const gameSelect = document.getElementById('gameSelectBank');

        const selectors = [select, studySelect, gameSelect];
        
        selectors.forEach(sel => {
            if (!sel) return;
            sel.innerHTML = '<option value="">Choose a test bank...</option>';
            
            Object.keys(this.testBanks).forEach(key => {
                const bank = this.testBanks[key];
                if (bank.questions && bank.questions.length > 0) {
                    const option = document.createElement('option');
                    option.value = key;
                    option.textContent = `${bank.title} (${bank.questions.length} questions)`;
                    sel.appendChild(option);
                }
            });
        });
    }

    loadQuizSettings() {
        const selected = document.getElementById('selectBank').value;
        const settings = document.getElementById('quizSettings');
        
        if (selected) {
            const bank = this.testBanks[selected];
            const totalQuestions = bank.questions.length;
            const questionCountSelect = document.getElementById('questionCount');
            
            // Clear and rebuild options based on available questions
            questionCountSelect.innerHTML = '<option value="all">All Questions</option>';
            
            const options = [10, 30, 50, 100];
            options.forEach(num => {
                if (num <= totalQuestions) {
                    const option = document.createElement('option');
                    option.value = num;
                    option.textContent = `${num} Questions`;
                    questionCountSelect.appendChild(option);
                }
            });
            
            // Always add the exact total if it's not already in the list
            if (!options.includes(totalQuestions) && totalQuestions > 0) {
                const option = document.createElement('option');
                option.value = totalQuestions;
                option.textContent = `${totalQuestions} Questions`;
                questionCountSelect.appendChild(option);
            }
            
            // Add custom option
            const customOption = document.createElement('option');
            customOption.value = 'custom';
            customOption.textContent = 'Custom';
            questionCountSelect.appendChild(customOption);
            
            settings.style.display = 'block';
        } else {
            settings.style.display = 'none';
        }
    }

    toggleCustomQuestionCount() {
        const select = document.getElementById('questionCount');
        const customInput = document.getElementById('customQuestionInput');
        
        if (select.value === 'custom') {
            customInput.style.display = 'block';
        } else {
            customInput.style.display = 'none';
        }
    }

    startQuiz() {
        const selected = document.getElementById('selectBank').value;
        if (!selected) return;

        this.currentBank = this.testBanks[selected];
        
        // Get question count preference
        const questionCountSelect = document.getElementById('questionCount').value;
        let questionCount;

        if (questionCountSelect === 'all') {
            questionCount = this.currentBank.questions.length;
        } else if (questionCountSelect === 'custom') {
            questionCount = parseInt(document.getElementById('customQuestionNumber').value) || this.currentBank.questions.length;
            questionCount = Math.min(questionCount, this.currentBank.questions.length);
        } else {
            questionCount = parseInt(questionCountSelect);
            questionCount = Math.min(questionCount, this.currentBank.questions.length);
        }

        // Shuffle and slice questions
        let questions = this.currentBank.questions;
        if (document.getElementById('shuffleQuestions').checked) {
            questions = this.shuffleArray([...questions]);
        }
        this.currentQuestions = questions.slice(0, questionCount);
        
        this.quizState = {
            currentIndex: 0,
            answers: [],
            startTime: Date.now(),
            timeLimit: document.getElementById('timerEnabled').checked ? 
                document.getElementById('timeLimit').value * 60 * 1000 : null,
            timerInterval: null,
            immediateMode: document.getElementById('immediateMode').checked,
            isActive: true
        };

        this.examLocked = true; // Lock the exam
        this.highlightActiveTab(); // Visual indicator

        document.getElementById('quizSettings').style.display = 'none';
        document.getElementById('quizContainer').style.display = 'block';

        if (this.quizState.timeLimit) {
            this.startTimer();
        }

        this.showQuestion();
    }

    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    startTimer() {
        const timerDiv = document.createElement('div');
        timerDiv.id = 'quizTimer';
        timerDiv.className = 'timer';
        document.body.appendChild(timerDiv);

        this.quizState.timerInterval = setInterval(() => {
            if (!this.quizState.isActive) {
                clearInterval(this.quizState.timerInterval);
                const timer = document.getElementById('quizTimer');
                if (timer) timer.remove();
                return;
            }

            const elapsed = Date.now() - this.quizState.startTime;
            const remaining = this.quizState.timeLimit - elapsed;

            if (remaining <= 0) {
                this.endQuiz();
                return;
            }

            const mins = Math.floor(remaining / 60000);
            const secs = Math.floor((remaining % 60000) / 1000);
            timerDiv.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;

            if (remaining < 60000) {
                timerDiv.classList.add('warning');
            }
        }, 1000);
    }

    showQuestion() {
        const container = document.getElementById('quizContainer');
        const q = this.currentQuestions[this.quizState.currentIndex];

        const progress = ((this.quizState.currentIndex + 1) / this.currentQuestions.length) * 100;

        container.innerHTML = `
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${progress}%"></div>
            </div>
            <div style="text-align: right; margin-bottom: 10px;">
                <button class="btn btn-danger" onclick="app.exitQuiz()" style="min-width: auto; padding: 8px 16px;">❌ Exit Test</button>
            </div>
            <div class="quiz-question">
                <h3>Question ${this.quizState.currentIndex + 1} of ${this.currentQuestions.length}</h3>
                <p style="font-size: 1.2em; margin: 20px 0;">${q.question}</p>
                <div class="quiz-options">
                    ${q.options.map((opt, i) => `
                        <div class="quiz-option" onclick="app.selectAnswer('${String.fromCharCode(65 + i)}', this)">
                            <input type="radio" name="answer" value="${String.fromCharCode(65 + i)}" id="opt${i}">
                            <label for="opt${i}">${String.fromCharCode(65 + i)}. ${opt}</label>
                        </div>
                    `).join('')}
                </div>
                <button class="btn btn-primary" onclick="app.submitAnswer()" style="margin-top: 20px;">
                    ${this.quizState.immediateMode ? 'Submit Answer' : 'Next Question'}
                </button>
            </div>
        `;
    }

    exitQuiz() {
        if (confirm('Are you sure you want to exit the exam? Your progress will not be saved.')) {
            this.quizState.isActive = false;
            this.examLocked = false; // Unlock when user exits
            if (this.quizState.timerInterval) {
                clearInterval(this.quizState.timerInterval);
            }
            const timer = document.getElementById('quizTimer');
            if (timer) timer.remove();
            location.reload();
        }
    }

    selectAnswer(answer, element) {
        if (this.quizState.immediateMode && document.querySelector('.quiz-option.correct')) return; // Prevent selection after feedback is shown

        document.querySelectorAll('.quiz-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        element.classList.add('selected');
        document.querySelector(`input[value="${answer}"]`).checked = true;
    }

    submitAnswer() {
        const selected = document.querySelector('input[name="answer"]:checked');
        const currentQuestion = this.currentQuestions[this.quizState.currentIndex];

        if (!selected && this.quizState.immediateMode) {
            this.showToast('Please select an answer', 'warning');
            return;
        }
        
        // If already submitted and in immediate mode, move to next question
        if (document.querySelector('.quiz-option.correct')) {
            this.nextQuestion();
            return;
        }

        const answer = selected ? selected.value : null;
        const correct = currentQuestion.correct;
        
        this.quizState.answers.push({
            questionId: currentQuestion.id,
            selected: answer,
            correct: correct,
            isCorrect: answer === correct,
            bankTitle: this.currentBank.title // Add bank context
        });

        if (this.quizState.immediateMode && answer) {
            this.showFeedback(answer === correct);
        } else {
            this.nextQuestion();
        }
    }

    showFeedback(isCorrect) {
        const options = document.querySelectorAll('.quiz-option');
        const correct = this.currentQuestions[this.quizState.currentIndex].correct;

        options.forEach((opt, i) => {
            const letter = String.fromCharCode(65 + i);
            if (letter === correct) {
                opt.classList.add('correct');
            } else if (opt.querySelector('input').checked && !isCorrect) {
                opt.classList.add('incorrect');
            }
            opt.style.pointerEvents = 'none';
        });
        
        document.querySelector('.btn-primary').textContent = 'Next Question'; // Change button text

        setTimeout(() => {
            this.nextQuestion();
        }, 2000);
    }

    nextQuestion() {
        this.quizState.currentIndex++;
        if (this.quizState.currentIndex < this.currentQuestions.length) {
            this.showQuestion();
        } else {
            this.endQuiz();
        }
    }

    async endQuiz() {
        this.quizState.isActive = false;
        this.examLocked = false; // Unlock when exam ends
        this.removeTabHighlight(); // Remove visual indicator
        if (this.quizState.timerInterval) {
            clearInterval(this.quizState.timerInterval);
            const timer = document.getElementById('quizTimer');
            if (timer) timer.remove();
        }

        const score = this.quizState.answers.filter(a => a.isCorrect).length;
        const total = this.quizState.answers.length;
        const percentage = ((score / total) * 100).toFixed(1);
        const duration = Date.now() - this.quizState.startTime;

        this.currentBank.attempts.push({
            date: new Date().toISOString(),
            score: score,
            total: total,
            questionCount: total,
            percentage: percentage,
            duration: duration,
            answers: this.quizState.answers
        });

        this.saveData();

        let message = '';
        let icon = '';
        if (percentage <= 40) {
            message = 'Keep Practicing!';
            icon = '📚';
        } else if (percentage <= 70) {
            message = "Study more, you're almost there!";
            icon = '💪';
        } else if (percentage <= 85) {
            message = 'Great Job! I know you can do better!';
            icon = '🎯';
        } else {
            message = "Excellent! RRT na'to!";
            icon = '🎉';
        }

        const container = document.getElementById('quizContainer');
        container.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div class="feedback-icon">${icon}</div>
                <h2>${message}</h2>
                <h3 style="margin: 20px 0;">Score: ${score}/${total} (${percentage}%)</h3>
                <p style="color: #6c757d;">Time: ${Math.floor(duration / 60000)} minutes ${Math.floor((duration % 60000) / 1000)} seconds</p>
                <div style="margin: 30px 0; text-align: left; max-height: 50vh; overflow-y: auto;">
                    ${this.quizState.answers.map((a, i) => {
                        const question = this.currentQuestions[i];
                        return `
                            <div style="background: #f8f9fa; padding: 20px; margin: 15px 0; border-radius: 8px; border-left: 5px solid ${a.isCorrect ? '#28a745' : '#dc3545'};">
                                <h4 style="color: #495057; margin-bottom: 15px;">Question ${i + 1}: ${question.question}</h4>
                                ${question.options.map((opt, optIndex) => {
                                    const letter = String.fromCharCode(65 + optIndex);
                                    const isCorrect = letter === a.correct;
                                    const isSelected = letter === a.selected;
                                    let bgColor = 'transparent';
                                    let textColor = '#495057';
                                    let icon = '';
                                    
                                    if (isCorrect && isSelected) {
                                        bgColor = '#d4edda';
                                        textColor = '#155724';
                                        icon = '✅';
                                    } else if (isCorrect && !isSelected) {
                                        bgColor = '#d4edda';
                                        textColor = '#155724';
                                        icon = '✓';
                                    } else if (!isCorrect && isSelected) {
                                        bgColor = '#f8d7da';
                                        textColor = '#721c24';
                                        icon = '❌';
                                    }
                                    
                                    // Use body.dark-mode to apply dark mode styles inside the review section
                                    if (document.body.classList.contains('dark-mode')) {
                                        if (isCorrect && isSelected) {
                                            bgColor = '#1e4620';
                                            textColor = '#d4edda';
                                        } else if (isCorrect && !isSelected) {
                                            bgColor = '#1e4620';
                                            textColor = '#d4edda';
                                        } else if (!isCorrect && isSelected) {
                                            bgColor = '#4a1a1a';
                                            textColor = '#f8d7da';
                                        } else {
                                            bgColor = '#0f3460';
                                            textColor = '#e0e0e0';
                                        }
                                    }
                                    
                                    return `
                                        <div style="background: ${bgColor}; padding: 12px; margin: 8px 0; border-radius: 6px; color: ${textColor}; font-weight: ${isCorrect || isSelected ? 'bold' : 'normal'};">
                                            ${icon} ${letter}. ${opt}
                                        </div>
                                    `;
                                }).join('')}
                                </div>
                            `;
                        }).join('')}
                    </div>
                <button class="btn btn-primary" onclick="app.retakeQuiz()">🔄 Retake Test</button>
                <button class="btn btn-secondary" onclick="location.reload()">🏠 Back to Home</button>
            </div>
        `;

        this.updateAnalytics();
    }

    retakeQuiz() {
        this.quizState = {
            currentIndex: 0,
            answers: [],
            startTime: Date.now(),
            timeLimit: this.quizState.timeLimit,
            timerInterval: null,
            immediateMode: this.quizState.immediateMode,
            isActive: true
        };

        // Always shuffle for each attempt
        this.currentQuestions = this.shuffleArray([...this.currentBank.questions]);

        if (this.quizState.timeLimit) {
            this.startTimer();
        }
        
        this.examLocked = true;
        this.highlightActiveTab();

        this.showQuestion();
    }

    // ============================================
    // ANALYTICS
    // ============================================

    showAnalyticsChart(type) {
        const content = document.getElementById('analyticsContent');
        
        if (type === 'table') {
            this.updateAnalytics();
            return;
        }
        
        const bankData = [];
        Object.values(this.testBanks).forEach(bank => {
            if (bank.attempts.length > 0) {
                const avgScore = bank.attempts.reduce((sum, att) => sum + parseFloat(att.percentage), 0) / bank.attempts.length;
                
                bankData.push({
                    name: bank.title,
                    score: avgScore.toFixed(1),
                    attempts: bank.attempts.length
                });
            }
        });
        
        if (bankData.length === 0) {
            content.innerHTML = '<p style="text-align: center; padding: 40px; color: #6c757d;">No quiz attempts yet. Take a quiz to see analytics!</p>';
            return;
        }
        
        if (type === 'bar') {
            this.renderBarChart(bankData, content);
        } else if (type === 'pie') {
            this.renderPieChart(content);
        }
    }

    renderBarChart(data, container) {
        let html = '<div style="padding: 20px;"><h3>Average Scores by Test Bank</h3>';
        
        data.forEach(item => {
            const percentage = parseFloat(item.score);
            const color = percentage >= 80 ? '#28a745' : percentage >= 60 ? '#ffc107' : '#dc3545';
            html += `
                <div style="margin: 20px 0;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <strong>${item.name}</strong>
                        <span>${item.score}% (${item.attempts} attempts)</span>
                    </div>
                    <div style="background: #e9ecef; border-radius: 10px; height: 30px; overflow: hidden;">
                        <div style="background: ${color}; height: 100%; width: ${percentage}%; transition: width 0.3s; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">
                            ${percentage >= 10 ? item.score + '%' : ''}
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;
    }

    renderPieChart(container) {
        const allAttempts = [];
        Object.values(this.testBanks).forEach(bank => {
            bank.attempts.forEach(att => {
                allAttempts.push(parseFloat(att.percentage));
            });
        });
        
        if (allAttempts.length === 0) {
            container.innerHTML = '<p style="text-align: center; padding: 40px;">No attempts yet!</p>';
            return;
        }
        
        const ranges = {
            'Excellent (85-100%)': { count: 0, color: '#28a745' },
            'Good (70-84%)': { count: 0, color: '#17a2b8' },
            'Fair (50-69%)': { count: 0, color: '#ffc107' },
            'Needs Improvement (0-49%)': { count: 0, color: '#dc3545' }
        };
        
        allAttempts.forEach(score => {
            if (score >= 85) ranges['Excellent (85-100%)'].count++;
            else if (score >= 70) ranges['Good (70-84%)'].count++;
            else if (score >= 50) ranges['Fair (50-69%)'].count++;
            else ranges['Needs Improvement (0-49%)'].count++;
        });
        
        let html = '<div style="padding: 20px;"><h3>Score Distribution</h3>';
        html += '<div style="display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 40px;">';
        html += '<svg width="300" height="300" viewBox="0 0 300 300">';
        
        let currentAngle = 0;
        const total = allAttempts.length;
        
        Object.entries(ranges).forEach(([label, data]) => {
            if (data.count === 0) return;
            
            const percentage = data.count / total;
            const angle = percentage * 360;
            const endAngle = currentAngle + angle;
            
            const startX = 150 + 120 * Math.cos((currentAngle - 90) * Math.PI / 180);
            const startY = 150 + 120 * Math.sin((currentAngle - 90) * Math.PI / 180);
            const endX = 150 + 120 * Math.cos((endAngle - 90) * Math.PI / 180);
            const endY = 150 + 120 * Math.sin((endAngle - 90) * Math.PI / 180);
            
            const largeArc = angle > 180 ? 1 : 0;
            
            html += `
                <path d="M 150 150 L ${startX} ${startY} A 120 120 0 ${largeArc} 1 ${endX} ${endY} Z" 
                    fill="${data.color}" 
                    stroke="white" 
                    stroke-width="2"/>
            `;
            
            currentAngle = endAngle;
        });
        
        html += '</svg>';
        html += '<div>';
        
        Object.entries(ranges).forEach(([label, data]) => {
            const percentage = ((data.count / allAttempts.length) * 100).toFixed(1);
            html += `
                <div style="margin: 10px 0; display: flex; align-items: center;">
                    <div style="width: 20px; height: 20px; background: ${data.color}; margin-right: 10px; border-radius: 4px;"></div>
                    <span><strong>${label}:</strong> ${data.count} (${percentage}%)</span>
                </div>
            `;
        });
        
        html += '</div></div></div>';
        container.innerHTML = html;
    }

    updateAnalytics() {
        const content = document.getElementById('analyticsContent');
        let html = '<div class="stats-grid">';

        let totalAttempts = 0;
        let totalQuestions = 0;
        let totalCorrect = 0;

        Object.values(this.testBanks).forEach(bank => {
            totalAttempts += bank.attempts.length;
            bank.attempts.forEach(att => {
                totalQuestions += att.total;
                totalCorrect += att.score;
            });
        });

        const overallPercentage = totalQuestions > 0 ? 
            ((totalCorrect / totalQuestions) * 100).toFixed(1) : 0;

        html += `
            <div class="stat-card">
                <h3>${Object.keys(this.testBanks).length}</h3>
                <p>Test Banks</p>
            </div>
            <div class="stat-card">
                <h3>${totalAttempts}</h3>
                <p>Total Attempts</p>
            </div>
            <div class="stat-card">
                <h3>${overallPercentage}%</h3>
                <p>Overall Score</p>
            </div>
        `;
        html += '</div>';

        html += '<h3 style="margin-top: 40px;">Performance by Test Bank</h3>';

        Object.values(this.testBanks).forEach(bank => {
            if (bank.attempts.length > 0) {
                const avgScore = bank.attempts.reduce((sum, att) => sum + parseFloat(att.percentage), 0) / bank.attempts.length;
                const bestScore = Math.max(...bank.attempts.map(att => parseFloat(att.percentage)));
                const worstScore = Math.min(...bank.attempts.map(att => parseFloat(att.percentage)));
                const lastAttempt = bank.attempts[bank.attempts.length - 1];
                html += `
                    <div class="analytics-detail">
                        <h4 style="margin-bottom: 15px;">${bank.title}</h4>
                        <div class="analytics-row">
                            <span>Attempts:</span>
                            <strong>${bank.attempts.length}</strong>
                        </div>
                        <div class="analytics-row">
                            <span>Average Score:</span>
                            <strong style="color: #667eea;">${avgScore.toFixed(1)}%</strong>
                        </div>
                        <div class="analytics-row">
                            <span>Best Score:</span>
                            <strong style="color: #28a745;">${bestScore}%</strong>
                        </div>
                        <div class="analytics-row">
                            <span>Worst Score:</span>
                            <strong style="color: #dc3545;">${worstScore}%</strong>
                        </div>
                        <div class="analytics-row">
                            <span>Last Attempt:</span>
                            <strong>${new Date(lastAttempt.date).toLocaleDateString()} - ${lastAttempt.percentage}% (${lastAttempt.questionCount || lastAttempt.total}/${bank.questions.length} questions)</strong>
                        </div>
                    </div>
                `;
            }
        });

        if (totalAttempts === 0) {
            html = '<p style="text-align: center; padding: 40px; color: #6c757d;">No quiz attempts yet. Take a quiz to see your performance!</p>';
        }

        content.innerHTML = html;
    }

    // ============================================
    // TAB NAVIGATION
    // ============================================

    switchTab(tab) {
        // Check if exam is locked
        if (this.examLocked && tab !== 'take') {
            // Show prominent warning
            const warningDiv = document.createElement('div');
            warningDiv.className = 'feedback-overlay';
            warningDiv.innerHTML = `
                <div class="feedback-content" style="background: white; max-width: 400px;">
                    <div style="font-size: 4em; margin-bottom: 20px;">⚠️</div>
                    <h2 style="color: #dc3545; margin-bottom: 15px;">Board Exam Ongoing!</h2>
                    <p style="color: #495057; margin-bottom: 25px;">Please stay focused on your exam. You cannot switch tabs until you complete or exit the exam.</p>
                    <button class="btn btn-primary" onclick="this.closest('.feedback-overlay').remove()">
                        OK, Continue Exam
                    </button>
                </div>
            `;
            document.body.appendChild(warningDiv);
            return;
        }

        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        // Find the button that was clicked and activate it
        document.querySelector(`.nav-tab[onclick*="${tab}"]`).classList.add('active');
        document.getElementById(tab).classList.add('active');

        if (tab === 'analytics') {
            this.updateAnalytics();
        } else if (tab === 'take') {
            this.updateSelectOptions();
        } else if (tab === 'game') {
            this.updateGameSelectOptions();
            this.updateGameAnalytics();
        } else if (tab === 'study') {
            this.updateSelectOptions();
        }
    }

    highlightActiveTab() {
        // Find the "Boards Mode" tab and add visual indicator
        const takeTab = document.querySelector('.nav-tab[onclick*="take"]');
        if (takeTab) {
            takeTab.style.animation = 'pulse 2s infinite';
            takeTab.style.boxShadow = '0 0 20px rgba(220, 53, 69, 0.6)';
        }
    }

    removeTabHighlight() {
        // Remove visual indicator
        const takeTab = document.querySelector('.nav-tab[onclick*="take"]');
        if (takeTab) {
            takeTab.style.animation = '';
            takeTab.style.boxShadow = '';
        }
    }

    // ============================================
    // STUDY MODE
    // ============================================

    loadStudyMode() {
        const selected = document.getElementById('studySelectBank').value;
        const container = document.getElementById('studyContainer');
        
        if (selected) {
            this.currentStudyBank = this.testBanks[selected];
            this.studyCards = [...this.currentStudyBank.questions];
            this.currentStudyIndex = 0;
            this.isFlipped = false;
            
            container.style.display = 'block';
            this.renderFlashcard();
        } else {
            container.style.display = 'none';
        }
    }

    renderFlashcard() {
        const card = this.studyCards[this.currentStudyIndex];
        const container = document.getElementById('flashcardContainer');
        
        // Get correct answer text
        const correctIndex = card.correct.charCodeAt(0) - 65;
        const correctAnswer = card.options[correctIndex];
        
        container.innerHTML = `
            <div class="flashcard ${this.isFlipped ? 'flipped' : ''}" id="flashcard" onclick="app.flipCard()">
                <div class="flashcard-face flashcard-front">
                    <div>
                        <div style="font-size: 0.8em; opacity: 0.8; margin-bottom: 20px;">QUESTION</div>
                        <div>${card.question}</div>
                    </div>
                </div>
                <div class="flashcard-face flashcard-back">
                    <div>
                        <div style="font-size: 0.8em; opacity: 0.8; margin-bottom: 20px;">ANSWER</div>
                        <div style="font-size: 1.4em; font-weight: bold; margin-bottom: 15px;">${card.correct}</div>
                        <div>${correctAnswer}</div>
                    </div>
                </div>
            </div>
        `;
        
        this.updateCardCounter();
        this.updateNavigationButtons();
    }

    flipCard() {
        const flashcard = document.getElementById('flashcard');
        flashcard.classList.toggle('flipped');
        this.isFlipped = !this.isFlipped;
    }

    nextCard() {
        if (this.currentStudyIndex < this.studyCards.length - 1) {
            this.currentStudyIndex++;
            this.isFlipped = false;
            this.renderFlashcard();
        }
    }

    previousCard() {
        if (this.currentStudyIndex > 0) {
            this.currentStudyIndex--;
            this.isFlipped = false;
            this.renderFlashcard();
        }
    }

    shuffleStudyCards() {
        this.studyCards = this.shuffleArray([...this.currentStudyBank.questions]);
        this.currentStudyIndex = 0;
        this.isFlipped = false;
        this.renderFlashcard();
        this.showToast('Cards shuffled!', 'info');
    }

    exitStudyMode() {
        document.getElementById('studySelectBank').value = '';
        document.getElementById('studyContainer').style.display = 'none';
    }

    updateCardCounter() {
        const counter = document.getElementById('cardCounter');
        if (counter && this.studyCards) {
            counter.textContent = `Card ${this.currentStudyIndex + 1} of ${this.studyCards.length}`;
        }
    }

    updateNavigationButtons() {
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        
        if (prevBtn) prevBtn.disabled = this.currentStudyIndex === 0;
        if (nextBtn) nextBtn.disabled = this.currentStudyIndex === (this.studyCards ? this.studyCards.length - 1 : 0);
        
        if (prevBtn) prevBtn.style.opacity = prevBtn.disabled ? '0.5' : '1';
        if (nextBtn) nextBtn.style.opacity = nextBtn.disabled ? '0.5' : '1';
    }


    // ============================================
    // QUIZ GAME MODE
    // ============================================

    updateGameSelectOptions() {
        // The main updateSelectOptions already handles all three selectors
        this.updateSelectOptions(); 
    }

    loadGameSettings() {
        const selected = document.getElementById('gameSelectBank').value;
        const settings = document.getElementById('gameSettings');
        
        if (selected) {
            settings.style.display = 'block';
        } else {
            settings.style.display = 'none';
        }
    }

    toggleTimeSelector() {
        const checkbox = document.getElementById('gameTimerEnabled');
        const selector = document.getElementById('timePerQuestionSelector');
        selector.style.display = checkbox.checked ? 'block' : 'none';
    }

    startGame() {
        const selected = document.getElementById('gameSelectBank').value;
        if (!selected) return;

        const bank = this.testBanks[selected];
        const questionCountSelect = document.getElementById('gameQuestionCount').value;
        
        let questions = this.shuffleArray([...bank.questions]);
        if (questionCountSelect !== 'all') {
            questions = questions.slice(0, parseInt(questionCountSelect));
        }

        this.currentGameBank = bank;
        this.currentGameBankKey = selected;
        this.currentGameQuestions = questions;
        
        this.gameState = {
            currentIndex: 0,
            score: 0,
            streak: 0,
            maxStreak: 0,
            correctAnswers: 0,
            wrongAnswers: 0,
            timePerQuestion: parseInt(document.getElementById('gameTimePerQuestion').value) * 1000,
            totalQuestions: questions.length,
            pointsPerQuestion: Math.round(100 / questions.length) || 10,
            questionStartTime: Date.now(),
            timerInterval: null,
            isActive: true,
            answers: [],
            startTime: Date.now()
        };

        document.getElementById('gameSettings').style.display = 'none';
        document.getElementById('gameContainer').style.display = 'block';
        document.getElementById('gameAnalytics').style.display = 'none'; // Hide stats during game

        if (document.getElementById('gameTimerEnabled').checked) {
            this.startGameTimer();
        }

        this.showGameQuestion();
    }

    startGameTimer() {
        const timer = document.getElementById('gameTimer');
        if (timer) timer.remove(); // Remove old timer if it exists

        const timerDiv = document.createElement('div');
        timerDiv.id = 'gameTimer';
        timerDiv.className = 'timer';
        timerDiv.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        timerDiv.style.color = 'white';
        document.body.appendChild(timerDiv);

        this.gameState.timerInterval = setInterval(() => {
            if (!this.gameState.isActive) {
                clearInterval(this.gameState.timerInterval);
                const timer = document.getElementById('gameTimer');
                if (timer) timer.remove();
                return;
            }

            const elapsed = Date.now() - this.gameState.questionStartTime;
            const remaining = this.gameState.timePerQuestion - elapsed;

            if (remaining <= 0) {
                this.submitGameAnswer(null, true); // Auto-submit as wrong
                return;
            }

            const secs = Math.ceil(remaining / 1000);
            timerDiv.textContent = `⏱️ ${secs}s`;

            if (remaining < 5000) {
                timerDiv.classList.add('warning');
            } else {
                timerDiv.classList.remove('warning');
            }
        }, 100);
    }

    showGameQuestion() {
        const container = document.getElementById('gameContainer');
        const q = this.currentGameQuestions[this.gameState.currentIndex];
        const progress = ((this.gameState.currentIndex + 1) / this.currentGameQuestions.length) * 100;

        container.innerHTML = `
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 12px; color: white; margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <div>
                        <h3 style="margin: 0; font-size: 1.5em;">🎮 Score: ${this.gameState.score}</h3>
                        <p style="margin: 5px 0 0 0; opacity: 0.9;">🔥 Streak: ${this.gameState.streak} | Best: ${this.gameState.maxStreak}</p>
                    </div>
                    <div style="text-align: right;">
                        <p style="margin: 0; font-size: 1.2em;">Question ${this.gameState.currentIndex + 1}/${this.currentGameQuestions.length}</p>
                        <p style="margin: 5px 0 0 0; opacity: 0.9;">✅ ${this.gameState.correctAnswers} | ❌ ${this.gameState.wrongAnswers}</p>
                    </div>
                </div>
            </div>

            <div class="progress-bar">
                <div class="progress-fill" style="width: ${progress}%"></div>
            </div>

            <div style="text-align: right; margin-bottom: 10px;">
                <button class="btn btn-danger" onclick="app.exitGame()" style="min-width: auto; padding: 8px 16px;">❌ Exit Game</button>
            </div>

            <div class="quiz-question">
                <h3 style="font-size: 1.3em; margin-bottom: 20px;">${q.question}</h3>
                <div class="quiz-options">
                    ${q.options.map((opt, i) => `
                        <div class="quiz-option" onclick="app.selectGameAnswer('${String.fromCharCode(65 + i)}', this)">
                            <input type="radio" name="gameAnswer" value="${String.fromCharCode(65 + i)}" id="gameOpt${i}">
                            <label for="gameOpt${i}">${String.fromCharCode(65 + i)}. ${opt}</label>
                        </div>
                    `).join('')}
                </div>
                <button class="btn btn-primary" onclick="app.submitGameAnswerManual()" style="margin-top: 20px; width: 100%;">
                    ✓ Submit Answer
                </button>
            </div>
        `;
    }

    selectGameAnswer(answer, element) {
        document.querySelectorAll('.quiz-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        element.classList.add('selected');
        document.querySelector(`input[value="${answer}"]`).checked = true;
    }

    submitGameAnswerManual() {
        const selected = document.querySelector('input[name="gameAnswer"]:checked');
        if (!selected) {
            this.showToast('Please select an answer first!', 'warning');
            return;
        }
        this.submitGameAnswer(selected.value, false);
    }

    submitGameAnswer(answer, timeExpired) {
        if (!this.gameState.isActive) return;

        // Clear timer interval immediately
        if (this.gameState.timerInterval) {
             clearInterval(this.gameState.timerInterval);
        }

        const q = this.currentGameQuestions[this.gameState.currentIndex];
        const isCorrect = answer === q.correct;
        const timeTaken = Date.now() - this.gameState.questionStartTime;
        
        if (isCorrect) {
            this.gameState.correctAnswers++;
            this.gameState.streak++;
            this.gameState.maxStreak = Math.max(this.gameState.streak, this.gameState.maxStreak);
            
            // Score with small bonus for speed (1-point per 5 seconds left on a 15s question)
            let points = this.gameState.pointsPerQuestion;
            const timeRemainingSecs = Math.max(0, Math.round((this.gameState.timePerQuestion - timeTaken) / 1000));
            const bonus = Math.floor(timeRemainingSecs / 5);
            points += bonus;
            
            this.gameState.score += points;
            
            this.showGameFeedback(true, points);
        } else {
            this.gameState.wrongAnswers++;
            this.gameState.streak = 0;
            this.showGameFeedback(false, 0);
        }

        this.gameState.answers.push({
            questionId: q.id,
            selected: answer,
            correct: q.correct,
            isCorrect: isCorrect,
            timeTaken: timeTaken,
            timeExpired: timeExpired
        });
    }

    showGameFeedback(isCorrect, points) {
        const options = document.querySelectorAll('.quiz-option');
        const correct = this.currentGameQuestions[this.gameState.currentIndex].correct;
        const submitButton = document.querySelector('#gameContainer .btn-primary');
        if (submitButton) submitButton.disabled = true;

        options.forEach((opt, i) => {
            const letter = String.fromCharCode(65 + i);
            if (letter === correct) {
                opt.classList.add('correct');
            } else if (opt.querySelector('input').checked && !isCorrect) {
                opt.classList.add('incorrect');
            }
            opt.style.pointerEvents = 'none';
        });

        // Show floating points
        if (isCorrect && points > 0) {
            const floatingPoints = document.createElement('div');
            floatingPoints.textContent = `+${points}`;
            floatingPoints.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-size: 4em;
                font-weight: bold;
                color: #28a745;
                z-index: 10000;
                animation: floatUp 1.2s ease-out;
                pointer-events: none;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
                background: rgba(255, 255, 255, 0.9);
                padding: 20px 40px;
                border-radius: 15px;
                border: 3px solid #28a745;
            `;
            document.body.appendChild(floatingPoints);
            setTimeout(() => floatingPoints.remove(), 1200);
        }

        setTimeout(() => {
            this.nextGameQuestion();
        }, 1500);
    }

    nextGameQuestion() {
        this.gameState.currentIndex++;
        
        if (this.gameState.currentIndex < this.currentGameQuestions.length) {
            this.gameState.questionStartTime = Date.now();
            if (document.getElementById('gameTimerEnabled').checked) {
                this.startGameTimer(); // Restart the individual question timer
            }
            this.showGameQuestion();
        } else {
            this.endGame();
        }
    }

    endGame() {
        this.gameState.isActive = false;
        
        if (this.gameState.timerInterval) {
            clearInterval(this.gameState.timerInterval);
            const timer = document.getElementById('gameTimer');
            if (timer) timer.remove();
        }

        const totalTime = Date.now() - this.gameState.startTime;
        const totalQuestions = this.currentGameQuestions.length;
        const accuracy = ((this.gameState.correctAnswers / totalQuestions) * 100).toFixed(1);

        // Save game stats
        if (!this.currentGameBank.gameAttempts) {
            this.currentGameBank.gameAttempts = [];
        }

        this.currentGameBank.gameAttempts.push({
            date: new Date().toISOString(),
            score: this.gameState.score,
            correct: this.gameState.correctAnswers,
            wrong: this.gameState.wrongAnswers,
            total: totalQuestions,
            accuracy: accuracy,
            maxStreak: this.gameState.maxStreak,
            duration: totalTime,
            answers: this.gameState.answers
        });

        this.saveData();

        let rank = '';
        if (accuracy >= 90) rank = '🏆 MASTER';
        else if (accuracy >= 80) rank = '🥇 EXPERT';
        else if (accuracy >= 70) rank = '🥈 PROFICIENT';
        else if (accuracy >= 60) rank = '🥉 COMPETENT';
        else rank = '📚 LEARNER';

        const container = document.getElementById('gameContainer');
        container.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <div style="font-size: 4em; margin-bottom: 10px;">🎮</div>
                <h2 style="font-size: 2em; margin-bottom: 5px;">Game Over!</h2>
                <div style="font-size: 1.2em; color: #667eea; margin-bottom: 20px;">${rank}</div>
                
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; max-width: 500px; margin: 0 auto 20px auto;">
                    <div class="stat-card" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                        <div style="font-size: 1.8em; font-weight: bold;">${this.gameState.score}</div>
                        <div style="font-size: 0.85em; opacity: 0.9;">Score</div>
                    </div>
                    <div class="stat-card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
                        <div style="font-size: 1.8em; font-weight: bold;">${accuracy}%</div>
                        <div style="font-size: 0.85em; opacity: 0.9;">Accuracy</div>
                    </div>
                    <div class="stat-card" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">
                        <div style="font-size: 1.8em; font-weight: bold;">${this.gameState.maxStreak}</div>
                        <div style="font-size: 0.85em; opacity: 0.9;">Max Streak</div>
                    </div>
                </div>

                <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; margin: 15px auto; text-align: left; max-width: 500px;">
                    <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #dee2e6;">
                        <span style="color: #495057;">✅ Correct:</span>
                        <strong style="color: #495057;">${this.gameState.correctAnswers}/${totalQuestions}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #dee2e6;">
                        <span style="color: #495057;">❌ Wrong:</span>
                        <strong style="color: #495057;">${this.gameState.wrongAnswers}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                        <span style="color: #495057;">⏱️ Time:</span>
                        <strong style="color: #495057;">${Math.floor(totalTime / 60000)}m ${Math.floor((totalTime % 60000) / 1000)}s</strong>
                    </div>
                </div>

                <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                    <button class="btn btn-primary" onclick="app.playAgain()">🔄 Play Again</button>
                    <button class="btn btn-secondary" onclick="app.exitGame()">🏠 Back to Menu</button>
                </div>
            </div>
        `;

        document.getElementById('gameAnalytics').style.display = 'block'; // Show stats again
        this.updateGameAnalytics();
    }

    playAgain() {
        document.getElementById('gameSelectBank').value = this.currentGameBankKey;
        this.loadGameSettings();
        document.getElementById('gameContainer').style.display = 'none';
        this.startGame();
    }

    exitGame() {
        if (this.gameState.isActive) {
            if (!confirm('Are you sure you want to exit? Your current game progress will be lost.')) {
                return;
            }
        }
        
        this.gameState.isActive = false;
        if (this.gameState.timerInterval) {
            clearInterval(this.gameState.timerInterval);
        }
        const timer = document.getElementById('gameTimer');
        if (timer) timer.remove();
        
        document.getElementById('gameContainer').style.display = 'none';
        document.getElementById('gameSettings').style.display = 'none';
        document.getElementById('gameSelectBank').value = '';
        document.getElementById('gameAnalytics').style.display = 'block'; // Show stats again
    }

    updateGameAnalytics() {
        const content = document.getElementById('gameStatsContent');
        let html = '';

        let totalGames = 0;
        let totalScore = 0;
        let bestScore = 0;
        let bestStreak = 0;

        Object.values(this.testBanks).forEach(bank => {
            if (bank.gameAttempts && bank.gameAttempts.length > 0) {
                totalGames += bank.gameAttempts.length;
                bank.gameAttempts.forEach(attempt => {
                    totalScore += attempt.score;
                    bestScore = Math.max(bestScore, attempt.score);
                    bestStreak = Math.max(bestStreak, attempt.maxStreak);
                });
            }
        });

        const avgScore = totalGames > 0 ? Math.round(totalScore / totalGames) : 0;

        if (totalGames === 0) {
            content.innerHTML = '<p style="text-align: center; padding: 40px; color: #6c757d;">No games played yet. Start a game to see your stats!</p>';
            return;
        }

        html += '<div class="stats-grid">';
        html += `
            <div class="stat-card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
                <h3>${totalGames}</h3>
                <p>Games Played</p>
            </div>
            <div class="stat-card" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">
                <h3>${avgScore}</h3>
                <p>Avg Score</p>
            </div>
            <div class="stat-card" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);">
                <h3>${bestScore}</h3>
                <p>Best Score</p>
            </div>
            <div class="stat-card" style="background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);">
                <h3>${bestStreak}</h3>
                <p>Best Streak</p> 
            </div> `; 
        html += '</div>';
        html += '<h4 style="margin-top: 40px;">Performance by Test Bank</h4>';

        Object.values(this.testBanks).forEach(bank => {
            if (bank.gameAttempts && bank.gameAttempts.length > 0) {
                const totalAttemptsCount = bank.gameAttempts.length;
                const avgAccuracy = (
                    bank.gameAttempts.reduce((sum, att) => sum + parseFloat(att.accuracy), 0) / totalAttemptsCount
                ).toFixed(1);
                const bestBankScore = Math.max(...bank.gameAttempts.map(att => att.score));

                html += `
                    <div class="analytics-detail" style="padding: 15px;">
                        <h4 style="margin-bottom: 10px;">${bank.title}</h4>
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                            <div style="text-align: center; padding: 10px; background: rgba(102, 126, 234, 0.1); border-radius: 8px;">
                                <div style="font-size: 1.5em; font-weight: bold; color: #667eea;">${bestBankScore}</div>
                                <div style="font-size: 0.85em; color: #6c757d;">Best Score</div>
                            </div>
                            <div style="text-align: center; padding: 10px; background: rgba(23, 162, 184, 0.1); border-radius: 8px;">
                                <div style="font-size: 1.5em; font-weight: bold; color: #17a2b8;">${avgAccuracy}%</div>
                                <div style="font-size: 0.85em; color: #6c757d;">Avg Accuracy</div>
                            </div>
                            <div style="text-align: center; padding: 10px; background: rgba(108, 117, 125, 0.1); border-radius: 8px;">
                                <div style="font-size: 1.5em; font-weight: bold; color: #6c757d;">${totalAttemptsCount}</div>
                                <div style="font-size: 0.85em; color: #6c757d;">Games</div>
                            </div>
                        </div>
                    </div>
                `;
            }
        });

        content.innerHTML = html;
    }

    clearGameStats() {
        if (!confirm('Are you sure you want to delete ALL game statistics? This cannot be undone!')) {
            return;
        }

        Object.values(this.testBanks).forEach(bank => {
            if (bank.gameAttempts) {
                bank.gameAttempts = [];
            }
        });

        this.saveData();
        this.updateGameAnalytics();
        this.showToast('✅ Game statistics cleared!', 'success');
    }

    clearBoardStats() {
        if (!confirm('Are you sure you want to delete ALL Board Exam statistics? This cannot be undone!')) {
            return;
        }

        Object.values(this.testBanks).forEach(bank => {
            if (bank.attempts) {
                bank.attempts = [];
            }
        });

        this.saveData();
        this.updateAnalytics();
        this.showToast('✅ Board Exam statistics cleared!', 'success');
    }

    // ============================================
    // GEMINI AI INTEGRATION
    // ============================================

    showGeminiModal() {
        document.getElementById('geminiModal').classList.add('active');
        document.getElementById('geminiResult').style.display = 'none';
        document.getElementById('geminiOutput').value = '';
    }

    closeGeminiModal() {
        document.getElementById('geminiModal').classList.remove('active');
    }
    
    async generateWithGemini() {
        const topic = document.getElementById('geminiTopic').value.trim();
        const count = document.getElementById('geminiCount').value;
        const difficulty = document.getElementById('geminiDifficulty').value;
        
        if (!topic) {
            this.showToast('Please enter a topic', 'warning');
            return;
        }
        
        const proxyUrl = '/api/generate-questions';
        
        this.showLoading('AI is generating questions...');
        
        try {
            // --- The corrected fetch call starts here ---
            // We send the parameters (NOT the API key) to the proxy.
            const response = await fetch(proxyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    topic: topic,
                    count: count,
                    difficulty: difficulty
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.details || `Server/Proxy Error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            
            this.hideLoading();

            if (data.candidates && data.candidates[0]) {
                const generatedText = data.candidates[0].content.parts[0].text;
                document.getElementById('geminiOutput').value = generatedText;
                document.getElementById('geminiResult').style.display = 'block';
                this.showToast('✨ Questions generated successfully!', 'success');
            } else if (data.error) {
                throw new Error(data.error.message);
            } else {
                throw new Error('Failed to generate questions. Unknown API response.');
            }
        } catch (error) {
            this.hideLoading();
            console.error('AI Generation error:', error);
            this.showToast(`Failed to generate questions: ${error.message || 'Check your Netlify function setup.'}`, 'error');
        }
    }

    useGeminiQuestions() {
        const generatedText = document.getElementById('geminiOutput').value;
        document.getElementById('questionsInput').value = generatedText;
        this.closeGeminiModal();
        this.showToast('Questions added to input box!', 'success');
        
        // Show questions input if hidden
        const bankTitle = document.getElementById('bankTitle').value.trim();
        if (bankTitle) {
            document.getElementById('questionsInputGroup').style.display = 'block';
        }

        // Switch to manage tab
        this.switchTab('manage');
        // Manually re-activate the tab visual elements since switchTab only handles buttons
        document.querySelector('.nav-tab[onclick*="manage"]').classList.add('active');
        document.getElementById('manage').classList.add('active');
    }
}
// Initialize the app
const app = new QuizMasterApp();
