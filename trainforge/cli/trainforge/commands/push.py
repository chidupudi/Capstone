# File: trainforge/cli/trainforge/commands/push.py
# Submit training job to TrainForge platform

import click
import os
from ..config import TrainForgeConfig
from ..api_client import TrainForgeAPIClient
from tabulate import tabulate

@click.command()
@click.option('--config', '-c', default='trainforge.yaml', help='Config file path')
@click.option('--project-path', '-p', default='.', help='Project directory path')
def push(config, project_path):
    """Submit training job to TrainForge"""
    
    click.echo("🚀 Submitting training job...")
    
    try:
        # Load configuration
        config_parser = TrainForgeConfig(config)
        job_config = config_parser.load()
        
        click.echo(f"📁 Project: {config_parser.get_project_name()}")
        click.echo(f"🐍 Script: {config_parser.get_training_script()}")
        
        # Check if training script exists
        script_path = os.path.join(project_path, config_parser.get_training_script())
        if not os.path.exists(script_path):
            click.echo(click.style(
                f"❌ Training script '{script_path}' not found!", 
                fg='red'
            ))
            return
        
        # Initialize API client
        api_client = TrainForgeAPIClient()
        
        # Check API server health
        if not api_client.health_check():
            click.echo(click.style(
                "❌ Cannot connect to TrainForge API server at http://localhost:3000", 
                fg='red'
            ))
            click.echo("💡 Make sure the API server is running:")
            click.echo("   cd trainforge/api && npm start")
            return
        
        # Submit job
        click.echo("📤 Uploading project files...")
        response = api_client.submit_job(job_config, project_path)
        
        job_id = response.get('job_id')
        click.echo(click.style(f"✅ Job submitted successfully!", fg='green'))
        click.echo(f"🆔 Job ID: {job_id}")
        
        # Display job details
        display_job_info(response)
        
        click.echo(f"\n💡 Track your job: trainforge status {job_id}")
        click.echo("🔗 Dashboard: http://localhost:3001")
        
    except FileNotFoundError as e:
        click.echo(click.style(f"❌ {e}", fg='red'))
    except Exception as e:
        click.echo(click.style(f"❌ Job submission failed: {e}", fg='red'))

def display_job_info(job_data):
    """Display formatted job information"""
    table_data = [
        ["Job ID", job_data.get('job_id', 'N/A')],
        ["Project", job_data.get('project_name', 'N/A')],
        ["Status", job_data.get('status', 'pending')],
        ["GPU Required", job_data.get('resources', {}).get('gpu', 1)],
        ["Memory", job_data.get('resources', {}).get('memory', '4Gi')],
        ["Created", job_data.get('created_at', 'N/A')]
    ]
    
    click.echo("\n📊 Job Details:")
    click.echo(tabulate(table_data, headers=["Field", "Value"], tablefmt="grid"))