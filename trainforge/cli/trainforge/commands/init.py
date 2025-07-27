# File: trainforge/cli/trainforge/commands/init.py
# Initialize a new TrainForge project

import click
import os
from ..config import create_default_config

@click.command()
@click.option('--name', '-n', default=None, help='Project name')
@click.option('--force', '-f', is_flag=True, help='Overwrite existing trainforge.yaml')
def init(name, force):
    """Initialize a new TrainForge project"""
    
    config_file = 'trainforge.yaml'
    
    # Check if config already exists
    if os.path.exists(config_file) and not force:
        click.echo(click.style(
            f"❌ {config_file} already exists. Use --force to overwrite.", 
            fg='red'
        ))
        return
    
    # Get project name
    if not name:
        current_dir = os.path.basename(os.getcwd())
        name = click.prompt('Project name', default=current_dir)
    
    # Create default config
    try:
        config_content = create_default_config(name)
        
        with open(config_file, 'w') as f:
            f.write(config_content)
        
        click.echo(click.style(f"✅ Created {config_file}", fg='green'))
        click.echo("\nNext steps:")
        click.echo("1. Add your training script (train.py)")
        click.echo("2. Update trainforge.yaml with your requirements")
        click.echo("3. Run 'trainforge push' to submit your training job")
        
        # Create a basic train.py template if it doesn't exist
        if not os.path.exists('train.py'):
            create_basic_train_template()
            click.echo(click.style("✅ Created train.py template", fg='green'))
        
    except Exception as e:
        click.echo(click.style(f"❌ Failed to create config: {e}", fg='red'))

def create_basic_train_template():
    """Create a basic training script template"""
    template = '''# Basic training script template
# File: train.py

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader

def main():
    """Main training function"""
    print("🚀 Starting training...")
    
    # TODO: Add your model, data loading, and training logic here
    
    # Example: Simple training loop structure
    # model = YourModel()
    # optimizer = optim.Adam(model.parameters())
    # criterion = nn.CrossEntropyLoss()
    
    # for epoch in range(num_epochs):
    #     for batch_idx, (data, target) in enumerate(train_loader):
    #         optimizer.zero_grad()
    #         output = model(data)
    #         loss = criterion(output, target)
    #         loss.backward()
    #         optimizer.step()
    #         
    #         if batch_idx % 100 == 0:
    #             print(f'Epoch: {epoch}, Batch: {batch_idx}, Loss: {loss.item():.4f}')
    
    print("✅ Training completed!")

if __name__ == "__main__":
    main()
'''
    
    with open('train.py', 'w') as f:
        f.write(template)