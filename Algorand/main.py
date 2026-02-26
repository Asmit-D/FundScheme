import torch
import pickle
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
from algosdk.v2client import indexer
from torch_geometric.nn import SAGEConv
import torch.nn.functional as F
import subprocess
import sys
# --- 1. Model Definition (Must match training architecture) ---
class FraudGNN(torch.nn.Module):
    def __init__(self, in_channels=5, hidden_channels=16):
        super(FraudGNN, self).__init__()
        self.conv1 = SAGEConv(in_channels, hidden_channels)
        self.conv2 = SAGEConv(hidden_channels, 2)

    def forward(self, x, edge_index):
        x = self.conv1(x, edge_index).relu()
        x = F.dropout(x, p=0.5, training=self.training)
        x = self.conv2(x, edge_index)
        return F.log_softmax(x, dim=1)

# --- 2. FastAPI Setup & Resource Loading ---
app = FastAPI(title="Algorand AI Fraud Detection Service")

# Global state to hold model, mapping, and the full graph context
state = {}

@app.on_event("startup")
def load_resources():
    try:
        # Load Algorand Indexer (Testnet example)
        state["algo_indexer"] = indexer.IndexerClient("", "https://testnet-idx.algonode.cloud", "")
        
        # Load LabelEncoder
        with open("label_encoder.pkl", "rb") as f:
            state["encoder"] = pickle.load(f)
        
        # Load Model
        state["model"] = FraudGNN(in_channels=5)
        state["model"].load_state_dict(torch.load("model.pt", map_location=torch.device('cpu')))
        state["model"].eval()

        # FIX: Load the full graph data used during training for inference context
        # This prevents the "All 1.0" risk score by providing real neighbor data
        from train import create_graph_data
        state["full_graph_data"], _ = create_graph_data("algorand_fraud_dataset.csv")
        
        print("✅ AI Resources and Graph Context Loaded Successfully.")
    except Exception as e:
        print(f"❌ ERROR loading resources: {e}")
        # In production, you might not want to crash the whole app if one resource fails
        # but for this POC, it's better to know early.

# --- 3. Request Schemas ---
class FraudCheck(BaseModel):
    wallet_address: str
    asset_id: int

# --- 4. Logic Functions ---
def trigger_blockchain_freeze(wallet: str, asset_id: int):
    """Background Task: Triggers an asset freeze on the Algorand blockchain."""
    print(f"!!! BLOCKCHAIN ACTION: Freezing Asset {asset_id} for wallet {wallet} !!!")

# --- 5. API Endpoints ---

@app.get("/")
def home():
    """Home route to verify the API is live."""
    return {"status": "AI Fraud API is live!", "docs": "/docs"}

@app.get("/health")
def health():
    return {"status": "running", "network": "Algorand Testnet"}

@app.post("/analyze-wallet")
async def analyze_wallet(data: FraudCheck, background_tasks: BackgroundTasks):
    # Step A: Check if encoder exists
    if state.get("encoder") is None:
        raise HTTPException(status_code=503, detail="Model encoder not ready.")

    # Step B: Map wallet to internal Graph ID
    try:
        wallet_idx = state["encoder"].transform([data.wallet_address])[0]
    except ValueError:
        # FIX: Explicitly raise 404 so it isn't caught by the general 500 error block
        raise HTTPException(status_code=404, detail="Wallet address not found in historical graph data.")

    try:
        # Step C: Run AI Inference using the full trained graph context
        full_data = state["full_graph_data"]
        
        with torch.no_grad():
            # The model analyzes the node within the context of the entire network
            output = state["model"](full_data.x, full_data.edge_index)
            probs = torch.exp(output)
            
            # Extract the fraud probability (Class 1) for this specific wallet
            risk_score = float(probs[wallet_idx][1])

        # Step D: Determine Action
        decision = "CLEAR"
        if risk_score > 0.85:
            decision = "FRAUD_HIGH"
            background_tasks.add_task(trigger_blockchain_freeze, data.wallet_address, data.asset_id)
        elif risk_score > 0.60:
            decision = "SUSPICIOUS_REVIEW"

        return {
            "address": data.wallet_address,
            "risk_score": round(risk_score, 4),
            "decision": decision,
            "monitored_asset": data.asset_id
        }

    except Exception as e:
        # Handles unforeseen server-side errors
        raise HTTPException(status_code=500, detail=f"Inference error: {str(e)}")
    




@app.get("/run-tests")
def run_tests():
    try:
        # Use env to force UTF-8 for the subprocess
        import os
        env = os.environ.copy()
        env["PYTHONIOENCODING"] = "utf-8"

        result = subprocess.run(
            [sys.executable, "test_endpoints.py"],
            capture_output=True,
            text=True,
            timeout=30,
            env=env, # Pass the UTF-8 environment variable
            encoding="utf-8" # Explicitly decode the output as utf-8
        )
        
        return {
            "status": "success" if result.returncode == 0 else "failed",
            "stdout": result.stdout,
            "stderr": result.stderr
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Test execution error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    # Use $PORT for compatibility with cloud services like Render
    import os
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)