import os
from flask import g, request
from werkzeug.local import LocalProxy
from supabase import create_client, ClientOptions, Client
from flask_storage import FlaskSessionStorage
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

# Ensure credentials are correctly loaded
if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY!")

# Initialize Supabase Client
def get_supabase() -> Client:
    if "supabase" not in g:
        g.supabase = create_client(
            SUPABASE_URL, 
            SUPABASE_KEY,
            options=ClientOptions(
                storage=FlaskSessionStorage(),
                flow_type="pkce"
            )
            )
    return g.supabase

supabase: Client = LocalProxy(get_supabase)