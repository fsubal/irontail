import * as fs from "fs";
import * as ts from "typescript/lib/tsserverlibrary";
import { TailwindErrorChecker } from "./src/TailwindErrorChecker";
import { getTailwindConfigPath } from "./src/getTailwindConfigPath";

const factory: ts.server.PluginModuleFactory = () => ({
  create({ project, languageService: parent }) {
    const checker = new TailwindErrorChecker(project);
    checker.loadCss();

    fs.watch(getTailwindConfigPath(project), () => {
      checker.loadCss();
    });

    return {
      ...parent,

      getSemanticDiagnostics(fileName: string) {
        const diagnostics = parent.getSemanticDiagnostics(fileName);
        if (TailwindErrorChecker.isPending) {
          return diagnostics;
        }

        const program = parent.getProgram();
        if (!program) {
          throw new Error("language service host does not have program!");
        }

        const source = program.getSourceFile(fileName);
        if (!source) {
          throw new Error("No source file: " + fileName);
        }

        const tailwindDiagnostics = checker.getTailwindDiagnostics(source);

        return [...tailwindDiagnostics, ...diagnostics];
      },

      dispose() {
        checker.stop();
      },
    };
  },
});

export = factory;
