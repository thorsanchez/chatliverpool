// This is my Liverpool FC premier league 2024/25 season Chatbot
// it uses BM25 to find info, matches patterns for common questions and uses QA model for other stuff

const fs = require('fs');
const readline = require('readline');
const { execSync } = require('child_process');


//load stuff from text file
function loadData(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return data;
  } catch (error) {
    console.error('Error loading data:', error.message);
    process.exit(1);
  }
}

// Split data into chunks (paragraphs)
function chunkData(data) {
  //Im splitting by big sections first
  const sections = data.split(/\n\n+(?=[A-Z][A-Z\s]+\n|COMMON QUESTIONS|Player Statistics|Tactical and Managerial Insights|Injuries and Squad Fitness|Transfer Activity|Squad Selection|Media and Fan Commentary)/);
  
  let chunks = [];
  
  // Process each part
  sections.forEach(section => {
    if (section.length > 500) {
      if (section.includes('Match Summaries')) {
        // breaking matches by date
        const matchChunks = section.split(/\n(?=\d{1,2} [A-Z][a-z]{2} – )/);
        chunks.push(matchChunks[0]);
        chunks = chunks.concat(matchChunks.slice(1));
      } else if (section.startsWith('COMMON QUESTIONS')) {
        const qaChunks = section.split(/\n\n+(?=Who|What|How|Has|When)/);
        chunks = chunks.concat(qaChunks);
      } else if (section.startsWith('PLAYER INFORMATION') || section.startsWith('Player Statistics')) {
        const playerChunks = section.split(/\n\n+(?=Player:|[A-Z][a-z]+\s[A-Z][a-z]+:)$/);
        chunks.push(playerChunks[0]);
        chunks = chunks.concat(playerChunks.slice(1));
      } else {
        const subChunks = section.split(/\n\n+/);
        chunks = chunks.concat(subChunks);
      }
    } else {
      chunks.push(section);
    }
  });
  
  return chunks.map(chunk => chunk.trim()).filter(chunk => chunk.length > 0);
}

// Fix query to match better
function preprocessQuery(query) {
  //Replace pronouns with real names and expand short forms
  let processed = query.toLowerCase()
    .replace(/\bthey\b|\btheir\b|\bit\b/g, 'liverpool')
    .replace(/\bpl\b/g, 'premier league')
    .replace(/\bepl\b/g, 'premier league')
    .replace(/\blfc\b/g, 'liverpool')
    .replace(/\breds\b/g, 'liverpool')
    .replace(/\bthe reds\b/g, 'liverpool')
    .replace(/\bfirst\b/g, 'liverpool first');
  
  //add some common question stuff
  if (processed.includes('how many points') || processed.includes('points')) {
    processed += ' liverpool points premier league table standings';
  }
  
  if (processed.includes('position') || (processed.includes('where') && processed.includes('league'))) {
    processed += ' liverpool position premier league table standings';
  }
  
  if (processed.includes('top scorer') || processed.includes('most goals')) {
    processed += ' liverpool goals scorer salah';
  }
  
  if (processed.includes('match') || processed.includes('game') || processed.includes('fixture')) {
    processed += ' liverpool match result';
  }
  
  return processed;
}

//implementing Bm25 

//basic for finding relevant info
class BM25Retriever {
  constructor(k1 = 1.5, b = 0.75) {
    this.documents = [];
    this.avgDocLength = 0;
    this.docFreq = {};
    this.k1 = k1; 
    this.b = b;
  }

  // process text
  preprocess(text) {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(term => term.length > 1);
  }

