"""
server.py - Handles the server-side logic for loading the model and evaluating responses.

Semantic Similarity Workflow
1. Loads the model when server.js is started.
2. Implements the /evaluate API:
   - Uses the loaded model to detect semantic similarity.
   - A threshold of 0.6 is set to determine correctness (response is correct if similarity >= 0.6).
   - The API returns not only a boolean (correct/false) but also the similarity score
3. Implements a very naive implementation of total score tracking:
   - Stores correctness results in a global list. The /get_results API retrieves this score data.
   - This approach is temporary and will break when multiple users interact with the system.

   
Scenario Workflow STT:
1. The user clicks the button "upload audio", which triggers the upload_audio API post request to send user response audio data to the backend
2. breaksdown the user response using Open AI Whisper, transcirbes into text
3. sends text transcription back to front end

Scenario Workflow LLM:
1. User records/types their question. then when clicking next prompt after uploading audio, it triggers the /llm_patient_response API
2. calls LLM API with user question, along with system prompt
3. sends audio of LLM response in base64 along with text transcript to client


/get_scenarios
Used to fetch all scenarios dynamically from the database in order to display on scenario selection page

/get_prompt
Used to fetch prompts based on unique scenario_id to display to user and facilitate the simulation

/llm_patient_response
Used to call LLM API to generate patient response to user question
"""


from flask import Flask, jsonify, request, redirect, send_file, after_this_request
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.sql.expression import asc
import os
import base64
from dotenv import load_dotenv
from flask_cors import CORS
import io
import numpy as np
import tempfile
from supabase_client import supabase
import jwt

# Azure AI OpenAI models:
from openai import AzureOpenAI

# Azure AI speech imports:
import azure.cognitiveservices.speech as speechsdk

# for model
from scipy.spatial import distance
from sentence_transformers import SentenceTransformer

# App instance
app = Flask(__name__)

