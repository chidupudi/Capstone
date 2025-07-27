# File: trainforge/cli/trainforge/api_client.py
# Handles communication with the TrainForge API server

import requests
import json
import os
import zipfile
import tempfile
from typing import Dict, Any, Optional
from pathlib import Path

class TrainForgeAPIClient:
    """Client for communicating with TrainForge API"""
    
    def __init__(self, base_url: str = "http://localhost:3000"):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        
        # TODO: Add authentication headers when implemented
        # self.session.headers.update({'Authorization': f'Bearer {token}'})
    
    def health_check(self) -> bool:
        """Check if API server is running"""
        try:
            response = self.session.get(f"{self.base_url}/health", timeout=5)
            return response.status_code == 200
        except requests.exceptions.RequestException:
            return False
    
    def submit_job(self, config: Dict[str, Any], project_files: str) -> Dict[str, Any]:
        """Submit a training job to the API"""
        zip_path = None
        file_handle = None
        
        try:
            # Create a zip file of the project
            zip_path = self._create_project_zip(project_files)
            
            # Open file handle
            file_handle = open(zip_path, 'rb')
            
            # Prepare the job submission
            files = {
                'project_zip': ('project.zip', file_handle, 'application/zip')
            }
            
            data = {
                'config': json.dumps(config)
            }
            
            response = self.session.post(
                f"{self.base_url}/api/jobs", 
                files=files, 
                data=data,
                timeout=30
            )
            
            if response.status_code == 201:
                return response.json()
            else:
                raise Exception(f"Job submission failed: {response.text}")
                
        except requests.exceptions.RequestException as e:
            raise Exception(f"Failed to connect to API server: {e}")
        
        finally:
            # Ensure proper cleanup
            if file_handle:
                file_handle.close()
            if zip_path and os.path.exists(zip_path):
                try:
                    os.unlink(zip_path)
                except (OSError, PermissionError):
                    # On Windows, sometimes need to wait a moment
                    import time
                    time.sleep(0.1)
                    try:
                        os.unlink(zip_path)
                    except (OSError, PermissionError):
                        print(f"Warning: Could not delete temporary file {zip_path}")
    
    def get_job_status(self, job_id: str) -> Dict[str, Any]:
        """Get status of a specific job"""
        try:
            response = self.session.get(f"{self.base_url}/api/jobs/{job_id}")
            if response.status_code == 200:
                return response.json()
            else:
                raise Exception(f"Failed to get job status: {response.text}")
        except requests.exceptions.RequestException as e:
            raise Exception(f"Failed to connect to API server: {e}")
    
    def list_jobs(self) -> Dict[str, Any]:
        """List all jobs for the user"""
        try:
            response = self.session.get(f"{self.base_url}/api/jobs")
            if response.status_code == 200:
                return response.json()
            else:
                raise Exception(f"Failed to list jobs: {response.text}")
        except requests.exceptions.RequestException as e:
            raise Exception(f"Failed to connect to API server: {e}")
    
    def _create_project_zip(self, project_path: str) -> str:
        """Create a zip file of the project directory"""
        project_dir = Path(project_path)
        
        # Create temporary zip file
        temp_zip = tempfile.NamedTemporaryFile(delete=False, suffix='.zip')
        temp_zip.close()
        
        with zipfile.ZipFile(temp_zip.name, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for file_path in project_dir.rglob('*'):
                if file_path.is_file():
                    # Skip common ignore patterns
                    if self._should_ignore_file(file_path):
                        continue
                    
                    # Add file with relative path
                    arcname = file_path.relative_to(project_dir)
                    zipf.write(file_path, arcname)
        
        return temp_zip.name
    
    def _should_ignore_file(self, file_path: Path) -> bool:
        """Check if file should be ignored during zip creation"""
        ignore_patterns = [
            '.git', '__pycache__', '.pyc', '.DS_Store', 
            'node_modules', '.env', 'venv', '.venv'
        ]
        
        path_str = str(file_path)
        return any(pattern in path_str for pattern in ignore_patterns)