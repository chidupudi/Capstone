#!/usr/bin/env python3
# File: examples/distributed-image-classification/train.py
# Distributed ResNet-50 training on CIFAR-100

import os
import sys
import time
import json
import torch
import torch.nn as nn
import torch.optim as optim
import torch.distributed as dist
from torch.nn.parallel import DistributedDataParallel as DDP
from torch.utils.data import DataLoader
from torch.utils.data.distributed import DistributedSampler
import torchvision
import torchvision.transforms as transforms
from torch.cuda.amp import autocast, GradScaler

def setup_distributed():
    """Setup distributed training"""
    if 'RANK' in os.environ and 'WORLD_SIZE' in os.environ:
        rank = int(os.environ['RANK'])
        world_size = int(os.environ['WORLD_SIZE'])

        # Initialize distributed training
        dist.init_process_group(
            backend='nccl',
            init_method='env://',
            world_size=world_size,
            rank=rank
        )

        # Set device
        local_rank = rank % torch.cuda.device_count()
        torch.cuda.set_device(local_rank)

        return rank, world_size, local_rank
    else:
        # Single GPU training
        device_id = 0
        if torch.cuda.is_available():
            torch.cuda.set_device(device_id)
        return 0, 1, device_id

def create_model(num_classes=100):
    """Create ResNet-50 model"""
    print(f"🧠 Creating ResNet-50 model for {num_classes} classes")

    model = torchvision.models.resnet50(pretrained=False)
    model.fc = nn.Linear(model.fc.in_features, num_classes)

    return model

def create_data_loaders(batch_size, num_workers=4, distributed=False):
    """Create CIFAR-100 data loaders"""
    print(f"📊 Creating CIFAR-100 data loaders (batch_size={batch_size})")

    # Data augmentation
    if os.getenv('AUGMENTATION', 'standard') == 'heavy':
        train_transform = transforms.Compose([
            transforms.RandomCrop(32, padding=4),
            transforms.RandomHorizontalFlip(),
            transforms.RandomRotation(15),
            transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2, hue=0.1),
            transforms.ToTensor(),
            transforms.Normalize((0.5071, 0.4867, 0.4408), (0.2675, 0.2565, 0.2761))
        ])
    else:
        train_transform = transforms.Compose([
            transforms.RandomCrop(32, padding=4),
            transforms.RandomHorizontalFlip(),
            transforms.ToTensor(),
            transforms.Normalize((0.5071, 0.4867, 0.4408), (0.2675, 0.2565, 0.2761))
        ])

    val_transform = transforms.Compose([
        transforms.ToTensor(),
        transforms.Normalize((0.5071, 0.4867, 0.4408), (0.2675, 0.2565, 0.2761))
    ])

    # Datasets
    train_dataset = torchvision.datasets.CIFAR100(
        root='./data', train=True, download=True, transform=train_transform
    )

    val_dataset = torchvision.datasets.CIFAR100(
        root='./data', train=False, download=True, transform=val_transform
    )

    # Samplers for distributed training
    train_sampler = DistributedSampler(train_dataset) if distributed else None
    val_sampler = DistributedSampler(val_dataset, shuffle=False) if distributed else None

    # Data loaders
    train_loader = DataLoader(
        train_dataset,
        batch_size=batch_size,
        shuffle=(train_sampler is None),
        sampler=train_sampler,
        num_workers=num_workers,
        pin_memory=True
    )

    val_loader = DataLoader(
        val_dataset,
        batch_size=batch_size,
        shuffle=False,
        sampler=val_sampler,
        num_workers=num_workers,
        pin_memory=True
    )

    return train_loader, val_loader, train_sampler

def create_optimizer(model, learning_rate=0.1, weight_decay=1e-4, momentum=0.9):
    """Create optimizer"""
    optimizer_name = os.getenv('OPTIMIZER', 'sgd').lower()

    if optimizer_name == 'adamw':
        optimizer = optim.AdamW(
            model.parameters(),
            lr=learning_rate,
            weight_decay=weight_decay
        )
    else:  # SGD
        optimizer = optim.SGD(
            model.parameters(),
            lr=learning_rate,
            momentum=momentum,
            weight_decay=weight_decay
        )

    return optimizer

def create_scheduler(optimizer, epochs=200):
    """Create learning rate scheduler"""
    # Cosine annealing with warm restart
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)
    return scheduler

