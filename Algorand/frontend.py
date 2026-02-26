import streamlit as st
import requests
import pandas as pd
import time

# --- Configuration ---
API_URL = "http://localhost:8000"

st.set_page_config(
    page_title="Algorand Fraud Guard AI",
    page_icon="🛡️",
    layout="wide"
)

# --- Header ---
st.title("🛡️ Algorand AI Fraud Detection")
st.markdown("""
Monitor blockchain transactions using **Graph Neural Networks (GNN)**. 
This dashboard identifies 'Mule' accounts and suspicious flow patterns on the Algorand network.
""")

# --- Sidebar: Network Status ---
with st.sidebar:
    st.header("Network Status")
    try:
        health = requests.get(f"{API_URL}/health").json()
        st.success(f"API: {health['status'].upper()}")
        st.info(f"Network: {health['network']}")
    except:
        st.error("API Offline. Please run `python main.py` first.")

    st.divider()
    st.subheader("Threshold Settings")
    st.write("🔴 **High Risk:** > 0.85 (Auto-Freeze)")
    st.write("🟡 **Suspicious:** 0.60 - 0.85")
    st.write("🟢 **Clear:** < 0.60")

# --- Main Interface ---
col1, col2 = st.columns([1, 2])

with col1:
    st.subheader("Manual Wallet Audit")
    with st.form("audit_form"):
        wallet_addr = st.text_input("Wallet Address", placeholder="e.g., MULE_0 or STU_5")
        asset_id = st.number_input("Asset ID to Monitor", value=12345)
        submit = st.form_submit_button("Analyze Wallet")

    if submit:
        if not wallet_addr:
            st.warning("Please enter a wallet address.")
        else:
            with st.spinner("Analyzing graph connectivity..."):
                response = requests.post(
                    f"{API_URL}/analyze-wallet",
                    json={"wallet_address": wallet_addr, "asset_id": asset_id}
                )

                if response.status_code == 200:
                    res = response.json()
                    score = res['risk_score']
                    
                    # Risk Metric
                    st.metric("Fraud Probability", f"{score * 100:.2f}%")
                    
                    # Decision UI
                    if res['decision'] == "FRAUD_HIGH":
                        st.error(f"🚨 **DECISION: {res['decision']}**")
                        st.warning("Action: Blockchain Freeze Triggered.")
                    elif res['decision'] == "SUSPICIOUS_REVIEW":
                        st.warning(f"⚠️ **DECISION: {res['decision']}**")
                    else:
                        st.success(f"✅ **DECISION: {res['decision']}**")
                    
                    st.json(res)
                elif response.status_code == 404:
                    st.error("Wallet not found in historical graph data.")
                else:
                    st.error(f"Error: {response.json().get('detail', 'Unknown error')}")

with col2:
    st.subheader("Transaction Intelligence")
    
    # Load dummy data for visualization (matches your train.py logic)
    try:
        df = pd.read_csv("algorand_fraud_dataset.csv")
        st.write(f"Recent transactions in graph context ({len(df)} total):")
        
        # Add a search/filter for the table
        search = st.text_input("Filter transactions by address", "")
        if search:
            display_df = df[(df['sender'] == search) | (df['receiver'] == search)]
        else:
            display_df = df.head(10)
            
        st.dataframe(display_df, use_container_width=True)
        
        # Fraud Distribution Chart
        st.subheader("Network Composition")
        fraud_counts = df['is_fraud'].value_counts()
        st.bar_chart(fraud_counts)
        st.caption("0: Normal Transactions | 1: Identified Fraudulent Patterns")

    except FileNotFoundError:
        st.info("Run `python train.py` to generate the dataset CSV for visualization.")
        
# ... add this at the bottom of streamlit_app.py ...

st.divider()

st.header("🛠️ Diagnostic Control Center")

if st.button("🚀 Run Full System Audit"):
    status_box = st.empty()
    status_box.info("Initiating 9-point security audit...")
    
    try:
        response = requests.get("http://localhost:8000/run-tests")
        data = response.json()
        output = data["stdout"]

        # 1. Summary Metrics
        col1, col2 = st.columns(2)
        if "✅ ALL TESTS COMPLETED" in output:
            col1.metric("Audit Status", "PASSED", delta="Green")
            status_box.success("System integrity verified.")
        else:
            col1.metric("Audit Status", "FAILED", delta="-Critical", delta_color="inverse")
            status_box.error("Audit failed. Review security logs below.")
        
        # 2. Detailed Test Breakdown (parsing the output)
        st.subheader("Audit Logs")
        
        # We use an expander so the UI stays clean but "more info" is one click away
        with st.expander("📄 View Detailed Console Trace", expanded=True):
            st.code(output, language="text")

        # 3. Quick-View Status List
        st.markdown("### Quick Check")
        test_names = [
            "Health Check", "Normal Wallet", "Mule Detection", 
            "Hub Analysis", "Unknown Wallet", "Payload Validation",
            "Asset Multi-check", "Gov Account", "Risk Thresholds"
        ]
        
        # Display a status list based on keywords in the output
        for name in test_names:
            if name in output or name.lower().replace(" ", "_") in output:
                st.write(f"✔️ {name}")
            else:
                st.write(f"⚪ {name} (Not detected in logs)")

    except Exception as e:
        st.error(f"Connection Error: {e}")
# --- Footer ---
st.divider()
st.caption("Algorand AI Fraud Service - PoC Version 1.0.0")