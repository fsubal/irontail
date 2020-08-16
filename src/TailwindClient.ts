import * as ts from "typescript/lib/tsserverlibrary";
import * as fs from "fs";
import * as path from "path";
import extractClassNames from "./extractClassNames";
import importFrom = require("import-from");
import resolveFrom = require("resolve-from");
import type { Result } from "postcss";
import { getTailwindConfigPath } from "./getTailwindConfigPath";

export class TailwindClient {
  static currentClasses?: Record<string, unknown>;

  static lastUpdatedAt?: number;

  getLastUpdatedAt() {
    return fs.statSync(this.getConfigPath()).mtime.getTime();
  }

  isFresh() {
    return TailwindClient.lastUpdatedAt === this.getLastUpdatedAt();
  }

  constructor(private readonly project: ts.server.Project) {}

  getClassNames() {
    return TailwindClient.currentClasses ?? {};
  }

  getConfigPath() {
    return getTailwindConfigPath(this.project);
  }

  async requestCompileCss() {
    const configPath = this.getConfigPath();
    const postcss = this.requirePostCss();
    const tailwindcss = this.requireTailwindCss();

    return Promise.all(
      ["base", "components", "utilities"].map((group) =>
        postcss([tailwindcss(configPath)]).process(`@tailwind ${group};`, {
          from: undefined,
          to: undefined,
          map: false,
        })
      )
    ).then((result) => {
      TailwindClient.lastUpdatedAt = this.getLastUpdatedAt();
      TailwindClient.currentClasses = this.extractClassNames(result);

      this.project.projectService.logger.info("compiled tailwind.css");
    });
  }

  private requirePostCss() {
    const configPath = this.getConfigPath();
    const tailwindRootPath = path.dirname(
      resolveFrom(configPath, "tailwindcss/package.json")
    );

    return importFrom(tailwindRootPath, "postcss") as typeof import("postcss");
  }

  private extractClassNames([base, components, utilities]: Result[]) {
    const { classNames } = extractClassNames([
      { root: base.root, source: "base" },
      { root: components.root, source: "components" },
      { root: utilities.root, source: "utilities" },
    ]);

    return classNames;
  }

  private requireTailwindCss() {
    return importFrom(
      path.dirname(this.getConfigPath()),
      "tailwindcss"
    ) as Function;
  }
}