  // Add docs to the retriever
  addDocuments(documents) {
    this.documents = documents;
    
    //calculate the average doc length
    const totalLength = documents.reduce((sum, doc) => sum + this.preprocess(doc).length, 0);
    this.avgDocLength = totalLength / documents.length;
    
    // figure out doc frequency for each term
    documents.forEach(doc => {
      const terms = [...new Set(this.preprocess(doc))];
      terms.forEach(term => {
        this.docFreq[term] = (this.docFreq[term] || 0) + 1;
      });
    });
  }

// Search for documents matching the query
search(query, topK = 5) {
  const processedQuery = preprocessQuery(query);
  const queryTerms = this.preprocess(processedQuery);
  
  const scores = this.documents.map((doc, idx) => {
    const docTerms = this.preprocess(doc);
    const docLength = docTerms.length;
    
    // Calculate score for this document
    let score = 0;
    
    queryTerms.forEach(term => {
      // Skip terms not in any document
      if (!this.docFreq[term]) return;
      
      // Calculate term frequency in document
      const tf = docTerms.filter(t => t === term).length;
      if (tf === 0) return;
      
      //idf calculations
      const idf = Math.log(
        (this.documents.length - this.docFreq[term] + 0.5) / 
        (this.docFreq[term] + 0.5) + 1
      );
      
      // Calculate Bm25 score
      const numerator = tf * (this.k1 + 1);
      const denominator = tf + this.k1 * (1 - this.b + this.b * docLength / this.avgDocLength);
      score += idf * (numerator / denominator);
      
      // Boost score for competition matches
      if (processedQuery.includes('premier league') && 
          doc.toLowerCase().includes('premier league')) {
        score *= 1.5;
      }
      
      // boost score (skal prøve 50% først, kanskje bytte senere) for match queries with important terms
      const isMatchQuery = processedQuery.includes('match') || 
                          processedQuery.includes('game') || 
                          processedQuery.includes('result');
                          
      const hasMatchIndicators = doc.toLowerCase().includes('–') || 
                                doc.toLowerCase().includes('-') ||
                                doc.toLowerCase().includes('win') || 
                                doc.toLowerCase().includes('draw') ||
                                doc.toLowerCase().includes('defeat');
      
      if (isMatchQuery && hasMatchIndicators) {
        score *= 1.5;
        
        // Take potential team names from query
        const queryWords = processedQuery.split(/\s+/);
        const uniqueTerms = queryWords.filter(word => 
          !['match', 'game', 'result', 'how', 'did', 'the', 'go', 
           'play', 'against', 'win', 'lose', 'draw', 'liverpool'].includes(word) && 
          word.length > 3
        );
        
        //boost for potential team names
        for (const uniqueTerm of uniqueTerms) {
          if (docTerms.includes(uniqueTerm)) {
            score *= 1.5; // Boost for matching unique terms
          }
        }
      }
      
      //Boost score for player queries
      const playerNames = ['salah', 'van dijk', 'alisson', 'trent', 'diaz', 'nunez', 'jota', 
                         'szoboszlai', 'mac allister', 'gravenberch', 'jones'];
      
      playerNames.forEach(player => {
        if (processedQuery.includes(player) && docTerms.includes(player)) {
          score *= 1.5;
        }
      });
    });
    
    return { idx, score };
  });
  
  // Sort by score and return top K
  return scores
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(item => this.documents[item.idx]);
  }
}

//QA Model

