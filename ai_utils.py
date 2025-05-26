import os
import json
import random
import nltk
from nltk.tokenize import sent_tokenize, word_tokenize
from collections import Counter
import re
import requests  # We'll use requests for OpenRouter API calls

# Download NLTK data packages (unchanged)
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt')

try:
    nltk.data.find('corpora/stopwords')
except LookupError:
    nltk.download('stopwords')

try:
    from nltk.corpus import stopwords
    stopwords.words('english')
except:
    nltk.download('stopwords')

# OpenRouter configuration
OPENROUTER_API_KEY = "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"  
OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
DEEPSEEK_R1 = "deepseek/deepseek-r1:free"

# Headers for OpenRouter API
headers = {
    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
    "Content-Type": "application/json",
}

def extract_key_terms(text):
    """Extract key terms from a text using NLTK."""
    try:
        # Tokenize text
        sentences = sent_tokenize(text)
        words = [word.lower() for sent in sentences for word in word_tokenize(sent)]
        
        # Remove stopwords and non-alphanumeric tokens
        from nltk.corpus import stopwords
        stop_words = set(stopwords.words('english'))
        words = [word for word in words if word.isalnum() and word not in stop_words]
        
        # Count word frequencies
        word_freq = Counter(words)
        
        # Return top 10 most frequent words as key terms
        key_terms = [word for word, _ in word_freq.most_common(10)]
        return key_terms
    except Exception as e:
        print(f"Error extracting key terms: {str(e)}")
        return ["term1", "term2", "term3", "term4", "term5"]

'''def query_openrouter(prompt, system_message, response_format=None, max_tokens=1000):
    """Generic function to query OpenRouter API."""
    payload = {
        "model": DEEPSEEK_R1,
        "messages": [
            {"role": "system", "content": system_message},
            {"role": "user", "content": prompt}
        ],
        "max_tokens": max_tokens
    }
    
    if response_format:
        payload["response_format"] = response_format
    
    try:
        response = requests.post(OPENROUTER_API_URL, headers=headers, json=payload)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Error querying OpenRouter: {str(e)}")
        return None'''



