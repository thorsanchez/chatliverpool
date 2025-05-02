// cli.js - Command line interface for Liverpool FC chatbot
const { BM25Retriever, generateResponse, loadData, chunkData } = require('./chatbot');
const readline = require('readline');

async function main() {
  console.log("\n===== Liverpool FC 2024/25 Season Chatbot =====");
  console.log("Ask me anything about Liverpool's 2024/25 season!");
  console.log("Type 'exit' or 'bye' to quit.\n");
  
  // Load and process data
  const data = loadData('liverpool_data.txt');
  const chunks = chunkData(data);
  
  // Initialize Bm25 retriever
  const retriever = new BM25Retriever();
  retriever.addDocuments(chunks);
  
  // Initialize readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  // Start conversation loop
  askQuestion();
  
  function askQuestion() {
    rl.question('You: ', async (query) => {
      // Exit condition
      if (query.toLowerCase().includes('exit') || 
          query.toLowerCase().includes('bye') || 
          query.toLowerCase().includes('quit')) {
        console.log("Bot: Thanks for chatting! YNWA (You'll Never Walk Alone)! Goodbye!");
        rl.close();
        return;
      }
      
      // Process the query and get a response
      const retrievedDocs = retriever.search(query);
      const response = await generateResponse(query, retrievedDocs);
      
      console.log(`Bot: ${response}\n`);
      
      // Continue the conversation
      askQuestion();
    });
  }
}

// Run the chatbot
main().catch(error => {
  console.error('Error running chatbot:', error);
  process.exit(1);
});

