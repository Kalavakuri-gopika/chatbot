import os
import sys

print("===================================================")
print("  Hugging Face API Diagnostic Tool ")
print("===================================================")

try:
    from huggingface_hub import InferenceClient
except ImportError:
    print("[ERROR] huggingface_hub library is not installed in the current Python environment.")
    print("Please activate your virtual environment and run: pip install huggingface-hub")
    input("\nPress Enter to exit...")
    sys.exit(1)

# Get token and model
token = input("\nEnter your Hugging Face Hub Token (starts with hf_): ").strip()
model = input("Enter the Model ID (default: Qwen/Qwen2.5-7B-Instruct): ").strip()

if not model:
    model = "Qwen/Qwen2.5-7B-Instruct"

if not token:
    print("[ERROR] Token cannot be empty.")
    input("\nPress Enter to exit...")
    sys.exit(1)

print(f"\nTesting connection to Hugging Face serverless API using model: '{model}'...")

try:
    client = InferenceClient(model=model, token=token)
    
    # Try a simple lightweight generation
    response = client.chat_completion(
        messages=[{"role": "user", "content": "Reply with exactly: OK"}],
        max_tokens=10,
        temperature=0.1
    )
    generated = response.choices[0].message.content
    
    print("\n===================================================")
    print("  [SUCCESS] Hugging Face API is working correctly!")
    print(f"  Response from model: {generated.strip()}")
    print("===================================================")

except Exception as e:
    error_str = str(e)
    print("\n===================================================")
    print("  [ERROR] Connection failed!")
    print("===================================================")
    print(f"Details: {error_str}")
    print("\nTroubleshooting guide based on the error:")
    
    if "401" in error_str:
        print("- **401 Unauthorized**: Your token is invalid or expired. Check that you copied it correctly from: https://huggingface.co/settings/tokens")
    elif "404" in error_str:
        print("- **404 Not Found**: The model name is incorrect or does not support free serverless inference. Try using 'mistralai/Mistral-7B-Instruct-v0.3' or 'meta-llama/Meta-Llama-3-8B-Instruct'.")
    elif "503" in error_str or "loading" in error_str.lower():
        print("- **503 Service Unavailable (Model loading)**: The model is currently asleep on Hugging Face's servers. It is cold-starting now. Wait 1-2 minutes and run this test again.")
    elif "ConnectTunnelError" in error_str or "Failed to establish a new connection" in error_str:
        print("- **Network Connection Error**: Your local network or proxy is blocking outbound HTTPS requests to api-inference.huggingface.co.")
    else:
        print("- Please double check that you are using a model that supports free serverless inference (not a private model or gated model requiring special agreement).")

input("\nPress Enter to exit...")
