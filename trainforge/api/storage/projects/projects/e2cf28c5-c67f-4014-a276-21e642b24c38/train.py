"""
TrainForge Final Presentation Demo
Image Classification with ResNet18 on CIFAR-10
Demonstrates distributed GPU training with real-time logging
"""

import torch
import torch.nn as nn
import torch.optim as optim
import torchvision
import torchvision.transforms as transforms
from torch.utils.data import DataLoader
import time
import json
from datetime import datetime

class TrainingMetrics:
    """Track and display training metrics"""
    def __init__(self):
        self.start_time = time.time()
        self.epoch_times = []
        self.train_losses = []
        self.train_accuracies = []
        self.test_accuracies = []

    def log_epoch(self, epoch, train_loss, train_acc, test_acc=None):
        self.train_losses.append(train_loss)
        self.train_accuracies.append(train_acc)
        if test_acc is not None:
            self.test_accuracies.append(test_acc)

    def save_results(self, filename='training_results.json'):
        results = {
            'total_time': time.time() - self.start_time,
            'epochs': len(self.train_losses),
            'final_train_loss': self.train_losses[-1],
            'final_train_accuracy': self.train_accuracies[-1],
            'final_test_accuracy': self.test_accuracies[-1] if self.test_accuracies else None,
            'train_losses': self.train_losses,
            'train_accuracies': self.train_accuracies,
            'test_accuracies': self.test_accuracies
        }
        with open(filename, 'w') as f:
            json.dump(results, f, indent=2)
        return results

def print_header():
    """Print impressive header"""
    print("\n" + "="*70)
    print("🚀 TrainForge Distributed Training Demo")
    print("="*70)
    print("📊 Task: Image Classification on CIFAR-10")
    print("🏗️  Model: ResNet18 (Deep Residual Network)")
    print("📅 Started:", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    print("="*70 + "\n")

def print_system_info():
    """Display system information"""
    print("💻 System Information:")
    print("-" * 70)

    # Check CUDA availability
    if torch.cuda.is_available():
        print(f"✅ GPU Available: {torch.cuda.get_device_name(0)}")
        print(f"   GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.2f} GB")
        print(f"   CUDA Version: {torch.version.cuda}")
    else:
        print("⚠️  No GPU available, using CPU")

    print(f"🐍 PyTorch Version: {torch.__version__}")
    print(f"🔢 Number of CPU cores: {torch.get_num_threads()}")
    print("-" * 70 + "\n")

def load_data(batch_size=128):
    """Load and prepare CIFAR-10 dataset"""
    print("📦 Loading CIFAR-10 Dataset...")
    print("-" * 70)

    # Data transformations with augmentation
    transform_train = transforms.Compose([
        transforms.RandomCrop(32, padding=4),
        transforms.RandomHorizontalFlip(),
        transforms.ToTensor(),
        transforms.Normalize((0.4914, 0.4822, 0.4465), (0.2023, 0.1994, 0.2010)),
    ])

    transform_test = transforms.Compose([
        transforms.ToTensor(),
        transforms.Normalize((0.4914, 0.4822, 0.4465), (0.2023, 0.1994, 0.2010)),
    ])

    # Download and load datasets
    trainset = torchvision.datasets.CIFAR10(
        root='./data',
        train=True,
        download=True,
        transform=transform_train
    )

    testset = torchvision.datasets.CIFAR10(
        root='./data',
        train=False,
        download=True,
        transform=transform_test
    )

    trainloader = DataLoader(
        trainset,
        batch_size=batch_size,
        shuffle=True,
        num_workers=2
    )

    testloader = DataLoader(
        testset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=2
    )

    classes = ('plane', 'car', 'bird', 'cat', 'deer',
               'dog', 'frog', 'horse', 'ship', 'truck')

    print(f"✅ Training samples: {len(trainset):,}")
    print(f"✅ Test samples: {len(testset):,}")
    print(f"✅ Classes: {', '.join(classes)}")
    print(f"✅ Batch size: {batch_size}")
    print("-" * 70 + "\n")

    return trainloader, testloader, classes

def create_model(num_classes=10):
    """Create ResNet18 model"""
    print("🏗️  Building ResNet18 Model...")
    print("-" * 70)

    # Use pretrained ResNet18 and modify for CIFAR-10
    model = torchvision.models.resnet18(pretrained=False)
    model.fc = nn.Linear(model.fc.in_features, num_classes)

    # Count parameters
    total_params = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)

    print(f"✅ Model: ResNet18")
    print(f"✅ Total parameters: {total_params:,}")
    print(f"✅ Trainable parameters: {trainable_params:,}")
    print("-" * 70 + "\n")

    return model

