import os
from groq import Groq

client = Groq(api_key=os.getenv("GROQ_API_KEY", ""))

def chat_with_groq(messages: list, mode: str = "standard"):
    """
    Call Groq API with conversation history.
    
    Args:
        messages: List of dicts with 'role' and 'content'
        mode: Chat mode (standard, coding, creative, research)
    
    Returns:
        Response text from Groq
    """
    
    model = "mixtral-8x7b-32768"  # Default model
    
    # Model selection based on mode
    if mode == "coding":
        model = "mixtral-8x7b-32768"
    elif mode == "creative":
        model = "mixtral-8x7b-32768"
    elif mode == "research":
        model = "mixtral-8x7b-32768"
    
    try:
        chat_completion = client.chat.completions.create(
            messages=messages,
            model=model,
            temperature=0.7 if mode != "research" else 0.2,
            max_tokens=1200 if mode != "research" else 2000,
        )
        return chat_completion.choices[0].message.content
    except Exception as e:
        print(f"Groq API error: {str(e)}")
        return f"Error: Unable to generate response - {str(e)}"
