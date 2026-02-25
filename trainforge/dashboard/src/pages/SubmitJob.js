// File: trainforge/dashboard/src/pages/SubmitJob.js
// Job submission form with file upload and configuration

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileText, Settings, Cpu, HardDrive, ArrowLeft, Send } from 'lucide-react';
import toast from 'react-hot-toast';

import { trainForgeAPI } from '../services/api';

const SubmitJob = ({ onNavigate }) => {
  const [formData, setFormData] = useState({
    projectName: '',
    description: '',
    trainingScript: 'train.py',
    requirements: 'requirements.txt',
    gpu: 1,
    cpu: 2,
    memory: '4Gi',
    pythonVersion: '3.9',
    baseImage: 'pytorch/pytorch:latest'
  });

  const [files, setFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle file upload
  const handleFiles = (fileList) => {
    const newFiles = Array.from(fileList);
    setFiles(prev => [...prev, ...newFiles]);
  };

  // Handle drag and drop
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  // Remove file
  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Submit job
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.projectName.trim()) {
      toast.error('Project name is required');
      return;
    }

    if (files.length === 0) {
      toast.error('Please upload at least one file');
      return;
    }

    setSubmitting(true);

    try {
      // Create job configuration
      const config = {
        project: {
          name: formData.projectName,
          description: formData.description || 'Training job submitted via dashboard'
        },
        training: {
          script: formData.trainingScript,
          requirements: formData.requirements
        },
        resources: {
          gpu: parseInt(formData.gpu),
          cpu: parseInt(formData.cpu),
          memory: formData.memory
        },
        environment: {
          python_version: formData.pythonVersion,
          base_image: formData.baseImage
        }
      };

      // Create form data for submission
      const submitFormData = new FormData();
      submitFormData.append('config', JSON.stringify(config));

      // Add files (for simplicity, we'll use the first file as project_zip)
      if (files[0]) {
        submitFormData.append('project_zip', files[0]);
      }

      // Submit the job
      const response = await trainForgeAPI.submitJob(submitFormData);

      toast.success(`Job submitted successfully! ID: ${response.job_id?.slice(0, 8)}...`);

      // Navigate back to dashboard
      setTimeout(() => {
        onNavigate && onNavigate('dashboard');
      }, 1500);

    } catch (error) {
      console.error('Job submission failed:', error);
      toast.error('Failed to submit job. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50" style={{ paddingBottom: 64 }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Page Title & Back Button */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => onNavigate && onNavigate('dashboard')}
            className="p-2 text-slate-400 hover:text-blue-600 bg-white border border-slate-200 shadow-sm rounded-xl transition-all hover:scale-105"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-tf-blue to-tf-purple tracking-tight">
              Submit Training Job
            </h1>
            <p className="text-slate-500 mt-1">
              Upload your training files and configure your compute environment.
            </p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Project Information */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-xl shadow-lg border border-slate-100"
          >
            <div className="flex items-center gap-2 mb-6">
              <FileText className="w-5 h-5 text-tf-blue" />
              <h2 className="text-lg font-semibold text-slate-900">
                Project Information
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Project Name *
                </label>
                <input
                  type="text"
                  name="projectName"
                  value={formData.projectName}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-tf-blue"
                  placeholder="my-training-project"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Training Script
                </label>
                <input
                  type="text"
                  name="trainingScript"
                  value={formData.trainingScript}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-tf-blue"
                  placeholder="train.py"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-tf-blue"
                  placeholder="Brief description of your training job..."
                />
              </div>
            </div>
          </motion.div>

          {/* File Upload */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="bg-white rounded-xl shadow-lg border border-slate-100"
          >
            <div className="flex items-center gap-2 mb-6">
              <Upload className="w-5 h-5 text-green-500" />
              <h2 className="text-lg font-semibold text-slate-900">
                Upload Files
              </h2>
            </div>

            {/* Drag and Drop Area */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${dragActive
                ? 'border-tf-blue bg-tf-blue/10'
                : 'border-slate-300'
                }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <div>
                <p className="text-lg font-medium text-slate-900 mb-2">
                  Drop your files here
                </p>
                <p className="text-slate-500 mb-4">
                  or click to browse
                </p>
                <input
                  type="file"
                  multiple
                  onChange={(e) => handleFiles(e.target.files)}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-tf-blue hover:bg-tf-blue/90 text-white rounded-lg cursor-pointer transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  Browse Files
                </label>
              </div>
            </div>

            {/* File List */}
            {files.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-medium text-slate-700 mb-3">
                  Selected Files ({files.length})
                </h4>
                <div className="space-y-2">
                  {files.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-tf-blue" />
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {file.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {(file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>

          {/* Resource Configuration */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="bg-white rounded-xl shadow-lg border border-slate-100"
          >
            <div className="flex items-center gap-2 mb-6">
              <Settings className="w-5 h-5 text-tf-purple" />
              <h2 className="text-lg font-semibold text-slate-900">
                Resource Configuration
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                  <Cpu className="w-4 h-4" />
                  GPU Count
                </label>
                <select
                  name="gpu"
                  value={formData.gpu}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-tf-blue"
                >
                  <option value={1}>1 GPU</option>
                  <option value={2}>2 GPUs</option>
                  <option value={4}>4 GPUs</option>
                  <option value={8}>8 GPUs</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  CPU Cores
                </label>
                <select
                  name="cpu"
                  value={formData.cpu}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-tf-blue"
                >
                  <option value={2}>2 Cores</option>
                  <option value={4}>4 Cores</option>
                  <option value={8}>8 Cores</option>
                  <option value={16}>16 Cores</option>
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                  <HardDrive className="w-4 h-4" />
                  Memory
                </label>
                <select
                  name="memory"
                  value={formData.memory}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-tf-blue"
                >
                  <option value="4Gi">4 GB</option>
                  <option value="8Gi">8 GB</option>
                  <option value="16Gi">16 GB</option>
                  <option value="32Gi">32 GB</option>
                  <option value="64Gi">64 GB</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Python Version
                </label>
                <select
                  name="pythonVersion"
                  value={formData.pythonVersion}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-tf-blue"
                >
                  <option value="3.8">Python 3.8</option>
                  <option value="3.9">Python 3.9</option>
                  <option value="3.10">Python 3.10</option>
                  <option value="3.11">Python 3.11</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Base Image
                </label>
                <select
                  name="baseImage"
                  value={formData.baseImage}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-tf-blue"
                >
                  <option value="pytorch/pytorch:latest">PyTorch Latest</option>
                  <option value="tensorflow/tensorflow:latest-gpu">TensorFlow GPU</option>
                  <option value="python:3.9-slim">Python Slim</option>
                  <option value="nvidia/cuda:11.8-devel-ubuntu20.04">CUDA Development</option>
                </select>
              </div>
            </div>
          </motion.div>

          {/* Submit Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            className="flex items-center justify-end gap-4"
          >
            <button
              type="button"
              onClick={() => onNavigate && onNavigate('dashboard')}
              className="px-6 py-3 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting || files.length === 0}
              className="flex items-center gap-2 px-6 py-3 bg-tf-blue hover:bg-tf-blue/90 disabled:bg-slate-400 text-white font-medium rounded-lg transition-colors"
            >
              {submitting ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                  />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Submit Job
                </>
              )}
            </button>
          </motion.div>
        </form>
      </div>
    </div>
  );
};

export default SubmitJob;