def train_epoch(model, train_loader, optimizer, criterion, epoch, device,
                scaler=None, log_interval=100, gradient_clip=None):
    """Train for one epoch"""
    model.train()
    total_loss = 0.0
    correct = 0
    total = 0

    for batch_idx, (data, target) in enumerate(train_loader):
        data, target = data.to(device), target.to(device)

        optimizer.zero_grad()

        if scaler is not None:  # Mixed precision
            with autocast():
                output = model(data)
                loss = criterion(output, target)

            scaler.scale(loss).backward()

            if gradient_clip:
                scaler.unscale_(optimizer)
                torch.nn.utils.clip_grad_norm_(model.parameters(), gradient_clip)

            scaler.step(optimizer)
            scaler.update()
        else:  # Full precision
            output = model(data)
            loss = criterion(output, target)
            loss.backward()

            if gradient_clip:
                torch.nn.utils.clip_grad_norm_(model.parameters(), gradient_clip)

            optimizer.step()

        # Statistics
        total_loss += loss.item()
        pred = output.argmax(dim=1, keepdim=True)
        correct += pred.eq(target.view_as(pred)).sum().item()
        total += target.size(0)

        # Logging
        if batch_idx % log_interval == 0:
            accuracy = 100.0 * correct / total
            print(f'Epoch {epoch}, Batch {batch_idx:5d}/{len(train_loader)}, '
                  f'Loss: {loss.item():.6f}, Accuracy: {accuracy:.2f}%')

    avg_loss = total_loss / len(train_loader)
    accuracy = 100.0 * correct / total

    return avg_loss, accuracy

def validate(model, val_loader, criterion, device):
    """Validate the model"""
    model.eval()
    total_loss = 0.0
    correct = 0
    total = 0

    with torch.no_grad():
        for data, target in val_loader:
            data, target = data.to(device), target.to(device)

            output = model(data)
            loss = criterion(output, target)

            total_loss += loss.item()
            pred = output.argmax(dim=1, keepdim=True)
            correct += pred.eq(target.view_as(pred)).sum().item()
            total += target.size(0)

    avg_loss = total_loss / len(val_loader)
    accuracy = 100.0 * correct / total

    return avg_loss, accuracy

def save_checkpoint(model, optimizer, scheduler, epoch, best_accuracy, filepath):
    """Save training checkpoint"""
    checkpoint = {
        'epoch': epoch,
        'model_state_dict': model.state_dict(),
        'optimizer_state_dict': optimizer.state_dict(),
        'scheduler_state_dict': scheduler.state_dict(),
        'best_accuracy': best_accuracy,
    }
    torch.save(checkpoint, filepath)
    print(f"💾 Checkpoint saved: {filepath}")

def load_checkpoint(model, optimizer, scheduler, filepath):
    """Load training checkpoint"""
    if os.path.exists(filepath):
        checkpoint = torch.load(filepath)
        model.load_state_dict(checkpoint['model_state_dict'])
        optimizer.load_state_dict(checkpoint['optimizer_state_dict'])
        scheduler.load_state_dict(checkpoint['scheduler_state_dict'])
        return checkpoint['epoch'], checkpoint['best_accuracy']
    return 0, 0.0

