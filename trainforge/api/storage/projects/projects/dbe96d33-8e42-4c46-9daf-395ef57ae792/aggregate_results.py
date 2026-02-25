"""
TrainForge Results Aggregator
=============================
Combines model weights from multiple distributed workers using weighted averaging.
Run this after all workers complete their training.
"""

import torch
import torch.nn as nn
import json
import os
from pathlib import Path
from torchvision import datasets, transforms
from torch.utils.data import DataLoader

# Model Definition (must match training)
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

def aggregate_models(results_dir="results", output_path="results/aggregated_model.pt"):
    """Aggregate models from all workers using FedAvg (weighted averaging)"""

    print("=" * 60)
    print("TrainForge Model Aggregation")
    print("=" * 60)

    results_path = Path(results_dir)

    # Find all worker model files
    model_files = list(results_path.glob("worker_*_model.pt"))

    if not model_files:
        print("❌ No worker model files found!")
        print(f"   Looking in: {results_path.absolute()}")
        return None

    print(f"\nFound {len(model_files)} worker models:")

    # Load all models and their metadata
    worker_data = []
    total_samples = 0

    for model_file in sorted(model_files):
        checkpoint = torch.load(model_file, map_location='cpu')
        worker_id = checkpoint.get('worker_id', 'unknown')
        shard_size = checkpoint.get('shard_size', 1)
        test_acc = checkpoint.get('test_accuracy', 0)

        worker_data.append({
            'file': model_file,
            'worker_id': worker_id,
            'state_dict': checkpoint['model_state_dict'],
            'shard_size': shard_size,
            'test_accuracy': test_acc
        })
        total_samples += shard_size

        print(f"   Worker {worker_id}: {shard_size} samples, {test_acc:.2f}% accuracy")

    print(f"\nTotal training samples: {total_samples}")

    # Federated Averaging (FedAvg)
    print("\nAggregating models using FedAvg...")

    # Initialize aggregated state dict
    aggregated_state = {}

    # Get parameter names from first model
    param_names = worker_data[0]['state_dict'].keys()

    # Weighted average of all parameters
    for param_name in param_names:
        # Weight by number of samples each worker trained on
        weighted_sum = None

        for worker in worker_data:
            weight = worker['shard_size'] / total_samples
            param = worker['state_dict'][param_name].float()

            if weighted_sum is None:
                weighted_sum = weight * param
            else:
                weighted_sum += weight * param

        aggregated_state[param_name] = weighted_sum

    # Create and load aggregated model
    aggregated_model = SimpleCNN()
    aggregated_model.load_state_dict(aggregated_state)

    # Evaluate aggregated model
    print("\nEvaluating aggregated model...")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    aggregated_model = aggregated_model.to(device)
    aggregated_model.eval()

    # Load test data
    transform = transforms.Compose([
        transforms.ToTensor(),
        transforms.Normalize((0.1307,), (0.3081,))
    ])
    test_dataset = datasets.MNIST('./data', train=False, download=True, transform=transform)
    test_loader = DataLoader(test_dataset, batch_size=128, shuffle=False)

    correct = 0
    total = 0

    with torch.no_grad():
        for data, target in test_loader:
            data, target = data.to(device), target.to(device)
            output = aggregated_model(data)
            _, predicted = output.max(1)
            total += target.size(0)
            correct += predicted.eq(target).sum().item()

    final_accuracy = 100. * correct / total

    print(f"\n{'=' * 60}")
    print("AGGREGATION RESULTS")
    print(f"{'=' * 60}")
    print(f"\nIndividual Worker Accuracies:")
    for worker in worker_data:
        print(f"   Worker {worker['worker_id']}: {worker['test_accuracy']:.2f}%")

    avg_individual = sum(w['test_accuracy'] for w in worker_data) / len(worker_data)
    print(f"\nAverage Individual Accuracy: {avg_individual:.2f}%")
    print(f"Aggregated Model Accuracy:   {final_accuracy:.2f}%")

    improvement = final_accuracy - avg_individual
    if improvement > 0:
        print(f"\n✅ Aggregation improved accuracy by {improvement:.2f}%!")
    else:
        print(f"\n📊 Aggregated accuracy: {final_accuracy:.2f}%")

    # Save aggregated model
    output_file = Path(output_path)
    output_file.parent.mkdir(exist_ok=True)

    torch.save({
        'model_state_dict': aggregated_state,
        'aggregated_accuracy': final_accuracy,
        'num_workers': len(worker_data),
        'total_samples': total_samples,
        'individual_accuracies': {w['worker_id']: w['test_accuracy'] for w in worker_data}
    }, output_file)

    print(f"\n✅ Aggregated model saved to: {output_file}")

    # Save aggregation metrics
    metrics = {
        'aggregated_accuracy': final_accuracy,
        'average_individual_accuracy': avg_individual,
        'num_workers': len(worker_data),
        'total_samples': total_samples,
        'workers': [
            {
                'worker_id': w['worker_id'],
                'shard_size': w['shard_size'],
                'test_accuracy': w['test_accuracy']
            }
            for w in worker_data
        ]
    }

    metrics_file = results_path / 'aggregation_metrics.json'
    with open(metrics_file, 'w') as f:
        json.dump(metrics, f, indent=2)

    print(f"✅ Aggregation metrics saved to: {metrics_file}")

    return aggregated_model, final_accuracy

if __name__ == "__main__":
    aggregate_models()
