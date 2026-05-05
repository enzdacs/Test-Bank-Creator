v1.26.2

# 📚 QuizMaster: AI-Powered Test Bank Creator

**QuizMaster** is a comprehensive educational platform designed for students and educators to streamline the process of creating, managing, and studying academic content[cite: 4, 8]. The project leverages **Gemini AI** to automate question generation and provides a robust suite of tools for performance tracking and note-taking[cite: 4, 8].

---

## ✨ Core Features

### 1. AI Question Generation
* **Smart Generation**: Utilize the built-in **Gemini AI** to create multiple-choice questions by simply providing a topic, subject, or difficulty level[cite: 4, 8].
* **File-to-Quiz**: Upload PDF, images, or text documents; the AI will analyze the content to generate questions strictly based on your uploaded study materials[cite: 4, 8].
* **Customizable Parameters**: Fine-tune your quizzes by selecting the number of questions, difficulty level (Easy, Medium, Hard), and the desired length of questions and answers[cite: 4, 8].

### 2. Comprehensive Test Bank Management
* **Bulk Creation**: Quickly create test banks by pasting questions in a standardized format[cite: 4, 8].
* **Advanced Editing**: Modify existing test banks, add new questions, or delete outdated content through an intuitive modal interface[cite: 4, 8].
* **Bank Search**: Easily navigate large collections of questions with a real-time search filter[cite: 4, 8].

### 3. Dynamic Quiz & Study Modes
* **Customizable Quizzes**: Set specific parameters for each session, including question count, timers, and shuffling for both questions and answer choices[cite: 4, 8].
* **Immediate Feedback**: Enable "Immediate Mode" to see the correct answer right after submitting your choice during a quiz[cite: 4, 8].
* **Study Mode (Flashcards)**: Transform your test banks into interactive flashcards for active recall, complete with shuffle and card-flipping mechanics[cite: 4, 8].
* **Progress Saving**: Save ongoing quizzes to continue them later, ensuring your study sessions are never lost[cite: 2, 8].

### 4. Rich-Text Study Notes
* **Integrated Editor**: Use the **TinyMCE** rich-text editor to create, format, and organize your study notes[cite: 4, 8].
* **Media Integration**: Support for importing images and viewing PDF notes directly within the application[cite: 4, 8].
* **Flexible Exporting**: Export your notes into multiple formats, including **PDF, DOCX, TXT, and HTML**[cite: 8].

### 5. Analytics & Performance Tracking
* **Visual Data**: Track your progress over time with Bar Charts and Pie Charts showing your score distributions[cite: 4, 8].
* **Detailed History**: Review every quiz attempt, including exact scores, percentages, and time durations for each test bank[cite: 8].
* **Insightful Reviews**: Access a question-by-question breakdown of your finished quizzes to see exactly where you went wrong[cite: 8].

---

## 🛠️ Technical Stack
* **Frontend**: HTML5, CSS3 (with responsive design), and Vanilla JavaScript[cite: 4, 9].
* **Backend & Storage**: **Firebase Authentication** for user accounts and **Firestore** for real-time database management[cite: 1, 2, 3].
* **AI Engine**: **Gemini AI API** integrated via Netlify Functions for secure, serverless question generation[cite: 6, 8].
* **Libraries**: 
    * **TinyMCE**: For professional note editing[cite: 4].
    * **jsPDF & html2pdf.js**: For high-quality PDF generation[cite: 4].

---

## 🔒 User Security
* **Personalized Accounts**: Secure sign-up and login system with case-sensitive username verification[cite: 1].
* **Cloud Sync**: All test banks and notes are automatically synced to your account, allowing access from any device[cite: 2, 8].
* **Collaborative Sharing**: Generate unique share codes to send test banks or notes to teammates for collaborative studying[cite: 2, 8].