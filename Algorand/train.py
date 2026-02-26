import torch
import pickle
import pandas as pd
from sklearn.preprocessing import LabelEncoder
from torch_geometric.data import Data
import torch.nn.functional as F
from torch_geometric.nn import SAGEConv

# --- 1. Generate Dataset ---
print("Step 1: Generating dataset...")
import random
import uuid

def generate_dummy_data(entries=200):
    data = []
    mule_wallets = [f"MULE_{i}" for i in range(10)]
    normal_wallets = [f"STU_{i}" for i in range(50)]
    hub_wallet = "HUB_COLLECTOR_01"
    ngo_wallet = "GOVT_SCHOLARSHIP_DEPT"

    for i in range(entries):
        if random.random() > 0.2:
            sender = ngo_wallet
            receiver = random.choice(normal_wallets)
            amount = random.randint(1000, 5000)
            label = 0
        else:
            sender = random.choice(mule_wallets)
            receiver = hub_wallet
            amount = random.randint(100, 500)
            label = 1

        data.append({
            "tx_id": str(uuid.uuid4())[:8],
            "sender": sender,
            "receiver": receiver,
            "amount": amount,
            "timestamp": f"2026-02-{random.randint(1,28)}",
            "is_fraud": label
        })
    
    return pd.DataFrame(data)

df = generate_dummy_data(210)
df.to_csv("algorand_fraud_dataset.csv", index=False)
print(f"✓ Dataset created: {len(df)} transactions")

# --- 2. Create Graph Data ---
print("\nStep 2: Converting to graph format...")

def create_graph_data(csv_path):
    df = pd.read_csv(csv_path)
    
    # Encode Wallet Addresses
    all_wallets = pd.concat([df['sender'], df['receiver']]).unique()
    le = LabelEncoder()
    le.fit(all_wallets)
    
    # Create Edge Index
    src = le.transform(df['sender'])
    dst = le.transform(df['receiver'])
    edge_index = torch.tensor([src, dst], dtype=torch.long)
    
    # Create Node Features [In-degree, Out-degree, Avg_Amount, Wallet_Length, Is_Hub]
    node_features = []
    for wallet in all_wallets:
        in_d = len(df[df['receiver'] == wallet])
        out_d = len(df[df['sender'] == wallet])
        avg_amt = df[df['sender'] == wallet]['amount'].mean()
        avg_amt = avg_amt if pd.notna(avg_amt) else 0.0
        is_hub = 1 if "HUB" in wallet else 0
        node_features.append([float(in_d), float(out_d), float(avg_amt), float(len(wallet)), float(is_hub)])
    
    x = torch.tensor(node_features, dtype=torch.float)
    
    # Create Labels
    labels = []
    for wallet in all_wallets:
        is_fraud = df[(df['sender'] == wallet) | (df['receiver'] == wallet)]['is_fraud'].max()
        is_fraud = int(is_fraud) if pd.notna(is_fraud) else 0
        labels.append(is_fraud)
    
    y = torch.tensor(labels, dtype=torch.long)
    
    return Data(x=x, edge_index=edge_index, y=y), le

data, encoder = create_graph_data("algorand_fraud_dataset.csv")
print(f"✓ Graph created: {data.num_nodes} nodes, {data.num_edges} edges, 5 features")

# --- 3. Define Model ---
print("\nStep 3: Training model...")

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

# --- 4. Train Model ---
model = FraudGNN(in_channels=5, hidden_channels=16)
optimizer = torch.optim.Adam(model.parameters(), lr=0.01)

for epoch in range(50):
    model.train()
    optimizer.zero_grad()
    out = model(data.x, data.edge_index)
    loss = F.nll_loss(out, torch.tensor(data.y).long() if not isinstance(data.y, torch.Tensor) else data.y.long())
    loss.backward()
    optimizer.step()
    
    if (epoch + 1) % 10 == 0:
        print(f"  Epoch {epoch + 1}/50 - Loss: {loss.item():.4f}")

print("✓ Model trained successfully")

# --- 5. Save Model and Encoder ---
print("\nStep 4: Saving artifacts...")

torch.save(model.state_dict(), "model.pt")
print("✓ Saved: model.pt")

with open("label_encoder.pkl", "wb") as f:
    pickle.dump(encoder, f)
print("✓ Saved: label_encoder.pkl")

print("\n✅ Training complete! You can now run: python main.py")
