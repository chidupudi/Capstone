# ✅ Pre-Presentation Checklist

## Run This 1 Day Before Your Presentation

---

## 🔧 System Setup

### Local Machine Services

- [ ] **API Server Working**
  ```bash
  cd d:\capstone\trainforge\api
  npm start
  # Should show: ✅ Server running on http://localhost:3000
  curl http://localhost:3000/health
  ```

- [ ] **Dashboard Working** (Optional)
  ```bash
  cd d:\capstone\trainforge\dashboard
  npm start
  # Should open http://localhost:3001
  ```

- [ ] **CLI Environment Working**
  ```bash
  cd d:\capstone\trainforge\cli
  call set_env.bat
  # Should show (venv) in prompt
  trainforge --version
  ```

- [ ] **ngrok Installed and Working**
  ```bash
  ngrok http 3000
  # Should show HTTPS URL
  # Visit http://127.0.0.1:4040 to verify
  ```

### Google Colab Setup

- [ ] **Colab Notebook Ready**
  - Upload `trainforge/external-gpu/TrainForge_Colab_Worker.ipynb`
  - Save in your Google Drive
  - Test: Runtime → Change runtime type → GPU

- [ ] **Worker Script Uploaded**
  - Have `colab_worker_complete.py` ready to upload
  - Or know the GitHub raw URL

### Demo Project

- [ ] **Project Files Complete**
  ```bash
  cd d:\capstone\test-final-presentation
  ls
  # Should have:
  # - train.py
  # - requirements.txt
  # - trainforge.yaml
  # - README.md
  ```

- [ ] **Pre-download CIFAR-10** (Saves 2 minutes during demo!)
  ```bash
  cd d:\capstone\test-final-presentation
  python -c "import torchvision; torchvision.datasets.CIFAR10('./data', download=True, train=True); torchvision.datasets.CIFAR10('./data', download=True, train=False)"
  # This downloads ~170MB - do it once, cache forever
  ```

---

## 🧪 Complete Test Run

### Full End-to-End Test

- [ ] **1. Start All Services**
  ```bash
  # Terminal 1: API
  cd d:\capstone\trainforge\api
  npm start

  # Terminal 2: ngrok
  ngrok http 3000
  # COPY THE HTTPS URL!

  # Terminal 3: Dashboard (optional)
  cd d:\capstone\trainforge\dashboard
  npm start
  ```

- [ ] **2. Start Colab Worker**
  - Open Colab notebook
  - Run all cells
  - Enter ngrok URL
  - Verify: Should see "Worker is now polling for jobs..."

- [ ] **3. Submit Test Job**
  ```bash
  cd d:\capstone\test-final-presentation
  cd ..\cli
  call set_env.bat
  cd ..\test-final-presentation
  trainforge push
  ```

