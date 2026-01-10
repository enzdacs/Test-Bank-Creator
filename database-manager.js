// database-manager.js
class DatabaseManager {
    constructor() {
        this.userId = null;
    }

    setUser(userId) {
        this.userId = userId;
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

    // Create share code for test bank
    async createShareCode(bankKey, bankData) {
        if (!this.userId) throw new Error('User not logged in');

        try {
            const shareCode = this.generateShareCode();
            
            await db.collection('sharedBanks').doc(shareCode).set({
                bankKey: bankKey,
                bankData: bankData,
                createdBy: this.userId,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                expiresAt: firebase.firestore.Timestamp.fromDate(
                    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
                )
            });

            return shareCode;
        } catch (error) {
            console.error('Create share code error:', error);
            throw error;
        }
    }

    // Import from share code
    async importFromShareCode(shareCode) {
        if (!this.userId) throw new Error('User not logged in');

        try {
            const cleanCode = shareCode.replace('QM-', '');
            const shareDoc = await db.collection('sharedBanks').doc(cleanCode).get();

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
}

const dbManager = new DatabaseManager();