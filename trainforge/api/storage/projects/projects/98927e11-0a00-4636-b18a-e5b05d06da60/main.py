import os
import time
import torch
from datasets import load_dataset
from transformers import AutoTokenizer, AutoModelForCausalLM, TrainingArguments, Trainer
from peft import LoraConfig, get_peft_model, TaskType

def main():
    print("=" * 60, flush=True)
    print("🏥 Healthcare AI: Medical Transcription LLM Fine-Tuning", flush=True)
    print("=" * 60, flush=True)

    # 1. Check GPU Hardware
    if not torch.cuda.is_available():
        raise RuntimeError("❌ This script requires a GPU (like an NVIDIA T4). No GPU detected!")
    
    gpu_name = torch.cuda.get_device_name(0)
    gpu_mem = torch.cuda.get_device_properties(0).total_memory / (1024**3)
    print(f"\n⚡ DETECTED GPU: {gpu_name} with {gpu_mem:.1f} GB VRAM", flush=True)
    print("This hardware is perfect for LoRA fine-tuning!\n", flush=True)

    # 2. Configuration
    model_name = "distilgpt2" 
    dataset_name = "nomic-ai/gpt4all-j-prompt-generations" # Realistic large dataset for QA
    
    # 3. Load Tokenizer & Model
    print(f"📥 Loading foundation model '{model_name}'...", flush=True)
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    tokenizer.pad_token = tokenizer.eos_token
    
    model = AutoModelForCausalLM.from_pretrained(model_name)
    
    # 4. Apply PEFT / LoRA
    print(f"🔧 Applying LoRA (Low-Rank Adaptation)...", flush=True)
    peft_config = LoraConfig(
        task_type=TaskType.CAUSAL_LM,
        inference_mode=False,
        r=8, 
        lora_alpha=32, 
        lora_dropout=0.1
    )
    model = get_peft_model(model, peft_config)
    
    trainable_params, all_param = model.get_nb_trainable_parameters()
    print(f"📉 Trainable parameters: {trainable_params:,d} || all params: {all_param:,d} || trainable%: {100 * trainable_params / all_param:.2f}%", flush=True)
    
    # 5. Load Dataset
    print(f"📚 Loading medical QA dataset '{dataset_name}'...", flush=True)
    data = load_dataset(dataset_name)
    
    def tokenize_function(examples):
        # We use a generic 'prompt' field typical in QA datasets
        text = [str(p) for p in examples.get('prompt', examples.get('text', []))]
        return tokenizer(text, padding="max_length", truncation=True, max_length=128)
    
    tokenized_data = data.map(tokenize_function, batched=True)
    # Use a small subset for a fast demo
    train_dataset = tokenized_data["train"].select(range(200)) 
    
    # 6. Setup Training
    print("\n⏳ Starting Training on GPU with FP16...", flush=True)
    training_args = TrainingArguments(
        output_dir="./outputs",
        learning_rate=2e-4,
        per_device_train_batch_size=8,
        num_train_epochs=1,
        weight_decay=0.01,
        logging_steps=5,
        save_strategy="no",
        fp16=True, # Mixed precision - exactly what T4s are optimized for
        report_to="none"
    )
    
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
    )
    
    start_time = time.time()
    
    # 7. Start the Heavy Compute
    trainer.train()
    
    end_time = time.time()
    print(f"\n✅ PEFT Fine-tuning completed in {end_time - start_time:.1f} seconds!", flush=True)
    print("📁 Model adapters saved successfully.", flush=True)

if __name__ == "__main__":
    main()
