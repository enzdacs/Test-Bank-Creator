// auth-manager.js
class AuthManager {
    constructor() {
        this.currentUser = null;
    }

    // Convert username to email format for Firebase
    usernameToEmail(username) {
        return `${username.toLowerCase()}@quizmaster.app`;
    }

    // Extract username from email
    emailToUsername(email) {
        return email.replace('@quizmaster.app', '');
    }

    // Sign up new user
    async signUp(username, password) {
        try {
            // Validate username
            if (username.length < 3) {
                throw new Error('Username must be at least 3 characters');
            }

            if (!/^[a-zA-Z0-9_]+$/.test(username)) {
                throw new Error('Username can only contain letters, numbers, and underscores');
            }

            // Convert username to email
            const email = this.usernameToEmail(username);

            // Create user in Firebase Auth
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // Store username in Firestore
            await db.collection('users').doc(user.uid).set({
                username: username,
                email: email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                testBanks: {},
                notes: {}
            });

            this.currentUser = user;
            return user;
        } catch (error) {
            console.error('Sign up error:', error);
            
            // Handle specific Firebase errors
            if (error.code === 'auth/email-already-in-use') {
                throw new Error('Username already taken');
            } else if (error.code === 'auth/weak-password') {
                throw new Error('Password should be at least 6 characters');
            } else if (error.code === 'auth/invalid-email') {
                throw new Error('Invalid username format');
            } else {
                throw new Error(error.message || 'Failed to create account');
            }
        }
    }

    // Sign in existing user
    async signIn(username, password) {
        try {
            // Convert username to email
            const email = this.usernameToEmail(username);

            // Sign in with Firebase Auth
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;

            this.currentUser = user;
            return user;
        } catch (error) {
            console.error('Sign in error:', error);
            
            // Handle specific Firebase errors
            if (error.code === 'auth/user-not-found') {
                throw new Error('Username not found');
            } else if (error.code === 'auth/wrong-password') {
                throw new Error('Incorrect password');
            } else if (error.code === 'auth/invalid-email') {
                throw new Error('Invalid username');
            } else if (error.code === 'auth/too-many-requests') {
                throw new Error('Too many failed attempts. Please try again later');
            } else {
                throw new Error(error.message || 'Failed to log in');
            }
        }
    }

    // Sign out
    async signOut() {
        try {
            await auth.signOut();
            this.currentUser = null;
        } catch (error) {
            console.error('Sign out error:', error);
            throw new Error('Failed to sign out');
        }
    }

    // Get current username
    async getCurrentUsername() {
        try {
            if (!this.currentUser && auth.currentUser) {
                this.currentUser = auth.currentUser;
            }

            if (!this.currentUser) {
                throw new Error('No user logged in');
            }

            // Get username from Firestore
            const userDoc = await db.collection('users').doc(this.currentUser.uid).get();
            
            if (userDoc.exists) {
                return userDoc.data().username;
            } else {
                // Fallback: extract from email
                return this.emailToUsername(this.currentUser.email);
            }
        } catch (error) {
            console.error('Get username error:', error);
            // Fallback: extract from email if available
            if (this.currentUser && this.currentUser.email) {
                return this.emailToUsername(this.currentUser.email);
            }
            throw error;
        }
    }

    // Update username
    async updateUsername(newUsername) {
        try {
            if (!this.currentUser && auth.currentUser) {
                this.currentUser = auth.currentUser;
            }

            if (!this.currentUser) {
                throw new Error('No user logged in');
            }

            // Validate username
            if (newUsername.length < 3) {
                throw new Error('Username must be at least 3 characters');
            }

            if (!/^[a-zA-Z0-9_]+$/.test(newUsername)) {
                throw new Error('Username can only contain letters, numbers, and underscores');
            }

            // Check if username is already taken
            const newEmail = this.usernameToEmail(newUsername);
            const methods = await auth.fetchSignInMethodsForEmail(newEmail);
            
            if (methods.length > 0 && newEmail !== this.currentUser.email) {
                throw new Error('Username already taken');
            }

            // Update email in Firebase Auth
            await this.currentUser.updateEmail(newEmail);

            // Update username in Firestore
            await db.collection('users').doc(this.currentUser.uid).update({
                username: newUsername,
                email: newEmail,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            return true;
        } catch (error) {
            console.error('Update username error:', error);
            
            if (error.code === 'auth/email-already-in-use') {
                throw new Error('Username already taken');
            } else if (error.code === 'auth/requires-recent-login') {
                throw new Error('Please log out and log in again before changing username');
            } else {
                throw new Error(error.message || 'Failed to update username');
            }
        }
    }

    // Update password
    async updatePassword(currentPassword, newPassword) {
        try {
            if (!this.currentUser && auth.currentUser) {
                this.currentUser = auth.currentUser;
            }

            if (!this.currentUser) {
                throw new Error('No user logged in');
            }

            // Validate new password
            if (newPassword.length < 6) {
                throw new Error('Password must be at least 6 characters');
            }

            // Re-authenticate user with current password
            const credential = firebase.auth.EmailAuthProvider.credential(
                this.currentUser.email,
                currentPassword
            );
            
            await this.currentUser.reauthenticateWithCredential(credential);

            // Update password
            await this.currentUser.updatePassword(newPassword);

            return true;
        } catch (error) {
            console.error('Update password error:', error);
            
            if (error.code === 'auth/wrong-password') {
                throw new Error('Current password is incorrect');
            } else if (error.code === 'auth/weak-password') {
                throw new Error('New password is too weak');
            } else {
                throw new Error(error.message || 'Failed to update password');
            }
        }
    }

    // Delete account
    async deleteAccount(password) {
        try {
            if (!this.currentUser && auth.currentUser) {
                this.currentUser = auth.currentUser;
            }

            if (!this.currentUser) {
                throw new Error('No user logged in');
            }

            // Re-authenticate user
            const credential = firebase.auth.EmailAuthProvider.credential(
                this.currentUser.email,
                password
            );
            
            await this.currentUser.reauthenticateWithCredential(credential);

            const userId = this.currentUser.uid;

            // Delete user data from Firestore
            await db.collection('users').doc(userId).delete();

            // Delete shared banks created by this user
            const sharedBanks = await db.collection('sharedBanks')
                .where('createdBy', '==', userId)
                .get();
            
            const batch = db.batch();
            sharedBanks.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();

            // Delete user account from Firebase Auth
            await this.currentUser.delete();

            this.currentUser = null;
            return true;
        } catch (error) {
            console.error('Delete account error:', error);
            
            if (error.code === 'auth/wrong-password') {
                throw new Error('Incorrect password');
            } else if (error.code === 'auth/requires-recent-login') {
                throw new Error('Please log out and log in again before deleting account');
            } else {
                throw new Error(error.message || 'Failed to delete account');
            }
        }
    }

    // Get current user ID
    getCurrentUserId() {
        if (auth.currentUser) {
            return auth.currentUser.uid;
        }
        return null;
    }

    // Check if user is logged in
    isLoggedIn() {
        return auth.currentUser !== null;
    }
}

// Create global instance
const authManager = new AuthManager();