def main():
    """Main training function"""
    print("🚀 Starting distributed CIFAR-100 ResNet-50 training")

    # Get TrainForge job info
    job_id = os.environ.get('TRAINFORGE_JOB_ID', 'local')
    print(f"🆔 Job ID: {job_id}")

    # Setup distributed training
    rank, world_size, local_rank = setup_distributed()
    device = torch.device(f'cuda:{local_rank}' if torch.cuda.is_available() else 'cpu')

    print(f"🌐 Rank {rank}/{world_size}, Device: {device}")

    # Hyperparameters from environment
    batch_size = int(os.getenv('BATCH_SIZE', 256)) // world_size  # Per-GPU batch size
    epochs = int(os.getenv('EPOCHS', 200))
    learning_rate = float(os.getenv('LEARNING_RATE', 0.1))
    weight_decay = float(os.getenv('WEIGHT_DECAY', 1e-4))
    momentum = float(os.getenv('MOMENTUM', 0.9))
    num_classes = int(os.getenv('NUM_CLASSES', 100))

    # Training configuration
    mixed_precision = os.getenv('MIXED_PRECISION', 'true').lower() == 'true'
    gradient_clip = float(os.getenv('GRADIENT_CLIPPING', 1.0))
    log_interval = int(os.getenv('LOG_INTERVAL', 100))
    checkpoint_interval = int(os.getenv('CHECKPOINT_INTERVAL', 20))
    save_best = os.getenv('SAVE_BEST', 'true').lower() == 'true'

    print(f"⚙️ Configuration:")
    print(f"   Batch size (per GPU): {batch_size}")
    print(f"   Total batch size: {batch_size * world_size}")
    print(f"   Epochs: {epochs}")
    print(f"   Learning rate: {learning_rate}")
    print(f"   Mixed precision: {mixed_precision}")

    # Create model
    model = create_model(num_classes)
    model = model.to(device)

    # Wrap model for distributed training
    if world_size > 1:
        if os.getenv('SYNC_BN', 'true').lower() == 'true':
            model = nn.SyncBatchNorm.convert_sync_batchnorm(model)
        model = DDP(model, device_ids=[local_rank])

    # Create data loaders
    train_loader, val_loader, train_sampler = create_data_loaders(
        batch_size,
        num_workers=4,
        distributed=(world_size > 1)
    )

    # Create optimizer and scheduler
    optimizer = create_optimizer(model, learning_rate, weight_decay, momentum)
    scheduler = create_scheduler(optimizer, epochs)
    criterion = nn.CrossEntropyLoss()

    # Mixed precision scaler
    scaler = GradScaler() if mixed_precision else None

    # Load checkpoint if exists
    checkpoint_path = f'checkpoint_rank_{rank}.pth'
    start_epoch, best_accuracy = load_checkpoint(model, optimizer, scheduler, checkpoint_path)

    print(f"📈 Starting training from epoch {start_epoch + 1}")

    # Training loop
    training_stats = []

    for epoch in range(start_epoch + 1, epochs + 1):
        start_time = time.time()

        # Set epoch for distributed sampler
        if train_sampler is not None:
            train_sampler.set_epoch(epoch)

        # Train
        train_loss, train_accuracy = train_epoch(
            model, train_loader, optimizer, criterion, epoch, device,
            scaler, log_interval, gradient_clip
        )

        # Validate
        val_loss, val_accuracy = validate(model, val_loader, criterion, device)

        # Update scheduler
        scheduler.step()

        epoch_time = time.time() - start_time

        # Print progress (only rank 0)
        if rank == 0:
            print(f"\n📊 Epoch {epoch}/{epochs} Summary:")
            print(f"   Train Loss: {train_loss:.6f}, Train Acc: {train_accuracy:.2f}%")
            print(f"   Val Loss: {val_loss:.6f}, Val Acc: {val_accuracy:.2f}%")
            print(f"   Learning Rate: {scheduler.get_last_lr()[0]:.6f}")
            print(f"   Epoch Time: {epoch_time:.2f}s")
            print(f"   Best Accuracy: {max(best_accuracy, val_accuracy):.2f}%")

        # Save best model
        if val_accuracy > best_accuracy:
            best_accuracy = val_accuracy
            if rank == 0 and save_best:
                torch.save(model.state_dict(), 'best_model.pth')
                print(f"🏆 New best model saved! Accuracy: {best_accuracy:.2f}%")

        # Save checkpoint
        if epoch % checkpoint_interval == 0 and rank == 0:
            save_checkpoint(model, optimizer, scheduler, epoch, best_accuracy, checkpoint_path)

        # Save training stats
        if rank == 0:
            stats = {
                'epoch': epoch,
                'train_loss': train_loss,
                'train_accuracy': train_accuracy,
                'val_loss': val_loss,
                'val_accuracy': val_accuracy,
                'learning_rate': scheduler.get_last_lr()[0],
                'epoch_time': epoch_time,
                'best_accuracy': best_accuracy
            }
            training_stats.append(stats)

            # Save stats to file
            with open('training_stats.json', 'w') as f:
                json.dump(training_stats, f, indent=2)

    # Final results
    if rank == 0:
        print(f"\n🎉 Training completed!")
        print(f"   Final validation accuracy: {val_accuracy:.2f}%")
        print(f"   Best validation accuracy: {best_accuracy:.2f}%")
        print(f"   Total training time: {sum(s['epoch_time'] for s in training_stats):.1f}s")

        # Save final model
        torch.save(model.state_dict(), 'final_model.pth')
        print(f"💾 Final model saved: final_model.pth")

    # Cleanup distributed
    if world_size > 1:
        dist.destroy_process_group()

if __name__ == "__main__":
    main()