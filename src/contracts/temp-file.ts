export interface TempFileResult {
  readonly filePath: string
  readonly cleanup: () => Promise<void>
}
