import * as vscode from 'vscode';
const {
  findConfig,
  loadConfig,
  validateConfig,
  getAccountId,
  isTrackingAllowed,
  getAccountConfig,
} = require('@hubspot/cli-lib');
const { enableLinting, disableLinting } = require('./lib/lint');
const { trackUsage } = require('@hubspot/cli-lib/api/fileMapper');
const { notifyBeta } = require('./lib/notify');
const {
  EXTENSION_CONFIG_NAME,
  EXTENSION_CONFIG_KEYS,
} = require('./lib/constants');

let logLine = vscode.window.createOutputChannel('testing');

async function activate(context: vscode.ExtensionContext) {
  logLine.appendLine(`Activation.`);
  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (!workspaceFolders || workspaceFolders.length < 1) {
    return;
  }

  const rootPath = workspaceFolders[0].uri.fsPath;

  if (!rootPath) {
    return;
  }

  const path = findConfig(rootPath);

  if (!path) {
    return;
  }

  loadConfig(path);

  if (!validateConfig()) {
    return;
  }

  const trackAction = async (action: string) => {
    if (!isTrackingAllowed()) {
      return;
    }

    let authType = 'unknown';
    const accountId = getAccountId();

    if (accountId) {
      const accountConfig = getAccountConfig(accountId);
      authType =
        accountConfig && accountConfig.authType
          ? accountConfig.authType
          : 'apikey';
    }

    await trackUsage(
      'vscode-extension-interaction',
      'INTERACTION',
      { authType, action },
      accountId
    );
  };

  await trackAction('extension-activated');

  if (
    vscode.workspace
      .getConfiguration(EXTENSION_CONFIG_NAME)
      .get(EXTENSION_CONFIG_KEYS.HUBL_LINTING)
  ) {
    enableLinting();
  }

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      logLine.appendLine(`Configuration changed.`);
      if (
        e.affectsConfiguration(
          `${EXTENSION_CONFIG_NAME}.${EXTENSION_CONFIG_KEYS.HUBL_LINTING}`
        )
      ) {
        if (
          vscode.workspace
            .getConfiguration(EXTENSION_CONFIG_NAME)
            .get(EXTENSION_CONFIG_KEYS.HUBL_LINTING)
        ) {
          enableLinting();
          await trackAction('linting-enabled');
        } else {
          disableLinting();
          await trackAction('linting-disabled');
        }
      }
    })
  );


  // ==========================
  //    Explore Week Testing
  // ==========================

  const fakeContext = {

  }

  // Format:
  //
  // [defaultTagName, tagProperties = {
  //   property: defaultValue,
  //   anotherProperty: anotherDefaultValue
  // }]
  const hublTags = {
    ['blog_comments']: ['blog_comments', {
      limit: 5000,
      ['select_blog']: 'default',
      ['skip_css']: false
    }],
    ['related_blog_posts']: [null, {
      ['blog_ids']: null, // '1, 2'
      ['blog_post_ids']:

    }]
  };

  const consoleLogSuggestionHandler = {
    provideCompletionItems(
      document: vscode.TextDocument,
      position: vscode.Position
    ) {
      logLine.appendLine('consoleLogSuggestionHandler');
      // get all text until the `position` and check if it reads `console.`
      // and if so then complete if `log`, `warn`, and `error`
      const linePrefix = document
        .lineAt(position)
        .text.substr(0, position.character);
      if (!linePrefix.endsWith('console.')) {
        return undefined;
      }

      return [
        new vscode.CompletionItem('log', vscode.CompletionItemKind.Method),
        new vscode.CompletionItem('warn', vscode.CompletionItemKind.Method),
        new vscode.CompletionItem('error', vscode.CompletionItemKind.Method),
      ];
    },
  };

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      'html-hubl',
      consoleLogSuggestionHandler,
      '.' // triggered whenever a '.' is being typed
    ),
    vscode.languages.registerCompletionItemProvider(
      'plaintext',
      consoleLogSuggestionHandler,
      '.' // triggered whenever a '.' is being typed
    )
  );
}

module.exports = {
  activate,
};
