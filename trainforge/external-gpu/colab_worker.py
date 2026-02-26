"""
TrainForge External GPU Worker — Google Colab (Resilient Edition)

PASTE THIS INTO COLAB (one cell):

    import os, urllib.request
    API_URL = 'https://trainforge.datenwork.in'
    os.environ['TRAINFORGE_API_URL'] = API_URL
    req = urllib.request.Request(
        f'{API_URL}/api/config/worker-script?platform=colab',
        headers={'ngrok-skip-browser-warning': 'true', 'User-Agent': 'TrainForge/1.0'}
    )
    with urllib.request.urlopen(req) as r:
        exec(compile(r.read().decode(), 'colab_worker.py', 'exec'))
"""

import os, sys, time, json, signal, shutil, subprocess, zipfile, threading
from pathlib import Path

try:
    import requests
except ImportError:
    subprocess.run([sys.executable, '-m', 'pip', 'install', 'requests', '-q'], check=True)
    import requests

# ─── Config ───────────────────────────────────────────────────────────────────
API_URL   = os.environ.get('TRAINFORGE_API_URL', '').strip().rstrip('/')
WORKER_ID = f"colab-{int(time.time())}"
WORK_DIR  = Path('/content/trainforge_work')
WORK_DIR.mkdir(exist_ok=True)

HEADERS = {
    'ngrok-skip-browser-warning': 'true',
    'User-Agent': 'TrainForge-Worker/2.0',
    'Content-Type': 'application/json',
}

log_buffer = []
log_lock = threading.Lock()

# ─── Keep Colab alive (prevents idle disconnect) ─────────────────────────────
def _keep_alive():
    """Outputs a heartbeat every 4 minutes so Colab doesn't idle-disconnect."""
    while True:
        time.sleep(240)
        print(f"\r⏳ [keep-alive] {time.strftime('%H:%M:%S')} — worker running…", flush=True)

threading.Thread(target=_keep_alive, daemon=True).start()

# ─── HTTP helpers ─────────────────────────────────────────────────────────────
def _req(method, path, max_retries=3, **kwargs):
    url = f"{API_URL}{path}"
    kwargs.setdefault('timeout', 20)
    # Merge default headers
    h = {**HEADERS, **kwargs.pop('headers', {})}
    if 'files' in kwargs:
        h = {k: v for k, v in h.items() if k != 'Content-Type'}
    for attempt in range(max_retries):
        try:
            return requests.request(method, url, headers=h, **kwargs)
        except requests.exceptions.RequestException as e:
            if attempt < max_retries - 1:
                wait = 2 ** attempt
                print(f"   ⏳ Retry {attempt+1}/{max_retries} in {wait}s ({e})")
                time.sleep(wait)
    return None

# ─── Worker actions ───────────────────────────────────────────────────────────
def test_connection():
    r = _req('GET', '/health', max_retries=2)
    return r is not None and r.status_code == 200

def get_gpu_info():
    try:
        import torch
        if torch.cuda.is_available():
            return {
                'available': True,
                'name': torch.cuda.get_device_name(0),
                'memory_gb': round(torch.cuda.get_device_properties(0).total_memory / 1024**3, 1),
                'cuda': torch.version.cuda,
            }
    except Exception:
        pass
    return {'available': False, 'name': 'CPU only', 'memory_gb': 0}

def register():
    gpu = get_gpu_info()
    data = {
        'worker_id':   WORKER_ID,
        'status':      'idle',
        'worker_type': 'external_colab',
        'location':    'google_colab',
        'gpu_name':    gpu['name'],
        'gpu_memory_gb': gpu['memory_gb'],
        'capabilities': {
            'gpu_count':  1 if gpu['available'] else 0,
            'gpu_info':   gpu,
            'max_memory_gb': gpu['memory_gb'],
        },
    }
    r = _req('POST', '/api/workers/register', json=data)
    return r is not None and r.status_code in (200, 201)