// Get good answer from context using the QA model
async function extractAnswerSpan(question, context) {
  try {
    // Make sure question and context are properly formatted
    const cleanQuestion = question.replace(/"/g, '\\"');
    const cleanContext = context.replace(/"/g, '\\"');
    
    // limit context size to avoid problems with huge contexts
    const limitedContext = cleanContext.substring(0, 4000);
    
    // Call the Python QA model
    const output = execSync(`python3 qa_model.py "${cleanQuestion}" "${limitedContext}"`).toString();
    const result = JSON.parse(output);
    
    // If answer is tiny (like just a number), add context
    if (result.answer && result.answer.length < 5 && result.score > 0.1) {
      const queryLower = question.toLowerCase();
      
      if (queryLower.includes('goals') && queryLower.includes('salah')) {
        return {
          answer: `Mohamed Salah scored ${result.answer} goals in the 2024/25 Premier League season.`,
          confidence: result.score
        };
      }
      
      if (queryLower.includes('assists') && queryLower.includes('salah')) {
        return {
          answer: `Mohamed Salah provided ${result.answer} assists in the 2024/25 Premier League season.`,
          confidence: result.score
        };
      }
      
      if (queryLower.includes('points')) {
        return {
          answer: `Liverpool has ${result.answer} points in the 2024/25 Premier League season.`,
          confidence: result.score
        };
      }
    }
    
    return {
      answer: result.answer,
      confidence: result.score,
    };
  } catch (error) {
    console.error('Error with QA model:', error.message);
    return {
      answer: context.substring(0, 200) + '...',
      confidence: 0,
    };
  }
}

//pattern matching

//to answer the common question

// Check if question matches common patterns and give direct answer
function getDirectAnswer(query) {
  const queryLower = query.toLowerCase();
  
  // Direct answers for common stats questions
  if (queryLower.includes('how many goals') && queryLower.includes('salah')) {
    return "Mohamed Salah scored 27 goals in the 2024/25 Premier League season.";
  }
  
  if (queryLower.includes('how many assists') && queryLower.includes('salah')) {
    return "Mohamed Salah provided 18 assists in the 2024/25 Premier League season.";
  }
  
  if (queryLower.includes('how many points') || 
      (queryLower.includes('points') && queryLower.includes('liverpool'))) {
    return "Liverpool has 79 points in the 2024/25 Premier League season.";
  }
  
  if (queryLower.includes('position') || 
      (queryLower.includes('where') && queryLower.includes('league'))) {
    return "Liverpool is at the top of the Premier League table with a significant lead over second-placed Arsenal.";
  }
  
  if (queryLower.includes('who') && queryLower.includes('manager')) {
    return "Arne Slot is Liverpool's manager for the 2024/25 season. He replaced Jürgen Klopp, who stepped down at the end of the 2023/24 season.";
  }
  
  if (queryLower.includes('who') && queryLower.includes('captain')) {
    return "Virgil van Dijk is Liverpool's captain for the 2024/25 season.";
  }
  
  if (queryLower.includes('clean sheets')) {
    return "Liverpool has kept 15 clean sheets in the 2024/25 Premier League season.";
  }
  
  if (queryLower.includes('where') && 
      (queryLower.includes('home') || queryLower.includes('stadium'))) {
    return "Liverpool plays their home games at Anfield Stadium.";
  }
  
  if (queryLower.includes('how many games') && 
      (queryLower.includes('won') || queryLower.includes('win'))) {
    return "Liverpool has won 28 matches in the 2024/25 Premier League season.";
  }
  
  if (queryLower.includes('score') && queryLower.includes('tottenham')) {
    return "Liverpool beat Tottenham 6-3 in one of the most exciting matches of the season. Salah scored a hat-trick in this game.";
  }
  
  if (queryLower.includes('goal difference')) {
    return "Liverpool has a goal difference of +55, having scored 85 goals and conceded 30 in the Premier League.";
  }
  
  // If not a common question want to use QA model
  return null;
}

// convo handling

//to chekc if query is saying hi
function isGreeting(query) {
  const greetings = ['hi', 'hello', 'hey', 'greetings', 'good morning', 'good afternoon', 'good evening'];
  return greetings.some(greeting => 
    query.toLowerCase().trim() === greeting || 
    query.toLowerCase().trim().startsWith(greeting + ' '));
}

//if query is about leaving
function isExit(query) {
  const exitPhrases = ['bye', 'exit', 'quit', 'goodbye', 'see you'];
  return exitPhrases.some(phrase => query.toLowerCase().includes(phrase));
}

// if query is asking how the chatbot feels
function isHowAreYou(query) {
  const phrases = ['how are you', 'how do you feel', 'how are things', 'what\'s up'];
  return phrases.some(phrase => query.toLowerCase().includes(phrase));
}

// if query is asking about what the chatbot is
function isAboutBot(query) {
  const phrases = ['who are you', 'what are you', 'what can you do', 'help'];
  return phrases.some(phrase => query.toLowerCase().includes(phrase));
}

// If this is a real question
function isRealQuestion(query) {
  const q = query.trim().toLowerCase();
  
  // see if it's a question by how it's made
  if (q.endsWith('?') || q.startsWith('who') || q.startsWith('what') || 
      q.startsWith('when') || q.startsWith('how') || q.startsWith('has') || 
      q.startsWith('did') || q.startsWith('is') || q.startsWith('was') ||
      q.startsWith('where') || q.startsWith('will') || q.startsWith('can')) {
    return true;
  }
  
  // to see if it has words that mean it's about Liverpool
  const liverpoolKeywords = ['liverpool', 'points', 'goals', 'position', 'match', 'game', 
                            'score', 'win', 'lose', 'salah', 'van dijk', 'title', 'players',
                            'trent', 'slot', 'premier league'];
  
  for (const keyword of liverpoolKeywords) {
    if (q.includes(keyword)) {
      return true;
    }
  }
  
  return false;
}

//the most exact answer for a question
function findSpecificAnswer(query, retrievedDocs) {
  const queryLower = query.toLowerCase();
  
  // For points and table position questions
  if (queryLower.includes('points') || queryLower.includes('how many points')) {
    const pointsDoc = retrievedDocs.find(doc => 
      doc.toLowerCase().includes('points') && 
      doc.toLowerCase().includes('liverpool')
    );
    if (pointsDoc) return pointsDoc;
  }
  
  // For position questions
  if (queryLower.includes('position') || queryLower.includes('standings') || 
      queryLower.includes('where') && queryLower.includes('league')) {
    const positionDoc = retrievedDocs.find(doc => 
      doc.toLowerCase().includes('position') || 
      doc.toLowerCase().includes('top of the') || 
      doc.toLowerCase().includes('lead at the top')
    );
    if (positionDoc) return positionDoc;
  }
  
  // For match result questions
  if (queryLower.includes('match') || queryLower.includes('game') || 
      queryLower.includes('result') || queryLower.includes('how did')) {
    const matchDoc = retrievedDocs.find(doc => 
      doc.toLowerCase().includes('match') && 
      doc.toLowerCase().includes('liverpool')
    );
    if (matchDoc) return matchDoc;
  }
  
  // For competition-specific questions
  if (queryLower.includes('premier league')) {
    const plDoc = retrievedDocs.find(doc => 
      doc.toLowerCase().includes('premier league')
    );
    if (plDoc) return plDoc;
  }
  
  // For player-specific questions
  const playerNames = ['salah', 'van dijk', 'alisson', 'alexander-arnold', 'trent', 'diaz', 'nunez', 'jota'];
  for (const player of playerNames) {
    if (queryLower.includes(player)) {
      const playerDoc = retrievedDocs.find(doc => 
        doc.toLowerCase().includes(player)
      );
      if (playerDoc) return playerDoc;
    }
  }
  
  // For questions about specific matches or stats
  if (queryLower.includes('last match') || queryLower.includes('last game')) {
    const lastMatchDoc = retrievedDocs.find(doc => 
      doc.toLowerCase().includes('last match played')
    );
    if (lastMatchDoc) return lastMatchDoc;
  }
  
  // For title/win questions
  if (queryLower.includes('win') || queryLower.includes('title') || 
      queryLower.includes('champion') || queryLower.includes('trophy')) {
    const winDoc = retrievedDocs.find(doc => 
      doc.toLowerCase().includes('title') || 
      doc.toLowerCase().includes('win') || 
      doc.toLowerCase().includes('champion')
    );
    if (winDoc) return winDoc;
  }
  
  // For common questions
  const commonQuestionsDoc = retrievedDocs.find(doc => 
    doc.toLowerCase().includes('how many games') ||
    doc.toLowerCase().includes('how many goals')
  );
  
  if (commonQuestionsDoc) {
    return commonQuestionsDoc;
  }
  
  // If nothing else matches, return the first doc
  return retrievedDocs[0];
}

// make response based on retrieved info and question type
async function generateResponse(query, retrievedDocs) {
  // Handle conversation patterns
  if (isGreeting(query)) {
    return "Hello! I'm the Liverpool FC chatbot. I can answer your questions about Liverpool's 2024/25 season. How can I help you today?";
  }
  
  if (isExit(query)) {
    return "Thanks for chatting! YNWA (You'll Never Walk Alone)! Goodbye!";
  }
  
  if (isHowAreYou(query)) {
    return "I'm doing great, thanks for asking! Always excited to talk about Liverpool FC. What would you like to know about the 2024/25 season?";
  }
  
  if (isAboutBot(query)) {
    return "I'm a chatbot that knows about Liverpool FC's 2024/25 season. You can ask me about matches, players, results, and statistics. What would you like to know?";
  }

  // Handle general questions
  if (!isRealQuestion(query)) {
    return "I'm not sure what you mean. Try asking something like 'Who is the top scorer?' or 'How many goals has Salah scored?' or 'What position is Liverpool in the league?'";
  }
  
  // No docs found
  if (retrievedDocs.length === 0) {
    return "I'm sorry, I don't have information about that. I only know about Liverpool FC's 2024/25 season. You can ask about matches, players, or statistics.";
  }
  
  // First, check if it's a common question with a direct answer
  const directAnswer = getDirectAnswer(query);
  if (directAnswer) {
    return directAnswer;
  }
  
  // Find the best doc
  const bestContext = findSpecificAnswer(query, retrievedDocs);
  
  // Get specific answer using QA model
  try {
    const { answer, confidence } = await extractAnswerSpan(query, bestContext);
    
    // If confidence is too low, or answer is too long, make it shorter
    if (confidence < 0.1 || answer.length > 500) {
      // Create a shorter summary for long chunks
      if (bestContext.length > 300) {
        const firstSentences = bestContext.split('.').slice(0, 3).join('.') + '.';
        return firstSentences;
      }
      return bestContext.substring(0, 300);
    }
    
    // If answer is too short, might not be useful
    if (answer.length < 5 && !answer.match(/\d+/)) {
      return bestContext.substring(0, 200);
    }
    
    return answer;
  } catch (error) {
    // Use summarized context if QA model fails
    console.error('QA model error, using context:', error);
    return bestContext.substring(0, 250) + '...';
  }
}

// Main

// Main function to run the chatbot
async function main() {
  console.log("\n===== Liverpool FC 2024/25 Season Chatbot =====");
  console.log("Ask me anything about Liverpool's 2024/25 season!");
  console.log("Type 'exit' or 'bye' to quit.\n");
  
  // Load and process data
  const data = loadData('liverpool_data.txt');
  const chunks = chunkData(data);
  
  // Start BM25 retriever
  const retriever = new BM25Retriever();
  retriever.addDocuments(chunks);
  
  // Setup console interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  // Start conversation loop
  askQuestion();
  
  function askQuestion() {
    rl.question('You: ', async (query) => {
      // Exit condition
      if (isExit(query)) {
        console.log("Bot: Thanks for chatting! YNWA (You'll Never Walk Alone)! Goodbye!");
        rl.close();
        return;
      }
      
      // Process query and get response
      const retrievedDocs = retriever.search(query);
      const response = await generateResponse(query, retrievedDocs);
      
      console.log(`Bot: ${response}\n`);
      
      // Keep talking
      askQuestion();
    });
  }
}

// Run the app if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Error running chatbot:', error);
    process.exit(1);
  });
}

// Export for testing and web server
module.exports = { BM25Retriever, generateResponse, loadData, chunkData, extractAnswerSpan };