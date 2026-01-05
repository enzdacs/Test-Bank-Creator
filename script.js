class QuizMasterApp {
    constructor() {
        this.testBanks = {};
        this.currentBank = null;
        this.currentQuestions = [];
        this.currentEditingBank = null;
        this.notes = {};
        this.currentEditingNote = null;
        this.isFullscreen = false;
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
        this.init();
    }

    init() {
        this.loadData();
        this.loadNotes();
        this.loadDarkMode();
        this.setupEventListeners();
        this.updateTestBankList();
        this.updateSelectOptions();
        this.updateAnalytics();
    }

    // ============================================
    // NOTES MODE FUNCTIONS
    // ============================================

    loadNotes() {
        const saved = localStorage.getItem('quizMasterNotes');
        if (saved) {
            try {
                this.notes = JSON.parse(saved);
            } catch (error) {
                console.error('Failed to load notes:', error);
            }
        }
        this.updateNotesList();
    }

    saveNotes() {
        try {
            localStorage.setItem('quizMasterNotes', JSON.stringify(this.notes));
            return true;
        } catch (error) {
            this.showToast('Failed to save notes', 'error');
            return false;
        }
    }

    updateNotesList() {
        const list = document.getElementById('notesList');
        if (!list) return;

        list.innerHTML = '';

        Object.keys(this.notes).forEach(key => {
            const note = this.notes[key];
            const card = document.createElement('div');
            card.className = 'test-bank-card note-card';
            
            const preview = note.content.replace(/<[^>]*>/g, '').substring(0, 100);
            const wordCount = note.content.split(/\s+/).filter(w => w.length > 0).length;
            
            const isPDF = note.isPDF === true;
            const icon = isPDF ? '📄' : '📝';

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
                    <div style="flex: 1;">
                        <h3 style="margin-bottom: 8px;">${icon} ${this.escapeHtml(note.title)}</h3>
                        ${!isPDF ? `
                            <p style="margin: 5px 0; font-size: 0.9em; color: #6c757d; font-style: italic;">
                                ${preview}${preview.length >= 100 ? '...' : ''}
                            </p>
                            <p style="margin: 8px 0 3px 0; font-size: 0.85em;">📊 ${wordCount} words</p>
                        ` : '<p style="margin: 5px 0; font-size: 0.9em; color: #6c757d;">PDF Document</p>'}
                        <p style="margin: 3px 0; font-size: 0.85em;">🕐 ${new Date(note.lastModified).toLocaleDateString()}</p>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; flex-shrink: 0;">
                        ${isPDF ? `
                            <button onclick="app.viewPDFNote('${key.replace(/'/g, "\\'")}'); event.stopPropagation();" 
                                title="View PDF" 
                                style="background: #28a745; border: none; color: white; width: 36px; height: 36px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.3s; font-size: 1.1em;">
                                👁️
                            </button>
                        ` : `
                            <button onclick="app.editNote('${key.replace(/'/g, "\\'")}'); event.stopPropagation();" 
                                title="Edit" 
                                style="background: #17a2b8; border: none; color: white; width: 36px; height: 36px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.3s; font-size: 1.1em;">
                                ✏️
                            </button>
                        `}
                        <button onclick="app.deleteNote('${key.replace(/'/g, "\\'")}'); event.stopPropagation();" 
                            title="Delete" 
                            style="background: #dc3545; border: none; color: white; width: 36px; height: 36px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.3s; font-size: 1.1em;">
                            🗑️
                        </button>
                    </div>
                </div>
            `;

            // Modify click behavior
            card.onclick = (e) => {
                if (e.target.tagName !== 'BUTTON') {
                    if (isPDF) {
                        this.viewPDFNote(key);
                    } else {
                        this.editNote(key);
                    }
                }
            };

            list.appendChild(card);
        });

        if (Object.keys(this.notes).length === 0) {
            list.innerHTML = '<p style="text-align: center; padding: 40px; color: #6c757d;">No notes yet. Create your first note above! 📓</p>';
        }
    }

    createNewNote() {
        // Check if "Untitled Note" already exists
        const untitledExists = Object.values(this.notes).some(note => 
            note.title === 'Untitled Note' && note.content === ''
        );
        
        if (untitledExists) {
            this.showToast('⚠️ An empty "Untitled Note" already exists. Please edit or delete it first.', 'warning');
            return;
        }
        
        const noteId = `note_${Date.now()}`;
        this.currentEditingNote = noteId;
        
        // Don't save to this.notes yet, just store temporarily
        this.tempNote = {
            id: noteId,
            title: 'Untitled Note',
            content: '',
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString()
        };
        this.noteHasChanges = false; // Track if user made changes

        document.getElementById('noteTitle').value = 'Untitled Note';
        document.getElementById('noteContent').innerHTML = '';
        document.getElementById('noteEditor').style.display = 'block';
        document.getElementById('notesList').style.display = 'none';

        document.getElementById('noteEditor').scrollIntoView({ behavior: 'smooth', block: 'start' });
        
        setTimeout(() => {
            document.getElementById('noteTitle').focus();
            document.getElementById('noteTitle').select();
        }, 300);
    }

    editNote(noteId) {
        this.currentEditingNote = noteId;
        this.noteHasChanges = false; // Reset change tracking
        this.tempNote = null; // Clear temp note
        const note = this.notes[noteId];

        document.getElementById('noteTitle').value = note.title;
        document.getElementById('noteContent').innerHTML = note.content;
        document.getElementById('noteEditor').style.display = 'block';
        document.getElementById('notesList').style.display = 'none';

        document.getElementById('noteEditor').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    saveNote() {
        const title = document.getElementById('noteTitle').value.trim() || 'Untitled Note';
        const content = document.getElementById('noteContent').innerHTML.trim();

        // For new notes
        if (this.tempNote) {
            this.notes[this.tempNote.id] = {
                title: title,
                content: content,
                createdAt: this.tempNote.createdAt,
                lastModified: new Date().toISOString()
            };
            this.currentEditingNote = this.tempNote.id;
            this.tempNote = null;
        } 
        // For existing notes
        else if (this.currentEditingNote) {
            this.notes[this.currentEditingNote].title = title;
            this.notes[this.currentEditingNote].content = content;
            this.notes[this.currentEditingNote].lastModified = new Date().toISOString();
        }

        this.saveNotes();
        this.noteHasChanges = false;
        this.showToast('✅ Note saved successfully!', 'success');
    }

    closeNoteEditor() {
        // Check if there are unsaved changes
        const title = document.getElementById('noteTitle').value.trim();
        const content = document.getElementById('noteContent').innerHTML.trim();
        
        if (this.noteHasChanges || this.tempNote) {
            if (!confirm('Close without saving? Your work will be lost.')) {
                return; // Don't close
            }
            // User confirmed, discard changes
            this.tempNote = null;
        }

        document.getElementById('noteEditor').style.display = 'none';
        document.getElementById('notesList').style.display = 'grid';
        this.currentEditingNote = null;
        this.tempNote = null;
        this.noteHasChanges = false;
        this.updateNotesList();

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async deleteNote(noteId) {
        if (confirm('Are you sure you want to delete this note?')) {
            delete this.notes[noteId];
            this.saveNotes();
            this.updateNotesList();
            this.showToast('Note deleted', 'info');
        }
    }

    // Text Formatting Functions
    formatText(command) {
        document.execCommand(command, false, null);
        document.getElementById('noteContent').focus();
    }

    changeFontSize(size) {
        document.execCommand('fontSize', false, size);
        document.getElementById('noteContent').focus();
    }

    changeFontFamily(font) {
        if (font) {
            document.execCommand('fontName', false, font);
            document.getElementById('noteContent').focus();
        }
    }

    changeFontSizeExact(size) {
        if (size) {
            const selection = window.getSelection();
            if (selection.rangeCount > 0 && !selection.isCollapsed) {
                // There is selected text
                const range = selection.getRangeAt(0);
                const span = document.createElement('span');
                span.style.fontSize = size;
                try {
                    range.surroundContents(span);
                } catch (e) {
                    // If surroundContents fails, use alternative method
                    const fragment = range.extractContents();
                    span.appendChild(fragment);
                    range.insertNode(span);
                }
            } else {
                // No selection - apply to future text
                document.execCommand('fontSize', false, '7');
                const fontElements = document.querySelectorAll('#noteContent font[size="7"]');
                fontElements.forEach(el => {
                    el.removeAttribute('size');
                    el.style.fontSize = size;
                });
            }
            document.getElementById('noteContent').focus();
            this.noteHasChanges = true;
        }
    }

    changeTextColor(color) {
        document.execCommand('foreColor', false, color);
        document.getElementById('noteContent').focus();
    }

    clearFormatting() {
        document.execCommand('removeFormat', false, null);
        document.getElementById('noteContent').focus();
    }

    insertImage() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = document.createElement('img');
                img.src = event.target.result;
                img.style.maxWidth = '100%';
                img.style.height = 'auto';
                img.style.borderRadius = '8px';
                img.style.margin = '10px 0';
                
                const selection = window.getSelection();
                if (selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    range.insertNode(img);
                } else {
                    document.getElementById('noteContent').appendChild(img);
                }
            };
            reader.readAsDataURL(file);
        };
        
        input.click();
    }

    indent() {
    document.execCommand('indent', false, null);
    document.getElementById('noteContent').focus();
    }

    outdent() {
        document.execCommand('outdent', false, null);
        document.getElementById('noteContent').focus();
    }

    handleNoteKeydown(event) {
        // Tab key for indent
        if (event.key === 'Tab' && !event.shiftKey) {
            event.preventDefault();
            document.execCommand('indent', false, null);
            this.noteHasChanges = true;
        }
        // Shift+Tab for outdent
        else if (event.key === 'Tab' && event.shiftKey) {
            event.preventDefault();
            document.execCommand('outdent', false, null);
            this.noteHasChanges = true;
        }
        // Backspace for outdent when at the start of an indented line
        else if (event.key === 'Backspace') {
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                // Check if cursor is at the start of the line
                if (range.collapsed && range.startOffset === 0) {
                    const parent = range.startContainer.parentElement;
                    // Check if parent is indented (blockquote or has margin/padding)
                    if (parent && (parent.tagName === 'BLOCKQUOTE' || 
                        parent.style.marginLeft || parent.style.paddingLeft)) {
                        event.preventDefault();
                        document.execCommand('outdent', false, null);
                        this.noteHasChanges = true;
                    }
                }
            }
        }
    }

    // Export Note Function
    async exportNote() {
        if (!this.currentEditingNote) return;

        const note = this.notes[this.currentEditingNote];
        const exportFormat = prompt('Export as:\n1. PDF\n2. DOCX\n3. TXT\n4. HTML\n\nEnter number (1-4):', '1');

        this.showLoading('Exporting note...');

        try {
            if (exportFormat === '1') {
                // Export as PDF using jsPDF
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF();
                
                // Title
                doc.setFontSize(18);
                doc.setTextColor(102, 126, 234);
                doc.text(note.title, 20, 20);
                
                // Content (strip HTML for basic export)
                doc.setFontSize(11);
                doc.setTextColor(0, 0, 0);
                const content = note.content.replace(/<[^>]*>/g, '\n');
                const lines = doc.splitTextToSize(content, 170);
                doc.text(lines, 20, 35);
                
                doc.save(`${note.title.replace(/[^a-z0-9]/gi, '_')}.pdf`);
            } else if (exportFormat === '2') {
                // Export as DOCX (HTML-based method)
                const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' 
                                xmlns:w='urn:schemas-microsoft-com:office:word' 
                                xmlns='http://www.w3.org/TR/REC-html40'>
                                <head><meta charset='utf-8'><title>${note.title}</title></head><body>`;
                const footer = "</body></html>";
                const sourceHTML = header + `<h1>${note.title}</h1>` + note.content + footer;
                
                const blob = new Blob(['\ufeff', sourceHTML], {
                    type: 'application/msword'
                });
                
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${note.title.replace(/[^a-z0-9]/gi, '_')}.doc`;
                link.click();
                URL.revokeObjectURL(url);
            } else if (exportFormat === '3') {
                // Export as TXT
                const txtContent = note.content.replace(/<[^>]*>/g, '\n');
                const blob = new Blob([txtContent], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${note.title.replace(/[^a-z0-9]/gi, '_')}.txt`;
                link.click();
                URL.revokeObjectURL(url);
            } else if (exportFormat === '4') {
                // Export as HTML
                const htmlContent = `<!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>${note.title}</title>
        <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; line-height: 1.6; }
            h1 { color: #667eea; }
        </style>
    </head>
    <body>
        <h1>${note.title}</h1>
        ${note.content}
    </body>
    </html>`;
                const blob = new Blob([htmlContent], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${note.title.replace(/[^a-z0-9]/gi, '_')}.html`;
                link.click();
                URL.revokeObjectURL(url);
            } else {
                this.showToast('Invalid export format', 'warning');
            }

            this.hideLoading();
            this.showToast('✅ Note exported successfully!', 'success');
        } catch (error) {
            this.hideLoading();
            console.error('Export error:', error);
            this.showToast('❌ Failed to export note', 'error');
        }
    }

    // Import Note File
    async handleNoteFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.showLoading('Importing file...');

        try {
            const fileType = file.type;
            const fileName = file.name;

            if (fileType === 'text/plain') {
                // Handle TXT files
                const text = await file.text();
                document.getElementById('noteContent').innerHTML = text.replace(/\n/g, '<br>');
                this.showToast('✅ Text file imported!', 'success');
            } else if (fileType.includes('image')) {
                // Handle images
                const reader = new FileReader();
                reader.onload = (e) => {
                    const img = `<img src="${e.target.result}" style="max-width: 100%; height: auto; border-radius: 8px; margin: 10px 0;">`;
                    document.getElementById('noteContent').innerHTML += img;
                    this.showToast('✅ Image imported!', 'success');
                };
                reader.readAsDataURL(file);
            } else {
                this.showToast('⚠️ This file type requires manual copy-paste for now', 'warning');
            }

            this.hideLoading();
        } catch (error) {
            this.hideLoading();
            console.error('Import error:', error);
            this.showToast('❌ Failed to import file', 'error');
        }

        event.target.value = '';
    }

    importPDFNote() {
        document.getElementById('pdfNoteInput').click();
    }

    async handlePDFImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            this.showToast('⚠️ Please select a PDF file only', 'warning');
            event.target.value = '';
            return;
        }

        this.showLoading('Importing PDF...');

        try {
            const reader = new FileReader();
            reader.onload = (e) => {
                const pdfData = e.target.result;
                const fileName = file.name.replace('.pdf', '');
                
                // Auto-save to notes immediately
                const noteId = `pdf_${Date.now()}`;
                this.notes[noteId] = {
                    title: fileName,
                    content: '',
                    pdfData: pdfData,
                    isPDF: true,
                    createdAt: new Date().toISOString(),
                    lastModified: new Date().toISOString()
                };
                
                this.saveNotes();
                this.updateNotesList();
                
                // Show PDF viewer
                this.currentPDFData = {
                    name: file.name,
                    data: pdfData
                };
                
                document.getElementById('pdfFrame').src = pdfData;
                document.getElementById('pdfViewerModal').classList.add('active');
                
                this.hideLoading();
                this.showToast('✅ PDF saved to notes!', 'success');
            };
            reader.readAsDataURL(file);
        } catch (error) {
            this.hideLoading();
            console.error('PDF load error:', error);
            this.showToast('❌ Failed to load PDF', 'error');
        }

        event.target.value = '';
    }
    
    viewPDFNote(noteId) {
        const note = this.notes[noteId];
        if (!note.isPDF) return;
        
        this.currentPDFData = {
            name: note.title + '.pdf',
            data: note.pdfData
        };
        
        document.getElementById('pdfFrame').src = note.pdfData;
        document.getElementById('pdfViewerModal').classList.add('active');
    }

    closePDFViewer() {
        document.getElementById('pdfViewerModal').classList.remove('active');
        document.getElementById('pdfFrame').src = '';
        
        // Exit fullscreen if active
        if (document.fullscreenElement) {
            document.exitFullscreen();
        }
    }

    togglePDFFullscreen() {
        const modal = document.getElementById('pdfViewerModal').querySelector('.modal-content');
        const icon = document.getElementById('fullscreenIcon');
        
        if (!document.fullscreenElement) {
            modal.requestFullscreen().catch(err => {
                console.error('Fullscreen error:', err);
                this.showToast('Fullscreen not supported', 'warning');
            });
            icon.textContent = '⛶';
        } else {
            document.exitFullscreen();
            icon.textContent = '⛶';
        }
    }

    // Helper function for HTML escaping (add this if it doesn't exist)
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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

        // Add keyboard navigation for quiz results (mobile arrow keys)
        document.addEventListener('keydown', (e) => {
            if (this.quizResults && this.quizResults.answers) {
                if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    this.navigateResults('prev');
                } else if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    this.navigateResults('next');
                }
            }
        });

        // Prevent double-tap zoom on buttons
        let lastTouchEnd = 0;
        document.addEventListener('touchend', (e) => {
            const now = Date.now();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        }, false);

        // Add swipe gestures for flashcards (optional enhancement)
        this.setupSwipeGestures();
    }

    setupSwipeGestures() {
        let touchStartX = 0;
        let touchEndX = 0;
        
        document.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });
        
        document.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            this.handleSwipe();
        }, { passive: true });
    }

    handleSwipe() {
        const swipeThreshold = 50;
        const diff = this.touchStartX - this.touchEndX;
        
        // Swipe left (next card in study mode)
        if (diff > swipeThreshold && this.currentStudyBank && document.getElementById('studyContainer').style.display === 'block') {
            this.nextCard();
        }
        
        // Swipe right (previous card in study mode)
        if (diff < -swipeThreshold && this.currentStudyBank && document.getElementById('studyContainer').style.display === 'block') {
            this.previousCard();
        }
        
        // Swipe left (next result in quiz results)
        if (diff > swipeThreshold && this.quizResults) {
            this.navigateResults('next');
        }
        
        // Swipe right (previous result in quiz results)
        if (diff < -swipeThreshold && this.quizResults) {
            this.navigateResults('prev');
        }
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
            // Accept: Q1:, Q1., 1:, 1.
            const questionMatch = firstLine.match(/^(?:Q)?(\d+)[:.]\s*(.+)/i);
            
            if (!questionMatch) return;
            
            const id = questionMatch[1];
            const questionText = questionMatch[2].trim();
            const options = [];
            const correctAnswers = []; // Support multiple correct answers
            
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i];
                // Accept: *A., *a., A., a., *A, *a, A, a
                const optionMatch = line.match(/^(\**)([A-Da-d])\.?\s*(.+)$/i);
                
                if (optionMatch) {
                    const asterisks = optionMatch[1];
                    const letter = optionMatch[2].toUpperCase();
                    const optionText = optionMatch[3].trim();
                    
                    options.push(optionText);
                    
                    if (asterisks.length > 0) {
                        correctAnswers.push(letter);
                    }
                }
            }
            
            if (options.length === 4 && correctAnswers.length > 0) {
                questions.push({
                    id: id,
                    question: questionText,
                    options: options,
                    correct: correctAnswers.length === 1 ? correctAnswers[0] : correctAnswers,
                    isMultipleChoice: correctAnswers.length > 1
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
            
            // Get last 4 attempts
            const last4Attempts = bank.attempts.slice(-3).reverse();
            let attemptsHTML = '';
            if (last4Attempts.length > 0) {
                attemptsHTML = last4Attempts.map((attempt, index) => {
                    const attemptNumber = bank.attempts.length - index;
                    const date = new Date(attempt.date).toLocaleDateString();
                    const percentage = parseFloat(attempt.percentage);
                    
                    // Determine color based on percentage
                    const color = percentage >= 80 ? '#28a745' : percentage >= 60 ? '#ffc107' : '#dc3545';
                    
                    // Determine icon based on percentage
                    let icon;
                    if (percentage <= 40) {
                        icon = '📚';
                    } else if (percentage <= 70) {
                        icon = '💪';
                    } else if (percentage <= 85) {
                        icon = '🎯';
                    } else {
                        icon = '🎉';
                    }
                    
                    return `
                        <div style="display: flex; justify-content: space-between; align-items: center; margin: 8px 0; font-size: 0.95em;">
                            <span>${icon} Attempt ${attemptNumber} (${date}):</span>
                            <span style="font-weight: bold; color: ${color};">${attempt.score}/${bank.questions.length} (${percentage}%)</span>
                        </div>
                    `;
                }).join('');
            } else {
                attemptsHTML = '<p style="margin: 8px 0; font-size: 0.95em; color: #6c757d; font-style: italic;">No attempts yet</p>';
            }

            card.innerHTML = `
                <h3 style="margin-bottom: 15px;">${bank.title}</h3>
                
                <!-- Default Content (shown initially) -->
                <div class="bank-default-content">
                    <div style="display: flex; justify-content: space-between; align-items: start; gap: 15px;">
                        <div style="flex: 1;">
                            <p style="margin: 3px 0;">📝 ${bank.questions.length} questions</p>
                            <p style="margin: 3px 0;">📊 ${bank.attempts.length} attempts</p>
                            <p style="margin: 3px 0;">⭐ Avg: ${avgScore}</p>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; flex-shrink: 0;">
                            <button onclick="app.viewBank('${key.replace(/'/g, "\\'")}'); event.stopPropagation();" title="View" style="background: #28a745; border: none; color: white; width: 36px; height: 36px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.3s; font-size: 1.1em;">👁️</button>
                            <button onclick="app.editBank('${key.replace(/'/g, "\\'")}'); event.stopPropagation();" title="Edit" style="background: #17a2b8; border: none; color: white; width: 36px; height: 36px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.3s; font-size: 1.1em;">✏️</button>
                            <button onclick="app.shareSingleBank('${key.replace(/'/g, "\\'")}'); event.stopPropagation();" title="Share" style="background: #667eea; border: none; color: white; width: 36px; height: 36px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.3s; font-size: 1.1em;">🔗</button>
                            <button onclick="app.deleteBank('${key.replace(/'/g, "\\'")}'); event.stopPropagation();" title="Delete" style="background: #dc3545; border: none; color: white; width: 36px; height: 36px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.3s; font-size: 1.1em;">🗑️</button>
                        </div>
                    </div>
                </div>
                
                <!-- Recent Attempts (hidden initially) -->
                <div class="recent-attempts-toggle" style="display: none;">
                    ${attemptsHTML}
                </div>
            `;

            // Toggle on click (works on both desktop and mobile)
            card.addEventListener('click', (e) => {
                // Don't toggle if clicking a button
                if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
                    return;
                }
                
                const defaultContent = card.querySelector('.bank-default-content');
                const recentAttempts = card.querySelector('.recent-attempts-toggle');
                
                if (defaultContent.style.display === 'none') {
                    // Show default, hide attempts
                    defaultContent.style.display = 'block';
                    recentAttempts.style.display = 'none';
                } else {
                    // Hide default, show attempts
                    defaultContent.style.display = 'none';
                    recentAttempts.style.display = 'block';
                }
            });

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
            const correctAnswers = Array.isArray(q.correct) ? q.correct : [q.correct];
            questionDiv.innerHTML = `
                <strong>Q${index + 1}:</strong> ${q.question}
                ${q.isMultipleChoice ? '<span style="color: #667eea; font-size: 0.9em; margin-left: 10px;">(Multiple Answers)</span>' : ''}
                <div style="margin-top: 10px;">
                    ${q.options.map((opt, i) => {
                        const letter = String.fromCharCode(65 + i);
                        const isCorrect = correctAnswers.includes(letter);
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

    handleEditQuestionsInputChange() {
        const editQuestionsInput = document.getElementById('editQuestionsInput').value.trim();
        const saveBtn = document.getElementById('saveChangesBtn');
        
        if (editQuestionsInput && saveBtn) {
            // Disable save button if there's text in paste questions
            saveBtn.disabled = true;
            saveBtn.style.opacity = '0.5';
            saveBtn.style.cursor = 'not-allowed';
            saveBtn.title = 'Please click "Add These Questions" first';
        } else if (!editQuestionsInput && saveBtn && this.initialEditState) {
            // Re-enable based on normal change tracking
            this.trackEditChanges();
        }
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
                    ${q.isMultipleChoice ? '<span style="color: #667eea; font-size: 0.85em; margin-bottom: 5px; display: block;">(Multiple Answers)</span>' : ''}
                    ${q.options.map((opt, i) => {
                        const letter = String.fromCharCode(65 + i);
                        const correctAnswers = Array.isArray(q.correct) ? q.correct : [q.correct];
                        const isCorrect = correctAnswers.includes(letter);
                        const inputType = q.isMultipleChoice ? 'checkbox' : 'radio';
                        const inputName = q.isMultipleChoice ? `correct-check-${index}-${i}` : `correct-${index}`;
                        return `
                            <div style="display: flex; align-items: center; margin: 5px 0;">
                                <input type="${inputType}" name="${inputName}" value="${letter}" ${isCorrect ? 'checked' : ''} style="margin-right: 10px;" onchange="app.updateSaveButton()">
                                <strong>${letter}.</strong>
                                <input type="text" value="${opt}" id="q-opt-${index}-${i}" style="flex: 1; margin-left: 10px; padding: 5px;">
                            </div>
                        `;
                    }).join('')}
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; gap: 10px;">
                    <button class="btn btn-danger" onclick="app.deleteQuestion(${index})" 
                            style="padding: 6px 12px; min-width: auto; font-size: 0.9em;">
                        🗑️ Delete Question
                    </button>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn ${q.isMultipleChoice ? 'btn-primary' : 'btn-secondary'}" 
                                onclick="app.toggleAnswerType(${index}, true)" 
                                id="multipleBtn-${index}"
                                style="padding: 6px 12px; min-width: auto; font-size: 0.85em;">
                            ☑️ Multiple
                        </button>
                        <button class="btn ${!q.isMultipleChoice ? 'btn-primary' : 'btn-secondary'}" 
                                onclick="app.toggleAnswerType(${index}, false)" 
                                id="singleBtn-${index}"
                                style="padding: 6px 12px; min-width: auto; font-size: 0.85em;">
                            ⭕ Single
                        </button>
                    </div>
                </div>
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

    toggleAnswerType(index, isMultiple) {
        const bank = this.testBanks[this.currentEditingBank];
        const question = bank.questions[index];
        
        // Update question type
        question.isMultipleChoice = isMultiple;
        
        // Update correct answers
        if (isMultiple) {
            // Convert to array if single answer
            if (!Array.isArray(question.correct)) {
                question.correct = [question.correct];
            }
        } else {
            // Convert to single answer if multiple
            if (Array.isArray(question.correct)) {
                question.correct = question.correct[0] || 'A';
            }
        }
        
        // Re-render the question
        this.renderEditQuestions();
        this.updateSaveButton();
    }

    updateSaveButton() {
        const saveBtn = document.querySelector('#editModal .btn-success');
        if (!saveBtn || !this.currentEditingBank) return;
        
        const newTitle = document.getElementById('editBankName').value.trim();
        const hasNewQuestions = document.getElementById('editQuestionsInput').value.trim().length > 0;
        
        // Check if title changed
        const titleChanged = newTitle !== this.originalBankState.title;
        
        // Check if any questions were modified
        const bank = this.testBanks[this.currentEditingBank];
        let questionsChanged = bank.questions.length !== this.originalBankState.questions.length;
        
        if (!questionsChanged) {
            for (let i = 0; i < bank.questions.length; i++) {
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
                
                // Check correct answer (handle both single and multiple)
                const currentQ = bank.questions[i];
                const originalQ = this.originalBankState.questions[i];
                
                if (currentQ.isMultipleChoice) {
                    const checkedBoxes = document.querySelectorAll(`input[name^="correct-check-${i}-"]:checked`);
                    const currentCorrect = Array.from(checkedBoxes).map(cb => cb.value).sort().join(',');
                    const originalCorrect = (Array.isArray(originalQ.correct) ? originalQ.correct : [originalQ.correct]).sort().join(',');
                    
                    if (currentCorrect !== originalCorrect) {
                        questionsChanged = true;
                        break;
                    }
                } else {
                    const correctRadio = document.querySelector(`input[name="correct-${i}"]:checked`);
                    const originalCorrect = Array.isArray(originalQ.correct) ? originalQ.correct[0] : originalQ.correct;
                    
                    if (correctRadio && correctRadio.value !== originalCorrect) {
                        questionsChanged = true;
                        break;
                    }
                }
                
                // Check if answer type changed
                if (currentQ.isMultipleChoice !== originalQ.isMultipleChoice) {
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
                const overwrite = confirm(`Found ${duplicates.length} duplicate question(s). Do you want to overwrite them?\n\nClick OK to overwrite, Cancel to discard duplicates.`);
                
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
        
        // FIRST: Save all currently visible questions' data
        bank.questions.forEach((q, index) => {
            const questionElement = document.getElementById(`question-${index}`);
            
            // Only update if the question element exists in DOM
            if (questionElement) {
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
                
                if (options.length > 0) {
                    q.options = options;
                }
                
                if (q.isMultipleChoice) {
                    const checkedBoxes = document.querySelectorAll(`input[name^="correct-check-${index}-"]:checked`);
                    if (checkedBoxes.length > 0) {
                        q.correct = Array.from(checkedBoxes).map(cb => cb.value);
                        q.isMultipleChoice = q.correct.length > 1;
                    }
                } else {
                    const correctRadio = document.querySelector(`input[name="correct-${index}"]:checked`);
                    if (correctRadio) {
                        q.correct = correctRadio.value;
                        q.isMultipleChoice = false;
                    }
                }
            }
        });
        
        // THEN: Check if filter is active and needs clearing
        const searchInput = document.getElementById('editSearchInput');
        const hasFilter = searchInput && searchInput.value.trim() !== '';
        
        if (hasFilter) {
            // Clear filter and re-render to show all questions
            searchInput.value = '';
            this.renderEditQuestions();
            
            // Now save any remaining questions that weren't visible before
            bank.questions.forEach((q, index) => {
                const questionElement = document.getElementById(`question-${index}`);
                
                if (questionElement) {
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
                    
                    if (options.length > 0) {
                        q.options = options;
                    }
                    
                    if (q.isMultipleChoice) {
                        const checkedBoxes = document.querySelectorAll(`input[name^="correct-check-${index}-"]:checked`);
                        if (checkedBoxes.length > 0) {
                            q.correct = Array.from(checkedBoxes).map(cb => cb.value);
                            q.isMultipleChoice = q.correct.length > 1;
                        }
                    } else {
                        const correctRadio = document.querySelector(`input[name="correct-${index}"]:checked`);
                        if (correctRadio) {
                            q.correct = correctRadio.value;
                            q.isMultipleChoice = false;
                        }
                    }
                }
            });
        }
        
        if (newName !== oldName) {
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

    showExportAllModal() {
        document.getElementById('exportAllModal').classList.add('active');
    }

    closeExportAllModal() {
        document.getElementById('exportAllModal').classList.remove('active');
    }

    exportAllAsJSON() {
        this.exportAllData(); // Use existing function
        this.closeExportAllModal();
    }

    async exportAllAsPDF() {
        if (Object.keys(this.testBanks).length === 0) {
            this.showToast('No test banks to export', 'warning');
            return;
        }

        this.showLoading('Generating PDF with all test banks...');
        this.closeExportAllModal();
        
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            let yPos = 20;
            const pageHeight = doc.internal.pageSize.height;
            const margin = 20;
            const maxWidth = 170;
            let isFirstBank = true;
            
            Object.values(this.testBanks).forEach(bank => {
                // Add new page for each bank (except first)
                if (!isFirstBank) {
                    doc.addPage();
                    yPos = 20;
                }
                isFirstBank = false;
                
                // Bank Title
                doc.setFontSize(18);
                doc.setTextColor(102, 126, 234);
                doc.text(bank.title, margin, yPos);
                yPos += 8;
                
                // Metadata
                doc.setFontSize(9);
                doc.setTextColor(108, 117, 125);
                doc.text(`Questions: ${bank.questions.length}`, margin, yPos);
                yPos += 10;
                
                // Line separator
                doc.setDrawColor(102, 126, 234);
                doc.setLineWidth(0.5);
                doc.line(margin, yPos, 190, yPos);
                yPos += 8;
                
                // Questions
                bank.questions.forEach((q, index) => {
                    // Check if we need a new page
                    if (yPos > pageHeight - 60) {
                        doc.addPage();
                        yPos = 20;
                    }
                    
                    // Question
                    doc.setFontSize(10);
                    doc.setTextColor(0, 0, 0);
                    doc.setFont(undefined, 'bold');
                    const questionLines = doc.splitTextToSize(`Q${index + 1}: ${q.question}`, maxWidth);
                    doc.text(questionLines, margin, yPos);
                    yPos += questionLines.length * 5 + 3;
                    
                    // Options
                    doc.setFont(undefined, 'normal');
                    doc.setFontSize(9);
                    q.options.forEach((opt, i) => {
                        const letter = String.fromCharCode(65 + i);
                        const isCorrect = letter === q.correct;
                        
                        if (isCorrect) {
                            doc.setTextColor(40, 167, 69);
                            doc.setFont(undefined, 'bold');
                        } else {
                            doc.setTextColor(0, 0, 0);
                            doc.setFont(undefined, 'normal');
                        }
                        
                        const optionLines = doc.splitTextToSize(`${letter}. ${opt}`, maxWidth - 5);
                        doc.text(optionLines, margin + 5, yPos);
                        yPos += optionLines.length * 4.5 + 1;
                    });
                    
                    yPos += 6;
                });
            });
            
            // Footer on all pages
            const totalPages = doc.internal.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(150);
                doc.text(`Page ${i} of ${totalPages}`, 105, pageHeight - 10, { align: 'center' });
                doc.text('Generated by QuizMaster', 105, pageHeight - 5, { align: 'center' });
            }
            
            // Save
            doc.save(`QuizMaster-All-Banks-${new Date().toISOString().split('T')[0]}.pdf`);
            
            this.hideLoading();
            this.showToast('✅ All test banks exported as PDF!', 'success');
        } catch (error) {
            this.hideLoading();
            console.error('PDF export error:', error);
            this.showToast('❌ Failed to generate PDF. Make sure jsPDF is loaded.', 'error');
        }
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
        
        localStorage.setItem(`share_${code}`, JSON.stringify(shareData));
        return code;
    }

    shareSingleBank(key) {
        this.currentShareKey = key;
        const singleBankData = {};
        singleBankData[key] = this.testBanks[key];
        
        const shareCode = this.generateShareCode(singleBankData);
        const shareLink = `QM-${shareCode}`;
        
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

    async exportSingleBankPDF() {
        const key = this.currentShareKey;
        if (!key) return;
        
        this.showLoading('Generating PDF...');
        
        try {
            const bank = this.testBanks[key];
            
            // Using jsPDF library
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            let yPos = 20;
            const pageHeight = doc.internal.pageSize.height;
            const margin = 20;
            const maxWidth = 170;
            
            // Title
            doc.setFontSize(20);
            doc.setTextColor(102, 126, 234);
            doc.text(bank.title, margin, yPos);
            yPos += 10;
            
            // Metadata
            doc.setFontSize(10);
            doc.setTextColor(108, 117, 125);
            doc.text(`Total Questions: ${bank.questions.length}`, margin, yPos);
            yPos += 6;
            doc.text(`Generated: ${new Date().toLocaleDateString()}`, margin, yPos);
            yPos += 10;
            
            // Line separator
            doc.setDrawColor(102, 126, 234);
            doc.setLineWidth(0.5);
            doc.line(margin, yPos, 190, yPos);
            yPos += 10;
            
            // Questions
            bank.questions.forEach((q, index) => {
                // Check if we need a new page
                if (yPos > pageHeight - 60) {
                    doc.addPage();
                    yPos = 20;
                }
                
                // Question number and text
                doc.setFontSize(11);
                doc.setTextColor(0, 0, 0);
                doc.setFont(undefined, 'bold');
                const questionLines = doc.splitTextToSize(`Q${index + 1}: ${q.question}`, maxWidth);
                doc.text(questionLines, margin, yPos);
                yPos += questionLines.length * 6 + 4;
                
                // Options
                doc.setFont(undefined, 'normal');
                doc.setFontSize(10);
                q.options.forEach((opt, i) => {
                    const letter = String.fromCharCode(65 + i);
                    const isCorrect = letter === q.correct;
                    
                    if (isCorrect) {
                        doc.setTextColor(40, 167, 69); // Green for correct
                        doc.setFont(undefined, 'bold');
                    } else {
                        doc.setTextColor(0, 0, 0);
                        doc.setFont(undefined, 'normal');
                    }
                    
                    const optionLines = doc.splitTextToSize(`${letter}. ${opt}`, maxWidth - 5);
                    doc.text(optionLines, margin + 5, yPos);
                    yPos += optionLines.length * 5 + 2;
                });
                
                yPos += 8; // Space between questions
            });
            
            // Footer on last page
            const totalPages = doc.internal.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(150);
                doc.text(`Page ${i} of ${totalPages}`, 105, pageHeight - 10, { align: 'center' });
                doc.text('Generated by QuizMaster', 105, pageHeight - 5, { align: 'center' });
            }
            
            // Save PDF
            doc.save(`${key.replace(/[^a-z0-9]/gi, '_')}-${new Date().toISOString().split('T')[0]}.pdf`);
            
            this.hideLoading();
            this.showToast('✅ PDF exported successfully!', 'success');
        } catch (error) {
            this.hideLoading();
            console.error('PDF export error:', error);
            this.showToast('❌ Failed to generate PDF. Make sure jsPDF is loaded.', 'error');
        }
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
        if (!select) return;
        
        select.innerHTML = '<option value="">Choose a test bank...</option>';
        
        Object.keys(this.testBanks).forEach(key => {
            const bank = this.testBanks[key];
            if (bank.questions && bank.questions.length > 0) {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = `${bank.title} (${bank.questions.length} questions)`;
                select.appendChild(option);
            }
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

        // Disable test bank selector during exam
        document.getElementById('selectBank').disabled = true;
        document.getElementById('selectBank').style.opacity = '0.5';
        document.getElementById('selectBank').style.cursor = 'not-allowed';

        this.currentBank = this.testBanks[selected];
        
        // Always shuffle questions for each attempt
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
        this.currentQuestions = this.shuffleArray([...this.currentBank.questions]).slice(0, questionCount);
        
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
                    ${q.isMultipleChoice ? 
                        `<p style="color: #667eea; font-weight: bold; margin-bottom: 10px;">⚠️ Multiple correct answers - Select ${Array.isArray(q.correct) ? q.correct.length : 1} answer(s)</p>` : ''}
                    ${q.options.map((opt, i) => {
                        const letter = String.fromCharCode(65 + i);
                        return `
                            <div class="quiz-option" onclick="app.selectAnswer('${letter}', this, ${q.isMultipleChoice})" data-answer="${letter}">
                                <input type="radio" name="answer" value="${letter}" id="opt${i}" style="display: none;">
                                <label for="opt${i}">${letter}. ${opt}</label>
                            </div>
                        `;
                    }).join('')}
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
            this.examLocked = false;
            
            // Re-enable test bank selector
            const selectBank = document.getElementById('selectBank');
            if (selectBank) {
                selectBank.disabled = false;
                selectBank.style.opacity = '1';
                selectBank.style.cursor = 'pointer';
            }
            
            if (this.quizState.timerInterval) {
                clearInterval(this.quizState.timerInterval);
            }
            const timer = document.getElementById('quizTimer');
            if (timer) timer.remove();
            location.reload();
        }
    }

    selectAnswer(answer, element, isMultipleChoice) {
        if (isMultipleChoice) {
            // Allow multiple selections
            element.classList.toggle('selected');
            
            if (!this.tempMultipleAnswers) {
                this.tempMultipleAnswers = [];
            }
            
            if (element.classList.contains('selected')) {
                if (!this.tempMultipleAnswers.includes(answer)) {
                    this.tempMultipleAnswers.push(answer);
                }
            } else {
                this.tempMultipleAnswers = this.tempMultipleAnswers.filter(a => a !== answer);
            }
        } else {
            // Single answer - clear others
            document.querySelectorAll('.quiz-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            element.classList.add('selected');
        }
    }

    submitAnswer() {
        const q = this.currentQuestions[this.quizState.currentIndex];
        let answer = null;
        
        if (q.isMultipleChoice) {
            // Get selected answers from our temp storage
            answer = this.tempMultipleAnswers ? [...this.tempMultipleAnswers].sort() : [];
            if (answer.length === 0 && this.quizState.immediateMode) {
                this.showToast('Please select at least one answer', 'warning');
                return;
            }
        } else {
            // Single answer
            const selected = document.querySelector('input[name="answer"]:checked');
            if (!selected && this.quizState.immediateMode) {
                this.showToast('Please select an answer', 'warning');
                return;
            }
            answer = selected ? selected.value : null;
        }

        const correct = q.correct;
        let isCorrect = false;
        
        if (q.isMultipleChoice) {
            // Compare arrays
            const sortedCorrect = Array.isArray(correct) ? [...correct].sort() : [correct].sort();
            isCorrect = JSON.stringify(answer) === JSON.stringify(sortedCorrect);
        } else {
            isCorrect = answer === correct;
        }
        
        this.quizState.answers.push({
            questionId: this.currentQuestions[this.quizState.currentIndex].id,
            selected: answer,
            correct: correct,
            isCorrect: isCorrect
        });

        // Clear temp multiple answers
        this.tempMultipleAnswers = [];

        if (this.quizState.immediateMode && answer) {
            this.showFeedback(isCorrect);
        } else {
            this.nextQuestion();
        }
    }

    showFeedback(isCorrect) {
        const options = document.querySelectorAll('.quiz-option');
        const q = this.currentQuestions[this.quizState.currentIndex];
        const correctAnswers = Array.isArray(q.correct) ? q.correct : [q.correct];

        options.forEach((opt, i) => {
            const letter = String.fromCharCode(65 + i);
            const input = opt.querySelector('input');
            
            if (correctAnswers.includes(letter)) {
                opt.classList.add('correct');
            } else if (input.checked && !isCorrect) {
                opt.classList.add('incorrect');
            }
            opt.style.pointerEvents = 'none';
        });

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

        // Re-enable test bank selector
        const selectBank = document.getElementById('selectBank');
        if (selectBank) {
            selectBank.disabled = false;
            selectBank.style.opacity = '1';
            selectBank.style.cursor = 'pointer';
        }

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
            message = "Excellent!";
            icon = '🎉';
        }

        // Store results for pagination
        this.quizResults = {
            currentPage: 0,
            answers: this.quizState.answers,
            questions: this.currentQuestions
        };

        const container = document.getElementById('quizContainer');
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px;">
                <div class="feedback-icon">${icon}</div>
                <h2>${message}</h2>
                <h3 style="margin: 20px 0;">Score: ${score}/${total} (${percentage}%)</h3>
                <p style="color: #6c757d;">Time: ${Math.floor(duration / 60000)} minutes ${Math.floor((duration % 60000) / 1000)} seconds</p>
                
                <!-- Results Display Area -->
                <div style="margin: 30px 0; text-align: left;" id="resultsContainer">
                    <!-- Results will be rendered here -->
                </div>
                
                <!-- MOBILE-OPTIMIZED NAVIGATION -->
                <div class="results-navigation-wrapper">
                    <!-- Previous/Next Buttons Row -->
                    <div class="results-nav-buttons">
                        <button class="btn btn-secondary" onclick="app.navigateResults('prev')" id="prevResultBtn">
                            ⬅️ Previous
                        </button>
                        <button class="btn btn-secondary" onclick="app.navigateResults('next')" id="nextResultBtn">
                            Next ➡️
                        </button>
                    </div>
                    
                    <!-- Question Label and Page Numbers -->
                    <div class="results-question-label">
                        <span>Question:</span>
                        <div id="resultPageNumbers"></div>
                    </div>
                </div>
                
                <!-- Current Question Indicator -->
                <div class="results-current-indicator">
                    Showing question <strong id="currentQuestionNum">1</strong> of <strong>${total}</strong>
                </div>
                
                <!-- Action Buttons -->
                <div class="results-action-buttons">
                    <button class="btn btn-primary" onclick="app.retakeQuiz()">🔄 Retake Test</button>
                    <button class="btn btn-secondary" onclick="location.reload()">🏠 Back to Home</button>
                </div>
            </div>
        `;

        this.renderResultsPage();
        this.updateAnalytics();
    }

    renderResultsPage() {
        const currentIndex = this.quizResults.currentPage;
        const a = this.quizResults.answers[currentIndex];
        const question = this.quizResults.questions[currentIndex];
        const correctAnswers = Array.isArray(a.correct) ? a.correct : [a.correct];
        const selectedAnswers = Array.isArray(a.selected) ? a.selected : [a.selected];
        
        const resultsContainer = document.getElementById('resultsContainer');
        resultsContainer.innerHTML = `
            <div style="background: #f8f9fa; padding: 20px; margin: 15px 0; border-radius: 8px; border-left: 5px solid ${a.isCorrect ? '#28a745' : '#dc3545'};">
                <h4 style="color: #495057; margin-bottom: 15px;">Question ${currentIndex + 1}: ${question.question}</h4>
                ${question.isMultipleChoice ? '<p style="color: #667eea; font-size: 0.9em; margin-bottom: 10px;">(Multiple Answers)</p>' : ''}
                ${question.options.map((opt, optIndex) => {
                    const letter = String.fromCharCode(65 + optIndex);
                    const isCorrect = correctAnswers.includes(letter);
                    const isSelected = selectedAnswers.includes(letter);
                    let bgColor = 'white';
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
                    
                    return `
                        <div style="background: ${bgColor}; padding: 12px; margin: 8px 0; border-radius: 6px; color: ${textColor}; font-weight: ${isCorrect || isSelected ? 'bold' : 'normal'};">
                            ${icon} ${letter}. ${opt}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        
        // Update pagination buttons
        this.updateResultsPagination();
    }

    updateResultsPagination() {
        const total = this.quizResults.answers.length;
        const current = this.quizResults.currentPage;
        
        // Update prev/next buttons
        const prevBtn = document.getElementById('prevResultBtn');
        const nextBtn = document.getElementById('nextResultBtn');
        
        if (prevBtn && nextBtn) {
            prevBtn.disabled = current === 0;
            nextBtn.disabled = current === total - 1;
            prevBtn.style.opacity = current === 0 ? '0.5' : '1';
            nextBtn.style.opacity = current === total - 1 ? '0.5' : '1';
            prevBtn.style.cursor = current === 0 ? 'not-allowed' : 'pointer';
            nextBtn.style.cursor = current === total - 1 ? 'not-allowed' : 'pointer';
        }
        
        // Update current question number
        const currentNumSpan = document.getElementById('currentQuestionNum');
        if (currentNumSpan) {
            currentNumSpan.textContent = current + 1;
        }
        
        // Generate page numbers
        const pageNumbersDiv = document.getElementById('resultPageNumbers');
        if (!pageNumbersDiv) return;
        
        pageNumbersDiv.innerHTML = '';
        
        for (let i = 0; i < total; i++) {
            const isCorrect = this.quizResults.answers[i].isCorrect;
            const btn = document.createElement('button');
            btn.textContent = i + 1;
            btn.className = 'btn';
            
            // Determine background color
            let bgColor;
            if (i === current) {
                bgColor = '#667eea'; // Current question - purple
            } else if (isCorrect) {
                bgColor = '#28a745'; // Correct - green
            } else {
                bgColor = '#dc3545'; // Incorrect - red
            }
            
            btn.style.cssText = `
                min-width: 40px;
                max-width: 40px;
                height: 40px;
                padding: 0;
                margin: 0;
                background: ${bgColor};
                color: white;
                opacity: ${i === current ? '1' : '0.7'};
                font-weight: ${i === current ? 'bold' : 'normal'};
                border: ${i === current ? '3px solid #fff' : 'none'};
                box-shadow: ${i === current ? '0 0 0 2px #667eea' : 'none'};
                transition: all 0.3s ease;
            `;
            
            btn.onclick = () => this.navigateResults(i);
            
            // Add hover effect
            btn.onmouseover = () => {
                if (i !== current) {
                    btn.style.opacity = '1';
                    btn.style.transform = 'scale(1.1)';
                }
            };
            
            btn.onmouseout = () => {
                if (i !== current) {
                    btn.style.opacity = '0.7';
                    btn.style.transform = 'scale(1)';
                }
            };
            
            pageNumbersDiv.appendChild(btn);
        }
    }

    navigateResults(direction) {
        if (typeof direction === 'number') {
            this.quizResults.currentPage = direction;
        } else if (direction === 'prev') {
            if (this.quizResults.currentPage > 0) {
                this.quizResults.currentPage--;
            }
        } else if (direction === 'next') {
            if (this.quizResults.currentPage < this.quizResults.answers.length - 1) {
                this.quizResults.currentPage++;
            }
        }
        
        this.renderResultsPage();
        
        // Smooth scroll to top of results
        document.getElementById('resultsContainer').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    retakeQuiz() {
        // Keep exam locked
        this.examLocked = true;
        
        // Disable test bank selector
        document.getElementById('selectBank').disabled = true;
        document.getElementById('selectBank').style.opacity = '0.5';
        document.getElementById('selectBank').style.cursor = 'not-allowed';
        
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

    renderLineChart(container) {
        let html = '<div style="padding: 20px;"><h3>Score Progression Over Time</h3>';
        
        const allAttempts = [];
        Object.values(this.testBanks).forEach(bank => {
            bank.attempts.forEach(att => {
                allAttempts.push({
                    date: new Date(att.date),
                    score: parseFloat(att.percentage),
                    bank: bank.title
                });
            });
        });
        
        allAttempts.sort((a, b) => a.date - b.date);
        
        if (allAttempts.length === 0) {
            container.innerHTML = '<p style="text-align: center; padding: 40px;">No attempts yet!</p>';
            return;
        }
        
        html += '<div style="position: relative; height: 300px; border-left: 2px solid #dee2e6; border-bottom: 2px solid #dee2e6; padding: 20px;">';
        
        const maxScore = 100;
        allAttempts.forEach((att, i) => {
            const left = (i / (allAttempts.length - 1 || 1)) * 90;
            const bottom = (att.score / maxScore) * 90;
            const color = att.score >= 80 ? '#28a745' : att.score >= 60 ? '#ffc107' : '#dc3545';
            
            html += `
                <div style="position: absolute; left: ${left}%; bottom: ${bottom}%; width: 12px; height: 12px; background: ${color}; border-radius: 50%; transform: translate(-50%, 50%);" title="${att.bank}: ${att.score}%"></div>
            `;
            
            if (i > 0) {
                const prevLeft = ((i - 1) / (allAttempts.length - 1 || 1)) * 90;
                const prevBottom = (allAttempts[i - 1].score / maxScore) * 90;
                html += `
                    <svg style="position: absolute; left: 0; top: 0; width: 100%; height: 100%; pointer-events: none;">
                        <line x1="${prevLeft}%" y1="${100 - prevBottom}%" x2="${left}%" y2="${100 - bottom}%" stroke="${color}" stroke-width="2"/>
                    </svg>
                `;
            }
        });
        
        html += '</div></div>';
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
        html += '<div class="pie-chart-container" style="display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 40px;">';
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
        html += '<div class="pie-chart-legend">';
        
        Object.entries(ranges).forEach(([label, data]) => {
            const percentage = ((data.count / allAttempts.length) * 100).toFixed(1);
            html += `
                <div style="margin: 10px 0; display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; flex: 1;">
                        <div style="width: 20px; height: 20px; background: ${data.color}; margin-right: 10px; border-radius: 4px; flex-shrink: 0;"></div>
                        <span><strong>${label}:</strong></span>
                    </div>
                    <span style="margin-left: 15px; white-space: nowrap;"><strong>${data.count} (${percentage}%)</strong></span>
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

        html += '<h3 style="margin-top: 40px; margin-bottom: 20px;">Performance by Test Bank</h3>';
        html += '<div class="test-bank-list">';

        Object.values(this.testBanks).forEach(bank => {
            if (bank.attempts.length > 0) {
                const avgScore = bank.attempts.reduce((sum, att) => sum + parseFloat(att.percentage), 0) / bank.attempts.length;
                const bestScore = Math.max(...bank.attempts.map(att => parseFloat(att.percentage)));
                const worstScore = Math.min(...bank.attempts.map(att => parseFloat(att.percentage)));
                const lastAttempt = bank.attempts[bank.attempts.length - 1];
                
                // Determine color based on average score
                let scoreColor = '#dc3545'; // Red for low
                if (avgScore >= 85) scoreColor = '#28a745'; // Green for excellent
                else if (avgScore >= 70) scoreColor = '#17a2b8'; // Blue for good
                else if (avgScore >= 60) scoreColor = '#ffc107'; // Yellow for fair
                
                html += `
                    <div class="test-bank-card" style="cursor: default;">
                        <h3 style="margin-bottom: 12px;">${bank.title}</h3>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.95em;">
                            <p style="margin: 3px 0;">📊 ${bank.attempts.length} attempts</p>
                            <p style="margin: 3px 0; color: ${scoreColor}; font-weight: bold;">⭐ Avg: ${avgScore.toFixed(1)}%</p>
                            <p style="margin: 3px 0; color: #28a745;">🏆 Best: ${bestScore}%</p>
                            <p style="margin: 3px 0; color: #dc3545;">📉 Worst: ${worstScore}%</p>
                        </div>
                        <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(0,0,0,0.1); font-size: 0.85em; color: #6c757d;">
                            <strong>Last:</strong> ${new Date(lastAttempt.date).toLocaleDateString()} - ${lastAttempt.percentage}%
                        </div>
                    </div>
                `;
            }
        });
        
        html += '</div>';

        if (totalAttempts === 0) {
            html += '<p style="text-align: center; padding: 40px; color: #6c757d;">No quiz attempts yet. Take a quiz to see your performance!</p>';
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
                    <h2 style="color: #dc3545; margin-bottom: 15px;">Exam Ongoing!</h2>
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
        
        event.target.classList.add('active');
        document.getElementById(tab).classList.add('active');

        if (tab === 'analytics') {
            this.updateAnalytics();
        } else if (tab === 'take') {
            this.updateSelectOptions();
        } else if (tab === 'notes') {
            this.updateNotesList();
        } else if (tab === 'study') {
            // Update study mode select options
            const select = document.getElementById('studySelectBank');
            if (select) {
                select.innerHTML = '<option value="">Choose a test bank...</option>';
                Object.keys(this.testBanks).forEach(key => {
                    const bank = this.testBanks[key];
                    if (bank.questions && bank.questions.length > 0) {
                        const option = document.createElement('option');
                        option.value = key;
                        option.textContent = `${bank.title} (${bank.questions.length} questions)`;
                        select.appendChild(option);
                    }
                });
            }
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
        
        // Get correct answer text (handle multiple answers)
        let correctAnswer = '';
        if (card.isMultipleChoice) {
            const correctAnswers = Array.isArray(card.correct) ? card.correct : [card.correct];
            correctAnswer = correctAnswers.map(letter => {
                const index = letter.charCodeAt(0) - 65;
                return `${letter}. ${card.options[index]}`;
            }).join('<br><br>');
        } else {
            const correctIndex = card.correct.charCodeAt(0) - 65;
            correctAnswer = card.options[correctIndex];
        }
        
        container.innerHTML = `
            <div class="flashcard" id="flashcard" onclick="app.flipCard()">
                <div class="flashcard-face flashcard-front">
                    <div>
                        <div style="font-size: 0.8em; opacity: 0.8; margin-bottom: 20px;">QUESTION</div>
                        <div>${card.question}</div>
                    </div>
                </div>
                <div class="flashcard-face flashcard-back">
                    <div>
                        <div style="font-size: 0.8em; opacity: 0.8; margin-bottom: 15px;">ANSWER</div>
                        <div style="font-size: 1.8em; font-weight: bold; margin-bottom: 20px; line-height: 1.3;">${correctAnswer}</div>
                        <div style="font-size: 1.2em; opacity: 0.9;">(${card.correct})</div>
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
        counter.textContent = `Card ${this.currentStudyIndex + 1} of ${this.studyCards.length}`;
    }

    updateNavigationButtons() {
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        
        prevBtn.disabled = this.currentStudyIndex === 0;
        nextBtn.disabled = this.currentStudyIndex === this.studyCards.length - 1;
        
        prevBtn.style.opacity = prevBtn.disabled ? '0.5' : '1';
        nextBtn.style.opacity = nextBtn.disabled ? '0.5' : '1';
    }

    clearExamStats() {
        if (!confirm('Are you sure you want to delete ALL Exam statistics? This cannot be undone!')) {
            return;
        }

        Object.values(this.testBanks).forEach(bank => {
            if (bank.attempts) {
                bank.attempts = [];
            }
        });

        this.saveData();
        this.updateAnalytics();
        this.showToast('✅ Exam statistics cleared!', 'success');
    }

    highlightActiveTab() {
        // Add visual indicator that exam is locked
        const takeTab = document.querySelector('.nav-tab:nth-child(2)'); // Exam Mode tab
        if (takeTab) {
            takeTab.style.animation = 'pulse 2s infinite';
            takeTab.style.boxShadow = '0 0 20px rgba(220, 53, 69, 0.6)';
        }
    }

    removeTabHighlight() {
        // Remove visual indicator
        const takeTab = document.querySelector('.nav-tab:nth-child(2)'); // Exam Mode tab
        if (takeTab) {
            takeTab.style.animation = '';
            takeTab.style.boxShadow = '';
        }
    }

    // ============================================
    // GEMINI AI INTEGRATION
    // ============================================

    showGeminiModal() {
        document.getElementById('geminiModal').classList.add('active');
        document.getElementById('geminiResult').style.display = 'none';
        document.getElementById('geminiOutput').value = '';
        document.getElementById('geminiInitialButtons').style.display = 'block';
        document.getElementById('geminiResultButtons').style.display = 'none';
        document.getElementById('filePreview').style.display = 'none';
        document.getElementById('geminiFile').value = '';
        this.uploadedFileData = null;

        // Re-enable controls
        document.getElementById('geminiCount').disabled = false;
        document.getElementById('geminiDifficulty').disabled = false;
        document.getElementById('geminiCount').style.opacity = '1';
        document.getElementById('geminiDifficulty').style.opacity = '1';
        document.getElementById('geminiCount').style.cursor = 'pointer';
        document.getElementById('geminiDifficulty').style.cursor = 'pointer';
    }

    async handleQuestionCountChange() {
        const select = document.getElementById('geminiCount');
        
        if (select.value === 'custom') {
            const customCount = prompt('Enter number of questions (1-50):', '10');
            
            if (customCount === null) {
                // User cancelled, reset to 10
                select.value = '10';
                return;
            }
            
            const count = parseInt(customCount);
            
            if (isNaN(count) || count < 1 || count > 200) {
                this.showToast('⚠️ Please enter a number between 1 and 200', 'warning');
                select.value = '10';
                return;
            }
            
            // Create and add custom option
            const existingCustom = select.querySelector('option[data-custom="true"]');
            if (existingCustom) {
                existingCustom.remove();
            }
            
            const customOption = document.createElement('option');
            customOption.value = count;
            customOption.textContent = `${count} questions (custom)`;
            customOption.setAttribute('data-custom', 'true');
            customOption.selected = true;
            
            // Insert before "Custom..." option
            const customPlaceholder = select.querySelector('option[value="custom"]');
            select.insertBefore(customOption, customPlaceholder);
        }
    }

    async handleFileUpload() {
        const fileInput = document.getElementById('geminiFile');
        const file = fileInput.files[0];
        
        if (!file) return;
        
        this.showLoading('Processing file...');
        
        try {
            const fileType = file.type;
            const fileName = file.name;
            
            document.getElementById('fileName').textContent = fileName;
            document.getElementById('filePreview').style.display = 'block';
            
            // Read file as base64
            const base64Data = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const result = reader.result;
                    // Remove data URL prefix to get pure base64
                    const base64 = result.split(',')[1];
                    resolve(base64);
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
            
            // Store file data for API call
            this.uploadedFileData = {
                mimeType: fileType,
                data: base64Data,
                name: fileName
            };
            // Disable number of questions, question length, and difficulty when file is uploaded
            document.getElementById('geminiCount').disabled = true;
            document.getElementById('geminiLength').disabled = true;
            document.getElementById('geminiDifficulty').disabled = true;
            document.getElementById('geminiCount').style.opacity = '0.5';
            document.getElementById('geminiLength').style.opacity = '0.5';
            document.getElementById('geminiDifficulty').style.opacity = '0.5';
            document.getElementById('geminiCount').style.cursor = 'not-allowed';
            document.getElementById('geminiLength').style.cursor = 'not-allowed';
            document.getElementById('geminiDifficulty').style.cursor = 'not-allowed';
            this.hideLoading();
            this.showToast('✅ File uploaded successfully!', 'success');
            
        } catch (error) {
            this.hideLoading();
            console.error('File upload error:', error);
            this.showToast('❌ Failed to process file', 'error');
            this.clearUploadedFile();
        }
    }

    clearUploadedFile() {
        document.getElementById('geminiFile').value = '';
        document.getElementById('filePreview').style.display = 'none';
        this.uploadedFileData = null;
        
        // Re-enable number of questions, question length, and difficulty
        document.getElementById('geminiCount').disabled = false;
        document.getElementById('geminiLength').disabled = false;
        document.getElementById('geminiDifficulty').disabled = false;
        document.getElementById('geminiCount').style.opacity = '1';
        document.getElementById('geminiLength').style.opacity = '1';
        document.getElementById('geminiDifficulty').style.opacity = '1';
        document.getElementById('geminiCount').style.cursor = 'pointer';
        document.getElementById('geminiLength').style.cursor = 'pointer';
        document.getElementById('geminiDifficulty').style.cursor = 'pointer';
        
        this.showToast('File removed', 'info');
    }

    closeGeminiModal() {
        document.getElementById('geminiModal').classList.remove('active');
    }

    async generateWithGemini() {
        const topic = document.getElementById('geminiTopic').value.trim();
        const count = document.getElementById('geminiCount').value;
        const difficulty = document.getElementById('geminiDifficulty').value;
        const length = document.getElementById('geminiLength').value;

        if (!topic && !this.uploadedFileData) {
            this.showToast('Please enter a topic or upload a file', 'warning');
            return;
        }

        this.showLoading('AI is generating questions...');

        try {
            let complexityNote = '';
            if (difficulty === 'easy') {
                complexityNote = 'Make questions straightforward and basic.';
            } else if (difficulty === 'medium') {
                complexityNote = 'Make questions moderately challenging with some depth.';
            } else {
                complexityNote = 'Make questions complex and require deeper understanding.';
            }
            
            let lengthNote = '';
            if (length === 'short') {
                lengthNote = 'Keep questions and answers SHORT and CONCISE (1 sentence for questions, brief answers).';
            } else if (length === 'medium') {
                lengthNote = 'Use MODERATE length for questions and answers (1-2 sentences for questions).';
            } else {
                lengthNote = 'Make questions and answers DETAILED and COMPREHENSIVE (2-3 sentences for questions, thorough answer options).';
            }

            let prompt = '';
            let requestBody = {};

            if (this.uploadedFileData) {
                // File-based generation
                prompt = `CRITICAL INSTRUCTION: You MUST use ONLY the content from the uploaded file. DO NOT generate questions from your own knowledge.
    ANALYZE THE FILE AND:

1. IF FILE CONTAINS QUESTIONS WITHOUT MULTIPLE CHOICE:
- Keep the EXACT question text from the file
- Create 4 options (A, B, C, D) based on the answer provided in the file
- Mark the correct answer with * (asterisk)
- Generate options that are plausible but only one is correct

2. IF FILE CONTAINS STUDY MATERIALS/NOTES/LECTURES:
- Extract key concepts, facts, and information from the file ONLY
- Generate ${count} questions strictly based on the file content
- DO NOT add information not present in the file
- Each question must have 4 options

3. IF FILE HAS COMPLETE MULTIPLE CHOICE QUESTIONS:
- Format them according to the rules below
- Keep all original questions and answers

STRICT FORMATTING RULES:

1: [Question text from file or based on file content]
A. [First option]
B. [Second option]
C. [Third option]
*D. [Correct answer with asterisk]

2: [Next question]
*A. [Correct answer with asterisk]
B. [Second option]
C. [Third option]
D. [Fourth option]

MANDATORY REQUIREMENTS:
1. Use ONLY information from the uploaded file
2. Generate exactly ${count} questions (or all questions if file has fewer)
3. Number as 1:, 2:, 3:, etc.
4. Use A., B., C., D. with periods
5. Mark ONE correct answer with * before the letter
6. EXACTLY 4 options per question
7. One blank line between questions
8. DO NOT invent information not in the file

LENGTH REQUIREMENT: ${lengthNote}`;

                requestBody = {
                    topic: topic || 'File Content',
                    count: count,
                    difficulty: difficulty,
                    length: length,
                    fileData: this.uploadedFileData,
                    prompt: prompt
                };
            } else {
                // Text-based generation
                prompt = `Generate EXACTLY ${count} multiple choice questions about "${topic}" at ${difficulty} difficulty level. ${complexityNote} ${lengthNote}

    CRITICAL FORMATTING RULES:

    1: [Write the complete question here]
    A. [First option]
    B. [Second option]
    C. [Third option]
    *D. [Correct answer with asterisk]

    2: [Write the complete question here]
    *A. [Correct answer with asterisk]
    B. [Second option]
    C. [Third option]
    D. [Fourth option]

    REQUIREMENTS:
    1. Generate ALL ${count} questions - DO NOT STOP EARLY
    2. Number questions as 1:, 2:, 3:, etc.
    3. Use A., B., C., D. for options (with periods)
    4. Mark ONLY ONE correct answer with * before letter
    5. Each question MUST have EXACTLY 4 options
    6. Leave ONE blank line between questions
    7. COMPLETE ALL ${count} QUESTIONS`;

                requestBody = {
                    topic: topic,
                    count: count,
                    difficulty: difficulty,
                    length: length,
                    prompt: prompt
                };
            }

            console.log('Calling Netlify Function...');
            
            // Call Netlify Function instead of direct API
            const response = await fetch('/.netlify/functions/generate-questions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            console.log('Response status:', response.status);

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Function Error Response:', errorData);
                throw new Error(errorData.error || `Function Error: ${response.status}`);
            }

            const data = await response.json();
            console.log('Function Success!');

            if (data.questions) {
                let generatedText = data.questions;

                // Clean up markdown formatting
                generatedText = generatedText.replace(/```[\s\S]*?\n/g, '');
                generatedText = generatedText.replace(/```/g, '');
                generatedText = generatedText.trim();

                // Check completion
                const questionCount = (generatedText.match(/^\d+:/gm) || []).length;
                console.log(`Generated ${questionCount} out of ${count} questions`);

                if (questionCount < parseInt(count)) {
                    this.showToast(`⚠️ Generated ${questionCount}/${count} questions. Try regenerating.`, 'warning');
                }

                document.getElementById('geminiOutput').value = generatedText;
                document.getElementById('geminiResult').style.display = 'block';

                // Switch button sections
                document.getElementById('geminiInitialButtons').style.display = 'none';
                document.getElementById('geminiResultButtons').style.display = 'block';

                this.hideLoading();
                this.showToast('✨ Questions generated successfully!', 'success');
            } else {
                console.error('Unexpected response structure:', data);
                throw new Error('No questions in response');
            }
        } catch (error) {
            this.hideLoading();
            console.error('Generation Error:', error);

            let errorMessage = error.message;
            if (errorMessage.includes('API_KEY_INVALID')) {
                errorMessage = 'Invalid API Key. Please check your key.';
            } else if (errorMessage.includes('PERMISSION_DENIED')) {
                errorMessage = 'API Key has no permission. Enable Gemini API.';
            } else if (errorMessage.includes('RESOURCE_EXHAUSTED')) {
                errorMessage = 'Rate limit exceeded. Please wait.';
            }

            this.showToast(`❌ ${errorMessage}`, 'error');
        }
    }

    useGeminiQuestions() {
        const generatedText = document.getElementById('geminiOutput').value;
        document.getElementById('questionsInput').value = generatedText;
        this.closeGeminiModal();
        
        // Always show questions input when adding generated questions
        document.getElementById('questionsInputGroup').style.display = 'block';
        
        // Scroll to questions input
        document.getElementById('questionsInput').scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        this.showToast('✅ Questions added to input box!', 'success');
    }

    clearQuestionsInput() {
        const questionsInput = document.getElementById('questionsInput').value.trim();
        
        if (!questionsInput) {
            // Already empty, just hide
            document.getElementById('questionsInputGroup').style.display = 'none';
            return;
        }
        
        if (confirm('Clear all questions in the input box?')) {
            document.getElementById('questionsInput').value = '';
            document.getElementById('questionsInputGroup').style.display = 'none';
            this.showToast('Questions cleared', 'info');
        }
    }

    clearEditQuestionsInput() {
        const editQuestionsInput = document.getElementById('editQuestionsInput').value.trim();
        
        if (!editQuestionsInput) {
            // Already empty, do nothing
            return;
        }
        
        if (confirm('Clear questions in this input box?')) {
            document.getElementById('editQuestionsInput').value = '';
            this.handleEditQuestionsInputChange(); // Update save button state
            this.showToast('Questions cleared', 'info');
        }
    }

    clearGeminiQuestions() {
        if (confirm('Are you sure you want to clear the generated questions?')) {
            document.getElementById('geminiOutput').value = '';
            document.getElementById('geminiResult').style.display = 'none';
            
            // Switch back to generate button
            document.getElementById('geminiInitialButtons').style.display = 'block';
            document.getElementById('geminiResultButtons').style.display = 'none';
            
            this.showToast('Questions cleared', 'info');
        }
    }

    async regenerateQuestions() {
        if (confirm('Regenerate questions with the same settings?')) {
            // Clear previous output first
            document.getElementById('geminiOutput').value = '';
            
            // Call generate again with existing settings
            await this.generateWithGemini();
        }
    }
}
const app = new QuizMasterApp();
