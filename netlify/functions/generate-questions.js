// netlify/functions/generate-questions.js
const fetch = require('node-fetch'); // Kailangan ito para gumana ang fetch sa Node.js

exports.handler = async (event, context) => {
  // 1. Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    // 2. Parse request body
    const { topic, count, difficulty, length, fileData, prompt } = JSON.parse(event.body);

    // 3. Get API key from environment variable
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error('GEMINI_API_KEY not found');
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'API key not configured sa Netlify' })
      };
    }

    // 4. Build request for Gemini API
    let parts = [];
    if (fileData) {
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
      parts = [{ text: prompt }];
    }

    // 5. Call Gemini API (Inayos ang URL sa gemini-1.5-flash)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: parts }],
        generationConfig: {
          temperature: 0.8,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
        },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
        ]
      })
    });

    // 6. Handle HTTP errors mula sa Google
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Gemini API Error:', errorData);
      return {
        statusCode: response.status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: errorData.error?.message || 'Failed to generate questions' 
        })
      };
    }

    const data = await response.json();

    // 7. Extract generated text and return JSON
    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      const generatedText = data.candidates[0].content.parts[0].text;

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*' // Para iwas CORS issue
        },
        body: JSON.stringify({ 
          questions: generatedText,
          metadata: {
            topic: topic || 'File Content',
            count: count,
            difficulty: difficulty,
            length: length
          }
        })
      };
    } else {
      console.error('Unexpected API response structure:', JSON.stringify(data));
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'No content in API response. Baka na-block ng Safety Filters.' })
      };
    }

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Server Error: ' + (error.message || 'Internal server error') 
      })
    };
  }
};
