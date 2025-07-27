# File: trainforge/cli/trainforge/main.py
# Main CLI entry point - coordinates all commands

import click
from colorama import init as colorama_init
from .commands.init import init
from .commands.push import push  
from .commands.status import status

# Initialize colorama for cross-platform colored output
colorama_init()

@click.group()
@click.version_option(version='0.1.0', prog_name='TrainForge CLI')
def cli():
    """
    🚀 TrainForge CLI - Distributed AI Training Platform
    
    A simple command-line tool for submitting and managing AI training jobs.
    
    Examples:
      trainforge init                    # Initialize new project
      trainforge push                    # Submit training job  
      trainforge status                  # Check recent jobs
      trainforge status <job_id>         # Check specific job
    """
    pass

# Register all commands
cli.add_command(init)
cli.add_command(push)
cli.add_command(status)

# Add some helpful aliases
@cli.command()
def version():
    """Show TrainForge CLI version"""
    click.echo("TrainForge CLI v0.1.0")
    click.echo("🚀 Distributed AI Training Platform")

if __name__ == '__main__':
    cli()