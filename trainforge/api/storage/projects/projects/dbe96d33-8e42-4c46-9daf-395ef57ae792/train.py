"""
TrainForge Demo - MNIST Digit Classification
=============================================
A real training job that completes in ~1 minute with meaningful results.
Trains a CNN on MNIST and outputs metrics, confusion matrix, and model.
"""

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
from torchvision import datasets, transforms
import json
import time
import os
from pathlib import Path

# Create output directories
Path("results").mkdir(exist_ok=True)
Path("checkpoints").mkdir(exist_ok=True)

print("="*60)
print("TrainForge Demo: MNIST Digit Classification")
print("="*60)

# Check device
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"\nDevice: {device}")
if device.type == "cuda":
    print(f"GPU: {torch.cuda.get_device_name(0)}")

# Hyperparameters (tuned for ~1 minute training)
BATCH_SIZE = 128
EPOCHS = 3
LEARNING_RATE = 0.01

print(f"\nHyperparameters:")
print(f"  Batch Size: {BATCH_SIZE}")
print(f"  Epochs: {EPOCHS}")
print(f"  Learning Rate: {LEARNING_RATE}")

# Simple CNN Model
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
        x = self.pool(self.relu(self.conv1(x)))  # 28->14
        x = self.pool(self.relu(self.conv2(x)))  # 14->7
        x = x.view(-1, 64 * 7 * 7)
        x = self.dropout(self.relu(self.fc1(x)))
        x = self.fc2(x)
        return x

# Data loading
print("\nLoading MNIST dataset...")
transform = transforms.Compose([
    transforms.ToTensor(),
    transforms.Normalize((0.1307,), (0.3081,))
])

train_dataset = datasets.MNIST('./data', train=True, download=True, transform=transform)
test_dataset = datasets.MNIST('./data', train=False, download=True, transform=transform)

train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True, num_workers=2)
test_loader = DataLoader(test_dataset, batch_size=BATCH_SIZE, shuffle=False, num_workers=2)

print(f"Training samples: {len(train_dataset)}")
print(f"Test samples: {len(test_dataset)}")

# Initialize model
model = SimpleCNN().to(device)
criterion = nn.CrossEntropyLoss()
optimizer = optim.Adam(model.parameters(), lr=LEARNING_RATE)

# Training metrics storage
metrics = {
    "epochs": [],
    "train_loss": [],
    "train_accuracy": [],
    "test_loss": [],
    "test_accuracy": [],
    "training_time": 0,
    "device": str(device),
    "total_params": sum(p.numel() for p in model.parameters())
}

print(f"Model parameters: {metrics['total_params']:,}")
print("\n" + "="*60)
print("Starting Training...")
print("="*60 + "\n")

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

        # Progress update every 100 batches
        if batch_idx % 100 == 0:
            print(f"Epoch {epoch+1}/{EPOCHS} | Batch {batch_idx}/{len(train_loader)} | Loss: {loss.item():.4f}")

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

    print(f"\n{'='*60}")
    print(f"Epoch {epoch+1}/{EPOCHS} Complete ({epoch_time:.1f}s)")
    print(f"  Train Loss: {train_loss:.4f} | Train Acc: {train_acc:.2f}%")
    print(f"  Test Loss:  {test_loss:.4f} | Test Acc:  {test_acc:.2f}%")
    print(f"{'='*60}\n")

    # Save checkpoint
    checkpoint_path = f"checkpoints/model_epoch_{epoch+1}.pt"
    torch.save({
        'epoch': epoch + 1,
        'model_state_dict': model.state_dict(),
        'optimizer_state_dict': optimizer.state_dict(),
        'train_loss': train_loss,
        'test_acc': test_acc
    }, checkpoint_path)
    print(f"Checkpoint saved: {checkpoint_path}")

# Training complete
total_time = time.time() - start_time
metrics["training_time"] = total_time

print("\n" + "="*60)
print("Training Complete!")
print("="*60)
print(f"\nTotal training time: {total_time:.1f} seconds")
print(f"Final Test Accuracy: {metrics['test_accuracy'][-1]:.2f}%")

# Save final model
final_model_path = "results/mnist_model.pt"
torch.save(model.state_dict(), final_model_path)
print(f"\nFinal model saved: {final_model_path}")

# Generate confusion matrix
print("\nGenerating confusion matrix...")
model.eval()
all_preds = []
all_targets = []

with torch.no_grad():
    for data, target in test_loader:
        data = data.to(device)
        output = model(data)
        _, predicted = output.max(1)
        all_preds.extend(predicted.cpu().numpy())
        all_targets.extend(target.numpy())

# Create confusion matrix
confusion = [[0]*10 for _ in range(10)]
for pred, target in zip(all_preds, all_targets):
    confusion[target][pred] += 1

metrics["confusion_matrix"] = confusion

# Per-class accuracy
class_accuracy = {}
for i in range(10):
    total = sum(confusion[i])
    correct = confusion[i][i]
    class_accuracy[str(i)] = round(100 * correct / total, 2) if total > 0 else 0

metrics["class_accuracy"] = class_accuracy

# Save metrics
metrics_path = "results/metrics.json"
with open(metrics_path, 'w') as f:
    json.dump(metrics, f, indent=2)
print(f"Metrics saved: {metrics_path}")

# Print summary
print("\n" + "="*60)
print("RESULTS SUMMARY")
print("="*60)
print(f"\nModel: SimpleCNN ({metrics['total_params']:,} parameters)")
print(f"Device: {device}")
print(f"Training Time: {total_time:.1f}s")
print(f"\nFinal Metrics:")
print(f"  Train Accuracy: {metrics['train_accuracy'][-1]:.2f}%")
print(f"  Test Accuracy:  {metrics['test_accuracy'][-1]:.2f}%")
print(f"\nPer-Digit Accuracy:")
for digit, acc in class_accuracy.items():
    bar = "█" * int(acc/5) + "░" * (20 - int(acc/5))
    print(f"  Digit {digit}: {bar} {acc:.1f}%")

print("\n" + "="*60)
print("Output Files:")
print("="*60)
print(f"  results/mnist_model.pt      - Final trained model")
print(f"  results/metrics.json        - Training metrics & confusion matrix")
print(f"  checkpoints/model_epoch_*.pt - Epoch checkpoints")
print("\nTraining job completed successfully!")
