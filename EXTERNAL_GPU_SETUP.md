# 🚀 External GPU Setup Guide

Connect free cloud GPUs to your TrainForge project!

## 🎯 Quick Setup (5 minutes)

### Step 1: Get a Free GPU
**Google Colab (Recommended)**
1. Go to [Google Colab](https://colab.research.google.com/)
2. Create new notebook
3. Runtime → Change runtime type → GPU (T4/V100/A100)

### Step 2: Expose Your TrainForge API

**Option A: ngrok (Easiest)**
```bash
# Install ngrok from https://ngrok.com/
# Then run:
ngrok http 3000
```
Copy the https URL (e.g., `https://abc123.ngrok.io`)

**Option B: localtunnel**
```bash
npm install -g localtunnel
lt --port 3000
```

### Step 3: Connect GPU to TrainForge

1. **Upload Colab Notebook**: Upload `trainforge/external-gpu/setup_colab.ipynb` to Google Colab
2. **Follow the notebook**: It will guide you through the setup
3. **Enter your API URL**: Use the ngrok/localtunnel URL from Step 2
4. **Start the worker**: Keep the notebook running

## 🆓 Free GPU Options Comparison

| Platform | GPU Type | Time Limit | Memory | Setup |
|----------|----------|------------|--------|-------|
| **Google Colab** | T4/V100/A100 | 12-24h session | 12-16GB | ⭐ Easy |
| **Kaggle** | P100/T4 | 30h/week | 13-16GB | Medium |
| **Paperspace** | M4000 | 6h/month | 8GB | Medium |
| **Saturn Cloud** | T4 | 10h/month | 16GB | Hard |

## 🔧 Detailed Setup Instructions

### For Google Colab:

1. **Create new notebook** in Google Colab
2. **Enable GPU**: Runtime → Change runtime type → Hardware accelerator → GPU
3. **Upload worker script** or copy from `trainforge/external-gpu/setup_colab.ipynb`
4. **Run setup cells** in order
5. **Keep notebook running** (worker stops when you close it)

### For Kaggle:

1. **Create new notebook** on Kaggle
2. **Enable GPU**: Settings → Accelerator → GPU
3. **Upload and modify** the colab_worker.py script
4. **Change API calls** to match Kaggle's environment
5. **Run the worker script**

### For Other Platforms:

1. **Adapt the worker script** for the platform
2. **Install dependencies**: requests, torch, etc.
3. **Modify paths** if needed
4. **Run worker script**

## 📊 Usage Examples

### Submit a Job to External GPU:

```python
# In your local machine
import requests

job_data = {
    "job_id": "test-external-gpu",
    "script": "train.py",
    "resources": {
        "gpu": 1,
        "memory_gb": 8
    }
}

response = requests.post("http://localhost:3000/api/jobs", json=job_data)
print(f"Job submitted: {response.json()}")
```

### Monitor External Workers:

```bash
# Check connected workers
curl http://localhost:3000/api/workers

# Check job status
curl http://localhost:3000/api/jobs/status
```

## 🚨 Important Notes

### Colab Limitations:
- **Session timeout**: 12-24 hours maximum
- **GPU availability**: Not guaranteed (depends on demand)
- **Network**: May be slower than local
- **Storage**: Temporary (files deleted on session end)

### Best Practices:
1. **Save outputs**: Upload results back to your API
2. **Use checkpoints**: Save model state frequently
3. **Monitor sessions**: Check for disconnections
4. **Multiple workers**: Run several Colab instances for more capacity

### Security:
- **Use HTTPS**: Always use ngrok https URLs
- **Limit access**: Don't share your API URLs
- **Monitor usage**: Check for unexpected jobs

## 🎯 Student Discounts & Programs

### Free Credits Available:
1. **Google Cloud**: $300 credit for students
2. **AWS Educate**: Various credits
3. **Azure for Students**: $100 credit
4. **Paperspace**: Education discounts
5. **Lightning AI**: Student pricing

### How to Apply:
1. **Verify student status**: Use .edu email
2. **Apply for programs**: Each platform has student portals
3. **Get credits**: Usually $100-$300 free
4. **Use with TrainForge**: Connect via the worker script

## 🔧 Advanced Setup

### Multiple GPU Workers:
```python
# Run multiple Colab notebooks
# Each becomes a separate worker
# TrainForge will distribute jobs automatically
```

### Custom Worker Types:
```python
# Modify colab_worker.py for specific needs
# Add custom capabilities
# Implement specialized processing
```

### Monitoring Dashboard:
- Open http://localhost:3001
- View connected workers
- Monitor job progress
- Check GPU utilization

## 🚨 Troubleshooting

### Worker Not Connecting:
1. **Check API URL**: Must be publicly accessible
2. **Verify ngrok**: Should show forwarding status
3. **Test connection**: curl your ngrok URL
4. **Check firewall**: Ensure port 3000 is open

### Jobs Not Running:
1. **Check worker status**: Should show "available"
2. **Verify GPU requirements**: Match worker capabilities
3. **Check logs**: Look for error messages
4. **Test locally**: Try same job on local machine

### Performance Issues:
1. **Use closer regions**: Choose appropriate data centers
2. **Optimize data transfer**: Minimize file sizes
3. **Monitor bandwidth**: Check network usage
4. **Use checkpointing**: Save progress frequently

---

## 🎉 Ready to Scale!

With external GPUs connected, you can:
- ✅ Train larger models
- ✅ Run multiple experiments
- ✅ Use powerful hardware for free
- ✅ Scale up/down as needed

**Happy Training! 🚀**