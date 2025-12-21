// const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

// exports.handler = async (event) => {
//     if (event.httpMethod !== 'POST') {
//         return { statusCode: 405, body: 'Method Not Allowed' };
//     }
//     if (!GEMINI_API_KEY) {
//         return { statusCode: 500, body: 'Server Error: API Key not configured.' };
//     }

//     try {
//         const { topic, count, difficulty } = JSON.parse(event.body);

//         const prompt = `Generate ${count} multiple choice questions about "${topic}" at ${difficulty} difficulty level. 
        
// Format each question EXACTLY like this:
// Q1: [Question text here]
// A. [Option 1]
// B. [Option 2]
// C. [Option 3]
// *D. [Correct answer - mark with asterisk]

// Q2: [Next question]
// A. [Option 1]
// *B. [Correct answer]
// C. [Option 3]
// D. [Option 4]

// IMPORTANT RULES:
// - Mark the correct answer with * before the letter
// - Each question must have exactly 4 options (A, B, C, D)
// - Separate questions with a blank line
// - Make questions clear and educational
// - Ensure correct answers are accurate`;

//         const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
//             method: 'POST',
//             headers: {
//                 'Content-Type': 'application/json',
//             },
//             body: JSON.stringify({
//                 contents: [{
//                     parts: [{ text: prompt }]
//                 }]
//             })
//         });

//         const data = await response.json();
        
//         return {
//             statusCode: 200,
//             headers: { "Content-Type": "application/json" },
//             body: JSON.stringify(data)
//         };

//     } catch (error) {
//         console.error('Function execution error:', error);
//         return {
//             statusCode: 500,
//             body: JSON.stringify({ error: 'Failed to process request on the server.', details: error.message }),
//         };
//     }
// };

// Version 7.1

const fetch = require('node-fetch');

exports.handler = async (event) => {
    // Only allow POST requests
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    try {
        const { topic, count, difficulty, length, fileData } = JSON.parse(event.body);
        
        // This is pulled securely from Netlify Environment Variables
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return { 
                statusCode: 500, 
                body: JSON.stringify({ error: "API Key not configured in Netlify Settings." }) 
            };
        }

        // Logic for complexity and length notes (preserving your original logic)
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
        let parts = [];

        // Build the prompt based on whether a file was uploaded or a topic was entered
        if (fileData) {
            // File-based generation logic (Exactly as per your original code)
            prompt = `CRITICAL INSTRUCTION: You MUST use ONLY the content from the uploaded file. DO NOT generate questions from your own knowledge.
            ANALYZE THE FILE AND:
            1. IF FILE CONTAINS QUESTIONS WITHOUT MULTIPLE CHOICE: Create 4 options and mark correct with *
            2. IF FILE CONTAINS STUDY MATERIALS: Extract concepts and generate ${count} questions strictly from file
            3. IF FILE HAS COMPLETE MULTIPLE CHOICE: Format as numbered 1: A. B. C. *D.

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

            parts = [
                {
                    inline_data: {
                        mime_type: fileData.mimeType,
                        data: fileData.data
                    }
                },
                { text: prompt }
            ];
        } else {
            // Text-based generation logic (Exactly as per your original code)
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

            parts = [{ text: prompt }];
        }

        // Call the Gemini API
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: parts }],
                generationConfig: {
                    temperature: 0.8,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 8192,
                    candidateCount: 1,
                },
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
                ]
            })
        });

        const data = await response.json();

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        };

    } catch (error) {
        console.error("Function error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Failed to process request on the server." })
        };
    }
};
