// results.js - Evaluation script for Liverpool FC Chatbot
const { BM25Retriever, generateResponse, loadData, chunkData } = require('./chatbot');

// Simple evaluation function
async function evaluateChatbot() {
  // Test questions and expected answers (gold standard)
  const testQuestions = [
    { query: "How many goals has Salah scored in the 2024/25 premier league season?", expectedAnswer: "27" },
    { query: "Where on the table is Liverpool currenlty in the league?", expectedAnswer: "1st" },
    { query: "Who is Liverpool's captain?", expectedAnswer: "Van Dijk" },
    { query: "How did the Liverpool vs Manchester United game go?", expectedAnswer: "won" },
    { query: "How many points does Liverpool currently have?", expectedAnswer: "79" },
    { query: "Who is the manager of Liverpool?", expectedAnswer: "Slot" },
    { query: "How many assists does Salah have?", expectedAnswer: "18" },
    { query: "Which month did Liverpool play their firest game against Chelsea?", expectedAnswer: "October" },
    { query: "How many clean sheets does Liverpool have this season?", expectedAnswer: "15" },
    { query: "What was the score against Tottenham?", expectedAnswer: "6-3" },
    { query: "How many games has Liverpool won this season?", expectedAnswer: "28" },
    { query: "How many games did Liverpool win in December?", expectedAnswer: "6" },
    { query: "Where does Liverpool play their home games?", expectedAnswer: "Anfield" },
    { query: "Who scored against Manchester City?", expectedAnswer: "Salah" },
    { query: "What is Liverpool's goal difference?", expectedAnswer: "44" }
  ];
  
  console.log("===== Liverpool FC Chatbot Evaluation =====");
  console.log(`Testing ${testQuestions.length} questions...\n`);
  
  // Load data and set up retriever
  const data = loadData('liverpool_data.txt');
  const chunks = chunkData(data);
  const retriever = new BM25Retriever();
  retriever.addDocuments(chunks);
  
  // Metrics tracking
  let correct = 0;
  let retrievalSuccess = 0;
  let qaAccuracy = 0;
  let totalTime = 0;
  let results = [];
  
  // Test each question
  for (const test of testQuestions) {
    console.log(`Q: ${test.query}`);
    
    // Measure response time
    const startTime = Date.now();
    
    // Get retrieved documents
    const retrievedDocs = retriever.search(test.query);
    
    // Check if retrieval found anything useful
    const hasRelevantDoc = retrievedDocs.length > 0 && 
                          retrievedDocs.some(doc => 
                            doc.toLowerCase().includes(test.expectedAnswer.toLowerCase()));
    
    if (hasRelevantDoc) retrievalSuccess++;
    
    // Get response
    const response = await generateResponse(test.query, retrievedDocs);
    
    // Calculate response time
    const endTime = Date.now();
    const responseTime = (endTime - startTime) / 1000; // in seconds
    totalTime += responseTime;
    
    console.log(`A: ${response}`);
    console.log(`Response time: ${responseTime.toFixed(2)} seconds`);
    
    // Check if answer contains the expected answer (simple check)
    const isCorrect = response.toLowerCase().includes(test.expectedAnswer.toLowerCase());
    if (isCorrect) correct++;
    
    // Check if QA model extracted correctly when documents contained the answer
    const qaCorrect = hasRelevantDoc && isCorrect;
    if (qaCorrect) qaAccuracy++;
    
    console.log(`Correct: ${isCorrect ? "Yes" : "No"}\n`);
    
    results.push({
      query: test.query,
      response: response,
      expectedAnswer: test.expectedAnswer,
      isCorrect: isCorrect,
      hasRelevantDoc: hasRelevantDoc,
      responseTime: responseTime
    });
  }
  
  // Calculate metrics
  const accuracy = (correct / testQuestions.length) * 100;
  const retrievalRate = (retrievalSuccess / testQuestions.length) * 100;
  const qaAccuracyRate = retrievalSuccess > 0 ? (qaAccuracy / retrievalSuccess) * 100 : 0;
  const avgResponseTime = totalTime / testQuestions.length;
  
  // Display results
  console.log("===== Results =====");
  console.log(`Accuracy: ${accuracy.toFixed(2)}% (${correct}/${testQuestions.length} correct)`);
  console.log(`Retrieval Success Rate: ${retrievalRate.toFixed(2)}%`);
  console.log(`Answer Extraction Accuracy: ${qaAccuracyRate.toFixed(2)}%`);
  console.log(`Average Response Time: ${avgResponseTime.toFixed(2)} seconds`);
  
  // Calculate metrics by question category
  const statQuestions = testQuestions.filter(q => 
    q.query.toLowerCase().includes("how many") || 
    q.query.toLowerCase().includes("score")
  );
  
  const statCorrect = results.filter((r, i) => 
    statQuestions.some(q => q.query === r.query) && r.isCorrect
  ).length;
  
  const statAccuracy = (statCorrect / statQuestions.length) * 100;
  console.log(`\nAccuracy for statistical questions: ${statAccuracy.toFixed(2)}%`);
  
  const matchQuestions = testQuestions.filter(q => 
    q.query.toLowerCase().includes("match") || 
    q.query.toLowerCase().includes("play") ||
    q.query.toLowerCase().includes("against")
  );
  
  const matchCorrect = results.filter((r, i) => 
    matchQuestions.some(q => q.query === r.query) && r.isCorrect
  ).length;
  
  const matchAccuracy = matchQuestions.length > 0 ? 
    (matchCorrect / matchQuestions.length) * 100 : 0;
  
  console.log(`Accuracy for match-related questions: ${matchAccuracy.toFixed(2)}%`);
  
  return {
    accuracy,
    retrievalRate,
    qaAccuracyRate,
    avgResponseTime,
    statAccuracy,
    matchAccuracy,
    results
  };
}

// Run evaluation if called directly
if (require.main === module) {
  evaluateChatbot().catch(error => {
    console.error('Error running evaluation:', error);
    process.exit(1);
  });
}

// Export for potential use in other scripts
module.exports = { evaluateChatbot };