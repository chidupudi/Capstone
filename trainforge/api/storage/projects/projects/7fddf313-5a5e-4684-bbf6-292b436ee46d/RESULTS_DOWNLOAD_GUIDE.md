# 📥 TrainForge Results Download Guide

## How to Get Your Trained Models Back

---

## 🎯 Overview

After your training job completes on the Colab GPU, TrainForge automatically:

1. ✅ **Collects** all model files (*.pth, *.pt, *.h5, *.json)
2. ✅ **Zips** them into results.zip
3. ✅ **Uploads** to your TrainForge API
4. ✅ **Makes available** for download via CLI

---

## 🚀 Quick Usage

### **Download Results**

```bash
# Download results for a completed job
trainforge results YOUR_JOB_ID

# Results will be extracted to: ./results/YOUR_JOB_ID/
```

### **Custom Output Location**

```bash
# Download to specific directory
trainforge results YOUR_JOB_ID -o ./my-models

# Just download zip without extracting
trainforge results YOUR_JOB_ID --no-extract
```

---

## 📋 Complete Workflow Example

### **1. Submit Job**

```bash
cd d:/capstone/test-final-presentation
trainforge push
```

Output:
```
✅ Job submitted successfully!
🆔 Job ID: cd5ef9b0-216f-40dc-ad3c-bd1fb3fa489e
```

### **2. Wait for Completion**

Watch in Colab or check status:
```bash
trainforge status cd5ef9b0-216f-40dc-ad3c-bd1fb3fa489e
```

### **3. Download Results**

```bash
trainforge results cd5ef9b0-216f-40dc-ad3c-bd1fb3fa489e
```

Output:
```
📥 Downloading results for job: cd5ef9b0-216f-40dc-ad3c-bd1fb3fa489e

🔍 Checking job status...
✅ Job completed successfully

📥 Downloading results...
✅ Downloaded results.zip (15.23 MB)

📦 Extracting results...
   Found 3 files:
      - best_model.pth (45.2 MB)
      - final_model.pth (45.2 MB)
      - training_results.json (2.3 KB)
✅ Results extracted to: ./results/cd5ef9b0-216f-40dc-ad3c-bd1fb3fa489e

📊 Results Summary:
==================================================
Job ID:        cd5ef9b0-216f-40dc-ad3c-bd1fb3fa489e
Project:       final-presentation-demo
Location:      ./results/cd5ef9b0-216f-40dc-ad3c-bd1fb3fa489e
Model files:   2
   - best_model.pth
   - final_model.pth
Result files:  1
   - training_results.json
==================================================

🎉 Results downloaded successfully!
```

---

## 📁 What Gets Downloaded

### **Model Files:**
- `best_model.pth` - Best checkpoint during training
- `final_model.pth` - Final model after all epochs
- Any custom `*.pth`, `*.pt`, `*.h5` files you saved

### **Results Files:**
- `training_results.json` - Training metrics and statistics

Example `training_results.json`:
```json
{
  "total_time": 245.67,
  "epochs": 10,
  "final_train_loss": 0.6789,
  "final_train_accuracy": 74.56,
  "final_test_accuracy": 72.34,
  "train_losses": [1.6817, 1.3412, ...],
  "train_accuracies": [38.97, 51.82, ...],
  "test_accuracies": [52.34, 65.12, ...]
}
```

---

## 🔧 How It Works

### **On Colab Worker (Automatic):**

1. **Training Completes**
   ```python
   # Your train.py saves models
   torch.save(model.state_dict(), 'best_model.pth')
   torch.save(model.state_dict(), 'final_model.pth')
   ```

2. **Worker Collects Files**
   ```
   📤 Uploading results...
   ✅ Found 3 output files:
      - best_model.pth (45234.5 KB)
      - final_model.pth (45234.5 KB)
      - training_results.json (2.3 KB)
   ```

3. **Creates Zip**
   ```
   📦 Created results.zip (15.23 MB)
   ```

4. **Uploads to API**
   ```
   📤 Uploading results to API...
   ✅ Results uploaded successfully!
      Upload size: 15.23 MB
   ```

### **On Your Machine (When You Download):**

1. **CLI Checks Job Status**
   ```
   🔍 Checking job status...
   ✅ Job completed successfully
   ```

2. **Downloads from API**
   ```
   📥 Downloading results...
   GET /api/jobs/{job_id}/results
   ```

3. **Extracts to Directory**
   ```
   📦 Extracting results...
   ./results/{job_id}/
   ├── best_model.pth
   ├── final_model.pth
   └── training_results.json
   ```

---

## 💡 Using Downloaded Models

### **Load PyTorch Model:**

```python
import torch
import torchvision.models as models

# Create model architecture
model = models.resnet18(pretrained=False)
model.fc = torch.nn.Linear(model.fc.in_features, 10)  # CIFAR-10

# Load trained weights
model.load_state_dict(torch.load('./results/JOB_ID/best_model.pth'))
model.eval()

# Use for inference
with torch.no_grad():
    output = model(input_tensor)
    prediction = output.argmax(dim=1)
```

