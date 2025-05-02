# Liverpool FC 2024/25 Chatbot

This project is a simple chatbot that answers questions about Liverpool FC's 2024/25 season. You can run it either in the terminal or as a web application.

## Note

Due to time constraints and other exams, I wasn't able to complete this project to the level I originally intended. With more time, I would have refined the model and added more features.




## Requirements

- Node.js (version 14 or higher)
- Python (version 3.6 or higher)
- The following Python libraries:
  - transformers
  - torch

## Installation

1. Install Node.js dependencies:
```
npm install
```

2. Install Python dependencies:
```
pip install transformers torch
```

## Running the Chatbot

### Terminal Version

To run the chatbot in your terminal:

```
node cli.js
```

This will start the chatbot in your terminal. You can then type questions about Liverpool FC's 2024/25 season and get answers.

### Web Application Version

To run the chatbot as a web application:

```
node server-web.js
```

Then open your browser and go to: http://localhost:3000

You'll see a simple interface where you can type questions and get answers.
### Files Description
- `chatbot.js`: Core chatbot functionality
- `cli.js`: Command-line interface
- `server-web.js`: Web server for the web application
- `index.html`: Web interface
- `liverpool_data.txt`: Data about Liverpool FC's 2024/25 season
- `qa_model.py`: Python script for question answering