# Configure CORS to allow requests from your frontend
CORS(app, resources={
    r"/*": {
        "origins": [
            "http://localhost:3000",
            "https://clinical-clarity.vercel.app"
        ],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# Load environment variables
load_dotenv()

# secret key for JWT to work
app.secret_key = os.environ.get("FLASK_SECRET_KEY")

# Determine if running in production
FLASK_ENV = os.environ.get("FLASK_ENV", "production")

# DB SETUP
# Set up the database URI (use environment variable)
db_url = os.environ.get('DATABASE_URL')

# Configure Supabase client with direct URL and key
supabase_url = os.environ.get('SUPABASE_URL')
supabase_key = os.environ.get('SUPABASE_KEY')

# Define models using Supabase API
class Scenario:
    @staticmethod
    def query():
        class Query:
            @staticmethod
            def all():
                response = supabase.table('scenarios').select('*').execute()
                return response.data
        return Query

    def __init__(self, **kwargs):
        for key, value in kwargs.items():
            setattr(self, key, value)

class Prompt:
    @staticmethod
    def query():
        class Query:
            @staticmethod
            def filter_by(scenario_id):
                response = supabase.table('prompts').select('*').eq('scenario_id', scenario_id).order('sequence_order').execute()
                return response.data
        return Query

    def __init__(self, **kwargs):
        for key, value in kwargs.items():
            setattr(self, key, value)

# load in sentence transformer model
model = SentenceTransformer('all-MiniLM-L6-v2')

# naive global score storage
result_vec = []

# Speech to Text Client load
stt_client = AzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_WHISPER_API_KEY"),  
    api_version="2024-02-01",
    azure_endpoint = os.getenv("AZURE_OPENAI_WHISPER_ENDPOINT")
)

# Corresponds to the custom name we chose for that deployment (on deployment Azure site)
stt_deployment_id = "whisper" 

# GPT LLM Client load
llm_client = AzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_GPT_4O_API_KEY"),  
    api_version="2024-08-01-preview",
    azure_endpoint = os.getenv("AZURE_OPENAI_GPT_4O_ENDPOINT")
)

llm_deployment="gpt-4o"

# Azure AI Audio TTS:
speech_config = speechsdk.SpeechConfig(subscription=os.getenv('AZURE_AI_SPEECH_KEY'), region=os.getenv('AZURE_AI_REGION'))
speech_config.speech_synthesis_voice_name='en-US-AvaMultilingualNeural'
speech_synthesizer = speechsdk.SpeechSynthesizer(speech_config=speech_config, audio_config=None)

# Get the scenarios from the DB
@app.route('/get_scenarios', methods=['GET'])
def get_scenarios():
    scenarios = Scenario.query().all()
    return jsonify([
        {
            'id': scenario['id'],
            'title': scenario['title'],
            'description': scenario['description'],
            'door_sign': scenario['door_sign'],
            'system_prompt': scenario['system_prompt'],
            'categories': scenario["categories"]
        }
        for scenario in scenarios
    ])

# Getting the checklist items and categories from the DB
@app.route('/get_checklist', methods=['GET'])
def get_checklist():
    ##checklist_rows = supabase.table('scenario_checklist').select('*').execute()
    scenario_id = request.args.get('scenario_id')
    if scenario_id:
        response = supabase.table('scenario_checklist').select('*').eq('scenario_id', scenario_id).execute()
    else:
        response = supabase.table('scenario_checklist').select('*').execute()

    return jsonify([
        {
            'id': row['id'],
            'scenario_id': row['scenario_id'],
            'category': row['category'],
            'checklist': row['checklist']
        }
        for row in response.data
    ])
    

# NOT USED ANYMORE: OLD SEMANTIC SIMILARITY EVALUATION CODE:
@app.route('/evaluate', methods=['POST'])
def evaluate():
    data = request.get_json()
    user_input = data.get('user_input')
    prompt_id = data.get('prompt_id')

    # Retrieve the prompt
    prompt_response = supabase.table('prompts').select('*').eq('id', prompt_id).execute()
    prompt = prompt_response.data[0] if prompt_response.data else None
    
    if not prompt:
        return jsonify({'error': 'Prompt not found'}), 404

    # Encode vectors of response and target
    expected_vec = model.encode([prompt['expected_response']])[0]
    user_vec = model.encode([user_input])[0]

    # distance is in [0,2] where 0 is identical, 1 is unrelated, and 0 is opposite
    cos_distance = distance.cosine(user_vec, expected_vec)

    # normalized score
    similarity_score = 1 - (cos_distance / 2) 
    print(f"Similarity score: {similarity_score}")

    # Threshold to determine correct or not
    threshold = 0.75
    is_correct = similarity_score >= threshold

    print(f"Correct? {is_correct}")

    return jsonify({'is_correct': bool(is_correct),
                    'score': f"{int(similarity_score * 100)}%"})

# /api/home endpoint
@app.route("/", methods=['GET'])
def return_home():
    return jsonify({
        'message': "Management Engineering c/o 2025 Capstone",
        'team': ['Thomas', 'Saleh', 'Abhinav', 'Matt', 'John']
    })

# NOT USED ANYMORE: OLD RESULTS OF NUMBER CORRECT AND NUM PROMPTS
@app.route("/store_results", methods=['POST'])
def store_results():
    data = request.get_json()

    print("results data:", data)

    # Extracting required fields from request
    user_id = data.get("user_id")
    scenario_id = data.get("scenario_id")
    category = data.get("category")
    num_correct = data.get("num_correct")
    num_prompts = data.get("num_prompts")

    # Validation: Ensure all required fields are present (allow 0 values)
    if any(value is None for value in [user_id, scenario_id, category, num_correct, num_prompts]):
        return jsonify({"error": "Missing required fields"}), 400

    try:
        # Insert data into Supabase "results" table
        response = supabase.table("results").insert([{
            "user_id": user_id,
            "scenario_id": scenario_id,
            "category": category,
            "num_correct": num_correct,
            "num_prompts": num_prompts
        }]).execute()

        # Debugging: Print Supabase response
        print("Supabase response:", response)

        return jsonify({"message": "Added result to DB"}), 200

    except Exception as e:
        return jsonify({"error": "Failed to add result to DB", "details": str(e)}), 500


# API to get audio file from user input, transcribe it, return to front end
@app.route('/upload_audio', methods=['POST'])
def upload_audio():

    # audio file
    audio_file = request.files.get('audio')

    # return 400 Bad Request error
    if not audio_file:
        return jsonify({'error': 'No audio file uploaded'}), 400

    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
        temp_path = tmp.name
        audio_file.save(temp_path)

    # Now pass the file stored to STT API
    try:
        with open(temp_path, "rb") as audio_file_path:
            result = stt_client.audio.transcriptions.create(
                file=audio_file_path,            
                model=stt_deployment_id
            )

        print(result.text)
      
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
    os.remove(temp_path)

    return jsonify({'transcript': result.text}), 200

@app.route('/llm_patient_response', methods=['POST'])
def llm_patient_response():
    try:
        data = request.get_json()

        # Extract user input and system prompt
        user_input = data.get("user_input")
        system_prompt = data.get("system_prompt")

        # Commented out: Extract full conversation history from all categories
        conversation_history = data.get("conversation_history", [])
        #print(conversation_history)

        # Structure the full conversation for LLM input
        conversation_structure = [
            {"role": "system", "content": system_prompt}
        ]

        # Commented out: Append full conversation history
        conversation_structure.extend(conversation_history)

        # Append the latest user message
        conversation_structure.append({"role": "user", "content": user_input})

        # Call LLM (GPT 4o) with complete conversation structure
        completion = llm_client.chat.completions.create(
            model=llm_deployment,
            messages=conversation_structure
        )

        # output of llm
        text = completion.choices[0].message.content
        text = text.strip('"')
        

        # STT Audio result 
        speech_synthesis_result = speech_synthesizer.speak_text(text)

        ## ERROR HANDLING:
        if speech_synthesis_result.reason == speechsdk.ResultReason.Canceled:
            cancellation_details = speech_synthesis_result.cancellation_details
            print("Speech synthesis canceled: {}".format(cancellation_details.reason))
            if cancellation_details.reason == speechsdk.CancellationReason.Error:
                if cancellation_details.error_details:
                    print("Error details: {}".format(cancellation_details.error_details))
            print("Did you set the speech resource key and region values?")
            audio_base64 = None
        else:
            # Decode audio file into base64 to send to front end
            wav_bytes = speech_synthesis_result.audio_data
            audio_base64 = base64.b64encode(wav_bytes).decode('utf-8')

        return jsonify({
            'patient_transcript': text,
            'audio_base64': audio_base64
        })

    except Exception as e:
        # Log the error for debugging purposes
        print("Error in llm_patient_response:", str(e))
        import traceback
        print(traceback.format_exc())

        # Return a safe fallback response
        return jsonify({
            'patient_transcript': "I'm sorry, I don't understand.",
            'audio_base64': ""
        })

# New LLM evaluation
@app.route('/llm_critic', methods=['POST'])
def llm_critic():
    try:
        print("Received request to /llm_critic")
        data = request.get_json()
        print("Received data:", data)
        
        # Extract the two dictionaries from the incoming JSON
        doctor_dict = data.get("doctor_messages", {})
        checklist_dict = data.get("checklist", {})

        if not doctor_dict or not checklist_dict:
            return jsonify({"error": "Missing doctor_messages or checklist_items in request"}), 400

        # Ensure both dictionaries share the same categories
        doctor_categories = set(doctor_dict.keys())
        checklist_categories = set(checklist_dict.keys())

        if doctor_categories != checklist_categories:
            return jsonify({
                "error": "Mismatching categories between doctor_messages and checklist_items",
                "doctor_categories": list(doctor_categories),
                "checklist_categories": list(checklist_categories)
            }), 400
        
        # 3) Prepare a dictionary to store the LLM's feedback for each category
        critic_results = {}
        
        # 4) Loop through categories in the order they appear in doctor_dict
        for category, doctor_lines in doctor_dict.items():
            if len(doctor_lines) == 0:
                feedback = "The doctor did not  "
            # (a) Format the checklist lines
            checklist_lines = checklist_dict[category]  # e.g. ["Introduce yourself", "Check patient ID", ...]
            checklist_str = "\n".join([f"- {item}" for item in checklist_lines])
            
            # (b) Build the system prompt with the checklist for this specific category
            critic_system_prompt = f"""
            You are an experienced Objective Structured Clinical Examination examiner. 
            This is a performance-based test used in healthcare education and practice to assess clinical skills, 
            knowledge, and judgment in a simulated environment. Evaluate the following doctor's questions and communication style 
            using the checklist below. For each item, provide a numerical score (0 if not addressed, 1 if addressed) 
            along with detailed feedback. If no responses from the doctor are provided, give a score of zero for each checklist item,
            and in the feedback explain that the doctor did not complete whatever the checklist task was.

            Category: {category}
            Checklist:
            {checklist_str}

            Evaluate based on these criteria and provide a comprehensive score and feedback for each section. Please do not include any markdown formatting in your response.
            """

            # (c) Format the user's (doctor's) content in a single string
            formatted_doctor_text = "\n".join([f"Doctor: {msg}" for msg in doctor_lines])

            # Prepare the messages for chat completion
            messages = [
                {
                    "role": "system",
                    "content": critic_system_prompt
                },
                {
                    "role": "user",
                    "content": (
                        "Please evaluate this doctor's questions and communication style "
                        "restating each of the exact checklist items listed above, followed by a colon, space, then the score. In the line below the checklist item, put feedback, colon, then the feedback. Doctor's Responses: "
                        f"{formatted_doctor_text}"
                    )
                }
            ]

            print(f"Sending to LLM for category '{category}' with messages:", messages)

            # (d) Pass into the chat completion as before
            completion = llm_client.chat.completions.create(
                model=llm_deployment,
                messages=messages,
                temperature=0.2  # or your preferred setting
            )

            feedback = completion.choices[0].message.content
            print(f"Received feedback for category '{category}':", feedback)
            
            # (e) Append the LLM's feedback into the results dictionary
            critic_results[category] = feedback
        
        # 5) After the loop, return the dictionary of results
        return jsonify({
            "critic_feedback": critic_results
        })
    
    except Exception as e:
        print(f"Error in llm_critic: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return jsonify({'error': str(e)}), 500

# sign up
@app.route("/signup", methods=["POST"])
def signup():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    try:
        # Attempt to sign up the user
        res = supabase.auth.sign_up({"email": email, "password": password})

        # If Supabase returns a user, check if they are confirmed
        user = res.user

        if user and not user.confirmed_at:
            return jsonify({
                "message": "Sign-up successful! Please check your email to confirm your account before signing in.",
                "requires_verification": True
            }), 200

        return jsonify({
            "message": "Sign-up successful!",
            "user_id": user.id if user else None
        }), 200

    except Exception as e:
        error_message = str(e)

        # Check if the error is due to the user already being signed up but not confirmed
        if "User already registered" in error_message:
            return jsonify({
                "message": "This email is already registered but not verified. Please check your email to confirm your account.",
                "requires_verification": True
            }), 200

        return jsonify({"error": "Sign-up failed", "details": error_message}), 500

@app.route("/signin", methods=["POST"])
def signin():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    try:
        res = supabase.auth.sign_in_with_password({"email": email, "password": password})
        session_data = res.session  # This contains JWT and user session

        if session_data is None:
            return jsonify({"error": "Invalid credentials or email not confirmed."}), 401

        user = session_data.user
        serializable_session = {
            "access_token": session_data.access_token,
            "refresh_token": session_data.refresh_token,
            "expires_in": session_data.expires_in,
            "user": {
                "id": user.id,
                "email": user.email,
                "confirmed_at": user.confirmed_at,  # if available
                # add any other user fields you need
            }
        }

        return jsonify({"message": "Login successful!", "session": serializable_session})

    except Exception as e:
        print(str(e))
        return jsonify({"error": "Sign in failed", "details": str(e)}), 401

@app.route("/signout", methods=["POST"])
def signout():
    try:
        supabase.auth.sign_out()  # Sign out the user
        return jsonify({"message": "Logout successful"}), 200
    except Exception as e:
        return jsonify({"error": "Logout failed", "details": str(e)}), 500

    
# this will run for local development
if __name__ == "__main__" and FLASK_ENV == "development":
    app.run(debug=True, port=8080)