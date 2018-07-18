import * as vscode from "vscode";
import { NodeBase } from "./models/nodeBase";
import { RootNode } from "./models/rootNode";

export class COSExplorerProvider implements vscode.TreeDataProvider<NodeBase>, vscode.TextDocumentContentProvider {
  onDidChange?: vscode.Event<vscode.Uri>;
  private _onDidChangeTreeData: vscode.EventEmitter<NodeBase> = new vscode.EventEmitter<NodeBase>();
  readonly onDidChangeTreeData: vscode.Event<NodeBase> = this._onDidChangeTreeData.event;
  private _classesNode: RootNode;
  private _routinesNode: RootNode;
  private _api;
  private _namespace: string;
  private _showSystem = false;

  constructor() {}

  get showSystem(): boolean {
    return this._showSystem;
  }

  set showSystem(value) {
    this._showSystem = value;
    this._onDidChangeTreeData.fire(null);
  }

  setAPI(api, namespace: string): void {
    this._api = api;
    this._namespace = namespace;
    this._onDidChangeTreeData.fire(null);
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(this._classesNode);
    this._onDidChangeTreeData.fire(this._routinesNode);
  }

  getTreeItem(element: NodeBase): vscode.TreeItem {
    return element.getTreeItem();
  }

  async getChildren(element?: NodeBase): Promise<NodeBase[]> {
    if (!element) {
      return this.getRootNodes();
    }
    return element.getChildren(element);
  }

  private async getRootNodes(): Promise<RootNode[]> {
    const rootNodes: RootNode[] = [];
    let node: RootNode;
    let data: any;

    data = await this.getDocNames("CLS");
    node = new RootNode("Classes", "classesRootNode", this._onDidChangeTreeData, data);
    this._classesNode = node;
    rootNodes.push(node);

    data = await this.getDocNames("RTN");
    node = new RootNode("Routines", "routinesRootNode", this._onDidChangeTreeData, data);
    this._routinesNode = node;
    rootNodes.push(node);

    return rootNodes;
  }

  getDocNames(category: string): Promise<any> {
    const excludeSystem =
      this._showSystem || this._namespace === "%SYS"
        ? () => true
        : ({ db }) => !["IRISLIB", "IRISSYS", "CACHELIB", "CACHESYS"].includes(db);

    return new Promise((resolve, reject) => {
      this._api.getDocNames(
        {
          category
        },
        (error, data) => {
          if (error) {
            reject(error);
          } else {
            let content = data.result.content;
            content = content.filter(excludeSystem);
            resolve(content);
          }
        }
      );
    });
  }

  provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): vscode.ProviderResult<string> {
    let fileName = uri.path.split("/")[1];
    return new Promise((resolve, reject) => {
      this._api.getDoc(fileName, (error, data) => {
        if (error) {
          reject(error);
        } else {
          resolve(data.result.content.join("\n"));
        }
      });
    });
  }
}
