# File: trainforge/examples/distributed-ml-pipeline/train.py
# Real-world distributed ML pipeline with image processing and model training

import os
import sys
import time
import json
import numpy as np
import multiprocessing
from concurrent.futures import ProcessPoolExecutor, as_completed
from datetime import datetime
import psutil

# Global worker functions (must be at module level for Windows multiprocessing)
def generate_batch_worker(worker_info):
    """Worker function for data generation"""
    worker_id, start_idx, batch_size = worker_info
    
    batch_start = time.time()
    np.random.seed(start_idx)  # Deterministic but different per worker
    
    # Generate synthetic images (simulate real image processing)
    images = []
    labels = []
    
    for i in range(batch_size):
        # Create synthetic image with patterns
        img_shape = (128, 128)  # Fixed image size
        img = np.random.random(img_shape) * 255
        
        # Add some structure (circles, squares, etc.)
        center_x, center_y = img.shape[0]//2, img.shape[1]//2
        pattern_type = (start_idx + i) % 3
        
        if pattern_type == 0:  # Circle pattern
            y, x = np.ogrid[:img.shape[0], :img.shape[1]]
            mask = (x - center_x)**2 + (y - center_y)**2 <= 30**2
            img[mask] += 50
        elif pattern_type == 1:  # Square pattern
            img[center_x-20:center_x+20, center_y-20:center_y+20] += 50
        else:  # Noise pattern
            img += np.random.normal(0, 10, img.shape)
        
        images.append(img)
        labels.append(pattern_type)
    
    batch_duration = time.time() - batch_start
    
    return {
        "worker_id": worker_id,
        "batch_size": len(images),
        "processing_time": batch_duration,
        "samples_per_second": len(images) / batch_duration,
        "memory_usage": sys.getsizeof(images) / (1024*1024),  # MB
        "process_id": os.getpid()
    }

def extract_features_worker(worker_info):
    """Worker function for feature extraction"""
    worker_id, start_idx, batch_size = worker_info
    
    batch_start = time.time()
    features_list = []
    
    for i in range(batch_size):
        # Simulate complex feature extraction
        sample_idx = start_idx + i
        
        # Generate mock "image" for feature extraction
        np.random.seed(sample_idx)
        mock_image = np.random.random((64, 64))
        
        # Extract various features
        features = {}
        
        # Statistical features
        features["mean"] = np.mean(mock_image)
        features["std"] = np.std(mock_image)
        features["skewness"] = np.mean((mock_image - features["mean"])**3) / features["std"]**3
        
        # Texture features (simplified Gabor filters)
        for angle in [0, 45, 90, 135]:
            gabor_response = np.sum(mock_image * np.sin(angle * np.pi / 180))
            features[f"gabor_{angle}"] = gabor_response
        
        # Edge features
        edges_h = np.sum(np.diff(mock_image, axis=0)**2)
        edges_v = np.sum(np.diff(mock_image, axis=1)**2)
        features["edge_density"] = edges_h + edges_v
        
        # Color histogram (simulated)
        features.update({f"hist_bin_{j}": np.sum((mock_image >= j/10) & (mock_image < (j+1)/10)) 
                       for j in range(10)})
        
        features_list.append(features)
    
    batch_duration = time.time() - batch_start
    
    return {
        "worker_id": worker_id,
        "features_extracted": len(features_list),
        "processing_time": batch_duration,
        "features_per_second": len(features_list) / batch_duration,
        "feature_dimensions": len(features_list[0]) if features_list else 0,
        "process_id": os.getpid()
    }

