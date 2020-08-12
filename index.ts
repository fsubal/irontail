import * as ts from "typescript/lib/tsserverlibrary";
import { TailwindErrorChecker } from "./src/TailwindErrorChecker";

const factory: ts.server.PluginModuleFactory = () => ({
  create({ project, languageService: parent }) {
    const checker = new TailwindErrorChecker(project);

    return {
      ...parent,

      /**
       * 与えられた fileName にある型エラーの一覧を返す。
       *
       * tailwind 関連のエラーがなければデフォルトの挙動のまま
       */
      getSemanticDiagnostics(fileName: string) {
        const diagnostics = parent.getSemanticDiagnostics(fileName);
        if (TailwindErrorChecker.isPending) {
          return diagnostics;
        }

        const tailwindDiagnostics = checker.getTailwindDiagnostics(fileName);

        return [...tailwindDiagnostics, ...diagnostics];
      },

      dispose() {
        checker.stop();
      },
    };
  },
});

export = factory;