def heartbeat(current_job=None):
    payload = {'timestamp': time.time()}
    if current_job:
        payload['current_job_id'] = current_job
    r = _req('POST', f'/api/workers/{WORKER_ID}/heartbeat', json=payload, max_retries=1)
    return r is not None and r.status_code == 200

def poll_jobs():
    r = _req('GET', '/api/jobs/pending', max_retries=1)
    if r and r.status_code == 200:
        jobs = r.json()
        if isinstance(jobs, list):
            return jobs
    return []

def claim_job(job_id):
    r = _req('POST', f'/api/jobs/{job_id}/claim', json={'worker_id': WORKER_ID})
    if r and r.status_code == 200:
        return r.json()
    return None

def update_status(job_id, status, message=None):
    data = {'status': status}
    if message:
        data['message'] = message
    _req('PUT', f'/api/jobs/{job_id}/status', json=data, max_retries=2)

def send_log(job_id, msg):
    with log_lock:
        log_buffer.append({'message': msg, 'timestamp': time.time()})

def flush_logs(job_id):
    with log_lock:
        if not log_buffer:
            return
        batch = log_buffer[:]
        log_buffer.clear()
        
    if batch:
        _req('POST', f'/api/jobs/{job_id}/logs/batch', json={'logs': batch}, max_retries=2)

def log_flusher(job_id, stop_event):
    while not stop_event.is_set():
        flush_logs(job_id)
        time.sleep(3)
    flush_logs(job_id)

def download_files(job_id):
    r = _req('GET', f'/api/jobs/{job_id}/files', stream=True, timeout=120)
    if not r or r.status_code != 200:
        return WORK_DIR / job_id   # empty dir — demo/mock mode
    job_dir = WORK_DIR / job_id
    job_dir.mkdir(exist_ok=True)
    zip_path = WORK_DIR / f'{job_id}.zip'
    with open(zip_path, 'wb') as f:
        for chunk in r.iter_content(8192):
            f.write(chunk)
    with zipfile.ZipFile(zip_path) as zf:
        zf.extractall(job_dir)
    zip_path.unlink()
    return job_dir

def run_training(job_id, job_dir, dist_config=None):
    for name in ['train.py', 'main.py', 'run.py']:
        script = job_dir / name
        if script.exists():
            break
    else:
        py = list(job_dir.glob('*.py'))
        if not py:
            raise FileNotFoundError('No training script found in job directory')
        script = py[0]

    print(f"📜 Running: {script.name}")
    
    cmd = [sys.executable, str(script)]
    env = os.environ.copy()

    if dist_config:
        print(f"🔗 Launching via torchrun (Distributed Mode)")
        print(f"   Rank: {dist_config.get('rank')} / {dist_config.get('world_size') - 1}")
        print(f"   Master: {dist_config.get('master_addr')}:{dist_config.get('master_port')}")
        
        env['MASTER_ADDR'] = str(dist_config.get('master_addr', '127.0.0.1'))
        env['MASTER_PORT'] = str(dist_config.get('master_port', 29500))
        env['NODE_RANK']   = str(dist_config.get('rank', 0))
        env['WORLD_SIZE']  = str(dist_config.get('world_size', 1))

        cmd = [sys.executable, '-m', 'torch.distributed.run',
               '--nproc_per_node=1',
               f"--nnodes={dist_config.get('world_size', 1)}",
               f"--node_rank={dist_config.get('rank', 0)}",
               f"--master_addr={dist_config.get('master_addr', '127.0.0.1')}",
               f"--master_port={dist_config.get('master_port', 29500)}",
               str(script)]

    stop_event = threading.Event()
    flusher_thread = threading.Thread(target=log_flusher, args=(job_id, stop_event), daemon=True)
    flusher_thread.start()

    try:
        proc = subprocess.Popen(
            cmd, cwd=str(job_dir), env=env,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1
        )
        for line in proc.stdout:
            line = line.rstrip()
            if line:
                print(f"  {line}", flush=True)
                send_log(job_id, line)
        return proc.wait() == 0
    finally:
        stop_event.set()
        flusher_thread.join(timeout=5)

