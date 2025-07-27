# File: trainforge/cli/trainforge/commands/status.py
# Check status of training jobs

import click
from ..api_client import TrainForgeAPIClient
from tabulate import tabulate

@click.command()
@click.argument('job_id', required=False)
@click.option('--all', '-a', is_flag=True, help='Show all jobs')
def status(job_id, all):
    """Check training job status"""
    
    api_client = TrainForgeAPIClient()
    
    # Check API server health
    if not api_client.health_check():
        click.echo(click.style(
            "❌ Cannot connect to TrainForge API server", 
            fg='red'
        ))
        return
    
    try:
        if job_id:
            # Show specific job status
            show_job_status(api_client, job_id)
        elif all:
            # Show all jobs
            show_all_jobs(api_client)
        else:
            # Show recent jobs by default
            show_recent_jobs(api_client)
            
    except Exception as e:
        click.echo(click.style(f"❌ Failed to get job status: {e}", fg='red'))

def show_job_status(api_client, job_id):
    """Show detailed status for a specific job"""
    click.echo(f"🔍 Checking job: {job_id}")
    
    job_data = api_client.get_job_status(job_id)
    
    # Job details table
    details = [
        ["Job ID", job_data.get('job_id')],
        ["Project", job_data.get('project_name')],
        ["Status", format_status(job_data.get('status'))],
        ["Progress", f"{job_data.get('progress', 0)}%"],
        ["GPU Allocated", job_data.get('gpu_id', 'N/A')],
        ["Started", job_data.get('started_at', 'N/A')],
        ["Duration", job_data.get('duration', 'N/A')],
    ]
    
    click.echo("\n📊 Job Status:")
    click.echo(tabulate(details, headers=["Field", "Value"], tablefmt="grid"))
    
    # Show recent logs if available
    if 'logs' in job_data and job_data['logs']:
        click.echo("\n📝 Recent Logs:")
        for log_line in job_data['logs'][-5:]:  # Last 5 lines
            click.echo(f"  {log_line}")

def show_all_jobs(api_client):
    """Show all jobs in a table format"""
    click.echo("📋 All Training Jobs:")
    
    response = api_client.list_jobs()
    jobs = response.get('jobs', [])
    
    if not jobs:
        click.echo("No jobs found.")
        return
    
    table_data = []
    for job in jobs:
        table_data.append([
            job.get('job_id', '')[:8] + '...',  # Shortened ID
            job.get('project_name', 'N/A'),
            format_status(job.get('status')),
            f"{job.get('progress', 0)}%",
            job.get('created_at', 'N/A')
        ])
    
    headers = ["Job ID", "Project", "Status", "Progress", "Created"]
    click.echo(tabulate(table_data, headers=headers, tablefmt="grid"))

def show_recent_jobs(api_client):
    """Show recent jobs (default behavior)"""
    click.echo("📋 Recent Training Jobs:")
    
    response = api_client.list_jobs()
    jobs = response.get('jobs', [])
    
    if not jobs:
        click.echo("No jobs found. Submit your first job with 'trainforge push'")
        return
    
    # Show only last 5 jobs
    recent_jobs = jobs[-5:]
    
    table_data = []
    for job in recent_jobs:
        table_data.append([
            job.get('job_id', '')[:12],  # Shortened ID
            job.get('project_name', 'N/A'),
            format_status(job.get('status')),
            f"{job.get('progress', 0)}%",
            job.get('created_at', 'N/A')
        ])
    
    headers = ["Job ID", "Project", "Status", "Progress", "Created"]
    click.echo(tabulate(table_data, headers=headers, tablefmt="grid"))
    
    click.echo(f"\n💡 Use 'trainforge status --all' to see all jobs")
    click.echo(f"💡 Use 'trainforge status <job_id>' for detailed info")

def format_status(status):
    """Format job status with colors"""
    status_colors = {
        'pending': 'yellow',
        'running': 'blue', 
        'completed': 'green',
        'failed': 'red',
        'cancelled': 'magenta'
    }
    
    color = status_colors.get(status, 'white')
    return click.style(status.upper(), fg=color)