# File: trainforge/cli/setup.py
# Makes the CLI installable as a package

from setuptools import setup, find_packages

setup(
    name="trainforge-cli",
    version="0.1.0",
    description="TrainForge CLI - Distributed AI Training Platform",
    packages=find_packages(),
    install_requires=[
        "click>=8.0.0",
        "requests>=2.28.0", 
        "pyyaml>=6.0",
        "colorama>=0.4.4",
        "tabulate>=0.9.0"
    ],
    entry_points={
        'console_scripts': [
            'trainforge=trainforge.main:cli',  # Makes 'trainforge' command available
        ],
    },
    python_requires=">=3.8",
)