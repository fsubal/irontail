import * as fs from "fs";
import * as ts from "typescript/lib/tsserverlibrary";
import { ClassNameDiagnostic } from "./ClassNameDiagnostic";
import { TailwindClient } from "./TailwindClient";

export class TailwindErrorChecker {
  private readonly tailwind = new TailwindClient(this.project);
  private readonly compilerOption = this.project.getCompilerOptions();

  static isPending = false;

  constructor(private readonly project: ts.server.Project) {}

  requestCompileCss() {
    if (TailwindErrorChecker.isPending) {
      return;
    }

    TailwindErrorChecker.isPending = true;
    this.project.projectService.logger.info(
      "enqueuing to load css definitions..."
    );

    void this.tailwind.requestCompileCss().finally(() => {
      this.stop();
    });
  }

  stop() {
    TailwindErrorChecker.isPending = false;
  }

  getTailwindDiagnostics(fileName: string) {
    const sourceFile = this.createSourceFile(fileName);
    const classNameDiagnostic = new ClassNameDiagnostic(
      sourceFile,
      this.tailwind
    );

    if (!TailwindClient.currentClasses || !this.tailwind.isFresh()) {
      this.requestCompileCss();
    }

    this.project.projectService.logger.info("checking classnames usages...");

    return classNameDiagnostic
      .toArray()
      .map(({ start, length, messageText }) => ({
        source: "irontail",
        category: ts.DiagnosticCategory.Error,
        code: 0,
        file: sourceFile,
        start,
        length,
        messageText,
      }));
  }

  createSourceFile(fileName: string) {
    const src = fs.readFileSync(fileName, { encoding: "utf8" });

    return ts.createSourceFile(
      fileName,
      src,
      this.compilerOption.target ?? ts.ScriptTarget.ESNext
    );
  }
}
