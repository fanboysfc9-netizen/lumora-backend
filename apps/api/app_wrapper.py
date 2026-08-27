"""
Wrapper for running FastAPI as standalone executable.
Handles environment setup and database initialization.
"""
import os
import sys
from pathlib import Path

# Set up paths relative to executable
if getattr(sys, 'frozen', False):
    app_dir = Path(sys.executable).parent
else:
    app_dir = Path(__file__).parent

# Set working directory
os.chdir(app_dir)

# Set up environment defaults if not already set
if not os.getenv('GROQ_API_KEY'):
    os.environ['GROQ_API_KEY'] = ''  # Will be set by user at runtime

if not os.getenv('SECRET_KEY'):
    os.environ['SECRET_KEY'] = 'your-secret-key-change-in-production'

if not os.getenv('DATABASE_URL'):
    db_path = app_dir / 'lumora.db'
    os.environ['DATABASE_URL'] = f'sqlite:///{db_path}'

if not os.getenv('FRONTEND_URL'):
    os.environ['FRONTEND_URL'] = 'http://localhost:3000'

# Add app directory to path
sys.path.insert(0, str(app_dir))

# Import and run the app
import uvicorn
from main import app

if __name__ == '__main__':
    print("=" * 60)
    print("Lumora FastAPI Backend")
    print("=" * 60)
    print(f"Starting server on http://0.0.0.0:8000")
    print(f"API Docs: http://localhost:8000/docs")
    print(f"Database: {os.getenv('DATABASE_URL')}")
    print("=" * 60)
    print()
    
    uvicorn.run(
        app,
        host='0.0.0.0',
        port=8000,
        log_level='info'
    )
