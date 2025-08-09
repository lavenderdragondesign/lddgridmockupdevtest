
// uiWorkerPool.ts
import UIWorker from './ui.worker.ts?worker';

const WORKER_COUNT = 3;
const workerPool: Worker[] = [];
let currentIndex = 0;

for (let i = 0; i < WORKER_COUNT; i++) {
  workerPool.push(new UIWorker());
}

export function renderWithWorkerPool(data: any) {
  const worker = workerPool[currentIndex];
  currentIndex = (currentIndex + 1) % WORKER_COUNT;
  worker.postMessage(data);
}
