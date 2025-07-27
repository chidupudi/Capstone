# File: trainforge/cli/trainforge/config.py
# Handles reading and parsing trainforge.yaml configuration files

import yaml
import os
from typing import Dict, Any, Optional

class TrainForgeConfig:
    """Handles TrainForge project configuration"""
    
    def __init__(self, config_path: str = "trainforge.yaml"):
        self.config_path = config_path
        self.config_data = None
    
    def load(self) -> Dict[str, Any]:
        """Load configuration from trainforge.yaml"""
        if not os.path.exists(self.config_path):
            raise FileNotFoundError(f"Configuration file '{self.config_path}' not found")
        
        try:
            with open(self.config_path, 'r') as file:
                self.config_data = yaml.safe_load(file)
                return self.config_data
        except yaml.YAMLError as e:
            raise ValueError(f"Invalid YAML in {self.config_path}: {e}")
    
    def get_project_name(self) -> str:
        """Get project name from config"""
        if not self.config_data:
            self.load()
        return self.config_data.get('project', {}).get('name', 'untitled-project')
    
    def get_training_script(self) -> str:
        """Get the main training script path"""
        if not self.config_data:
            self.load()
        return self.config_data.get('training', {}).get('script', 'train.py')
    
    def get_requirements(self) -> Optional[str]:
        """Get requirements file path"""
        if not self.config_data:
            self.load()
        return self.config_data.get('training', {}).get('requirements')
    
    def get_resources(self) -> Dict[str, Any]:
        """Get resource requirements"""
        if not self.config_data:
            self.load()
        return self.config_data.get('resources', {
            'gpu': 1,
            'cpu': 2,
            'memory': '4Gi'
        })
    
    def to_dict(self) -> Dict[str, Any]:
        """Return full config as dictionary"""
        if not self.config_data:
            self.load()
        return self.config_data

def create_default_config(project_name: str = "my-training-project") -> str:
    """Create a default trainforge.yaml configuration"""
    default_config = {
        'project': {
            'name': project_name,
            'description': 'AI training project created with TrainForge'
        },
        'training': {
            'script': 'train.py',
            'requirements': 'requirements.txt'
        },
        'resources': {
            'gpu': 1,
            'cpu': 2,
            'memory': '4Gi'
        },
        'environment': {
            'python_version': '3.9',
            'base_image': 'pytorch/pytorch:latest'
        }
    }
    
    yaml_content = yaml.dump(default_config, default_flow_style=False, indent=2)
    return yaml_content