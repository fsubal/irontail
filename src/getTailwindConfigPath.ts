import * as ts from "typescript/lib/tsserverlibrary";
import * as glob from "glob";
import * as path from "path";

/**
 * @see https://github.com/tailwindlabs/tailwindcss-intellisense/blob/eb28c540c3cff7cf4c625cf44a81e8a44164a9ed/src/class-names/index.js#L36
 */
const CONFIG_GLOB =
  "**/{tailwind,tailwind.config,tailwind-config,.tailwindrc}.js";

export function getTailwindConfigPath(project: ts.server.Project) {
  const projectRootPath = project.getCurrentDirectory();
  const configGlob = path.join(projectRootPath, CONFIG_GLOB);
  const [configPath] = glob.sync(configGlob);

  if (!configPath) {
    throw new Error("Cannot find tailwind config");
  }

  if (!project.fileExists(configPath)) {
    throw new Error("Cannot find tailwind config");
  }

  return configPath;
}