def query_openrouter(prompt, system_message, model="deepseek/deepseek-r1:free", response_format=None, max_tokens=1000):
    """Generic function to query OpenRouter API."""
    import requests
    import json
    import os

    # Configuration
    OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
    OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "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")
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:5000",
        "X-Title": "AI Study Partner"
    }

    if not OPENROUTER_API_KEY:
        print("Error: OPENROUTER_API_KEY not set")
        return None

    # Validate inputs
    if not isinstance(prompt, str):
        print(f"Error: prompt must be a string, got {type(prompt)}")
        return None
    if not isinstance(system_message, str):
        print(f"Error: system_message must be a string, got {type(system_message)}")
        return None
    if not isinstance(model, str):
        print(f"Error: model must be a string, got {type(model)}")
        return None

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_message},
            {"role": "user", "content": prompt}
        ],
        "max_tokens": max_tokens
    }
    
    if response_format:
        payload["response_format"] = response_format
    
    try:
        print(f"Querying OpenRouter with model: {model}")
        print(f"Payload (truncated): {json.dumps({k: v if k != 'messages' else [{'role': m['role'], 'content': m['content'][:50] + '...'} for m in v] for k, v in payload.items()}, indent=2)}")
        response = requests.post(OPENROUTER_API_URL, headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        
        content_type = response.headers.get("Content-Type", "")
        if "application/json" not in content_type:
            print(f"Error: Non-JSON response received: {response.text}")
            return None
        
        response_data = response.json()
        print(f"OpenRouter response: {json.dumps(response_data, indent=2)}")
        
        if not response_data or 'choices' not in response_data or not response_data['choices']:
            print("Error: Empty or invalid response structure")
            return None
        
        return response_data
    
    except requests.exceptions.HTTPError as e:
        print(f"HTTP error querying OpenRouter: {str(e)}")
        if 'response' in locals():
            print(f"Response content: {response.text}")
        return None
    except requests.exceptions.Timeout:
        print("Error: Request to OpenRouter timed out")
        return None
    except requests.exceptions.RequestException as e:
        print(f"Network error querying OpenRouter: {str(e)}")
        return None
    except ValueError as e:
        print(f"JSON decode error in OpenRouter response: {str(e)}")
        if 'response' in locals():
            print(f"Response content: {response.text}")
        return None
    except Exception as e:
        print(f"Unexpected error querying OpenRouter: {str(e)}")
        raise


'''def generate_flashcards(text, topic):
    """Generate flashcards from text using DeepSeek R1."""
    try:
        # Extract key terms for context
        key_terms = extract_key_terms(text)
        
        prompt = f"""
        Create 5 educational flashcards from the following text about {topic}.
        Focus on the key terms: {', '.join(key_terms)}.
        
        Format each flashcard as a JSON object with 'question' and 'answer' fields.
        Return an array of these flashcard objects.
        
        Text: {text}
        """
        
        response = query_openrouter(
            prompt=prompt,
            system_message="You are an educational content expert that creates high-quality flashcards.",
            response_format={"type": "json_object"},
            max_tokens=1000
        )
        
        if not response:
            raise Exception("Failed to get response from OpenRouter")
        
        result = response['choices'][0]['message']['content']
        
        # Parse the JSON content if it's a string
        if isinstance(result, str):
            result = json.loads(result)
        
        if isinstance(result, dict) and 'flashcards' in result:
            flashcards = result['flashcards']
        elif isinstance(result, list):
            flashcards = result
        else:
            # Try to find any list in the response that might contain flashcards
            for key in result:
                if isinstance(result[key], list) and len(result[key]) > 0:
                    flashcards = result[key]
                    break
            else:
                raise ValueError("Unexpected response format")
                
        return flashcards
    except Exception as e:
        print(f"Error generating flashcards: {str(e)}")
        # Fallback to create basic flashcards
        return [
            {"question": f"What is {term}?", "answer": f"Important concept related to {topic}."}
            for term in key_terms[:5]
        ]'''




def generate_flashcards(text, topic):
    """Generate flashcards from text using OpenRouter models."""
    import re
    import json
    import nltk
    import time

    # Ensure NLTK punkt_tab resource is available
    try:
        nltk.data.find('tokenizers/punkt_tab')
    except LookupError:
        print("Downloading NLTK punkt_tab resource...")
        nltk.download('punkt_tab', quiet=True)

    # Truncate text to 3000 characters
    text = text[:3000]
    models = ["deepseek/deepseek-r1:free", "meta-llama/llama-3.1-8b-instruct:free"]
    max_retries = 2

    for model in models:
        for attempt in range(max_retries):
            try:
                # Extract key terms
                key_terms = extract_key_terms(text)
                print(f"Model: {model}, Attempt {attempt + 1}: Extracted key terms: {key_terms}")
                
                # Minimal prompt
                prompt = """
                Create 5 flashcards about {topic} based on: {text}
                Focus on: {key_terms_str}.
                Return a JSON array of 5 objects with 'question' and 'answer' strings.
                Example:
                [
                    {{"question": "What is X?", "answer": "X is..."}},
                    {{"question": "Define Y", "answer": "Y is..."}},
                    {{"question": "What does Z do?", "answer": "Z does..."}},
                    {{"question": "What is W?", "answer": "W is..."}},
                    {{"question": "Explain V", "answer": "V is..."}}
                ]
                """.format(
                    topic=topic,
                    key_terms_str=', '.join(key_terms[:5]),
                    text=text
                )
                
                print(f"Model: {model}, Attempt {attempt + 1}: Sending prompt (length: {len(prompt)} characters)")
                
                response = query_openrouter(
                    prompt=prompt,
                    system_message="You are an expert creating concise educational flashcards.",
                    model=model,
                    response_format={"type": "json_object"},
                    max_tokens=1000
                )
                
                if not response or 'choices' not in response or not response['choices']:
                    print(f"Model: {model}, Attempt {attempt + 1}: Empty or invalid response from OpenRouter")
                    if attempt < max_retries - 1:
                        time.sleep(1)
                        continue
                    raise ValueError("Failed to get valid response from OpenRouter")
                
                result = response['choices'][0]['message']['content']
                print(f"Model: {model}, Attempt {attempt + 1}: Raw OpenRouter response: {result}")
                
                if not result.strip():
                    print(f"Model: {model}, Attempt {attempt + 1}: Response is empty or whitespace")
                    if attempt < max_retries - 1:
                        time.sleep(1)
                        continue
                    raise ValueError("Empty response from OpenRouter")
                
                # Clean response
                result = result.strip()
                result = re.sub(r"^```(?:json)?\s*|\s*```$", "", result, flags=re.IGNORECASE)
                result = re.sub(r"^[^\[\{]*", "", result, 1)
                match = re.search(r'\[\s*(?:\{.*?\}\s*,?\s*)*\]', result, re.DOTALL)
                if not match:
                    print(f"Model: {model}, Attempt {attempt + 1}: Cleaned result (no JSON array found): {result}")
                    if attempt < max_retries - 1:
                        time.sleep(1)
                        continue
                    raise ValueError("No valid JSON array found in response")
                
                result = match.group(0)
                print(f"Model: {model}, Attempt {attempt + 1}: Extracted JSON array: {result}")
                
                # Parse JSON
                try:
                    flashcards = json.loads(result)
                except json.JSONDecodeError as json_err:
                    print(f"Model: {model}, Attempt {attempt + 1}: JSON decode error: {json_err}")
                    print(f"Model: {model}, Attempt {attempt + 1}: Raw cleaned result: {result}")
                    if attempt < max_retries - 1:
                        time.sleep(1)
                        continue
                    raise ValueError("Failed to parse JSON from model response")
                
                # Validate flashcards
                if not isinstance(flashcards, list):
                    print(f"Model: {model}, Attempt {attempt + 1}: Response is not a JSON array: {flashcards}")
                    if attempt < max_retries - 1:
                        time.sleep(1)
                        continue
                    raise ValueError("Response is not a JSON array")
                
                if len(flashcards) != 5:
                    print(f"Model: {model}, Attempt {attempt + 1}: Warning: Expected 5 flashcards, got {len(flashcards)}")
                
                for card in flashcards:
                    if not isinstance(card, dict):
                        raise ValueError(f"Flashcard is not a JSON object: {card}")
                    if not all(key in card for key in ["question", "answer"]):
                        raise ValueError(f"Missing required keys in flashcard: {card}")
                    if not all(isinstance(card[key], str) for key in ["question", "answer"]):
                        raise ValueError(f"Invalid field types in flashcard: {card}")
                
                print(f"Model: {model}, Attempt {attempt + 1}: Successfully generated {len(flashcards)} flashcards")
                return flashcards
            
            except json.JSONDecodeError as e:
                print(f"Model: {model}, Attempt {attempt + 1}: JSON parsing error: {str(e)}")
                if attempt < max_retries - 1:
                    time.sleep(1)
                    continue
            except Exception as e:
                print(f"Model: {model}, Attempt {attempt + 1}: Error generating flashcards: {str(e)}")
                if attempt < max_retries - 1:
                    time.sleep(1)
                    continue
            
            print(f"Model: {model} failed after {max_retries} attempts, trying next model")
            break
    
    print("All models failed, returning fallback flashcards")
    return [
        {"question": f"What is {term}?", "answer": f"Important concept related to {topic}."}
        for term in (key_terms[:5] if 'key_terms' in locals() else ["term1", "term2", "term3", "term4", "term5"])
    ]




'''def generate_quiz(topic, difficulty=3, num_questions=5, context_text=None):
    """Generate a quiz with questions, multiple-choice options, and explanations."""
    try:
        prompt = f"""
        Create a multiple-choice quiz about "{topic}" using the following content: 
        {context_text or "Use your general knowledge if no content is provided."} with {num_questions} questions at difficulty level {difficulty}/5.
        
        For each question, provide:
        1. A question
        2. Four answer options (A, B, C, D)
        3. The correct answer letter
        4. A brief explanation of why the answer is correct
        
        Return the result as a *pure* JSON array. Do NOT include markdown formatting or code blocks like ```json. Return the result ONLY as a pure JSON array (no Markdown, no intro text). Return ONLY a JSON array of question objects. Do not include markdown or any commentary.
        Each object must have:
        - "question": string
        - "options": list of 4 strings
        - "correct_answer": "A" | "B" | "C" | "D"
        - "explanation": string

        JSON output only:
        """
        
        response = query_openrouter(
            prompt=prompt,
            system_message="You are an educational content creator specializing in quiz generation.",
            response_format={"type": "json_object"},
            max_tokens=100000
        )
        
        if not response:
            raise Exception("Failed to get response from OpenRouter")


        result = response['choices'][0]['message']['content']

        # --- Clean Markdown-style code block wrappers like ```json ... ``` ---
        if result.strip().startswith("```"):
            result = re.sub(r"^```(?:json)?\s*|\s*```$", "", result.strip(), flags=re.IGNORECASE)

        # --- Try to parse cleaned JSON ---
        try:
            result = json.loads(result)
        except json.JSONDecodeError as json_err:
            print("JSON decode error:", json_err)
            print("Raw cleaned result:", result)
            raise Exception("Failed to parse JSON from model response")
        
        # --- CLEAN OPTIONS ---
        def clean_option_text(option):
            return re.sub(r'^[A-Da-d][\.\)]\s*', '', option.strip())

        
        # Extract questions from the response
        if isinstance(result, dict) and 'questions' in result:
            questions = result['questions']
        elif isinstance(result, list):
            questions = result
        else:
            # Try to find any list in the response that might contain questions
            for key in result:
                if isinstance(result[key], list) and len(result[key]) > 0:
                    questions = result[key]
                    break
            else:
                raise ValueError("Unexpected response format")
            
        # --- CLEAN OPTIONS BEFORE RETURN ---
        for q in questions:
            if "options" in q and isinstance(q["options"], list):
                q["options"] = [clean_option_text(opt) for opt in q["options"]]
        
        return questions
    except Exception as e:
        print(f"Error generating quiz: {str(e)}")
        # Fallback to create basic quiz
        return [
            {
                "question": f"Question {i+1} about {topic}?",
                "options": [f"Option A", f"Option B", f"Option C", f"Option D"],
                "correct_answer": "A",
                "explanation": f"This is the correct answer because of concepts related to {topic}."
            }
            for i in range(min(num_questions, 3))
        ]'''

'''def generate_quiz(topic, difficulty=3, num_questions=5, context_text=None):
    try:
        prompt = f"""
        Create a multiple-choice quiz about "{topic}" using the following content: 
        {context_text or "Use your general knowledge if no content is provided."} with {num_questions} questions at difficulty level {difficulty}/5.
        
        For each question, provide:
        1. A question
        2. Four answer options (A, B, C, D)
        3. The correct answer letter
        4. A brief explanation of why the answer is correct
        
        Return the result as a *pure* JSON array. Do NOT include markdown formatting or code blocks like ```json. Return the result ONLY as a pure JSON array (no Markdown, no intro text). Return ONLY a JSON array of question objects. Do not include markdown or any commentary.
        Each object must have:
        - "question": string
        - "options": list of 4 strings
        - "correct_answer": "A" | "B" | "C" | "D"
        - "explanation": string

        JSON output only:
        """
        
        response = query_openrouter(
            prompt=prompt,
            system_message="You are an educational content creator specializing in quiz generation.",
            response_format={"type": "json_object"},
            max_tokens=100000
        )
        
        if not response:
            raise Exception("Failed to get response from OpenRouter")

        result = response['choices'][0]['message']['content']

        # Clean Markdown-style code block wrappers and unexpected prefixes
        result = result.strip()
        if result.startswith("```"):
            result = re.sub(r"^```(?:json)?\\s*|\s*```$", "", result, flags=re.IGNORECASE)
        # Remove any non-JSON prefix (e.g., "tune")
        result = re.sub(r"^[^\[\{]*", "", result, 1)
        # Extract the first valid JSON array if multiple are present
        match = re.search(r'\[.*?\](?=\s*\[|$)', result, re.DOTALL)
        if match:
            result = match.group(0)
        else:
            raise ValueError("No valid JSON array found in response")

        # Parse JSON
        try:
            questions = json.loads(result)
        except json.JSONDecodeError as json_err:
            print("JSON decode error:", json_err)
            print("Raw cleaned result:", result)
            raise Exception("Failed to parse JSON from model response")
        
        # Clean options
        def clean_option_text(option):
            return re.sub(r'^[A-Da-d][\.\)]\s*', '', option.strip())
        
        for q in questions:
            if "options" in q and isinstance(q["options"], list):
                q["options"] = [clean_option_text(opt) for opt in q["options"]]
        
        return questions
    except Exception as e:
        print(f"Error generating quiz: {str(e)}")
        return [
            {
                "question": f"Question {i+1} about {topic}?",
                "options": [f"Option A", f"Option B", f"Option C", f"Option D"],
                "correct_answer": "A",
                "explanation": f"This is the correct answer because of concepts related to {topic}."
            }
            for i in range(min(num_questions, 3))
        ]'''

def generate_quiz(topic, difficulty=3, num_questions=5, context_text=None):
    import re
    import json

    try:
        prompt = f"""
        Create a multiple-choice quiz about "{topic}" using the following content: 
        {context_text or "Use your general knowledge if no content is provided."} with {num_questions} questions at difficulty level {difficulty}/5.
        
        For each question, provide:
        1. A question
        2. Four answer options (A, B, C, D)
        3. The correct answer letter
        4. A brief explanation of why the answer is correct
        
        Return the result as a *pure* JSON array. Do NOT include markdown formatting or code blocks like ```json. Return the result ONLY as a pure JSON array (no Markdown, no intro text). Return ONLY a JSON array of question objects. Do not include markdown or any commentary.
        Each object must have:
        - "question": string
        - "options": list of 4 strings
        - "correct_answer": "A" | "B" | "C" | "D"
        - "explanation": string

        JSON output only:
        """
        
        response = query_openrouter(
            prompt=prompt,
            system_message="You are an educational content creator specializing in quiz generation.",
            response_format={"type": "json_object"},
            max_tokens=100000
        )
        
        if not response:
            raise Exception("Failed to get response from OpenRouter")

        result = response['choices'][0]['message']['content']
        import sys
        print(f"Raw OpenRouter response: {result}".encode(sys.stdout.encoding or "utf-8", errors="replace").decode())
 # Log raw response for debugging

        # Clean response
        result = result.strip()
        # Remove Markdown code block wrappers
        result = re.sub(r"^```(?:json)?\s*|\s*```$", "", result, flags=re.IGNORECASE)
        # Remove any non-JSON prefix
        result = re.sub(r"^[^\[\{]*", "", result, 1)
        # Extract the first complete JSON array, accounting for nested structures
        match = re.search(r'\[\s*(?:\{.*?\}\s*,?\s*)*\]', result, re.DOTALL)
        if not match:
            print(f"Cleaned result (no JSON array found): {result}")
            raise ValueError("No valid JSON array found in response")
        result = match.group(0)
        print(f"Extracted JSON array: {result}")  # Log extracted array

        # Parse JSON
        try:
            questions = json.loads(result)
        except json.JSONDecodeError as json_err:
            print("JSON decode error:", json_err)
            print("Raw cleaned result:", result)
            raise Exception("Failed to parse JSON from model response")
        
        # Validate questions
        if not isinstance(questions, list):
            raise ValueError("Response is not a JSON array")
        for q in questions:
            if not isinstance(q, dict):
                raise ValueError("Question is not a JSON object")
            required_keys = ["question", "options", "correct_answer", "explanation"]
            if not all(key in q for key in required_keys):
                raise ValueError(f"Missing required keys in question: {q}")
            if not isinstance(q["options"], list) or len(q["options"]) != 4:
                raise ValueError(f"Invalid options format in question: {q}")
            if q["correct_answer"] not in ["A", "B", "C", "D"]:
                raise ValueError(f"Invalid correct_answer in question: {q}")

        # Clean options
        def clean_option_text(option):
            return re.sub(r'^[A-Da-d][\.\)]\s*', '', option.strip())
        
        for q in questions:
            q["options"] = [clean_option_text(opt) for opt in q["options"]]
        
        return questions
    except Exception as e:
        print(f"Error generating quiz: {str(e)}")
        return [
            {
                "question": f"Question {i+1} about {topic}?",
                "options": ["Option A", "Option B", "Option C", "Option D"],
                "correct_answer": "A",
                "explanation": f"This is the correct answer because of concepts related to {topic}."
            }
            for i in range(min(num_questions, 3))
        ]

def ask_ai_tutor(question, context=""):
    """Get an answer from the AI tutor chatbot."""
    try:
        prompt = f"""
        As an educational AI tutor, please answer the following question:
        
        Question: {question}
        
        {f'Context: {context}' if context else ''}
        
        Provide a clear, accurate, and educational response suitable for a student.
        Include explanations of concepts and examples where helpful.
        """
        
        response = query_openrouter(
            prompt=prompt,
            system_message="You are a helpful and educational AI tutor. Provide clear, accurate information and explanations to help students learn.",
            max_tokens=100000
        )
        
        if not response:
            raise Exception("Failed to get response from OpenRouter")
        
        return response['choices'][0]['message']['content']
    except Exception as e:
        print(f"Error getting AI tutor response: {str(e)}")
        return "I'm sorry, I'm having trouble generating a response right now. Please try again later."

# The following functions remain unchanged as they don't use the AI
def adjust_quiz_difficulty(previous_performance, current_difficulty):
    """Adjust quiz difficulty based on previous performance."""
    if previous_performance >= 90:
        return min(current_difficulty + 1, 5)
    elif previous_performance >= 70:
        return current_difficulty
    else:
        return max(current_difficulty - 1, 1)

def analyze_study_habits(topic_times, quiz_scores, flashcard_mastery):
    """Analyze study habits and provide recommendations."""
    try:
        topics_data = ", ".join([f"{topic}: {minutes} minutes" for topic, minutes in topic_times.items()])
        avg_quiz_score = sum(quiz_scores) / len(quiz_scores) if quiz_scores else 0
        mastery_percentage = flashcard_mastery * 100
        
        prompt = f"""
        Analyze the following study data and provide personalized recommendations:
        
        Time spent on topics: {topics_data}
        Average quiz score: {avg_quiz_score:.1f}%
        Flashcard mastery: {mastery_percentage:.1f}%
        
        Provide 3-5 specific, actionable recommendations to improve study habits based on this data.
        Format your response as a JSON object with an array of recommendation strings.
        """
        
        response = query_openrouter(
            prompt=prompt,
            system_message="You are an educational analytics expert who provides personalized study recommendations.",
            response_format={"type": "json_object"},
            max_tokens=600
        )
        
        if not response:
            raise Exception("Failed to get response from OpenRouter")
        
        result = response['choices'][0]['message']['content']
        
        # Parse the JSON content if it's a string
        if isinstance(result, str):
            result = json.loads(result)
            
        if isinstance(result, dict) and 'recommendations' in result:
            return result['recommendations']
        elif isinstance(result, list):
            return result
        else:
            # Try to find any list in the response
            for key in result:
                if isinstance(result[key], list):
                    return result[key]
            return ["Balance your study time across all topics.", 
                    "Review flashcards more frequently to improve retention.", 
                    "Focus on improving quiz performance with practice questions."]
    except Exception as e:
        print(f"Error analyzing study habits: {str(e)}")
        return ["Balance your study time across all topics.", 
                "Review flashcards more frequently to improve retention.", 
                "Focus on improving quiz performance with practice questions."]