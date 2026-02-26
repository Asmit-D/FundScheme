from algosdk.v2client import indexer

class AlgorandMonitor:
    def __init__(self):
        # Using a public Indexer for demo (replace with your node)
        self.client = indexer.IndexerClient("", "https://testnet-idx.algonode.cloud", "")

    def get_recent_transactions(self, asset_id: int, limit=100):
        # Fetching transactions for a specific Scholarship Token (ASA)
        response = self.client.search_asset_transactions(asset_id=asset_id, limit=limit)
        return response.get('transactions', [])