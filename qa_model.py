# qa_model.py
from transformers import pipeline
import sys
import json

pipe = pipeline("question-answering", model="distilbert-base-cased-distilled-squad")

question = sys.argv[1]
context = sys.argv[2]

result = pipe(question=question, context=context)
#answer
print(json.dumps(result)) 
