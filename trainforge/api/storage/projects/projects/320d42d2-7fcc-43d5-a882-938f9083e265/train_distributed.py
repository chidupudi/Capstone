"""
TrainForge Distributed Training - Multi-Worker Version
=======================================================
Supports 4 parallel Colab workers, each training on a data shard.
Results are aggregated for final model.
"""

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Subset
from torchvision import datasets, transforms
import json
import time
import os
import sys
from pathlib import Path
import requests

# Get worker configuration from environment
WORKER_ID = int(os.environ.get('WORKER_SHARD_ID', 0))  # 0, 1, 2, or 3
TOTAL_WORKERS = int(os.environ.get('TOTAL_WORKERS', 4))
API_URL = os.environ.get('API_URL', '')
JOB_ID = os.environ.get('JOB_ID', '')

# Create output directories
Path("results").mkdir(exist_ok=True)
Path("checkpoints").mkdir(exist_ok=True)

print("=" * 60)
print("TrainForge DISTRIBUTED Training")
print("=" * 60)
print(f"\nWorker {WORKER_ID + 1} of {TOTAL_WORKERS}")
print(f"This worker processes {100 // TOTAL_WORKERS}% of the dataset")

# Device setup
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Device: {device}")
if device.type == "cuda":
    print(f"GPU: {torch.cuda.get_device_name(0)}")

# Hyperparameters
BATCH_SIZE = 128
EPOCHS = 5  # More epochs since each worker has less data
LEARNING_RATE = 0.01

print(f"\nHyperparameters:")
print(f"  Batch Size: {BATCH_SIZE}")
print(f"  Epochs: {EPOCHS}")
print(f"  Learning Rate: {LEARNING_RATE}")

# Model Definition
class SimpleCNN(nn.Module):
    def __init__(self):
        super(SimpleCNN, self).__init__()
        self.conv1 = nn.Conv2d(1, 32, 3, padding=1)
        self.conv2 = nn.Conv2d(32, 64, 3, padding=1)
        self.pool = nn.MaxPool2d(2, 2)
        self.fc1 = nn.Linear(64 * 7 * 7, 128)
        self.fc2 = nn.Linear(128, 10)
        self.relu = nn.ReLU()
        self.dropout = nn.Dropout(0.25)

    def forward(self, x):
        x = self.pool(self.relu(self.conv1(x)))
        x = self.pool(self.relu(self.conv2(x)))
        x = x.view(-1, 64 * 7 * 7)
        x = self.dropout(self.relu(self.fc1(x)))
        x = self.fc2(x)
        return x

# Load and shard dataset
print(f"\nLoading MNIST dataset (Shard {WORKER_ID + 1}/{TOTAL_WORKERS})...")
transform = transforms.Compose([
    transforms.ToTensor(),
    transforms.Normalize((0.1307,), (0.3081,))
])

full_train_dataset = datasets.MNIST('./data', train=True, download=True, transform=transform)
test_dataset = datasets.MNIST('./data', train=False, download=True, transform=transform)

# Shard the training data
total_samples = len(full_train_dataset)
samples_per_worker = total_samples // TOTAL_WORKERS
start_idx = WORKER_ID * samples_per_worker
end_idx = start_idx + samples_per_worker if WORKER_ID < TOTAL_WORKERS - 1 else total_samples

# Create subset for this worker
indices = list(range(start_idx, end_idx))
train_dataset = Subset(full_train_dataset, indices)

train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True, num_workers=2)
test_loader = DataLoader(test_dataset, batch_size=BATCH_SIZE, shuffle=False, num_workers=2)

print(f"Total dataset: {total_samples} samples")
print(f"This worker's shard: {len(train_dataset)} samples (indices {start_idx}-{end_idx})")
print(f"Test samples: {len(test_dataset)}")

# Initialize model
model = SimpleCNN().to(device)
criterion = nn.CrossEntropyLoss()
optimizer = optim.Adam(model.parameters(), lr=LEARNING_RATE)

# Metrics storage
metrics = {
    "worker_id": WORKER_ID,
    "total_workers": TOTAL_WORKERS,
    "shard_size": len(train_dataset),
    "epochs": [],
    "train_loss": [],
    "train_accuracy": [],
    "test_loss": [],
    "test_accuracy": [],
    "training_time": 0,
    "device": str(device)
}

print(f"\n{'=' * 60}")
print(f"Starting Training on Worker {WORKER_ID + 1}")
print(f"{'=' * 60}\n")

start_time = time.time()

# Training loop
for epoch in range(EPOCHS):
    epoch_start = time.time()

    # Training phase
    model.train()
    train_loss = 0
    correct = 0
    total = 0

    for batch_idx, (data, target) in enumerate(train_loader):
        data, target = data.to(device), target.to(device)

        optimizer.zero_grad()
        output = model(data)
        loss = criterion(output, target)
        loss.backward()
        optimizer.step()

        train_loss += loss.item()
        _, predicted = output.max(1)
        total += target.size(0)
        correct += predicted.eq(target).sum().item()

        if batch_idx % 50 == 0:
            print(f"[Worker {WORKER_ID + 1}] Epoch {epoch + 1}/{EPOCHS} | Batch {batch_idx}/{len(train_loader)} | Loss: {loss.item():.4f}")

    train_loss /= len(train_loader)
    train_acc = 100. * correct / total

    # Evaluation phase
    model.eval()
    test_loss = 0
    correct = 0
    total = 0

    with torch.no_grad():
        for data, target in test_loader:
            data, target = data.to(device), target.to(device)
            output = model(data)
            test_loss += criterion(output, target).item()
            _, predicted = output.max(1)
            total += target.size(0)
            correct += predicted.eq(target).sum().item()

    test_loss /= len(test_loader)
    test_acc = 100. * correct / total

    epoch_time = time.time() - epoch_start

    # Store metrics
    metrics["epochs"].append(epoch + 1)
    metrics["train_loss"].append(train_loss)
    metrics["train_accuracy"].append(train_acc)
    metrics["test_loss"].append(test_loss)
    metrics["test_accuracy"].append(test_acc)

    print(f"\n[Worker {WORKER_ID + 1}] Epoch {epoch + 1} Complete ({epoch_time:.1f}s)")
    print(f"  Train Loss: {train_loss:.4f} | Train Acc: {train_acc:.2f}%")
    print(f"  Test Loss:  {test_loss:.4f} | Test Acc:  {test_acc:.2f}%\n")

# Training complete
total_time = time.time() - start_time
metrics["training_time"] = total_time

print(f"\n{'=' * 60}")
print(f"Worker {WORKER_ID + 1} Training Complete!")
print(f"{'=' * 60}")
print(f"Training time: {total_time:.1f}s")
print(f"Final Test Accuracy: {metrics['test_accuracy'][-1]:.2f}%")

# Save worker's model weights
model_path = f"results/worker_{WORKER_ID}_model.pt"
torch.save({
    'model_state_dict': model.state_dict(),
    'worker_id': WORKER_ID,
    'test_accuracy': metrics['test_accuracy'][-1],
    'shard_size': len(train_dataset)
}, model_path)
print(f"\nModel saved: {model_path}")

# Save worker metrics
metrics_path = f"results/worker_{WORKER_ID}_metrics.json"
with open(metrics_path, 'w') as f:
    json.dump(metrics, f, indent=2)
print(f"Metrics saved: {metrics_path}")

print(f"\n{'=' * 60}")
print(f"Worker {WORKER_ID + 1} DONE - Results ready for aggregation")
print(f"{'=' * 60}")
