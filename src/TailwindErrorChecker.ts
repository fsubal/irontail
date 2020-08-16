import * as ts from "typescript/lib/tsserverlibrary";
import { ClassNameDiagnostic } from "./ClassNameDiagnostic";
import { TailwindClient } from "./TailwindClient";

export class TailwindErrorChecker {
  private readonly tailwind = new TailwindClient(this.project);

  static isLoadingCss = false;

  constructor(private readonly project: ts.server.Project) {}

  /**
   * It's SLOW. Call only when really needed
   */
  loadCss() {
    if (TailwindClient.currentClasses && this.tailwind.isFresh()) {
      return;
    }

    if (TailwindErrorChecker.isLoadingCss) {
      return;
    }

    TailwindErrorChecker.isLoadingCss = true;
    this.project.projectService.logger.info(
      "enqueuing to load css definitions..."
    );

    void this.tailwind.requestCompileCss().finally(() => {
      this.onFinishLoadCss();
    });
  }

  onFinishLoadCss() {
    TailwindErrorChecker.isLoadingCss = false;
  }

  getTailwindDiagnostics(sourceFile: ts.SourceFile) {
    const classNameDiagnostic = new ClassNameDiagnostic(
      sourceFile,
      this.tailwind
    );

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
}