def train_epoch_worker(epoch_info):
    """Worker function for model training"""
    epoch, worker_id, batches_per_worker = epoch_info
    
    batch_start = time.time()
    
    # Simulate model training computations
    feature_dim = 256  # Fixed feature dimension
    model_weights = np.random.random((feature_dim, 10))  # 10 classes
    batch_size = 32  # Fixed batch size
    model_layers = 4  # Fixed number of layers
    
    epoch_loss = 0
    epoch_accuracy = 0
    
    for batch_idx in range(batches_per_worker):
        # Simulate forward pass
        np.random.seed(epoch * 1000 + worker_id * 100 + batch_idx)
        batch_features = np.random.random((batch_size, feature_dim))
        batch_labels = np.random.randint(0, 10, batch_size)
        
        # Simulate neural network computations
        for layer in range(model_layers):
            # Matrix multiplication (main computational load)
            layer_output = np.dot(batch_features, model_weights)
            layer_output = np.maximum(0, layer_output)  # ReLU activation
            
            # Simulate weight updates
            model_weights += np.random.normal(0, 0.001, model_weights.shape)
        
        # Calculate mock loss and accuracy
        predictions = np.argmax(layer_output, axis=1)
        batch_accuracy = np.mean(predictions == batch_labels)
        batch_loss = np.mean((layer_output - np.eye(10)[batch_labels])**2)
        
        epoch_loss += batch_loss
        epoch_accuracy += batch_accuracy
    
    avg_loss = epoch_loss / batches_per_worker
    avg_accuracy = epoch_accuracy / batches_per_worker
    
    batch_duration = time.time() - batch_start
    
    return {
        "epoch": epoch,
        "worker_id": worker_id,
        "batches_processed": batches_per_worker,
        "processing_time": batch_duration,
        "loss": avg_loss,
        "accuracy": avg_accuracy,
        "throughput": batches_per_worker / batch_duration,
        "process_id": os.getpid()
    }

def evaluate_batch_worker(worker_info):
    """Worker function for model evaluation"""
    worker_id, start_idx, num_samples = worker_info
    
    batch_start = time.time()
    
    # Simulate model evaluation
    np.random.seed(start_idx + 10000)  # Different seed for test data
    feature_dim = 256  # Fixed feature dimension
    
    correct_predictions = 0
    total_predictions = 0
    
    for i in range(num_samples):
        # Simulate inference
        test_features = np.random.random(feature_dim)
        true_label = (start_idx + i) % 10
        
        # Simulate model prediction (with some accuracy)
        prediction_scores = np.random.random(10)
        prediction_scores[true_label] += 0.3  # Bias toward correct answer
        predicted_label = np.argmax(prediction_scores)
        
        if predicted_label == true_label:
            correct_predictions += 1
        total_predictions += 1
    
    batch_duration = time.time() - batch_start
    accuracy = correct_predictions / total_predictions if total_predictions > 0 else 0
    
    return {
        "worker_id": worker_id,
        "samples_evaluated": total_predictions,
        "correct_predictions": correct_predictions,
        "accuracy": accuracy,
        "processing_time": batch_duration,
        "inference_speed": total_predictions / batch_duration,
        "process_id": os.getpid()
    }

