const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }
    if (!GEMINI_API_KEY) {
        return { statusCode: 500, body: 'Server Error: API Key not configured.' };
    }

    try {
        const { topic, count, difficulty } = JSON.parse(event.body);

        const prompt = `Generate ${count} multiple choice questions about "${topic}" at ${difficulty} difficulty level. 
        
Format each question EXACTLY like this:
Q1: [Question text here]
A. [Option 1]
B. [Option 2]
C. [Option 3]
*D. [Correct answer - mark with asterisk]

Q2: [Next question]
A. [Option 1]
*B. [Correct answer]
C. [Option 3]
D. [Option 4]

IMPORTANT RULES:
- Mark the correct answer with * before the letter
- Each question must have exactly 4 options (A, B, C, D)
- Separate questions with a blank line
- Make questions clear and educational
- Ensure correct answers are accurate`;

        const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }]
            })
        });

        const data = await response.json();
        
        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        };

    } catch (error) {
        console.error('Function execution error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to process request on the server.', details: error.message }),
        };
    }
};
