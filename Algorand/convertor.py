import pandas as pd
import torch
from torch_geometric.data import Data
from sklearn.preprocessing import LabelEncoder

def create_graph_data(csv_path):
    df = pd.read_csv(csv_path)

    # 1. Encode Wallet Addresses to Integer IDs
    all_wallets = pd.concat([df['sender'], df['receiver']]).unique()
    le = LabelEncoder()
    le.fit(all_wallets)
    
    # 2. Create Edge Index [2, num_edges]
    src = le.transform(df['sender'])
    dst = le.transform(df['receiver'])
    edge_index = torch.tensor([src, dst], dtype=torch.long)

    # 3. Create Node Features (X)
    # For simplicity: [In-degree, Out-degree, Avg_Amount_Sent]
    node_features = []
    for wallet in all_wallets:
        in_d = len(df[df['receiver'] == wallet])
        out_d = len(df[df['sender'] == wallet])
        avg_amt = df[df['sender'] == wallet]['amount'].mean() or 0
        node_features.append([in_d, out_d, avg_amt, len(wallet), 1 if "HUB" in wallet else 0])
    
    x = torch.tensor(node_features, dtype=torch.float)

    # 4. Create Labels (Y)
    # If a wallet is involved in a fraud transaction, label it as 1
    labels = []
    for wallet in all_wallets:
        is_fraud = df[(df['sender'] == wallet) | (df['receiver'] == wallet)]['is_fraud'].max()
        labels.append(is_fraud)
    
    y = torch.tensor(labels, dtype=torch.long)

    return Data(x=x, edge_index=edge_index, y=y), le

# Usage
data, encoder = create_graph_data("algorand_fraud_dataset.csv")