import pandas as pd
import random
import uuid

def generate_dummy_data(entries=200):
    data = []
    # Roles: NGO (Source), Student (Normal), Mule (Fraud), Hub (Collector)
    mule_wallets = [f"MULE_{i}" for i in range(10)]
    normal_wallets = [f"STU_{i}" for i in range(50)]
    hub_wallet = "HUB_COLLECTOR_01"
    ngo_wallet = "GOVT_SCHOLARSHIP_DEPT"

    for i in range(entries):
        # 80% Normal Transactions
        if random.random() > 0.2:
            sender = ngo_wallet
            receiver = random.choice(normal_wallets)
            amount = random.randint(1000, 5000)
            label = 0 # Normal
        
        # 20% Fraudulent Patterns (Many-to-One / Money Muling)
        else:
            sender = random.choice(mule_wallets)
            receiver = hub_wallet
            amount = random.randint(100, 500) # Smaller "smurfing" amounts
            label = 1 # Fraudulent

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
print("Dummy dataset created with 210 entries.")