# TrainForge 🚀

**TrainForge** is a distributed AI training platform that allows you to run machine-learning workloads on **free external GPUs** (Google Colab, Kaggle) directly from your **local terminal**.

You define your job in a simple `trainforge.yaml`, run `trainforge submit`, and TrainForge:
- Packages your code
- Sends it securely via tunnel
- Orchestrates distributed GPU workers
- Runs training
- Retrieves results back locally

No expensive GPUs. No cloud VM management.

---

## 🏗️ Architecture Component Map

```mermaid
flowchart TD

    subgraph LocalEnvironment["Local Machine / Private Network"]
        CLI["TrainForge CLI (Python)"]
        Dashboard["Dashboard (React :3001)"]
        API["API Server (Node.js :3000)"]
        DB[("Firestore / MongoDB")]
        LocalWorker["Local GPU Worker (Python)"]

        CLI -->|Submit Jobs / Status| API
        Dashboard -->|Metrics / Logs| API
        API -->|Read / Write| DB
        LocalWorker -->|Polling / Heartbeat| API
    end

    subgraph TunnelLayer["Secure Tunnel Layer"]
        Tunnel["Cloudflare Tunnel / ngrok"]
    end

    API <-->|Public HTTPS| Tunnel

    subgraph CloudGPUs["External GPU Providers"]
        ColabMaster["Colab GPU Worker (Master)"]
        ColabWorker["Colab GPU Worker (Worker)"]
        KaggleWorker["Kaggle GPU Worker"]
    end

    ColabMaster -->|Register / Logs / Results| Tunnel
    ColabWorker -->|Register / Logs / Results| Tunnel
    KaggleWorker -->|Register / Logs / Results| Tunnel

    ColabWorker -.->|torchrun TCP :29500| ColabMaster
```

---

## 🔄 End-to-End Distributed Training Flow

```mermaid
sequenceDiagram
    actor User
    participant CLI as TrainForge CLI
    participant API as API Server
    participant Tunnel as Secure Tunnel
    participant Master as Colab Master Worker
    participant Worker as Colab Worker

    User->>CLI: trainforge submit
    CLI->>API: POST /api/jobs/distributed
    API-->>CLI: job_id (Pending)

    loop Poll for jobs
        Master->>Tunnel: GET /api/jobs/pending
        Tunnel->>API: Forward request
        API-->>Master: Pending job
    end

    Master->>Tunnel: POST /api/jobs/{id}/claim
    Tunnel->>API: Forward request
    API-->>Master: rank = 0, world_size = 2

    Worker->>Tunnel: POST /api/jobs/{id}/claim
    Tunnel->>API: Forward request
    API-->>Worker: rank = 1, master_addr

    Note over Master,Worker: torchrun initialization

    Master->>Master: Open TCP :29500
    Worker->>Master: Connect to :29500

    Note over Master,Worker: Distributed training running

    Master->>Tunnel: PUT /api/jobs/{id}/status
    Tunnel->>API: Upload results
    API-->>Master: 200 OK

    User->>CLI: trainforge status {job_id}
    CLI->>API: GET /api/jobs/{job_id}
    API-->>CLI: Job completed
```

---

## 💻 Python CLI Quickstart

### Installation

```bash
pip install -e .
```

Verify:

```bash
trainforge --help
```

---

### Initialize Project

```bash
trainforge init
```

Creates:
- `train.py`
- `trainforge.yaml`

---

### Example `trainforge.yaml`

```yaml
project:
  name: llama-finetune

training:
  script: train.py
  requirements: requirements.txt

resources:
  gpu: 1
  memory: 16Gi
```

---

### Submit Job

```bash
trainforge submit .
```

Distributed training:

```bash
trainforge submit . --workers 2
```

---

### Monitor & Retrieve Results

```bash
trainforge status <job_id>
trainforge pull <job_id>
```

---

## ☁️ Connecting External GPU Workers

```bash
pip install requests
python colab_worker.py
```

Ensure `API_URL` points to your public tunnel.
