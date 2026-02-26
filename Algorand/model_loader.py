import torch
import torch.nn.functional as F
from torch_geometric.nn import SAGEConv

class FraudGNN(torch.nn.Module):
    def __init__(self, in_channels=5, hidden_channels=16): # Set to 5
        super(FraudGNN, self).__init__()
        self.conv1 = SAGEConv(in_channels, hidden_channels)
        self.conv2 = SAGEConv(hidden_channels, 2)

    def forward(self, x, edge_index):
        x = self.conv1(x, edge_index).relu()
        x = F.dropout(x, p=0.5, training=self.training)
        x = self.conv2(x, edge_index)
        return F.log_softmax(x, dim=1)

# Initialize and load weights (Assuming you have a trained 'model.pt')
def load_trained_model(path="model.pt"):
    model = FraudGNN(in_channels=5, hidden_channels=16) # 5 features: in_degree, out_degree, avg_amount, wallet_length, is_hub
    try:
        state_dict = torch.load(path, map_location=torch.device('cpu'))
        model.load_state_dict(state_dict)
        print(f"Model weights loaded from {path}")
    except FileNotFoundError:
        print(f"WARNING: {path} not found. Using untrained model with random weights.")
    except Exception as e:
        print(f"ERROR loading model: {e}")
    model.eval()
    return model
