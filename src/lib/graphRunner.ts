import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import path from 'path';

type Task = {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
};

class GraphRunner {
  private static instance: GraphRunner;
  private child: ChildProcessWithoutNullStreams | null = null;
  private queue: Task[] = [];
  private buffer = '';

  // 初期化制御用のプロパティ
  private isReady = false;
  private readyPromise: Promise<void>;
  private signalReady: () => void = () => {}; // 初期値ダミー

  private constructor() {
    // 1. 外部から解決可能なPromiseを作成しておく
    this.readyPromise = new Promise((resolve) => {
      this.signalReady = resolve;
    });
    
    this.init();
  }

  public getReadyState(): boolean {
    return this.isReady;
  }

  public static getInstance(): GraphRunner {
    if (!GraphRunner.instance) {
      GraphRunner.instance = new GraphRunner();
    }
    return GraphRunner.instance;
  }

  private init() {
    const binaryPath = path.resolve('./build/graph_solver');

    console.log(`[Node] Spawning C++: ${binaryPath}`);
    this.child = spawn(binaryPath);

    // --- 標準出力のハンドリング ---
    this.child.stdout.on('data', (data) => {
      this.buffer += data.toString();

      if (this.buffer.includes('\n')) {
        const lines = this.buffer.split('\n');
        this.buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          // JSONパースを試みる
          try {
            const result = JSON.parse(line);

            // Readyシグナルの検知
            if (!this.isReady && result.status === 'ready') {
              console.log('[Node] C++ Process is READY.');
              this.isReady = true;
              this.signalReady(); // 待機しているPromiseを解放
            } else {
              // 通常のタスク処理
              this.resolveTask(result);
            }
          } catch (e) {
            console.error(`[Node] Parse Error: ${line}`);
          }
        }
      }
    });

    this.child.stderr.on('data', (data) => {
      console.error(`[C++ Log] ${data}`);
    });

    this.child.on('close', (code: number | null, signal: string | null) => {
      // When a process is terminated by a signal, `code` will be null and
      // `signal` will contain the signal name (e.g. 'SIGABRT', 'SIGKILL').
      console.error(`[Node] C++ process exited with code ${code} signal ${signal}`);
      this.child = null;
      this.isReady = false;
    });

    this.child.on('error', (err: Error) => {
      console.error(`[Node] Failed to start C++ process: ${err.message}`);
    });
  }

  public waitForReady(): Promise<void> {
    // 既に準備完了なら即座に終了
    if (this.isReady) {
      return Promise.resolve();
    }
    // 準備完了を待つ際は、コンストラクタで作成した readyPromise を返す
    // （以前の実装は個別のresolve関数配列を使っていたが、readyPromise と整合していなかった）
    return this.readyPromise;
  }

  // APIから呼ばれるメソッド
  public async execute(payload: object): Promise<any> {
    // 2. まだ準備ができていなければ、ここで完了するまで待機する
    if (!this.isReady) {
      console.log('[Node] Waiting for C++ to be ready...');
      await this.readyPromise;
    }

    // 準備完了後に実行
    return new Promise((resolve, reject) => {
      if (!this.child) {
        return reject(new Error('C++ process is not running'));
      }
      this.queue.push({ resolve, reject });
      this.child.stdin.write(JSON.stringify(payload) + '\n');
    });
  }

  private resolveTask(result: any) {
    const task = this.queue.shift();
    if (task) {
      task.resolve(result);
    }
  }
}

export default GraphRunner;