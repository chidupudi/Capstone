#!/bin/bash
# TrainForge K8s Demo Deployment Script
# Demonstrates distributed CPU processing vs traditional computing

echo "=================================================="
echo "🚀 TrainForge Distributed CPU Processing Demo"
echo "=================================================="

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl not found. Please install kubectl first."
    exit 1
fi

# Check if K8s cluster is running
if ! kubectl cluster-info &> /dev/null; then
    echo "❌ Kubernetes cluster not accessible. Please start your cluster."
    exit 1
fi

echo "✅ Kubernetes cluster is accessible"

# Function to wait for pods to be ready
wait_for_pods() {
    local label_selector=$1
    local expected_count=$2
    local timeout=${3:-300}  # 5 minutes default
    
    echo "⏳ Waiting for $expected_count pods with label '$label_selector' to be ready..."
    
    local count=0
    while [ $count -lt $timeout ]; do
        local ready_pods=$(kubectl get pods -l "$label_selector" -o jsonpath='{.items[?(@.status.phase=="Running")].metadata.name}' | wc -w)
        
        if [ "$ready_pods" -eq "$expected_count" ]; then
            echo "✅ All $expected_count pods are ready!"
            return 0
        fi
        
        echo "   Waiting... ($ready_pods/$expected_count pods ready)"
        sleep 5
        count=$((count + 5))
    done
    
    echo "❌ Timeout waiting for pods to be ready"
    return 1
}

# Function to show pod status
show_pod_status() {
    echo ""
    echo "📊 Current Pod Status:"
    kubectl get pods -l app=trainforge-worker -o wide
    echo ""
    kubectl get pods -l app=trainforge-scheduler -o wide
    echo ""
    kubectl get pods -l app=trainforge-monitor -o wide
    echo ""
}

# Deploy TrainForge components
echo ""
echo "🚀 Deploying TrainForge components..."

echo "1. Deploying CPU workers (4 replicas)..."
kubectl apply -f worker-deployment.yaml
if [ $? -ne 0 ]; then
    echo "❌ Failed to deploy workers"
    exit 1
fi

echo "2. Deploying job scheduler..."
kubectl apply -f job-scheduler.yaml
if [ $? -ne 0 ]; then
    echo "❌ Failed to deploy scheduler"
    exit 1
fi

echo "3. Deploying monitoring stack..."
kubectl apply -f monitoring.yaml
if [ $? -ne 0 ]; then
    echo "❌ Failed to deploy monitoring"
    exit 1
fi

# Wait for components to be ready
echo ""
echo "⏳ Waiting for components to be ready..."

if wait_for_pods "app=trainforge-worker" 4 180; then
    echo "✅ Workers are ready"
else
    echo "❌ Workers failed to start"
    show_pod_status
    exit 1
fi

if wait_for_pods "app=trainforge-scheduler" 1 120; then
    echo "✅ Scheduler is ready"
else
    echo "❌ Scheduler failed to start"
    show_pod_status
    exit 1
fi

if wait_for_pods "app=trainforge-monitor" 1 120; then
    echo "✅ Monitor is ready"
else
    echo "❌ Monitor failed to start"
    show_pod_status
    exit 1
fi

# Show current status
show_pod_status

echo "=================================================="
echo "🎉 TrainForge Demo Environment Ready!"
echo "=================================================="

echo ""
echo "📋 Demo Commands:"
echo ""
echo "1. View distributed workers:"
echo "   kubectl get pods -l app=trainforge-worker"
echo ""
echo "2. Watch worker logs (distributed training):"
echo "   kubectl logs -l app=trainforge-worker -f"
echo ""
echo "3. Monitor scheduler activity:"
echo "   kubectl logs -l app=trainforge-scheduler -f"
echo ""
echo "4. View resource monitoring:"
echo "   kubectl logs -l app=trainforge-monitor -f"
echo ""
echo "5. Run traditional vs distributed comparison:"
echo "   kubectl apply -f demo-job.yaml"
echo ""
echo "6. Check demo job results:"
echo "   kubectl logs -l type=traditional"
echo "   kubectl logs -l type=distributed"
echo ""
echo "7. Clean up demo:"
echo "   kubectl delete -f demo-job.yaml"
echo "   kubectl delete -f worker-deployment.yaml"
echo "   kubectl delete -f job-scheduler.yaml"
echo "   kubectl delete -f monitoring.yaml"
echo ""
echo "=================================================="
echo "🔗 Dashboard Integration:"
echo "Your React dashboard can now connect to:"
echo "   K8s API: kubectl proxy --port=8001"
echo "   Then access: http://localhost:8001/api/v1"
echo "=================================================="