// database-manager.js
class DatabaseManager {
    constructor() {
        this.userId = null;
    }

    setUser(userId) {
        this.userId = userId;
        console.log('DatabaseManager: userId set to', userId);
    }

    // Save test banks to Firebase
    async saveTestBanks(testBanks) {
        if (!this.userId) throw new Error('User not logged in');

        try {
            const userDocRef = db.collection('users').doc(this.userId);
            await userDocRef.update({
                testBanks: testBanks,
                lastModified: firebase.firestore.FieldValue.serverTimestamp()
            });
            return { success: true };
        } catch (error) {
            console.error('Save test banks error:', error);
            throw error;
        }
    }

    // Load test banks from Firebase
    async loadTestBanks() {
        if (!this.userId) throw new Error('User not logged in');

        try {
            const userDoc = await db.collection('users').doc(this.userId).get();
            if (userDoc.exists) {
                const data = userDoc.data();
                return data.testBanks || {};
            }
            return {};
        } catch (error) {
            console.error('Load test banks error:', error);
            throw error;
        }
    }

    // Save notes to Firebase
    async saveNotes(notes) {
        if (!this.userId) throw new Error('User not logged in');

        try {
            const userDocRef = db.collection('users').doc(this.userId);
            await userDocRef.update({
                notes: notes,
                lastModified: firebase.firestore.FieldValue.serverTimestamp()
            });
            return { success: true };
        } catch (error) {
            console.error('Save notes error:', error);
            throw error;
        }
    }

    // Load notes from Firebase
    async loadNotes() {
        if (!this.userId) throw new Error('User not logged in');

        try {
            const userDoc = await db.collection('users').doc(this.userId).get();
            if (userDoc.exists) {
                const data = userDoc.data();
                return data.notes || {};
            }
            return {};
        } catch (error) {
            console.error('Load notes error:', error);
            throw error;
        }
    }

    // Create share code for test bank or note
    async createShareCode(bankKey, bankData, type = 'testbank') {
        if (!this.userId) throw new Error('User not logged in');

        try {
            const shareCode = this.generateShareCode();
            const collection = type === 'note' ? 'sharedNotes' : 'sharedBanks';
            
            await db.collection(collection).doc(shareCode).set({
                bankKey: bankKey,
                bankData: bankData,
                createdBy: this.userId,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                expiresAt: firebase.firestore.Timestamp.fromDate(
                    new Date(Date.now() + 60 * 60 * 1000) // 1 hour
                )
            });

            return shareCode;
        } catch (error) {
            console.error('Create share code error:', error);
            throw error;
        }
    }

    // Import from share code (test bank or note)
    async importFromShareCode(shareCode, type = 'testbank') {
        if (!this.userId) throw new Error('User not logged in');

        try {
            const cleanCode = shareCode.replace(/^QM-(NOTE-)?/, '');
            const collection = type === 'note' ? 'sharedNotes' : 'sharedBanks';
            const shareDoc = await db.collection(collection).doc(cleanCode).get();

            if (!shareDoc.exists) {
                throw new Error('Invalid or expired share code');
            }

            const data = shareDoc.data();
            
            // Check if expired
            if (data.expiresAt.toDate() < new Date()) {
                throw new Error('Share code has expired');
            }

            return {
                bankKey: data.bankKey,
                bankData: data.bankData
            };
        } catch (error) {
            console.error('Import share code error:', error);
            throw error;
        }
    }

    // Generate random share code
    generateShareCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        let code = '';
        for (let i = 0; i < 32; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    // Sanitize bank key for use as Firestore document ID
    // Firestore document IDs cannot contain: / \ . or start with __
    sanitizeBankKey(bankKey) {
        // Replace problematic characters with underscores
        return bankKey.replace(/[\/\\\.]/g, '_');
    }

    // Save quiz progress
    async saveQuizProgress(bankKey, quizState) {
        console.log('saveQuizProgress called with:', { bankKey, quizState, userId: this.userId });
        
        if (!this.userId) {
            console.error('No userId set in dbManager');
            throw new Error('User not logged in');
        }

        try {
            // Sanitize the bank key for Firestore
            const sanitizedKey = this.sanitizeBankKey(bankKey);
            console.log('Original key:', bankKey, '-> Sanitized key:', sanitizedKey);
            
            const savedQuizData = {
                bankKey: bankKey,  // Store original key in data
                sanitizedKey: sanitizedKey,  // Also store sanitized version
                currentIndex: quizState.currentIndex,
                answers: quizState.answers,
                startTime: quizState.startTime,
                immediateMode: quizState.immediateMode,
                savedAt: firebase.firestore.FieldValue.serverTimestamp(),
                totalQuestions: quizState.totalQuestions
            };

            console.log('Attempting to save to path:', `users/${this.userId}/savedQuizzes/${sanitizedKey}`);
            console.log('Data to save:', savedQuizData);

            const docRef = db.collection('users').doc(this.userId)
                .collection('savedQuizzes').doc(sanitizedKey);
            
            await docRef.set(savedQuizData);
            
            console.log('Quiz progress saved successfully');
            return { success: true };
        } catch (error) {
            console.error('Save quiz progress error:', error);
            console.error('Error code:', error.code);
            console.error('Error message:', error.message);
            throw new Error(`Failed to save quiz: ${error.message}`);
        }
    }

    // Load saved quiz progress for a specific bank
    async loadQuizProgress(bankKey) {
        console.log('loadQuizProgress called with:', { bankKey, userId: this.userId });
        
        if (!this.userId) {
            console.error('No userId set in dbManager');
            throw new Error('User not logged in');
        }

        try {
            // Sanitize the bank key
            const sanitizedKey = this.sanitizeBankKey(bankKey);
            console.log('Loading with sanitized key:', sanitizedKey);
            console.log('Attempting to load from path:', `users/${this.userId}/savedQuizzes/${sanitizedKey}`);
            
            const quizDoc = await db.collection('users').doc(this.userId)
                .collection('savedQuizzes').doc(sanitizedKey).get();

            console.log('Document exists:', quizDoc.exists);
            
            if (quizDoc.exists) {
                const data = quizDoc.data();
                console.log('Loaded quiz data:', data);
                return data;
            }
            
            console.log('No saved quiz found for this bank');
            return null;
        } catch (error) {
            console.error('Load quiz progress error:', error);
            console.error('Error code:', error.code);
            console.error('Error message:', error.message);
            throw new Error(`Failed to load quiz: ${error.message}`);
        }
    }

    // Delete saved quiz progress
    async deleteQuizProgress(bankKey) {
        if (!this.userId) throw new Error('User not logged in');

        try {
            const sanitizedKey = this.sanitizeBankKey(bankKey);
            console.log('Deleting quiz with sanitized key:', sanitizedKey);
            
            await db.collection('users').doc(this.userId)
                .collection('savedQuizzes').doc(sanitizedKey).delete();
            return { success: true };
        } catch (error) {
            console.error('Delete quiz progress error:', error);
            throw error;
        }
    }

    // Get all saved quizzes
    async getAllSavedQuizzes() {
        if (!this.userId) throw new Error('User not logged in');

        try {
            const snapshot = await db.collection('users').doc(this.userId)
                .collection('savedQuizzes').get();
            
            const savedQuizzes = {};
            snapshot.forEach(doc => {
                savedQuizzes[doc.id] = doc.data();
            });
            
            return savedQuizzes;
        } catch (error) {
            console.error('Get saved quizzes error:', error);
            throw error;
        }
    }
}

const dbManager = new DatabaseManager();
