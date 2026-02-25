# File: trainforge/cli/trainforge/commands/results.py
# Download training results from completed jobs

import click
import os
import sys
import zipfile
from pathlib import Path
from ..api_client import TrainForgeAPIClient
from colorama import Fore, Style

@click.command()
@click.argument('job_id')
@click.option('--output', '-o', default=None, help='Output directory (default: ./results/<job_id>)')
@click.option('--extract/--no-extract', default=True, help='Extract results (default: yes)')
def results(job_id, output, extract):
    """
    📥 Download training results from a completed job

    Examples:
        trainforge results abc123                    # Download and extract
        trainforge results abc123 -o ./my-results   # Custom output dir
        trainforge results abc123 --no-extract      # Download zip only
    """

    print(f"{Fore.CYAN}📥 Downloading results for job: {job_id}{Style.RESET_ALL}\n")

    try:
        # Initialize API client
        client = TrainForgeAPIClient()

        # Check if job exists and is completed
        print(f"{Fore.YELLOW}🔍 Checking job status...{Style.RESET_ALL}")
        job_status = client.get_job_status(job_id)

        if not job_status:
            print(f"{Fore.RED}❌ Job not found: {job_id}{Style.RESET_ALL}")
            sys.exit(1)

        if job_status.get('status') != 'completed':
            status = job_status.get('status', 'unknown')
            print(f"{Fore.YELLOW}⚠️  Job status: {status}{Style.RESET_ALL}")
            print(f"{Fore.YELLOW}💡 Results are only available for completed jobs{Style.RESET_ALL}")

            if status == 'pending':
                print(f"{Fore.CYAN}   Job is waiting to be processed{Style.RESET_ALL}")
            elif status == 'running':
                print(f"{Fore.CYAN}   Job is currently running{Style.RESET_ALL}")
            elif status == 'failed':
                print(f"{Fore.RED}   Job failed during execution{Style.RESET_ALL}")

            sys.exit(1)

        print(f"{Fore.GREEN}✅ Job completed successfully{Style.RESET_ALL}\n")

        # Determine output directory
        if output:
            output_dir = Path(output)
        else:
            output_dir = Path.cwd() / 'results' / job_id

        output_dir.mkdir(parents=True, exist_ok=True)

        # Download results
        print(f"{Fore.CYAN}📥 Downloading results...{Style.RESET_ALL}")
        zip_path = output_dir / 'results.zip'

        success = client.download_results(job_id, str(zip_path))

        if not success:
            print(f"{Fore.RED}❌ Failed to download results{Style.RESET_ALL}")
            print(f"{Fore.YELLOW}💡 Results may not have been uploaded yet{Style.RESET_ALL}")
            sys.exit(1)

        file_size = zip_path.stat().st_size / 1024 / 1024
        print(f"{Fore.GREEN}✅ Downloaded results.zip ({file_size:.2f} MB){Style.RESET_ALL}")

        # Extract if requested
        if extract:
            print(f"{Fore.CYAN}📦 Extracting results...{Style.RESET_ALL}")

            try:
                with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                    # List files
                    files = zip_ref.namelist()
                    print(f"{Fore.CYAN}   Found {len(files)} files:{Style.RESET_ALL}")

                    for file in files:
                        file_info = zip_ref.getinfo(file)
                        size_kb = file_info.file_size / 1024
                        print(f"      - {file} ({size_kb:.1f} KB)")

                    # Extract
                    zip_ref.extractall(output_dir)

                print(f"{Fore.GREEN}✅ Results extracted to: {output_dir}{Style.RESET_ALL}")

                # Remove zip file after extraction
                zip_path.unlink()

            except zipfile.BadZipFile:
                print(f"{Fore.RED}❌ Error: Downloaded file is not a valid zip{Style.RESET_ALL}")
                sys.exit(1)
            except Exception as e:
                print(f"{Fore.RED}❌ Error extracting results: {e}{Style.RESET_ALL}")
                sys.exit(1)
        else:
            print(f"{Fore.GREEN}✅ Results saved to: {zip_path}{Style.RESET_ALL}")

        # Show summary
        print(f"\n{Fore.CYAN}📊 Results Summary:{Style.RESET_ALL}")
        print(f"{'='*50}")
        print(f"Job ID:        {job_id}")
        print(f"Project:       {job_status.get('project_name', 'N/A')}")
        print(f"Location:      {output_dir}")

        if extract:
            # Count files by type
            model_files = list(output_dir.glob('*.pth')) + list(output_dir.glob('*.pt')) + list(output_dir.glob('*.h5'))
            json_files = list(output_dir.glob('*.json'))

            print(f"Model files:   {len(model_files)}")
            for f in model_files:
                print(f"   - {f.name}")

            print(f"Result files:  {len(json_files)}")
            for f in json_files:
                print(f"   - {f.name}")

        print(f"{'='*50}\n")

        print(f"{Fore.GREEN}🎉 Results downloaded successfully!{Style.RESET_ALL}")

    except KeyboardInterrupt:
        print(f"\n{Fore.YELLOW}⚠️  Download cancelled by user{Style.RESET_ALL}")
        sys.exit(1)
    except Exception as e:
        print(f"{Fore.RED}❌ Error: {e}{Style.RESET_ALL}")
        sys.exit(1)
