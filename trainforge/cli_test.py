import time
print("Starting TrainForge CLI test script...")
for i in range(5):
    print(f"Epoch {i+1}/5 - Loss: {0.5 - i*0.05:.4f}")
    time.sleep(2)
print("Finished!")