- [ ] **4. Verify Execution**
  - Check Colab: Worker should claim job
  - Watch training: Should start downloading data
  - Wait 1-2 epochs: Verify it's working
  - Stop if needed (don't need full 10 epochs for test)

- [ ] **5. Check Results**
  ```bash
  # Check job status
  curl http://localhost:3000/api/jobs

  # Should show job with status "running" or "completed"
  ```

---

## 📋 Presentation Materials

### Files to Have Open/Ready

- [ ] **Code in VS Code**
  - Open `test-final-presentation/` folder
  - Have `train.py` visible
  - Have `trainforge.yaml` visible

- [ ] **Browser Tabs**
  - Tab 1: Google Colab worker (running)
  - Tab 2: Dashboard (http://localhost:3001)
  - Tab 3: ngrok status (http://127.0.0.1:4040)

- [ ] **Terminal Windows**
  - Terminal 1: API (running)
  - Terminal 2: ngrok (running)
  - Terminal 3: Ready for CLI commands

- [ ] **Documentation**
  - Have `PRESENTATION_GUIDE.md` open for reference
  - Have architecture diagram ready

### Backup Materials

- [ ] **Screenshots**
  - Screenshot of successful training
  - Screenshot of dashboard
  - Screenshot of Colab output

- [ ] **Video Backup** (Highly Recommended!)
  - Record a full successful run
  - ~10 minutes
  - Use OBS Studio or similar
  - Have ready in case of demo failure

---

## 🎯 Verify These Work

### API Endpoints

- [ ] Health check
  ```bash
  curl http://localhost:3000/health
  # Should return: {"status":"healthy",...}
  ```

- [ ] Pending jobs
  ```bash
  curl http://localhost:3000/api/jobs/pending
  # Should return: []
  ```

- [ ] Workers list
  ```bash
  curl http://localhost:3000/api/workers
  # Should return: [] or list of workers
  ```

### CLI Commands

- [ ] Version check
  ```bash
  cd d:\capstone\trainforge\cli
  call set_env.bat
  trainforge --version
  # Should show version
  ```

- [ ] Init command
  ```bash
  trainforge init
  # Should create trainforge.yaml
  ```

- [ ] Push command
  ```bash
  cd d:\capstone\test-final-presentation
  trainforge push
  # Should submit job
  ```

### Colab Worker

- [ ] Connection test
  - Run connection test cell
  - Should show: ✅ Connection successful!

- [ ] GPU verification
  - Run GPU check cell
  - Should show: ✅ GPU Available: Tesla T4

- [ ] Worker registration
  - Start worker
  - Check: `curl http://localhost:3000/api/workers`
  - Should show your Colab worker

---

## 💾 Backup Plan

### If Demo Fails During Presentation

- [ ] **Have Video Ready**
  - Pre-recorded successful run
  - ~10 minutes showing full workflow

- [ ] **Slides Ready**
  - Screenshots of each step
  - Architecture diagrams
  - Results from test run

- [ ] **Explanation Prepared**
  - Can explain what would happen
  - Can show code walkthrough
  - Can discuss architecture

---

## 📊 Practice Run

### Do This 1 Day Before

- [ ] **Full Dry Run**
  - Time yourself
  - Practice explanations
  - Test all transitions

- [ ] **Check Timing**
  - Introduction: 30 sec
  - Job submission: 1 min
  - Training watch: 7-8 min
  - Results: 1 min
  - Total: ~10-12 min

- [ ] **Prepare Answers**
  - Common questions
  - Technical details
  - Future improvements

---

## 🚀 Day of Presentation

### Morning Of

- [ ] **Test Internet Connection**
  - Fast enough for ngrok?
  - Stable connection?

- [ ] **Start Services Early**
  - API: 30 min before
  - ngrok: 30 min before
  - Colab: 15 min before
  - Verify all working

- [ ] **Pre-warm Everything**
  - Open all browser tabs
  - Test one job submission
  - Verify Colab worker active

### Right Before

- [ ] **Final Checks** (5 min before)
  ```bash
  # API
  curl http://localhost:3000/health

  # Workers
  curl http://localhost:3000/api/workers

  # Colab still running?
  # Check the Colab tab
  ```

- [ ] **Ready Terminal**
  - cd to project directory
  - venv activated
  - Ready to type `trainforge push`

---

## ✨ Pro Tips

### Make It Impressive

- [ ] **Clean Up Output**
  - Close unnecessary windows
  - Clean terminal history
  - Full screen Colab for demo

- [ ] **Highlight GPU Usage**
  - Point out "Tesla T4"
  - Mention "15GB GPU memory"
  - Show "11 million parameters"

- [ ] **Show Real Progress**
  - Watch accuracy increase
  - Show loss decreasing
  - Explain what's happening

### Handle Issues

- [ ] **If Colab Disconnects**
  - Have backup Colab tab ready
  - Can restart worker quickly
  - Explain: "This is why checkpoint saving is important!"

- [ ] **If Training is Slow**
  - Explain: "Production runs take longer for better accuracy"
  - Show progress so far
  - Move to results/discussion

- [ ] **If Network Issues**
  - Switch to video backup
  - Explain what would happen
  - Show code instead

---

## 🎉 Success Metrics

After your presentation, you should have demonstrated:

- ✅ Real machine learning training
- ✅ Distributed GPU execution
- ✅ Remote job submission
- ✅ Real-time monitoring
- ✅ Professional ML workflow
- ✅ 70-75% accuracy achieved
- ✅ Working system end-to-end

---

## 📝 Final Checklist

### 24 Hours Before

- [ ] Full test run completed
- [ ] Video backup recorded
- [ ] All services tested
- [ ] Materials prepared
- [ ] Slides ready

### 1 Hour Before

- [ ] All services running
- [ ] Colab worker active
- [ ] Test job submitted (optional)
- [ ] Browser tabs ready
- [ ] Terminal positioned

### 5 Minutes Before

- [ ] Final health checks
- [ ] Worker still polling
- [ ] Ready to type
- [ ] Confident and calm 😊

---

**You're ready! 🚀**

Go through this checklist carefully and you'll nail your presentation!

**Good luck! 🎓**
