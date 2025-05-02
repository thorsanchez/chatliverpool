//web server for Liverpool FC Chatbot
const express = require('express');
const cors = require('cors');
const path = require('path');
const { BM25Retriever, generateResponse, loadData, chunkData } = require('./chatbot');

// Initialize Express app
const app = express();

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Serve the UI HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Initialize the chatbot
let retriever = null;
let chunks = [];

// Load and initialize data
function initChatbot() {
  try {
    // Read data from file
    const data = loadData('liverpool_data.txt');
    
    // Split data into chunks
    chunks = chunkData(data);
    
    // Initialize BM25 retriever
    retriever = new BM25Retriever();
    retriever.addDocuments(chunks);
    
    console.log(`Initialized chatbot with ${chunks.length} chunks of data`);
    return true;
  } catch (error) {
    console.error('Error initializing chatbot:', error);
    return false;
  }
}

// API endpoint for chat
app.post('/api/chat', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    // Initialize chatbot if not already initialized
    if (!retriever) {
      const success = initChatbot();
      if (!success) {
        return res.status(500).json({ error: 'Failed to initialize chatbot' });
      }
    }
    
    // Get response from chatbot
    const retrievedDocs = retriever.search(query);
    const response = await generateResponse(query, retrievedDocs);
    
    // Send response to client
    res.json({ response });
    
  } catch (error) {
    console.error('Error processing chat request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Open your browser and go to http://localhost:${PORT} to use the chatbot`);
  
  // Initialize chatbot on startup
  initChatbot();
});