def execute_job(job):
    job_id = job.get('job_id') or job.get('_id')
    job_dir = None
    try:
        print(f"\n{'='*55}")
        print(f"🎯 Job: {job_id}")
        print(f"{'='*55}")
        update_status(job_id, 'running', 'Initializing…')

        job_dir = download_files(job_id)
        req_file = job_dir / 'requirements.txt'
        if req_file.exists():
            update_status(job_id, 'running', 'Installing deps…')
            subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', '-r', str(req_file)],
                           check=True, capture_output=True)

        update_status(job_id, 'running', 'Training…')
        success = run_training(job_id, job_dir, job.get('dist_config'))

        if success:
            update_status(job_id, 'completed', 'Training completed ✅')
            print(f"✅ Job {job_id} completed")
        else:
            update_status(job_id, 'failed', 'Training script exited with non-zero code')
    except Exception as e:
        print(f"❌ Job error: {e}")
        update_status(job_id, 'failed', str(e))
    finally:
        if job_dir and job_dir.exists():
            shutil.rmtree(job_dir, ignore_errors=True)

# ─── Main loop (infinite reconnect) ──────────────────────────────────────────
def main():
    if not API_URL:
        print("❌ TRAINFORGE_API_URL is not set.")
        print("   Run: import os; os.environ['TRAINFORGE_API_URL'] = 'https://trainforge.datenwork.in'")
        return

    gpu = get_gpu_info()
    print("=" * 55)
    print("🚀 TrainForge Colab Worker  (Resilient Edition)")
    print(f"   Worker ID : {WORKER_ID}")
    print(f"   API       : {API_URL}")
    print(f"   GPU       : {gpu['name']} · {gpu['memory_gb']} GB")
    print("=" * 55)

    RECONNECT_DELAY  = 5    # seconds between reconnect attempts
    MAX_DELAY        = 120  # cap at 2 minutes
    HEARTBEAT_EVERY  = 25   # seconds
    current_job      = None

    while True:   # ← outer loop: reconnect forever on any failure
        # ── 1. Wait for the API to come back ───────────────────────────────
        delay = RECONNECT_DELAY
        while not test_connection():
            print(f"🔌 API unreachable — retrying in {delay}s…")
            time.sleep(delay)
            delay = min(delay * 2, MAX_DELAY)

        print(f"✅ Connected to API")

        # ── 2. Register ─────────────────────────────────────────────────────
        if not register():
            print("⚠️  Registration failed — will retry after a pause")
            time.sleep(10)
            continue

        print(f"📋 Registered as {WORKER_ID}")
        print("👀 Polling for jobs… (Ctrl-C to stop)\n")

        # ── 3. Poll / work loop ─────────────────────────────────────────────
        last_hb = time.time()
        try:
            while True:
                now = time.time()

                # Heartbeat
                if now - last_hb >= HEARTBEAT_EVERY:
                    ok = heartbeat(current_job)
                    if not ok:
                        print("⚠️  Heartbeat failed — reconnecting…")
                        break   # break inner → outer loop reconnects
                    last_hb = now

                if current_job is None:
                    jobs = poll_jobs()
                    if jobs:
                        job = jobs[0]
                        jid = job.get('job_id') or job.get('_id')
                        claim_res = claim_job(jid)
                        if claim_res and claim_res.get('success'):
                            job['dist_config'] = claim_res.get('dist_config')
                            job['is_distributed'] = claim_res.get('is_distributed', False)
                            current_job = jid
                            execute_job(job)
                            current_job = None
                    else:
                        time.sleep(5)
                else:
                    time.sleep(2)

        except KeyboardInterrupt:
            print("\n⛔ Stopped by user — bye!")
            return
        except Exception as e:
            print(f"⚠️  Loop error: {e}  — reconnecting in {RECONNECT_DELAY}s…")
            time.sleep(RECONNECT_DELAY)
            # outer while True will reconnect

# ─── Entry ────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    main()