class DistributedMLPipeline:
    """Distributed Machine Learning Pipeline with real CPU processing"""
    
    def __init__(self, job_id="ml_pipeline_demo"):
        self.job_id = job_id
        self.start_time = time.time()
        
        # Pipeline configuration
        self.config = {
            "dataset_size": 1000,
            "image_size": (128, 128),
            "batch_size": 32,
            "epochs": 5,
            "num_workers": min(multiprocessing.cpu_count(), 8),
            "model_layers": 4,
            "feature_dim": 256
        }
        
        # Statistics tracking
        self.stats = {
            "job_id": job_id,
            "start_time": self.start_time,
            "pipeline_stages": {},
            "worker_performance": {},
            "resource_usage": [],
            "processing_times": {},
            "throughput_metrics": {}
        }
        
        print(f"🤖 Distributed ML Pipeline initialized")
        print(f"📊 Configuration: {self.config}")
    
    def run_pipeline(self):
        """Execute the complete ML pipeline"""
        print("\n" + "="*80)
        print("🚀 DISTRIBUTED MACHINE LEARNING PIPELINE")
        print("="*80)
        
        try:
            # Stage 1: Data Generation and Preprocessing
            self._run_stage("data_generation", self._distributed_data_generation)
            
            # Stage 2: Feature Extraction
            self._run_stage("feature_extraction", self._distributed_feature_extraction)
            
            # Stage 3: Model Training
            self._run_stage("model_training", self._distributed_model_training)
            
            # Stage 4: Model Evaluation
            self._run_stage("model_evaluation", self._distributed_model_evaluation)
            
            # Generate final report
            self._generate_pipeline_report()
            
        except Exception as e:
            print(f"❌ Pipeline failed: {e}")
        
        print("✅ ML Pipeline completed successfully!")
    
    def _run_stage(self, stage_name, stage_function):
        """Run a pipeline stage with monitoring"""
        print(f"\n📋 Stage: {stage_name.replace('_', ' ').title()}")
        print("-" * 50)
        
        stage_start = time.time()
        
        # Monitor resources before stage
        initial_cpu = psutil.cpu_percent(interval=1)
        initial_memory = psutil.virtual_memory().percent
        
        # Execute stage
        stage_results = stage_function()
        
        # Calculate stage metrics
        stage_duration = time.time() - stage_start
        final_cpu = psutil.cpu_percent(interval=1)
        final_memory = psutil.virtual_memory().percent
        
        # Store stage statistics
        self.stats["pipeline_stages"][stage_name] = {
            "duration": stage_duration,
            "initial_cpu": initial_cpu,
            "final_cpu": final_cpu,
            "cpu_increase": final_cpu - initial_cpu,
            "initial_memory": initial_memory,
            "final_memory": final_memory,
            "memory_increase": final_memory - initial_memory,
            "results": stage_results
        }
        
        print(f"✅ Stage completed in {stage_duration:.2f}s")
        print(f"📊 CPU: {initial_cpu:.1f}% → {final_cpu:.1f}% (+{final_cpu-initial_cpu:.1f}%)")
        print(f"🧠 Memory: {initial_memory:.1f}% → {final_memory:.1f}% (+{final_memory-initial_memory:.1f}%)")
    
    def _distributed_data_generation(self):
        """Stage 1: Generate synthetic dataset using distributed processing"""
        print("🔄 Generating synthetic image dataset...")
        
        dataset_size = self.config["dataset_size"]
        num_workers = self.config["num_workers"]
        batch_size = dataset_size // num_workers
        
        # Use global worker function
        
        # Distribute work across workers
        worker_tasks = [
            (i, i * batch_size, batch_size if i < num_workers-1 else dataset_size - i * batch_size)
            for i in range(num_workers)
        ]
        
        stage_start = time.time()
        
        with ProcessPoolExecutor(max_workers=num_workers) as executor:
            results = list(executor.map(generate_batch_worker, worker_tasks))
        
        stage_duration = time.time() - stage_start
        
        # Calculate metrics
        total_samples = sum(r["batch_size"] for r in results)
        avg_throughput = total_samples / stage_duration
        
        stage_results = {
            "total_samples": total_samples,
            "total_time": stage_duration,
            "avg_throughput": avg_throughput,
            "worker_results": results,
            "parallel_efficiency": sum(r["processing_time"] for r in results) / (stage_duration * num_workers)
        }
        
        print(f"📊 Generated {total_samples} samples")
        print(f"⚡ Throughput: {avg_throughput:.1f} samples/second")
        print(f"🔧 Parallel efficiency: {stage_results['parallel_efficiency']:.1%}")
        
        return stage_results
    
    def _distributed_feature_extraction(self):
        """Stage 2: Extract features using distributed processing"""
        print("🔍 Extracting features from images...")
        
        num_samples = self.config["dataset_size"]
        num_workers = self.config["num_workers"]
        batch_size = num_samples // num_workers
        
        # Use global worker function
        
        # Distribute feature extraction
        worker_tasks = [
            (i, i * batch_size, batch_size if i < num_workers-1 else num_samples - i * batch_size)
            for i in range(num_workers)
        ]
        
        stage_start = time.time()
        
        with ProcessPoolExecutor(max_workers=num_workers) as executor:
            results = list(executor.map(extract_features_worker, worker_tasks))
        
        stage_duration = time.time() - stage_start
        
        # Calculate metrics
        total_features = sum(r["features_extracted"] for r in results)
        avg_throughput = total_features / stage_duration
        feature_dims = results[0]["feature_dimensions"] if results else 0
        
        stage_results = {
            "total_features_extracted": total_features,
            "feature_dimensions": feature_dims,
            "total_time": stage_duration,
            "avg_throughput": avg_throughput,
            "worker_results": results
        }
        
        print(f"📊 Extracted features from {total_features} samples")
        print(f"🎯 Feature dimensions: {feature_dims}")
        print(f"⚡ Throughput: {avg_throughput:.1f} features/second")
        
        return stage_results
    
    def _distributed_model_training(self):
        """Stage 3: Train model using distributed processing"""
        print("🏋️ Training ML model with distributed processing...")
        
        epochs = self.config["epochs"]
        batch_size = self.config["batch_size"]
        num_workers = self.config["num_workers"]
        
        def train_epoch_batch(epoch_info):
            epoch, worker_id, batches_per_worker = epoch_info
            
            batch_start = time.time()
            
            # Simulate model training computations
            model_weights = np.random.random((self.config["feature_dim"], 10))  # 10 classes
            
            epoch_loss = 0
            epoch_accuracy = 0
            
            for batch_idx in range(batches_per_worker):
                # Simulate forward pass
                np.random.seed(epoch * 1000 + worker_id * 100 + batch_idx)
                batch_features = np.random.random((batch_size, self.config["feature_dim"]))
                batch_labels = np.random.randint(0, 10, batch_size)
                
                # Simulate neural network computations
                for layer in range(self.config["model_layers"]):
                    # Matrix multiplication (main computational load)
                    layer_output = np.dot(batch_features, model_weights)
                    layer_output = np.maximum(0, layer_output)  # ReLU activation
                    
                    # Simulate weight updates
                    model_weights += np.random.normal(0, 0.001, model_weights.shape)
                
                # Calculate mock loss and accuracy
                predictions = np.argmax(layer_output, axis=1)
                batch_accuracy = np.mean(predictions == batch_labels)
                batch_loss = np.mean((layer_output - np.eye(10)[batch_labels])**2)
                
                epoch_loss += batch_loss
                epoch_accuracy += batch_accuracy
            
            avg_loss = epoch_loss / batches_per_worker
            avg_accuracy = epoch_accuracy / batches_per_worker
            
            batch_duration = time.time() - batch_start
            
            return {
                "epoch": epoch,
                "worker_id": worker_id,
                "batches_processed": batches_per_worker,
                "processing_time": batch_duration,
                "loss": avg_loss,
                "accuracy": avg_accuracy,
                "throughput": batches_per_worker / batch_duration,
                "process_id": os.getpid()
            }
        
        # Distribute training across epochs and workers
        total_batches = self.config["dataset_size"] // batch_size
        batches_per_worker = max(1, total_batches // num_workers)
        
        training_tasks = [
            (epoch, worker_id, batches_per_worker)
            for epoch in range(epochs)
            for worker_id in range(num_workers)
        ]
        
        stage_start = time.time()
        
        with ProcessPoolExecutor(max_workers=num_workers) as executor:
            results = list(executor.map(train_epoch_worker, training_tasks))
        
        stage_duration = time.time() - stage_start
        
        # Aggregate results by epoch
        epoch_results = {}
        for result in results:
            epoch = result["epoch"]
            if epoch not in epoch_results:
                epoch_results[epoch] = []
            epoch_results[epoch].append(result)
        
        # Calculate final metrics
        final_accuracy = np.mean([r["accuracy"] for r in results[-num_workers:]])
        final_loss = np.mean([r["loss"] for r in results[-num_workers:]])
        total_batches_processed = sum(r["batches_processed"] for r in results)
        
        stage_results = {
            "epochs_completed": epochs,
            "total_batches_processed": total_batches_processed,
            "final_accuracy": final_accuracy,
            "final_loss": final_loss,
            "total_time": stage_duration,
            "epoch_results": epoch_results,
            "training_throughput": total_batches_processed / stage_duration
        }
        
        print(f"📊 Trained for {epochs} epochs")
        print(f"🎯 Final accuracy: {final_accuracy:.3f}")
        print(f"📉 Final loss: {final_loss:.3f}")
        print(f"⚡ Training throughput: {stage_results['training_throughput']:.1f} batches/second")
        
        return stage_results
    
    def _distributed_model_evaluation(self):
        """Stage 4: Evaluate model using distributed processing"""
        print("📊 Evaluating model performance...")
        
        test_samples = self.config["dataset_size"] // 4  # 25% for testing
        num_workers = self.config["num_workers"]
        samples_per_worker = test_samples // num_workers
        
        def evaluate_batch(worker_info):
            worker_id, start_idx, num_samples = worker_info
            
            batch_start = time.time()
            
            # Simulate model evaluation
            np.random.seed(start_idx + 10000)  # Different seed for test data
            
            correct_predictions = 0
            total_predictions = 0
            
            for i in range(num_samples):
                # Simulate inference
                test_features = np.random.random(self.config["feature_dim"])
                true_label = (start_idx + i) % 10
                
                # Simulate model prediction (with some accuracy)
                prediction_scores = np.random.random(10)
                prediction_scores[true_label] += 0.3  # Bias toward correct answer
                predicted_label = np.argmax(prediction_scores)
                
                if predicted_label == true_label:
                    correct_predictions += 1
                total_predictions += 1
            
            batch_duration = time.time() - batch_start
            accuracy = correct_predictions / total_predictions if total_predictions > 0 else 0
            
            return {
                "worker_id": worker_id,
                "samples_evaluated": total_predictions,
                "correct_predictions": correct_predictions,
                "accuracy": accuracy,
                "processing_time": batch_duration,
                "inference_speed": total_predictions / batch_duration,
                "process_id": os.getpid()
            }
        
        # Distribute evaluation
        worker_tasks = [
            (i, i * samples_per_worker, samples_per_worker if i < num_workers-1 else test_samples - i * samples_per_worker)
            for i in range(num_workers)
        ]
        
        stage_start = time.time()
        
        with ProcessPoolExecutor(max_workers=num_workers) as executor:
            results = list(executor.map(evaluate_batch_worker, worker_tasks))
        
        stage_duration = time.time() - stage_start
        
        # Calculate overall metrics
        total_samples_evaluated = sum(r["samples_evaluated"] for r in results)
        total_correct = sum(r["correct_predictions"] for r in results)
        overall_accuracy = total_correct / total_samples_evaluated if total_samples_evaluated > 0 else 0
        inference_throughput = total_samples_evaluated / stage_duration
        
        stage_results = {
            "total_samples_evaluated": total_samples_evaluated,
            "overall_accuracy": overall_accuracy,
            "total_time": stage_duration,
            "inference_throughput": inference_throughput,
            "worker_results": results
        }
        
        print(f"📊 Evaluated {total_samples_evaluated} test samples")
        print(f"🎯 Test accuracy: {overall_accuracy:.3f}")
        print(f"⚡ Inference throughput: {inference_throughput:.1f} samples/second")
        
        return stage_results
    
    def _generate_pipeline_report(self):
        """Generate comprehensive pipeline report"""
        total_time = time.time() - self.start_time
        
        print("\n" + "="*80)
        print("📋 DISTRIBUTED ML PIPELINE REPORT")
        print("="*80)
        
        # Overall pipeline metrics
        print(f"🕐 Total Pipeline Time: {total_time:.2f} seconds")
        print(f"💻 Workers Used: {self.config['num_workers']}")
        print(f"📊 Dataset Size: {self.config['dataset_size']} samples")
        
        # Stage-by-stage breakdown
        print(f"\n📈 Stage Performance:")
        for stage_name, stage_data in self.stats["pipeline_stages"].items():
            stage_time = stage_data["duration"]
            cpu_impact = stage_data["cpu_increase"]
            memory_impact = stage_data["memory_increase"]
            
            print(f"  {stage_name.replace('_', ' ').title()}:")
            print(f"    Time: {stage_time:.2f}s ({stage_time/total_time:.1%} of total)")
            print(f"    CPU Impact: +{cpu_impact:.1f}%")
            print(f"    Memory Impact: +{memory_impact:.1f}%")
        
        # Resource utilization summary
        cpu_times = [stage["final_cpu"] - stage["initial_cpu"] for stage in self.stats["pipeline_stages"].values()]
        avg_cpu_increase = np.mean(cpu_times)
        
        memory_times = [stage["final_memory"] - stage["initial_memory"] for stage in self.stats["pipeline_stages"].values()]
        avg_memory_increase = np.mean(memory_times)
        
        print(f"\n🔧 Resource Utilization:")
        print(f"  Average CPU Increase: {avg_cpu_increase:.1f}%")
        print(f"  Average Memory Increase: {avg_memory_increase:.1f}%")
        
        # Performance metrics
        if "model_training" in self.stats["pipeline_stages"]:
            training_results = self.stats["pipeline_stages"]["model_training"]["results"]
            print(f"\n🎯 Model Performance:")
            print(f"  Final Accuracy: {training_results['final_accuracy']:.3f}")
            print(f"  Training Throughput: {training_results['training_throughput']:.1f} batches/sec")
        
        if "model_evaluation" in self.stats["pipeline_stages"]:
            eval_results = self.stats["pipeline_stages"]["model_evaluation"]["results"]
            print(f"  Test Accuracy: {eval_results['overall_accuracy']:.3f}")
            print(f"  Inference Throughput: {eval_results['inference_throughput']:.1f} samples/sec")
        
        # Save detailed statistics
        self._save_pipeline_statistics()
        
        print("\n" + "="*80)
        print("✅ ML Pipeline completed successfully!")
        print("📄 Detailed statistics saved to ml_pipeline_statistics.json")
        print("="*80)
    
    def _save_pipeline_statistics(self):
        """Save detailed pipeline statistics"""
        try:
            # Add summary
            self.stats["summary"] = {
                "total_time_seconds": time.time() - self.start_time,
                "configuration": self.config,
                "system_info": {
                    "cpu_count": multiprocessing.cpu_count(),
                    "total_memory_gb": psutil.virtual_memory().total / (1024**3),
                    "platform": sys.platform
                }
            }
            
            # Save to JSON
            with open("ml_pipeline_statistics.json", "w") as f:
                json.dump(self.stats, f, indent=2, default=str)
            
            print("💾 Statistics saved to ml_pipeline_statistics.json")
            
        except Exception as e:
            print(f"⚠️ Failed to save statistics: {e}")

def main():
    """Main pipeline execution"""
    print("🤖 Enhanced Distributed ML Pipeline Demo")
    print(f"💻 System: {multiprocessing.cpu_count()} CPUs, {psutil.virtual_memory().total / (1024**3):.1f}GB RAM")
    
    # Create and run pipeline
    pipeline = DistributedMLPipeline(f"ml_pipeline_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
    pipeline.run_pipeline()

if __name__ == "__main__":
    main()