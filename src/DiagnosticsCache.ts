import * as ts from "typescript";
import * as fs from "fs";

export class DiagnosticsCache {
  static readonly file2mtime = new Map<string, number>();
  static readonly file2diagnostics = new Map<string, ts.Diagnostic[]>();

  static read(fileName: string) {
    if (!DiagnosticsCache.file2mtime.has(fileName)) {
      return null;
    }

    const cachedMtime = DiagnosticsCache.file2mtime.get(fileName);
    const currentMtime = DiagnosticsCache.valueOf(fileName);
    if (cachedMtime === currentMtime) {
      return null;
    }

    if (!DiagnosticsCache.file2diagnostics.has(fileName)) {
      return null;
    }

    return DiagnosticsCache.file2diagnostics.get(fileName) ?? null;
  }

  static upsert(fileName: string, diagnostics: ts.Diagnostic[]) {
    DiagnosticsCache.file2mtime.set(
      fileName,
      DiagnosticsCache.valueOf(fileName)
    );

    DiagnosticsCache.file2diagnostics.set(fileName, diagnostics);
  }

  static valueOf(fileName: string) {
    return fs.statSync(fileName).mtimeMs;
  }
}
