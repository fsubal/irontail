import ts from "typescript/lib/tsserverlibrary";

const factory: ts.server.PluginModuleFactory = (_mod: {
  typescript: typeof ts;
}) => {
  const pluginModule: ts.server.PluginModule = {
    create: create,
  };
  return pluginModule;
};

function create(info: ts.server.PluginCreateInfo): ts.LanguageService {
  const ls = info.languageService;

  // オリジナルのメソッドを退避しておく
  const delegate = ls.getQuickInfoAtPosition;

  // tooltip用のメソッドを上書き
  ls.getQuickInfoAtPosition = (fileName: string, position: number) => {
    const result = delegate(fileName, position)!; // 元メソッドを呼び出す
    if (!result.displayParts || !result.displayParts.length) {
      return result;
    }

    // 結果を修正する
    result.displayParts = [
      { kind: "", text: " 🎉🎉 " },
      ...result.displayParts,
      { kind: "", text: " 🎉🎉 " },
    ];

    return result;
  };

  return ls;
}

export = factory;
