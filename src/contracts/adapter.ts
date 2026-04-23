import type { ChildProcess } from 'child_process';
import type { Readable, Writable } from 'stream';

export interface AdapterHandle {
  readonly process: ChildProcess;
  readonly stdin: Writable;
  readonly stdout: Readable;
  getStderr(): string;
  kill(): void;
}
