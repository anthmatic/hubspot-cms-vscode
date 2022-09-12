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

async function activate(context: vscode.ExtensionContext) {
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

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      [
        { language: 'hubl', scheme: 'file' },
        { language: 'hubl-html', scheme: 'file' },
      ],
      {
        // eslint-disable-next-line no-unused-vars
        provideCompletionItems(document, position, token, context) {
          const linePrefix = document
            .lineAt(position)
            .text.substring(0, position.character);
          if (!linePrefix.endsWith('sometesttext.')) {
            return undefined;
          }
          let myitem = (text: string) => {
            let item = new vscode.CompletionItem(
              text,
              vscode.CompletionItemKind.Text
            );
            item.range = new vscode.Range(position, position);
            return item;
          };
          return [myitem('log'), myitem('warn'), myitem('error')];
        },
      },
      '.' // trigger
    )
  );
}

module.exports = {
  activate,
};
