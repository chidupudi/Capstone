# File: trainforge/cli/trainforge/commands/submit.py
# Submit a single script as a training job

import click
import os
import json
import yaml
from pathlib import Path
from ..api_client import TrainForgeAPIClient
from .push import display_job_info

def analyze_project(project_path):
    """Scan project files to determine resource requirements heuristically"""
    keywords = {
        'llm': ['transformers', 'peft', 'lora', 'datasets', 'accelerate', 'distilgpt', 'llama', 'gpt', 'qlora'],
        'gpu': ['torch', 'cuda', 'tensorflow', 'keras', 'pytorch']
    }
    
    found_flags = {'llm': False, 'gpu': False}
    project_dir = Path(project_path) if os.path.isdir(project_path) else Path(project_path).parent
    
    for ext in ['*.py', 'requirements.txt', 'environment.yml', 'Pipfile']:
        for file in project_dir.rglob(ext):
            try:
                with open(file, 'r', encoding='utf-8') as f:
                    content = f.read().lower()
                    for k in keywords['llm']:
                        if k in content: found_flags['llm'] = True
                    for k in keywords['gpu']:
                        if k in content: found_flags['gpu'] = True
            except Exception:
                pass
                
    return found_flags

@click.command()
@click.argument('script_path')
@click.option('--name', '-n', default='cli-project', help='Name of the project')
@click.option('--resources', '-r', default='{"gpu": 1}', help='Resources JSON (e.g. {"gpu": 1})')
@click.option('--workers', '-w', default=0, type=int, help='Number of workers for distributed training (0 for single node)')
def submit(script_path, name, resources, workers):
    """Submit a Python script as a training job"""
    
    click.echo(f"🚀 Submitting {script_path} as a training job...")
    
    try:
        if not os.path.exists(script_path):
            click.echo(click.style(
                f"❌ Script '{script_path}' not found!", 
                fg='red'
            ))
            return
            
        try:
            resources_dict = json.loads(resources)
        except json.JSONDecodeError:
            click.echo(click.style("❌ Invalid resources JSON format. Example: '{\"gpu\": 1}'", fg='red'))
            return
            
        # Read trainforge.yaml if it exists
        project_dir = script_path if os.path.isdir(script_path) else os.path.dirname(script_path)
        yaml_path = os.path.join(project_dir, 'trainforge.yaml')
        yaml_data = {}
        if os.path.exists(yaml_path):
            try:
                with open(yaml_path, 'r') as f:
                    yaml_data = yaml.safe_load(f) or {}
            except Exception as e:
                click.echo(click.style(f"⚠️ Could not parse trainforge.yaml: {e}", fg='yellow'))

        click.echo("🔍 Scanning project for smart resource allocation...")
        flags = analyze_project(script_path)
        
        # Determine resources based on YAML vs CLI vs Heuristics
        final_resources = yaml_data.get('resources', resources_dict)
        if flags['gpu'] or flags['llm']:
            final_resources['gpu'] = True
        elif not flags['gpu'] and 'gpu' not in yaml_data.get('resources', {}):
            final_resources['gpu'] = False
            
        if flags['llm']:
            click.echo("📦 Found Large Language Model dependencies.")
            click.echo("⏱️  Estimated Time: 15 - 45 minutes (based on typical LoRA fine-tuning).")
        elif flags['gpu']:
            click.echo("📦 Found Deep Learning frameworks.")
            click.echo("⏱️  Estimated Time: Variable based on dataset size.")
        else:
            click.echo("📦 Standard CPU Python workload detected.")
            click.echo("⏱️  Estimated Time: Expected quick completion.")
            
        if not click.confirm('\nSubmit this configuration to the cluster?'):
            click.echo("Canceled.")
            return

        # Parse run and install commands
        setup_cmd = yaml_data.get('setup_command', yaml_data.get('install', ''))
        
        # If script_path is a directory (like '.'), we can't just use its basename directly as the script flag.
        # We need the yaml configuration to dictate the run command.
        default_script = os.path.basename(os.path.abspath(script_path)) if not os.path.isdir(script_path) else 'main.py'
        run_cmd = yaml_data.get('command', yaml_data.get('run', default_script))
        if run_cmd.startswith('python '):
            run_cmd = run_cmd.split('python ')[1] # keep just the filename for compatibility
            
        # Build job configuration matching the Node.js implementation
        job_config = {
            'project': {'name': yaml_data.get('name', name)},
            'training': {
                'setup_command': setup_cmd,
                'script': run_cmd
            },
            'resources': final_resources
        }
        
        # Initialize API client
        api_client = TrainForgeAPIClient()
        
        # Check API server health
        if not api_client.health_check():
            click.echo(click.style(
                "❌ Cannot connect to TrainForge API server", 
                fg='red'
            ))
            return
            
        click.echo("📤 Uploading script...")
        
        # For distributed, Node CLI posts to a different endpoint, 
        # but let's see if api_client supports the endpoint swap
        # We will dynamically overwrite the endpoint if workers > 0.
        original_base_url = api_client.base_url
        
        try:
            if workers > 0:
                print(f"🔗 Setting up distributed job for {workers} workers")
                # Temporarily patch the submit method logic to use distributed endpoint
                # Since api_client hardcodes `/api/jobs`, we'll pass an extra arg to the config 
                # to let the server know, or we can just monkey-patch the request locally.
                # Actually, api_client.submit_job posts to `/api/jobs`. 
                # Let's add num_workers to the config payload, like the node JS CLI does via formData
                
                # The Node CLI appends to formData: formData.append('num_workers', options.workers);
                # And posts to: /api/jobs/distributed
                
                # Since we don't want to rewrite api_client right now, we can do a direct request here 
                # if it's distributed, or just let api_client.submit_job handle it if we updated it.
                # For simplicity, let's just do a direct requests call for distributed if workers > 0
                import requests
                from pathlib import Path
                zip_path = api_client._create_project_zip(script_path)
                try:
                    with open(zip_path, 'rb') as f:
                        response = api_client.session.post(
                            f"{api_client.base_url}/api/jobs/distributed",
                            files={'project_zip': ('project.zip', f, 'application/zip')},
                            data={'config': json.dumps(job_config), 'num_workers': str(workers)},
                            timeout=30
                        )
                        if response.status_code == 201:
                            job_data = response.json()
                        else:
                            raise Exception(f"Job submission failed: {response.text}")
                finally:
                    if os.path.exists(zip_path):
                        os.unlink(zip_path)
            else:
                job_data = api_client.submit_job(job_config, script_path)

            click.echo(click.style(f"✅ Job submitted successfully!", fg='green'))
            click.echo(f"🆔 Job ID: {job_data.get('job_id')}")
            
            # Display job details
            display_job_info(job_data)
            
            click.echo(f"\n💡 Track your job: trainforge status {job_data.get('job_id')}")
            
        except Exception as e:
            click.echo(click.style(f"❌ Job submission failed: {e}", fg='red'))
            
    except Exception as e:
        click.echo(click.style(f"❌ Error: {e}", fg='red'))