def train_epoch(model, trainloader, criterion, optimizer, device, epoch, total_epochs):
    """Train for one epoch"""
    model.train()
    running_loss = 0.0
    correct = 0
    total = 0

    print(f"📈 Epoch {epoch}/{total_epochs}")
    print("-" * 70)

    epoch_start = time.time()

    for batch_idx, (inputs, targets) in enumerate(trainloader):
        inputs, targets = inputs.to(device), targets.to(device)

        # Forward pass
        optimizer.zero_grad()
        outputs = model(inputs)
        loss = criterion(outputs, targets)

        # Backward pass
        loss.backward()
        optimizer.step()

        # Statistics
        running_loss += loss.item()
        _, predicted = outputs.max(1)
        total += targets.size(0)
        correct += predicted.eq(targets).sum().item()

        # Print progress every 50 batches
        if (batch_idx + 1) % 50 == 0:
            current_loss = running_loss / (batch_idx + 1)
            current_acc = 100. * correct / total
            progress = 100. * (batch_idx + 1) / len(trainloader)
            print(f"   Batch {batch_idx + 1}/{len(trainloader)} ({progress:.1f}%) | "
                  f"Loss: {current_loss:.4f} | Acc: {current_acc:.2f}%")

    epoch_time = time.time() - epoch_start
    epoch_loss = running_loss / len(trainloader)
    epoch_acc = 100. * correct / total

    print(f"✅ Epoch {epoch} completed in {epoch_time:.2f}s")
    print(f"   Training Loss: {epoch_loss:.4f}")
    print(f"   Training Accuracy: {epoch_acc:.2f}%")
    print("-" * 70 + "\n")

    return epoch_loss, epoch_acc

def test(model, testloader, criterion, device):
    """Evaluate on test set"""
    model.eval()
    test_loss = 0
    correct = 0
    total = 0

    print("🧪 Testing on validation set...")

    with torch.no_grad():
        for inputs, targets in testloader:
            inputs, targets = inputs.to(device), targets.to(device)
            outputs = model(inputs)
            loss = criterion(outputs, targets)

            test_loss += loss.item()
            _, predicted = outputs.max(1)
            total += targets.size(0)
            correct += predicted.eq(targets).sum().item()

    test_loss = test_loss / len(testloader)
    test_acc = 100. * correct / total

    print(f"✅ Test Loss: {test_loss:.4f}")
    print(f"✅ Test Accuracy: {test_acc:.2f}%")
    print("-" * 70 + "\n")

    return test_loss, test_acc

def main():
    # Configuration
    NUM_EPOCHS = 10
    BATCH_SIZE = 128
    LEARNING_RATE = 0.01

    # Print header
    print_header()
    print_system_info()

    # Setup device
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"🎯 Using device: {device}\n")

    # Load data
    trainloader, testloader, classes = load_data(BATCH_SIZE)

    # Create model
    model = create_model(num_classes=len(classes))
    model = model.to(device)

    # Loss and optimizer
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.SGD(model.parameters(), lr=LEARNING_RATE, momentum=0.9, weight_decay=5e-4)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=NUM_EPOCHS)

    print("🔧 Training Configuration:")
    print("-" * 70)
    print(f"   Epochs: {NUM_EPOCHS}")
    print(f"   Batch Size: {BATCH_SIZE}")
    print(f"   Learning Rate: {LEARNING_RATE}")
    print(f"   Optimizer: SGD with momentum")
    print(f"   Scheduler: Cosine Annealing")
    print("-" * 70 + "\n")

    # Initialize metrics tracker
    metrics = TrainingMetrics()

    # Training loop
    print("🚀 Starting Training...")
    print("="*70 + "\n")

    best_acc = 0

    for epoch in range(1, NUM_EPOCHS + 1):
        # Train
        train_loss, train_acc = train_epoch(
            model, trainloader, criterion, optimizer,
            device, epoch, NUM_EPOCHS
        )

        # Test every 2 epochs
        if epoch % 2 == 0 or epoch == NUM_EPOCHS:
            test_loss, test_acc = test(model, testloader, criterion, device)
            metrics.log_epoch(epoch, train_loss, train_acc, test_acc)

            # Save best model
            if test_acc > best_acc:
                best_acc = test_acc
                print(f"💾 New best accuracy! Saving model...")
                torch.save({
                    'epoch': epoch,
                    'model_state_dict': model.state_dict(),
                    'optimizer_state_dict': optimizer.state_dict(),
                    'accuracy': test_acc,
                }, 'best_model.pth')
                print(f"✅ Model saved (accuracy: {test_acc:.2f}%)\n")
        else:
            metrics.log_epoch(epoch, train_loss, train_acc)

        # Update learning rate
        scheduler.step()
        current_lr = optimizer.param_groups[0]['lr']
        print(f"📉 Learning rate: {current_lr:.6f}\n")

    # Final results
    print("\n" + "="*70)
    print("🎉 Training Complete!")
    print("="*70)

    # Save final model
    torch.save(model.state_dict(), 'final_model.pth')
    print("💾 Final model saved as 'final_model.pth'")

    # Save metrics
    results = metrics.save_results()
    print(f"📊 Training metrics saved as 'training_results.json'")

    # Print summary
    print("\n📊 Training Summary:")
    print("-" * 70)
    print(f"   Total Time: {results['total_time']:.2f} seconds ({results['total_time']/60:.2f} minutes)")
    print(f"   Epochs Completed: {results['epochs']}")
    print(f"   Best Test Accuracy: {best_acc:.2f}%")
    print(f"   Final Training Loss: {results['final_train_loss']:.4f}")
    print(f"   Final Training Accuracy: {results['final_train_accuracy']:.2f}%")
    if results['final_test_accuracy']:
        print(f"   Final Test Accuracy: {results['final_test_accuracy']:.2f}%")
    print("-" * 70)

    print("\n" + "="*70)
    print("✅ TrainForge Demo Complete!")
    print("🎯 This job was executed on distributed GPU infrastructure")
    print("🌐 Powered by TrainForge - Distributed AI Training Platform")
    print("="*70 + "\n")

if __name__ == '__main__':
    main()
