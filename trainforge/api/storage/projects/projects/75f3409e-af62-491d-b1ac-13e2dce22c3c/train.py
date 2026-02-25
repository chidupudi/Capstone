"""
Simple GPU test training script for TrainForge external worker
This will test if the Colab GPU worker can execute training jobs
"""

import torch
import torch.nn as nn
import time
import os
import sys

def main():
    print("🚀 Starting External GPU Training Test")
    print("=" * 50)

    # Get job info from environment
    job_id = os.environ.get('TRAINFORGE_JOB_ID', 'unknown')
    print(f"📋 Job ID: {job_id}")

    # Check GPU availability
    if torch.cuda.is_available():
        device = torch.device('cuda')
        gpu_name = torch.cuda.get_device_name(0)
        gpu_memory = torch.cuda.get_device_properties(0).total_memory // 1024**3
        print(f"✅ GPU Available: {gpu_name}")
        print(f"💾 GPU Memory: {gpu_memory}GB")
        print(f"🔧 CUDA Version: {torch.version.cuda}")
    else:
        device = torch.device('cpu')
        print("⚠️ No GPU available, using CPU")

    print(f"🎯 Using device: {device}")

    # Create a simple neural network
    print("\n🧠 Creating neural network...")
    model = nn.Sequential(
        nn.Linear(100, 256),
        nn.ReLU(),
        nn.Linear(256, 128),
        nn.ReLU(),
        nn.Linear(128, 10)
    ).to(device)

    print(f"📊 Model parameters: {sum(p.numel() for p in model.parameters()):,}")

    # Create sample data
    print("📦 Creating sample data...")
    batch_size = 32
    input_size = 100
    X = torch.randn(batch_size, input_size).to(device)
    y = torch.randint(0, 10, (batch_size,)).to(device)

    # Training setup
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=0.001)

    print("\n🏃 Starting training...")
    print("Epoch | Loss     | GPU Mem  | Time")
    print("-" * 35)

    epochs = 20
    start_time = time.time()

    for epoch in range(epochs):
        epoch_start = time.time()

        # Forward pass
        outputs = model(X)
        loss = criterion(outputs, y)

        # Backward pass
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()

        # Memory usage
        if torch.cuda.is_available():
            memory_used = torch.cuda.memory_allocated() / 1024**2  # MB
            memory_str = f"{memory_used:.1f}MB"
        else:
            memory_str = "N/A"

        epoch_time = time.time() - epoch_start

        print(f"{epoch+1:5d} | {loss.item():.6f} | {memory_str:8s} | {epoch_time:.3f}s")

        # Simulate longer training
        time.sleep(0.5)

    total_time = time.time() - start_time

    print("\n" + "=" * 50)
    print("✅ Training completed successfully!")
    print(f"⏱️ Total time: {total_time:.2f} seconds")
    print(f"📈 Final loss: {loss.item():.6f}")

    if torch.cuda.is_available():
        print(f"🔥 Peak GPU memory: {torch.cuda.max_memory_allocated() / 1024**2:.1f}MB")

    # Save model (simulate)
    print("💾 Saving model...")
    torch.save(model.state_dict(), 'model.pth')
    print(f"✅ Model saved as model.pth")

    print("\n🎉 External GPU training test completed!")
    return 0

if __name__ == "__main__":
    try:
        exit_code = main()
        sys.exit(exit_code)
    except Exception as e:
        print(f"❌ Training failed: {e}")
        sys.exit(1)