### **View Training Metrics:**

```python
import json
import matplotlib.pyplot as plt

# Load results
with open('./results/JOB_ID/training_results.json', 'r') as f:
    results = json.load(f)

# Plot training curve
plt.plot(results['train_accuracies'], label='Training')
plt.plot(results['test_accuracies'], label='Test')
plt.xlabel('Epoch')
plt.ylabel('Accuracy (%)')
plt.legend()
plt.title('Training Progress')
plt.show()

# Print summary
print(f"Final Test Accuracy: {results['final_test_accuracy']}%")
print(f"Total Training Time: {results['total_time']/60:.1f} minutes")
```

---

## 🎯 CLI Command Reference

### **trainforge results**

Download training results from a completed job.

**Usage:**
```bash
trainforge results JOB_ID [OPTIONS]
```

**Arguments:**
- `JOB_ID` - The job ID from `trainforge push`

**Options:**
- `-o, --output DIR` - Output directory (default: `./results/JOB_ID`)
- `--extract / --no-extract` - Extract results (default: yes)
- `--help` - Show help message

**Examples:**
```bash
# Basic usage
trainforge results abc123

# Custom output directory
trainforge results abc123 -o ./my-models

# Download zip only (don't extract)
trainforge results abc123 --no-extract

# Download to current directory
trainforge results abc123 -o .
```

---

## 🔍 Troubleshooting

### **Error: "Results not found"**

**Cause:** Training hasn't completed or upload failed

**Solution:**
```bash
# Check job status
trainforge status JOB_ID

# Make sure status is "completed"
# If still running, wait for completion
```

### **Error: "Job not found"**

**Cause:** Invalid job ID

**Solution:**
```bash
# List all jobs to find correct ID
trainforge status

# Copy exact job ID from output
```

### **Downloaded file is corrupted**

**Cause:** Network error during download

**Solution:**
```bash
# Try downloading again
trainforge results JOB_ID

# Use custom output to avoid conflicts
trainforge results JOB_ID -o ./results-retry
```

### **Models won't load**

**Cause:** Architecture mismatch

**Solution:**
```python
# Make sure you recreate exact model architecture
model = models.resnet18(pretrained=False)
model.fc = torch.nn.Linear(model.fc.in_features, 10)  # Match training

# Then load weights
model.load_state_dict(torch.load('best_model.pth'))
```

---

## 🎯 API Endpoints (Advanced)

If you want to use the API directly:

### **Upload Results (from worker):**
```bash
POST /api/jobs/{job_id}/results
Content-Type: multipart/form-data

Form data:
  results_zip: (binary file)
```

### **Download Results (from client):**
```bash
GET /api/jobs/{job_id}/results

Response:
  Content-Type: application/zip
  Content-Disposition: attachment; filename="results.zip"
  (binary data)
```

### **Check if results exist:**
```bash
GET /api/jobs/{job_id}

Response includes:
{
  "results_uploaded": true,
  "results_uploaded_at": "2025-11-06T06:16:23.185Z",
  "results_size": 15967234
}
```

---

## 📊 Directory Structure

After downloading results:

```
your-project/
├── train.py
├── trainforge.yaml
└── results/
    └── cd5ef9b0-216f-40dc-ad3c-bd1fb3fa489e/
        ├── best_model.pth           # Best checkpoint
        ├── final_model.pth          # Final model
        └── training_results.json    # Metrics
```

---

## ✅ Best Practices

### **1. Save Important Files in Training Script:**

```python
# Save best model
if test_acc > best_acc:
    torch.save(model.state_dict(), 'best_model.pth')

# Save final model
torch.save(model.state_dict(), 'final_model.pth')

# Save metrics
with open('training_results.json', 'w') as f:
    json.dump(metrics, f)

# Save checkpoint with full state
torch.save({
    'epoch': epoch,
    'model_state_dict': model.state_dict(),
    'optimizer_state_dict': optimizer.state_dict(),
    'best_acc': best_acc
}, 'checkpoint.pth')
```

### **2. Use Descriptive Filenames:**

```python
# Good
torch.save(model.state_dict(), 'resnet18_cifar10_best.pth')
torch.save(model.state_dict(), f'model_epoch_{epoch}.pth')

# Avoid generic names
torch.save(model.state_dict(), 'model.pth')  # Not descriptive
```

### **3. Download Results Promptly:**

- Download after job completes
- Store locally for backup
- Results may be cleaned up after 30 days

---

## 🎉 Summary

**Complete Workflow:**

1. ✅ Submit job: `trainforge push`
2. ✅ Training runs on Colab GPU
3. ✅ Results auto-uploaded to API
4. ✅ Download: `trainforge results JOB_ID`
5. ✅ Use models locally!

**That's it! Your trained models come back to you automatically!** 🚀

---

**Questions? Check the main documentation or run:** `trainforge results --help`
