// File: trainforge/api/src/services/storage.js
// File storage service for project files and training artifacts

const fs = require('fs').promises;
const path = require('path');

class FileStorage {
    constructor() {
        this.basePath = process.env.STORAGE_PATH || './storage';
        this.ensureStorageDirectories();
    }

    async ensureStorageDirectories() {
        try {
            // Create storage directories if they don't exist
            const directories = [
                this.basePath,
                path.join(this.basePath, 'projects'),
                path.join(this.basePath, 'artifacts'),
                path.join(this.basePath, 'checkpoints')
            ];

            for (const dir of directories) {
                try {
                    await fs.access(dir);
                } catch {
                    await fs.mkdir(dir, { recursive: true });
                    console.log(`📁 Created storage directory: ${dir}`);
                }
            }
        } catch (error) {
            console.error('❌ Failed to create storage directories:', error);
        }
    }

    async storeProjectFiles(sourceZipPath, projectPath) {
        try {
            const destinationDir = path.join(this.basePath, 'projects', projectPath);
            await fs.mkdir(destinationDir, { recursive: true });

            // Copy the ZIP file
            const destinationPath = path.join(destinationDir, 'project.zip');
            await fs.copyFile(sourceZipPath, destinationPath);

            // Extract ZIP file for scheduler access
            await this.extractProjectFiles(destinationPath, destinationDir);

            console.log(`📦 Project files stored and extracted: ${destinationDir}`);
            return destinationPath;

        } catch (error) {
            console.error('❌ Failed to store project files:', error);
            throw error;
        }
    }

    async extractProjectFiles(zipPath, extractDir) {
        try {
            const AdmZip = require('adm-zip');
            const zip = new AdmZip(zipPath);

            // Extract all files
            zip.extractAllTo(extractDir, true);

            console.log(`📂 Extracted project files to: ${extractDir}`);

        } catch (error) {
            console.error('❌ Failed to extract project files:', error);
            // Don't throw here, we still have the ZIP file
        }
    }

    async getProjectFiles(projectPath) {
        try {
            const filePath = path.join(this.basePath, 'projects', projectPath, 'project.zip');
            await fs.access(filePath);
            return filePath;
        } catch (error) {
            throw new Error(`Project files not found: ${projectPath}`);
        }
    }

    async storeArtifact(jobId, artifactName, data) {
        try {
            const artifactDir = path.join(this.basePath, 'artifacts', jobId);
            await fs.mkdir(artifactDir, { recursive: true });
            
            const artifactPath = path.join(artifactDir, artifactName);
            
            if (typeof data === 'string') {
                await fs.writeFile(artifactPath, data, 'utf8');
            } else {
                await fs.writeFile(artifactPath, data);
            }
            
            console.log(`💾 Artifact stored: ${artifactPath}`);
            return artifactPath;
            
        } catch (error) {
            console.error('❌ Failed to store artifact:', error);
            throw error;
        }
    }

    async listArtifacts(jobId) {
        try {
            const artifactDir = path.join(this.basePath, 'artifacts', jobId);
            const files = await fs.readdir(artifactDir);
            return files;
        } catch (error) {
            return []; // Return empty array if no artifacts found
        }
    }

    async deleteJobFiles(jobId) {
        try {
            const projectDir = path.join(this.basePath, 'projects', jobId);
            const artifactDir = path.join(this.basePath, 'artifacts', jobId);
            const checkpointDir = path.join(this.basePath, 'checkpoints', jobId);
            
            // Remove directories if they exist
            for (const dir of [projectDir, artifactDir, checkpointDir]) {
                try {
                    await fs.rmdir(dir, { recursive: true });
                    console.log(`🗑️ Deleted: ${dir}`);
                } catch (error) {
                    // Ignore if directory doesn't exist
                    if (error.code !== 'ENOENT') {
                        console.warn(`⚠️ Failed to delete ${dir}:`, error.message);
                    }
                }
            }
        } catch (error) {
            console.error('❌ Failed to delete job files:', error);
            throw error;
        }
    }
}

// Create singleton instance
const fileStorage = new FileStorage();

module.exports = {
    FileStorage: fileStorage
};