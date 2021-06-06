import * as ts from "typescript/lib/tsserverlibrary";
import { ClassNameDiagnostic } from "./ClassNameDiagnostic";
import { TailwindClient } from "./TailwindClient";

export class TailwindErrorChecker {
  private readonly tailwind = new TailwindClient(this.project);

  static isPending = false;

  constructor(private readonly project: ts.server.Project) {}

  /**
   * It's SLOW. Call only when really needed
   */
  loadCss() {
    if (TailwindClient.currentClasses && this.tailwind.isFresh()) {
      return;
    }

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

  getTailwindDiagnostics(sourceFile: ts.SourceFile) {
    const classNameDiagnostic = new ClassNameDiagnostic(
      sourceFile,
      this.tailwind.getClassNames()
    );

    this.project.projectService.logger.info("checking classnames usages...");

    return classNameDiagnostic
      .toArray()
      .map(({ start, length, messageText }) => ({
        source: "irontail",
        category: ts.DiagnosticCategory.Warning,
        code: 0,
        file: sourceFile,
        start,
        length,
        messageText,
      }));
  }
}
