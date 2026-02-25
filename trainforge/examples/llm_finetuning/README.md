# Healthcare LLM Adaptation Project

This repository contains the codebase for fine-tuning our localized LLM (distilgpt2 architecture) to better comprehend and parse medical transcripts and Q&A pairs.

## Infrastructure Requirements

Due to the size of the model and the batching requirements, this training script **must** be executed on a machine with a dedicated Data Center GPU (e.g., NVIDIA Tesla T4 or A100). Attempting to run this on a CPU or standard laptop will result in Out-Of-Memory (OOM) errors or extremely degraded performance (measured in days rather than minutes).

The `trainforge.yaml` file in this directory is configured to automatically request a GPU node from our distributed inference cluster.

## Approach: PEFT & LoRA

To avoid the catastrophic compute costs of full fine-tuning, we employ **Parameter-Efficient Fine-Tuning (PEFT)** using the **Low-Rank Adaptation (LoRA)** technique.

This allows us to freeze the billions of pre-trained parameters in the foundation model, and instead inject tiny trainable "adapter" matrices into the attention layers. This reduces the number of trainable parameters by over 99%, dropping our VRAM requirements drastically and allowing us to complete training on a single T4 instance in mixed precision (`FP16`).

## Usage

If you have the cluster CLI installed, simply submit the job:

```bash
trainforge submit .
```

The cluster will package the code, provision a GPU instance, install the dependencies listed in `requirements.txt`, and execute `main.py`.

You can monitor your job via:
```bash
trainforge logs <job-id>
```
